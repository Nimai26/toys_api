// routes/anime.js - Endpoints Jikan (MyAnimeList) (toys_api v3.0.0)
import { Router } from 'express';
import {
  searchJikanAnime,
  searchJikanManga,
  getJikanAnimeByIdNormalized,
  getJikanMangaByIdNormalized
} from '../lib/providers/jikan.js';
import { 
  cleanSourceId, 
  addCacheHeaders, 
  metrics, 
  asyncHandler, 
  isAutoTradEnabled,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams,
  generateDetailUrl,
  formatSearchResponse,
  formatDetailResponse,
  translateSearchDescriptions
} from '../lib/utils/index.js';
import { JIKAN_DEFAULT_MAX } from '../lib/config.js';
import { createProviderCache, getCacheInfo } from '../lib/database/index.js';

// Router principal (legacy + unifié)
const router = Router();

// Cache providers pour anime/manga (Jikan)
const jikanAnimeCache = createProviderCache('jikan', 'anime');
const jikanMangaCache = createProviderCache('jikan', 'manga');

// Router spécifique anime
const animeRouter = Router();

// Router spécifique manga
const mangaRouter = Router();

// ============================================================================
// Endpoints normalisés
// ============================================================================

// Normalisé: /jikan/search (anime par défaut, type=manga pour manga) - avec cache PostgreSQL
router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, page, autoTrad, refresh } = req.standardParams;
  const type = req.query.type || null;
  const status = req.query.status || null;
  const rating = req.query.rating || null;
  const orderBy = req.query.orderBy || null;
  const sort = req.query.sort || null;

  // Types manga: manga, novel, lightnovel, oneshot, doujin, manhwa, manhua
  const mangaTypes = ['manga', 'novel', 'lightnovel', 'oneshot', 'doujin', 'manhwa', 'manhua'];
  const isManga = type && mangaTypes.includes(type.toLowerCase());
  const mediaType = isManga ? 'manga' : 'anime';
  const cache = isManga ? jikanMangaCache : jikanAnimeCache;
  
  // Utilise le cache de recherche PostgreSQL (bypass si refresh=true)
  const result = await cache.searchWithCache(
    q,
    async () => {
      let rawResult;
      if (isManga) {
        rawResult = await searchJikanManga(q, { max, page, type, status, orderBy, sort });
      } else {
        const animeType = type && ['tv', 'movie', 'ova', 'special', 'ona', 'music'].includes(type.toLowerCase()) ? type : null;
        rawResult = await searchJikanAnime(q, { max, page, type: animeType, status, rating, orderBy, sort });
      }
      
      const items = (rawResult.results || rawResult.data || []).map(item => ({
        type: mediaType,
        source: isManga ? 'jikan_manga' : 'jikan_anime',
        sourceId: item.mal_id || item.id,
        name: item.title || item.name,
        name_original: item.title_japanese || item.title,
        description: item.synopsis || null,
        year: item.year || (item.aired?.from ? parseInt(item.aired.from.substring(0, 4), 10) : null),
        image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || item.image,
        src_url: item.url || `https://myanimelist.net/${mediaType}/${item.mal_id || item.id}`,
        score: item.score,
        episodes: item.episodes,
        chapters: item.chapters,
        volumes: item.volumes,
        detailUrl: generateDetailUrl('jikan', item.mal_id || item.id, mediaType)
      }));
      
      return { 
        results: items, 
        total: rawResult.pagination?.items?.total || items.length,
        pagination: { page, hasNextPage: rawResult.pagination?.has_next_page }
      };
    },
    { params: { type, page, max, status, rating, orderBy, sort }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  metrics.requests.total++;
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: isManga ? 'jikan_manga' : 'jikan_anime',
    query: q,
    total: result.total,
    pagination: result.pagination || { page, hasNextPage: false },
    meta: { lang, locale, autoTrad, mediaType },
    cacheMatch: result._cacheMatch
  }));
}));

// Normalisé: /jikan/details (avec cache PostgreSQL)
router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id, type } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';
  
  const cleanId = cleanSourceId(id, 'jikan');
  if (!/^\d+$/.test(cleanId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un nombre entier" });
  }
  
  const numericId = parseInt(cleanId, 10);
  let result;
  
  if (type === 'manga') {
    // Utilise le cache PostgreSQL pour manga
    result = await jikanMangaCache.getWithCache(
      cleanId,
      () => getJikanMangaByIdNormalized(numericId, { lang, autoTrad }),
      { type: 'manga', forceRefresh }
    );
  } else {
    // Utilise le cache PostgreSQL pour anime
    result = await jikanAnimeCache.getWithCache(
      cleanId,
      () => getJikanAnimeByIdNormalized(numericId, { lang, autoTrad }),
      { type: 'anime', forceRefresh }
    );
  }
  
  if (!result) {
    return res.status(404).json({ error: `${type || 'anime'} ${cleanId} non trouvé` });
  }
  
  const providerName = type === 'manga' ? 'jikan_manga' : 'jikan_anime';
  metrics.requests.total++;
  addCacheHeaders(res, 3600, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: providerName, id: cleanId, meta: { lang, locale, autoTrad, type } }));
}));

