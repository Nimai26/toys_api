// routes/comics.js - Endpoints Comic Vine, MangaDex et Bedetheque
import { Router } from 'express';
import {
  searchComicVine,
  getComicVineVolume,
  getComicVineIssue
} from '../lib/providers/comicvine.js';
import {
  searchMangaDex,
  getMangaDexById
} from '../lib/providers/mangadex.js';
import {
  searchBedetheque,
  searchBedethequeAlbums,
  getBedethequeSerieById,
  getBedethequeAlbumById
} from '../lib/providers/bedetheque.js';
import { cleanSourceId, addCacheHeaders, asyncHandler, isAutoTradEnabled } from '../lib/utils/index.js';
import { COMICVINE_DEFAULT_MAX, COMICVINE_MAX_LIMIT, MANGADEX_DEFAULT_MAX, MANGADEX_MAX_LIMIT, BEDETHEQUE_DEFAULT_MAX } from '../lib/config.js';

// ============================================================================
// Comic Vine Router
// ============================================================================
const comicvineRouter = Router();

comicvineRouter.get("/search", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const type = req.query.type || 'volume';
  const max = req.query.max ? Math.min(Math.max(1, parseInt(req.query.max, 10)), COMICVINE_MAX_LIMIT) : COMICVINE_DEFAULT_MAX;

  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  const validTypes = ['volume', 'issue', 'character', 'person'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: "Type de ressource invalide", validTypes, hint: "Utilisez 'volume' pour les séries" });
  }

  const result = await searchComicVine(q, { type, max });
  addCacheHeaders(res, 300);
  res.json(result);
}));

comicvineRouter.get("/volume/:id", asyncHandler(async (req, res) => {
  let volumeId = cleanSourceId(req.params.id, 'comicvine');
  if (!volumeId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  if (!/^\d+$/.test(volumeId)) return res.status(400).json({ error: "Format d'ID invalide" });

  const autoTrad = isAutoTradEnabled(req);
  const lang = req.query.lang || 'en';
  
  const result = await getComicVineVolume(parseInt(volumeId, 10), { lang, autoTrad });
  if (!result) return res.status(404).json({ error: `Volume ${volumeId} non trouvé` });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

comicvineRouter.get("/issue/:id", asyncHandler(async (req, res) => {
  let issueId = cleanSourceId(req.params.id, 'comicvine');
  if (!issueId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  if (!/^\d+$/.test(issueId)) return res.status(400).json({ error: "Format d'ID invalide" });

  const autoTrad = isAutoTradEnabled(req);
  const lang = req.query.lang || 'en';
  
  const result = await getComicVineIssue(parseInt(issueId, 10), { lang, autoTrad });
  if (!result) return res.status(404).json({ error: `Issue ${issueId} non trouvé` });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// MangaDex Router
// ============================================================================
const mangadexRouter = Router();

mangadexRouter.get("/search", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const lang = req.query.lang || null;
  const max = req.query.max ? Math.min(Math.max(1, parseInt(req.query.max, 10)), MANGADEX_MAX_LIMIT) : MANGADEX_DEFAULT_MAX;

  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  const result = await searchMangaDex(q, { lang, max });
  addCacheHeaders(res, 300);
  res.json(result);
}));

mangadexRouter.get("/manga/:id", asyncHandler(async (req, res) => {
  let mangaId = cleanSourceId(req.params.id, 'mangadex');
  const lang = req.query.lang || null;
  const autoTrad = isAutoTradEnabled(req);
  if (!mangaId) return res.status(400).json({ error: "paramètre 'id' manquant" });

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mangaId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un UUID" });
  }

  const result = await getMangaDexById(mangaId, { lang, autoTrad });
  if (!result) return res.status(404).json({ error: `Manga ${mangaId} non trouvé` });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// Bedetheque Router (scraping)
// ============================================================================
const bedethequeRouter = Router();

bedethequeRouter.get("/search", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const max = req.query.max ? Math.min(Math.max(1, parseInt(req.query.max, 10)), 50) : BEDETHEQUE_DEFAULT_MAX;

  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  const result = await searchBedetheque(q, { max });
  addCacheHeaders(res, 600);
  res.json(result);
}));

bedethequeRouter.get("/search/albums", asyncHandler(async (req, res) => {
  const q = req.query.q || '';
  const serieId = req.query.serieId || req.query.serie_id || '';
  const serieName = req.query.serieName || req.query.serie_name || '';
  const max = req.query.max ? Math.min(Math.max(1, parseInt(req.query.max, 10)), 50) : BEDETHEQUE_DEFAULT_MAX;

  if (!q && !serieId) {
    return res.status(400).json({ error: "Au moins un paramètre de recherche requis", hint: "Utilisez q ou serieId" });
  }

  const result = await searchBedethequeAlbums(q, { max, serieId: serieId || null, serieName: serieName || null });
  addCacheHeaders(res, 600);
  res.json(result);
}));

bedethequeRouter.get("/serie/:id", asyncHandler(async (req, res) => {
  const serieId = req.params.id;
  if (!serieId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  if (!/^\d+$/.test(serieId)) return res.status(400).json({ error: "Format d'ID invalide" });

  const result = await getBedethequeSerieById(parseInt(serieId, 10));
  if (!result || !result.name) return res.status(404).json({ error: `Série ${serieId} non trouvée` });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

bedethequeRouter.get("/album/:id", asyncHandler(async (req, res) => {
  let albumId = cleanSourceId(req.params.id, 'bedetheque');
  if (!albumId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  if (!/^\d+$/.test(albumId)) return res.status(400).json({ error: "Format d'ID invalide" });

  const result = await getBedethequeAlbumById(parseInt(albumId, 10));
  if (!result || !result.title) return res.status(404).json({ error: `Album ${albumId} non trouvé` });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

export { comicvineRouter, mangadexRouter, bedethequeRouter };
