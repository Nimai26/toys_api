/**
 * Routes pour Magic: The Gathering (Scryfall API)
 * 
 * Endpoints:
 * - GET /tcg_mtg/search - Recherche de cartes
 * - GET /tcg_mtg/card - Détails d'une carte par ID
 * - GET /tcg_mtg/details - Détails normalisés via detailUrl
 * - GET /tcg_mtg/sets - Liste des sets
 */

import express from 'express';
import { asyncHandler } from '../lib/utils/asyncHandler.js';
import { searchMTGCards, getMTGCardDetails, getMTGSets } from '../lib/providers/tcg/mtg.js';
import { normalizeMTGSearch, normalizeMTGCard, normalizeMTGSets } from '../lib/normalizers/tcg.js';
import { createProviderCache } from '../lib/database/index.js';
import { logger } from '../lib/utils/logger.js';

const router = express.Router();

// Créer le cache PostgreSQL pour MTG
const mtgCache = createProviderCache('mtg', 'card');

/**
 * Middleware de validation des paramètres de recherche
 */
function validateSearchParams(req, res, next) {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({
      success: false,
      error: "Paramètre 'q' requis pour la recherche",
      code: 400,
      provider: 'tcg_mtg',
      hint: "Utilisez 'q' pour le nom de la carte ou une syntaxe Scryfall (ex: t:creature c:red)",
      params: [
        "q (requis) - Nom de la carte ou syntaxe Scryfall",
        "lang (optionnel) - Code langue (en, fr, es, de, it, pt, ja, ko, ru, zh-hans, zh-hant)",
        "max (optionnel) - Nombre max de résultats (défaut: 20)",
        "order (optionnel) - Tri (name, set, released, rarity, color, usd, eur, cmc, power)",
        "unique (optionnel) - Mode unicité (cards, art, prints)",
        "autoTrad (optionnel) - Traduction automatique (true/false)",
        "refresh (optionnel) - Forcer le rafraîchissement du cache (true/false)"
      ]
    });
  }
  
  next();
}

/**
 * Middleware de validation des paramètres de détails
 */
function validateDetailsParams(req, res, next) {
  const { detailUrl } = req.query;
  
  if (!detailUrl) {
    return res.status(400).json({
      success: false,
      error: "Paramètre 'detailUrl' requis",
      code: 400,
      provider: 'tcg_mtg',
      hint: "Utilisez l'URL fournie par /search dans le champ detailUrl de chaque résultat",
      params: [
        "detailUrl (requis) - URL de détails depuis /search",
        "lang (optionnel) - Code langue",
        "autoTrad (optionnel) - Traduction automatique (true/false)"
      ]
    });
  }
  
  next();
}

/**
 * GET /tcg_mtg/search
 * Recherche de cartes Magic
 */
router.get('/search', validateSearchParams, asyncHandler(async (req, res) => {
  const {
    q,
    lang = 'en',
    max = 20,
    order = 'name',
    unique = 'cards',
    dir = 'auto',
    autoTrad = false,
    refresh = false
  } = req.query;
  
  const forceRefresh = refresh === 'true' || refresh === true;
  
  logger.info(`[MTG Route] Search request: q=${q}, lang=${lang}, max=${max}, refresh=${forceRefresh}`);
  
  try {
    // Options de recherche
    const searchOptions = {
      lang,
      max: parseInt(max),
      order,
      unique,
      dir,
      getCached: forceRefresh ? null : req.getCached,
      setCache: forceRefresh ? null : req.setCache
    };
    
    // Recherche
    const rawResults = await searchMTGCards(q, searchOptions);
    
    // Normalisation
    const isAutoTrad = autoTrad === 'true' || autoTrad === '1' || autoTrad === true;
    const normalized = await normalizeMTGSearch(rawResults, {
      lang,
      autoTrad: isAutoTrad
    });
    
    res.json({
      success: true,
      provider: 'tcg_mtg',
      query: q,
      total: normalized.total,
      count: normalized.data.length,
      has_more: normalized.has_more,
      data: normalized.data
    });
    
  } catch (error) {
    logger.error(`[MTG Route] Search error: ${error.message}`);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /tcg_mtg/card
 * Détails d'une carte par ID
 */
router.get('/card', asyncHandler(async (req, res) => {
  const { id, lang = 'en', refresh = false } = req.query;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Paramètre 'id' requis",
      code: 400,
      provider: 'tcg_mtg',
      params: [
        "id (requis) - ID Scryfall de la carte ou set/collector_number",
        "lang (optionnel) - Code langue",
        "refresh (optionnel) - Forcer le rafraîchissement du cache (true/false)"
      ]
    });
  }
  
  const forceRefresh = refresh === 'true' || refresh === true;
  
  logger.info(`[MTG Route] Card request: id=${id}, lang=${lang}, refresh=${forceRefresh}`);
  
  try {
    const rawCard = await getMTGCardDetails(id, { 
      lang,
      getCached: forceRefresh ? null : req.getCached,
      setCache: forceRefresh ? null : req.setCache
    });
    const normalized = await normalizeMTGCard(rawCard, { lang, autoTrad: false });
    
    res.json({
      success: true,
      provider: 'tcg_mtg',
      id,
      data: normalized,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang
      }
    });
    
  } catch (error) {
    logger.error(`[MTG Route] Card error: ${error.message}`);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /tcg_mtg/details
 * Détails normalisés d'une carte via detailUrl
 */
router.get('/details', validateDetailsParams, asyncHandler(async (req, res) => {
  const { detailUrl, lang = 'en', autoTrad = false, refresh = false } = req.query;
  
  // Extraire l'ID depuis le detailUrl
  const idMatch = detailUrl.match(/id=([^&]+)/);
  if (!idMatch) {
    return res.status(400).json({
      success: false,
      error: "Format detailUrl invalide",
      code: 400,
      provider: 'tcg_mtg'
    });
  }
  
  const cardId = idMatch[1];
  const forceRefresh = refresh === 'true' || refresh === true;
  
  logger.info(`[MTG Route] Details request: id=${cardId}, lang=${lang}, refresh=${forceRefresh}`);
  
  try {
    const rawCard = await getMTGCardDetails(cardId, { 
      lang,
      getCached: forceRefresh ? null : req.getCached,
      setCache: forceRefresh ? null : req.setCache
    });
    const isAutoTrad = autoTrad === 'true' || autoTrad === '1' || autoTrad === true;
    const normalized = await normalizeMTGCard(rawCard, {
      lang,
      autoTrad: isAutoTrad
    });
    
    res.json({
      success: true,
      provider: 'tcg_mtg',
      id: cardId,
      data: normalized,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang,
        autoTrad: isAutoTrad
      }
    });
    
  } catch (error) {
    logger.error(`[MTG Route] Details error: ${error.message}`);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /tcg_mtg/sets
 * Liste des sets Magic
 */
router.get('/sets', asyncHandler(async (req, res) => {
  const { refresh = false } = req.query;
  
  logger.info(`[MTG Route] Sets request`);
  
  try {
    const rawSets = await getMTGSets();
    const normalized = normalizeMTGSets(rawSets);
    
    res.json({
      success: true,
      provider: 'tcg_mtg',
      total: normalized.total,
      data: normalized
    });
    
  } catch (error) {
    logger.error(`[MTG Route] Sets error: ${error.message}`);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

export default router;
