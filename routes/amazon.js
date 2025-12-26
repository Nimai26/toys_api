/**
 * Routes Amazon - toys_api v4.0.0
 * Endpoints pour recherche et scraping Amazon multi-pays
 * 
 * Routers séparés par catégorie pour correspondre aux appels du site web :
 * - amazonGenericRouter : /amazon_generic/* (recherche tous produits)
 * - amazonBooksRouter : /amazon_books/* (livres)
 * - amazonMoviesRouter : /amazon_movies/* (films/DVD/Blu-ray)
 * - amazonMusicRouter : /amazon_music/* (musique/CD/vinyles)
 * - amazonToysRouter : /amazon_toys/* (jouets)
 * - amazonVideogamesRouter : /amazon_videogames/* (jeux vidéo)
 * 
 * v4.0.0: Cache PostgreSQL ajouté pour toutes les recherches et détails
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
import { createProviderCache, getCacheInfo } from '../lib/database/index.js';

const log = createLogger('Route:Amazon');

// Cache PostgreSQL pour Amazon (TTL plus court car prix variables)
const AMAZON_CACHE_TTL = 600; // 10 minutes pour les prix

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
  
  // Cache PostgreSQL spécifique à cette catégorie
  const amazonCache = createProviderCache(providerName, category || 'product');

  // Normalisé: /amazon_*/search (avec cache PostgreSQL)
  router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
    const { q, lang, locale, max, autoTrad, country, refresh } = req.standardParams;

    metrics.requests.total++;
    metrics.sources.amazon.requests++;
    categoryLog.debug(`Search: "${q}" country=${country} category=${category || 'all'} refresh=${refresh}`);
    
    // Utilise le cache PostgreSQL (bypass si refresh=true)
    const result = await amazonCache.searchWithCache(
      q,
      async () => {
        const rawResult = await searchAmazon(q, { country, category, limit: max });
        
        const items = (rawResult.products || rawResult.results || []).map(product => ({
          type: category || 'product',
          source: providerName,
          sourceId: product.asin,
          name: product.title || product.name,
          name_original: product.title || product.name,
          description: product.description || null,
          year: product.publicationDate ? parseInt(product.publicationDate.substring(0, 4), 10) : null,
          image: product.image || product.thumbnail,
          src_url: product.url || `https://www.amazon.fr/dp/${product.asin}`,
          price: product.price,
          currency: product.currency,
          rating: product.rating,
          reviewCount: product.reviewCount,
          url: product.url,
          detailUrl: generateDetailUrl(providerName, product.asin, 'product')
        }));
        
        return { results: items, total: rawResult.totalItems || items.length };
      },
      { params: { country, max }, forceRefresh: refresh }
    );
    
    addCacheHeaders(res, AMAZON_CACHE_TTL, getCacheInfo());
    res.json(formatSearchResponse({
      items: result.results || [],
      provider: providerName,
      query: q,
      total: result.total,
      meta: { lang, locale, autoTrad, country, category }
    }));
  }));

  // Normalisé: /amazon_*/details (avec cache PostgreSQL)
  router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
    const { lang, locale, autoTrad, country, refresh } = req.standardParams;
    const { id } = req.parsedDetailUrl;

    metrics.requests.total++;
    metrics.sources.amazon.requests++;
    
    // Utilise le cache PostgreSQL pour les détails (bypass si refresh=true)
    const result = await amazonCache.getWithCache(
      `${id}:${country}`,
      async () => getAmazonProduct(id, country),
      { type: category || 'product', forceRefresh: refresh }
    );
    
    addCacheHeaders(res, AMAZON_CACHE_TTL, getCacheInfo());
    res.json(formatDetailResponse({ 
      data: result, 
      provider: providerName, 
      id, 
      meta: { lang, locale, autoTrad, country, category } 
    }));
  }));

  // Normalisé: /amazon_*/code (barcode) avec cache PostgreSQL
  router.get("/code", validateCodeParams, asyncHandler(async (req, res) => {
    const { code, lang, locale, autoTrad, country, refresh } = req.standardParams;

    metrics.requests.total++;
    metrics.sources.amazon.requests++;
    
    // Utilise le cache PostgreSQL (bypass si refresh=true)
    const result = await amazonCache.getWithCache(
      `barcode:${code}:${country}`,
      async () => searchAmazonByBarcode(code, { country, category }),
      { type: 'barcode', forceRefresh: refresh }
    );
    
    addCacheHeaders(res, AMAZON_CACHE_TTL, getCacheInfo());
    res.json(formatDetailResponse({ 
      data: result, 
      provider: providerName, 
      id: code, 
      meta: { lang, locale, autoTrad, country, category, type: 'barcode' } 
    }));
  }));

  // Legacy: Détails produit par ASIN (avec cache PostgreSQL)
  router.get("/product/:asin", asyncHandler(async (req, res) => {
    const { asin } = req.params;
    const country = req.query.lang || "fr";
    const refresh = req.query.refresh === 'true' || req.query.cache === 'false' || req.query.db === 'false';

    if (!asin) return res.status(400).json({ error: "ASIN requis" });

    metrics.requests.total++;
    metrics.sources.amazon.requests++;
    
    const result = await amazonCache.getWithCache(
      `${asin}:${country}`,
      async () => getAmazonProduct(asin, country),
      { type: category || 'product', forceRefresh: refresh }
    );
    
    addCacheHeaders(res, AMAZON_CACHE_TTL, getCacheInfo());
    res.json(result);
  }));

  // Legacy: Recherche par code-barres (avec cache PostgreSQL)
  router.get("/barcode/:code", asyncHandler(async (req, res) => {
    const { code } = req.params;
    const country = req.query.lang || "fr";
    const refresh = req.query.refresh === 'true' || req.query.cache === 'false' || req.query.db === 'false';

    if (!code) return res.status(400).json({ error: "Code-barres requis" });

    metrics.requests.total++;
    metrics.sources.amazon.requests++;
    
    const result = await amazonCache.getWithCache(
      `barcode:${code}:${country}`,
      async () => searchAmazonByBarcode(code, { country, category }),
      { type: 'barcode', forceRefresh: refresh }
    );
    
    addCacheHeaders(res, AMAZON_CACHE_TTL, getCacheInfo());
    res.json(result);
  }));

  // Recherche multi-pays (pas de cache car combine plusieurs marchés)
  router.get("/multi", asyncHandler(async (req, res) => {
    const q = req.query.q;
    const countries = req.query.countries ? req.query.countries.split(",") : ["fr", "us", "uk"];

    if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

    metrics.requests.total++;
    metrics.sources.amazon.requests++;
    const result = await searchAmazonMultiCountry(q, countries, { category });
    addCacheHeaders(res, AMAZON_CACHE_TTL);
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

// Cache PostgreSQL pour le router legacy
const amazonLegacyCache = createProviderCache('amazon', 'product');

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

// Recherche Amazon (avec cache PostgreSQL)
router.get("/search", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const country = req.query.lang || "fr";
  const category = req.query.category || null;
  const max = req.query.max ? parseInt(req.query.max, 10) : 20;
  const refresh = req.query.refresh === 'true' || req.query.cache === 'false';

  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  
  const result = await amazonLegacyCache.searchWithCache(
    q,
    async () => searchAmazon(q, { country, category, limit: max }),
    { params: { country, category, max }, forceRefresh: refresh }
  );
  
  addCacheHeaders(res, AMAZON_CACHE_TTL, getCacheInfo());
  res.json(result);
}));

// Détails d'un produit Amazon par ASIN (avec cache PostgreSQL)
router.get("/product/:asin", asyncHandler(async (req, res) => {
  const { asin } = req.params;
  const country = req.query.lang || "fr";
  const refresh = req.query.refresh === 'true' || req.query.cache === 'false';

  if (!asin) return res.status(400).json({ error: "ASIN requis" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  
  const result = await amazonLegacyCache.getWithCache(
    `${asin}:${country}`,
    async () => getAmazonProduct(asin, country),
    { forceRefresh: refresh }
  );
  
  addCacheHeaders(res, AMAZON_CACHE_TTL, getCacheInfo());
  res.json(result);
}));

// Recherche par code-barres (EAN/UPC) avec cache PostgreSQL
router.get("/barcode/:code", asyncHandler(async (req, res) => {
  const { code } = req.params;
  const country = req.query.lang || "fr";
  const category = req.query.category || null;
  const refresh = req.query.refresh === 'true' || req.query.cache === 'false';

  if (!code) return res.status(400).json({ error: "Code-barres requis" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  
  const result = await amazonLegacyCache.getWithCache(
    `barcode:${code}:${country}`,
    async () => searchAmazonByBarcode(code, { country, category }),
    { type: 'barcode', forceRefresh: refresh }
  );
  
  addCacheHeaders(res, AMAZON_CACHE_TTL, getCacheInfo());
  res.json(result);
}));

// Recherche multi-pays (pas de cache car combine plusieurs marchés)
router.get("/multi", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const countries = req.query.countries ? req.query.countries.split(",") : ["fr", "us", "uk"];
  const category = req.query.category || null;

  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  const result = await searchAmazonMultiCountry(q, countries, { category });
  addCacheHeaders(res, AMAZON_CACHE_TTL);
  res.json(result);
}));

// Comparaison de prix entre marketplaces (pas de cache car temps réel)
router.get("/compare/:asin", asyncHandler(async (req, res) => {
  const { asin } = req.params;
  const countries = req.query.countries ? req.query.countries.split(",") : ["fr", "us", "uk", "de"];

  if (!asin) return res.status(400).json({ error: "ASIN requis" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  const result = await compareAmazonPrices(asin, countries);
  addCacheHeaders(res, AMAZON_CACHE_TTL);
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
