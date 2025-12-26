/**
 * lib/database/cache-wrapper.js - Wrapper de cache pour les providers
 * 
 * Encapsule les appels aux APIs externes avec cache automatique PostgreSQL
 * toys_api v4.0.0
 */

import { createLogger } from '../utils/logger.js';
import { 
  DB_ENABLED, 
  CACHE_MODE, 
  isCacheEnabled,
  isDatabaseConnected 
} from './connection.js';
import { 
  getItem, 
  saveItem, 
  searchLocal,
  saveSearchResults,
  getCachedSearch,
  CACHE_TTL 
} from './repository.js';

const log = createLogger('CacheWrapper');

// Stockage temporaire pour l'info de cache (accessible via getCacheInfo)
let lastCacheInfo = { hit: false, source: null, duration: 0 };

/**
 * Récupère les informations du dernier appel cache
 * @returns {{hit: boolean, source: string|null, duration: number}}
 */
export function getCacheInfo() {
  return { ...lastCacheInfo };
}

/**
 * Réinitialise les infos de cache
 */
export function resetCacheInfo() {
  lastCacheInfo = { hit: false, source: null, duration: 0 };
}

/**
 * Wrapper générique pour les appels de détail (par ID)
 * 
 * @param {Object} options - Options du wrapper
 * @param {string} options.source - Nom du provider (ex: 'bedetheque', 'googlebooks')
 * @param {string} options.type - Type de données (ex: 'book', 'movie', 'videogame')
 * @param {string} options.externalId - ID externe (ex: ISBN, TMDB ID, etc.)
 * @param {Function} options.fetchFn - Fonction async qui appelle l'API externe
 * @param {Function} [options.normalizeFn] - Fonction de normalisation (optionnelle)
 * @param {boolean} [options.forceRefresh=false] - Forcer le refresh depuis l'API
 * @returns {Promise<Object>} Données (depuis cache ou API)
 */
export async function withCache({ 
  source, 
  type, 
  externalId, 
  fetchFn, 
  normalizeFn = null,
  forceRefresh = false 
}) {
  const startTime = Date.now();
  resetCacheInfo();
  
  // Mode API-only ou DB désactivée : appel direct
  if (!isCacheEnabled() || CACHE_MODE === 'api_only') {
    log.debug(`[${source}] Cache désactivé, appel API direct`, { externalId });
    const data = await fetchFn();
    const result = normalizeFn ? normalizeFn(data) : data;
    lastCacheInfo = { hit: false, source: 'api_only', duration: Date.now() - startTime };
    return result;
  }
  
  // Mode DB-only : chercher uniquement en base
  if (CACHE_MODE === 'db_only') {
    const cached = await getItem(source, externalId);
    if (cached) {
      log.debug(`[${source}] DB-only hit`, { externalId, age: `${Math.round((Date.now() - new Date(cached.updated_at).getTime()) / 1000 / 60)}min` });
      lastCacheInfo = { hit: true, source: 'db_only', duration: Date.now() - startTime };
      return cached.data;
    }
    log.warn(`[${source}] DB-only miss, pas de données`, { externalId });
    lastCacheInfo = { hit: false, source: 'db_only', duration: Date.now() - startTime };
    return null;
  }
  
  // Mode hybrid (défaut) : cache-through
  if (!forceRefresh) {
    try {
      // Utiliser getItem directement pour vérifier le cache
      const cached = await getItem(source, externalId);
      if (cached) {
        log.debug(`[${source}] Cache HIT`, { externalId });
        lastCacheInfo = { hit: true, source: 'cache', duration: Date.now() - startTime };
        return cached;
      }
    } catch (err) {
      log.warn(`[${source}] Erreur lecture cache, fallback API`, { error: err.message });
    }
  }
  
  // Appel API
  log.debug(`[${source}] Cache MISS, appel API`, { externalId, forceRefresh });
  lastCacheInfo = { hit: false, source: 'api', duration: 0 }; // Sera mis à jour après
  let data;
  try {
    data = await fetchFn();
  } catch (err) {
    log.error(`[${source}] Erreur API`, { externalId, error: err.message });
    throw err;
  }
  
  if (!data) {
    return null;
  }
  
  // Normaliser si fonction fournie
  const normalizedData = normalizeFn ? normalizeFn(data) : data;
  
  // Extraire le nom pour la sauvegarde
  const itemName = normalizedData?.name || normalizedData?.title || 'Unknown';
  
  // Debug: vérifier les données
  log.debug(`[${source}] Données à sauvegarder`, { 
    externalId, 
    hasData: !!normalizedData, 
    type: typeof normalizedData,
    name: itemName,
    keys: normalizedData ? Object.keys(normalizedData).slice(0, 5) : []
  });
  
  // Sauvegarder en base (async, non-bloquant)
  if (isDatabaseConnected() && normalizedData && typeof normalizedData === 'object') {
    saveItem(source, externalId, type, itemName, normalizedData)
      .then(success => {
        const duration = Date.now() - startTime;
        if (success) {
          log.debug(`[${source}] Sauvegardé en cache PostgreSQL`, { externalId, duration: `${duration}ms` });
        } else {
          log.warn(`[${source}] Échec sauvegarde cache PostgreSQL`, { externalId });
        }
      })
      .catch(err => {
        log.error(`[${source}] Erreur sauvegarde cache`, { externalId, error: err.message });
      });
  }
  
  // Mettre à jour la durée finale
  lastCacheInfo.duration = Date.now() - startTime;
  
  return normalizedData;
}

