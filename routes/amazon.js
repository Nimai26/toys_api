/**
 * Routes Amazon - toys_api v3.0.0
 * Endpoints pour recherche et scraping Amazon multi-pays
 * 
 * Routers séparés par catégorie pour correspondre aux appels du site web :
 * - amazonGenericRouter : /amazon_generic/* (recherche tous produits)
 * - amazonBooksRouter : /amazon_books/* (livres)
 * - amazonMoviesRouter : /amazon_movies/* (films/DVD/Blu-ray)
 * - amazonMusicRouter : /amazon_music/* (musique/CD/vinyles)
 * - amazonToysRouter : /amazon_toys/* (jouets)
 * - amazonVideogamesRouter : /amazon_videogames/* (jeux vidéo)
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { 
  metrics, 
  addCacheHeaders, 
  asyncHandler,
  validateSearchParams,
  validateDetailsParams,
  validateCodeParams,
  generateDetailUrl,
  formatSearchResponse,
  formatDetailResponse
} from '../lib/utils/index.js';
import {
  searchAmazon,
  getAmazonProduct,
  searchAmazonByBarcode,
  searchMultiCountry as searchAmazonMultiCountry,
  comparePrices as compareAmazonPrices,
  checkVpnStatus,
  rotateVpnIp,
  getSupportedMarketplaces,
  getSupportedCategories,
  isAmazonAvailable,
  getAmazonStatus
} from '../lib/providers/amazon.js';

const log = createLogger('Route:Amazon');

// ============================================================================
// Fonctions helper pour créer des routers Amazon par catégorie
// ============================================================================

/**
 * Crée un router Amazon spécialisé pour une catégorie
 * @param {string|null} category - Catégorie Amazon (null = générique)
 * @param {string} logName - Nom pour les logs
 * @param {string} providerName - Nom du provider pour les URLs
 */
function createAmazonCategoryRouter(category, logName, providerName) {
  const router = Router();
  const categoryLog = createLogger(`Route:Amazon:${logName}`);

  // Normalisé: /amazon_*/search
  router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
    const { q, lang, locale, max, page, autoTrad } = req.standardParams;
    const country = req.query.country || locale?.split('-')[1]?.toLowerCase() || "fr";

    metrics.requests.total++;
    metrics.sources.amazon.requests++;
    categoryLog.debug(`Search: "${q}" country=${country} category=${category || 'all'}`);
    
    const rawResult = await searchAmazon(q, { country, category, page, limit: max });
    
    const items = (rawResult.products || rawResult.results || []).map(product => ({
      type: category || 'product',
      source: providerName,
      sourceId: product.asin,
      name: product.title || product.name,
      name_original: product.title || product.name,
      image: product.image || product.thumbnail,
      price: product.price,
      currency: product.currency,
      rating: product.rating,
      reviewCount: product.reviewCount,
      url: product.url,
      detailUrl: generateDetailUrl(providerName, product.asin, 'product')
    }));
    
    addCacheHeaders(res, 600);
    res.json(formatSearchResponse({
      items,
      provider: providerName,
      query: q,
      pagination: { page },
      meta: { lang, locale, autoTrad, country, category }
    }));
  }));

  // Normalisé: /amazon_*/details
  router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
    const { lang, locale, autoTrad } = req.standardParams;
    const { id } = req.parsedDetailUrl;
    const country = req.query.country || locale?.split('-')[1]?.toLowerCase() || "fr";

    metrics.requests.total++;
    metrics.sources.amazon.requests++;
    const result = await getAmazonProduct(id, country);
    
    addCacheHeaders(res, 600);
    res.json(formatDetailResponse({ 
      data: result, 
      provider: providerName, 
      id, 
      meta: { lang, locale, autoTrad, country, category } 
    }));
  }));

  // Normalisé: /amazon_*/code (barcode)
  router.get("/code", validateCodeParams, asyncHandler(async (req, res) => {
    const { code, lang, locale, autoTrad } = req.standardParams;
    const country = req.query.country || locale?.split('-')[1]?.toLowerCase() || "fr";

    metrics.requests.total++;
    metrics.sources.amazon.requests++;
    const result = await searchAmazonByBarcode(code, { country, category });
    
    addCacheHeaders(res, 600);
    res.json(formatDetailResponse({ 
      data: result, 
      provider: providerName, 
      id: code, 
      meta: { lang, locale, autoTrad, country, category, type: 'barcode' } 
    }));
  }));

  // Legacy: Détails produit par ASIN
  router.get("/product/:asin", asyncHandler(async (req, res) => {
    const { asin } = req.params;
    const country = req.query.country || "fr";

    if (!asin) return res.status(400).json({ error: "ASIN requis" });

    metrics.requests.total++;
    metrics.sources.amazon.requests++;
    const result = await getAmazonProduct(asin, country);
    addCacheHeaders(res, 600);
    res.json(result);
  }));

  // Legacy: Recherche par code-barres
  router.get("/barcode/:code", asyncHandler(async (req, res) => {
    const { code } = req.params;
    const country = req.query.country || "fr";

    if (!code) return res.status(400).json({ error: "Code-barres requis" });

    metrics.requests.total++;
    metrics.sources.amazon.requests++;
    const result = await searchAmazonByBarcode(code, { country, category });
    addCacheHeaders(res, 600);
    res.json(result);
  }));

  // Recherche multi-pays
  router.get("/multi", asyncHandler(async (req, res) => {
    const q = req.query.q;
    const countries = req.query.countries ? req.query.countries.split(",") : ["fr", "us", "uk"];

    if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

    metrics.requests.total++;
    metrics.sources.amazon.requests++;
    const result = await searchAmazonMultiCountry(q, countries, { category });
    addCacheHeaders(res, 600);
    res.json(result);
  }));

  return router;
}

