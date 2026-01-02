/**
 * Routes pour Yu-Gi-Oh! (YGOPRODeck API)
 * 
 * Endpoints:
 * - GET /tcg_yugioh/search - Recherche de cartes
 * - GET /tcg_yugioh/card - Détails d'une carte par ID
 * - GET /tcg_yugioh/details - Détails normalisés via detailUrl
 * - GET /tcg_yugioh/sets - Liste des sets
 * - GET /tcg_yugioh/archetype - Recherche par archétype
 */

import express from 'express';
import { asyncHandler } from '../lib/utils/asyncHandler.js';
import { 
  searchYuGiOhCards, 
  getYuGiOhCardDetails, 
  getYuGiOhSets,
  searchByArchetype 
} from '../lib/providers/tcg/yugioh.js';
import { 
  normalizeYuGiOhSearch, 
  normalizeYuGiOhCard, 
  normalizeYuGiOhSets 
} from '../lib/normalizers/tcg.js';
import { logger } from '../lib/utils/logger.js';

const router = express.Router();

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
      provider: 'tcg_yugioh',
      hint: "Utilisez 'q' pour le nom de la carte",
      params: [
        "q (requis) - Nom de la carte",
        "type (optionnel) - Type (Monster, Spell, Trap)",
        "race (optionnel) - Race (Dragon, Spellcaster, etc.)",
        "attribute (optionnel) - Attribut (DARK, LIGHT, WATER, etc.)",
        "level (optionnel) - Niveau",
        "archetype (optionnel) - Archétype",
        "max (optionnel) - Nombre max de résultats (défaut: 20)",
        "sort (optionnel) - Tri (name, atk, def, level)",
        "autoTrad (optionnel) - Traduction automatique (true/false)"
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
      provider: 'tcg_yugioh',
      hint: "Utilisez l'URL fournie par /search dans le champ detailUrl de chaque résultat",
      params: [
        "detailUrl (requis) - URL de détails depuis /search",
        "autoTrad (optionnel) - Traduction automatique (true/false)"
      ]
    });
  }
  
  next();
}

/**
 * GET /tcg_yugioh/search
 * Recherche de cartes Yu-Gi-Oh!
 */
