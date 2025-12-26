/**
 * Routes Collectibles - toys_api v4.0.0
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
  formatDetailResponse,
  translateSearchDescriptions
} from '../lib/utils/index.js';
import { COLEKA_DEFAULT_NBPP, LULUBERLU_DEFAULT_MAX, CONSOLEVARIATIONS_DEFAULT_MAX, TRANSFORMERLAND_DEFAULT_MAX, PANINIMANIA_DEFAULT_MAX } from '../lib/config.js';
import { createProviderCache, getCacheInfo } from '../lib/database/cache-wrapper.js';

import {
  searchColeka as searchColekaLib,
  getColekaItemDetails
} from '../lib/providers/coleka.js';
import {
  searchLuluBerlu as searchLuluBerluLib,
  getLuluBerluItemDetailsNormalized
} from '../lib/providers/luluberlu.js';
import {
  searchConsoleVariations as searchConsoleVariationsLib,
  getConsoleVariationsItemNormalized,
  listConsoleVariationsPlatforms,
  browseConsoleVariationsPlatform
} from '../lib/providers/consolevariations.js';
import {
  searchTransformerland as searchTransformerlandLib,
  getTransformerlandItemDetailsNormalized
} from '../lib/providers/transformerland.js';
import {
  searchPaninimania as searchPaninimanaLib,
  getPaninimanialbumDetailsNormalized
} from '../lib/providers/paninimania.js';

// Caches PostgreSQL pour les collectibles
const colekaCache = createProviderCache('coleka', 'collectible');
const luluberluCache = createProviderCache('luluberlu', 'collectible');
const consolevariationsCache = createProviderCache('consolevariations', 'collectible');
const transformerlandCache = createProviderCache('transformerland', 'collectible');
const paninimanaCache = createProviderCache('paninimania', 'album');

// ============================================================================
// COLEKA ROUTER
// ============================================================================
export const colekaRouter = Router();

// Normalisé: /coleka/search (avec cache PostgreSQL)
colekaRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  const nbpp = req.query.nbpp ? parseInt(req.query.nbpp, 10) : max;

  metrics.sources.coleka.requests++;
  const result = await colekaCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchColekaLib(q, nbpp, lang);
      
      const items = (rawResult.products || rawResult.results || rawResult.items || []).map(item => ({
        type: 'collectible',
        source: 'coleka',
        sourceId: item.id,
        name: item.name || item.title,
        name_original: item.name || item.title,
        description: item.description || null,
        year: item.year || null,
        image: item.image,
        src_url: item.url || null,
        url: item.url,
        category: item.category,
        collection: item.collection,
        detailUrl: generateDetailUrl('coleka', item.id, 'item')
      }));
      
      return { results: items, total: rawResult.total || items.length };
    },
    { params: { nbpp, lang }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'coleka',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// NOTE: Les endpoints /coleka/details sont désactivés car la fonction getColekaItemDetails
// n'a jamais été implémentée. Seule la recherche /coleka/search est disponible.

// ============================================================================
// LULU-BERLU ROUTER
// ============================================================================
export const luluberluRouter = Router();

// Normalisé: /luluberlu/search (avec cache PostgreSQL)
luluberluRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;

  metrics.sources.luluberlu.requests++;
  const result = await luluberluCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchLuluBerluLib(q, max);
      
      const items = (rawResult.products || rawResult.results || rawResult.items || []).map(item => ({
        type: 'collectible',
        source: 'luluberlu',
        sourceId: item.id || item.url,
        name: item.name || item.title,
        name_original: item.name || item.title,
        description: item.description || null,
        year: item.year || null,
        image: item.image,
        src_url: item.url || null,
        price: item.price,
        url: item.url,
        detailUrl: generateDetailUrl('luluberlu', item.id || encodeURIComponent(item.url), 'item')
      }));
      
      return { results: items, total: rawResult.total || items.length };
    },
    { params: { max }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'luluberlu',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Normalisé: /luluberlu/details (avec cache PostgreSQL)
luluberluRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true';

  metrics.sources.luluberlu.requests++;
  const result = await luluberluCache.getWithCache(
    id,
    async () => getLuluBerluItemDetailsNormalized(decodeURIComponent(id)),
    { forceRefresh }
  );
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'luluberlu', id, meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
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

// Normalisé: /consolevariations/search (avec cache PostgreSQL)
consolevariationsRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  const searchType = req.query.type || 'all';
  
  if (!['all', 'consoles', 'controllers', 'accessories'].includes(searchType)) {
    return res.status(400).json({ 
      error: "Paramètre 'type' invalide", 
      validValues: ['all', 'consoles', 'controllers', 'accessories'] 
    });
  }
  
  metrics.sources.consolevariations.requests++;
  const result = await consolevariationsCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchConsoleVariationsLib(q, max, searchType);
      
      const items = (rawResult.results || rawResult.items || []).map(item => ({
        type: searchType === 'all' ? 'collectible' : searchType.slice(0, -1),
        source: 'consolevariations',
        sourceId: item.slug || item.id,
        name: item.name || item.title,
        name_original: item.name || item.title,
        description: item.description || null,
        year: item.year || item.releaseYear || null,
        image: item.image,
        src_url: item.slug ? `https://consolevariations.com/variation/${item.slug}` : null,
        platform: item.platform,
        detailUrl: generateDetailUrl('consolevariations', item.slug || item.id, 'item')
      }));
      
      return { results: items, total: rawResult.total || items.length };
    },
    { params: { max, type: searchType } }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'consolevariations',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad, type: searchType }
  }));
}));

// Normalisé: /consolevariations/details (avec cache PostgreSQL)
consolevariationsRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true';
  
  metrics.sources.consolevariations.requests++;
  const result = await consolevariationsCache.getWithCache(
    id,
    async () => getConsoleVariationsItemNormalized(id, undefined, { lang, autoTrad }),
    { forceRefresh }
  );
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'consolevariations', id, meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
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

// Normalisé: /transformerland/search (avec cache PostgreSQL)
transformerlandRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  
  metrics.sources.transformerland.requests++;
  const result = await transformerlandCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchTransformerlandLib(q, max);
      
      const items = (rawResult.results || rawResult.items || []).map(item => ({
        type: 'collectible',
        source: 'transformerland',
        sourceId: item.id,
        name: item.name || item.title,
        name_original: item.name || item.title,
        description: item.description || null,
        year: item.year || null,
        image: item.image,
        src_url: item.url || null,
        detailUrl: generateDetailUrl('transformerland', item.id, 'item')
      }));
      
      return { results: items, total: rawResult.total || items.length };
    },
    { params: { max }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'transformerland',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Normalisé: /transformerland/details (avec cache PostgreSQL)
transformerlandRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true';
  
  metrics.sources.transformerland.requests++;
  const result = await transformerlandCache.getWithCache(
    id,
    async () => getTransformerlandItemDetailsNormalized(id, undefined, { lang, autoTrad }),
    { forceRefresh }
  );
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'transformerland', id, meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
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

// Normalisé: /paninimania/search (avec cache PostgreSQL)
paninimanaRouter.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  
  metrics.sources.paninimania.requests++;
  const result = await paninimanaCache.searchWithCache(
    q,
    async () => {
      const rawResult = await searchPaninimanaLib(q, max);
      
      const items = (rawResult.results || rawResult.albums || []).map(item => ({
        type: 'album',
        source: 'paninimania',
        sourceId: item.id,
        name: item.name || item.title,
        name_original: item.name || item.title,
        description: item.description || null,
        year: item.year,
        image: item.image,
        src_url: item.url || null,
        detailUrl: generateDetailUrl('paninimania', item.id, 'album')
      }));
      
      return { results: items, total: rawResult.total || items.length };
    },
    { params: { max }, forceRefresh: refresh }
  );
  
  // Traduire les descriptions si autoTrad est activé (après le cache)
  const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: translatedResults,
    provider: 'paninimania',
    query: q,
    total: result.total,
    meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

// Normalisé: /paninimania/details (avec cache PostgreSQL)
paninimanaRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true';
  
  metrics.sources.paninimania.requests++;
  const result = await paninimanaCache.getWithCache(
    id,
    async () => getPaninimanialbumDetailsNormalized(id),
    { forceRefresh }
  );
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'paninimania', id, meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
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
