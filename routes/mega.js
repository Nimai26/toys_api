/**
 * Routes Mega Construx - toys_api v3.0.0
 * 
 * Endpoints normalisés :
 * - GET /search : Recherche avec q, lang, max, autoTrad
 * - GET /details : Détails via detailUrl
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
  formatDetailResponse
} from '../lib/utils/index.js';
import { MEGA_DEFAULT_MAX, MEGA_DEFAULT_LANG } from '../lib/config.js';

import {
  searchMega as searchMegaLib,
  getMegaProductById as getMegaProductByIdLib,
  getMegaInstructions,
  listMegaInstructions
} from '../lib/providers/mega.js';

const router = Router();
const log = createLogger('Route:Mega');

// ============================================================================
// ENDPOINTS NORMALISÉS v3.0.0
// ============================================================================

/**
 * GET /mega/search
 * Recherche de produits Mega Construx
 */
router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, page, autoTrad } = req.standardParams;

  const rawResult = await searchMegaLib(q, { max, page, lang: locale });
  
  // Transformer au format normalisé
  const items = (rawResult.products || []).map(product => ({
    type: 'construct_toy',
    source: 'mega',
    sourceId: product.id || product.sku,
    name: product.title || product.name,
    name_original: product.title || product.name,
    image: product.image || product.primaryImage,
    detailUrl: generateDetailUrl('mega', product.id || product.sku, 'product')
  }));
  
  addCacheHeaders(res, 1800);
  res.json(formatSearchResponse({
    items,
    provider: 'mega',
    query: q,
    pagination: {
      page,
      pageSize: items.length,
      totalResults: rawResult.total || items.length,
      hasMore: (rawResult.total || 0) > items.length
    },
    meta: { lang, locale, autoTrad }
  }));
}));

/**
 * GET /mega/details
 * Détails d'un produit Mega via detailUrl
 */
router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;

  const result = await getMegaProductByIdLib(id, { lang: locale, autoTrad });
  if (!result || !result.title) {
    return res.status(404).json({ error: `Produit ${id} non trouvé` });
  }
  
  // Ajouter les instructions
  const skuForInstructions = result.sku || id;
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
  } catch (err) {
    result.instructions = [];
  }
  
  addCacheHeaders(res, 3600);
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
