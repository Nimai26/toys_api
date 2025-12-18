/**
 * Routes Barcode - toys_api v3.0.0
 * Endpoints pour l'identification par code-barres (UPC, EAN, ISBN)
 */

import { Router } from 'express';
import { 
  metrics, 
  getCached, 
  setCache, 
  addCacheHeaders, 
  asyncHandler,
  extractStandardParams,
  validateCodeParams,
  formatDetailResponse
} from '../lib/utils/index.js';
import {
  searchByBarcode,
  detectBarcodeType,
  searchBookByIsbn,
  searchBnfByIsbn
} from '../lib/providers/barcode.js';

const router = Router();

// ============================================================================
// ENDPOINTS NORMALISÉS
// ============================================================================

/**
 * Recherche par code-barres - Normalisé
 * @route GET /barcode/code?code=...
 */
router.get("/code", validateCodeParams, asyncHandler(async (req, res) => {
  const { code, lang, locale, autoTrad } = req.standardParams;
  const googleBooksKey = req.query.googleBooksKey || req.headers['x-googlebooks-key'];
  const rawgKey = req.query.rawgKey || req.headers['x-rawg-key'];
  const discogsToken = req.query.discogsToken || req.headers['x-discogs-token'];
  const enrichGames = req.query.enrichGames !== 'false' && req.query.enrich !== 'false';
  const enrichMusic = req.query.enrichMusic !== 'false' && req.query.enrich !== 'false';
  
  if (code.length < 8) {
    return res.status(400).json({ error: "Code-barres invalide (minimum 8 caractères)" });
  }
  
  const cacheKey = `barcode:${code}:g${enrichGames}:m${enrichMusic}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  metrics.sources.barcode.requests++;
  
  const result = await searchByBarcode(code, {
    apiKeys: {
      googleBooks: googleBooksKey,
      rawg: rawgKey,
      discogs: discogsToken
    },
    enrichGameData: enrichGames,
    enrichMusicData: enrichMusic
  });
  
  const response = formatDetailResponse({ 
    data: result, 
    provider: 'barcode', 
    id: code, 
    meta: { lang, locale, autoTrad, type: detectBarcodeType(code).type }
  });
  
  setCache(cacheKey, response);
  addCacheHeaders(res, 3600);
  res.json(response);
}));

// ============================================================================
// ENDPOINTS LEGACY
// ============================================================================

/**
 * Recherche par code-barres (livres, jeux vidéo, musique, produits) - Legacy
 * @route GET /barcode/:code
 */
router.get("/:code", asyncHandler(async (req, res) => {
  const { code } = req.params;
  const googleBooksKey = req.query.googleBooksKey || req.headers['x-googlebooks-key'];
  const rawgKey = req.query.rawgKey || req.headers['x-rawg-key'];
  const discogsToken = req.query.discogsToken || req.headers['x-discogs-token'];
  const enrichGames = req.query.enrichGames !== 'false' && req.query.enrich !== 'false';
  const enrichMusic = req.query.enrichMusic !== 'false' && req.query.enrich !== 'false';
  
  if (!code || code.length < 8) {
    return res.status(400).json({ error: "Code-barres invalide (minimum 8 caractères)" });
  }
  
  const cacheKey = `barcode:${code}:g${enrichGames}:m${enrichMusic}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  metrics.sources.barcode.requests++;
  
  const result = await searchByBarcode(code, {
    apiKeys: {
      googleBooks: googleBooksKey,
      rawg: rawgKey,
      discogs: discogsToken
    },
    enrichGameData: enrichGames,
    enrichMusicData: enrichMusic
  });
  
  setCache(cacheKey, result);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

/**
 * Détecte le type d'un code-barres
 * @route GET /barcode/detect/:code
 */
router.get("/detect/:code", (req, res) => {
  const { code } = req.params;
  
  if (!code || code.length < 8) {
    return res.status(400).json({ error: "Code-barres invalide" });
  }
  
  const info = detectBarcodeType(code);
  res.json(info);
});

/**
 * Recherche un livre par ISBN
 * @route GET /barcode/isbn/:isbn
 */
router.get("/isbn/:isbn", asyncHandler(async (req, res) => {
  const { isbn } = req.params;
  const googleBooksKey = req.query.googleBooksKey || req.headers['x-googlebooks-key'];
  const lang = req.query.lang || null;
  
  if (!isbn || isbn.replace(/[-\s]/g, '').length < 10) {
    return res.status(400).json({ error: "ISBN invalide" });
  }
  
  const cacheKey = `barcode:isbn:${isbn}:${lang || 'all'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  metrics.sources.barcode.requests++;
  const result = await searchBookByIsbn(isbn, googleBooksKey, lang);
  
  setCache(cacheKey, result);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

/**
 * Recherche un livre sur la BNF
 * @route GET /barcode/bnf/:isbn
 */
router.get("/bnf/:isbn", asyncHandler(async (req, res) => {
  const { isbn } = req.params;
  
  if (!isbn || isbn.replace(/[-\s]/g, '').length < 10) {
    return res.status(400).json({ error: "ISBN invalide" });
  }
  
  const cacheKey = `barcode:bnf:${isbn}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  metrics.sources.barcode.requests++;
  const result = await searchBnfByIsbn(isbn);
  
  setCache(cacheKey, result);
  addCacheHeaders(res, 86400);
  res.json(result);
}));

export default router;
