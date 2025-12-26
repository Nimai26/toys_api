// routes/books.js - Endpoints Google Books et OpenLibrary (toys_api v3.0.0)
import { Router } from 'express';
import {
  searchGoogleBooks,
  getGoogleBookByIdNormalized,
  isIsbn
} from '../lib/providers/googlebooks.js';
import {
  searchOpenLibrary,
  getOpenLibraryByIdNormalized
} from '../lib/providers/openlibrary.js';
import { 
  cleanSourceId, 
  addCacheHeaders, 
  asyncHandler, 
  requireParam, 
  requireApiKey, 
  isAutoTradEnabled,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams,
  validateCodeParams,
  generateDetailUrl,
  formatSearchResponse,
  formatDetailResponse,
  translateSearchDescriptions
} from '../lib/utils/index.js';
import { GOOGLE_BOOKS_DEFAULT_MAX, OPENLIBRARY_DEFAULT_MAX } from '../lib/config.js';
import { createProviderCache, getCacheInfo } from '../lib/database/index.js';

const router = Router();

// Cache providers pour les livres
const googleBooksCache = createProviderCache('googlebooks', 'book');
const openLibraryCache = createProviderCache('openlibrary', 'book');
const googleAuth = requireApiKey('Google Books', 'https://console.cloud.google.com/apis/credentials');

// ============================================================================
// GOOGLE BOOKS (nécessite clé API)
// ============================================================================

