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
  requireApiKey, 
  addCacheHeaders,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams
} from '../lib/utils/index.js';
import { metrics } from '../lib/utils/state.js';
import { createProviderCache, getCacheInfo } from '../lib/database/index.js';
import { 
  searchPokemonCards, 
  getPokemonCardDetails,
  getPokemonSets
} from '../lib/providers/tcg/pokemon.js';
import { 
  normalizePokemonSearch, 
  normalizePokemonCard,
  normalizePokemonSets
} from '../lib/normalizers/tcg.js';

const router = express.Router();

// Cache provider pour Pokémon TCG
const pokemonCache = createProviderCache('pokemon-tcg', 'card');

// Middleware d'authentification (clé API optionnelle mais recommandée)
const pokemonAuth = requireApiKey(
  'Pokemon TCG', 
  'https://dev.pokemontcg.io/', 
  true // optionnel
);

// ============================================================================
// POKÉMON TCG
// ============================================================================

/**
 * Recherche de cartes Pokémon TCG
 * GET /tcg_pokemon/search?q=pikachu&lang=fr&max=20&autoTrad=true
 */
router.get("/search", validateSearchParams, pokemonAuth, asyncHandler(async (req, res) => {
  const { q, lang, locale, max, autoTrad, refresh } = req.standardParams;
  const { set, type, rarity } = req.query;

  metrics.sources.pokemon_tcg.requests++;

  // Utilise le cache PostgreSQL
  const result = await pokemonCache.searchWithCache(
    q,
    async () => {
      const rawData = await searchPokemonCards(q, {
        lang,
        max,
        set: set || null,
        type: type || null,
        rarity: rarity || null,
        apiKey: req.apiKey // Utilise la clé API si fournie
      });

      return await normalizePokemonSearch(rawData, { lang, autoTrad });
    },
    { params: { lang, max, set: set || null, type: type || null, rarity: rarity || null }, forceRefresh: refresh }
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
 * Détails d'une carte Pokémon TCG
 * GET /tcg_pokemon/card?id=base1-4&lang=fr&autoTrad=true
 */
router.get("/card", requireParam('id'), pokemonAuth, asyncHandler(async (req, res) => {
  const { 
    id, 
    lang = 'fr',
    locale = 'fr-FR',
    autoTrad = false 
  } = req.query;
  
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';

  metrics.sources.pokemon_tcg.requests++;

  // Utilise le cache PostgreSQL
  const result = await pokemonCache.getWithCache(
    id,
    async () => {
      const rawCard = await getPokemonCardDetails(id, { apiKey: req.apiKey });
      return await normalizePokemonCard(rawCard, { 
        lang, 
        autoTrad: autoTrad === 'true' 
      });
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
      autoTrad: autoTrad === 'true',
      cacheMatch: result._cacheMatch
    }
  });
}));

/**
 * Détails via /details (format normalisé)
 * GET /tcg_pokemon/details?url=pokemon-tcg:base1-4&lang=fr
 */
router.get("/details", validateDetailsParams, pokemonAuth, asyncHandler(async (req, res) => {
  const { lang, locale, autoTrad } = req.standardParams;
  const { id } = req.parsedDetailUrl;
  const forceRefresh = req.query.refresh === 'true' || req.query.noCache === 'true';

  metrics.sources.pokemon_tcg.requests++;

  const result = await pokemonCache.getWithCache(
    id,
    async () => {
      const rawCard = await getPokemonCardDetails(id, { apiKey: req.apiKey });
      return await normalizePokemonCard(rawCard, { lang, autoTrad });
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
 * GET /tcg_pokemon/sets?lang=fr&series=Base&year=1999
 */
router.get("/sets", pokemonAuth, asyncHandler(async (req, res) => {
  const { 
    lang = 'fr',
    locale = 'fr-FR',
    series,
    year
  } = req.query;

  metrics.sources.pokemon_tcg.requests++;

  const rawData = await getPokemonSets({
    series,
    year: year ? parseInt(year) : null,
    apiKey: req.apiKey
  });

  const normalized = normalizePokemonSets(rawData, { lang });

  addCacheHeaders(res, 3600, getCacheInfo()); // Cache 1h pour les sets
  res.json({
    success: true,
    provider: 'tcg_pokemon',
    data: normalized,
    meta: {
      fetchedAt: new Date().toISOString(),
      lang,
      locale,
      autoTrad: false
    }
  });
}));

export default router;
