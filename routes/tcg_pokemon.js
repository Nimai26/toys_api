/**
 * Routes Pokémon TCG
 * 
 * Endpoints pour les cartes Pokémon à collectionner
 * API: https://pokemontcg.io/
 * Documentation: https://docs.pokemontcg.io/
 */

import express from 'express';
import { 
  asyncHandler, 
  requireParam, 
  addCacheHeaders,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams
} from '../lib/utils/index.js';
import { metrics } from '../lib/utils/state.js';
import { createProviderCache, getCacheInfo } from '../lib/database/index.js';
import { 
  searchPokemonCardsOfficial, 
  getPokemonCardDetailsOfficial
} from '../lib/providers/tcg/pokemon_official.js';
import { 
  normalizePokemonSearchOfficial, 
  normalizePokemonCardOfficial
} from '../lib/normalizers/tcg.js';

const router = express.Router();

// Cache provider pour Pokémon TCG Official
const pokemonCache = createProviderCache('pokemon-official', 'card');

// ============================================================================
// POKÉMON TCG
// ============================================================================

/**
 * Recherche de cartes Pokémon TCG (via Pokemon.com officiel)
 * GET /tcg_pokemon/search?q=pikachu&lang=fr&max=20&autoTrad=true
 */
router.get("/search", validateSearchParams, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  const { type, rarity, hitPointsMin, hitPointsMax } = req.query;

  metrics.sources.pokemon_official = metrics.sources.pokemon_official || { requests: 0, errors: 0 };
  metrics.sources.pokemon_official.requests++;

  // Utilise le cache PostgreSQL
  const result = await pokemonCache.searchWithCache(
    q,
    async () => {
      const rawData = await searchPokemonCardsOfficial(q, {
        lang,
        max,
        filters: {
          type: type || null,
          rarity: rarity || null,
          hitPointsMin: hitPointsMin || null,
          hitPointsMax: hitPointsMax || null
        },
        forceRefresh: refresh
      });

      return await normalizePokemonSearchOfficial(rawData, { lang, autoTrad });
    },
    { params: { lang, max, type: type || null, rarity: rarity || null }, forceRefresh: refresh }
  );

  addCacheHeaders(res, 300, getCacheInfo());
  res.json({
    success: true,
    provider: 'tcg_pokemon',
    query: q,
    total: result.total || 0,
    count: result.count || (result.results || []).length,
    data: result.results || result.data || [],
    meta: {
      fetchedAt: new Date().toISOString(),
      lang,
      locale,
      autoTrad,
      cacheMatch: result._cacheMatch
    }
  });
}));

/**
 * Détails d'une carte Pokémon TCG (via Pokemon.com officiel)
 * GET /tcg_pokemon/card?id=svp-27&lang=fr&autoTrad=true
 * Format ID: {set}-{number} (ex: svp-27, base1-4)
 */
router.get("/card", requireParam('id'), asyncHandler(async (req, res) => {
  const { 
    id,
    locale = 'fr-FR',
    autoTrad = false 
  } = req.query;
  
  // Normaliser le paramètre lang (peut être un array si dupliqué dans l'URL)
  let lang = req.query.lang || 'fr';
  if (Array.isArray(lang)) {
    lang = lang[0]; // Prendre le premier si array
  }
  
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';

  metrics.sources.pokemon_official = metrics.sources.pokemon_official || { requests: 0, errors: 0 };
  metrics.sources.pokemon_official.requests++;

  // Parser l'ID (format: set-number)
  const [set, number] = id.split('-');
  if (!set || !number) {
    return res.status(400).json({
      success: false,
      error: 'Invalid card ID format. Expected: {set}-{number} (ex: svp-27)'
    });
  }

  // Utilise le cache PostgreSQL
  const isAutoTrad = autoTrad === 'true' || autoTrad === '1' || autoTrad === true;
  const card = await pokemonCache.getWithCache(
    id,
    async () => {
      const rawCard = await getPokemonCardDetailsOfficial(set, number, { 
        lang,
        forceRefresh 
      });
      return await normalizePokemonCardOfficial(rawCard, { 
        lang, 
        autoTrad: isAutoTrad 
      });
    },
    { forceRefresh }
  );

  // normalizePokemonCardOfficial retourne un objet avec structure complète
  const cardData = card || null;

  addCacheHeaders(res, 300, getCacheInfo());
  res.json({
    success: true,
    provider: 'tcg_pokemon',
    id,
    data: cardData,
    meta: {
      fetchedAt: new Date().toISOString(),
      lang,
      locale,
      autoTrad: isAutoTrad,
      cacheMatch: card?._cacheMatch
    }
  });
}));

/**
 * Détails via /details (format normalisé)
 * GET /tcg_pokemon/details?url=pokemon-tcg:svp-27&lang=fr
 */
router.get("/details", validateDetailsParams, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';

  metrics.sources.pokemon_official = metrics.sources.pokemon_official || { requests: 0, errors: 0 };
  metrics.sources.pokemon_official.requests++;

  // Parser l'ID (format: set-number)
  const [set, number] = id.split('-');
  if (!set || !number) {
    return res.status(400).json({
      success: false,
      error: 'Invalid card ID format. Expected: {set}-{number} (ex: svp-27)'
    });
  }

  const result = await pokemonCache.getWithCache(
    id,
    async () => {
      const rawCard = await getPokemonCardDetailsOfficial(set, number, { lang });
      return await normalizePokemonCardOfficial(rawCard, { lang, autoTrad });
    },
    { forceRefresh }
  );

  addCacheHeaders(res, 300, getCacheInfo());
  res.json({
    success: true,
    provider: 'tcg_pokemon',
    id,
    total: result.total || 0,
    count: result.count || (result.results || []).length,
    data: result.results || result.data || [],
    meta: {
      fetchedAt: new Date().toISOString(),
      lang,
      locale,
      autoTrad,
      cacheMatch: result._cacheMatch
    }
  });
}));

/**
 * Liste des sets Pokémon TCG
 * GET /tcg_pokemon/sets?lang=fr
 * Note: Endpoint désactivé car non supporté par Pokemon.com scraping
 */
router.get("/sets", asyncHandler(async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Sets listing not available with Pokemon.com provider',
    message: 'This endpoint has been deprecated. Use /search instead to find cards.'
  });
}));

export default router;