/**
 * Wrapper pour les recherches
 * 
 * @param {Object} options - Options du wrapper
 * @param {string} options.source - Nom du provider
 * @param {string} options.type - Type de données recherché
 * @param {string} options.query - Requête de recherche
 * @param {Object} [options.params={}] - Paramètres additionnels (page, limit, etc.)
 * @param {Function} options.fetchFn - Fonction async qui appelle l'API externe
 * @param {Function} [options.normalizeResultsFn] - Fonction pour normaliser les résultats
 * @param {boolean} [options.cacheResults=true] - Sauvegarder les résultats individuels
 * @returns {Promise<Object>} Résultats de recherche
 */
export async function withSearchCache({
  source,
  type,
  query,
  params = {},
  fetchFn,
  normalizeResultsFn = null,
  cacheResults = true
}) {
  const startTime = Date.now();
  resetCacheInfo();
  
  // Si cache désactivé, appel direct
  if (!isCacheEnabled() || CACHE_MODE === 'api_only') {
    const results = await fetchFn();
    const normalized = normalizeResultsFn ? normalizeResultsFn(results) : results;
    lastCacheInfo = { hit: false, source: 'api_only', duration: Date.now() - startTime };
    return normalized;
  }
  
  // Vérifier le cache de recherche
  if (CACHE_MODE !== 'db_only') {
    try {
      const cached = await getCachedSearch(source, type, query, params);
      if (cached) {
        log.debug(`[${source}] Search cache HIT`, { query, resultsCount: cached.results?.length });
        lastCacheInfo = { hit: true, source: 'search_cache', duration: Date.now() - startTime };
        return cached;
      }
    } catch (err) {
      log.warn(`[${source}] Erreur lecture cache recherche`, { error: err.message });
    }
  }
  
  // Mode db_only : recherche locale
  if (CACHE_MODE === 'db_only') {
    try {
      const localResults = await searchLocal(query, { source, type, limit: params.limit || 20 });
      if (localResults && localResults.length > 0) {
        const result = { results: localResults, total: localResults.length, source: 'local' };
        lastCacheInfo = { hit: true, source: 'db_only', duration: Date.now() - startTime };
        return result;
      }
    } catch (err) {
      log.warn(`[${source}] Erreur recherche locale`, { error: err.message });
    }
    lastCacheInfo = { hit: false, source: 'db_only', duration: Date.now() - startTime };
    return { results: [], total: 0, source: 'local', error: 'No results in db_only mode' };
  }
  
  // Appel API
  log.debug(`[${source}] Search cache MISS, appel API`, { query });
  lastCacheInfo = { hit: false, source: 'api', duration: 0 };
  
  let results;
  try {
    results = await fetchFn();
  } catch (err) {
    log.error(`[${source}] Erreur recherche API`, { query, error: err.message });
    throw err;
  }
  
  if (!results) {
    lastCacheInfo.duration = Date.now() - startTime;
    return null;
  }
  
  // Normaliser si fonction fournie
  const normalizedResults = normalizeResultsFn ? normalizeResultsFn(results) : results;
  
  // Sauvegarder la recherche (async)
  if (isDatabaseConnected()) {
    saveSearchResults(source, type, query, params, normalizedResults)
      .catch(err => {
        log.warn(`[${source}] Erreur sauvegarde recherche`, { error: err.message });
      });
    
    // Optionnel : sauvegarder les items individuels pour enrichir la base
    if (cacheResults && normalizedResults.results && Array.isArray(normalizedResults.results)) {
      for (const item of normalizedResults.results) {
        if (item.id || item.external_id || item.sourceId) {
          const itemId = item.external_id || item.sourceId || item.id;
          const itemName = item.name || item.title || 'Unknown';
          saveItem(source, String(itemId), type, itemName, item)
            .catch(() => {}); // Ignorer les erreurs silencieusement
        }
      }
    }
  }
  
  lastCacheInfo.duration = Date.now() - startTime;
  log.debug(`[${source}] Recherche terminée`, { query, duration: `${lastCacheInfo.duration}ms`, resultsCount: normalizedResults.results?.length });
  
  return normalizedResults;
}

