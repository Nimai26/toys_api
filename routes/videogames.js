// routes/videogames.js - Endpoints RAWG, IGDB et JVC (toys_api v3.0.0)
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
import {
  RAWG_DEFAULT_MAX,
  RAWG_MAX_LIMIT,
  IGDB_DEFAULT_MAX,
  IGDB_MAX_LIMIT,
  JVC_DEFAULT_MAX
} from '../lib/config.js';

// ============================================================================
// RAWG Router
// ============================================================================
const rawgRouter = Router();
const rawgAuth = requireApiKey('RAWG', 'https://rawg.io/apidocs');

// Normalisé: /rawg/search
rawgRouter.get("/search", validateSearchParams, rawgAuth, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, page, autoTrad } = req.standardParams;
  const effectiveMax = Math.min(max, RAWG_MAX_LIMIT);
  const platforms = req.query.platforms || null;
  const genres = req.query.genres || null;
  const ordering = req.query.ordering || null;
  const dates = req.query.dates || null;
  const metacritic = req.query.metacritic || null;
  
  const rawResult = await searchRawg(q, req.apiKey, { max: effectiveMax, page, platforms, genres, ordering, dates, metacritic });
  
  const items = (rawResult.results || rawResult.games || []).map(game => ({
    type: 'videogame',
    source: 'rawg',
    sourceId: game.id || game.slug,
    name: game.name,
    name_original: game.name,
    description: game.description_raw || null,
    year: game.released ? parseInt(game.released.substring(0, 4), 10) : null,
    image: game.background_image,
    src_url: `https://rawg.io/games/${game.slug || game.id}`,
    released: game.released,
    rating: game.rating,
    platforms: game.platforms?.map(p => p.platform?.name) || [],
    detailUrl: generateDetailUrl('rawg', game.id || game.slug, 'game')
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'rawg',
    query: q,
    pagination: { page, totalResults: rawResult.count, totalPages: Math.ceil(rawResult.count / effectiveMax) },
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /rawg/details
rawgRouter.get("/details", validateDetailsParams, rawgAuth, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  
  const result = await getRawgGameDetailsNormalized(id, req.apiKey, { lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(formatDetailResponse({ data: result, provider: 'rawg', id, meta: { lang, locale, autoTrad } }));
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

// Normalisé: /igdb/search
igdbRouter.get("/search", validateSearchParams, igdbAuth, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  const effectiveMax = Math.min(max, IGDB_MAX_LIMIT);
  const platforms = req.query.platforms || null;
  const genres = req.query.genres || null;
  
  const { clientId, clientSecret } = parseIgdbCredentials(req.apiKey);
  const accessToken = await getIgdbToken(clientId, clientSecret);
  
  const rawResult = await searchIgdb(q, clientId, accessToken, { max: effectiveMax, platforms, genres });
  
  const items = (rawResult.games || rawResult.results || []).map(game => ({
    type: 'videogame',
    source: 'igdb',
    sourceId: game.id,
    name: game.name,
    name_original: game.name,
    description: game.summary || null,
    year: game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : null,
    image: game.cover?.url ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}` : null,
    src_url: game.url || `https://www.igdb.com/games/${game.slug || game.id}`,
    released: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : null,
    rating: game.rating,
    detailUrl: generateDetailUrl('igdb', game.id, 'game')
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'igdb',
    query: q,
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /igdb/details
igdbRouter.get("/details", validateDetailsParams, igdbAuth, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  
  const { clientId, clientSecret } = parseIgdbCredentials(req.apiKey);
  const accessToken = await getIgdbToken(clientId, clientSecret);
  
  const result = await getIgdbGameDetailsNormalized(id, clientId, accessToken, { lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(formatDetailResponse({ data: result, provider: 'igdb', id, meta: { lang, locale, autoTrad } }));
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

// Normalisé: /jeuxvideo/search
jeuxvideoRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  
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
  
  addCacheHeaders(res, 3600);
  res.json(formatSearchResponse({
    items,
    provider: 'jeuxvideo',
    query: q,
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /jeuxvideo/details
jeuxvideoRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un nombre entier" });
  }
  
  const result = await getJvcGameByIdNormalized(parseInt(id, 10));
  if (!result || !result.name) {
    return res.status(404).json({ error: `Jeu ${id} non trouvé` });
  }
  
  addCacheHeaders(res, 3600);
  res.json(formatDetailResponse({ data: result, provider: 'jeuxvideo', id, meta: { lang, locale, autoTrad } }));
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
