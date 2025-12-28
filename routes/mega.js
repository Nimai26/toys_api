/**
 * Routes Mega Construx - toys_api v4.0.0
 * 
 * Endpoints normalisés :
 * - GET /search : Recherche avec q, lang, max, autoTrad
 * - GET /details : Détails via detailUrl (avec cache PostgreSQL)
 * - GET /product/:id : (legacy) Détails par ID direct
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { 
  addCacheHeaders, 
  asyncHandler, 
  isAutoTradEnabled,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams,
  generateDetailUrl,
  formatSearchResponse,
  formatDetailResponse,
  translateSearchDescriptions
} from '../lib/utils/index.js';
import { MEGA_DEFAULT_MAX, MEGA_DEFAULT_LANG } from '../lib/config.js';
import { createProviderCache, getCacheInfo } from '../lib/database/cache-wrapper.js';

import {
  searchMega as searchMegaLib,
  getMegaProductByIdNormalized,
  getMegaInstructions,
  listMegaInstructions
} from '../lib/providers/mega.js';

const router = Router();
const log = createLogger('Route:Mega');

// Cache PostgreSQL pour Mega Construx
const megaCache = createProviderCache('mega', 'construct_toy');

// ============================================================================
// ENDPOINTS NORMALISÉS v3.0.0
// ============================================================================

/**
 * GET /mega/search (avec cache PostgreSQL)
 * Recherche de produits Mega Construx
 */
router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, page, autoTrad } = req.standardParams;
  const refresh = req.query.refresh === 'true';

  const result = await megaCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchMegaLib(q, { max, page, lang: locale });
      
      const items = (rawResult.products || []).map(product => ({
        type: 'construct_toy',
        source: 'mega',
        sourceId: product.id || product.sku,
        name: product.title || product.name,
        name_original: product.title || product.name,
        description: product.description || product.shortDescription || null,
        year: product.year || null,
        image: product.image || product.primaryImage,
        src_url: product.url || product.handle ? `https://megaconstrux.com/products/${product.handle}` : null,
        detailUrl: generateDetailUrl('mega', product.id || product.sku, 'product')
      }));
      
      return { results: items, total: rawResult.total || items.length };
    },
    { params: { locale, max, page }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 1800, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'mega',
    query: q,
    total: result.total,
    pagination: {
      page,
      pageSize: (result.results || []).length,
      totalResults: result.total || 0,
      hasMore: (result.total || 0) > (result.results || []).length
    },
    meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

/**
 * GET /mega/details
 * Détails d'un produit Mega via detailUrl (avec cache PostgreSQL)
 */
router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true';

  const result = await megaCache.getWithCache(
    id,
    async () => {
      const data = await getMegaProductByIdNormalized(id, { lang: locale, autoTrad });
      if (!data || !data.name) {
        return null;
      }
      
      // Ajouter les instructions (enrichissement supplémentaire)
      const skuForInstructions = data.sku || id;
      try {
        const instructionsResult = await getMegaInstructions(skuForInstructions);
        if (instructionsResult && instructionsResult.instructionsUrl) {
          if (!data.instructions) data.instructions = {};
          data.instructions.manuals = [{
            url: instructionsResult.instructionsUrl,
            format: instructionsResult.format || 'PDF',
            productName: instructionsResult.productName
          }];
          data.instructions.available = true;
        } else if (!data.instructions || !data.instructions.available) {
          data.instructions = { available: false, manuals: [] };
        }
      } catch (err) {
        if (!data.instructions) {
          data.instructions = { available: false, manuals: [] };
        }
      }
      
      return data;
    },
    { forceRefresh }
  );
  
  if (!result || !result.name) {
    return res.status(404).json({ error: `Produit ${id} non trouvé` });
  }
  
  addCacheHeaders(res, 3600, getCacheInfo());
  res.json(formatDetailResponse({
    data: result,
    provider: 'mega',
    id,
    meta: { lang, locale, autoTrad }
  }));
}));

// ============================================================================
// ENDPOINTS LEGACY (rétrocompatibilité)
// ============================================================================

router.get("/product/:id", asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const params = extractStandardParams(req);
  const autoTrad = isAutoTradEnabled(req);
  
  if (!productId) return res.status(400).json({ error: "ID ou SKU manquant" });
  
  const result = await getMegaProductByIdLib(productId, { lang: params.locale, autoTrad });
  if (!result || !result.title) {
    return res.status(404).json({ error: `Produit ${productId} non trouvé` });
  }
  
  // Récupérer les instructions
  const skuForInstructions = result.sku || productId;
  try {
    const instructionsResult = await getMegaInstructions(skuForInstructions);
    if (instructionsResult && instructionsResult.instructionsUrl) {
      result.instructions = [{
        url: instructionsResult.instructionsUrl,
        format: instructionsResult.format || 'PDF',
        productName: instructionsResult.productName
      }];
    } else {
      result.instructions = [];
    }
  } catch (instrErr) {
    result.instructions = [];
  }
  
  addCacheHeaders(res, 3600);
  res.json(result);
}));

router.get("/franchise/:franchise", asyncHandler(async (req, res) => {
  const franchise = req.params.franchise;
  const params = extractStandardParams(req);
  
  const franchiseMap = {
    'pokemon': 'mega pokemon',
    'halo': 'mega halo',
    'barbie': 'mega barbie',
    'hotwheels': 'mega hot wheels',
    'hot-wheels': 'mega hot wheels',
    'bloks': 'mega bloks',
    'construx': 'mega construx'
  };
  
  const searchQuery = franchiseMap[franchise.toLowerCase()] || `mega ${franchise}`;
  const result = await searchMegaLib(searchQuery, { max: params.max, page: params.page, lang: params.locale });
  result.franchise = franchise;
  addCacheHeaders(res, 1800);
  res.json(result);
}));

router.get("/languages", (req, res) => {
  addCacheHeaders(res, 86400);
  res.json({
    default: MEGA_DEFAULT_LANG,
    regions: {
      US: { languages: ['en-US', 'es-MX', 'fr-CA', 'pt-BR', 'en-CA'] },
      EU: { languages: ['fr-FR', 'de-DE', 'es-ES', 'it-IT', 'nl-NL', 'en-GB'] }
    },
    source: 'mega'
  });
});

router.get("/instructions/:sku", asyncHandler(async (req, res) => {
  const sku = req.params.sku;
  if (!sku) return res.status(400).json({ error: "SKU manquant" });
  
  const result = await getMegaInstructions(sku);
  addCacheHeaders(res, 86400);
  res.json(result);
}));

router.get("/instructions", asyncHandler(async (req, res) => {
  const category = req.query.category || '';
  const result = await listMegaInstructions(category);
  addCacheHeaders(res, 21600);
  res.json(result);
}));

export default router;
