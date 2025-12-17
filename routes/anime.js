// routes/anime.js - Endpoints Jikan (MyAnimeList)
import { Router } from 'express';
import {
  searchJikanAnime,
  searchJikanManga,
  getJikanAnimeById,
  getJikanMangaById
} from '../lib/providers/jikan.js';
import { cleanSourceId, addCacheHeaders, metrics, asyncHandler, isAutoTradEnabled } from '../lib/utils/index.js';
import { JIKAN_DEFAULT_MAX } from '../lib/config.js';

const router = Router();

// Recherche d'anime
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

// Recherche de manga
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

// Détails d'un anime
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

// Détails d'un manga
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
