/**
 * lib/normalizers/console.js - Normalizers pour type console
 * 
 * Transforme les données ConsoleVariations en format normalisé
 * 
 * @module normalizers/console
 */

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Mapping des types de release vers noms normalisés
 */
const RELEASE_TYPE_MAP = {
  'retail': 'retail',
  'promotional': 'promotional',
  'promo': 'promotional',
  'bundle': 'bundle',
  'prototype': 'prototype',
  'dev kit': 'prototype',
  'development': 'prototype',
  'test': 'prototype',
  'special': 'other',
  'limited': 'other'
};

/**
 * Seuils pour les niveaux de rareté
 */
const RARITY_THRESHOLDS = [
  { max: 20, level: 'common' },
  { max: 40, level: 'uncommon' },
  { max: 60, level: 'rare' },
  { max: 80, level: 'very_rare' },
  { max: 100, level: 'extremely_rare' }
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalise un type de release
 * @param {string} type - Type original
 * @returns {string|null} - Type normalisé
 */
function normalizeReleaseType(type) {
  if (!type) return null;
  
  const normalized = type.toLowerCase().trim();
  return RELEASE_TYPE_MAP[normalized] || 'other';
}

/**
 * Convertit un score de rareté en niveau
 * @param {number|null} score - Score 0-100
 * @returns {string} - Niveau de rareté
 */
function getRarityLevel(score) {
  if (score === null || score === undefined) return 'unknown';
  
  for (const threshold of RARITY_THRESHOLDS) {
    if (score <= threshold.max) {
      return threshold.level;
    }
  }
  
  return 'extremely_rare';
}

/**
 * Détermine le type d'item depuis le contexte
 * @param {string} type - Type de filtre utilisé
 * @returns {string} - Type normalisé
 */
function normalizeItemType(type) {
  if (!type) return 'unknown';
  
  const normalized = type.toLowerCase();
  
  if (normalized === 'consoles' || normalized === 'console') return 'console';
  if (normalized === 'controllers' || normalized === 'controller') return 'controller';
  if (normalized === 'accessories' || normalized === 'accessory') return 'accessory';
  
  return 'unknown';
}

// ============================================================================
// NORMALIZERS CONSOLEVARIATIONS
// ============================================================================

/**
 * Normalise un résultat de recherche ConsoleVariations
 * @param {object} item - Item brut de recherche
 * @param {string} searchType - Type de recherche (all, consoles, controllers, accessories)
 * @returns {object} - Item normalisé
 */
function normalizeConsoleVariationsSingleSearchResult(item, searchType = 'all') {
  return {
    id: item.slug || null,
    source: 'consolevariations',
    name: item.name || null,
    url: item.url || null,
    thumbnail: item.thumbnail || item.image || null,
    item_type: normalizeItemType(searchType)
  };
}

/**
 * Normalise les résultats de recherche ConsoleVariations
 * @param {object} rawData - Données brutes de searchConsoleVariations
 * @returns {object} - Données normalisées
 */
export function normalizeConsoleVariationsSearch(rawData) {
  if (!rawData) {
    return {
      source: 'consolevariations',
      query: null,
      total: 0,
      results: []
    };
  }
  
  const searchType = rawData.type || 'all';
  const results = (rawData.items || []).map(item => 
    normalizeConsoleVariationsSingleSearchResult(item, searchType)
  );
  
  return {
    source: 'consolevariations',
    query: rawData.query || null,
    total: results.length,
    results
  };
}

/**
 * Normalise les détails d'un item ConsoleVariations
 * @param {object} rawData - Données brutes de getConsoleVariationsItem
 * @returns {object} - Données normalisées
 */
export function normalizeConsoleVariationsDetail(rawData) {
  if (!rawData) return null;
  
  const details = rawData.details || {};
  const stats = rawData.stats || {};
  
  // Construire le tableau d'images
  const images = [];
  if (rawData.images && Array.isArray(rawData.images)) {
    rawData.images.forEach((img, index) => {
      images.push({
        url: img.url || img.original_url,
        thumbnail: img.thumbnail || img.preview_url || img.url,
        alt: img.alt || img.alt_text || null,
        is_main: index === 0
      });
    });
  }
  
  // Construire la plateforme
  let platform = null;
  if (rawData.platform) {
    platform = {
      id: rawData.platform.slug || null,
      name: rawData.platform.name || null
    };
  }
  
  // Construire la rareté
  const rarityScore = stats.rarityScore;
  const rarity = {
    score: typeof rarityScore === 'number' ? rarityScore : null,
    level: getRarityLevel(rarityScore)
  };
  
  // Construire les stats communauté
  const community = {
    want_count: stats.wantCount || 0,
    own_count: stats.ownCount || 0
  };
  
  return {
    id: rawData.slug || null,
    source: 'consolevariations',
    name: rawData.name || null,
    name_original: rawData.nameOriginal || rawData.name || null,
    name_translated: rawData.nameTranslated || null,
    url: rawData.url || null,
    
    brand: rawData.brand || null,
    platform,
    
    images,
    
    release_country: details.releaseCountry || null,
    release_year: details.releaseYear || null,
    release_type: normalizeReleaseType(details.releaseType),
    region_code: details.regionCode || null,
    
    production_quantity: details.amountProduced || null,
    is_limited_edition: details.limitedEdition === true,
    is_bundle: details.isBundle === true,
    color: details.color || null,
    barcode: details.barcode || null,
    
    rarity,
    community
  };
}

/**
 * Normalise les résultats de liste de plateformes
 * @param {object} rawData - Données brutes de listConsoleVariationsPlatforms
 * @returns {object} - Données normalisées
 */
export function normalizeConsoleVariationsPlatforms(rawData) {
  if (!rawData) {
    return {
      source: 'consolevariations',
      type: 'platforms',
      total: 0,
      results: []
    };
  }
  
  const results = (rawData.items || []).map(item => ({
    id: item.slug || null,
    source: 'consolevariations',
    name: item.name || null,
    url: item.url || null,
    brand: rawData.brand || null
  }));
  
  return {
    source: 'consolevariations',
    type: rawData.type || 'platforms',
    brand: rawData.brand || null,
    total: results.length,
    results
  };
}

/**
 * Normalise les résultats de browse d'une plateforme
 * @param {object} rawData - Données brutes de browseConsoleVariationsPlatform
 * @returns {object} - Données normalisées
 */
export function normalizeConsoleVariationsBrowse(rawData) {
  if (!rawData) {
    return {
      source: 'consolevariations',
      platform: null,
      total: 0,
      results: []
    };
  }
  
  const results = (rawData.items || []).map(item => ({
    id: item.slug || null,
    source: 'consolevariations',
    name: item.name || null,
    url: item.url || null,
    thumbnail: item.thumbnail || null,
    item_type: 'unknown' // Le browse ne précise pas le type
  }));
  
  return {
    source: 'consolevariations',
    platform: rawData.platform || null,
    total: results.length,
    results
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Helpers exposés pour tests
  normalizeReleaseType,
  getRarityLevel,
  normalizeItemType
};
