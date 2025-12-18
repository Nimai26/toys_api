/**
 * Routes Collectibles - toys_api v3.0.0
 * Routers séparés pour Coleka, Lulu-Berlu, ConsoleVariations, Transformerland
 */

import { Router } from 'express';
import { 
  metrics, 
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
import { COLEKA_DEFAULT_NBPP, LULUBERLU_DEFAULT_MAX, CONSOLEVARIATIONS_DEFAULT_MAX, TRANSFORMERLAND_DEFAULT_MAX, PANINIMANIA_DEFAULT_MAX } from '../lib/config.js';

import {
  searchColeka as searchColekaLib,
  getColekaItemDetails
} from '../lib/providers/coleka.js';
import {
  searchLuluBerlu as searchLuluBerluLib,
  getLuluBerluItemDetails
} from '../lib/providers/luluberlu.js';
import {
  searchConsoleVariations as searchConsoleVariationsLib,
  getConsoleVariationsItem,
  listConsoleVariationsPlatforms,
  browseConsoleVariationsPlatform
} from '../lib/providers/consolevariations.js';
import {
  searchTransformerland as searchTransformerlandLib,
  getTransformerlandItemDetails
} from '../lib/providers/transformerland.js';
import {
  searchPaninimania as searchPaninimanaLib,
  getPaninimanialbumDetails
} from '../lib/providers/paninimania.js';

// ============================================================================
// COLEKA ROUTER
// ============================================================================
export const colekaRouter = Router();

// Normalisé: /coleka/search
colekaRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  const nbpp = req.query.nbpp ? parseInt(req.query.nbpp, 10) : max;

  metrics.sources.coleka.requests++;
  const rawResult = await searchColekaLib(q, nbpp, lang);
  
  const items = (rawResult.results || rawResult.items || []).map(item => ({
    type: 'collectible',
    source: 'coleka',
    sourceId: item.id,
    name: item.name || item.title,
    name_original: item.name || item.title,
    image: item.image,
    detailUrl: generateDetailUrl('coleka', item.id, 'item')
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'coleka',
    query: q,
    meta: { lang, locale, autoTrad }
  }));
}));

// NOTE: Les endpoints /coleka/details sont désactivés car la fonction getColekaItemDetails
// n'a jamais été implémentée. Seule la recherche /coleka/search est disponible.

// ============================================================================
// LULU-BERLU ROUTER
// ============================================================================
export const luluberluRouter = Router();

// Normalisé: /luluberlu/search
luluberluRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;

  metrics.sources.luluberlu.requests++;
  const rawResult = await searchLuluBerluLib(q, max);
  
  const items = (rawResult.results || rawResult.items || []).map(item => ({
    type: 'collectible',
    source: 'luluberlu',
    sourceId: item.id || item.url,
    name: item.name || item.title,
    name_original: item.name || item.title,
    image: item.image,
    price: item.price,
    detailUrl: generateDetailUrl('luluberlu', item.id || encodeURIComponent(item.url), 'item')
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'luluberlu',
    query: q,
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /luluberlu/details
luluberluRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;

  metrics.sources.luluberlu.requests++;
  const result = await getLuluBerluItemDetails(decodeURIComponent(id));
  
  addCacheHeaders(res, 300);
  res.json(formatDetailResponse({ data: result, provider: 'luluberlu', id, meta: { lang, locale, autoTrad } }));
}));

// Legacy
luluberluRouter.get("/item/:id", asyncHandler(async (req, res) => {
  const itemId = req.params.id;
  if (!itemId) return res.status(400).json({ error: "ID item manquant" });

  metrics.sources.luluberlu.requests++;
  const result = await getLuluBerluItemDetails(itemId);
  addCacheHeaders(res, 300);
  res.json(result);
}));

luluberluRouter.get("/item", asyncHandler(async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "paramètre 'url' manquant" });

  metrics.sources.luluberlu.requests++;
  const result = await getLuluBerluItemDetails(url);
  addCacheHeaders(res, 300);
  res.json(result);
}));

// ============================================================================
// CONSOLEVARIATIONS ROUTER
// ============================================================================
export const consolevariationsRouter = Router();

// Normalisé: /consolevariations/search
consolevariationsRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  const searchType = req.query.type || 'all';
  
  if (!['all', 'consoles', 'controllers', 'accessories'].includes(searchType)) {
    return res.status(400).json({ 
      error: "Paramètre 'type' invalide", 
      validValues: ['all', 'consoles', 'controllers', 'accessories'] 
    });
  }
  
  metrics.sources.consolevariations.requests++;
  const rawResult = await searchConsoleVariationsLib(q, max, searchType);
  
  const items = (rawResult.results || rawResult.items || []).map(item => ({
    type: searchType === 'all' ? 'collectible' : searchType.slice(0, -1),
    source: 'consolevariations',
    sourceId: item.slug || item.id,
    name: item.name || item.title,
    name_original: item.name || item.title,
    image: item.image,
    platform: item.platform,
    detailUrl: generateDetailUrl('consolevariations', item.slug || item.id, 'item')
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'consolevariations',
    query: q,
    meta: { lang, locale, autoTrad, type: searchType }
  }));
}));

