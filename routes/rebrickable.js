/**
 * Routes Rebrickable - toys_api v2.0.0
 * Endpoints pour l'API Rebrickable (sets, pièces, minifigs, thèmes)
 */

import { Router } from 'express';
import { addCacheHeaders, asyncHandler, requireParam, requireApiKey } from '../lib/utils/index.js';
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

// Middleware commun pour toutes les routes Rebrickable
const rebrickableAuth = requireApiKey('Rebrickable', 'https://rebrickable.com/api/');

// -----------------------------
// Endpoints Rebrickable (nécessite clé API)
// -----------------------------

// Recherche de sets LEGO via Rebrickable
router.get("/search", requireParam('q'), rebrickableAuth, asyncHandler(async (req, res) => {
  const q = req.query.q;
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const pageSize = req.query.page_size ? parseInt(req.query.page_size, 10) : REBRICKABLE_DEFAULT_MAX;
  const lang = req.query.lang || DEFAULT_LOCALE;
  const enrichLego = req.query.enrich_lego !== 'false';
  const themeId = req.query.theme_id ? parseInt(req.query.theme_id, 10) : undefined;
  const minYear = req.query.min_year ? parseInt(req.query.min_year, 10) : undefined;
  const maxYear = req.query.max_year ? parseInt(req.query.max_year, 10) : undefined;
  const minParts = req.query.min_parts ? parseInt(req.query.min_parts, 10) : undefined;
  const maxPartsFilter = req.query.max_parts ? parseInt(req.query.max_parts, 10) : undefined;
  const maxPartsLimit = req.query.parts_limit ? parseInt(req.query.parts_limit, 10) : 500;
  
  const searchOptions = {};
  if (themeId) searchOptions.theme_id = themeId;
  if (minYear) searchOptions.min_year = minYear;
  if (maxYear) searchOptions.max_year = maxYear;
  if (minParts) searchOptions.min_parts = minParts;
  if (maxPartsFilter) searchOptions.max_parts = maxPartsFilter;
  
  const result = await smartRebrickableSearchLib(q, req.apiKey, {
    page,
    pageSize,
    lang,
    enrichWithLego: enrichLego,
    maxParts: maxPartsLimit,
    searchOptions
  });
  
  const cacheTime = result.type === 'set_id' ? 3600 : 300;
  addCacheHeaders(res, cacheTime);
  res.json(result);
}));

// Détails d'un set LEGO via Rebrickable
router.get("/set/:setNum", rebrickableAuth, asyncHandler(async (req, res) => {
  let setNum = req.params.setNum;
  const includeParts = req.query.parts !== 'false';
  const includeMinifigs = req.query.minifigs !== 'false';
  const enrichLego = req.query.enrich_lego !== 'false';
  const lang = req.query.lang || DEFAULT_LOCALE;
  const maxParts = req.query.parts_limit ? parseInt(req.query.parts_limit, 10) : 500;
  
  if (!setNum) return res.status(400).json({ error: "paramètre 'setNum' manquant" });
  
  setNum = legoIdToRebrickable(setNum);
  
  let result;
  
  if (includeParts || includeMinifigs) {
    result = await getRebrickableSetFullLib(setNum, req.apiKey, {
      includeParts,
      includeMinifigs,
      maxParts
    });
  } else {
    result = await getRebrickableSet(setNum, req.apiKey);
  }
  
  if (enrichLego) {
    result = await enrichRebrickableWithLego(result, lang);
  }
  
  if (result.set_num && !result.lego_id) {
    result.lego_id = rebrickableIdToLego(result.set_num);
  }
  
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// Pièces d'un set LEGO via Rebrickable
router.get("/set/:setNum/parts", rebrickableAuth, asyncHandler(async (req, res) => {
  const setNum = req.params.setNum;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 500;
  
  if (!setNum) return res.status(400).json({ error: "paramètre 'setNum' manquant" });
  
  const result = await getRebrickableSetParts(setNum, req.apiKey, limit);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// Minifigs d'un set LEGO via Rebrickable
router.get("/set/:setNum/minifigs", rebrickableAuth, asyncHandler(async (req, res) => {
  const setNum = req.params.setNum;
  
  if (!setNum) return res.status(400).json({ error: "paramètre 'setNum' manquant" });
  
  const result = await getRebrickableSetMinifigs(setNum, req.apiKey);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// Liste des thèmes LEGO via Rebrickable
router.get("/themes", rebrickableAuth, asyncHandler(async (req, res) => {
  const parentId = req.query.parent_id ? parseInt(req.query.parent_id, 10) : null;
  
  const result = await getRebrickableThemes(req.apiKey, parentId);
  addCacheHeaders(res, 86400);
  res.json(result);
}));

// Liste des couleurs LEGO via Rebrickable
router.get("/colors", rebrickableAuth, asyncHandler(async (req, res) => {
  const result = await getRebrickableColors(req.apiKey);
  addCacheHeaders(res, 86400);
  res.json(result);
}));

export default router;
