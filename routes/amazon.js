/**
 * Routes Amazon - toys_api v4.0.0
 * Endpoints pour recherche et scraping Amazon multi-pays
 * 
 * Routers séparés par catégorie pour correspondre aux appels du site web :
 * - amazonGenericRouter : /amazon_generic/* (recherche tous produits)
 * - amazonBooksRouter : /amazon_books/* (livres)
 * - amazonMoviesRouter : /amazon_movies/* (films/DVD/Blu-ray)
 * - amazonMusicRouter : /amazon_music/* (musique/CD/viyles)
 * - amazonToysRouter : /amazon_toys/* (jouets)
 * - amazonVideogamesRouter : /amazon_videogames/* (jeux vidéo)
 * 
 * v4.0.0: Cache PostgreSQL ajouté pour toutes les recherches et détails
 * v4.1.0: Format harmonisé selon le type (videogame, book, movie, music)
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
  formatDetailResponse,
  translateSearchDescriptions
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
import {
  normalizeAmazonVideogameSearchItem,
  normalizeAmazonVideogameDetail,
  normalizeAmazonBookSearchItem,
  normalizeAmazonBookDetail,
  normalizeAmazonMovieSearchItem,
  normalizeAmazonMovieDetail,
  normalizeAmazonMusicSearchItem,
  normalizeAmazonMusicDetail,
  normalizeAmazonToySearchItem,
  normalizeAmazonToyDetail
} from '../lib/normalizers/amazon.js';
import { createProviderCache, getCacheInfo } from '../lib/database/index.js';

const log = createLogger('Route:Amazon');

// Cache PostgreSQL pour Amazon (TTL plus court car prix variables)
const AMAZON_CACHE_TTL = 600; // 10 minutes pour les prix

// ============================================================================
// Mapping des normalizers par catégorie
// ============================================================================
const CATEGORY_NORMALIZERS = {
  videogames: {
    searchItem: normalizeAmazonVideogameSearchItem,
    detail: normalizeAmazonVideogameDetail
  },
  books: {
    searchItem: normalizeAmazonBookSearchItem,
    detail: normalizeAmazonBookDetail
  },
  movies: {
    searchItem: normalizeAmazonMovieSearchItem,
    detail: normalizeAmazonMovieDetail
  },
  music: {
    searchItem: normalizeAmazonMusicSearchItem,
    detail: normalizeAmazonMusicDetail
  },
  toys: {
    searchItem: normalizeAmazonToySearchItem,
    detail: normalizeAmazonToyDetail
  }
};

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
  
  // Récupérer les normalizers pour cette catégorie (ou null pour générique)
  const normalizers = category ? CATEGORY_NORMALIZERS[category] : null;

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
        
        // Mapper les résultats avec le normalizer approprié
        const items = (rawResult.products || rawResult.results || []).map(product => {
          // Si on a un normalizer pour cette catégorie, l'utiliser
          if (normalizers && normalizers.searchItem) {
            return normalizers.searchItem(product);
          }
          
          // Sinon, format générique
          return {
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
            priceValue: product.priceValue,
            currency: product.currency,
            rating: product.rating,
            reviewCount: product.reviewCount,
            isPrime: product.isPrime,
            url: product.url,
            detailUrl: generateDetailUrl(providerName, product.asin, 'product')
          };
        });
        
        return { results: items, total: rawResult.totalItems || items.length };
      },
      { params: { country, max }, forceRefresh: refresh }
    );
    
    // Post-traitement: assurer les champs de compatibilité frontend sur les résultats en cache
    const normalizedResults = (result.results || []).map(item => {
      // Extraire l'ID du provider (peut être à différents endroits selon le format)
      const itemId = item.sourceId || item.provider_id || item.source_id || item.amazon_data?.asin;
      
      // Extraire l'image (peut être à différents endroits)
      const itemImage = item.image || item.images?.cover || item.images?.thumbnail || 
                       (Array.isArray(item.images) && item.images[0]?.url) || item.poster_url || null;
      
      // Extraire l'URL source (peut être à différents endroits)
      const itemSrcUrl = item.src_url || item.source_url || item.url || item.urls?.detail ||
                        (item.amazon_data?.asin ? `https://www.amazon.fr/dp/${item.amazon_data.asin}` : null);
      
      // S'assurer que les champs de compatibilité frontend sont présents
      return {
        ...item,
        // Champs de compatibilité frontend (priorité aux valeurs existantes)
        name: item.name || item.title || '',
        image: itemImage,
        src_url: itemSrcUrl,
        detailUrl: item.detailUrl || `/${providerName}/details?detailUrl=/${providerName}/product/${itemId}`,
        sourceId: itemId
      };
    });
    
    // Filtrage spécifique pour la catégorie "books"
    // Amazon inclut souvent des produits dérivés (jouets, lampes, figurines) dans les résultats de livres
    let filteredResults = normalizedResults;
    if (category === 'books') {
      filteredResults = normalizedResults.filter(item => {
        const asin = item.sourceId || '';
        const title = (item.name || '').toLowerCase();
        
        // ❌ Exclure les titres invalides (parsing raté - souvent nombre d'avis)
        if (!item.name || item.name.length < 5 || /^\([0-9,.\s]+[km]?\)$/i.test(item.name)) {
          categoryLog.debug(`Filtré (titre invalide): ${item.name}`);
          return false;
        }
        
        // ✅ ASIN numérique = ISBN-10 = certainement un livre
        if (/^[0-9]{10}$/.test(asin)) {
          return true;
        }
        
        // ❌ Exclure les produits dérivés évidents (mots-clés dans le titre)
        const excludeKeywords = [
          'lampe', 'lamp', 'light', 'led',
          'figurine', 'figure', 'statue', 'collection',
          'puzzle', 'jeu de', 'board game', 'game',
          'mug', 'tasse', 'cup', 'coupe de collection',
          'peluche', 'plush', 'jouet', 'toy',
          'poster', 'affiche', 'cadre',
          'funko', 'pop!', 'noble collection',
          'baguette', 'wand', 'réplique', 'replica',
          'choixpeau', 'sorting hat',
          'vif d\'or', 'golden snitch',
          'ugears', 'maquette', 'kit de modèle',
          'poupée', 'poupee', 'doll', 'barbie',
          't-shirt', 'tee-shirt', 'vêtement', 'clothing',
          'coussin', 'pillow', 'couverture', 'blanket',
          'lego', 'playmobil', 'construction'
        ];
        
        if (excludeKeywords.some(kw => title.includes(kw))) {
          categoryLog.debug(`Filtré (produit dérivé): ${item.name?.substring(0, 50)}`);
          return false;
        }
        
        // ✅ Mots-clés de livres dans le titre
        const bookKeywords = [
          'édition', 'edition', 'illustré', 'illustrated',
          'tome', 'volume', 'roman', 'novel',
          'poche', 'paperback', 'hardcover', 'relié',
          'folio', 'gallimard', 'hachette', 'pocket'
        ];
        
        if (bookKeywords.some(kw => title.includes(kw))) {
          return true;
        }
        
        // Par défaut : accepter les ASIN standards (B0...) si le titre ne contient pas d'exclusions
        return true;
      });
      
      // Déduplication : Amazon peut retourner le même livre avec différents ASINs
      // Prioriser les ISBN-10 (ASIN numérique) sur les ASIN standards (B0...)
      const seenTitles = new Map(); // titre normalisé -> meilleur item
      for (const item of filteredResults) {
        const normalizedTitle = (item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const asin = item.sourceId || '';
        const isIsbn = /^[0-9]{10}$/.test(asin);
        
        if (!seenTitles.has(normalizedTitle)) {
          seenTitles.set(normalizedTitle, item);
        } else {
          // Si on a déjà ce titre, garder celui avec ISBN
          const existing = seenTitles.get(normalizedTitle);
          const existingIsIsbn = /^[0-9]{10}$/.test(existing.sourceId || '');
          
          if (isIsbn && !existingIsIsbn) {
            // Le nouveau a un ISBN, l'ancien non -> remplacer
            seenTitles.set(normalizedTitle, item);
            categoryLog.debug(`Dédupliqué: "${item.name?.substring(0, 40)}" - gardé ISBN ${asin} au lieu de ${existing.sourceId}`);
          }
        }
      }
      filteredResults = Array.from(seenTitles.values());
      
      categoryLog.debug(`Filtrage books: ${normalizedResults.length} → ${filteredResults.length} résultats`);
    }
    
    // Traduire les descriptions si autoTrad est activé (après le cache)
    const translatedResults = await translateSearchDescriptions(filteredResults, autoTrad, lang);
    
    addCacheHeaders(res, AMAZON_CACHE_TTL, getCacheInfo());
    res.json(formatSearchResponse({
      items: translatedResults,
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
    const rawResult = await amazonCache.getWithCache(
      `${id}:${country}`,
      async () => getAmazonProduct(id, country),
      { type: category || 'product', forceRefresh: refresh }
    );
    
    // Normaliser avec le normalizer approprié
    let result = rawResult;
    if (normalizers && normalizers.detail) {
      result = normalizers.detail(rawResult);
    }
    
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
    const rawResult = await amazonCache.getWithCache(
      `barcode:${code}:${country}`,
      async () => searchAmazonByBarcode(code, { country, category }),
      { type: 'barcode', forceRefresh: refresh }
    );
    
    // Normaliser avec le normalizer approprié
    let result = rawResult;
    if (normalizers && normalizers.detail) {
      result = normalizers.detail(rawResult);
    }
    
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
    
    const rawResult = await amazonCache.getWithCache(
      `${asin}:${country}`,
      async () => getAmazonProduct(asin, country),
      { type: category || 'product', forceRefresh: refresh }
    );
    
    // Normaliser avec le normalizer approprié
    let result = rawResult;
    if (normalizers && normalizers.detail) {
      result = normalizers.detail(rawResult);
    }
    
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
    
    const rawResult = await amazonCache.getWithCache(
      `barcode:${code}:${country}`,
      async () => searchAmazonByBarcode(code, { country, category }),
      { type: 'barcode', forceRefresh: refresh }
    );
    
    // Normaliser avec le normalizer approprié
    let result = rawResult;
    if (normalizers && normalizers.detail) {
      result = normalizers.detail(rawResult);
    }
    
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
