// routes/authors.js - Endpoints de recherche par auteur (toys_api v4.1.0)
import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import {
  searchGoogleBooksByAuthor
} from '../lib/providers/googlebooks.js';
import {
  searchOpenLibraryByAuthor
} from '../lib/providers/openlibrary.js';
import {
  searchBedethequeByAuthor
} from '../lib/providers/bedetheque.js';
import {
  searchMangaDexByAuthor
} from '../lib/providers/mangadex.js';
import { 
  addCacheHeaders, 
  asyncHandler, 
  requireApiKey,
  generateDetailUrl,
  formatSearchResponse,
  translateSearchDescriptions
} from '../lib/utils/index.js';
import { createProviderCache, getCacheInfo } from '../lib/database/cache-wrapper.js';
import { GOOGLE_BOOKS_DEFAULT_MAX, OPENLIBRARY_DEFAULT_MAX, BEDETHEQUE_DEFAULT_MAX, MANGADEX_DEFAULT_MAX } from '../lib/config.js';

const log = createLogger('Route:Authors');
const router = Router();

// Cache providers
const googleBooksCache = createProviderCache('googlebooks', 'book');
const openLibraryCache = createProviderCache('openlibrary', 'book');
const bedethequeCache = createProviderCache('bedetheque', 'album');
const mangadexCache = createProviderCache('mangadex', 'manga');

const googleAuth = requireApiKey('Google Books', 'https://console.cloud.google.com/apis/credentials');

// Middleware pour extraire les paramètres standards pour les routes d'auteur
const extractAuthorParams = (req, res, next) => {
  const lang = req.query.lang || null;
  const locale = req.query.locale || null;
  const max = parseInt(req.query.max) || 20;
  const autoTrad = req.query.autoTrad === 'true' || req.query.auto_trad === 'true';
  const refresh = req.query.refresh === 'true';
  
  req.standardParams = { lang, locale, max, autoTrad, refresh };
  next();
};

// ============================================================================
// GOOGLE BOOKS - Recherche par auteur
// ============================================================================
router.get("/googlebooks/:author", extractAuthorParams, googleAuth, asyncHandler(async (req, res) => {
  const { author } = req.params;
  const { lang, locale, max, autoTrad, refresh } = req.standardParams;
  
  if (!author || author.trim().length < 2) {
    return res.status(400).json({ 
      error: 'Author name must be at least 2 characters' 
    });
  }
  
  log.info(`Google Books author search: ${author}`);
  
  const result = await googleBooksCache.searchWithCache(
    `author:${author}`,
    async () => {
      const rawResult = await searchGoogleBooksByAuthor(author, req.apiKey, { lang, maxResults: max });
      
      const items = (rawResult.books || []).map(book => ({
        type: 'book',
        source: 'googlebooks',
        sourceId: book.id,
        name: book.title,
        name_original: book.originalTitle || book.title,
        description: book.synopsis || book.description || null,
        synopsis: book.synopsis || book.description || null,
        year: book.releaseDate ? parseInt(book.releaseDate.substring(0, 4), 10) : null,
        image: book.image || [],
        thumbnail: book.image?.[0] || book.thumbnail,
        cover: book.image?.[0] || book.thumbnail,
        src_url: book.previewLink || `https://books.google.com/books?id=${book.id}`,
        authors: book.authors || [],
        editors: book.editors || [],
        publisher: book.editors?.[0] || book.publisher,
        publishedDate: book.releaseDate,
        releaseDate: book.releaseDate,
        isbn: book.isbn,
        genres: book.genres || [],
        pages: book.pages || null,
        language: book.language || null,
        detailUrl: generateDetailUrl('googlebooks', book.id, 'book')
      }));
      
      return { results: items, total: rawResult.totalItems || items.length };
    },
    { params: { lang, max, author }, forceRefresh: refresh }
  );
  
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'googlebooks',
    query: `author:${author}`,
    total: result.total,
    meta: { lang, locale, autoTrad, author },
    cacheMatch: result._cacheMatch
  }));
}));

// ============================================================================
// OPENLIBRARY - Recherche par auteur
// ============================================================================
router.get("/openlibrary/:author", extractAuthorParams, asyncHandler(async (req, res) => {
  const { author } = req.params;
  const { lang, locale, max, autoTrad, refresh } = req.standardParams;
  
  if (!author || author.trim().length < 2) {
    return res.status(400).json({ 
      error: 'Author name must be at least 2 characters' 
    });
  }
  
  log.info(`OpenLibrary author search: ${author}`);
  
  const result = await openLibraryCache.searchWithCache(
    `author:${author}`,
    async () => {
      const rawResult = await searchOpenLibraryByAuthor(author, { lang, max });
      
      const items = (rawResult.books || []).map(book => ({
        type: 'book',
        source: 'openlibrary',
        sourceId: book.id,
        name: book.title,
        name_original: book.originalTitle || book.title,
        description: book.synopsis || book.description || null,
        synopsis: book.synopsis || book.description || null,
        year: book.releaseDate ? parseInt(book.releaseDate.substring(0, 4), 10) : null,
        image: book.image || [],
        thumbnail: book.image?.[0] || book.thumbnail,
        cover: book.image?.[0] || book.thumbnail,
        src_url: book.src_url || book.url || `https://openlibrary.org${book.key || book.id}`,
        authors: book.authors || [],
        editors: book.editors || [],
        publisher: book.editors?.[0] || book.publisher,
        publishedDate: book.releaseDate,
        releaseDate: book.releaseDate,
        isbn: book.isbn,
        genres: book.genres || [],
        pages: book.pages || null,
        language: book.language || null,
        detailUrl: generateDetailUrl('openlibrary', book.id, 'book')
      }));
      
      return { results: items, total: rawResult.totalDocs || items.length };
    },
    { params: { lang, max, author }, forceRefresh: refresh }
  );
  
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'openlibrary',
    query: `author:${author}`,
    total: result.total,
    meta: { lang, locale, autoTrad, author },
    cacheMatch: result._cacheMatch
  }));
}));

