// routes/tcg_onepiece.js
// Routes API pour One Piece Trading Card Game
// Source: onepiece-cardgame.dev JSON API (via VPN)

import express from 'express';
import { asyncHandler } from '../lib/utils/index.js';
import { createLogger } from '../lib/utils/logger.js';
import { metrics } from '../lib/utils/state.js';
import {
  getAllOnePieceCards,
  searchOnePieceCards,
  getOnePieceCardById,
  getOnePieceCardByName,
  isOnePieceAvailable
} from '../lib/providers/tcg/onepiece.js';
import {
  normalizeOnePieceSearch,
  normalizeOnePieceCard
} from '../lib/normalizers/tcg.js';

const router = express.Router();
const log = createLogger('OnePiece-Routes');

// ============================================================================
// MIDDLEWARE - Vérifier la disponibilité
// ============================================================================

router.use((req, res, next) => {
  const availability = isOnePieceAvailable();
  if (!availability.available) {
    return res.status(503).json({
      error: 'Service Temporarily Unavailable',
      message: availability.reason,
      retryAfter: availability.retryAfter
    });
  }
  next();
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /tcg_onepiece/search
 * Recherche de cartes One Piece
 * 
 * Query params:
 * - q: Nom de la carte (fuzzy search)
 * - type: Type de carte (leader, character, event, stage)
 * - color: Couleur (red, blue, green, purple, black, yellow)
 * - rarity: Rareté (leader, common, uncommon, rare, super-rare, secret-rare, promo, special-rare, treasure-rare)
 * - set: Code du set (OP-01, ST-01, etc.)
 * - cost: Coût (0-10)
 * - power: Puissance (ex: 5000)
 * - trait: Trait (ex: Straw Hat Crew, Supernovas)
 * - attribute: Attribut de combat (slash, strike, ranged, wisdom, special)
 * - max: Nombre max de résultats (défaut: 20)
 * - lang: Langue de sortie (en, fr) - défaut: fr
 * - autoTrad: Traduction automatique des effets (true/false)
 */
router.get('/search', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const {
    q,
    type,
    color,
    rarity,
    set,
    cost,
    power,
    trait,
    attribute,
    max = 20,
    lang: rawLang = 'fr',
    autoTrad = 'false'
  } = req.query;

  // Normaliser lang (gérer tableaux et variantes comme fr-FR)
  const lang = (Array.isArray(rawLang) ? rawLang[0] : rawLang).split('-')[0].toLowerCase();

  if (!q) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Le paramètre "q" (nom de carte) est requis'
    });
  }

  log.info(`🔍 Recherche: "${q}" (type=${type||'all'}, color=${color||'all'}, set=${set||'all'})`);

  try {
    // Rechercher avec filtres
    const results = await searchOnePieceCards(q, {
      type,
      color,
      rarity,
      set,
      cost,
      power,
      trait,
      attribute
    });

    // Limiter les résultats
    const limited = results.slice(0, parseInt(max));

    // Normaliser
    const normalized = await normalizeOnePieceSearch(limited, {
      lang,
      autoTrad: autoTrad === 'true'
    });

    // Métriques
    const duration = Date.now() - startTime;
    metrics.sources.onepiece.requests++;
    metrics.sources.onepiece.latency = duration;

    log.info(`✅ ${normalized.count} résultats trouvés sur ${results.length} (${duration}ms)`);

    res.json({
      success: true,
      provider: 'tcg_onepiece',
      query: q,
      data: normalized,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang,
        autoTrad: autoTrad === 'true',
        filters: { type, color, rarity, set, cost, power, trait, attribute },
        duration: `${duration}ms`
      }
    });

  } catch (error) {
    log.error(`❌ Erreur recherche: ${error.message}`);
    metrics.sources.onepiece.errors++;
    
    res.status(error.message.includes('VPN') ? 503 : 500).json({
      error: error.message.includes('VPN') ? 'Service Unavailable' : 'Internal Server Error',
      message: error.message
    });
  }
}));