/**
 * Recherche locale uniquement (sans appel API)
 * Utile pour les endpoints /local/*
 * 
 * @param {Object} options - Options de recherche
 * @param {string} [options.source] - Filtrer par source
 * @param {string} [options.type] - Filtrer par type
 * @param {string} [options.query] - Recherche full-text
 * @param {number} [options.limit=20] - Nombre max de résultats
 * @param {number} [options.offset=0] - Offset pour pagination
 * @returns {Promise<Object>} Résultats de recherche locale
 */
export async function localSearch({ source, type, query, limit = 20, offset = 0 }) {
  if (!isDatabaseConnected()) {
    return { results: [], total: 0, source: 'local', error: 'Database not connected' };
  }
  
  try {
    const results = await searchLocal({ source, type, query, limit, offset });
    return {
      results,
      total: results.length,
      source: 'local',
      query,
      filters: { source, type }
    };
  } catch (err) {
    log.error('Erreur recherche locale', { error: err.message });
    return { results: [], total: 0, source: 'local', error: err.message };
  }
}

/**
 * Helper pour créer un wrapper spécifique à un provider
 * 
 * @param {string} source - Nom du provider
 * @param {string} defaultType - Type par défaut
 * @returns {Object} Fonctions wrapper pré-configurées
 */
export function createProviderCache(source, defaultType) {
  return {
    /**
     * Récupère un item avec cache
     */
    getWithCache: async (externalId, fetchFn, options = {}) => {
      return withCache({
        source,
        type: options.type || defaultType,
        externalId: String(externalId),
        fetchFn,
        normalizeFn: options.normalizeFn,
        forceRefresh: options.forceRefresh || false
      });
    },
    
    /**
     * Recherche avec cache
     */
    searchWithCache: async (query, fetchFn, options = {}) => {
      return withSearchCache({
        source,
        type: options.type || defaultType,
        query,
        params: options.params || {},
        fetchFn,
        normalizeResultsFn: options.normalizeResultsFn,
        cacheResults: options.cacheResults !== false
      });
    },
    
    /**
     * Recherche locale uniquement
     */
    searchLocal: async (query, options = {}) => {
      return localSearch({
        source,
        type: options.type || defaultType,
        query,
        limit: options.limit,
        offset: options.offset
      });
    }
  };
}

// Export des fonctions
export default {
  withCache,
  withSearchCache,
  localSearch,
  createProviderCache
};
