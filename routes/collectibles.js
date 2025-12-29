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
  getColekaItemDetailsNormalized
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
        // Utiliser le path complet pour avoir toutes les catégories dans l'URL
        detailUrl: item.path ? generateDetailUrl('coleka', encodeURIComponent(item.path), 'item') 
                            : generateDetailUrl('coleka', encodeURIComponent(item.url || item.id), 'item')
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

// Normalisé: /coleka/details (avec cache PostgreSQL)
colekaRouter.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true';

  metrics.sources.coleka.requests++;
  const result = await colekaCache.getWithCache(
    id,
    async () => getColekaItemDetailsNormalized(decodeURIComponent(id), lang),
    { forceRefresh }
  );
  
  addCacheHeaders(res, 300, getCacheInfo());
  res.json(formatDetailResponse({ data: result, provider: 'coleka', id, meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
}));

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
        // Lulu-Berlu nécessite l'URL complète pour le scraping, pas juste l'ID numérique
        detailUrl: item.url ? generateDetailUrl('luluberlu', encodeURIComponent(item.url), 'item') : null
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
    { params: { max, type: searchType }, forceRefresh: refresh }
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

// ----------------------------------------------------------------------------
// Factory pour créer des routers ConsoleVariations par type (consoles, accessories, controllers)
// ----------------------------------------------------------------------------
function createConsoleVariationsTypeRouter(searchType, providerName) {
  const router = Router();
  const typeCache = createProviderCache(providerName, searchType);
  
  // /consolevariations_consoles/search, /consolevariations_accessories/search, etc.
  router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
    const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
    
    metrics.sources.consolevariations.requests++;
    const result = await typeCache.searchWithCache(
      q,
      async () => {
        const rawResult = await searchConsoleVariationsLib(q, max, searchType);
        
        const items = (rawResult.results || rawResult.items || []).map(item => ({
          type: searchType.slice(0, -1), // consoles -> console
          source: providerName,
          sourceId: item.slug || item.id,
          name: item.name || item.title,
          name_original: item.name || item.title,
          description: item.description || null,
          year: item.year || item.releaseYear || null,
          image: item.image,
          src_url: item.slug ? `https://consolevariations.com/variation/${item.slug}` : null,
          platform: item.platform,
          detailUrl: generateDetailUrl(providerName, item.slug || item.id, 'item')
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
      provider: providerName,
      query: q,
      total: result.total,
      meta: { lang, locale, autoTrad, type: searchType }
    }));
  }));
  
  // /consolevariations_consoles/details
  router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
    const { lang, locale, autoTrad } = req.standardParams;
    const { id } = req.parsedDetailUrl;
    const forceRefresh = req.query.refresh === 'true';
    
    metrics.sources.consolevariations.requests++;
    const result = await typeCache.getWithCache(
      id,
      async () => getConsoleVariationsItemNormalized(id, undefined, { lang, autoTrad }),
      { forceRefresh }
    );
    
    addCacheHeaders(res, 300, getCacheInfo());
    res.json(formatDetailResponse({ data: result, provider: providerName, id, meta: { lang, locale, autoTrad } }));
  }));
  
  return router;
}

