/**
 * Routes LEGO - toys_api v3.0.0
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
  metrics, 
  extractApiKey,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams,
  parseDetailUrl,
  generateDetailUrl,
  formatSearchResponse,
  formatDetailResponse
} from '../lib/utils/index.js';
import { DEFAULT_LOCALE, MAX_RETRIES } from '../lib/config.js';
import { createProviderCache, getCacheInfo } from '../lib/database/index.js';

import { 
  callLegoGraphql as callLegoGraphqlLib, 
  getProductDetailsNormalized,
  getProductDetails as getLegoProductDetails,
  getBuildingInstructions
} from '../lib/providers/lego.js';

const router = Router();
const log = createLogger('Route:Lego');

// Cache provider pour LEGO
const legoCache = createProviderCache('lego', 'construct_toy');

// ============================================================================
// ENDPOINTS NORMALISÉS v3.0.0
// ============================================================================

/**
 * GET /lego/search
 * Recherche de sets LEGO
 * 
 * @query {string} q - Terme de recherche (requis)
 * @query {string} lang - Langue (défaut: fr)
 * @query {number} max - Nombre max de résultats (défaut: 20)
 * @query {boolean} autoTrad - Traduction automatique
 */
router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;

  metrics.sources.lego.requests++;
  const perPage = Math.max(1, Math.min(max, 100));
  const rawResult = await callLegoGraphqlLib(q, locale, MAX_RETRIES, perPage);
  
  // Transformer les résultats au format normalisé
  const items = (rawResult.products || []).map(product => ({
    type: 'construct_toy',
    source: 'lego',
    sourceId: product.productCode || product.id,
    name: product.name,
    name_original: product.name, // LEGO retourne déjà traduit selon locale
    description: product.description || product.shortDescription || null,
    year: product.launchDate ? parseInt(product.launchDate.substring(0, 4), 10) : (product.year || null),
    image: product.primaryImage || product.image,
    src_url: product.url || `https://www.lego.com/product/${product.productCode || product.id}`,
    detailUrl: generateDetailUrl('lego', product.productCode || product.id, 'product')
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'lego',
    query: q,
    pagination: {
      page: 1,
      pageSize: items.length,
      totalResults: rawResult.total || items.length,
      totalPages: Math.ceil((rawResult.total || items.length) / perPage),
      hasMore: (rawResult.total || 0) > items.length
    },
    meta: { lang, locale, autoTrad }
  }));
}));

/**
 * GET /lego/details
 * Détails d'un produit LEGO via detailUrl (avec cache PostgreSQL)
 * 
 * @query {string} detailUrl - URL fournie par /search (requis)
 * @query {string} lang - Langue (défaut: fr)
 * @query {boolean} autoTrad - Traduction automatique
 * @query {boolean} refresh - Forcer le refresh depuis l'API
 */
router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';

  metrics.sources.lego.requests++;
  
  // Utilise le cache PostgreSQL
  let result = await legoCache.getWithCache(
    id,
    async () => {
      const product = await getProductDetailsNormalized(id, locale);
      
      // Ajouter les instructions (enrichissement)
      try {
        const instructions = await getBuildingInstructions(id, locale);
        if (instructions && instructions.manuals && instructions.manuals.length > 0) {
          product.instructions = {
            available: true,
            count: instructions.manuals.length,
            manuals: instructions.manuals
          };
        } else {
          product.instructions = { available: false, count: 0, manuals: [] };
        }
      } catch (instructionsErr) {
        log.warn(`Instructions non disponibles pour ${id}: ${instructionsErr.message}`);
        product.instructions = { available: false, count: 0, manuals: [], error: instructionsErr.message };
      }
      
      return product;
    },
    { forceRefresh }
  );
  
  if (!result) {
    return res.status(404).json({ error: `Produit LEGO ${id} non trouvé` });
  }
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatDetailResponse({
    data: result,
    provider: 'lego',
    id,
    meta: { lang, locale, autoTrad }
  }));
}));

// ============================================================================
// ENDPOINTS LEGACY (rétrocompatibilité)
// ============================================================================

/**
 * GET /lego/product/:id (LEGACY)
 * @deprecated Utiliser /lego/details?detailUrl=...
 */
router.get("/product/:id", asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const params = extractStandardParams(req);
  const enrichRebrickable = req.query.enrich_rebrickable === 'true';

  if (!productId) return res.status(400).json({ error: "ID produit manquant" });

  metrics.sources.lego.requests++;
  let result = await getLegoProductDetails(productId, params.locale);
  
  // Ajouter les instructions
  try {
    const instructions = await getBuildingInstructions(productId, params.locale);
    if (instructions && instructions.manuals && instructions.manuals.length > 0) {
      result.instructions = {
        count: instructions.manuals.length,
        manuals: instructions.manuals
      };
    } else {
      result.instructions = { count: 0, manuals: [] };
    }
  } catch (instructionsErr) {
    log.warn(`Instructions non disponibles pour ${productId}: ${instructionsErr.message}`);
    result.instructions = { count: 0, manuals: [], error: instructionsErr.message };
  }
  
  // Enrichir avec Rebrickable si demandé
  if (enrichRebrickable) {
    const apiKey = extractApiKey(req);
    if (apiKey) {
      result.rebrickable_hint = "Enrichissement Rebrickable pas encore implémenté";
    } else {
      result.rebrickable_hint = "Fournissez une clé API Rebrickable via X-Api-Key";
    }
  }
  
  addCacheHeaders(res, 300);
  res.json(result);
}));

/**
 * GET /lego/instructions/:id
 * Instructions de montage pour un set LEGO
 */
router.get("/instructions/:id", asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const params = extractStandardParams(req);

  if (!productId) return res.status(400).json({ error: "ID produit manquant" });

  metrics.sources.lego.requests++;
  const result = await getBuildingInstructions(productId, params.locale);
  addCacheHeaders(res, 300);
  res.json(result);
}));

export default router;
