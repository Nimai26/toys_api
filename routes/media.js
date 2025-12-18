// routes/media.js - Endpoints TVDB, TMDB et IMDB (toys_api v3.0.0)
import { Router } from 'express';
import {
  searchTvdb,
  getTvdbSeriesById,
  getTvdbMovieById
} from '../lib/providers/tvdb.js';
import {
  searchTmdb,
  getTmdbMovieById,
  getTmdbTvById
} from '../lib/providers/tmdb.js';
import {
  searchImdb,
  getImdbTitleById,
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

// ============================================================================
// TVDB Router
// ============================================================================
const tvdbRouter = Router();
const tvdbAuth = requireApiKey('TVDB', 'https://thetvdb.com/api-information');

// Normalisé: /tvdb/search
tvdbRouter.get("/search", validateSearchParams, tvdbAuth, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  const type = req.query.type || null;
  const year = req.query.year ? parseInt(req.query.year, 10) : null;

  const rawResult = await searchTvdb(q, req.apiKey, { max, type, lang, year });
  
  const items = (rawResult.results || rawResult.data || []).map(item => ({
    type: item.type === 'movie' ? 'movie' : 'series',
    source: 'tvdb',
    sourceId: item.tvdb_id || item.id,
    name: item.name || item.title,
    name_original: item.name_original || item.name,
    image: item.image || item.thumbnail,
    detailUrl: generateDetailUrl('tvdb', item.tvdb_id || item.id, item.type === 'movie' ? 'movie' : 'series')
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'tvdb',
    query: q,
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /tvdb/details
tvdbRouter.get("/details", validateDetailsParams, tvdbAuth, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id, type } = req.parsedDetailUrl;
  
  let result;
  if (type === 'movie') {
    result = await getTvdbMovieById(id, req.apiKey, { lang, autoTrad });
  } else {
    result = await getTvdbSeriesById(id, req.apiKey, { lang, autoTrad });
  }
  
  addCacheHeaders(res, 3600);
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

// Normalisé: /tmdb/search
tmdbRouter.get("/search", validateSearchParams, tmdbAuth, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, page, autoTrad } = req.standardParams;
  const type = req.query.type || null;
  const year = req.query.year ? parseInt(req.query.year, 10) : null;
  const includeAdult = req.query.adult === 'true';

  const rawResult = await searchTmdb(q, req.apiKey, { max, type, lang: locale, page, year, includeAdult });
  
  const items = (rawResult.results || []).map(item => ({
    type: item.media_type === 'movie' ? 'movie' : 'series',
    source: 'tmdb',
    sourceId: item.id,
    name: item.title || item.name,
    name_original: item.original_title || item.original_name,
    image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    detailUrl: generateDetailUrl('tmdb', item.id, item.media_type === 'movie' ? 'movie' : 'tv')
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'tmdb',
    query: q,
    pagination: { page, totalResults: rawResult.total_results, totalPages: rawResult.total_pages },
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /tmdb/details
tmdbRouter.get("/details", validateDetailsParams, tmdbAuth, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id, type } = req.parsedDetailUrl;
  
  let result;
  if (type === 'movie') {
    result = await getTmdbMovieById(id, req.apiKey, { lang: locale, autoTrad });
  } else {
    result = await getTmdbTvById(id, req.apiKey, { lang: locale, autoTrad });
  }
  
  addCacheHeaders(res, 3600);
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

// Normalisé: /imdb/search
imdbRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, max, lang, locale, autoTrad } = req.standardParams;

  const rawResult = await searchImdb(q, { max });
  
  const items = (rawResult.results || []).map(item => ({
    type: item.type === 'TV Series' ? 'series' : 'movie',
    source: 'imdb',
    sourceId: item.id,
    name: item.title,
    name_original: item.originalTitle || item.title,
    image: item.image,
    detailUrl: generateDetailUrl('imdb', item.id, 'title')
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'imdb',
    query: q,
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /imdb/details
imdbRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  
  if (!/^tt\d{7,}$/.test(id)) {
    return res.status(400).json({ error: "Format d'ID IMDB invalide", hint: "Format: tt suivi d'au moins 7 chiffres" });
  }
  
  const result = await getImdbTitleById(id, { lang, autoTrad });
  addCacheHeaders(res, 3600);
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
