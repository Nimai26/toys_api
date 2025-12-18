/**
 * Routes Rebrickable - toys_api v3.0.0
 * 
 * Endpoints normalisés :
 * - GET /search : Recherche avec q, lang, max, autoTrad
 * - GET /details : Détails via detailUrl
 * - GET /set/:setNum : (legacy) Détails par numéro de set
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
import { DEFAULT_LOCALE, REBRICKABLE_DEFAULT_MAX } from '../lib/config.js';

import {
  smartRebrickableSearch as smartRebrickableSearchLib,
  getRebrickableSet,
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
 * GET /rebrickable/search
 * Recherche de sets LEGO via Rebrickable
 */
router.get("/search", validateSearchParams, rebrickableAuth, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, page, autoTrad } = req.standardParams;
  const enrichLego = req.query.enrich_lego !== 'false';

  const rawResult = await smartRebrickableSearchLib(q, req.apiKey, {
    page,
    pageSize: max,
    lang: locale,
    enrichWithLego: enrichLego,
    maxParts: 500
  });
  
  // Transformer au format normalisé
  const items = (rawResult.results || []).map(set => ({
    type: 'construct_toy',
    source: 'rebrickable',
    sourceId: set.set_num,
    name: set.name,
    name_original: set.name,
    image: set.set_img_url,
    detailUrl: generateDetailUrl('rebrickable', set.set_num, 'set')
  }));
  
  addCacheHeaders(res, rawResult.type === 'set_id' ? 3600 : 300);
  res.json(formatSearchResponse({
    items,
    provider: 'rebrickable',
    query: q,
    pagination: {
      page,
      pageSize: items.length,
      totalResults: rawResult.count || items.length,
      hasMore: rawResult.next !== null
    },
    meta: { lang, locale, autoTrad, searchType: rawResult.type }
  }));
}));

/**
 * GET /rebrickable/details
 * Détails d'un set via detailUrl
 */
router.get("/details", validateDetailsParams, rebrickableAuth, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  
  const setNum = legoIdToRebrickable(id);
  const enrichLego = req.query.enrich_lego !== 'false';
  
  let result = await getRebrickableSetFullLib(setNum, req.apiKey, {
    includeParts: true,
    includeMinifigs: true,
    maxParts: 500
  });
  
  if (enrichLego) {
    result = await enrichRebrickableWithLego(result, locale);
  }
  
  if (result.set_num && !result.lego_id) {
    result.lego_id = rebrickableIdToLego(result.set_num);
  }
  
  addCacheHeaders(res, 3600);
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
