/**
 * Provider Pokémon TCG
 * API: https://pokemontcg.io/
 * Documentation: https://docs.pokemontcg.io/
 */

import { getCached, setCache, metrics } from '../../utils/state.js';
import { logger } from '../../utils/logger.js';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';

/**
 * Recherche de cartes Pokémon TCG
 * @param {string} query - Nom de la carte à rechercher
 * @param {object} options - Options de recherche
 * @param {string} options.lang - Code langue (fr, en, de, etc.)
 * @param {number} options.max - Nombre max de résultats
 * @param {number} options.page - Page de résultats
 * @param {string} options.set - Filtrer par set ID
 * @param {string} options.type - Filtrer par type
 * @param {string} options.rarity - Filtrer par rareté
 * @param {string} options.apiKey - Clé API Pokémon TCG (optionnel)
 * @returns {Promise<object>} - Résultats bruts de l'API
 */
export async function searchPokemonCards(query, options = {}) {
  const {
    lang = 'en',
    max = 20,
    page = 1,
    set = null,
    type = null,
    rarity = null,
    apiKey = null
  } = options;

  // Cache key
  const cacheKey = `pokemon:search:${query}:${lang}:${max}:${page}:${set}:${type}:${rarity}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logger.info(`[Pokemon TCG] Cache hit for search: ${query}`);
    return cached;
  }

  // Build query avec syntaxe Lucene
  let searchQuery = `name:${query}*`;
  if (set) searchQuery += ` set.id:${set}`;
  if (type) searchQuery += ` types:${type}`;
  if (rarity) searchQuery += ` rarity:${rarity}`;

  const url = `${POKEMON_TCG_API}/cards?q=${encodeURIComponent(searchQuery)}&page=${page}&pageSize=${max}`;

  // Headers
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'ToysAPI/4.0'
  };

  // Ajouter clé API si fournie (augmente le rate limit)
  if (apiKey) {
    headers['X-Api-Key'] = apiKey;
  }

  try {
    logger.info(`[Pokemon TCG] Searching: ${query} (page ${page}, max ${max})`);
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      metrics.sources.pokemon_tcg.errors++;
      throw new Error(`Pokemon TCG API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    logger.info(`[Pokemon TCG] Found ${data.data?.length || 0} results for: ${query}`);
    
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    metrics.sources.pokemon_tcg.errors++;
    logger.error(`[Pokemon TCG] Search error: ${error.message}`);
    throw error;
  }
}

/**
 * Détails d'une carte Pokémon TCG
 * @param {string} cardId - ID unique de la carte
 * @param {object} options - Options
 * @param {string} options.apiKey - Clé API (optionnel)
 * @returns {Promise<object>} - Données brutes de la carte
 */
export async function getPokemonCardDetails(cardId, options = {}) {
  const { apiKey = null } = options;

  const cacheKey = `pokemon:card:${cardId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logger.info(`[Pokemon TCG] Cache hit for card: ${cardId}`);
    return cached;
  }

  const url = `${POKEMON_TCG_API}/cards/${cardId}`;
  
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'ToysAPI/4.0'
  };

  if (apiKey) {
    headers['X-Api-Key'] = apiKey;
  }

  try {
    logger.info(`[Pokemon TCG] Fetching card: ${cardId}`);
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      metrics.sources.pokemon_tcg.errors++;
      throw new Error(`Pokemon TCG API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    logger.info(`[Pokemon TCG] Card fetched: ${data.data?.name || cardId}`);
    
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    metrics.sources.pokemon_tcg.errors++;
    logger.error(`[Pokemon TCG] Card details error: ${error.message}`);
    throw error;
  }
}

/**
 * Liste des sets Pokémon TCG
 * @param {object} options - Options
 * @param {string} options.series - Filtrer par série
 * @param {number} options.year - Filtrer par année
 * @param {string} options.apiKey - Clé API (optionnel)
 * @returns {Promise<object>} - Liste des sets
 */
export async function getPokemonSets(options = {}) {
  const { 
    series = null, 
    year = null,
    apiKey = null 
  } = options;

  const cacheKey = `pokemon:sets:${series}:${year}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logger.info(`[Pokemon TCG] Cache hit for sets`);
    return cached;
  }

  let url = `${POKEMON_TCG_API}/sets`;
  
  // Filtres
  const params = [];
  if (series) params.push(`series:"${series}"`);
  if (year) params.push(`releaseDate:${year}*`);
  
  if (params.length > 0) {
    url += `?q=${encodeURIComponent(params.join(' '))}`;
  }

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'ToysAPI/4.0'
  };

  if (apiKey) {
    headers['X-Api-Key'] = apiKey;
  }

  try {
    logger.info(`[Pokemon TCG] Fetching sets (series: ${series || 'all'}, year: ${year || 'all'})`);
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      metrics.sources.pokemon_tcg.errors++;
      throw new Error(`Pokemon TCG API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    logger.info(`[Pokemon TCG] Found ${data.data?.length || 0} sets`);
    
    setCache(cacheKey, data, 3600); // Cache 1h pour les sets
    return data;
  } catch (error) {
    metrics.sources.pokemon_tcg.errors++;
    logger.error(`[Pokemon TCG] Sets fetch error: ${error.message}`);
    throw error;
  }
}