router.get('/search', validateSearchParams, asyncHandler(async (req, res) => {
  const {
    q,
    type,
    race,
    attribute,
    level,
    archetype,
    max = 20,
    sort = 'name',
    lang: rawLang = 'en',
    autoTrad = false,
    refresh = false
  } = req.query;

  // Normaliser lang (gérer tableaux et variantes comme fr-FR)
  const lang = (Array.isArray(rawLang) ? rawLang[0] : rawLang).split('-')[0].toLowerCase();
  
  const forceRefresh = refresh === 'true' || refresh === true;
  
  logger.info(`[Yu-Gi-Oh! Route] Search request: q=${q}, max=${max}, lang=${lang}, refresh=${forceRefresh}`);
  
  try {
    // Options de recherche
    const searchOptions = {
      type,
      race,
      attribute,
      level: level ? parseInt(level) : undefined,
      archetype,
      max: parseInt(max),
      sort,
      lang,
      getCached: forceRefresh ? null : req.getCached,
      setCache: forceRefresh ? null : req.setCache
    };
    
    // Recherche
    const rawResults = await searchYuGiOhCards(q, searchOptions);
    
    // Normalisation
    const normalized = await normalizeYuGiOhSearch(rawResults, {
      lang,
      autoTrad: autoTrad === 'true'
    });
    
    res.json({
      success: true,
      provider: 'tcg_yugioh',
      query: q,
      total: normalized.total,
      count: normalized.data.length,
      data: normalized.data
    });
    
  } catch (error) {
    logger.error(`[Yu-Gi-Oh! Route] Search error: ${error.message}`);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /tcg_yugioh/card
 * Détails d'une carte par ID
 */
router.get('/card', asyncHandler(async (req, res) => {
  const { id, lang: rawLang = 'en', refresh = false } = req.query;

  // Normaliser lang (gérer tableaux et variantes)
  const lang = (Array.isArray(rawLang) ? rawLang[0] : rawLang).split('-')[0].toLowerCase();
  
  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Paramètre 'id' requis",
      code: 400,
      provider: 'tcg_yugioh',
      params: [
        "id (requis) - ID de la carte",
        "lang (optionnel) - Langue (en, fr, de, it, pt)",
        "refresh (optionnel) - Bypass le cache (true/false)"
      ]
    });
  }
  
  const forceRefresh = refresh === 'true' || refresh === true;
  
  logger.info(`[Yu-Gi-Oh! Route] Card request: id=${id}, lang=${lang}, refresh=${forceRefresh}`);
  
  try {
    const rawCard = await getYuGiOhCardDetails(id, {
      lang,
      getCached: forceRefresh ? null : req.getCached,
      setCache: forceRefresh ? null : req.setCache
    });
    const normalized = await normalizeYuGiOhCard(rawCard);
    
    res.json({
      success: true,
      provider: 'tcg_yugioh',
      id,
      data: normalized,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang
      }
    });
    
  } catch (error) {
    logger.error(`[Yu-Gi-Oh! Route] Card error: ${error.message}`);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /tcg_yugioh/details
 * Détails normalisés d'une carte via detailUrl
 */
router.get('/details', validateDetailsParams, asyncHandler(async (req, res) => {
  const { detailUrl, autoTrad = false, refresh = false } = req.query;
  
  // Extraire l'ID et le lang depuis le detailUrl
  const idMatch = detailUrl.match(/id=([^&]+)/);
  const langMatch = detailUrl.match(/lang=([^&]+)/);
  
  if (!idMatch) {
    return res.status(400).json({
      success: false,
      error: "Format detailUrl invalide",
      code: 400,
      provider: 'tcg_yugioh'
    });
  }
  
  const cardId = idMatch[1].trim();
  const rawLang = langMatch ? langMatch[1].trim() : 'en';
  const lang = rawLang.split('-')[0].toLowerCase();
  const forceRefresh = refresh === 'true' || refresh === true;
  
  logger.info(`[Yu-Gi-Oh! Route] Details request: id=${cardId}, lang=${lang}, refresh=${forceRefresh}`);
  
  try {
    const rawCard = await getYuGiOhCardDetails(cardId, {
      lang,
      getCached: forceRefresh ? null : req.getCached,
      setCache: forceRefresh ? null : req.setCache
    });
    const normalized = await normalizeYuGiOhCard(rawCard, {
      lang,
      autoTrad: autoTrad === 'true'
    });
    
    res.json({
      success: true,
      provider: 'tcg_yugioh',
      id: cardId,
      data: normalized,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang,
        autoTrad: autoTrad === 'true'
      }
    });
    
  } catch (error) {
    logger.error(`[Yu-Gi-Oh! Route] Details error: ${error.message}`);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /tcg_yugioh/sets
 * Liste des sets Yu-Gi-Oh!
 */
router.get('/sets', asyncHandler(async (req, res) => {
  logger.info(`[Yu-Gi-Oh! Route] Sets request`);
  
  try {
    const rawSets = await getYuGiOhSets();
    const normalized = normalizeYuGiOhSets(rawSets);
    
    res.json({
      success: true,
      provider: 'tcg_yugioh',
      total: normalized.total,
      data: normalized
    });
    
  } catch (error) {
    logger.error(`[Yu-Gi-Oh! Route] Sets error: ${error.message}`);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /tcg_yugioh/archetype
 * Recherche par archétype
 */
router.get('/archetype', asyncHandler(async (req, res) => {
  const { name, max = 20 } = req.query;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      error: "Paramètre 'name' requis",
      code: 400,
      provider: 'tcg_yugioh',
      hint: "Utilisez 'name' pour le nom de l'archétype",
      params: [
        "name (requis) - Nom de l'archétype (ex: Blue-Eyes, Dark Magician)",
        "max (optionnel) - Nombre max de résultats (défaut: 20)"
      ]
    });
  }
  
  logger.info(`[Yu-Gi-Oh! Route] Archetype request: ${name}`);
  
  try {
    const results = await searchByArchetype(name, { max: parseInt(max) });
    
    res.json({
      success: true,
      provider: 'tcg_yugioh',
      archetype: results.archetype,
      total: results.total_cards,
      count: results.data.length,
      data: results.data
    });
    
  } catch (error) {
    logger.error(`[Yu-Gi-Oh! Route] Archetype error: ${error.message}`);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

export default router;
