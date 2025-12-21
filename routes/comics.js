// routes/comics.js - Endpoints Comic Vine, MangaDex et Bedetheque (toys_api v3.1.0)
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
import { 
  cleanSourceId, 
  addCacheHeaders, 
  asyncHandler, 
  isAutoTradEnabled,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams,
  generateDetailUrl,
  formatSearchResponse,
  formatDetailResponse,
  requireApiKey
} from '../lib/utils/index.js';
import { COMICVINE_DEFAULT_MAX, COMICVINE_MAX_LIMIT, MANGADEX_DEFAULT_MAX, MANGADEX_MAX_LIMIT, BEDETHEQUE_DEFAULT_MAX } from '../lib/config.js';

// ============================================================================
// Comic Vine Router (Requires API Key)
// ============================================================================
const comicvineRouter = Router();
const comicvineAuth = requireApiKey('Comic Vine', 'https://comicvine.gamespot.com/api/');

// Normalisé: /comicvine/search
comicvineRouter.get("/search", comicvineAuth, validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  const type = req.query.type || 'volume';
  const effectiveMax = Math.min(Math.max(1, max), COMICVINE_MAX_LIMIT);

  const validTypes = ['volume', 'issue', 'character', 'person'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: "Type de ressource invalide", validTypes, hint: "Utilisez 'volume' pour les séries" });
  }

  const rawResult = await searchComicVine(q, req.apiKey, { type, max: effectiveMax });
  
  const items = (rawResult.results || rawResult.volumes || []).map(item => ({
    type: type,
    source: 'comicvine',
    sourceId: item.id,
    name: item.name || item.title,
    name_original: item.name || item.title,
    description: item.deck || item.description || null,
    year: item.start_year ? parseInt(item.start_year, 10) : null,
    image: item.image?.medium_url || item.image?.original_url,
    src_url: item.site_detail_url || `https://comicvine.gamespot.com/volume/${item.id}/`,
    publisher: item.publisher?.name,
    startYear: item.start_year,
    detailUrl: generateDetailUrl('comicvine', item.id, type)
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'comicvine',
    query: q,
    meta: { lang, locale, autoTrad, type }
  }));
}));

// Normalisé: /comicvine/details
comicvineRouter.get("/details", comicvineAuth, validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id, type } = req.parsedDetailUrl;
  
  const cleanId = cleanSourceId(id, 'comicvine');
  if (!/^\d+$/.test(cleanId)) return res.status(400).json({ error: "Format d'ID invalide" });

  let result;
  if (type === 'issue') {
    result = await getComicVineIssue(parseInt(cleanId, 10), req.apiKey, { lang, autoTrad });
  } else {
    result = await getComicVineVolume(parseInt(cleanId, 10), req.apiKey, { lang, autoTrad });
  }
  
  if (!result) return res.status(404).json({ error: `${type} ${cleanId} non trouvé` });
  
  addCacheHeaders(res, 3600);
  res.json(formatDetailResponse({ data: result, provider: 'comicvine', id: cleanId, meta: { lang, locale, autoTrad, type } }));
}));

