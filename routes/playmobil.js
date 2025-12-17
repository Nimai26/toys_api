/**
 * Routes Playmobil - toys_api
 * Endpoints pour Playmobil (recherche, produits, instructions)
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { addCacheHeaders, asyncHandler } from '../lib/utils/index.js';
import { DEFAULT_LOCALE } from '../lib/config.js';

import {
  searchPlaymobil as searchPlaymobilLib,
  getPlaymobilProductDetails as getPlaymobilProductDetailsLib,
  getPlaymobilInstructions,
  searchPlaymobilInstructions,
  extractPlaymobilProductId,
  isValidPlaymobilProductId
} from '../lib/providers/playmobil.js';

const router = Router();
const log = createLogger('Route:Playmobil');

// Configuration par défaut
const PLAYMOBIL_DEFAULT_MAX = 24;
const PLAYMOBIL_DEFAULT_LANG = 'fr-FR';

// ============================================================================
// PLAYMOBIL ENDPOINTS
// ============================================================================

/**
 * Recherche de produits Playmobil
 * @queryparam q - Terme de recherche (requis)
 * @queryparam max - Nombre max de résultats (défaut: 24)
 * @queryparam lang - Langue (fr-FR, en-US, de-DE, es-ES, it-IT, etc.)
 */
router.get("/search", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const max = req.query.max ? parseInt(req.query.max, 10) : PLAYMOBIL_DEFAULT_MAX;
  const lang = req.query.lang || PLAYMOBIL_DEFAULT_LANG;
  
  if (!q) {
    return res.status(400).json({ error: "paramètre 'q' manquant" });
  }

  const result = await searchPlaymobilLib(q, lang, 3, max);
  addCacheHeaders(res, 1800); // 30 minutes
  res.json(result);
}));

/**
 * Récupère les détails d'un produit Playmobil par ID
 * @param id - ID du produit (ex: 71148)
 * @queryparam lang - Langue
 */
router.get("/product/:id", asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const lang = req.query.lang || PLAYMOBIL_DEFAULT_LANG;
  
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
  
  const result = await getPlaymobilProductDetailsLib(cleanId, lang);
  if (!result || !result.name) {
    return res.status(404).json({ error: `Produit ${cleanId} non trouvé` });
  }
  
  addCacheHeaders(res, 3600); // 1 heure
  res.json(result);
}));

/**
 * Récupère les instructions de montage pour un produit
 * @param id - ID du produit
 */
router.get("/product/:id/instructions", asyncHandler(async (req, res) => {
  const productId = req.params.id;
  
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
  
  const result = await getPlaymobilInstructions(cleanId);
  
  if (!result.available) {
    return res.status(404).json({ 
      error: `Instructions non trouvées pour le produit ${cleanId}`,
      productId: cleanId
    });
  }
  
  addCacheHeaders(res, 86400); // 24 heures
  res.json(result);
}));

/**
 * Recherche des notices de montage
 * @queryparam q - Terme de recherche (ID produit)
 * @queryparam lang - Langue
 */
router.get("/instructions/search", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const lang = req.query.lang || PLAYMOBIL_DEFAULT_LANG;
  
  if (!q) {
    return res.status(400).json({ error: "paramètre 'q' manquant" });
  }

  const result = await searchPlaymobilInstructions(q, lang);
  addCacheHeaders(res, 3600);
  res.json(result);
}));

/**
 * Endpoint direct pour télécharger les instructions (redirect)
 * @param id - ID du produit
 */
router.get("/instructions/:id", asyncHandler(async (req, res) => {
  const productId = req.params.id;
  
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
  
  const result = await getPlaymobilInstructions(cleanId);
  
  if (result.available && result.url) {
    // Optionnel: rediriger directement vers le PDF
    // return res.redirect(result.url);
    addCacheHeaders(res, 86400);
    res.json(result);
  } else {
    return res.status(404).json({ 
      error: `Instructions non trouvées pour le produit ${cleanId}`,
      productId: cleanId
    });
  }
}));

export default router;
