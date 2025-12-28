/**
 * Routes Playmobil - toys_api v4.0.0
 * 
 * Endpoints normalisés :
 * - GET /search : Recherche avec q, lang, max, autoTrad
 * - GET /details : Détails via detailUrl (avec cache PostgreSQL)
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
  formatDetailResponse,
  translateSearchDescriptions
} from '../lib/utils/index.js';
import { createProviderCache, getCacheInfo } from '../lib/database/cache-wrapper.js';

import {
  searchPlaymobil as searchPlaymobilLib,
  getPlaymobilProductDetailsNormalized,
  getPlaymobilInstructions,
  searchPlaymobilInstructions,
  extractPlaymobilProductId,
  isValidPlaymobilProductId
} from '../lib/providers/playmobil.js';

const router = Router();
const log = createLogger('Route:Playmobil');

// Cache PostgreSQL pour Playmobil
const playmobilCache = createProviderCache('playmobil', 'construct_toy');

// ============================================================================
// ENDPOINTS NORMALISÉS v3.0.0
// ============================================================================

/**
 * GET /playmobil/search (avec cache PostgreSQL)
 * Recherche de produits Playmobil
 */
router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  const refresh = req.query.refresh === 'true';

  /**
   * Extrait le nom depuis le slug de l'URL Playmobil
   */
  function extractNameFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/([^\/]+)\/\d+\.html$/);
    if (!match) return null;
    const slug = decodeURIComponent(match[1]);
    return slug
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  const result = await playmobilCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchPlaymobilLib(q, locale, 3, max);
      
      const items = (rawResult.products || []).map(product => {
        const productId = product.productId || product.id;
        const productUrl = product.url || `https://www.playmobil.com/fr-fr/produit/${productId}`;
        const nameFromUrl = extractNameFromUrl(productUrl);
        const name = product.name || nameFromUrl || null;
        
        return {
          type: 'construct_toy',
          source: 'playmobil',
          sourceId: productId,
          name: name,
          name_original: name,
          description: product.description || product.shortDescription || null,
          year: product.year || null,
          image: product.image || product.primaryImage || product.thumb || product.baseImgUrl || null,
          src_url: productUrl,
          detailUrl: generateDetailUrl('playmobil', productId, 'product')
        };
      });
      
      return { results: items, total: rawResult.total || items.length };
    },
    { params: { locale, max }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 1800, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'playmobil',
    query: q,
    total: result.total,
    pagination: {
      page: 1,
      pageSize: (result.results || []).length,
      totalResults: result.total || 0,
      hasMore: (result.total || 0) > (result.results || []).length
    },
    meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

/**
 * GET /playmobil/details
 * Détails d'un produit Playmobil via detailUrl (avec cache PostgreSQL)
 */
router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true';

  const cleanId = extractPlaymobilProductId(id);
  if (!cleanId || !isValidPlaymobilProductId(cleanId)) {
    return res.status(400).json({ 
      error: "Format d'ID invalide",
      hint: "L'ID doit être un nombre de 4 à 6 chiffres (ex: 71148)"
    });
  }
  
  // Utiliser le cache PostgreSQL
  const result = await playmobilCache.getWithCache(
    cleanId,
    async () => {
      const data = await getPlaymobilProductDetailsNormalized(cleanId, locale);
      if (!data || !data.name) {
        return null;
      }
      
      // Ajouter les instructions (enrichissement supplémentaire)
      try {
        const instructions = await getPlaymobilInstructions(cleanId);
        if (instructions && instructions.available) {
          data.instructions = instructions;
        } else if (!data.instructions) {
          data.instructions = { available: false };
        }
      } catch (err) {
        if (!data.instructions) {
          data.instructions = { available: false, error: err.message };
        }
      }
      
      return data;
    },
    { forceRefresh }
  );
  
  if (!result || !result.name) {
    return res.status(404).json({ error: `Produit ${cleanId} non trouvé` });
  }
  
  addCacheHeaders(res, 3600, getCacheInfo());
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
