/**
 * Routes Barcode - toys_api v4.0.0
 * Endpoints pour l'identification par code-barres (UPC, EAN, ISBN)
 * 
 * v4.0.0: Cache PostgreSQL pour toutes les recherches
 */

import { Router } from 'express';
import { 
  metrics, 
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
import { createProviderCache, getCacheInfo } from '../lib/database/index.js';

const router = Router();

// Cache PostgreSQL pour les codes-barres (TTL long car données stables)
const barcodeCache = createProviderCache('barcode', 'product');
const BARCODE_CACHE_TTL = 86400; // 24h pour les données barcode (stables)

// ============================================================================
// ENDPOINTS NORMALISÉS
// ============================================================================

/**
 * Recherche par code-barres - Normalisé
 * @route GET /barcode/code?code=...
 */
router.get("/code", validateCodeParams, asyncHandler(async (req, res) => {
  const { code, lang, locale, autoTrad, refresh } = req.standardParams;
  const googleBooksKey = req.query.googleBooksKey || req.headers['x-googlebooks-key'];
  const rawgKey = req.query.rawgKey || req.headers['x-rawg-key'];
  const discogsToken = req.query.discogsToken || req.headers['x-discogs-token'];
  const enrichGames = req.query.enrichGames !== 'false' && req.query.enrich !== 'false';
  const enrichMusic = req.query.enrichMusic !== 'false' && req.query.enrich !== 'false';
  
  if (code.length < 8) {
    return res.status(400).json({ error: "Code-barres invalide (minimum 8 caractères)" });
  }
  
  metrics.sources.barcode.requests++;
  
  // Utiliser le cache PostgreSQL avec getWithCache (bypass si refresh=true)
  const result = await barcodeCache.getWithCache(
    code,
    async () => {
      return await searchByBarcode(code, {
        apiKeys: {
          googleBooks: googleBooksKey,
          rawg: rawgKey,
          discogs: discogsToken
        },
        enrichGameData: enrichGames,
        enrichMusicData: enrichMusic
      });
    },
    { forceRefresh: refresh }
  );
  
  const response = formatDetailResponse({ 
    data: result, 
    provider: 'barcode', 
    id: code, 
    meta: { lang, locale, autoTrad, type: detectBarcodeType(code).type }
  });
  
  addCacheHeaders(res, BARCODE_CACHE_TTL, getCacheInfo());
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
  const refresh = req.query.refresh === 'true' || req.query.cache === 'false' || req.query.db === 'false';
  const googleBooksKey = req.query.googleBooksKey || req.headers['x-googlebooks-key'];
  const rawgKey = req.query.rawgKey || req.headers['x-rawg-key'];
  const discogsToken = req.query.discogsToken || req.headers['x-discogs-token'];
  const enrichGames = req.query.enrichGames !== 'false' && req.query.enrich !== 'false';
  const enrichMusic = req.query.enrichMusic !== 'false' && req.query.enrich !== 'false';
  
  if (!code || code.length < 8) {
    return res.status(400).json({ error: "Code-barres invalide (minimum 8 caractères)" });
  }
  
  metrics.sources.barcode.requests++;
  
  // Utiliser le cache PostgreSQL avec getWithCache (bypass si refresh=true)
  const result = await barcodeCache.getWithCache(
    code,
    async () => {
      return await searchByBarcode(code, {
        apiKeys: {
          googleBooks: googleBooksKey,
          rawg: rawgKey,
          discogs: discogsToken
        },
        enrichGameData: enrichGames,
        enrichMusicData: enrichMusic
      });
    },
    { forceRefresh: refresh }
  );
  
  addCacheHeaders(res, BARCODE_CACHE_TTL, getCacheInfo());
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
  const refresh = req.query.refresh === 'true' || req.query.cache === 'false' || req.query.db === 'false';
  
  if (!isbn || isbn.replace(/[-\s]/g, '').length < 10) {
    return res.status(400).json({ error: "ISBN invalide" });
  }
  
  // Cache spécifique pour ISBN (avec préfixe isbn:)
  const isbnCache = createProviderCache('barcode', 'isbn');
  
  metrics.sources.barcode.requests++;
  
  const result = await isbnCache.getWithCache(
    `${isbn}:${lang || 'all'}`,
    async () => {
      return await searchBookByIsbn(isbn, googleBooksKey, lang);
    },
    { forceRefresh: refresh }
  );
  
  addCacheHeaders(res, BARCODE_CACHE_TTL, getCacheInfo());
  res.json(result);
}));

/**
 * Recherche un livre sur la BNF
 * @route GET /barcode/bnf/:isbn
 */
router.get("/bnf/:isbn", asyncHandler(async (req, res) => {
  const { isbn } = req.params;
  const refresh = req.query.refresh === 'true' || req.query.cache === 'false' || req.query.db === 'false';
  
  if (!isbn || isbn.replace(/[-\s]/g, '').length < 10) {
    return res.status(400).json({ error: "ISBN invalide" });
  }
  
  // Cache spécifique pour BNF
  const bnfCache = createProviderCache('barcode', 'bnf');
  
  metrics.sources.barcode.requests++;
  
  const result = await bnfCache.getWithCache(
    isbn,
    async () => {
      return await searchBnfByIsbn(isbn);
    },
    { forceRefresh: refresh }
  );
  
  addCacheHeaders(res, BARCODE_CACHE_TTL, getCacheInfo());
  res.json(result);
}));

export default router;
