/**
 * lib/normalizers/amazon.js - Normalizers pour Amazon (multi-types)
 * 
 * Transforme les données Amazon en format normalisé
 * Support multi-pays et multi-catégories
 * 
 * @module normalizers/amazon
 */

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Informations des marketplaces
 */
const MARKETPLACE_INFO = {
  fr: { code: 'fr', name: 'Amazon France', domain: 'www.amazon.fr', currency: 'EUR' },
  us: { code: 'us', name: 'Amazon US', domain: 'www.amazon.com', currency: 'USD' },
  uk: { code: 'uk', name: 'Amazon UK', domain: 'www.amazon.co.uk', currency: 'GBP' },
  de: { code: 'de', name: 'Amazon Allemagne', domain: 'www.amazon.de', currency: 'EUR' },
  es: { code: 'es', name: 'Amazon Espagne', domain: 'www.amazon.es', currency: 'EUR' },
  it: { code: 'it', name: 'Amazon Italie', domain: 'www.amazon.it', currency: 'EUR' },
  jp: { code: 'jp', name: 'Amazon Japon', domain: 'www.amazon.co.jp', currency: 'JPY' },
  ca: { code: 'ca', name: 'Amazon Canada', domain: 'www.amazon.ca', currency: 'CAD' }
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Récupère les infos enrichies d'un marketplace
 * @param {string} code - Code pays (fr, us, uk...)
 * @returns {object} - Infos marketplace
 */
function getMarketplaceInfo(code) {
  return MARKETPLACE_INFO[code] || {
    code: code,
    name: `Amazon ${code.toUpperCase()}`,
    domain: `www.amazon.${code}`,
    currency: 'EUR'
  };
}

/**
 * Normalise le statut de disponibilité
 * @param {string} status - Statut original
 * @returns {string} - Statut normalisé
 */
function normalizeAvailabilityStatus(status) {
  if (!status) return 'unknown';
  
  const normalized = status.toLowerCase();
  
  if (normalized === 'in_stock') return 'in_stock';
  if (normalized === 'unavailable') return 'out_of_stock';
  if (normalized === 'limited') return 'limited';
  
  return 'unknown';
}

// ============================================================================
// NORMALIZERS AMAZON
// ============================================================================

/**
 * Normalise un résultat de recherche Amazon
 * @param {object} item - Item brut de recherche
 * @returns {object} - Item normalisé
 */
function normalizeAmazonSingleSearchResult(item) {
  const marketplace = getMarketplaceInfo(item.marketplace);
  
  return {
    id: item.asin,
    source: 'amazon',
    name: item.title || null,
    url: item.url || null,
    thumbnail: item.image || null,
    price: {
      value: item.priceValue || null,
      currency: item.currency || marketplace.currency,
      formatted: item.price || null
    },
    is_prime: item.isPrime === true,
    marketplace
  };
}

/**
 * Normalise les résultats de recherche Amazon
 * @param {object} rawData - Données brutes de searchAmazon
 * @returns {object} - Données normalisées
 */
export function normalizeAmazonSearch(rawData) {
  if (!rawData) {
    return {
      source: 'amazon',
      query: null,
      total: 0,
      results: []
    };
  }
  
  const results = (rawData.results || []).map(item => 
    normalizeAmazonSingleSearchResult(item)
  );
  
  const marketplace = getMarketplaceInfo(rawData.country);
  
  return {
    source: 'amazon',
    query: rawData.query || null,
    marketplace,
    category: rawData.category || null,
    page: rawData.page || 1,
    total: results.length,
    results
  };
}

/**
 * Normalise les détails d'un produit Amazon
 * @param {object} rawData - Données brutes de getAmazonProduct
 * @returns {object} - Données normalisées
 */
export function normalizeAmazonProductDetail(rawData) {
  if (!rawData) return null;
  
  const marketplace = getMarketplaceInfo(rawData.marketplace);
  
  // Construire le tableau d'images
  const images = [];
  if (rawData.images && Array.isArray(rawData.images)) {
    rawData.images.forEach((url, index) => {
      images.push({
        url,
        is_main: index === 0
      });
    });
  } else if (rawData.image) {
    images.push({
      url: rawData.image,
      is_main: true
    });
  }
  
  // Construire le rating
  const rating = {
    value: typeof rawData.rating === 'number' ? rawData.rating : null,
    max: 5,
    votes: rawData.reviewCount || null
  };
  
  // Construire la disponibilité
  const availability = {
    status: normalizeAvailabilityStatus(rawData.availability),
    text: rawData.availabilityText || null
  };
  
  // Déterminer l'ISBN (préférer ISBN-13)
  const isbn = rawData.isbn13 || rawData.isbn10 || null;
  
  return {
    id: rawData.asin,
    source: 'amazon',
    name: rawData.title || null,
    description: rawData.description || null,
    url: rawData.url || null,
    
    images,
    
    price: {
      value: rawData.priceValue || null,
      currency: rawData.currency || marketplace.currency,
      formatted: rawData.price || null
    },
    
    rating,
    
    barcode: rawData.barcode || null,
    barcode_type: rawData.barcodeType || null,
    isbn,
    
    brand: rawData.brand || null,
    is_prime: rawData.isPrime === true,
    
    availability,
    
    attributes: rawData.details || {},
    
    marketplace
  };
}

/**
 * Normalise les résultats de comparaison de prix
 * @param {object} rawData - Données brutes de comparePrices
 * @returns {object} - Données normalisées
 */
export function normalizeAmazonPriceComparison(rawData) {
  if (!rawData) {
    return {
      id: null,
      prices: [],
      best_price: null
    };
  }
  
  const prices = (rawData.prices || []).map(item => ({
    marketplace: getMarketplaceInfo(item.country),
    price: {
      value: item.priceValue || null,
      currency: item.currency || 'EUR',
      formatted: item.price || null
    },
    is_prime: item.isPrime === true,
    availability: item.availability || 'unknown',
    url: item.url || null
  }));
  
  // Best price
  let bestPrice = null;
  if (rawData.bestPrice) {
    bestPrice = {
      marketplace: getMarketplaceInfo(rawData.bestPrice.country),
      price: {
        value: rawData.bestPrice.priceValue || null,
        currency: rawData.bestPrice.currency || 'EUR',
        formatted: rawData.bestPrice.price || null
      }
    };
  }
  
  return {
    id: rawData.asin || null,
    prices,
    best_price: bestPrice
  };
}

/**
 * Normalise les résultats de recherche multi-pays
 * @param {object} rawData - Données brutes de searchMultiCountry
 * @returns {object} - Données normalisées
 */
export function normalizeAmazonMultiCountrySearch(rawData) {
  if (!rawData) {
    return {
      query: null,
      countries: [],
      results: {},
      errors: []
    };
  }
  
  const normalizedResults = {};
  
  if (rawData.results) {
    for (const [country, data] of Object.entries(rawData.results)) {
      normalizedResults[country] = normalizeAmazonSearch(data);
    }
  }
  
  return {
    query: rawData.query || null,
    countries: rawData.countries || [],
    results: normalizedResults,
    errors: rawData.errors ? Object.entries(rawData.errors).map(([country, error]) => ({
      country,
      error
    })) : []
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Helpers exposés pour tests
  getMarketplaceInfo,
  normalizeAvailabilityStatus
};