// ============================================================================
// Création des routers par catégorie
// ============================================================================

// Router générique (toutes catégories)
const amazonGenericRouter = createAmazonCategoryRouter(null, 'Generic', 'amazon_generic');

// Routers spécialisés par catégorie
const amazonBooksRouter = createAmazonCategoryRouter('books', 'Books', 'amazon_books');
const amazonMoviesRouter = createAmazonCategoryRouter('movies', 'Movies', 'amazon_movies');
const amazonMusicRouter = createAmazonCategoryRouter('music', 'Music', 'amazon_music');
const amazonToysRouter = createAmazonCategoryRouter('toys', 'Toys', 'amazon_toys');
const amazonVideogamesRouter = createAmazonCategoryRouter('videogames', 'Videogames', 'amazon_videogames');

// ============================================================================
// Router principal Amazon (legacy + utilitaires)
// Conservé pour rétrocompatibilité avec /amazon/*
// ============================================================================
const router = Router();

// -----------------------------
// Endpoints Amazon (Puppeteer Stealth + FlareSolverr fallback)
// -----------------------------

// Statut complet du provider Amazon
router.get("/status", (req, res) => {
  const status = getAmazonStatus();
  res.json({
    ...status,
    message: status.available 
      ? `Amazon disponible (${status.puppeteer.available ? 'Puppeteer Stealth' : 'FlareSolverr'})`
      : `Amazon temporairement désactivé. Retry dans ${status.retryAfter}s`
  });
});

// Recherche Amazon
router.get("/search", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const country = req.query.country || "fr";
  const category = req.query.category || null;
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const max = req.query.max ? parseInt(req.query.max, 10) : 20;

  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  const result = await searchAmazon(q, { country, category, page, limit: max });
  addCacheHeaders(res, 600);
  res.json(result);
}));

// Détails d'un produit Amazon par ASIN
router.get("/product/:asin", asyncHandler(async (req, res) => {
  const { asin } = req.params;
  const country = req.query.country || "fr";

  if (!asin) return res.status(400).json({ error: "ASIN requis" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  const result = await getAmazonProduct(asin, country);
  addCacheHeaders(res, 600);
  res.json(result);
}));

// Recherche par code-barres (EAN/UPC)
router.get("/barcode/:code", asyncHandler(async (req, res) => {
  const { code } = req.params;
  const country = req.query.country || "fr";
  const category = req.query.category || null;

  if (!code) return res.status(400).json({ error: "Code-barres requis" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  const result = await searchAmazonByBarcode(code, { country, category });
  addCacheHeaders(res, 600);
  res.json(result);
}));

// Recherche multi-pays
router.get("/multi", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const countries = req.query.countries ? req.query.countries.split(",") : ["fr", "us", "uk"];
  const category = req.query.category || null;

  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  const result = await searchAmazonMultiCountry(q, countries, { category });
  addCacheHeaders(res, 600);
  res.json(result);
}));

// Comparaison de prix entre marketplaces
router.get("/compare/:asin", asyncHandler(async (req, res) => {
  const { asin } = req.params;
  const countries = req.query.countries ? req.query.countries.split(",") : ["fr", "us", "uk", "de"];

  if (!asin) return res.status(400).json({ error: "ASIN requis" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  const result = await compareAmazonPrices(asin, countries);
  addCacheHeaders(res, 600);
  res.json(result);
}));

// Statut du VPN Amazon
router.get("/vpn/status", asyncHandler(async (req, res) => {
  const status = await checkVpnStatus();
  res.json(status);
}));

// Rotation d'IP VPN
router.post("/vpn/rotate", asyncHandler(async (req, res) => {
  const result = await rotateVpnIp();
  res.json(result);
}));

// Marketplaces et catégories supportés
router.get("/marketplaces", (req, res) => {
  res.json(getSupportedMarketplaces());
});

router.get("/categories", (req, res) => {
  res.json(getSupportedCategories());
});

// ============================================================================
// Exports
// ============================================================================
export default router; // Legacy /amazon/*
export {
  amazonGenericRouter,
  amazonBooksRouter,
  amazonMoviesRouter,
  amazonMusicRouter,
  amazonToysRouter,
  amazonVideogamesRouter
};
