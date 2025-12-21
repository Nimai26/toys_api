/**
 * lib/monitoring/healthcheck.js - Système de monitoring des providers
 * 
 * Teste automatiquement tous les providers à intervalles réguliers
 * et envoie des alertes en cas de problème.
 * 
 * @module monitoring/healthcheck
 */

import { createLogger } from '../utils/logger.js';
import { sendMonitoringAlert, isMailerConfigured } from '../utils/mailer.js';
import { decryptApiKey } from '../utils/helpers.js';

const log = createLogger('HealthCheck');

// Intervalle de vérification (défaut: 10 heures)
const CHECK_INTERVAL_MS = parseInt(process.env.HEALTHCHECK_INTERVAL_HOURS || '10', 10) * 60 * 60 * 1000;

// URL de base pour les tests (localhost car exécuté dans le même conteneur)
const API_BASE = `http://localhost:${process.env.PORT || 3000}`;

// Clés API pour les tests (chiffrées puis déchiffrées au runtime)
const API_KEYS = {
  rebrickable: process.env.TEST_REBRICKABLE_KEY || '',
  tmdb: process.env.TEST_TMDB_KEY || '',
  rawg: process.env.TEST_RAWG_KEY || '',
  tvdb: process.env.TEST_TVDB_KEY || '',
  igdb_id: process.env.TEST_IGDB_CLIENT_ID || '',
  igdb_secret: process.env.TEST_IGDB_CLIENT_SECRET || '',
  googlebooks: process.env.TEST_GOOGLEBOOKS_KEY || '',
  comicvine: process.env.TEST_COMICVINE_KEY || '',
  discogs: process.env.TEST_DISCOGS_KEY || ''
};

/**
 * Configuration des tests pour chaque provider
 * Chaque test utilise une requête qui DOIT retourner des résultats
 */
