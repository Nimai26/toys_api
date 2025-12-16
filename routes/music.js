/**
 * Routes Music - toys_api
 * Endpoints pour la recherche de musique (MusicBrainz, Deezer, Discogs, iTunes)
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { getCached, setCache, addCacheHeaders, asyncHandler } from '../lib/utils/index.js';
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
// MUSIC ENDPOINTS
// ============================================================================

/**
 * Recherche d'albums de musique (multi-sources)
 */
router.get("/search", asyncHandler(async (req, res) => {
  const { q, source = 'deezer', type = 'album' } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit) || MUSIC_DEFAULT_MAX, 1), 100);
  const langParam = req.query.lang || req.query.country || 'FR';
  const country = langParam.includes('-') ? langParam.split('-')[1].toUpperCase() : langParam.toUpperCase();
  const discogsToken = req.query.discogsToken || req.headers['x-discogs-token'];
  
  if (!q) {
    return res.status(400).json({ error: "paramètre 'q' manquant" });
  }
  
  const cacheKey = `music:search:${source}:${type}:${q}:${limit}:${country}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  let result;
  
  switch (source.toLowerCase()) {
    case 'musicbrainz':
    case 'mb':
      metrics.sources.musicbrainz.requests++;
      result = await searchMusicBrainzLib(q, { limit, type: type === 'album' ? 'release-group' : type });
      break;
      
    case 'discogs':
      metrics.sources.discogs.requests++;
      const discogsType = type === 'album' ? 'release' : type;
      result = await searchDiscogsLib(q, { limit, type: discogsType, token: discogsToken });
      break;
      
    case 'itunes':
      const itunesEntity = type === 'album' ? 'album' : type === 'artist' ? 'musicArtist' : 'song';
      result = await searchItunesLib(q, { limit, entity: itunesEntity, country });
      break;
      
    case 'all':
      const limitPerSource = Math.min(limit, 10);
      const [deezerRes, mbRes, itunesRes] = await Promise.allSettled([
        searchDeezerLib(q, { limit: limitPerSource, type }),
        searchMusicBrainzLib(q, { limit: limitPerSource }),
        searchItunesLib(q, { limit: limitPerSource, entity: type === 'album' ? 'album' : 'song', country })
      ]);
      
      metrics.sources.deezer.requests++;
      metrics.sources.musicbrainz.requests++;
      
      result = {
        query: q,
        type,
        lang: country,
        sources: {
          deezer: deezerRes.status === 'fulfilled' ? deezerRes.value : { error: deezerRes.reason?.message },
          musicbrainz: mbRes.status === 'fulfilled' ? mbRes.value : { error: mbRes.reason?.message },
          itunes: itunesRes.status === 'fulfilled' ? itunesRes.value : { error: itunesRes.reason?.message }
        }
      };
      break;
      
    case 'deezer':
    default:
      metrics.sources.deezer.requests++;
      result = await searchDeezerLib(q, { limit, type });
      break;
  }
  
  setCache(cacheKey, result);
  addCacheHeaders(res, 300);
  res.json(result);
}));

/**
 * Détails d'un album (Deezer ou MusicBrainz)
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
    metrics.sources.musicbrainz.requests++;
    result = await getMusicBrainzAlbumLib(id);
  } else {
    metrics.sources.deezer.requests++;
    result = await getDeezerAlbumLib(id);
  }
  
  setCache(cacheKey, result);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

/**
 * Détails d'un artiste (Deezer)
 */
router.get("/artist/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const cacheKey = `music:artist:${id}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  metrics.sources.deezer.requests++;
  const result = await getDeezerArtistLib(id);
  
  setCache(cacheKey, result);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

/**
 * Détails d'un release Discogs
 */
router.get("/discogs/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const token = req.query.token || req.headers['x-discogs-token'];
  
  const cacheKey = `music:discogs:${id}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  metrics.sources.discogs.requests++;
  const result = await getDiscogsReleaseLib(id, token);
  
  setCache(cacheKey, result);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

/**
 * Recherche d'album par code-barres
 */
router.get("/barcode/:code", asyncHandler(async (req, res) => {
  const { code } = req.params;
  const source = req.query.source || 'all';
  const discogsToken = req.query.discogsToken || req.headers['x-discogs-token'];
  
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
      metrics.sources.musicbrainz.requests++;
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
      metrics.sources.discogs.requests++;
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
