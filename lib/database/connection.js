/**
 * lib/database/connection.js - Connexion PostgreSQL
 * 
 * Pool de connexions avec reconnexion automatique
 * toys_api v4.0.0
 */

import pg from 'pg';
import { createLogger } from '../utils/logger.js';

const { Pool } = pg;
const log = createLogger('Database');

// Configuration depuis les variables d'environnement
const DB_CONFIG = {
  host: process.env.TOY_API_DB_HOST || 'localhost',
  port: parseInt(process.env.TOY_API_DB_PORT || '5432', 10),
  database: process.env.TOY_API_DB_NAME || 'toys_api_cache',
  user: process.env.TOY_API_DB_USER || 'toys_api',
  password: process.env.TOY_API_DB_PASSWORD,
  
  // Pool configuration
  min: parseInt(process.env.TOY_API_DB_POOL_MIN || '2', 10),
  max: parseInt(process.env.TOY_API_DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// Mode cache (hybrid, db_only, api_only)
export const CACHE_MODE = process.env.TOY_API_CACHE_MODE || 'hybrid';
export const DB_ENABLED = process.env.TOY_API_DB_ENABLED === 'true';

// Pool de connexions (singleton)
let pool = null;
let isConnected = false;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;

/**
 * Initialise le pool de connexions PostgreSQL
 */
export async function initDatabase() {
  if (!DB_ENABLED) {
    log.info('📦 Base de données désactivée (TOY_API_DB_ENABLED=false)');
    return false;
  }

  if (!DB_CONFIG.password) {
    log.warn('⚠️ TOY_API_DB_PASSWORD non défini - Base de données désactivée');
    return false;
  }

  try {
    pool = new Pool(DB_CONFIG);

    // Gestion des erreurs du pool
    pool.on('error', (err) => {
      log.error(`Erreur pool PostgreSQL: ${err.message}`);
      isConnected = false;
      attemptReconnect();
    });

    pool.on('connect', () => {
      log.debug('Nouvelle connexion au pool');
    });

    // Test de connexion
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now, version() as version');
    client.release();

    isConnected = true;
    connectionAttempts = 0;
    
    const pgVersion = result.rows[0].version.split(' ')[1];
    log.info(`✅ PostgreSQL connecté (v${pgVersion})`);
    log.info(`   Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    log.info(`   Database: ${DB_CONFIG.database}`);
    log.info(`   Pool: ${DB_CONFIG.min}-${DB_CONFIG.max} connexions`);
    log.info(`   Mode cache: ${CACHE_MODE}`);

    return true;
  } catch (err) {
    log.error(`❌ Connexion PostgreSQL échouée: ${err.message}`);
    isConnected = false;
    attemptReconnect();
    return false;
  }
}

/**
 * Tentative de reconnexion automatique
 */
async function attemptReconnect() {
  if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
    log.error(`❌ Abandon après ${MAX_RECONNECT_ATTEMPTS} tentatives de reconnexion`);
    return;
  }

  connectionAttempts++;
  log.info(`🔄 Tentative de reconnexion ${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS} dans ${RECONNECT_DELAY / 1000}s...`);

  setTimeout(async () => {
    try {
      if (pool) {
        await pool.end();
      }
      await initDatabase();
    } catch (err) {
      log.error(`Erreur reconnexion: ${err.message}`);
    }
  }, RECONNECT_DELAY);
}

/**
 * Exécute une requête SQL
 * @param {string} text - Requête SQL
 * @param {any[]} params - Paramètres
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params = []) {
  if (!isConnected || !pool) {
    throw new Error('Base de données non connectée');
  }

  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 100) {
      log.debug(`Requête lente (${duration}ms): ${text.substring(0, 100)}...`);
    }
    
    return result;
  } catch (err) {
    log.error(`Erreur SQL: ${err.message}`);
    log.debug(`Query: ${text}`);
    throw err;
  }
}

/**
 * Exécute une requête et retourne la première ligne
 * @param {string} text - Requête SQL
 * @param {any[]} params - Paramètres
 * @returns {Promise<any|null>}
 */
export async function queryOne(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

/**
 * Exécute une requête et retourne toutes les lignes
 * @param {string} text - Requête SQL
 * @param {any[]} params - Paramètres
 * @returns {Promise<any[]>}
 */
export async function queryAll(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

/**
 * Obtient un client pour une transaction
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  if (!isConnected || !pool) {
    throw new Error('Base de données non connectée');
  }
  return pool.connect();
}

/**
 * Vérifie si la base de données est connectée
 * @returns {boolean}
 */
export function isDatabaseConnected() {
  return isConnected && pool !== null;
}

/**
 * Vérifie si le cache DB est activé
 * @returns {boolean}
 */
export function isCacheEnabled() {
  return DB_ENABLED && isConnected && CACHE_MODE !== 'api_only';
}

/**
 * Ferme le pool de connexions
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    isConnected = false;
    log.info('🔌 Pool PostgreSQL fermé');
  }
}

/**
 * Statistiques du pool
 * @returns {object}
 */
export function getPoolStats() {
  if (!pool) {
    return { connected: false };
  }
  
  return {
    connected: isConnected,
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    config: {
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      database: DB_CONFIG.database,
      poolMin: DB_CONFIG.min,
      poolMax: DB_CONFIG.max
    },
    mode: CACHE_MODE
  };
}

export default {
  initDatabase,
  query,
  queryOne,
  queryAll,
  getClient,
  isDatabaseConnected,
  isCacheEnabled,
  closeDatabase,
  getPoolStats,
  CACHE_MODE,
  DB_ENABLED
};