// Normalisé: /googlebooks/search (avec cache PostgreSQL)
router.get("/search", validateSearchParams, googleAuth, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  
  // Utilise le cache de recherche PostgreSQL (bypass si refresh=true)
  const result = await googleBooksCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchGoogleBooks(q, req.apiKey, { lang, maxResults: max });
      
      const items = (rawResult.books || []).map(book => ({
        type: 'book',
        source: 'googlebooks',
        sourceId: book.id,
        name: book.title,
        name_original: book.title,
        description: book.description || null,
        year: book.publishedDate ? parseInt(book.publishedDate.substring(0, 4), 10) : null,
        image: book.thumbnail || book.image,
        src_url: book.infoLink || `https://books.google.com/books?id=${book.id}`,
        authors: book.authors,
        publisher: book.publisher,
        publishedDate: book.publishedDate,
        isbn: book.isbn13 || book.isbn10,
        detailUrl: generateDetailUrl('googlebooks', book.id, 'book')
      }));
      
      return { results: items, total: rawResult.totalItems || items.length };
    },
    { params: { lang, max }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'googlebooks',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Normalisé: /googlebooks/details (avec cache PostgreSQL)
router.get("/details", validateDetailsParams, googleAuth, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';
  
  const cleanId = cleanSourceId(id, 'googlebooks');
  
  // Utilise le cache PostgreSQL
  const result = await googleBooksCache.getWithCache(
    cleanId,
    () => getGoogleBookByIdNormalized(cleanId, req.apiKey, { lang, autoTrad }),
    { forceRefresh }
  );
  
  if (!result) {
    return res.status(404).json({ error: `Livre ${cleanId} non trouvé` });
  }
  
  addCacheHeaders(res, 3600, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'googlebooks', id: cleanId, meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Normalisé: /googlebooks/code (ISBN)
router.get("/code", validateCodeParams, googleAuth, asyncHandler(async (req, res) => {
  const { code, lang, locale, autoTrad, refresh } = req.standardParams;
  
  if (!isIsbn(code)) {
    return res.status(400).json({ error: "ISBN invalide. Format attendu: 10 ou 13 chiffres" });
  }
  
  // Utilise le cache PostgreSQL (bypass si refresh=true)
  const result = await googleBooksCache.getWithCache(
    `isbn:${code}`,
    async () => {
      const searchResult = await searchGoogleBooks(code, req.apiKey, { lang, maxResults: 1 });
      return searchResult.books?.[0] || null;
    },
    { forceRefresh: refresh }
  );
  
  if (result) {
    addCacheHeaders(res, 3600, getCacheInfo());
    res.json(formatDetailResponse({ 
      data: result, 
      provider: 'googlebooks', 
      id: code,
      meta: { lang, locale, autoTrad, type: 'isbn' }
    }));
  } else {
    res.status(404).json({ error: `Aucun livre trouvé pour ISBN: ${code}` });
  }
}));

// Legacy
router.get("/book/:volumeId", googleAuth, asyncHandler(async (req, res) => {
  let volumeId = req.params.volumeId;
  if (!volumeId) return res.status(400).json({ error: "paramètre 'volumeId' manquant" });
  
  volumeId = cleanSourceId(volumeId, 'googlebooks');
  
  const autoTrad = isAutoTradEnabled(req);
  const lang = req.query.lang || null;
  
  const result = await getGoogleBookById(volumeId, req.apiKey, { lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

router.get("/isbn/:isbn", googleAuth, asyncHandler(async (req, res) => {
  const isbn = req.params.isbn;
  const lang = req.query.lang || null;
  
  if (!isbn) return res.status(400).json({ error: "paramètre 'isbn' manquant" });
  if (!isIsbn(isbn)) {
    return res.status(400).json({ error: "ISBN invalide. Format attendu: 10 ou 13 chiffres" });
  }
  
  const result = await searchGoogleBooks(isbn, req.apiKey, { lang, maxResults: 1 });
  
  if (result.books && result.books.length > 0) {
    addCacheHeaders(res, 3600);
    res.json({ ...result.books[0], query: isbn, source: "googlebooks" });
  } else {
    res.status(404).json({ error: `Aucun livre trouvé pour ISBN: ${isbn}` });
  }
}));

// ============================================================================
// OPENLIBRARY (pas de clé API requise)
// ============================================================================

const olRouter = Router();

// Normalisé: /openlibrary/search (avec cache PostgreSQL)
olRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  
  // Utilise le cache de recherche PostgreSQL (bypass si refresh=true)
  const result = await openLibraryCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchOpenLibrary(q, { lang, maxResults: max });
      
      const items = (rawResult.books || []).map(book => ({
        type: 'book',
        source: 'openlibrary',
        sourceId: book.key || book.id,
        name: book.title,
        name_original: book.title,
        description: book.first_sentence?.value || book.description || null,
        year: book.first_publish_year || book.releaseDate || null,
        image: Array.isArray(book.image) ? book.image[0] : book.image,
        thumbnail: Array.isArray(book.image) && book.image.length > 1 ? book.image[2] : null,
        src_url: book.url || (book.key ? `https://openlibrary.org${book.key}` : null),
        authors: book.author_name || book.authors,
        publishedDate: book.first_publish_year || book.releaseDate,
        isbn: book.isbn ? (Array.isArray(book.isbn) ? book.isbn[0] : book.isbn) : null,
        detailUrl: generateDetailUrl('openlibrary', book.key || book.id, 'book')
      }));
      
      return { results: items, total: rawResult.numFound || items.length };
    },
    { params: { lang, max }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'openlibrary',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Normalisé: /openlibrary/details (avec cache PostgreSQL)
olRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';
  
  const cleanId = cleanSourceId(id, 'openlibrary');
  
  // Utilise le cache PostgreSQL
  const result = await openLibraryCache.getWithCache(
    cleanId,
    () => getOpenLibraryByIdNormalized(cleanId),
    { forceRefresh }
  );
  
  if (!result) {
    return res.status(404).json({ error: `Livre ${cleanId} non trouvé` });
  }
  
  addCacheHeaders(res, 3600, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'openlibrary', id: cleanId, meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Normalisé: /openlibrary/code (ISBN)
olRouter.get("/code", validateCodeParams, asyncHandler(async (req, res) => {
  const { code, lang, locale, autoTrad, refresh } = req.standardParams;
  
  if (!isIsbn(code)) {
    return res.status(400).json({ error: "ISBN invalide. Format attendu: 10 ou 13 chiffres" });
  }
  
  // Utilise le cache PostgreSQL (bypass si refresh=true)
  const result = await openLibraryCache.getWithCache(
    `isbn:${code}`,
    async () => {
      const searchResult = await searchOpenLibrary(code, { lang, maxResults: 1 });
      return searchResult.books?.[0] || null;
    },
    { forceRefresh: refresh }
  );
  
  if (result) {
    addCacheHeaders(res, 3600, getCacheInfo());
    res.json(formatDetailResponse({ 
      data: result, 
      provider: 'openlibrary', 
      id: code,
      meta: { lang, locale, autoTrad, type: 'isbn' }
    }));
  } else {
    res.status(404).json({ error: `Aucun livre trouvé pour ISBN: ${code}` });
  }
}));

// Legacy
olRouter.get("/book/:olId", asyncHandler(async (req, res) => {
  let olId = req.params.olId;
  if (!olId) return res.status(400).json({ error: "paramètre 'olId' manquant" });
  
  olId = cleanSourceId(olId, 'openlibrary');
  
  const result = await getOpenLibraryById(olId);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

olRouter.get("/isbn/:isbn", asyncHandler(async (req, res) => {
  const isbn = req.params.isbn;
  const lang = req.query.lang || null;
  
  if (!isbn) return res.status(400).json({ error: "paramètre 'isbn' manquant" });
  if (!isIsbn(isbn)) {
    return res.status(400).json({ error: "ISBN invalide. Format attendu: 10 ou 13 chiffres" });
  }
  
  const result = await searchOpenLibrary(isbn, { lang, maxResults: 1 });
  
  if (result.books && result.books.length > 0) {
    addCacheHeaders(res, 3600);
    res.json({ ...result.books[0], query: isbn, source: "openlibrary" });
  } else {
    res.status(404).json({ error: `Aucun livre trouvé pour ISBN: ${isbn}` });
  }
}));

export const googleBooksRouter = router;
export const openLibraryRouter = olRouter;
export default router;
