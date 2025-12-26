// routes/videogames.js - Endpoints RAWG, IGDB et JVC (toys_api v4.0.0)
import { Router } from 'express';
import {
  searchRawg,
  getRawgGameDetailsNormalized
} from '../lib/providers/rawg.js';
import {
  searchIgdb,
  getIgdbGameDetailsNormalized,
  parseIgdbCredentials,
  getIgdbToken
} from '../lib/providers/igdb.js';
import {
  searchJVC,
  getJvcGameByIdNormalized
} from '../lib/providers/jvc.js';
import { 
  addCacheHeaders, 
  asyncHandler, 
  requireParam, 
  requireApiKey, 
  isAutoTradEnabled,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams,
  generateDetailUrl,
  formatSearchResponse,
  formatDetailResponse
} from '../lib/utils/index.js';
import { translateText } from '../lib/utils/translator.js';
import {
  RAWG_DEFAULT_MAX,
  RAWG_MAX_LIMIT,
  IGDB_DEFAULT_MAX,
  IGDB_MAX_LIMIT,
  JVC_DEFAULT_MAX
} from '../lib/config.js';
import { createProviderCache, getCacheInfo } from '../lib/database/cache-wrapper.js';

// Caches PostgreSQL pour les jeux vidéo
const rawgCache = createProviderCache('rawg', 'videogame');
const igdbCache = createProviderCache('igdb', 'videogame');
const jvcCache = createProviderCache('jeuxvideo', 'videogame');

/**
 * Traduit les descriptions des résultats de recherche si autoTrad est activé
 * @param {Array} items - Les items à traduire
 * @param {boolean} autoTrad - Si la traduction automatique est activée
 * @param {string} lang - La langue cible
 * @returns {Promise<Array>} - Les items avec descriptions traduites
 */
async function translateSearchDescriptions(items, autoTrad, lang) {
  if (!autoTrad || !lang || lang === 'en') {
    return items;
  }
  
  // Traduire les descriptions en parallèle
  const translatedItems = await Promise.all(
    items.map(async (item) => {
      if (!item.description) return item;
      
      const translated = await translateText(item.description, lang, { enabled: true });
      return {
        ...item,
        description: translated.text,
        descriptionTranslated: translated.translated
      };
    })
  );
  
  return translatedItems;
}

// ============================================================================
// RAWG Router
// ============================================================================
const rawgRouter = Router();
const rawgAuth = requireApiKey('RAWG', 'https://rawg.io/apidocs');

