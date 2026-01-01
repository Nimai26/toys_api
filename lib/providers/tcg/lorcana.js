/**
 * Provider Disney Lorcana (LorcanaJSON)
 * Documentation: https://lorcanajson.org/
 * GitHub: https://github.com/LorcanaJSON/LorcanaJSON
 * 
 * Source de données:
 * - https://lorcanajson.org/files/current/{lang}/allCards.json
 * - https://lorcanajson.org/files/current/{lang}/metadata.json
 * 
 * Langues supportées: en, fr, de, it
 * Format: JSON statique (2455 cartes, mise à jour régulière)
 * Avantages: Traductions officielles, données complètes, liens externes
 */

import { metrics } from '../../utils/state.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://lorcanajson.org/files/current';
const CACHE_TTL = 3600000; // 1 heure (les JSON sont statiques)

// Cache en mémoire des données par langue
const cardsCache = {
  en: { data: null, timestamp: 0 },
  fr: { data: null, timestamp: 0 },
  de: { data: null, timestamp: 0 },
  it: { data: null, timestamp: 0 }
};

/**
 * Télécharger les cartes Lorcana pour une langue donnée
 * @param {string} lang - Code langue (en, fr, de, it)
 * @returns {Promise<Object>} - Données complètes { cards, sets, metadata }
 */
