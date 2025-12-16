// routes/media.js - Endpoints TVDB, TMDB et IMDB (toys_api v2.0.0)
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
import { addCacheHeaders, asyncHandler, requireParam, requireApiKey } from '../lib/utils/index.js';
import { TVDB_DEFAULT_MAX, TMDB_DEFAULT_MAX, IMDB_DEFAULT_MAX } from '../lib/config.js';

// ============================================================================
// TVDB Router
// ============================================================================
const tvdbRouter = Router();
const tvdbAuth = requireApiKey('TVDB', 'https://thetvdb.com/api-information');

tvdbRouter.get("/search", requireParam('q'), tvdbAuth, asyncHandler(async (req, res) => {
  const query = req.query.q;
  const type = req.query.type || null;
  const max = req.query.max ? parseInt(req.query.max, 10) : TVDB_DEFAULT_MAX;
  const lang = req.query.lang || null;
  const year = req.query.year ? parseInt(req.query.year, 10) : null;

  const result = await searchTvdb(query, req.apiKey, { max, type, lang, year });
  addCacheHeaders(res, 300);
  res.json(result);
}));

tvdbRouter.get("/series/:id", tvdbAuth, asyncHandler(async (req, res) => {
  const seriesId = req.params.id;
  const lang = req.query.lang || null;
  if (!seriesId) return res.status(400).json({ error: "paramètre 'id' manquant" });

  const result = await getTvdbSeriesById(seriesId, req.apiKey, lang);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

tvdbRouter.get("/movie/:id", tvdbAuth, asyncHandler(async (req, res) => {
  const movieId = req.params.id;
  const lang = req.query.lang || null;
  if (!movieId) return res.status(400).json({ error: "paramètre 'id' manquant" });

  const result = await getTvdbMovieById(movieId, req.apiKey, lang);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// TMDB Router
// ============================================================================
const tmdbRouter = Router();
const tmdbAuth = requireApiKey('TMDB', 'https://www.themoviedb.org/settings/api');

tmdbRouter.get("/search", requireParam('q'), tmdbAuth, asyncHandler(async (req, res) => {
  const query = req.query.q;
  const type = req.query.type || null;
  const max = req.query.max ? parseInt(req.query.max, 10) : TMDB_DEFAULT_MAX;
  const lang = req.query.lang || 'fr-FR';
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const year = req.query.year ? parseInt(req.query.year, 10) : null;
  const includeAdult = req.query.adult === 'true';

  const result = await searchTmdb(query, req.apiKey, { max, type, lang, page, year, includeAdult });
  addCacheHeaders(res, 300);
  res.json(result);
}));

tmdbRouter.get("/movie/:id", tmdbAuth, asyncHandler(async (req, res) => {
  const movieId = req.params.id;
  const lang = req.query.lang || 'fr-FR';
  if (!movieId) return res.status(400).json({ error: "paramètre 'id' manquant" });

  const result = await getTmdbMovieById(movieId, req.apiKey, lang);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

tmdbRouter.get("/tv/:id", tmdbAuth, asyncHandler(async (req, res) => {
  const tvId = req.params.id;
  const lang = req.query.lang || 'fr-FR';
  if (!tvId) return res.status(400).json({ error: "paramètre 'id' manquant" });

  const result = await getTmdbTvById(tvId, req.apiKey, lang);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// IMDB Router (NO API KEY - scraping)
// ============================================================================
const imdbRouter = Router();

imdbRouter.get("/search", requireParam('q'), asyncHandler(async (req, res) => {
  const query = req.query.q;
  const max = req.query.max ? parseInt(req.query.max, 10) : IMDB_DEFAULT_MAX;

  const result = await searchImdb(query, { max });
  addCacheHeaders(res, 300);
  res.json(result);
}));

imdbRouter.get("/title/:id", asyncHandler(async (req, res) => {
  const titleId = req.params.id;
  if (!titleId) return res.status(400).json({ error: "paramètre 'id' manquant" });

  if (!/^tt\d{7,}$/.test(titleId)) {
    return res.status(400).json({ 
      error: "Format d'ID IMDB invalide",
      hint: "L'ID doit être au format 'tt' suivi d'au moins 7 chiffres (ex: tt1375666)"
    });
  }

  const result = await getImdbTitleById(titleId);
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
