/**
 * Routes Rebrickable - toys_api v4.0.0
 * 
 * Endpoints normalisés :
 * - GET /search : Recherche avec q, lang, max, autoTrad
 * - GET /details : Détails via detailUrl (avec cache PostgreSQL)
 * - GET /set/:setNum : (legacy) Détails par numéro de set
 * 
 * Note: Les termes de recherche sont automatiquement traduits en anglais
 * car Rebrickable indexe uniquement en anglais.
 */

import { Router } from 'express';
import { 
  addCacheHeaders, 
  asyncHandler, 
  requireParam, 
  requireApiKey,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams,
  generateDetailUrl,
  formatSearchResponse,
  formatDetailResponse
} from '../lib/utils/index.js';
import { translateToEnglish } from '../lib/utils/translator.js';
import { DEFAULT_LOCALE, REBRICKABLE_DEFAULT_MAX } from '../lib/config.js';
import { createProviderCache, getCacheInfo } from '../lib/database/cache-wrapper.js';
import { createLogger } from '../lib/utils/logger.js';

const log = createLogger('Route:Rebrickable');

// Cache PostgreSQL pour Rebrickable
const rebrickableCache = createProviderCache('rebrickable', 'construct_toy');

import {
  smartRebrickableSearch as smartRebrickableSearchLib,
  getRebrickableSet,
  getRebrickableSetNormalized,
  getRebrickableSetFull as getRebrickableSetFullLib,
  getRebrickableSetParts,
  getRebrickableSetMinifigs,
  getRebrickableThemes,
  getRebrickableColors,
  enrichRebrickableWithLego,
  legoIdToRebrickable,
  rebrickableIdToLego
} from '../lib/providers/rebrickable.js';

const router = Router();
const rebrickableAuth = requireApiKey('Rebrickable', 'https://rebrickable.com/api/');


// ============================================================================
// ENDPOINTS NORMALISÉS v3.0.0
// ============================================================================

/**
 * GET /rebrickable/search (avec cache PostgreSQL)
 * Recherche de sets LEGO via Rebrickable
 * 
 * Note: Le terme de recherche est automatiquement traduit en anglais
 * car Rebrickable indexe uniquement en anglais.
 */
router.get("/search", validateSearchParams, rebrickableAuth, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, page, autoTrad } = req.standardParams;
  const enrichLego = req.query.enrich_lego !== 'false';
  
  // Traduire le terme de recherche en anglais (Rebrickable indexe en anglais)
  const translation = await translateToEnglish(q, lang);
  const searchQuery = translation.text;
  const wasTranslated = translation.translated;
  
  if (wasTranslated) {
    log.info(`Recherche traduite: "${q}" → "${searchQuery}"`);
  } else {
    log.info(`Recherche: "${q}" (lang=${lang}, max=${max})`);
  }

  const result = await rebrickableCache.searchWithCache(
    searchQuery, // Utiliser le terme traduit pour le cache et la recherche
    async () => {
      const rawResult = await smartRebrickableSearchLib(searchQuery, req.apiKey, {
        page,
        pageSize: max,
        lang: locale,
        enrichWithLego: enrichLego,
        maxParts: 500
      });
      
      let items = [];
      let totalResults = 0;
      let hasMore = false;
      let searchType = rawResult.type;
      
      if (rawResult.type === 'set_id') {
        items = [{
          type: 'construct_toy',
          source: 'rebrickable',
          sourceId: rawResult.set_num,
          name: rawResult.name,
          name_original: rawResult.name,
          description: null,
          year: rawResult.year,
          image: rawResult.set_img_url,
          src_url: `https://rebrickable.com/sets/${rawResult.set_num}/`,
          num_parts: rawResult.num_parts,
          num_minifigs: rawResult.minifigs?.length || 0,
          detailUrl: generateDetailUrl('rebrickable', rawResult.set_num, 'set')
        }];
        totalResults = 1;
      } else {
        items = (rawResult.sets || rawResult.results || []).map(set => ({
          type: 'construct_toy',
          source: 'rebrickable',
          sourceId: set.set_num,
          name: set.name,
          name_original: set.name,
          description: null,
          year: set.year,
          image: set.set_img_url,
          src_url: `https://rebrickable.com/sets/${set.set_num}/`,
          num_parts: set.num_parts,
          detailUrl: generateDetailUrl('rebrickable', set.set_num, 'set')
        }));
        totalResults = rawResult.pagination?.total_count || rawResult.count || items.length;
        hasMore = rawResult.pagination?.has_next || rawResult.next !== null;
      }
      
      return { results: items, total: totalResults, hasMore, searchType };
    },
    { params: { page, max, locale, enrichLego } }
  );
  
  addCacheHeaders(res, result.searchType === 'set_id' ? 3600 : 300, getCacheInfo());
  res.json(formatSearchResponse({
    items: result.results || [],
    provider: 'rebrickable',
    query: q, // Terme original (celui demandé par l'utilisateur)
    total: result.total,
    pagination: {
      page,
      pageSize: (result.results || []).length,
      totalResults: result.total,
      hasMore: result.hasMore || false
    },
    meta: { 
      lang, 
      locale, 
      autoTrad, 
      searchType: result.searchType,
      // Informations de traduction
      queryTranslated: wasTranslated,
      queryEnglish: wasTranslated ? searchQuery : undefined,
      queryOriginal: wasTranslated ? q : undefined
    }
  }));
}));

