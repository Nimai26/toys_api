/**
 * Routes Playmobil - toys_api v3.0.0
 * 
 * Endpoints normalisés :
 * - GET /search : Recherche avec q, lang, max, autoTrad
 * - GET /details : Détails via detailUrl
 * - GET /product/:id : (legacy) Détails par ID direct
 * - GET /instructions/:id : Instructions de montage
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { 
  addCacheHeaders, 
  asyncHandler,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams,
  generateDetailUrl,
  formatSearchResponse,
  formatDetailResponse
} from '../lib/utils/index.js';

import {
  searchPlaymobil as searchPlaymobilLib,
  getPlaymobilProductDetails as getPlaymobilProductDetailsLib,
  getPlaymobilInstructions,
  searchPlaymobilInstructions,
  extractPlaymobilProductId,
  isValidPlaymobilProductId
} from '../lib/providers/playmobil.js';

const router = Router();
const log = createLogger('Route:Playmobil');

// ============================================================================
// ENDPOINTS NORMALISÉS v3.0.0
// ============================================================================

/**
 * GET /playmobil/search
 * Recherche de produits Playmobil
 */
router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;

  const rawResult = await searchPlaymobilLib(q, locale, 3, max);
  
  // Transformer les résultats au format normalisé
  const items = (rawResult.products || []).map(product => ({
    type: 'construct_toy',
    source: 'playmobil',
    sourceId: product.productId || product.id,
    name: product.name,
    name_original: product.name,
    description: product.description || product.shortDescription || null,
    year: product.year || null,
    image: product.image || product.primaryImage,
    src_url: product.url || `https://www.playmobil.fr/produit/${product.productId || product.id}`,
    detailUrl: generateDetailUrl('playmobil', product.productId || product.id, 'product')
  }));
  
  addCacheHeaders(res, 1800);
  res.json(formatSearchResponse({
    items,
    provider: 'playmobil',
    query: q,
    pagination: {
      page: 1,
      pageSize: items.length,
      totalResults: rawResult.total || items.length,
      hasMore: (rawResult.total || 0) > items.length
    },
    meta: { lang, locale, autoTrad }
  }));
}));

/**
 * GET /playmobil/details
 * Détails d'un produit Playmobil via detailUrl
 */
router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;

  const cleanId = extractPlaymobilProductId(id);
  if (!cleanId || !isValidPlaymobilProductId(cleanId)) {
    return res.status(400).json({ 
      error: "Format d'ID invalide",
      hint: "L'ID doit être un nombre de 4 à 6 chiffres (ex: 71148)"
    });
  }
  
  const result = await getPlaymobilProductDetailsLib(cleanId, locale);
  if (!result || !result.name) {
    return res.status(404).json({ error: `Produit ${cleanId} non trouvé` });
  }
  
  // Ajouter les instructions
  try {
    const instructions = await getPlaymobilInstructions(cleanId);
    result.instructions = instructions;
  } catch (err) {
    result.instructions = { available: false, error: err.message };
  }
  
  addCacheHeaders(res, 3600);
  res.json(formatDetailResponse({
    data: result,
    provider: 'playmobil',
    id: cleanId,
    meta: { lang, locale, autoTrad }
  }));
}));

// ============================================================================
// ENDPOINTS LEGACY (rétrocompatibilité)
// ============================================================================

/**
 * GET /playmobil/product/:id (LEGACY)
 */
router.get("/product/:id", asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const params = extractStandardParams(req);
  
  if (!productId) {
    return res.status(400).json({ error: "ID produit manquant" });
  }
  
  const cleanId = extractPlaymobilProductId(productId);
  if (!cleanId || !isValidPlaymobilProductId(cleanId)) {
    return res.status(400).json({ 
      error: "Format d'ID invalide",
      hint: "L'ID doit être un nombre de 4 à 6 chiffres (ex: 71148)"
    });
  }
  
  const result = await getPlaymobilProductDetailsLib(cleanId, params.locale);
  if (!result || !result.name) {
    return res.status(404).json({ error: `Produit ${cleanId} non trouvé` });
  }
  
  addCacheHeaders(res, 3600);
  res.json(result);
}));

router.get("/product/:id/instructions", asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const cleanId = extractPlaymobilProductId(productId);
  
  if (!cleanId || !isValidPlaymobilProductId(cleanId)) {
    return res.status(400).json({ error: "Format d'ID invalide" });
  }
  
  const result = await getPlaymobilInstructions(cleanId);
  if (!result.available) {
    return res.status(404).json({ error: `Instructions non trouvées pour ${cleanId}` });
  }
  
  addCacheHeaders(res, 86400);
  res.json(result);
}));

router.get("/instructions/search", asyncHandler(async (req, res) => {
  const params = extractStandardParams(req);
  if (!params.q) return res.status(400).json({ error: "paramètre 'q' manquant" });
  
  const result = await searchPlaymobilInstructions(params.q, params.locale);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

router.get("/instructions/:id", asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const cleanId = extractPlaymobilProductId(productId);
  
  if (!cleanId || !isValidPlaymobilProductId(cleanId)) {
    return res.status(400).json({ error: "Format d'ID invalide" });
  }
  
  const result = await getPlaymobilInstructions(cleanId);
  if (!result.available) {
    return res.status(404).json({ error: `Instructions non trouvées pour ${cleanId}` });
  }
  
  addCacheHeaders(res, 86400);
  res.json(result);
}));

export default router;
