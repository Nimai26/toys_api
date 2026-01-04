/**
 * Provider Magic: The Gathering (Scryfall API)
 * Documentation: https://scryfall.com/docs/api
 * 
 * Endpoints:
 * - Search: https://api.scryfall.com/cards/search?q={query}
 * - Card: https://api.scryfall.com/cards/{id}
 * - Sets: https://api.scryfall.com/sets
 * 
 * Rate Limit: 10 requests/second (pas de clé requise)
 * Délai recommandé: 100ms entre requêtes
 */

import { metrics } from '../../utils/state.js';
import { logger } from '../../utils/logger.js';
import { fetchViaProxy } from '../../utils/fetch-proxy.js';

const BASE_URL = 'https://api.scryfall.com';
const RATE_LIMIT_DELAY = 100; // 100ms entre requêtes
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
 * Faire une requête à l'API Scryfall
 */
async function scryfallRequest(endpoint, options = {}) {
  await waitForRateLimit();
  
  const url = `${BASE_URL}${endpoint}`;
  
  try {
    logger.debug(`[MTG] Request: ${url}`);
    
    const response = await fetchViaProxy(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ToyAPI/4.0 (Scryfall Integration)'
      },
      ...options
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Scryfall API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error(`[MTG] Request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Rechercher des cartes Magic
 * @param {string} query - Recherche (nom ou syntaxe Scryfall)
 * @param {Object} options - Options de recherche
 * @param {string} options.lang - Code langue (en, fr, es, de, it, pt, ja, ko, ru, zh-Hans, zh-Hant)
 * @param {number} options.max - Nombre maximum de résultats
 * @param {string} options.order - Ordre de tri (name, set, released, rarity, color, usd, tix, eur, cmc, power, toughness, edhrec, penny, artist, review)
 * @param {string} options.unique - Mode unicité (cards, art, prints)
 * @param {string} options.dir - Direction tri (auto, asc, desc)
 * @param {Function} options.getCached - Fonction de récupération cache
 * @param {Function} options.setCache - Fonction de mise en cache
 */
export async function searchMTGCards(query, options = {}) {
  const {
    lang = 'en',
    max = 20,
    order = 'name',
    unique = 'cards',
    dir = 'auto',
    getCached,
    setCache
  } = options;
  
  metrics.sources.mtg.requests++;
  
  logger.info(`[MTG] Searching: ${query} (max ${max}, lang ${lang})`);
  
  try {
    // Vérifier le cache
    const cacheKey = `mtg_search_${query}_${lang}_${max}_${order}_${unique}`;
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[MTG] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    // Construire la requête Scryfall
    // Si la query ne contient pas d'opérateurs, chercher dans le nom
    let searchQuery = query.includes(':') ? query : `name:${query}`;
    
    // Ajouter le filtre de langue si différent de 'any'
    if (lang && lang !== 'any') {
      searchQuery += ` lang:${lang}`;
    }
    
    const params = new URLSearchParams({
      q: searchQuery,
      unique: unique,
      order: order,
      dir: dir,
      page: 1
    });
    
    const data = await scryfallRequest(`/cards/search?${params}`);
    
    // Limiter les résultats
    const cards = data.data ? data.data.slice(0, max) : [];
    
    const result = {
      total_cards: data.total_cards || 0,
      has_more: data.has_more || false,
      data: cards
    };
    
    // Mettre en cache
    if (setCache && cards.length > 0) {
      await setCache(cacheKey, result);
    }
    
    logger.info(`[MTG] Found ${cards.length} results for: ${query}`);
    
    return result;
    
  } catch (error) {
    metrics.sources.mtg.errors++;
    logger.error(`[MTG] Search error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer les détails d'une carte Magic par ID
 * @param {string} cardId - ID Scryfall de la carte (UUID ou set/collector_number)
 * @param {Object} options - Options
 * @param {string} options.lang - Code langue
 * @param {Function} options.getCached - Fonction de récupération cache
 * @param {Function} options.setCache - Fonction de mise en cache
 */
export async function getMTGCardDetails(cardId, options = {}) {
  const { lang = 'en', getCached, setCache } = options;
  
  metrics.sources.mtg.requests++;
  
  logger.info(`[MTG] Fetching card: ${cardId} (lang: ${lang})`);
  
  try {
    // Vérifier le cache
    const cacheKey = `mtg_card_${cardId}_${lang}`;
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[MTG] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    // Récupérer la carte avec la langue spécifiée
    // Scryfall supporte le format: /cards/{id} ou /cards/{set}/{collector_number}/{lang}
    let endpoint;
    
    if (cardId.includes('/')) {
      // Format set/collector_number - ajouter la langue
      endpoint = `/cards/${cardId}/${lang}`;
    } else {
      // Format ID Scryfall - utiliser le paramètre lang dans la query
      const params = new URLSearchParams({ lang });
      endpoint = `/cards/${cardId}?${params}`;
    }
    
    let card;
    try {
      card = await scryfallRequest(endpoint);
    } catch (error) {
      // Si la carte n'existe pas dans cette langue, fallback vers EN
      if (error.message.includes('404') && lang !== 'en') {
        logger.warn(`[MTG] Card ${cardId} not available in ${lang}, falling back to EN`);
        const fallbackEndpoint = cardId.includes('/') 
          ? `/cards/${cardId}/en` 
          : `/cards/${cardId}`;
        card = await scryfallRequest(fallbackEndpoint);
      } else {
        throw error;
      }
    }
    
    // Mettre en cache
    if (setCache) {
      await setCache(cacheKey, card);
    }
    
    logger.info(`[MTG] Card fetched: ${card.name}`);
    
    return card;
    
  } catch (error) {
    metrics.sources.mtg.errors++;
    logger.error(`[MTG] Card fetch error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer la liste des sets Magic
 * @param {Object} options - Options de filtrage
 * @param {Function} options.getCached - Fonction de récupération cache
 * @param {Function} options.setCache - Fonction de mise en cache
 */
export async function getMTGSets(options = {}) {
  const { getCached, setCache } = options;
  
  metrics.sources.mtg.requests++;
  
  logger.info(`[MTG] Fetching sets`);
  
  try {
    // Vérifier le cache
    const cacheKey = 'mtg_sets_all';
    if (getCached) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug(`[MTG] Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    
    const data = await scryfallRequest('/sets');
    
    // Mettre en cache
    if (setCache && data.data) {
      await setCache(cacheKey, data);
    }
    
    logger.info(`[MTG] Sets fetched: ${data.data?.length || 0} sets`);
    
    return data;
    
  } catch (error) {
    metrics.sources.mtg.errors++;
    logger.error(`[MTG] Sets fetch error: ${error.message}`);
    throw error;
  }
}

/**
 * Rechercher une carte par nom exact
 * @param {string} name - Nom exact de la carte
 * @param {string} set - Code du set (optionnel)
 */
export async function getMTGCardByName(name, set = null) {
  metrics.sources.mtg.requests++;
  
  try {
    const params = new URLSearchParams({ exact: name });
    if (set) params.append('set', set);
    
    const card = await scryfallRequest(`/cards/named?${params}`);
    
    logger.info(`[MTG] Card found by name: ${card.name}`);
    
    return card;
    
  } catch (error) {
    metrics.sources.mtg.errors++;
    logger.error(`[MTG] Card by name error: ${error.message}`);
    throw error;
  }
}