// ============================================================================
// BEDETHEQUE - Recherche par auteur
// ============================================================================
router.get("/bedetheque/:author", extractAuthorParams, asyncHandler(async (req, res) => {
  const { author } = req.params;
  const { lang, locale, max, autoTrad, refresh } = req.standardParams;
  
  if (!author || author.trim().length < 2) {
    return res.status(400).json({ 
      error: 'Author name must be at least 2 characters' 
    });
  }
  
  log.info(`Bedetheque author search: ${author}`);
  
  const result = await bedethequeCache.searchWithCache(
    `author:${author}`,
    async () => {
      const rawResult = await searchBedethequeByAuthor(author, { lang, max });
      
      const items = (rawResult.albums || []).map(album => ({
        type: 'book',
        source: 'bedetheque',
        sourceId: album.id,
        name: album.title,
        name_original: album.title,
        description: album.synopsis || album.description || null,
        synopsis: album.synopsis || album.description || null,
        year: album.releaseDate ? parseInt(album.releaseDate.substring(0, 4), 10) : null,
        image: album.image || [],
        thumbnail: album.image?.[0] || album.thumbnail,
        cover: album.image?.[0] || album.thumbnail,
        src_url: album.src_url || `https://www.bedetheque.com/album-${album.id}.html`,
        authors: album.authors || [],
        editors: album.editors || [],
        publisher: album.editors?.[0] || album.publisher,
        publishedDate: album.releaseDate,
        releaseDate: album.releaseDate,
        series: album.serie,
        serie: album.serie,
        genres: album.genres || [],
        pages: album.pages || null,
        language: album.language || 'fr',
        detailUrl: generateDetailUrl('bedetheque', album.id, 'album')
      }));
      
      return { results: items, total: items.length };
    },
    { params: { lang, max, author }, forceRefresh: refresh }
  );
  
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'bedetheque',
    query: `author:${author}`,
    total: result.total,
    meta: { lang, locale, autoTrad, author },
    cacheMatch: result._cacheMatch
  }));
}));

// ============================================================================
// MANGADEX - Recherche par auteur
// ============================================================================
router.get("/mangadex/:author", extractAuthorParams, asyncHandler(async (req, res) => {
  const { author } = req.params;
  const { lang, locale, max, autoTrad, refresh } = req.standardParams;
  
  if (!author || author.trim().length < 2) {
    return res.status(400).json({ 
      error: 'Author name must be at least 2 characters' 
    });
  }
  
  log.info(`MangaDex author search: ${author}`);
  
  const result = await mangadexCache.searchWithCache(
    `author:${author}`,
    async () => {
      const rawResult = await searchMangaDexByAuthor(author, { lang, max });
      
      const items = (rawResult.manga || []).map(manga => ({
        type: 'book',
        source: 'mangadex',
        sourceId: manga.id,
        name: manga.title,
        name_original: manga.originalTitle || manga.title,
        description: manga.synopsis || manga.description || null,
        synopsis: manga.synopsis || manga.description || null,
        year: manga.releaseDate ? parseInt(manga.releaseDate.substring(0, 4), 10) : null,
        image: manga.image || [],
        thumbnail: manga.image?.[0] || manga.thumbnail,
        cover: manga.image?.[0] || manga.thumbnail,
        src_url: manga.src_url || manga.url || `https://mangadex.org/title/${manga.id}`,
        authors: manga.authors || [],
        editors: manga.editors || [],
        publisher: manga.editors?.[0],
        releaseDate: manga.releaseDate,
        genres: manga.genres || [],
        pages: manga.pages || null,
        tome: manga.tome || null,
        language: manga.language || 'ja',
        status: manga.status,
        contentRating: manga.contentRating,
        detailUrl: generateDetailUrl('mangadex', manga.id, 'manga')
      }));
      
      return { results: items, total: rawResult.total || items.length };
    },
    { params: { lang, max, author }, forceRefresh: refresh }
  );
  
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'mangadex',
    query: `author:${author}`,
    total: result.total,
    meta: { lang, locale, autoTrad, author },
    cacheMatch: result._cacheMatch
  }));
}));

export default router;