// ============================================================================
// Endpoints legacy
// ============================================================================

// Recherche d'anime (legacy)
router.get("/anime", asyncHandler(async (req, res) => {
  const query = req.query.q;
  const max = req.query.max ? parseInt(req.query.max, 10) : JIKAN_DEFAULT_MAX;
  const type = req.query.type || null;
  const status = req.query.status || null;
  const rating = req.query.rating || null;
  const orderBy = req.query.orderBy || null;
  const sort = req.query.sort || null;

  if (!query) return res.status(400).json({ error: "paramètre 'q' manquant" });

  const validTypes = ['tv', 'movie', 'ova', 'special', 'ona', 'music'];
  if (type && !validTypes.includes(type.toLowerCase())) {
    return res.status(400).json({ error: `Type invalide: ${type}`, validTypes });
  }

  const validStatuses = ['airing', 'complete', 'upcoming'];
  if (status && !validStatuses.includes(status.toLowerCase())) {
    return res.status(400).json({ error: `Statut invalide: ${status}`, validStatuses });
  }

  metrics.requests.total++;
  const result = await searchJikanAnime(query, { max, type, status, rating, orderBy, sort });
  addCacheHeaders(res, 300);
  res.json(result);
}));

// Recherche de manga (legacy)
router.get("/manga", asyncHandler(async (req, res) => {
  const query = req.query.q;
  const max = req.query.max ? parseInt(req.query.max, 10) : JIKAN_DEFAULT_MAX;
  const type = req.query.type || null;
  const status = req.query.status || null;
  const orderBy = req.query.orderBy || null;
  const sort = req.query.sort || null;

  if (!query) return res.status(400).json({ error: "paramètre 'q' manquant" });

  const validTypes = ['manga', 'novel', 'lightnovel', 'oneshot', 'doujin', 'manhwa', 'manhua'];
  if (type && !validTypes.includes(type.toLowerCase())) {
    return res.status(400).json({ error: `Type invalide: ${type}`, validTypes });
  }

  const validStatuses = ['publishing', 'complete', 'hiatus', 'discontinued', 'upcoming'];
  if (status && !validStatuses.includes(status.toLowerCase())) {
    return res.status(400).json({ error: `Statut invalide: ${status}`, validStatuses });
  }

  metrics.requests.total++;
  const result = await searchJikanManga(query, { max, type, status, orderBy, sort });
  addCacheHeaders(res, 300);
  res.json(result);
}));

