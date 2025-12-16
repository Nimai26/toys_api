// routes/books.js - Endpoints Google Books et OpenLibrary (toys_api v2.0.0)
import { Router } from 'express';
import {
  searchGoogleBooks,
  getGoogleBookById,
  isIsbn
} from '../lib/providers/googlebooks.js';
import {
  searchOpenLibrary,
  getOpenLibraryById
} from '../lib/providers/openlibrary.js';
import { cleanSourceId, addCacheHeaders, asyncHandler, requireParam, requireApiKey } from '../lib/utils/index.js';
import { GOOGLE_BOOKS_DEFAULT_MAX, OPENLIBRARY_DEFAULT_MAX } from '../lib/config.js';

const router = Router();
const googleAuth = requireApiKey('Google Books', 'https://console.cloud.google.com/apis/credentials');

// ============================================================================
// GOOGLE BOOKS (nécessite clé API)
// ============================================================================

router.get("/search", requireParam('q'), googleAuth, asyncHandler(async (req, res) => {
  const q = req.query.q;
  const lang = req.query.lang || null;
  const maxResults = req.query.max ? parseInt(req.query.max, 10) : GOOGLE_BOOKS_DEFAULT_MAX;
  
  const result = await searchGoogleBooks(q, req.apiKey, { lang, maxResults });
  addCacheHeaders(res, 300);
  res.json(result);
}));

router.get("/book/:volumeId", googleAuth, asyncHandler(async (req, res) => {
  let volumeId = req.params.volumeId;
  if (!volumeId) return res.status(400).json({ error: "paramètre 'volumeId' manquant" });
  
  volumeId = cleanSourceId(volumeId, 'googlebooks');
  
  const result = await getGoogleBookById(volumeId, req.apiKey);
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
    res.json({ ...result.books[0], query: isbn, source: "google_books" });
  } else {
    res.status(404).json({ error: `Aucun livre trouvé pour ISBN: ${isbn}` });
  }
}));

// ============================================================================
// OPENLIBRARY (pas de clé API requise)
// ============================================================================

const olRouter = Router();

olRouter.get("/search", requireParam('q'), asyncHandler(async (req, res) => {
  const q = req.query.q;
  const lang = req.query.lang || null;
  const maxResults = req.query.max ? parseInt(req.query.max, 10) : OPENLIBRARY_DEFAULT_MAX;
  
  const result = await searchOpenLibrary(q, { lang, maxResults });
  addCacheHeaders(res, 300);
  res.json(result);
}));

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