/**
 * GET /rebrickable/details
 * Détails d'un set via detailUrl (avec cache PostgreSQL)
 */
router.get("/details", validateDetailsParams, rebrickableAuth, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true';
  
  const setNum = legoIdToRebrickable(id);
  const enrichLego = req.query.enrich_lego !== 'false';
  
  // Utiliser le cache PostgreSQL
  let result = await rebrickableCache.getWithCache(
    setNum,
    async () => {
      let data = await getRebrickableSetNormalized(setNum, req.apiKey, {
        includeParts: true,
        includeMinifigs: true,
        maxParts: 500
      });
      
      if (enrichLego) {
        data = await enrichRebrickableWithLego(data, locale);
      }
      
      if (data.sourceId && !data.lego_id) {
        data.lego_id = rebrickableIdToLego(data.sourceId);
      }
      
      return data;
    },
    { forceRefresh }
  );
  
  addCacheHeaders(res, 3600, getCacheInfo());
  res.json(formatDetailResponse({
    data: result,
    provider: 'rebrickable',
    id: setNum,
    meta: { lang, locale, autoTrad }
  }));
}));

// ============================================================================
// ENDPOINTS LEGACY (rétrocompatibilité)
// ============================================================================

router.get("/set/:setNum", rebrickableAuth, asyncHandler(async (req, res) => {
  let setNum = req.params.setNum;
  const params = extractStandardParams(req);
  const includeParts = req.query.parts !== 'false';
  const includeMinifigs = req.query.minifigs !== 'false';
  const enrichLego = req.query.enrich_lego !== 'false';
  const maxParts = req.query.parts_limit ? parseInt(req.query.parts_limit, 10) : 500;
  
  if (!setNum) return res.status(400).json({ error: "paramètre 'setNum' manquant" });
  
  setNum = legoIdToRebrickable(setNum);
  
  let result;
  if (includeParts || includeMinifigs) {
    result = await getRebrickableSetFullLib(setNum, req.apiKey, { includeParts, includeMinifigs, maxParts });
  } else {
    result = await getRebrickableSet(setNum, req.apiKey);
  }
  
  if (enrichLego) {
    result = await enrichRebrickableWithLego(result, params.locale);
  }
  
  if (result.set_num && !result.lego_id) {
    result.lego_id = rebrickableIdToLego(result.set_num);
  }
  
  addCacheHeaders(res, 3600);
  res.json(result);
}));

router.get("/set/:setNum/parts", rebrickableAuth, asyncHandler(async (req, res) => {
  const setNum = req.params.setNum;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 500;
  
  if (!setNum) return res.status(400).json({ error: "paramètre 'setNum' manquant" });
  
  const result = await getRebrickableSetParts(setNum, req.apiKey, limit);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

router.get("/set/:setNum/minifigs", rebrickableAuth, asyncHandler(async (req, res) => {
  const setNum = req.params.setNum;
  if (!setNum) return res.status(400).json({ error: "paramètre 'setNum' manquant" });
  
  const result = await getRebrickableSetMinifigs(setNum, req.apiKey);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

router.get("/themes", rebrickableAuth, asyncHandler(async (req, res) => {
  const parentId = req.query.parent_id ? parseInt(req.query.parent_id, 10) : null;
  const result = await getRebrickableThemes(req.apiKey, parentId);
  addCacheHeaders(res, 86400);
  res.json(result);
}));

router.get("/colors", rebrickableAuth, asyncHandler(async (req, res) => {
  const result = await getRebrickableColors(req.apiKey);
  addCacheHeaders(res, 86400);
  res.json(result);
}));

export default router;
