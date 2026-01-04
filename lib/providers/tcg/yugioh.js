/**
 * Provider Yu-Gi-Oh! (YGOPRODeck API)
 * Documentation: https://ygoprodeck.com/api-guide/
 * 
 * Endpoints:
 * - Card Info: https://db.ygoprodeck.com/api/v7/cardinfo.php
 * - Card Sets: https://db.ygoprodeck.com/api/v7/cardsets.php
 * 
 * Rate Limit: 20 requests/second (pas de clé requise)
 * Délai recommandé: 50ms entre requêtes
 */

import { metrics } from '../../utils/state.js';
import { logger } from '../../utils/logger.js';
import { fetchViaProxy } from '../../utils/fetch-proxy.js';

const BASE_URL = 'https://db.ygoprodeck.com/api/v7';
const RATE_LIMIT_DELAY = 50; // 50ms entre requêtes (20 req/s)
let lastRequestTime = 0;

/**
 * Attendre pour respecter la rate limit
 */
async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Faire une requête à l'API YGOPRODeck
 */
async function ygoprodeckRequest(endpoint, params = {}) {
  await waitForRateLimit();
  
  const queryParams = new URLSearchParams(params);
  const url = `${BASE_URL}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  try {
    logger.debug(`[Yu-Gi-Oh!] Request: ${url}`);
    
    const response = await fetchViaProxy(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ToyAPI/4.0 (YGOPRODeck Integration)'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YGOPRODeck API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error(`[Yu-Gi-Oh!] Request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Rechercher des cartes Yu-Gi-Oh!
 * @param {string} query - Nom de la carte à rechercher
 * @param {Object} options - Options de recherche
 * @param {string} options.type - Type de carte (Monster, Spell, Trap)
 * @param {string} options.race - Race/Type (Dragon, Spellcaster, etc.)
 * @param {string} options.attribute - Attribut (DARK, LIGHT, etc.)
 * @param {number} options.level - Niveau
 * @param {string} options.archetype - Archétype
 * @param {number} options.max - Nombre maximum de résultats
 * @param {string} options.sort - Tri (name, atk, def, level)
 * @param {string} options.lang - Langue (en, fr, de, it, pt)
 * @param {Function} options.getCached - Fonction de récupération cache
 * @param {Function} options.setCache - Fonction de mise en cache
 */
export async function searchYuGiOhCards(query, options = {}) {
  const {
    type,
    race,
    attribute,
    level,
    archetype,
    max = 20,
    sort = 'name',
    lang = 'en',
    getCached,
    setCache
  } = options;
  
  metrics.sources.yugioh.requests++;
  
  logger.info(`[Yu-Gi-Oh!] Searching: ${query} (max ${max}, lang ${lang})`);
  
  try {
    // Vérifier le cache
    const cacheKey = `yugioh_search_${query}_${type || 'all'}_${race || 'all'}_${lang}_${max}`;
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Yu-Gi-Oh!] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    // Construire les paramètres de recherche
    const params = {
      fname: query  // Fuzzy name search
    };
    
    // Ajouter le paramètre language pour YGOPRODeck
    // Langues supportées: en, fr, de, it, pt
    if (lang && lang !== 'en' && ['fr', 'de', 'it', 'pt'].includes(lang)) {
      params.language = lang;
    }
    
    if (type) params.type = type;
    if (race) params.race = race;
    if (attribute) params.attribute = attribute;
    if (level) params.level = level;
    if (archetype) params.archetype = archetype;
    if (sort) params.sort = sort;
    
    const data = await ygoprodeckRequest('/cardinfo.php', params);
    
    // Limiter les résultats
    const cards = data.data ? data.data.slice(0, max) : [];
    
    const result = {
      total_cards: data.data ? data.data.length : 0,
      data: cards
    };
    
    // Mettre en cache
    if (setCache && cards.length > 0) {
      await setCache(cacheKey, result);
    }
    
    logger.info(`[Yu-Gi-Oh!] Found ${cards.length} results for: ${query}`);
    
    return result;
    
  } catch (error) {
    metrics.sources.yugioh.errors++;
    logger.error(`[Yu-Gi-Oh!] Search error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer les détails d'une carte Yu-Gi-Oh! par ID
 * @param {string|number} cardId - ID de la carte
 * @param {Object} options - Options
 * @param {string} options.lang - Langue (en, fr, de, it, pt)
 * @param {Function} options.getCached - Fonction de récupération cache
 * @param {Function} options.setCache - Fonction de mise en cache
 */
export async function getYuGiOhCardDetails(cardId, options = {}) {
  const { lang = 'en', getCached, setCache } = options;
  
  metrics.sources.yugioh.requests++;
  
  logger.info(`[Yu-Gi-Oh!] Fetching card: ${cardId} (lang ${lang})`);
  
  try {
    // Vérifier le cache
    const cacheKey = `yugioh_card_${cardId}_${lang}`;
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Yu-Gi-Oh!] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    // Construire les paramètres
    const params = { id: cardId };
    if (lang && lang !== 'en' && ['fr', 'de', 'it', 'pt'].includes(lang)) {
      params.language = lang;
    }
    
    // Récupérer la carte par ID
    const data = await ygoprodeckRequest('/cardinfo.php', params);
    
    if (!data.data || data.data.length === 0) {
      throw new Error(`Card not found: ${cardId}`);
    }
    
    const card = data.data[0];
    
    // Mettre en cache
    if (setCache) {
      await setCache(cacheKey, card);
    }
    
    logger.info(`[Yu-Gi-Oh!] Card fetched: ${card.name}`);
    
    return card;
    
  } catch (error) {
    metrics.sources.yugioh.errors++;
    logger.error(`[Yu-Gi-Oh!] Card fetch error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer les détails d'une carte Yu-Gi-Oh! par nom exact
 * @param {string} name - Nom exact de la carte
 * @param {Object} options - Options
 * @param {string} options.lang - Langue (en, fr, de, it, pt)
 */
export async function getYuGiOhCardByName(name, options = {}) {
  const { lang = 'en', getCached, setCache } = options;
  
  metrics.sources.yugioh.requests++;
  
  logger.info(`[Yu-Gi-Oh!] Fetching card by name: ${name} (lang ${lang})`);
  
  try {
    // Vérifier le cache
    const cacheKey = `yugioh_name_${name}_${lang}`;
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Yu-Gi-Oh!] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    // Construire les paramètres
    const params = { name: name };
    if (lang && lang !== 'en' && ['fr', 'de', 'it', 'pt'].includes(lang)) {
      params.language = lang;
    }
    
    // Recherche exacte par nom
    const data = await ygoprodeckRequest('/cardinfo.php', params);
    
    if (!data.data || data.data.length === 0) {
      throw new Error(`Card not found: ${name}`);
    }
    
    const card = data.data[0];
    
    // Mettre en cache
    if (setCache) {
      await setCache(cacheKey, card);
    }
    
    logger.info(`[Yu-Gi-Oh!] Card fetched: ${card.name}`);
    
    return card;
    
  } catch (error) {
    metrics.sources.yugioh.errors++;
    logger.error(`[Yu-Gi-Oh!] Card by name error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer la liste des sets/archétypes Yu-Gi-Oh!
 * @param {Object} options - Options
 * @param {Function} options.getCached - Fonction de récupération cache
 * @param {Function} options.setCache - Fonction de mise en cache
 */
export async function getYuGiOhSets(options = {}) {
  const { getCached, setCache } = options;
  
  metrics.sources.yugioh.requests++;
  
  logger.info(`[Yu-Gi-Oh!] Fetching sets/archetypes`);
  
  try {
    // Vérifier le cache
    const cacheKey = 'yugioh_sets_all';
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Yu-Gi-Oh!] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    // Récupérer la liste des sets
    const data = await ygoprodeckRequest('/cardsets.php');
    
    // Mettre en cache
    if (setCache && data) {
      await setCache(cacheKey, data);
    }
    
    logger.info(`[Yu-Gi-Oh!] Sets fetched: ${data?.length || 0} sets`);
    
    return data;
    
  } catch (error) {
    metrics.sources.yugioh.errors++;
    logger.error(`[Yu-Gi-Oh!] Sets fetch error: ${error.message}`);
    throw error;
  }
}

/**
 * Rechercher des cartes par archétype
 * @param {string} archetype - Nom de l'archétype
 * @param {Object} options - Options
 */
export async function searchByArchetype(archetype, options = {}) {
  const { max = 20, getCached, setCache } = options;
  
  metrics.sources.yugioh.requests++;
  
  logger.info(`[Yu-Gi-Oh!] Searching archetype: ${archetype}`);
  
  try {
    const cacheKey = `yugioh_archetype_${archetype}_${max}`;
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[Yu-Gi-Oh!] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    const data = await ygoprodeckRequest('/cardinfo.php', { archetype });
    
    const cards = data.data ? data.data.slice(0, max) : [];
    
    const result = {
      archetype,
      total_cards: data.data ? data.data.length : 0,
      data: cards
    };
    
    if (setCache && cards.length > 0) {
      await setCache(cacheKey, result);
    }
    
    logger.info(`[Yu-Gi-Oh!] Found ${cards.length} cards in archetype: ${archetype}`);
    
    return result;
    
  } catch (error) {
    metrics.sources.yugioh.errors++;
    logger.error(`[Yu-Gi-Oh!] Archetype search error: ${error.message}`);
    throw error;
  }
}