const PROVIDER_TESTS = [
  // ==================== SANS CLÉ API ====================
  
  // LEGO - Recherche de sets populaires
  {
    provider: 'LEGO',
    route: '/lego/search',
    params: { q: 'star wars' },
    minResults: 1,
    requiresKey: false
  },
  {
    provider: 'LEGO',
    route: '/lego/product/75192',
    params: {},
    checkField: 'name',
    requiresKey: false
  },
  
  // Playmobil
  {
    provider: 'Playmobil',
    route: '/playmobil/search',
    params: { q: 'police' },
    minResults: 1,
    requiresKey: false
  },
  
  // IMDB - Films populaires
  {
    provider: 'IMDB',
    route: '/imdb/search',
    params: { q: 'matrix' },
    minResults: 1,
    requiresKey: false
  },
  
  // Jikan (MyAnimeList) - Route unifiée legacy
  {
    provider: 'Jikan',
    route: '/jikan/anime',
    params: { q: 'one piece' },
    minResults: 1,
    requiresKey: false
  },
  
  // Jikan Anime - Route normalisée
  {
    provider: 'Jikan Anime',
    route: '/jikan_anime/search',
    params: { q: 'naruto' },
    minResults: 1,
    requiresKey: false
  },
  
  // Jikan Manga - Route normalisée
  {
    provider: 'Jikan Manga',
    route: '/jikan_manga/search',
    params: { q: 'one piece' },
    minResults: 1,
    requiresKey: false
  },
  
  // MangaDex
  {
    provider: 'MangaDex',
    route: '/mangadex/search',
    params: { q: 'one piece' },
    minResults: 1,
    requiresKey: false
  },
  
  // Bedetheque
  {
    provider: 'Bedetheque',
    route: '/bedetheque/search',
    params: { q: 'asterix' },
    minResults: 1,
    requiresKey: false
  },
  
  // JeuxVideo.com
  {
    provider: 'JVC',
    route: '/jeuxvideo/search',
    params: { q: 'zelda' },
    minResults: 1,
    requiresKey: false,
    timeout: 60000 // Scraping peut être lent
  },
  
  // OpenLibrary
  {
    provider: 'OpenLibrary',
    route: '/openlibrary/search',
    params: { q: 'harry potter' },
    minResults: 1,
    requiresKey: false
  },
  
  // Barcode
  {
    provider: 'Barcode',
    route: '/barcode/9780747532743', // Harry Potter ISBN
    params: {},
    checkField: 'book', // Vérifie que le livre est trouvé
    requiresKey: false
  },
  
  // ==================== COLLECTIBLES (via FlareSolverr) ====================
  
  // Coleka
  {
    provider: 'Coleka',
    route: '/coleka/search',
    params: { q: 'funko' },
    minResults: 1,
    requiresKey: false,
    timeout: 120000 // 2 min pour FSR
  },
  
  // LuluBerlu
  {
    provider: 'LuluBerlu',
    route: '/luluberlu/search',
    params: { q: 'goldorak' },
    minResults: 1,
    requiresKey: false,
    timeout: 60000
  },
  
  // Transformerland
  {
    provider: 'Transformerland',
    route: '/transformerland/search',
    params: { q: 'optimus' },
    minResults: 1,
    requiresKey: false,
    timeout: 60000
  },
  
  // Paninimania
  {
    provider: 'Paninimania',
    route: '/paninimania/search',
    params: { q: 'football' },
    minResults: 1,
    requiresKey: false,
    timeout: 60000
  },
  
  // ConsoleVariations
  {
    provider: 'ConsoleVariations',
    route: '/consolevariations/search',
    params: { q: 'nintendo' },
    minResults: 1,
    requiresKey: false,
    timeout: 60000
  },
  
  // ==================== AVEC CLÉ API ====================
  
  // Rebrickable
  {
    provider: 'Rebrickable',
    route: '/rebrickable/search',
    params: { q: '75192' }, // Millennium Falcon
    minResults: 1,
    requiresKey: true,
    keyName: 'rebrickable'
  },
  
  // TMDB
  {
    provider: 'TMDB',
    route: '/tmdb/search',
    params: { q: 'inception' },
    minResults: 1,
    requiresKey: true,
    keyName: 'tmdb'
  },
  
  // RAWG
  {
    provider: 'RAWG',
    route: '/rawg/search',
    params: { q: 'zelda' },
    minResults: 1,
    requiresKey: true,
    keyName: 'rawg'
  },
  
  // Google Books
  {
    provider: 'GoogleBooks',
    route: '/googlebooks/search',
    params: { q: 'dune' },
    minResults: 1,
    requiresKey: true,
    keyName: 'googlebooks'
  },
  
  // ComicVine
  {
    provider: 'ComicVine',
    route: '/comicvine/search',
    params: { q: 'batman' },
    minResults: 1,
    requiresKey: true,
    keyName: 'comicvine'
  },
  
  // TVDB
  {
    provider: 'TVDB',
    route: '/tvdb/search',
    params: { q: 'breaking bad' },
    minResults: 1,
    requiresKey: true,
    keyName: 'tvdb'
  },
  
  // IGDB (nécessite client_id + client_secret combinés)
  {
    provider: 'IGDB',
    route: '/igdb/search',
    params: { q: 'zelda' },
    minResults: 1,
    requiresKey: true,
    keyName: 'igdb',
    multiKey: true // Indique que c'est une clé composite
  },
  
  // ==================== AMAZON (CRITIQUE - Puppeteer) ====================
  
  // Amazon Generic - Test scraping Puppeteer via VPN
  {
    provider: 'Amazon',
    route: '/amazon_generic/search',
    params: { q: 'lego star wars', lang: 'fr' },
    minResults: 1,
    requiresKey: false,
    timeout: 120000, // 2 min - Puppeteer peut être lent
    critical: true // Marqué comme critique pour alertes prioritaires
  },
  
  // ==================== MUSIC PROVIDERS ====================
  
  // Deezer - API gratuite
  {
    provider: 'Deezer',
    route: '/music/search',
    params: { q: 'daft punk', source: 'deezer' },
    minResults: 1,
    requiresKey: false
  },
  
  // iTunes - API gratuite
  {
    provider: 'iTunes',
    route: '/music/search',
    params: { q: 'beatles', source: 'itunes' },
    minResults: 1,
    requiresKey: false
  },
  
  // MusicBrainz - API gratuite
  {
    provider: 'MusicBrainz',
    route: '/music/search',
    params: { q: 'pink floyd', source: 'musicbrainz' },
    minResults: 1,
    requiresKey: false
  },
  
  // Discogs - Nécessite token pour éviter rate limit
  {
    provider: 'Discogs',
    route: '/music/search',
    params: { q: 'queen', source: 'discogs' },
    minResults: 1,
    requiresKey: true,
    keyName: 'discogs',
    keyAsParam: 'discogsToken', // Passer le token en query param
    timeout: 30000
  },
  
  // ==================== AUTRES PROVIDERS ====================
  
  // Klickypedia - Encyclopédie Playmobil
  {
    provider: 'Klickypedia',
    route: '/klickypedia/search',
    params: { q: 'police' },
    minResults: 1,
    requiresKey: false,
    timeout: 60000
  }
];

