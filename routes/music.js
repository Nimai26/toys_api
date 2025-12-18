/**
 * Routes Music - toys_api v3.0.0
 * Endpoints pour la recherche de musique (MusicBrainz, Deezer, Discogs, iTunes)
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { 
  getCached, 
  setCache, 
  addCacheHeaders, 
  asyncHandler,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams,
  validateCodeParams,
  generateDetailUrl,
  formatSearchResponse,
  formatDetailResponse,
  metrics
} from '../lib/utils/index.js';
import { MUSIC_DEFAULT_MAX } from '../lib/config.js';

import {
  searchMusicBrainz as searchMusicBrainzLib,
  getMusicBrainzAlbum as getMusicBrainzAlbumLib,
  searchMusicBrainzByBarcode as searchMusicBrainzByBarcodeLib
} from '../lib/providers/musicbrainz.js';
import {
  searchDeezer as searchDeezerLib,
  getDeezerAlbum as getDeezerAlbumLib,
  getDeezerArtist as getDeezerArtistLib
} from '../lib/providers/deezer.js';
import {
  searchDiscogs as searchDiscogsLib,
  getDiscogsRelease as getDiscogsReleaseLib,
  searchDiscogsByBarcode as searchDiscogsByBarcodeLib
} from '../lib/providers/discogs.js';
import {
  searchItunes as searchItunesLib
} from '../lib/providers/itunes.js';

const router = Router();
const log = createLogger('Route:Music');

// ============================================================================
// ENDPOINTS NORMALISÉS
// ============================================================================

// Normalisé: /music/search
router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  const source = req.query.source || 'deezer';
  const type = req.query.type || 'album';
  const country = locale ? locale.split('-')[1]?.toUpperCase() || 'FR' : 'FR';
  // Token Discogs: query param > header > variable d'environnement
  const discogsToken = req.query.discogsToken || req.headers['x-discogs-token'] || process.env.DISCOGS_TOKEN;
  
  const cacheKey = `music:search:${source}:${type}:${q}:${max}:${country}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  let rawResult;
  let provider = source;
  
  switch (source.toLowerCase()) {
    case 'musicbrainz':
    case 'mb':
      provider = 'musicbrainz';
      rawResult = await searchMusicBrainzLib(q, { limit: max, type: type === 'album' ? 'release-group' : type });
      break;
      
    case 'discogs':
      provider = 'discogs';
      const discogsType = type === 'album' ? 'release' : type;
      rawResult = await searchDiscogsLib(q, { limit: max, type: discogsType, token: discogsToken });
      break;
      
    case 'itunes':
      provider = 'itunes';
      const itunesEntity = type === 'album' ? 'album' : type === 'artist' ? 'musicArtist' : 'song';
      rawResult = await searchItunesLib(q, { limit: max, entity: itunesEntity, country });
      break;
      
    case 'deezer':
    default:
      provider = 'deezer';
      rawResult = await searchDeezerLib(q, { limit: max, type });
      break;
  }
  
  const items = (rawResult.results || rawResult.albums || rawResult.data || []).map(item => ({
    type: type,
    source: provider,
    sourceId: item.id || item.mbid,
    name: item.title || item.name || item.collectionName,
    name_original: item.title || item.name,
    image: item.cover || item.artworkUrl100 || item.thumb,
    artist: item.artist || item.artistName,
    detailUrl: generateDetailUrl(provider, item.id || item.mbid, type)
  }));
  
  const response = formatSearchResponse({
    items,
    provider,
    query: q,
    meta: { lang, locale, autoTrad, type, country }
  });
  
  setCache(cacheKey, response);
  addCacheHeaders(res, 300);
  res.json(response);
}));

// Normalisé: /music/details
router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id, type, provider } = req.parsedDetailUrl;
  
  const cacheKey = `music:details:${provider}:${type}:${id}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  let result;
  
  if (provider === 'musicbrainz' || provider === 'mb') {
    result = await getMusicBrainzAlbumLib(id);
  } else if (provider === 'discogs') {
    const token = req.query.token || req.headers['x-discogs-token'];
    result = await getDiscogsReleaseLib(id, token);
  } else {
    result = await getDeezerAlbumLib(id);
  }
  
  const response = formatDetailResponse({ data: result, provider, id, meta: { lang, locale, autoTrad } });
  
  setCache(cacheKey, response);
  addCacheHeaders(res, 3600);
  res.json(response);
}));

// Normalisé: /music/code (barcode)
router.get("/code", validateCodeParams, asyncHandler(async (req, res) => {
  const { code, lang, locale, autoTrad } = req.standardParams;
  const source = req.query.source || 'all';
  // Token Discogs: query param > header > variable d'environnement
  const discogsToken = req.query.discogsToken || req.headers['x-discogs-token'] || process.env.DISCOGS_TOKEN;
  
  if (code.length < 8) {
    return res.status(400).json({ error: "Code-barres invalide" });
  }
  
  const cacheKey = `music:barcode:${code}:${source}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  let result = { barcode: code, found: false, sources: [] };
  
  if (source === 'all' || source === 'musicbrainz' || source === 'mb') {
    try {
      const mbResult = await searchMusicBrainzByBarcodeLib(code);
      if (mbResult.found) {
        result.found = true;
        result.musicbrainz = mbResult;
        result.sources.push('musicbrainz');
        result.title = mbResult.title;
        result.artist = mbResult.artist;
        result.date = mbResult.date;
        result.coverUrl = mbResult.coverUrl;
      }
    } catch (err) {
      log.error('[Music] MusicBrainz barcode error:', err.message);
    }
  }
  
  if (source === 'all' || source === 'discogs') {
    try {
      const discogsResult = await searchDiscogsByBarcodeLib(code, discogsToken);
      if (discogsResult.found) {
        result.found = true;
        result.discogs = discogsResult;
        result.sources.push('discogs');
        if (!result.title) result.title = discogsResult.albumTitle;
        if (!result.artist) result.artist = discogsResult.artist;
        if (!result.coverUrl) result.coverUrl = discogsResult.coverUrl;
      }
    } catch (err) {
      log.error('[Music] Discogs barcode error:', err.message);
    }
  }
  
  const response = formatDetailResponse({ 
    data: result, 
    provider: 'music', 
    id: code, 
    meta: { lang, locale, autoTrad, type: 'barcode' }
  });
  
  setCache(cacheKey, response);
  addCacheHeaders(res, 3600);
  res.json(response);
}));

// ============================================================================
// ENDPOINTS LEGACY
// ============================================================================

/**
 * Détails d'un album (Deezer ou MusicBrainz) - Legacy
 */
