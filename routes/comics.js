// routes/comics.js - Endpoints Comic Vine, MangaDex et Bedetheque (toys_api v4.0.0)
import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import {
  searchComicVine,
  getComicVineVolumeNormalized,
  getComicVineIssueNormalized
} from '../lib/providers/comicvine.js';
import {
  searchMangaDex,
  getMangaDexByIdNormalized
} from '../lib/providers/mangadex.js';
import {
  searchBedetheque,
  searchBedethequeAlbums,
  getBedethequeSerieByIdNormalized,
  getBedethequeAlbumByIdNormalized,
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
  requireApiKey,
  translateSearchDescriptions
} from '../lib/utils/index.js';
import { createProviderCache, getCacheInfo } from '../lib/database/cache-wrapper.js';
import { COMICVINE_DEFAULT_MAX, COMICVINE_MAX_LIMIT, MANGADEX_DEFAULT_MAX, MANGADEX_MAX_LIMIT, BEDETHEQUE_DEFAULT_MAX } from '../lib/config.js';

const log = createLogger('Route:Comics');

// ============================================================================
// Comic Vine Router (Requires API Key)
// ============================================================================
const comicvineRouter = Router();
const comicvineAuth = requireApiKey('Comic Vine', 'https://comicvine.gamespot.com/api/');

// Cache provider pour Comic Vine
const comicvineCache = createProviderCache('comicvine', 'volume');

// Normalisé: /comicvine/search (avec cache PostgreSQL)
comicvineRouter.get("/search", comicvineAuth, validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  const type = req.query.type || 'volume';
  const effectiveMax = Math.min(Math.max(1, max), COMICVINE_MAX_LIMIT);

  const validTypes = ['volume', 'issue', 'character', 'person'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: "Type de ressource invalide", validTypes, hint: "Utilisez 'volume' pour les séries" });
  }

  const result = await comicvineCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchComicVine(q, req.apiKey, { type, max: effectiveMax });
      
      const items = (rawResult.results || rawResult.volumes || []).map(item => {
        // Le provider retourne image comme tableau [original, medium, thumb]
        const imageArray = Array.isArray(item.image) ? item.image : [];
        const imageUrl = imageArray[1] || imageArray[0] || null;  // Préférer medium_url (index 1)
        const thumbnailUrl = imageArray[2] || imageArray[1] || null;  // thumb_url (index 2)
        
        return {
          type: type,
          source: 'comicvine',
          sourceId: item.id,
          name: item.name || item.title,
          name_original: item.name || item.title,
          description: item.deck || item.synopsis || null,
          year: item.releaseDate ? parseInt(item.releaseDate, 10) : null,
          image: imageUrl,
          thumbnail: thumbnailUrl,
          src_url: item.url || `https://comicvine.gamespot.com/volume/${item.id}/`,
          publisher: item.editors?.[0] || null,
          startYear: item.releaseDate,
          detailUrl: generateDetailUrl('comicvine', item.id, type)
        };
      });
      
      return { results: items, total: rawResult.total || items.length };
    },
    { params: { type, max: effectiveMax }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'comicvine',
    query: q,
    total: result.total,
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
    result = await getComicVineIssueNormalized(parseInt(cleanId, 10), req.apiKey, { lang, autoTrad });
  } else {
    result = await getComicVineVolumeNormalized(parseInt(cleanId, 10), req.apiKey, { lang, autoTrad });
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
// MangaDex Router (avec cache PostgreSQL)
// ============================================================================
const mangadexRouter = Router();

// Cache provider pour MangaDex
const mangadexCache = createProviderCache('mangadex', 'manga');

// Normalisé: /mangadex/search (avec cache PostgreSQL)
mangadexRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  const effectiveMax = Math.min(Math.max(1, max), MANGADEX_MAX_LIMIT);

  const result = await mangadexCache.searchWithCache(
    q,
    async () => {
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
      
      return { results: items, total: rawResult.total || items.length };
    },
    { params: { lang, max: effectiveMax }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'mangadex',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Normalisé: /mangadex/details (avec cache PostgreSQL + X-Cache header)
mangadexRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';
  
  const cleanId = cleanSourceId(id, 'mangadex');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un UUID" });
  }

  // Utilise le cache PostgreSQL
  const result = await mangadexCache.getWithCache(
    cleanId,
    () => getMangaDexByIdNormalized(cleanId, { lang, autoTrad }),
    { forceRefresh }
  );
  
  if (!result) return res.status(404).json({ error: `Manga ${cleanId} non trouvé` });
  
  // Ajouter headers avec info de cache
  const cacheInfo = getCacheInfo();
  log.debug('getCacheInfo result:', cacheInfo);
  addCacheHeaders(res, 3600, cacheInfo);
  res.json(formatDetailResponse({ data: result, provider: 'mangadex', id: cleanId, meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
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
// Bedetheque Router (scraping + cache PostgreSQL)
// ============================================================================
const bedethequeRouter = Router();

// Cache provider pour Bedetheque
const bedethequeCache = createProviderCache('bedetheque', 'book');

// Normalisé: /bedetheque/search (avec cache PostgreSQL)
bedethequeRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  const type = req.query.type || 'album';  // Par défaut: albums (pas séries)
  const effectiveMax = Math.min(Math.max(1, max), 50);

  const result = await bedethequeCache.searchWithCache(
    q,
    async () => {
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
      
      return { results: items, total: rawResult.total || items.length };
    },
    { params: { type, max: effectiveMax }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 600, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'bedetheque',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad, type }
  }));
}));

// Normalisé: /bedetheque/details (avec cache PostgreSQL)
bedethequeRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id, type } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';
  
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "Format d'ID invalide" });

  const numericId = parseInt(id, 10);
  let result;
  
  if (type === 'album') {
    // Utilise le cache pour les albums
    result = await bedethequeCache.getWithCache(
      `album_${id}`,
      () => getBedethequeAlbumByIdNormalized(numericId),
      { type: 'book', forceRefresh }
    );
    if (!result || !result.name) return res.status(404).json({ error: `Album ${id} non trouvé` });
  } else {
    // Utilise le cache pour les séries
    result = await bedethequeCache.getWithCache(
      `serie_${id}`,
      () => getBedethequeSerieByIdNormalized(numericId),
      { type: 'book_series', forceRefresh }
    );
    if (!result || !result.name) return res.status(404).json({ error: `Série ${id} non trouvée` });
  }
  
  addCacheHeaders(res, 3600, getCacheInfo());
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
