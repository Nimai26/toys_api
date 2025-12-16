/**
 * Routes LEGO/Mega/Rebrickable - toys_api
 * Endpoints pour LEGO, Mega Construx et Rebrickable
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { addCacheHeaders, asyncHandler } from '../lib/utils/index.js';
import { DEFAULT_LOCALE } from '../lib/config.js';

import { 
  callLegoGraphql as callLegoGraphqlLib, 
  getProductDetails as getLegoProductDetails, 
  getBuildingInstructions
} from '../lib/providers/lego.js';

const router = Router();
const log = createLogger('Route:Lego');

// ============================================================================
// LEGO ENDPOINTS
// ============================================================================

router.get("/search", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const lang = (req.query.lang || DEFAULT_LOCALE);
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 24;
  const max = req.query.max ? parseInt(req.query.max, 10) : limit;

  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  metrics.sources.lego.requests++;
  const perPage = Math.max(1, Math.min(max, 100));
  const result = await callLegoGraphqlLib(q, lang, MAX_RETRIES, perPage);
  
  addCacheHeaders(res, 300);
  res.json(result);
}));

router.get("/product/:id", asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const lang = (req.query.lang || DEFAULT_LOCALE);
  const enrichRebrickable = req.query.enrich_rebrickable === 'true';
  const maxParts = req.query.parts_limit ? parseInt(req.query.parts_limit, 10) : 500;

  if (!productId) return res.status(400).json({ error: "ID produit manquant" });

  metrics.sources.lego.requests++;
  let result = await getLegoProductDetails(productId, lang);
  
  // Toujours récupérer les manuels d'instructions LEGO
  try {
    const instructions = await getBuildingInstructions(productId, lang);
    if (instructions && instructions.manuals && instructions.manuals.length > 0) {
      result.instructions = {
        count: instructions.manuals.length,
        manuals: instructions.manuals
      };
      log.debug(`[LEGO] ${instructions.manuals.length} manuels trouvés pour ${productId}`);
    } else {
      result.instructions = { count: 0, manuals: [] };
    }
  } catch (instructionsErr) {
    log.warn(`[LEGO] Impossible de récupérer les instructions pour ${productId}: ${instructionsErr.message}`);
    result.instructions = { count: 0, manuals: [], error: instructionsErr.message };
  }
  
  // Enrichir avec Rebrickable si demandé
  if (enrichRebrickable) {
    const apiKey = extractApiKey(req);
    if (apiKey) {
      try {
        result = await enrichLegoWithRebrickable(result, apiKey, { maxParts });
        log.debug(`[LEGO] Produit ${productId} enrichi avec Rebrickable`);
      } catch (enrichErr) {
        log.warn(`[LEGO] Échec enrichissement Rebrickable pour ${productId}: ${enrichErr.message}`);
        result.rebrickable_error = enrichErr.message;
      }
    } else {
      result.rebrickable_hint = "Fournissez une clé API Rebrickable via X-Api-Key ou X-Encrypted-Key pour enrichir avec minifigs/pièces";
    }
  }
  
  addCacheHeaders(res, 300);
  res.json(result);
}));

router.get("/instructions/:id", asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const lang = (req.query.lang || DEFAULT_LOCALE);

  if (!productId) return res.status(400).json({ error: "ID produit manquant" });

  metrics.sources.lego.requests++;
  const result = await getBuildingInstructions(productId, lang);
  addCacheHeaders(res, 300);
  res.json(result);
}));

export default router;
