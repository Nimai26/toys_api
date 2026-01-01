/**
 * lib/utils/state.js - État global partagé entre tous les modules
 * toys_api v1.26.0
 * 
 * Ce module centralise :
 * - Les sessions FlareSolverr
 * - Le cache LRU partagé
 * - Les métriques globales
 * 
 * Tous les modules doivent importer depuis ce fichier pour éviter
 * les duplications d'état.
 */

import { createLogger } from './logger.js';

const log = createLogger('Cache');

// ========================================
// Configuration
// ========================================
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 300000; // 5 minutes par défaut
const CACHE_MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE) || 100;
const LEGO_SESSION_TTL = 10 * 60 * 1000; // 10 minutes

// ========================================
// Métriques globales (déclaré en premier pour être accessible partout)
// ========================================
export const metrics = {
  startTime: Date.now(),
  requests: { total: 0, cached: 0, errors: 0 },
  responseTimeSum: 0,
  responseTimeCount: 0,
  sources: {
    lego: { requests: 0, errors: 0 },
    coleka: { requests: 0, errors: 0 },
    luluberlu: { requests: 0, errors: 0 },
    transformerland: { requests: 0, errors: 0 },
    paninimania: { requests: 0, errors: 0 },
    rebrickable: { requests: 0, errors: 0 },
    googlebooks: { requests: 0, errors: 0 },
    openlibrary: { requests: 0, errors: 0 },
    rawg: { requests: 0, errors: 0 },
    igdb: { requests: 0, errors: 0 },
    tvdb: { requests: 0, errors: 0 },
    tmdb: { requests: 0, errors: 0 },
    imdb: { requests: 0, errors: 0 },
    jikan: { requests: 0, errors: 0 },
    comicvine: { requests: 0, errors: 0 },
    mangadex: { requests: 0, errors: 0 },
    bedetheque: { requests: 0, errors: 0 },
    jvc: { requests: 0, errors: 0 },
    mega: { requests: 0, errors: 0 },
    playmobil: { requests: 0, errors: 0 },
    klickypedia: { requests: 0, errors: 0 },
    consolevariations: { requests: 0, errors: 0 },
    amazon: { requests: 0, errors: 0 },
    barcode: { requests: 0, errors: 0 },
    musicbrainz: { requests: 0, errors: 0 },
    discogs: { requests: 0, errors: 0 },
    deezer: { requests: 0, errors: 0 },
    // TCG
    pokemon_tcg: { requests: 0, errors: 0 },
    mtg: { requests: 0, errors: 0 },
    yugioh: { requests: 0, errors: 0 },
    lorcana: { requests: 0, errors: 0 },
    digimon: { requests: 0, errors: 0 },
    onepiece: { requests: 0, errors: 0, latency: 0 },
    carddass: { requests: 0, errors: 0, latency: 0 }
  }
};

// ========================================
// État FlareSolverr
// ========================================
let _fsrSessionId = null;
let _lastLegoHomeVisit = 0;

// Getters
export function getFsrSessionId() {
  return _fsrSessionId;
}

export function getLastLegoHomeVisit() {
  return _lastLegoHomeVisit;
}

// Setters
export function setFsrSessionId(id) {
  _fsrSessionId = id;
}

export function setLastLegoHomeVisit(timestamp) {
  _lastLegoHomeVisit = timestamp;
}

// Vérification validité cookies LEGO
export function areLegoSessionCookiesValid() {
  return _fsrSessionId && (Date.now() - _lastLegoHomeVisit < LEGO_SESSION_TTL);
}

// Reset session
export function resetFsrSession() {
  _fsrSessionId = null;
  _lastLegoHomeVisit = 0;
}

// ========================================
// Cache LRU partagé
// ========================================
const cache = new Map();

// Flag global pour ignorer le cache (défini par middleware)
let _skipCache = false;

/**
 * Active/désactive le bypass du cache pour la requête courante
 * @param {boolean} skip
 */
export function setSkipCache(skip) {
  _skipCache = skip;
}

/**
 * Vérifie si le cache doit être ignoré
 * @returns {boolean}
 */
export function shouldSkipCache() {
  return _skipCache;
}

/**
 * Récupère une valeur du cache
 * @param {string} key - Clé du cache
 * @returns {any|null} - Valeur ou null si absente/expirée/bypassée
 */
export function getCached(key) {
  // Bypass cache si demandé
  if (_skipCache) {
    log.debug(`SKIP (noCache): ${key.substring(0, 50)}...`);
    return null;
  }
  
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  // Mise à jour du lastAccess pour LRU
  entry.lastAccess = Date.now();
  log.debug(`HIT: ${key.substring(0, 50)}...`);
  metrics.requests.cached++;
  return entry.data;
}

/**
 * Stocke une valeur dans le cache
 * @param {string} key - Clé du cache
 * @param {any} data - Données à stocker
 * @param {number} customTtl - TTL personnalisé (optionnel)
 */
export function setCache(key, data, customTtl = null) {
  // Nettoyer le cache si trop grand (LRU: supprimer le moins récemment utilisé)
  if (cache.size >= CACHE_MAX_SIZE) {
    let oldestKey = null;
    let oldestAccess = Infinity;
    for (const [k, v] of cache) {
      if (v.lastAccess < oldestAccess) {
        oldestAccess = v.lastAccess;
        oldestKey = k;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }
  const ttl = customTtl || CACHE_TTL;
  const now = Date.now();
  cache.set(key, { data, expiry: now + ttl, lastAccess: now });
  log.debug(`SET: ${key.substring(0, 50)}...`, { ttl: `${ttl/1000}s` });
}

/**
 * Supprime une entrée du cache
 * @param {string} key - Clé à supprimer
 */
export function clearCacheKey(key) {
  cache.delete(key);
}

/**
 * Vide tout le cache
 */
export function clearCache() {
  cache.clear();
  log.info('Cleared all entries');
}

/**
 * Retourne les statistiques du cache
 */
export function getCacheStats() {
  let validEntries = 0;
  let expiredEntries = 0;
  const now = Date.now();
  
  for (const [, entry] of cache) {
    if (now > entry.expiry) {
      expiredEntries++;
    } else {
      validEntries++;
    }
  }
  
  return {
    size: cache.size,
    validEntries,
    expiredEntries,
    maxSize: CACHE_MAX_SIZE,
    ttl: CACHE_TTL
  };
}

/**
 * Middleware Express pour ajouter les headers Cache-Control et X-Cache
 * @param {Object} res - Réponse Express
 * @param {number} maxAge - TTL en secondes
 * @param {Object} [cacheInfo] - Info du cache {hit: boolean, source: string, duration: number}
 */
export function addCacheHeaders(res, maxAge = 300, cacheInfo = null) {
  res.set('Cache-Control', `public, max-age=${maxAge}`);
  res.set('X-Cache-TTL', `${maxAge}s`);
  
  // Ajouter X-Cache si info disponible
  if (cacheInfo) {
    res.set('X-Cache', cacheInfo.hit ? 'HIT' : 'MISS');
    res.set('X-Cache-Source', cacheInfo.source || 'unknown');
    if (cacheInfo.duration) {
      res.set('X-Response-Time', `${cacheInfo.duration}ms`);
    }
  }
}

// ========================================
// Exports de configuration
// ========================================
export {
  CACHE_TTL,
  CACHE_MAX_SIZE,
  LEGO_SESSION_TTL
};
