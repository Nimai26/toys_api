// routes/anime.js - Endpoints Jikan (MyAnimeList) (toys_api v3.0.0)
import { Router } from 'express';
import {
  searchJikanAnime,
  searchJikanManga,
  getJikanAnimeById,
  getJikanMangaById
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
  formatDetailResponse
} from '../lib/utils/index.js';
import { JIKAN_DEFAULT_MAX } from '../lib/config.js';

const router = Router();

// ============================================================================
// Endpoints normalisés
// ============================================================================

// Normalisé: /jikan/search (anime par défaut, type=manga pour manga)
router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, page, autoTrad } = req.standardParams;
  const type = req.query.type || 'anime';
  const status = req.query.status || null;
  const rating = req.query.rating || null;
  const orderBy = req.query.orderBy || null;
  const sort = req.query.sort || null;

  let rawResult;
  let mediaType;
  
  if (type === 'manga' || type === 'novel' || type === 'lightnovel' || type === 'oneshot' || type === 'doujin' || type === 'manhwa' || type === 'manhua') {
    rawResult = await searchJikanManga(q, { max, page, type, status, orderBy, sort });
    mediaType = 'manga';
  } else {
    rawResult = await searchJikanAnime(q, { max, page, type, status, rating, orderBy, sort });
    mediaType = 'anime';
  }
  
  const items = (rawResult.results || rawResult.data || []).map(item => ({
    type: mediaType,
    source: 'jikan',
    sourceId: item.mal_id || item.id,
    name: item.title || item.name,
    name_original: item.title_japanese || item.title,
    image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || item.image,
    score: item.score,
    episodes: item.episodes,
    chapters: item.chapters,
    detailUrl: generateDetailUrl('jikan', item.mal_id || item.id, mediaType)
  }));
  
  metrics.requests.total++;
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'jikan',
    query: q,
    pagination: { page, hasNextPage: rawResult.pagination?.has_next_page },
    meta: { lang, locale, autoTrad, mediaType }
  }));
}));

// Normalisé: /jikan/details
router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id, type } = req.parsedDetailUrl;
  
  const cleanId = cleanSourceId(id, 'jikan');
  if (!/^\d+$/.test(cleanId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un nombre entier" });
  }
  
  let result;
  if (type === 'manga') {
    result = await getJikanMangaById(parseInt(cleanId, 10), { lang, autoTrad });
  } else {
    result = await getJikanAnimeById(parseInt(cleanId, 10), { lang, autoTrad });
  }
  
  metrics.requests.total++;
  addCacheHeaders(res, 3600);
  res.json(formatDetailResponse({ data: result, provider: 'jikan', id: cleanId, meta: { lang, locale, autoTrad, type } }));
}));

// ============================================================================
// Endpoints legacy
// ============================================================================

// Recherche d'anime (legacy)
router.get("/anime", asyncHandler(async (req, res) => {
  const query = req.query.q;
  const max = req.query.max ? parseInt(req.query.max, 10) : JIKAN_DEFAULT_MAX;
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
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
  const result = await searchJikanAnime(query, { max, page, type, status, rating, orderBy, sort });
  addCacheHeaders(res, 300);
  res.json(result);
}));

// Recherche de manga (legacy)
router.get("/manga", asyncHandler(async (req, res) => {
  const query = req.query.q;
  const max = req.query.max ? parseInt(req.query.max, 10) : JIKAN_DEFAULT_MAX;
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
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
  const result = await searchJikanManga(query, { max, page, type, status, orderBy, sort });
  addCacheHeaders(res, 300);
  res.json(result);
}));

// Détails d'un anime (legacy)
router.get("/anime/:id", asyncHandler(async (req, res) => {
  let animeId = req.params.id;
  const lang = req.query.lang || null;
  const autoTrad = isAutoTradEnabled(req);
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
  const autoTrad = isAutoTradEnabled(req);
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

export default router;
