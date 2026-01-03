/**
 * Provider Digimon Card Game (DigimonCard.io)
 * Documentation: https://digimoncard.io/api-public/
 * 
 * Endpoints:
 * - Search: https://digimoncard.io/api-public/search
 * - All Cards: https://digimoncard.io/api-public/getAllCards
 * 
 * Rate Limit: 20 req/s recommandé
 * Authentification: Aucune requise
 */

import { metrics } from '../../utils/state.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://digimoncard.io/api-public';
const RATE_LIMIT_MS = 50; // 20 req/s
let lastRequestTime = 0;

/**
 * Appliquer le rate limiting
 */
async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Faire une requête à l'API Digimon
 */
async function digimonRequest(endpoint, params = {}) {
  await rateLimit();
  
  const queryParams = new URLSearchParams(params);
  const url = `${BASE_URL}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  try {
    logger.debug(`[Digimon] Request: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ToyAPI/4.0 (Digimon Integration)'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Digimon API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Gérer les erreurs dans la réponse
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
  } catch (error) {
    logger.error(`[Digimon] Request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Rechercher des cartes Digimon
 * @param {string} query - Nom de la carte à rechercher
 * @param {Object} options - Options de recherche
 * @param {string} options.type - Type (Digimon, Digi-Egg, Tamer, Option)
 * @param {string} options.color - Couleur (Red, Blue, Yellow, Green, Black, Purple, White)
 * @param {string} options.level - Niveau (2-7)
 * @param {string} options.series - Série (Digimon Card Game, Digimon Digi-Battle Card Game)
 * @param {string} options.attribute - Attribut (Vaccine, Virus, Data, Free, Variable)
 * @param {string} options.rarity - Rareté (c, u, r, sr, sec)
 * @param {string} options.stage - Stage (In-Training, Rookie, Champion, Ultimate, Mega)
 * @param {number} options.max - Nombre maximum de résultats (défaut: 100)
 * @param {Function} options.getCached - Fonction de récupération cache
 * @param {Function} options.setCache - Fonction de mise en cache
 */
export async function searchDigimonCards(query, options = {}) {
  const {
    type,
    color,
    level,
    series = 'Digimon Card Game', // Par défaut la série moderne
    attribute,
    rarity,
    stage,
    max = 100,
    bypassCache = false,
    getCached,
    setCache
  } = options;
  
  metrics.sources.digimon.requests++;
  
  logger.info(`[Digimon] Searching: ${query} (series: ${series}, max ${max})`);
  
  try {
    // Vérifier le cache
    const cacheKey = `digimon_search_${query}_${series}_${type || 'all'}_${color || 'all'}_${max}`;
    if (getCached && !bypassCache) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Digimon] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    // Construire les paramètres de recherche
    const params = {
      n: query, // n = name
      series: series
    };
    
    // Filtres additionnels
    if (type) params.type = type;
    if (color) params.color = color;
    if (level) params.level = level;
    if (attribute) params.attribute = attribute;
    if (rarity) params.rarity = rarity;
    if (stage) params.stage = stage;
    
    const data = await digimonRequest('/search', params);
    
    // Limiter les résultats
    const limitedData = Array.isArray(data) ? data.slice(0, max) : [];
    
    const result = {
      total_cards: Array.isArray(data) ? data.length : 0,
      returned: limitedData.length,
      data: limitedData
    };
    
    // Mettre en cache
    if (setCache && result.data.length > 0) {
      await setCache(cacheKey, result);
    }
    
    logger.info(`[Digimon] Found ${result.total_cards} results (returned ${result.returned}) for: ${query}`);
    
    return result;
    
  } catch (error) {
    metrics.sources.digimon.errors++;
    logger.error(`[Digimon] Search error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer une carte Digimon par ID exact
 * @param {string} cardId - ID de la carte (ex: BT1-084)
 * @param {Object} options - Options
 */
export async function getDigimonCardDetails(cardId, options = {}) {
  const { bypassCache = false, getCached, setCache } = options;
  
  metrics.sources.digimon.requests++;
  
  logger.info(`[Digimon] Getting card details: ${cardId}`);
  
  try {
    // Vérifier le cache
    const cacheKey = `digimon_card_${cardId}`;
    if (getCached && !bypassCache) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Digimon] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    // Rechercher par ID exact
    const params = {
      n: cardId,
      series: 'Digimon Card Game'
    };
    
    const data = await digimonRequest('/search', params);
    
    // Trouver la carte avec l'ID exact
    const card = Array.isArray(data) ? data.find(c => c.id === cardId) : null;
    
    if (!card) {
      throw new Error(`Card not found: ${cardId}`);
    }
    
    // Mettre en cache
    if (setCache) {
      await setCache(cacheKey, card);
    }
    
    return card;
    
  } catch (error) {
    metrics.sources.digimon.errors++;
    logger.error(`[Digimon] Card details error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer une carte Digimon par nom exact
 * @param {string} name - Nom exact de la carte
 * @param {Object} options - Options
 */
export async function getDigimonCardByName(name, options = {}) {
  const { series = 'Digimon Card Game', bypassCache = false, getCached, setCache } = options;
  
  metrics.sources.digimon.requests++;
  
  logger.info(`[Digimon] Getting card by name: ${name}`);
  
  try {
    // Vérifier le cache
    const cacheKey = `digimon_name_${name}_${series}`;
    if (getCached && !bypassCache) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Digimon] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    const params = {
      n: name,
      series: series
    };
    
    const data = await digimonRequest('/search', params);
    
    // Trouver la correspondance exacte
    const cards = Array.isArray(data) ? data.filter(c => c.name.toLowerCase() === name.toLowerCase()) : [];
    
    if (cards.length === 0) {
      throw new Error(`Card not found: ${name}`);
    }
    
    // Mettre en cache
    if (setCache) {
      await setCache(cacheKey, cards);
    }
    
    return cards;
    
  } catch (error) {
    metrics.sources.digimon.errors++;
    logger.error(`[Digimon] Card by name error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer toutes les cartes (avec pagination)
 * @param {Object} options - Options
 * @param {string} options.series - Série (défaut: Digimon Card Game)
 * @param {string} options.sort - Tri (name, id, date_added)
 * @param {string} options.sortdirection - Direction (asc, desc)
 * @param {number} options.limit - Limite de résultats
 */
export async function getAllDigimonCards(options = {}) {
  const {
    series = 'Digimon Card Game',
    sort = 'name',
    sortdirection = 'asc',
    limit = 1000,
    getCached,
    setCache
  } = options;
  
  metrics.sources.digimon.requests++;
  
  logger.info(`[Digimon] Getting all cards (series: ${series}, limit: ${limit})`);
  
  try {
    // Vérifier le cache
    const cacheKey = `digimon_all_${series}_${sort}_${sortdirection}_${limit}`;
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Digimon] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    const params = {
      series: series,
      sort: sort,
      sortdirection: sortdirection
    };
    
    const data = await digimonRequest('/getAllCards', params);
    
    // Limiter les résultats si demandé
    const limitedData = Array.isArray(data) ? data.slice(0, limit) : [];
    
    const result = {
      total: Array.isArray(data) ? data.length : 0,
      returned: limitedData.length,
      data: limitedData
    };
    
    // Mettre en cache
    if (setCache && result.data.length > 0) {
      await setCache(cacheKey, result);
    }
    
    logger.info(`[Digimon] Retrieved ${result.returned} of ${result.total} cards`);
    
    return result;
    
  } catch (error) {
    metrics.sources.digimon.errors++;
    logger.error(`[Digimon] Get all cards error: ${error.message}`);
    throw error;
  }
}