/**
 * GET /tcg_onepiece/card
 * Détails d'une carte par nom OU ID
 * 
 * Query params:
 * - name: Nom exact de la carte (ex: "Trafalgar Law")
 * - id: ID de la carte (ex: "OP01-047")
 * - lang: Langue de sortie (en, fr) - défaut: fr
 * - autoTrad: Traduction automatique (true/false)
 * 
 * Note: name ou id requis (pas les deux)
 */
router.get('/card', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { name, id, lang = 'fr', autoTrad = 'false' } = req.query;

  if (!name && !id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Paramètre "name" ou "id" requis'
    });
  }

  if (name && id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Fournir soit "name" soit "id", pas les deux'
    });
  }

  log.info(`🔍 Carte: ${name ? `name="${name}"` : `id="${id}"`}`);

  try {
    let card;

    if (id) {
      // Recherche par ID
      card = await getOnePieceCardById(id);
    } else {
      // Recherche par nom
      card = await getOnePieceCardByName(name);
    }

    if (!card) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Carte ${name ? `"${name}"` : id} introuvable`
      });
    }

    // Normaliser
    const normalized = await normalizeOnePieceCard(card, {
      lang,
      autoTrad: autoTrad === 'true'
    });

    // Métriques
    const duration = Date.now() - startTime;
    metrics.sources.onepiece.requests++;
    metrics.sources.onepiece.latency = duration;

    log.info(`✅ Carte trouvée: ${card.n} (${duration}ms)`);

    res.json({
      success: true,
      provider: 'tcg_onepiece',
      id: id || card.cid,
      data: normalized,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang,
        autoTrad: autoTrad === 'true',
        duration: `${duration}ms`
      }
    });

  } catch (error) {
    log.error(`❌ Erreur carte: ${error.message}`);
    metrics.sources.onepiece.errors++;
    
    res.status(error.message.includes('VPN') ? 503 : 500).json({
      error: error.message.includes('VPN') ? 'Service Unavailable' : 'Internal Server Error',
      message: error.message
    });
  }
}));

/**
 * GET /tcg_onepiece/details
 * Détails complets d'une carte par ID uniquement
 * 
 * Query params:
 * - id: ID de la carte (ex: "OP01-047") - REQUIS
 * - lang: Langue de sortie (en, fr) - défaut: fr
 * - autoTrad: Traduction automatique (true/false)
 */
router.get('/details', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id, lang: rawLang = 'fr', autoTrad = 'false' } = req.query;

  // Normaliser lang (gérer tableaux et variantes comme fr-FR)
  const lang = (Array.isArray(rawLang) ? rawLang[0] : rawLang).split('-')[0].toLowerCase();

  if (!id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Le paramètre "id" est requis'
    });
  }

  log.info(`🔍 Détails: id="${id}"`);

  try {
    const card = await getOnePieceCardById(id);

    if (!card) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Carte ${id} introuvable`
      });
    }

    // Normaliser avec tous les détails
    const normalized = await normalizeOnePieceCard(card, {
      lang,
      autoTrad: autoTrad === 'true'
    });

    // Métriques
    const duration = Date.now() - startTime;
    metrics.sources.onepiece.requests++;
    metrics.sources.onepiece.latency = duration;

    log.info(`✅ Détails récupérés: ${card.n} (${duration}ms)`);

    res.json({
      success: true,
      provider: 'tcg_onepiece',
      id,
      data: normalized,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang,
        autoTrad: autoTrad === 'true',
        duration: `${duration}ms`
      }
    });

  } catch (error) {
    log.error(`❌ Erreur détails: ${error.message}`);
    metrics.sources.onepiece.errors++;
    
    res.status(error.message.includes('VPN') ? 503 : 500).json({
      error: error.message.includes('VPN') ? 'Service Unavailable' : 'Internal Server Error',
      message: error.message
    });
  }
}));

/**
 * GET /tcg_onepiece/health
 * Vérifie la disponibilité du service One Piece
 */
router.get('/health', asyncHandler(async (req, res) => {
  const availability = isOnePieceAvailable();
  
  res.json({
    status: availability.available ? 'ok' : 'degraded',
    available: availability.available,
    reason: availability.reason,
    retryAfter: availability.retryAfter
  });
}));

export default router;