async function fetchLorcanaData(lang = 'en') {
  // Vérifier le cache
  const cached = cardsCache[lang];
  if (cached.data && (Date.now() - cached.timestamp) < CACHE_TTL) {
    logger.debug(`[Lorcana] Cache hit for lang: ${lang}`);
    return cached.data;
  }
  
  const url = `${BASE_URL}/${lang}/allCards.json`;
  
  try {
    logger.info(`[Lorcana] Downloading data for lang: ${lang}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ToyAPI/4.0 (LorcanaJSON Integration)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`LorcanaJSON error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Mettre en cache
    cardsCache[lang] = {
      data,
      timestamp: Date.now()
    };
    
    logger.info(`[Lorcana] Loaded ${data.cards?.length || 0} cards for lang: ${lang}`);
    
    return data;
  } catch (error) {
    logger.error(`[Lorcana] Download failed for ${lang}: ${error.message}`);
    throw error;
  }
}

/**
 * Rechercher des cartes Lorcana
 * @param {string} query - Nom de la carte à rechercher
 * @param {Object} options - Options de recherche
 */
export async function searchLorcanaCards(query, options = {}) {
  const {
    lang = 'en',
    color,
    type,
    rarity,
    set,
    cost,
    inkable,
    max = 100,
    page = 1
  } = options;
  
  metrics.sources.lorcana.requests++;
  
  logger.info(`[Lorcana] Searching: "${query}" (lang: ${lang}, max: ${max})`);
  
  try {
    // Charger les données dans la langue demandée
    const data = await fetchLorcanaData(lang);
    const allCards = data.cards || [];
    
    // Filtrer les cartes
    let filtered = allCards;
    
    // Recherche par nom (insensible à la casse)
    if (query) {
      const searchLower = query.toLowerCase();
      filtered = filtered.filter(card => 
        card.name?.toLowerCase().includes(searchLower) ||
        card.fullName?.toLowerCase().includes(searchLower)
      );
    }
    
    // Filtres additionnels
    if (color) {
      // Mapping EN→FR pour les couleurs
      const colorMap = {
        'amber': 'Ambre',
        'amethyst': 'Améthyste',
        'emerald': 'Émeraude', 
        'ruby': 'Rubis',
        'sapphire': 'Saphir',
        'steel': 'Acier'
      };
      const targetColor = lang === 'fr' ? (colorMap[color.toLowerCase()] || color) : color;
      filtered = filtered.filter(card => card.color?.toLowerCase() === targetColor.toLowerCase());
    }
    
    if (type) {
      // Mapping EN→FR pour les types
      const typeMap = {
        'character': 'Personnage',
        'action': 'Action',
        'item': 'Objet',
        'location': 'Lieu'
      };
      const targetType = lang === 'fr' ? (typeMap[type.toLowerCase()] || type) : type;
      filtered = filtered.filter(card => card.type?.toLowerCase() === targetType.toLowerCase());
    }
    
    if (rarity) {
      filtered = filtered.filter(card => card.rarity === rarity);
    }
    
    if (set) {
      filtered = filtered.filter(card => card.setCode === set);
    }
    
    if (cost !== undefined) {
      filtered = filtered.filter(card => card.cost === cost);
    }
    
    if (inkable !== undefined) {
      filtered = filtered.filter(card => card.inkwell === inkable);
    }
    
    // Pagination
    const start = (page - 1) * max;
    const end = start + max;
    const paginated = filtered.slice(start, end);
    
    const result = {
      total_cards: filtered.length,
      page,
      page_size: max,
      total_pages: Math.ceil(filtered.length / max),
      data: paginated,
      metadata: data.metadata
    };
    
    logger.info(`[Lorcana] Found ${filtered.length} results (returning ${paginated.length})`);
    
    return result;
    
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error(`[Lorcana] Search error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer les détails d'une carte Lorcana par ID
 * @param {string} cardId - ID de la carte
 * @param {Object} options - Options { lang }
 */
export async function getLorcanaCardDetails(cardId, options = {}) {
  const { lang = 'en' } = options;
  
  metrics.sources.lorcana.requests++;
  
  logger.info(`[Lorcana] Fetching card: ${cardId} (lang: ${lang})`);
  
  try {
    const data = await fetchLorcanaData(lang);
    const allCards = data.cards || [];
    
    const card = allCards.find(c => 
      c.id === parseInt(cardId) || 
      c.code === cardId ||
      c.fullIdentifier === cardId
    );
    
    if (!card) {
      throw new Error(`Card not found: ${cardId}`);
    }
    
    logger.info(`[Lorcana] Card fetched: ${card.fullName}`);
    
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
 * @param {Object} options - Options { lang }
 */
export async function getLorcanaCardByName(name, options = {}) {
  const { lang = 'en' } = options;
  
  metrics.sources.lorcana.requests++;
  
  logger.info(`[Lorcana] Fetching card by name: ${name} (lang: ${lang})`);
  
  try {
    const data = await fetchLorcanaData(lang);
    const allCards = data.cards || [];
    
    const card = allCards.find(c => 
      c.name === name || 
      c.fullName === name
    );
    
    if (!card) {
      throw new Error(`Card not found: ${name}`);
    }
    
    logger.info(`[Lorcana] Card fetched: ${card.fullName}`);
    
    return card;
    
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error(`[Lorcana] Card by name error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer la liste des sets Lorcana
 * @param {Object} options - Options { lang }
 */
export async function getLorcanaSets(options = {}) {
  const { lang = 'en' } = options;
  
  metrics.sources.lorcana.requests++;
  
  logger.info(`[Lorcana] Fetching sets (lang: ${lang})`);
  
  try {
    const data = await fetchLorcanaData(lang);
    
    logger.info(`[Lorcana] Sets fetched: ${data.sets?.length || 0}`);
    
    return data.sets || [];
    
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error(`[Lorcana] Sets fetch error: ${error.message}`);
    throw error;
  }
}

/**
 * Récupérer toutes les cartes (endpoint /all)
 * @param {Object} options - Options { lang, page, pagesize }
 */
export async function getAllLorcanaCards(options = {}) {
  const {
    lang = 'en',
    page = 1,
    pagesize = 100
  } = options;
  
  metrics.sources.lorcana.requests++;
  
  logger.info(`[Lorcana] Fetching all cards (lang: ${lang}, page: ${page})`);
  
  try {
    const data = await fetchLorcanaData(lang);
    const allCards = data.cards || [];
    
    // Pagination
    const start = (page - 1) * pagesize;
    const end = start + pagesize;
    const paginated = allCards.slice(start, end);
    
    logger.info(`[Lorcana] All cards fetched: ${allCards.length} total, ${paginated.length} returned`);
    
    return paginated;
    
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error(`[Lorcana] All cards fetch error: ${error.message}`);
    throw error;
  }
}
