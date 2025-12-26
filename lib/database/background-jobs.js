/**
 * lib/database/background-jobs.js - Jobs de maintenance en arrière-plan
 * 
 * Gère les tâches automatiques :
 * - Rafraîchissement des items expirés
 * - Nettoyage des vieux items
 * - Statistiques de santé
 * 
 * toys_api v4.0.0
 */

import { query, queryAll, isCacheEnabled } from './connection.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('BackgroundJobs');

// Configuration des jobs
const JOB_CONFIG = {
  // Intervalle entre les vérifications (5 minutes)
  CHECK_INTERVAL_MS: 5 * 60 * 1000,
  
  // Nombre max d'items à rafraîchir par cycle
  MAX_REFRESH_PER_CYCLE: 10,
  
  // Délai entre chaque rafraîchissement (éviter surcharge API)
  REFRESH_DELAY_MS: 2000,
  
  // Items expirés depuis X heures à considérer pour refresh
  EXPIRED_THRESHOLD_HOURS: 24,
  
  // Items non accédés depuis X jours à purger (optionnel)
  PURGE_UNUSED_DAYS: 180
};

// État du job runner
let jobInterval = null;
let isRunning = false;
let lastRunTime = null;
let stats = {
  totalRuns: 0,
  itemsRefreshed: 0,
  itemsPurged: 0,
  errors: 0,
  lastError: null
};

/**
 * Récupère les items expirés qui méritent un rafraîchissement
 * Priorise les items les plus demandés (fetch_count élevé)
 */
async function getExpiredItems(limit = JOB_CONFIG.MAX_REFRESH_PER_CYCLE) {
  if (!isCacheEnabled()) return [];
  
  try {
    const thresholdHours = JOB_CONFIG.EXPIRED_THRESHOLD_HOURS;
    const result = await queryAll(`
      SELECT id, source, source_id, type, name, fetch_count, expires_at, updated_at
      FROM items
      WHERE expires_at < NOW()
        AND expires_at > NOW() - INTERVAL '1 hour' * $2
        AND fetch_count > 1
      ORDER BY fetch_count DESC, expires_at ASC
      LIMIT $1
    `, [limit, thresholdHours]);
    
    return result || [];
  } catch (err) {
    log.error('Erreur récupération items expirés:', err.message);
    return [];
  }
}

/**
 * Récupère les items non accédés depuis longtemps (candidats à la purge)
 */
async function getUnusedItems(days = JOB_CONFIG.PURGE_UNUSED_DAYS, limit = 100) {
  if (!isCacheEnabled()) return [];
  
  try {
    const result = await queryAll(`
      SELECT id, source, source_id, name, last_accessed, fetch_count
      FROM items
      WHERE last_accessed < NOW() - INTERVAL '1 day' * $2
        AND fetch_count <= 1
      ORDER BY last_accessed ASC
      LIMIT $1
    `, [limit, days]);
    
    return result || [];
  } catch (err) {
    log.error('Erreur récupération items inutilisés:', err.message);
    return [];
  }
}

/**
 * Marque un item comme "en cours de rafraîchissement"
 * Pour éviter les rafraîchissements concurrents
 */
async function markItemRefreshing(id) {
  try {
    await query(`
      UPDATE items 
      SET expires_at = NOW() + INTERVAL '10 minutes'
      WHERE id = $1
    `, [id]);
    return true;
  } catch (err) {
    log.error(`Erreur marquage item ${id}:`, err.message);
    return false;
  }
}

/**
 * Exécute un cycle de maintenance
 */
async function runMaintenanceCycle() {
  if (!isCacheEnabled() || isRunning) {
    return { skipped: true, reason: isRunning ? 'already_running' : 'cache_disabled' };
  }
  
  isRunning = true;
  lastRunTime = new Date();
  stats.totalRuns++;
  
  const cycleStats = {
    startTime: Date.now(),
    expiredChecked: 0,
    refreshQueued: 0,
    errors: 0
  };
  
  try {
    // 1. Récupérer les items expirés
    const expiredItems = await getExpiredItems();
    cycleStats.expiredChecked = expiredItems.length;
    
    if (expiredItems.length > 0) {
      log.info(`[BackgroundJob] ${expiredItems.length} items expirés trouvés`);
      
      // On ne fait que marquer les items pour éviter le blocage
      // Le vrai refresh se fera à la prochaine requête utilisateur
      for (const item of expiredItems) {
        // Loguer les items populaires expirés pour monitoring
        if (item.fetch_count > 10) {
          log.debug(`[BackgroundJob] Item populaire expiré: ${item.id} (${item.fetch_count} accès)`);
        }
        cycleStats.refreshQueued++;
      }
    }
    
    // 2. Statistiques de santé rapides
    const healthStats = await getHealthStats();
    if (healthStats) {
      log.debug(`[BackgroundJob] Santé DB: ${healthStats.total_items} items, ${healthStats.expired_items} expirés`);
    }
    
  } catch (err) {
    log.error('[BackgroundJob] Erreur cycle maintenance:', err.message);
    stats.errors++;
    stats.lastError = err.message;
    cycleStats.errors++;
  } finally {
    isRunning = false;
  }
  
  cycleStats.duration = Date.now() - cycleStats.startTime;
  return cycleStats;
}

/**
 * Statistiques de santé de la base
 */
async function getHealthStats() {
  if (!isCacheEnabled()) return null;
  
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_items,
        COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_items,
        COUNT(*) FILTER (WHERE last_accessed > NOW() - INTERVAL '24 hours') as accessed_today,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as created_today,
        AVG(fetch_count)::int as avg_fetch_count,
        MAX(fetch_count) as max_fetch_count
      FROM items
    `);
    return result;
  } catch (err) {
    log.error('Erreur stats santé:', err.message);
    return null;
  }
}

/**
 * Démarre le job runner
 */
export function startBackgroundJobs() {
  if (jobInterval) {
    log.warn('[BackgroundJobs] Déjà démarré');
    return false;
  }
  
  if (!isCacheEnabled()) {
    log.info('[BackgroundJobs] Cache désactivé, jobs non démarrés');
    return false;
  }
  
  log.info(`[BackgroundJobs] Démarrage (intervalle: ${JOB_CONFIG.CHECK_INTERVAL_MS / 1000}s)`);
  
  // Premier run après 30 secondes (laisser l'app démarrer)
  setTimeout(() => {
    runMaintenanceCycle().then(result => {
      log.debug('[BackgroundJobs] Premier cycle:', result);
    });
  }, 30000);
  
  // Puis toutes les X minutes
  jobInterval = setInterval(() => {
    runMaintenanceCycle().then(result => {
      if (!result.skipped) {
        log.debug('[BackgroundJobs] Cycle terminé:', result);
      }
    });
  }, JOB_CONFIG.CHECK_INTERVAL_MS);
  
  return true;
}

/**
 * Arrête le job runner
 */
export function stopBackgroundJobs() {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    log.info('[BackgroundJobs] Arrêté');
    return true;
  }
  return false;
}

/**
 * Retourne les statistiques du job runner
 */
export function getJobStats() {
  return {
    isRunning,
    lastRunTime,
    config: JOB_CONFIG,
    stats: { ...stats }
  };
}

/**
 * Force un cycle de maintenance immédiat
 */
export async function runNow() {
  return await runMaintenanceCycle();
}

/**
 * Exporte les fonctions de santé pour /local/status
 */
export { getHealthStats, getExpiredItems, getUnusedItems };
