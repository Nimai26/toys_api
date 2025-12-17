/**
 * Routes Collectibles - toys_api
 * Routers séparés pour Coleka, Lulu-Berlu, ConsoleVariations, Transformerland
 */

import { Router } from 'express';
import { metrics, addCacheHeaders, asyncHandler, isAutoTradEnabled } from '../lib/utils/index.js';
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

colekaRouter.get("/search", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const nbpp = req.query.nbpp ? parseInt(req.query.nbpp, 10) : COLEKA_DEFAULT_NBPP;
  const lang = req.query.lang || "fr";

  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  metrics.sources.coleka.requests++;
  const result = await searchColekaLib(q, nbpp, lang);
  addCacheHeaders(res, 300);
  res.json(result);
}));

// NOTE: Les endpoints /coleka/item sont désactivés car la fonction getColekaItemDetails
// n'a jamais été implémentée. Seule la recherche /coleka/search est disponible.

// ============================================================================
// LULU-BERLU ROUTER
// ============================================================================
export const luluberluRouter = Router();

luluberluRouter.get("/search", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const max = req.query.max ? parseInt(req.query.max, 10) : LULUBERLU_DEFAULT_MAX;

  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  metrics.sources.luluberlu.requests++;
  const result = await searchLuluBerluLib(q, max);
  addCacheHeaders(res, 300);
  res.json(result);
}));

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

consolevariationsRouter.get("/search", asyncHandler(async (req, res) => {
  const { q, query, max, type } = req.query;
  const searchTerm = q || query;
  const maxResults = max ? parseInt(max) : CONSOLEVARIATIONS_DEFAULT_MAX;
  const searchType = type || 'all';
  
  if (!searchTerm) {
    return res.status(400).json({ error: "Paramètre 'q' ou 'query' manquant" });
  }
  
  if (!['all', 'consoles', 'controllers', 'accessories'].includes(searchType)) {
    return res.status(400).json({ 
      error: "Paramètre 'type' invalide", 
      validValues: ['all', 'consoles', 'controllers', 'accessories'] 
    });
  }
  
  metrics.sources.consolevariations.requests++;
  const result = await searchConsoleVariationsLib(searchTerm, maxResults, searchType);
  addCacheHeaders(res, 300);
  res.json(result);
}));

consolevariationsRouter.get("/item/:slug", asyncHandler(async (req, res) => {
  const { slug } = req.params;
  
  if (!slug) {
    return res.status(400).json({ error: "Paramètre 'slug' manquant" });
  }
  
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
  
  if (!platform) {
    return res.status(400).json({ error: "Paramètre 'platform' manquant" });
  }
  
  metrics.sources.consolevariations.requests++;
  const result = await browseConsoleVariationsPlatform(platform, maxResults);
  addCacheHeaders(res, 300);
  res.json(result);
}));

// ============================================================================
// TRANSFORMERLAND ROUTER
// ============================================================================
export const transformerlandRouter = Router();

transformerlandRouter.get("/search", asyncHandler(async (req, res) => {
  const { q, term, max } = req.query;
  const searchTerm = q || term;
  const maxResults = max ? parseInt(max) : TRANSFORMERLAND_DEFAULT_MAX;
  
  if (!searchTerm) {
    return res.status(400).json({ error: "paramètre 'q' ou 'term' manquant" });
  }
  
  metrics.sources.transformerland.requests++;
  const result = await searchTransformerlandLib(searchTerm, maxResults);
  addCacheHeaders(res, 300);
  res.json(result);
}));

transformerlandRouter.get("/item/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "Paramètre 'id' manquant" });
  }
  
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

paninimanaRouter.get("/search", asyncHandler(async (req, res) => {
  const { q, term, max } = req.query;
  const searchTerm = q || term;
  const maxResults = max ? parseInt(max) : PANINIMANIA_DEFAULT_MAX;
  
  if (!searchTerm) {
    return res.status(400).json({ error: "paramètre 'q' ou 'term' manquant" });
  }
  
  metrics.sources.paninimania.requests++;
  const result = await searchPaninimanaLib(searchTerm, maxResults);
  addCacheHeaders(res, 300);
  res.json(result);
}));

paninimanaRouter.get("/album/:id", asyncHandler(async (req, res) => {
  const albumId = req.params.id;
  
  if (!albumId) {
    return res.status(400).json({ error: "paramètre 'id' manquant" });
  }
  
  metrics.sources.paninimania.requests++;
  const result = await getPaninimanialbumDetails(albumId);
  addCacheHeaders(res, 300);
  res.json(result);
}));

paninimanaRouter.get("/album", asyncHandler(async (req, res) => {
  const { url, id } = req.query;
  const albumId = id || url;
  
  if (!albumId) {
    return res.status(400).json({ error: "paramètre 'id' ou 'url' manquant" });
  }
  
  metrics.sources.paninimania.requests++;
  const result = await getPaninimanialbumDetails(albumId);
  addCacheHeaders(res, 300);
  res.json(result);
}));

// Export par défaut pour compatibilité (on exporte le router coleka)
export default colekaRouter;