// Normalisé: /rawg/search (avec cache PostgreSQL)
rawgRouter.get("/search", validateSearchParams, rawgAuth, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, page, autoTrad, refresh } = req.standardParams;
  const effectiveMax = Math.min(max, RAWG_MAX_LIMIT);
  const platforms = req.query.platforms || null;
  const genres = req.query.genres || null;
  const ordering = req.query.ordering || null;
  const dates = req.query.dates || null;
  const metacritic = req.query.metacritic || null;
  
  const result = await rawgCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchRawg(q, req.apiKey, { max: effectiveMax, page, platforms, genres, ordering, dates, metacritic });
      
      const items = (rawResult.games || rawResult.results || []).map(game => ({
        type: 'videogame',
        source: 'rawg',
        sourceId: game.id || game.slug,
        name: game.name,
        name_original: game.name,
        description: game.description_raw || null,
        year: game.released ? parseInt(game.released.substring(0, 4), 10) : null,
        image: game.backgroundImage || game.thumb || (Array.isArray(game.image) ? game.image[0] : game.image) || null,
        src_url: game.url || `https://rawg.io/games/${game.slug || game.id}`,
        released: game.released,
        rating: game.rating,
        platforms: game.platforms?.map(p => p.name || p.platform?.name) || [],
        detailUrl: generateDetailUrl('rawg', game.id || game.slug, 'game')
      }));
      
      return { 
        results: items, 
        total: rawResult.totalResults || rawResult.count,
        totalPages: rawResult.totalPages || Math.ceil((rawResult.count || 0) / effectiveMax)
      };
    },
    { params: { page, max: effectiveMax, platforms, genres, ordering, dates, metacritic }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'rawg',
    query: q,
    pagination: { page, totalResults: result.total, totalPages: result.totalPages },
    meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Normalisé: /rawg/details (avec cache PostgreSQL)
rawgRouter.get("/details", validateDetailsParams, rawgAuth, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true';
  
  const result = await rawgCache.getWithCache(
    id,
    async () => getRawgGameDetailsNormalized(id, req.apiKey, { lang, autoTrad }),
    { forceRefresh }
  );
  
  addCacheHeaders(res, 3600, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'rawg', id, meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Legacy
rawgRouter.get("/game/:id", rawgAuth, asyncHandler(async (req, res) => {
  const gameId = req.params.id;
  if (!gameId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  
  const autoTrad = isAutoTradEnabled(req);
  const lang = req.query.lang || null;
  
  const result = await getRawgGameDetails(gameId, req.apiKey, { lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// IGDB Router
// ============================================================================
const igdbRouter = Router();
const igdbAuth = requireApiKey('IGDB', 'https://dev.twitch.tv/console/apps (format: clientId:clientSecret)');

// Normalisé: /igdb/search (avec cache PostgreSQL)
igdbRouter.get("/search", validateSearchParams, igdbAuth, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  const effectiveMax = Math.min(max, IGDB_MAX_LIMIT);
  const platforms = req.query.platforms || null;
  const genres = req.query.genres || null;
  
  const { clientId, clientSecret } = parseIgdbCredentials(req.apiKey);
  const accessToken = await getIgdbToken(clientId, clientSecret);
  
  const result = await igdbCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchIgdb(q, clientId, accessToken, { max: effectiveMax, platforms, genres });
      
      const items = (rawResult.games || rawResult.results || []).map(game => ({
        type: 'videogame',
        source: 'igdb',
        sourceId: game.id,
        name: game.name,
        name_original: game.name,
        description: game.summary || null,
        year: game.releaseDate ? parseInt(game.releaseDate.substring(0, 4), 10) : null,
        image: game.thumb || game.cover?.coverBig || (Array.isArray(game.image) ? game.image[0] : game.image) || null,
        src_url: game.url || `https://www.igdb.com/games/${game.slug || game.id}`,
        released: game.releaseDate || null,
        rating: game.rating,
        platforms: game.platforms?.map(p => p.name || p.abbreviation) || [],
        detailUrl: generateDetailUrl('igdb', game.id, 'game')
      }));
      
      return { results: items, total: rawResult.count || items.length };
    },
    { params: { max: effectiveMax, platforms, genres }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'igdb',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Normalisé: /igdb/details (avec cache PostgreSQL)
igdbRouter.get("/details", validateDetailsParams, igdbAuth, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true';
  
  const { clientId, clientSecret } = parseIgdbCredentials(req.apiKey);
  const accessToken = await getIgdbToken(clientId, clientSecret);
  
  const result = await igdbCache.getWithCache(
    id,
    async () => getIgdbGameDetailsNormalized(id, clientId, accessToken, { lang, autoTrad }),
    { forceRefresh }
  );
  
  addCacheHeaders(res, 3600, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'igdb', id, meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Legacy
igdbRouter.get("/game/:id", igdbAuth, asyncHandler(async (req, res) => {
  const gameId = req.params.id;
  if (!gameId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  
  const { clientId, clientSecret } = parseIgdbCredentials(req.apiKey);
  const accessToken = await getIgdbToken(clientId, clientSecret);
  
  const autoTrad = isAutoTradEnabled(req);
  const lang = req.query.lang || null;
  
  const result = await getIgdbGameDetails(gameId, clientId, accessToken, { lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// JeuxVideo.com Router (pas de clé API) - anciennement JVC
// Endpoint: /jeuxvideo/*
// ============================================================================
const jeuxvideoRouter = Router();

// Normalisé: /jeuxvideo/search (avec cache PostgreSQL)
jeuxvideoRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  
  const result = await jvcCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchJVC(q, { max });
      
      const items = (rawResult.games || rawResult.results || []).map(game => ({
        type: 'videogame',
        source: 'jeuxvideo',
        sourceId: game.id,
        name: game.title || game.name,
        name_original: game.title || game.name,
        description: game.description || null,
        year: game.releaseDate ? parseInt(game.releaseDate.substring(0, 4), 10) : null,
        image: game.image || game.cover,
        src_url: game.url || null,
        platform: game.platform,
        detailUrl: generateDetailUrl('jeuxvideo', game.id, 'game')
      }));
      
      return { results: items, total: items.length };
    },
    { params: { max }, forceRefresh: refresh }
  );
  
  addCacheHeaders(res, 3600, getCacheInfo());
  res.json(formatSearchResponse({
    items: result.results || [],
    provider: 'jeuxvideo',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Normalisé: /jeuxvideo/details (avec cache PostgreSQL)
jeuxvideoRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true';
  
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un nombre entier" });
  }
  
  const result = await jvcCache.getWithCache(
    id,
    async () => getJvcGameByIdNormalized(parseInt(id, 10)),
    { forceRefresh }
  );
  
  if (!result || !result.name) {
    return res.status(404).json({ error: `Jeu ${id} non trouvé` });
  }
  
  addCacheHeaders(res, 3600, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'jeuxvideo', id, meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Legacy
jeuxvideoRouter.get("/game/:id", asyncHandler(async (req, res) => {
  const gameId = req.params.id;
  if (!gameId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  
  if (!/^\d+$/.test(gameId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un nombre entier" });
  }
  
  const result = await getJVCGameById(parseInt(gameId, 10));
  if (!result || !result.title) {
    return res.status(404).json({ error: `Jeu ${gameId} non trouvé` });
  }
  addCacheHeaders(res, 3600);
  res.json(result);
}));

export { rawgRouter, igdbRouter, jeuxvideoRouter };