// Legacy
comicvineRouter.get("/volume/:id", comicvineAuth, asyncHandler(async (req, res) => {
  let volumeId = cleanSourceId(req.params.id, 'comicvine');
  if (!volumeId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  if (!/^\d+$/.test(volumeId)) return res.status(400).json({ error: "Format d'ID invalide" });

  const autoTrad = isAutoTradEnabled(req);
  const lang = req.query.lang || 'en';
  
  const result = await getComicVineVolume(parseInt(volumeId, 10), req.apiKey, { lang, autoTrad });
  if (!result) return res.status(404).json({ error: `Volume ${volumeId} non trouvé` });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

comicvineRouter.get("/issue/:id", comicvineAuth, asyncHandler(async (req, res) => {
  let issueId = cleanSourceId(req.params.id, 'comicvine');
  if (!issueId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  if (!/^\d+$/.test(issueId)) return res.status(400).json({ error: "Format d'ID invalide" });

  const autoTrad = isAutoTradEnabled(req);
  const lang = req.query.lang || 'en';
  
  const result = await getComicVineIssue(parseInt(issueId, 10), req.apiKey, { lang, autoTrad });
  if (!result) return res.status(404).json({ error: `Issue ${issueId} non trouvé` });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// MangaDex Router
// ============================================================================
const mangadexRouter = Router();

// Normalisé: /mangadex/search
mangadexRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  const effectiveMax = Math.min(Math.max(1, max), MANGADEX_MAX_LIMIT);

  const rawResult = await searchMangaDex(q, { lang, max: effectiveMax });
  
  const items = (rawResult.results || rawResult.mangas || rawResult.data || []).map(item => ({
    type: 'manga',
    source: 'mangadex',
    sourceId: item.id,
    name: item.attributes?.title?.en || item.title || item.name,
    name_original: item.attributes?.title?.ja || item.title_original,
    description: item.attributes?.description?.en || item.description || null,
    year: item.attributes?.year || null,
    image: item.cover || item.coverUrl,
    src_url: `https://mangadex.org/title/${item.id}`,
    status: item.attributes?.status,
    detailUrl: generateDetailUrl('mangadex', item.id, 'manga')
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'mangadex',
    query: q,
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /mangadex/details
mangadexRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  
  const cleanId = cleanSourceId(id, 'mangadex');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un UUID" });
  }

  const result = await getMangaDexById(cleanId, { lang, autoTrad });
  if (!result) return res.status(404).json({ error: `Manga ${cleanId} non trouvé` });
  
  addCacheHeaders(res, 3600);
  res.json(formatDetailResponse({ data: result, provider: 'mangadex', id: cleanId, meta: { lang, locale, autoTrad } }));
}));

// Legacy
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

// Normalisé: /bedetheque/search
bedethequeRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  const type = req.query.type || 'serie';
  const effectiveMax = Math.min(Math.max(1, max), 50);

  let rawResult;
  if (type === 'album') {
    const serieId = req.query.serieId || req.query.serie_id || null;
    const serieName = req.query.serieName || req.query.serie_name || null;
    rawResult = await searchBedethequeAlbums(q, { max: effectiveMax, serieId, serieName });
  } else {
    rawResult = await searchBedetheque(q, { max: effectiveMax });
  }
  
  const items = (rawResult.results || rawResult.series || rawResult.albums || []).map(item => ({
    type: type === 'album' ? 'album' : 'serie',
    source: 'bedetheque',
    sourceId: item.id,
    name: item.name || item.title,
    name_original: item.name || item.title,
    description: item.description || item.resume || null,
    year: item.year || item.parution || null,
    image: item.image || item.cover,
    src_url: item.url || null,
    author: item.author,
    detailUrl: generateDetailUrl('bedetheque', item.id, type === 'album' ? 'album' : 'serie')
  }));
  
  addCacheHeaders(res, 600);
  res.json(formatSearchResponse({
    items,
    provider: 'bedetheque',
    query: q,
    meta: { lang, locale, autoTrad, type }
  }));
}));

// Normalisé: /bedetheque/details
bedethequeRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id, type } = req.parsedDetailUrl;
  
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "Format d'ID invalide" });

  let result;
  if (type === 'album') {
    result = await getBedethequeAlbumById(parseInt(id, 10));
    if (!result || !result.title) return res.status(404).json({ error: `Album ${id} non trouvé` });
  } else {
    result = await getBedethequeSerieById(parseInt(id, 10));
    if (!result || !result.name) return res.status(404).json({ error: `Série ${id} non trouvée` });
  }
  
  addCacheHeaders(res, 3600);
  res.json(formatDetailResponse({ data: result, provider: 'bedetheque', id, meta: { lang, locale, autoTrad, type } }));
}));

// Legacy
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
