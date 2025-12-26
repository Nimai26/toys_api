// routes/media.js - Endpoints TVDB, TMDB et IMDB (toys_api v3.0.0)
import { Router } from 'express';
import {
  searchTvdb,
  getTvdbSeriesByIdNormalized,
  getTvdbMovieByIdNormalized
} from '../lib/providers/tvdb.js';
import {
  searchTmdb,
  getTmdbMovieByIdNormalized,
  getTmdbTvByIdNormalized
} from '../lib/providers/tmdb.js';
import {
  searchImdb,
  getImdbMovieByIdNormalized,
  getImdbSeriesByIdNormalized,
  browseImdbTitles
} from '../lib/providers/imdb.js';
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
import { TVDB_DEFAULT_MAX, TMDB_DEFAULT_MAX, IMDB_DEFAULT_MAX } from '../lib/config.js';
import { createProviderCache, getCacheInfo } from '../lib/database/index.js';

// Cache providers pour media
const tvdbCache = createProviderCache('tvdb', 'series');
const tmdbCache = createProviderCache('tmdb', 'movie');
const imdbCache = createProviderCache('imdb', 'movie');

// ============================================================================
// TVDB Router
// ============================================================================
const tvdbRouter = Router();
const tvdbAuth = requireApiKey('TVDB', 'https://thetvdb.com/api-information');

// Normalisé: /tvdb/search (avec cache PostgreSQL)
tvdbRouter.get("/search", validateSearchParams, tvdbAuth, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  const type = req.query.type || null;
  const year = req.query.year ? parseInt(req.query.year, 10) : null;

  const result = await tvdbCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchTvdb(q, req.apiKey, { max, type, lang, year });
      
      const items = (rawResult.results || rawResult.data || []).map(item => ({
        type: item.type === 'movie' ? 'movie' : 'series',
        source: 'tvdb',
        sourceId: item.tvdb_id || item.id,
        name: item.name || item.title,
        name_original: item.name_original || item.name,
        description: item.overview || item.description || null,
        year: item.year || (item.first_aired ? parseInt(item.first_aired.substring(0, 4), 10) : null),
        image: item.image || item.thumbnail,
        src_url: `https://thetvdb.com/${item.type === 'movie' ? 'movies' : 'series'}/${item.slug || item.tvdb_id || item.id}`,
        detailUrl: generateDetailUrl('tvdb', item.tvdb_id || item.id, item.type === 'movie' ? 'movie' : 'series')
      }));
      
      return { results: items, total: rawResult.total || items.length };
    },
    { params: { max, type, lang, year } }
  );
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: result.results || [],
    provider: 'tvdb',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /tvdb/details (avec cache PostgreSQL)
tvdbRouter.get("/details", validateDetailsParams, tvdbAuth, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id, type } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';
  
  const cacheType = type === 'movie' ? 'movie' : 'series';
  
  // Utilise le cache PostgreSQL
  const result = await tvdbCache.getWithCache(
    `${type}_${id}`,
    () => type === 'movie' 
      ? getTvdbMovieByIdNormalized(id, req.apiKey, { lang, autoTrad })
      : getTvdbSeriesByIdNormalized(id, req.apiKey, { lang, autoTrad }),
    { type: cacheType, forceRefresh }
  );
  
  if (!result) {
    return res.status(404).json({ error: `${type} ${id} non trouvé` });
  }
  
  addCacheHeaders(res, 3600, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'tvdb', id, meta: { lang, locale, autoTrad } }));
}));