router.get("/album/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const source = req.query.source || 'deezer';
  
  const cacheKey = `music:album:${source}:${id}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  let result;
  
  if (source === 'musicbrainz' || source === 'mb') {
    result = await getMusicBrainzAlbumLib(id);
  } else {
    result = await getDeezerAlbumLib(id);
  }
  
  setCache(cacheKey, result);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

/**
 * Détails d'un artiste (Deezer) - Legacy
 */
router.get("/artist/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const cacheKey = `music:artist:${id}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  const result = await getDeezerArtistLib(id);
  
  setCache(cacheKey, result);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

/**
 * Détails d'un release Discogs - Legacy
 */
router.get("/discogs/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const token = req.query.token || req.headers['x-discogs-token'];
  
  const cacheKey = `music:discogs:${id}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  const result = await getDiscogsReleaseLib(id, token);
  
  setCache(cacheKey, result);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

/**
 * Recherche d'album par code-barres - Legacy
 */
router.get("/barcode/:code", asyncHandler(async (req, res) => {
  const { code } = req.params;
  const source = req.query.source || 'all';
  // Token Discogs: query param > header > variable d'environnement
  const discogsToken = req.query.discogsToken || req.headers['x-discogs-token'] || process.env.DISCOGS_TOKEN;
  
  if (!code || code.length < 8) {
    return res.status(400).json({ error: "Code-barres invalide" });
  }
  
  const cacheKey = `music:barcode:${code}:${source}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  let result = { barcode: code, found: false, sources: [] };
  
  if (source === 'all' || source === 'musicbrainz' || source === 'mb') {
    try {
      const mbResult = await searchMusicBrainzByBarcodeLib(code);
      if (mbResult.found) {
        result.found = true;
        result.musicbrainz = mbResult;
        result.sources.push('musicbrainz');
        result.title = mbResult.title;
        result.artist = mbResult.artist;
        result.date = mbResult.date;
        result.coverUrl = mbResult.coverUrl;
      }
    } catch (err) {
      log.error('[Music] MusicBrainz barcode error:', err.message);
    }
  }
  
  if (source === 'all' || source === 'discogs') {
    try {
      const discogsResult = await searchDiscogsByBarcodeLib(code, discogsToken);
      if (discogsResult.found) {
        result.found = true;
        result.discogs = discogsResult;
        result.sources.push('discogs');
        if (!result.title) result.title = discogsResult.albumTitle;
        if (!result.artist) result.artist = discogsResult.artist;
        if (!result.coverUrl) result.coverUrl = discogsResult.coverUrl;
      }
    } catch (err) {
      log.error('[Music] Discogs barcode error:', err.message);
    }
  }
  
  setCache(cacheKey, result);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

export default router;