/**
 * Chiffre une clé API pour les tests
 * @param {string} keyName - Nom de la clé
 * @param {boolean} isIgdb - Si true, combine client_id:client_secret
 */
async function getEncryptedKey(keyName, isIgdb = false) {
  let key;
  
  if (isIgdb) {
    // IGDB nécessite clientId:clientSecret
    const clientId = API_KEYS.igdb_id;
    const clientSecret = API_KEYS.igdb_secret;
    if (!clientId || !clientSecret) return null;
    key = `${clientId}:${clientSecret}`;
  } else {
    key = API_KEYS[keyName];
    if (!key) return null;
  }
  
  try {
    // Appeler l'endpoint de chiffrement
    const response = await fetch(`${API_BASE}/crypto/encrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.encrypted;
  } catch (err) {
    log.error(`Erreur chiffrement clé ${keyName}: ${err.message}`);
    return null;
  }
}

/**
 * Exécute un test de provider
 * @param {object} test - Configuration du test
 * @returns {Promise<object>} - Résultat du test
 */
async function runTest(test) {
  const startTime = Date.now();
  const result = {
    provider: test.provider,
    route: test.route,
    success: false,
    count: 0,
    error: null,
    duration: 0,
    critical: test.critical || false // Transmettre le flag critique
  };
  
  try {
    // Construire l'URL
    const url = new URL(test.route, API_BASE);
    Object.entries(test.params || {}).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });
    
    // Préparer les headers
    const headers = {};
    
    // Ajouter la clé API si nécessaire
    if (test.requiresKey && test.keyName) {
      // Cas spécial: clé passée en query param (ex: Discogs)
      if (test.keyAsParam) {
        const key = API_KEYS[test.keyName];
        if (!key) {
          result.error = `Clé API ${test.keyName} non configurée`;
          result.duration = Date.now() - startTime;
          return result;
        }
        url.searchParams.set(test.keyAsParam, key);
      } else {
        // Clé chiffrée en header (cas standard)
        const isIgdb = test.keyName === 'igdb';
        const encryptedKey = await getEncryptedKey(test.keyName, isIgdb);
        if (!encryptedKey) {
          result.error = `Clé API ${test.keyName} non configurée`;
          result.duration = Date.now() - startTime;
          return result;
        }
        headers['X-Encrypted-Key'] = encryptedKey;
      }
    }
    
    // Exécuter la requête
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), test.timeout || 30000);
    
    const response = await fetch(url.toString(), {
      headers,
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      result.error = `HTTP ${response.status}`;
      result.duration = Date.now() - startTime;
      return result;
    }
    
    const data = await response.json();
    
    // Vérifier le résultat
    if (test.checkField) {
      // Vérification d'un champ spécifique
      const value = data[test.checkField];
      if (test.expectedValue !== undefined) {
        result.success = value === test.expectedValue;
        result.count = value ? 1 : 0;
      } else {
        result.success = value !== null && value !== undefined;
        result.count = value ? 1 : 0;
      }
      if (!result.success) {
        result.error = `Champ ${test.checkField} invalide: ${value}`;
      }
    } else {
      // Vérification du nombre de résultats (supporte plusieurs formats)
      result.count = data.count || data.resultsCount || data.items?.length || data.results?.length || 0;
      result.success = result.count >= (test.minResults || 1);
      if (!result.success) {
        result.error = `Résultats insuffisants: ${result.count} < ${test.minResults || 1}`;
      }
    }
    
  } catch (err) {
    if (err.name === 'AbortError') {
      result.error = `Timeout (${test.timeout || 30000}ms)`;
    } else {
      result.error = err.message;
    }
  }
  
  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Exécute tous les tests de monitoring
 * @returns {Promise<object>} - Rapport complet
 */
export async function runAllTests() {
  log.info('🔍 Démarrage des tests de monitoring...');
  
  const results = [];
  const failures = [];
  
  for (const test of PROVIDER_TESTS) {
    log.debug(`Testing ${test.provider} (${test.route})...`);
    
    const result = await runTest(test);
    results.push(result);
    
    if (result.success) {
      log.debug(`✅ ${test.provider}: OK (${result.count} résultats, ${result.duration}ms)`);
    } else {
      log.warn(`❌ ${test.provider}: ÉCHEC - ${result.error}`);
      failures.push(result);
    }
    
    // Petit délai entre les tests pour ne pas surcharger
    await new Promise(r => setTimeout(r, 500));
  }
  
  const report = {
    timestamp: new Date(),
    total: results.length,
    passed: results.filter(r => r.success).length,
    failed: failures.length,
    failures,
    results
  };
  
  log.info(`📊 Tests terminés: ${report.passed}/${report.total} réussis`);
  
  // Envoyer une alerte si des échecs
  if (failures.length > 0) {
    log.warn(`⚠️ ${failures.length} échec(s) détecté(s)`);
    
    if (isMailerConfigured()) {
      const sent = await sendMonitoringAlert(report);
      if (sent) {
        log.info('📧 Alerte email envoyée');
      } else {
        log.error('❌ Échec envoi alerte email');
      }
    } else {
      log.warn('📧 Mailer non configuré - pas d\'alerte email');
    }
  }
  
  return report;
}

/**
 * Démarre le cron de monitoring
 */
export function startMonitoringCron() {
  if (!process.env.ENABLE_MONITORING || process.env.ENABLE_MONITORING === 'false') {
    log.info('Monitoring désactivé (ENABLE_MONITORING != true)');
    return;
  }
  
  const intervalHours = parseInt(process.env.HEALTHCHECK_INTERVAL_HOURS || '10', 10);
  log.info(`🕐 Monitoring activé - Tests toutes les ${intervalHours}h`);
  
  if (isMailerConfigured()) {
    log.info(`📧 Alertes email activées → ${process.env.EMAIL_DEST}`);
  } else {
    log.warn('📧 Alertes email désactivées (config SMTP incomplète)');
  }
  
  // Premier test après 1 minute (laisser l'API démarrer)
  setTimeout(async () => {
    log.info('🚀 Premier test de monitoring...');
    await runAllTests();
  }, 60000);
  
  // Tests réguliers
  setInterval(async () => {
    await runAllTests();
  }, CHECK_INTERVAL_MS);
}

/**
 * Exécute un test manuel (pour l'endpoint /monitoring/test)
 */
export async function runManualTest() {
  return runAllTests();
}

// Export de runTest pour les tests individuels
export { runTest, PROVIDER_TESTS };

export default {
  runAllTests,
  startMonitoringCron,
  runManualTest,
  runTest,
  PROVIDER_TESTS
};