// Détails d'un anime (legacy)
router.get("/anime/:id", asyncHandler(async (req, res) => {
  let animeId = req.params.id;
  const lang = req.query.lang || null;
  const autoTrad = isAutoTradEnabled(req.query);
  if (!animeId) return res.status(400).json({ error: "paramètre 'id' manquant" });

  animeId = cleanSourceId(animeId, 'jikan');
  if (!/^\d+$/.test(animeId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un nombre entier" });
  }

  metrics.requests.total++;
  const result = await getJikanAnimeById(parseInt(animeId, 10), { lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// Détails d'un manga (legacy)
router.get("/manga/:id", asyncHandler(async (req, res) => {
  let mangaId = req.params.id;
  const lang = req.query.lang || null;
  const autoTrad = isAutoTradEnabled(req.query);
  if (!mangaId) return res.status(400).json({ error: "paramètre 'id' manquant" });

  mangaId = cleanSourceId(mangaId, 'jikan');
  if (!/^\d+$/.test(mangaId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un nombre entier" });
  }

  metrics.requests.total++;
  const result = await getJikanMangaById(parseInt(mangaId, 10), { lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// ROUTER SPÉCIFIQUE ANIME (/jikan_anime/*)
// ============================================================================

// Normalisé: /jikan_anime/search
animeRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  const type = req.query.type || null; // tv, movie, ova, special, ona, music
  const status = req.query.status || null;
  const rating = req.query.rating || null;
  const orderBy = req.query.orderBy || null;
  const sort = req.query.sort || null;

  const rawResult = await searchJikanAnime(q, { max, type, status, rating, orderBy, sort });
  
  let items = (rawResult.results || rawResult.data || []).map(item => ({
    type: 'anime',
    source: 'jikan_anime',
    sourceId: item.mal_id || item.id,
    name: item.title || item.name,
    name_original: item.title_japanese || item.title,
    description: item.synopsis || null,
    year: item.year || (item.aired?.from ? parseInt(item.aired.from.substring(0, 4), 10) : null),
    image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || item.image,
    src_url: item.url || `https://myanimelist.net/anime/${item.mal_id || item.id}`,
    score: item.score,
    episodes: item.episodes,
    status: item.status,
    detailUrl: generateDetailUrl('jikan', item.mal_id || item.id, 'anime')
  }));
  
  // Traduire les descriptions si autoTrad activé
  const translatedItems = await translateSearchDescriptions(items, autoTrad, lang);
  
  metrics.requests.total++;
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items: translatedItems,
    provider: 'jikan_anime',
    query: q,
    meta: { lang, locale, autoTrad, mediaType: 'anime' }
  }));
}));

// Normalisé: /jikan_anime/details
animeRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  
  const cleanId = cleanSourceId(id, 'jikan');
  if (!/^\d+$/.test(cleanId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un nombre entier" });
  }
  
  const result = await getJikanAnimeByIdNormalized(parseInt(cleanId, 10), { lang, autoTrad });
  
  metrics.requests.total++;
  addCacheHeaders(res, 3600);
  res.json(formatDetailResponse({ data: result, provider: 'jikan_anime', id: cleanId, meta: { lang, locale, autoTrad, type: 'anime' } }));
}));

// Legacy: /jikan_anime/:id
animeRouter.get("/:id", asyncHandler(async (req, res) => {
  let animeId = req.params.id;
  const lang = req.query.lang || null;
  const autoTrad = isAutoTradEnabled(req.query);
  
  if (!animeId) return res.status(400).json({ error: "paramètre 'id' manquant" });

  animeId = cleanSourceId(animeId, 'jikan');
  if (!/^\d+$/.test(animeId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un nombre entier" });
  }

  metrics.requests.total++;
  const result = await getJikanAnimeById(parseInt(animeId, 10), { lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// ROUTER SPÉCIFIQUE MANGA (/jikan_manga/*)
// ============================================================================

// Normalisé: /jikan_manga/search
mangaRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  const type = req.query.type || null; // manga, novel, lightnovel, oneshot, doujin, manhwa, manhua
  const status = req.query.status || null;
  const orderBy = req.query.orderBy || null;
  const sort = req.query.sort || null;

  const rawResult = await searchJikanManga(q, { max, type, status, orderBy, sort });
  
  const items = (rawResult.results || rawResult.data || []).map(item => ({
    type: 'manga',
    source: 'jikan_manga',
    sourceId: item.mal_id || item.id,
    name: item.title || item.name,
    name_original: item.title_japanese || item.title,
    description: item.synopsis || null,
    year: item.published?.from ? parseInt(item.published.from.substring(0, 4), 10) : null,
    image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || item.image,
    src_url: item.url || `https://myanimelist.net/manga/${item.mal_id || item.id}`,
    score: item.score,
    chapters: item.chapters,
    volumes: item.volumes,
    status: item.status,
    detailUrl: generateDetailUrl('jikan', item.mal_id || item.id, 'manga')
  }));
  
  // Traduire les descriptions si autoTrad activé
  const translatedItems = await translateSearchDescriptions(items, autoTrad, lang);
  
  metrics.requests.total++;
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items: translatedItems,
    provider: 'jikan_manga',
    query: q,
    meta: { lang, locale, autoTrad, mediaType: 'manga' }
  }));
}));

// Normalisé: /jikan_manga/details
mangaRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  
  const cleanId = cleanSourceId(id, 'jikan');
  if (!/^\d+$/.test(cleanId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un nombre entier" });
  }
  
  const result = await getJikanMangaByIdNormalized(parseInt(cleanId, 10), { lang, autoTrad });
  
  metrics.requests.total++;
  addCacheHeaders(res, 3600);
  res.json(formatDetailResponse({ data: result, provider: 'jikan_manga', id: cleanId, meta: { lang, locale, autoTrad, type: 'manga' } }));
}));

// Legacy: /jikan_manga/:id
mangaRouter.get("/:id", asyncHandler(async (req, res) => {
  let mangaId = req.params.id;
  const lang = req.query.lang || null;
  const autoTrad = isAutoTradEnabled(req.query);
  
  if (!mangaId) return res.status(400).json({ error: "paramètre 'id' manquant" });

  mangaId = cleanSourceId(mangaId, 'jikan');
  if (!/^\d+$/.test(mangaId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un nombre entier" });
  }

  metrics.requests.total++;
  const result = await getJikanMangaById(parseInt(mangaId, 10), { lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// Export des trois routers
export { router as default, animeRouter as jikanAnimeRouter, mangaRouter as jikanMangaRouter };