// Router spécifique pour accessories qui combine accessories + controllers
function createConsoleVariationsAccessoriesRouter() {
  const router = Router();
  const providerName = 'consolevariations_accessories';
  const typeCache = createProviderCache(providerName, 'accessories');
  
  router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
    const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
    
    metrics.sources.consolevariations.requests++;
    const result = await typeCache.searchWithCache(
      q,
      async () => {
        // Rechercher à la fois les accessories et les controllers
        const [accessoriesResult, controllersResult] = await Promise.all([
          searchConsoleVariationsLib(q, max, 'accessories'),
          searchConsoleVariationsLib(q, max, 'controllers')
        ]);
        
        // Combiner les résultats
        const accessoriesItems = (accessoriesResult.results || accessoriesResult.items || []).map(item => ({
          type: 'accessory',
          source: providerName,
          sourceId: item.slug || item.id,
          name: item.name || item.title,
          name_original: item.name || item.title,
          description: item.description || null,
          year: item.year || item.releaseYear || null,
          image: item.image,
          src_url: item.slug ? `https://consolevariations.com/variation/${item.slug}` : null,
          platform: item.platform,
          detailUrl: generateDetailUrl(providerName, item.slug || item.id, 'item')
        }));
        
        const controllersItems = (controllersResult.results || controllersResult.items || []).map(item => ({
          type: 'controller',
          source: providerName,
          sourceId: item.slug || item.id,
          name: item.name || item.title,
          name_original: item.name || item.title,
          description: item.description || null,
          year: item.year || item.releaseYear || null,
          image: item.image,
          src_url: item.slug ? `https://consolevariations.com/variation/${item.slug}` : null,
          platform: item.platform,
          detailUrl: generateDetailUrl(providerName, item.slug || item.id, 'item')
        }));
        
        // Fusionner, dédupliquer par sourceId et limiter au max demandé
        // Les controllers ont priorité sur accessories pour le type
        const seenIds = new Set();
        const allItems = [];
        
        // D'abord les controllers (ils gardent leur type "controller")
        for (const item of controllersItems) {
          if (!seenIds.has(item.sourceId)) {
            seenIds.add(item.sourceId);
            allItems.push(item);
          }
        }
        
        // Ensuite les accessories (on skip les doublons)
        for (const item of accessoriesItems) {
          if (!seenIds.has(item.sourceId)) {
            seenIds.add(item.sourceId);
            allItems.push(item);
          }
        }
        
        const total = allItems.length;
        
        return { results: allItems.slice(0, max), total };
      },
      { params: { max }, forceRefresh: refresh }
    );
    
    // Traduire les descriptions si autoTrad est activé (après le cache)
    const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
    
    addCacheHeaders(res, 300, getCacheInfo());
    res.json(formatSearchResponse({
      items: translatedResults,
      provider: providerName,
      query: q,
      total: result.total,
      meta: { lang, locale, autoTrad, type: 'accessories+controllers' }
    }));
  }));
  
  // /consolevariations_accessories/details
  router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
    const { lang, locale, autoTrad } = req.standardParams;
    const { id } = req.parsedDetailUrl;
    const forceRefresh = req.query.refresh === 'true';
    
    metrics.sources.consolevariations.requests++;
    const result = await typeCache.getWithCache(
      id,
      async () => getConsoleVariationsItemNormalized(id, undefined, { lang, autoTrad }),
      { forceRefresh }
    );
    
    addCacheHeaders(res, 300, getCacheInfo());
    res.json(formatDetailResponse({ data: result, provider: providerName, id, meta: { lang, locale, autoTrad } }));
  }));
  
  return router;
}

// Routers spécifiques par type
export const consolevariationsConsolesRouter = createConsoleVariationsTypeRouter('consoles', 'consolevariations_consoles');
export const consolevariationsAccessoriesRouter = createConsoleVariationsAccessoriesRouter();

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
      
      const items = (rawResult.results || rawResult.items || []).map(item => {
        // Pour show_parent_g12.php, l'ID est le toyid numérique
        // L'URL de détail sera: /show_parent_g12.php?action=show_parent&toyid=XXX
        const toyId = item.id;
        
        return {
          type: 'collectible',
          source: 'transformerland',
          sourceId: toyId,
          name: item.name || item.title,
          name_original: item.name || item.title,
          description: item.series ? `${item.series}${item.subgroup ? ' - ' + item.subgroup : ''}` : null,
          series: item.series || null,
          subgroup: item.subgroup || null,
          allegiance: item.allegiance || null,
          year: item.year || null,
          image: item.image,
          src_url: item.url || null,
          detailUrl: generateDetailUrl('transformerland', toyId, 'item')
        };
      });
      
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
  
  // Décoder l'ID qui peut être un chemin encodé (ex: %2Fstore%2Fitem%2Fslug%2F123%2F)
  const decodedId = decodeURIComponent(id);
  
  metrics.sources.transformerland.requests++;
  const result = await transformerlandCache.getWithCache(
    decodedId,
    async () => getTransformerlandItemDetailsNormalized(decodedId, { lang, autoTrad }),
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
  const result = await getTransformerlandItemDetailsNormalized(id, { lang, autoTrad });
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