// Legacy
tvdbRouter.get("/series/:id", tvdbAuth, asyncHandler(async (req, res) => {
  const seriesId = req.params.id;
  const params = extractStandardParams(req);
  const autoTrad = isAutoTradEnabled(req);
  if (!seriesId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  const result = await getTvdbSeriesById(seriesId, req.apiKey, { lang: params.lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

tvdbRouter.get("/movie/:id", tvdbAuth, asyncHandler(async (req, res) => {
  const movieId = req.params.id;
  const params = extractStandardParams(req);
  const autoTrad = isAutoTradEnabled(req);
  if (!movieId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  const result = await getTvdbMovieById(movieId, req.apiKey, { lang: params.lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// TMDB Router
// ============================================================================
const tmdbRouter = Router();
const tmdbAuth = requireApiKey('TMDB', 'https://www.themoviedb.org/settings/api');

// Normalisé: /tmdb/search (avec cache PostgreSQL)
tmdbRouter.get("/search", validateSearchParams, tmdbAuth, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, page, autoTrad } = req.standardParams;
  const type = req.query.type || null;
  const year = req.query.year ? parseInt(req.query.year, 10) : null;
  const includeAdult = req.query.adult === 'true';

  const result = await tmdbCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchTmdb(q, req.apiKey, { max, type, lang: locale, page, year, includeAdult });
      
      const items = (rawResult.results || []).map(item => ({
        type: item.media_type === 'movie' ? 'movie' : 'series',
        source: 'tmdb',
        sourceId: item.id,
        name: item.title || item.name,
        name_original: item.original_title || item.original_name,
        description: item.overview || null,
        year: item.release_date ? parseInt(item.release_date.substring(0, 4), 10) : (item.first_air_date ? parseInt(item.first_air_date.substring(0, 4), 10) : null),
        image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        src_url: `https://www.themoviedb.org/${item.media_type === 'movie' ? 'movie' : 'tv'}/${item.id}`,
        detailUrl: generateDetailUrl('tmdb', item.id, item.media_type === 'movie' ? 'movie' : 'tv')
      }));
      
      return { 
        results: items, 
        total: rawResult.total_results,
        totalPages: rawResult.total_pages
      };
    },
    { params: { max, type, locale, page, year, includeAdult } }
  );
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: result.results || [],
    provider: 'tmdb',
    query: q,
    pagination: { page, totalResults: result.total, totalPages: result.totalPages },
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /tmdb/details (avec cache PostgreSQL)
tmdbRouter.get("/details", validateDetailsParams, tmdbAuth, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id, type } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';
  
  const cacheType = type === 'movie' ? 'movie' : 'series';
  
  // Utilise le cache PostgreSQL
  const result = await tmdbCache.getWithCache(
    `${type}_${id}`,
    () => type === 'movie'
      ? getTmdbMovieByIdNormalized(id, req.apiKey, { lang: locale, autoTrad })
      : getTmdbTvByIdNormalized(id, req.apiKey, { lang: locale, autoTrad }),
    { type: cacheType, forceRefresh }
  );
  
  if (!result) {
    return res.status(404).json({ error: `${type} ${id} non trouvé` });
  }
  
  addCacheHeaders(res, 3600, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'tmdb', id, meta: { lang, locale, autoTrad } }));
}));

// Legacy
tmdbRouter.get("/movie/:id", tmdbAuth, asyncHandler(async (req, res) => {
  const movieId = req.params.id;
  const params = extractStandardParams(req);
  const autoTrad = isAutoTradEnabled(req);
  if (!movieId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  const result = await getTmdbMovieById(movieId, req.apiKey, { lang: params.locale, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

tmdbRouter.get("/tv/:id", tmdbAuth, asyncHandler(async (req, res) => {
  const tvId = req.params.id;
  const params = extractStandardParams(req);
  const autoTrad = isAutoTradEnabled(req);
  if (!tvId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  const result = await getTmdbTvById(tvId, req.apiKey, { lang: params.locale, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// IMDB Router (NO API KEY - scraping)
// ============================================================================
const imdbRouter = Router();

// Normalisé: /imdb/search (avec cache PostgreSQL)
imdbRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, max, lang, locale, autoTrad } = req.standardParams;

  const result = await imdbCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchImdb(q, { max });
      
      const items = (rawResult.results || []).map(item => ({
        type: item.type === 'TV Series' ? 'series' : 'movie',
        source: 'imdb',
        sourceId: item.id,
        name: item.title,
        name_original: item.originalTitle || item.title,
        description: item.description || item.plot || null,
        year: item.year || null,
        image: item.image || item.poster || null,
        src_url: `https://www.imdb.com/title/${item.id}/`,
        detailUrl: generateDetailUrl('imdb', item.id, 'title')
      }));
      
      return { results: items, total: items.length };
    },
    { params: { max } }
  );
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: result.results || [],
    provider: 'imdb',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /imdb/details (avec cache PostgreSQL)
imdbRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id, type } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';
  
  if (!/^tt\d{7,}$/.test(id)) {
    return res.status(400).json({ error: "Format d'ID IMDB invalide", hint: "Format: tt suivi d'au moins 7 chiffres" });
  }
  
  const cacheType = type === 'series' ? 'series' : 'movie';
  
  // Utilise le cache PostgreSQL
  const result = await imdbCache.getWithCache(
    id,
    () => type === 'series'
      ? getImdbSeriesByIdNormalized(id, { lang, autoTrad })
      : getImdbMovieByIdNormalized(id, { lang, autoTrad }),
    { type: cacheType, forceRefresh }
  );
  
  if (!result) {
    return res.status(404).json({ error: `Titre IMDB ${id} non trouvé` });
  }
  
  addCacheHeaders(res, 3600, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'imdb', id, meta: { lang, locale, autoTrad } }));
}));

// Legacy
imdbRouter.get("/title/:id", asyncHandler(async (req, res) => {
  const titleId = req.params.id;
  const params = extractStandardParams(req);
  const autoTrad = isAutoTradEnabled(req.query);
  
  if (!titleId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  if (!/^tt\d{7,}$/.test(titleId)) {
    return res.status(400).json({ error: "Format d'ID IMDB invalide" });
  }
  const result = await getImdbTitleById(titleId, { lang: params.lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

imdbRouter.get("/browse", asyncHandler(async (req, res) => {
  const types = req.query.types ? req.query.types.split(',').map(t => t.trim().toUpperCase()) : [];
  const genres = req.query.genres ? req.query.genres.split(',').map(g => g.trim()) : [];
  const startYear = req.query.startYear ? parseInt(req.query.startYear, 10) : null;
  const endYear = req.query.endYear ? parseInt(req.query.endYear, 10) : null;
  const minRating = req.query.minRating ? parseFloat(req.query.minRating) : null;
  const maxRating = req.query.maxRating ? parseFloat(req.query.maxRating) : null;
  const sortBy = req.query.sortBy || 'SORT_BY_POPULARITY';
  const sortOrder = req.query.sortOrder || 'DESC';
  const pageToken = req.query.pageToken || null;
  const limit = req.query.max ? parseInt(req.query.max, 10) : IMDB_DEFAULT_MAX;

  const validTypes = ['MOVIE', 'TV_SERIES', 'TV_MINI_SERIES', 'TV_SPECIAL', 'TV_MOVIE', 'SHORT', 'VIDEO', 'VIDEO_GAME'];
  const invalidTypes = types.filter(t => !validTypes.includes(t));
  if (invalidTypes.length > 0) {
    return res.status(400).json({ error: `Types invalides: ${invalidTypes.join(', ')}`, validTypes });
  }

  const validSortBy = ['SORT_BY_POPULARITY', 'SORT_BY_RELEASE_DATE', 'SORT_BY_USER_RATING', 'SORT_BY_USER_RATING_COUNT', 'SORT_BY_YEAR'];
  if (!validSortBy.includes(sortBy)) {
    return res.status(400).json({ error: `sortBy invalide: ${sortBy}`, validValues: validSortBy });
  }

  if (sortOrder !== 'ASC' && sortOrder !== 'DESC') {
    return res.status(400).json({ error: `sortOrder invalide: ${sortOrder}`, validValues: ['ASC', 'DESC'] });
  }

  const result = await browseImdbTitles({ types, genres, startYear, endYear, minRating, maxRating, sortBy, sortOrder, pageToken, limit });
  addCacheHeaders(res, 300);
  res.json(result);
}));

export { tvdbRouter, tmdbRouter, imdbRouter };