// Normalisé: /consolevariations/details
consolevariationsRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  
  metrics.sources.consolevariations.requests++;
  const result = await getConsoleVariationsItem(id, undefined, { lang, autoTrad });
  
  addCacheHeaders(res, 300);
  res.json(formatDetailResponse({ data: result, provider: 'consolevariations', id, meta: { lang, locale, autoTrad } }));
}));

// Legacy
consolevariationsRouter.get("/item/:slug", asyncHandler(async (req, res) => {
  const { slug } = req.params;
  if (!slug) return res.status(400).json({ error: "Paramètre 'slug' manquant" });
  
  const autoTrad = isAutoTradEnabled(req);
  const lang = req.query.lang || 'en';
  
  metrics.sources.consolevariations.requests++;
  const result = await getConsoleVariationsItem(slug, undefined, { lang, autoTrad });
  addCacheHeaders(res, 300);
  res.json(result);
}));

consolevariationsRouter.get("/platforms", asyncHandler(async (req, res) => {
  const { brand } = req.query;
  
  metrics.sources.consolevariations.requests++;
  const result = await listConsoleVariationsPlatforms(brand);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

consolevariationsRouter.get("/browse/:platform", asyncHandler(async (req, res) => {
  const { platform } = req.params;
  const { max } = req.query;
  const maxResults = max ? parseInt(max) : CONSOLEVARIATIONS_DEFAULT_MAX;
  
  if (!platform) return res.status(400).json({ error: "Paramètre 'platform' manquant" });
  
  metrics.sources.consolevariations.requests++;
  const result = await browseConsoleVariationsPlatform(platform, maxResults);
  addCacheHeaders(res, 300);
  res.json(result);
}));

// ============================================================================
// TRANSFORMERLAND ROUTER
// ============================================================================
export const transformerlandRouter = Router();

// Normalisé: /transformerland/search
transformerlandRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  
  metrics.sources.transformerland.requests++;
  const rawResult = await searchTransformerlandLib(q, max);
  
  const items = (rawResult.results || rawResult.items || []).map(item => ({
    type: 'collectible',
    source: 'transformerland',
    sourceId: item.id,
    name: item.name || item.title,
    name_original: item.name || item.title,
    image: item.image,
    detailUrl: generateDetailUrl('transformerland', item.id, 'item')
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'transformerland',
    query: q,
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /transformerland/details
transformerlandRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  
  metrics.sources.transformerland.requests++;
  const result = await getTransformerlandItemDetails(id, undefined, { lang, autoTrad });
  
  addCacheHeaders(res, 300);
  res.json(formatDetailResponse({ data: result, provider: 'transformerland', id, meta: { lang, locale, autoTrad } }));
}));

// Legacy
transformerlandRouter.get("/item/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Paramètre 'id' manquant" });
  
  const autoTrad = isAutoTradEnabled(req);
  const lang = req.query.lang || 'en';
  
  metrics.sources.transformerland.requests++;
  const result = await getTransformerlandItemDetails(id, undefined, { lang, autoTrad });
  addCacheHeaders(res, 300);
  res.json(result);
}));

// ============================================================================
// PANINIMANIA ROUTER
// ============================================================================
export const paninimanaRouter = Router();

// Normalisé: /paninimania/search
paninimanaRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad } = req.standardParams;
  
  metrics.sources.paninimania.requests++;
  const rawResult = await searchPaninimanaLib(q, max);
  
  const items = (rawResult.results || rawResult.albums || []).map(item => ({
    type: 'album',
    source: 'paninimania',
    sourceId: item.id,
    name: item.name || item.title,
    name_original: item.name || item.title,
    image: item.image,
    year: item.year,
    detailUrl: generateDetailUrl('paninimania', item.id, 'album')
  }));
  
  addCacheHeaders(res, 300);
  res.json(formatSearchResponse({
    items,
    provider: 'paninimania',
    query: q,
    meta: { lang, locale, autoTrad }
  }));
}));

// Normalisé: /paninimania/details
paninimanaRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  
  metrics.sources.paninimania.requests++;
  const result = await getPaninimanialbumDetails(id);
  
  addCacheHeaders(res, 300);
  res.json(formatDetailResponse({ data: result, provider: 'paninimania', id, meta: { lang, locale, autoTrad } }));
}));

// Legacy
paninimanaRouter.get("/album/:id", asyncHandler(async (req, res) => {
  const albumId = req.params.id;
  if (!albumId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  
  metrics.sources.paninimania.requests++;
  const result = await getPaninimanialbumDetails(albumId);
  addCacheHeaders(res, 300);
  res.json(result);
}));

paninimanaRouter.get("/album", asyncHandler(async (req, res) => {
  const { url, id } = req.query;
  const albumId = id || url;
  if (!albumId) return res.status(400).json({ error: "paramètre 'id' ou 'url' manquant" });
  
  metrics.sources.paninimania.requests++;
  const result = await getPaninimanialbumDetails(albumId);
  addCacheHeaders(res, 300);
  res.json(result);
}));

// Export par défaut pour compatibilité (on exporte le router coleka)
export default colekaRouter;
