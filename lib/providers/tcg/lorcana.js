/**
 * Provider Disney Lorcana (Lorcana API)
 * Documentation: https://lorcana-api.com/docs/intro
 * 
 * Endpoints:
 * - Fetch: https://api.lorcana-api.com/cards/fetch
 * - All: https://api.lorcana-api.com/cards/all
 * - Sets: https://api.lorcana-api.com/sets/all
 * 
 * Rate Limit: Aucune limite documentée
 * Authentification: Aucune requise
 */

import { metrics } from '../../utils/state.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.lorcana-api.com';

/**
 * Faire une requête à l'API Lorcana
 */
async function lorcanaRequest(endpoint, params = {}) {
  const queryParams = new URLSearchParams(params);
  const url = `${BASE_URL}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  try {
    logger.debug(`[Lorcana] Request: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ToyAPI/4.0 (Lorcana Integration)'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lorcana API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error(`[Lorcana] Request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Rechercher des cartes Lorcana
 * @param {string} query - Nom de la carte à rechercher
 * @param {Object} options - Options de recherche
 * @param {string} options.color - Couleur (Amber, Amethyst, Emerald, Ruby, Sapphire, Steel)
 * @param {string} options.type - Type (Character, Action, Item, Location)
 * @param {string} options.rarity - Rareté (Common, Uncommon, Rare, Super Rare, Legendary, Enchanted)
 * @param {string} options.set - Nom ou ID du set
 * @param {number} options.cost - Coût en encre
 * @param {boolean} options.inkable - Carte pouvant être utilisée comme encre
 * @param {number} options.max - Nombre maximum de résultats (défaut: 100, max: 1000)
 * @param {number} options.page - Numéro de page
 * @param {Function} options.getCached - Fonction de récupération cache
 * @param {Function} options.setCache - Fonction de mise en cache
 */
export async function searchLorcanaCards(query, options = {}) {
  const {
    color,
    type,
    rarity,
    set,
    cost,
    inkable,
    max = 100,
    page = 1,
    getCached,
    setCache
  } = options;
  
  metrics.sources.lorcana.requests++;
  
  logger.info(`[Lorcana] Searching: ${query} (max ${max}, page ${page})`);
  
  try {
    // Vérifier le cache
    const cacheKey = `lorcana_search_${query}_${color || 'all'}_${type || 'all'}_${max}_${page}`;
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Lorcana] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    // Construire les paramètres de recherche
    const params = {
      pagesize: max,
      page: page
    };
    
    // Construire la requête de recherche
    const searchParts = [];
    
    // Nom de la carte (fuzzy search)
    if (query) {
      searchParts.push(`Name~${query}`);
    }
    
    // Filtres additionnels
    if (color) searchParts.push(`Color=${color}`);
    if (type) searchParts.push(`Type=${type}`);
    if (rarity) searchParts.push(`Rarity=${rarity}`);
    if (set) searchParts.push(`Set_Name~${set}`);
    if (cost !== undefined) searchParts.push(`Cost=${cost}`);
    if (inkable !== undefined) searchParts.push(`Inkable=${inkable ? 'true' : 'false'}`);
    
    if (searchParts.length > 0) {
      params.search = searchParts.join(',');
    }
    
    logger.debug(`[Lorcana] Fetch params: ${JSON.stringify(params)}`);
    const data = await lorcanaRequest('/cards/fetch', params);
    logger.debug(`[Lorcana] Received data type: ${typeof data}, isArray: ${Array.isArray(data)}, length: ${Array.isArray(data) ? data.length : 'N/A'}`);
    
    const result = {
      total_cards: Array.isArray(data) ? data.length : 0,
      page: page,
      page_size: max,
      data: Array.isArray(data) ? data : []
    };
    
    // Mettre en cache
    if (setCache && result.data.length > 0) {
      await setCache(cacheKey, result);
    }
    
    logger.info(`[Lorcana] Found ${result.data.length} results for: ${query}`);
    
    return result;
    
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error(`[Lorcana] Search error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer les détails d'une carte Lorcana par ID
 * @param {string} cardId - Unique_ID de la carte
 * @param {Object} options - Options
 * @param {Function} options.getCached - Fonction de récupération cache
 * @param {Function} options.setCache - Fonction de mise en cache
 */
export async function getLorcanaCardDetails(cardId, options = {}) {
  const { getCached, setCache } = options;
  
  metrics.sources.lorcana.requests++;
  
  logger.info(`[Lorcana] Fetching card: ${cardId}`);
  
  try {
    // Vérifier le cache
    const cacheKey = `lorcana_card_${cardId}`;
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Lorcana] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    // Récupérer la carte par Unique_ID
    const data = await lorcanaRequest('/cards/fetch', { 
      search: `Unique_ID=${cardId}`
    });
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`Card not found: ${cardId}`);
    }
    
    const card = data[0];
    
    // Mettre en cache
    if (setCache) {
      await setCache(cacheKey, card);
    }
    
    logger.info(`[Lorcana] Card fetched: ${card.Name}`);
    
    return card;
    
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error(`[Lorcana] Card fetch error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer les détails d'une carte Lorcana par nom exact
 * @param {string} name - Nom exact de la carte
 * @param {Object} options - Options
 */
export async function getLorcanaCardByName(name, options = {}) {
  const { getCached, setCache } = options;
  
  metrics.sources.lorcana.requests++;
  
  logger.info(`[Lorcana] Fetching card by name: ${name}`);
  
  try {
    // Vérifier le cache
    const cacheKey = `lorcana_name_${name}`;
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Lorcana] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    // Recherche exacte par nom (strict parameter)
    const data = await lorcanaRequest('/cards/fetch', { 
      strict: name
    });
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`Card not found: ${name}`);
    }
    
    const card = data[0];
    
    // Mettre en cache
    if (setCache) {
      await setCache(cacheKey, card);
    }
    
    logger.info(`[Lorcana] Card fetched: ${card.Name}`);
    
    return card;
    
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error(`[Lorcana] Card by name error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer la liste des sets Lorcana
 * @param {Object} options - Options
 * @param {Function} options.getCached - Fonction de récupération cache
 * @param {Function} options.setCache - Fonction de mise en cache
 */
export async function getLorcanaSets(options = {}) {
  const { getCached, setCache } = options;
  
  metrics.sources.lorcana.requests++;
  
  logger.info(`[Lorcana] Fetching sets`);
  
  try {
    // Vérifier le cache
    const cacheKey = 'lorcana_sets_all';
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Lorcana] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    // Récupérer la liste des sets
    const data = await lorcanaRequest('/sets/all');
    
    // Mettre en cache
    if (setCache && data) {
      await setCache(cacheKey, data);
    }
    
    logger.info(`[Lorcana] Sets fetched: ${Array.isArray(data) ? data.length : 0} sets`);
    
    return data;
    
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error(`[Lorcana] Sets fetch error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer toutes les cartes (endpoint /all)
 * @param {Object} options - Options
 * @param {number} options.page - Numéro de page
 * @param {number} options.pagesize - Taille de la page (max 1000)
 */
export async function getAllLorcanaCards(options = {}) {
  const { page = 1, pagesize = 100 } = options;
  
  metrics.sources.lorcana.requests++;
  
  logger.info(`[Lorcana] Fetching all cards (page ${page}, size ${pagesize})`);
  
  try {
    const data = await lorcanaRequest('/cards/all', { 
      page,
      pagesize
    });
    
    logger.info(`[Lorcana] All cards fetched: ${Array.isArray(data) ? data.length : 0} cards`);
    
    return data;
    
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error(`[Lorcana] All cards fetch error: ${error.message}`);
    throw error;
  }
}
