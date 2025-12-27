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
// NORMALIZERS PAR CATÉGORIE - Format unifié selon le type
// ============================================================================

// ----------------------------------------------------------------------------
// VIDEOGAMES - Format unifié avec JVC, RAWG, IGDB
// ----------------------------------------------------------------------------

/**
 * Normalise un résultat de recherche Amazon Videogames vers le format videogame
 * @param {object} item - Item brut
 * @returns {object} - Item normalisé format videogame
 */
export function normalizeAmazonVideogameSearchItem(item) {
  const marketplace = getMarketplaceInfo(item.marketplace);
  
  return {
    type: 'videogame',
    provider: 'amazon',
    provider_id: item.asin,
    
    title: item.title || '',
    original_title: null,
    alternative_titles: [],
    
    description: null,
    storyline: null,
    
    release_date: null,
    year: null,
    tba: false,
    
    platforms: item.platform ? [{
      id: null,
      name: item.platform,
      abbreviation: null
    }] : [],
    
    genres: [],
    themes: [],
    game_modes: [],
    player_perspectives: [],
    keywords: [],
    
    developers: [],
    publishers: [],
    
    franchise: null,
    collection: null,
    
    age_rating: null,
    
    is_multiplayer: null,
    multiplayer_modes: [],
    max_players: null,
    
    media: null,
    
    rating: item.rating ? {
      value: Math.round(item.rating * 20),
      count: item.reviewCount || null,
      source: 'amazon'
    } : null,
    metacritic: null,
    
    playtime: null,
    
    images: {
      cover: item.image || null,
      cover_small: null,
      background: null,
      screenshots: [],
      artworks: []
    },
    
    videos: [],
    stores: [{
      name: marketplace.name,
      url: item.url
    }],
    websites: [],
    related: null,
    
    external_ids: {
      rawg_id: null,
      rawg_slug: null,
      igdb_id: null,
      igdb_slug: null,
      jvc_id: null,
      amazon_asin: item.asin
    },
    
    // Données Amazon spécifiques
    amazon_data: {
      asin: item.asin,
      price: item.price || null,
      price_value: item.priceValue || null,
      currency: item.currency || marketplace.currency,
      is_prime: item.isPrime || false,
      marketplace: marketplace.code
    },
    
    source_url: item.url || `https://${marketplace.domain}/dp/${item.asin}`,
    data_source: 'amazon'
  };
}

/**
 * Normalise les détails d'un produit Amazon Videogames vers le format videogame
 * @param {object} data - Données brutes
 * @returns {object} - Données normalisées format videogame
 */
export function normalizeAmazonVideogameDetail(data) {
  if (!data) return null;
  
  const marketplace = getMarketplaceInfo(data.marketplace);
  
  // Images
  const images = {
    cover: data.image || (data.images && data.images[0]) || null,
    cover_small: null,
    background: null,
    screenshots: data.images ? data.images.slice(1) : [],
    artworks: []
  };
  
  // Age rating depuis PEGI
  const ageRating = data.pegi || data.minAge ? {
    pegi: data.pegi ? `PEGI ${data.pegi}` : null,
    esrb: null,
    min_age: data.minAge || data.pegi || null,
    content_descriptors: []
  } : null;
  
  return {
    type: 'videogame',
    provider: 'amazon',
    provider_id: data.asin,
    
    title: data.title || '',
    original_title: null,
    alternative_titles: [],
    
    description: data.description || (data.features ? data.features.join(' ') : null),
    storyline: null,
    
    release_date: data.releaseDate || null,
    release_date_text: data.releaseDateText || null,
    year: data.releaseDate ? parseInt(data.releaseDate.substring(0, 4), 10) : null,
    tba: false,
    
    platforms: data.platform ? [{
      id: null,
      name: data.platform,
      abbreviation: null
    }] : [],
    
    genres: [],
    themes: [],
    game_modes: [],
    player_perspectives: [],
    keywords: [],
    
    developers: [],
    publishers: data.brand ? [data.brand] : [],
    
    franchise: null,
    collection: null,
    
    age_rating: ageRating,
    
    is_multiplayer: data.isMultiplayer || false,
    multiplayer_modes: [],
    min_players: data.minPlayers || null,
    max_players: data.maxPlayers || null,
    players_text: data.nbPlayersText || null,
    
    media: null,
    
    rating: data.rating ? {
      value: Math.round(data.rating * 20),
      count: data.reviewCount || null,
      source: 'amazon'
    } : null,
    metacritic: null,
    
    playtime: null,
    
    images,
    
    videos: [],
    stores: [{
      name: marketplace.name,
      url: data.url
    }],
    websites: [],
    related: null,
    
    features: data.features || [],
    
    external_ids: {
      rawg_id: null,
      rawg_slug: null,
      igdb_id: null,
      igdb_slug: null,
      jvc_id: null,
      amazon_asin: data.asin
    },
    
    // Données Amazon spécifiques
    amazon_data: {
      asin: data.asin,
      price: data.price || null,
      price_value: data.priceValue || null,
      currency: data.currency || marketplace.currency,
      is_prime: data.isPrime || false,
      availability: data.availability || null,
      availability_text: data.availabilityText || null,
      marketplace: marketplace.code,
      barcode: data.barcode || null,
      barcode_type: data.barcodeType || null
    },
    
    source_url: data.url || `https://${marketplace.domain}/dp/${data.asin}`,
    data_source: 'amazon'
  };
}

// ----------------------------------------------------------------------------
// BOOKS - Format unifié avec Google Books, OpenLibrary
// ----------------------------------------------------------------------------

/**
 * Normalise un résultat de recherche Amazon Books vers le format book
 * @param {object} item - Item brut
 * @returns {object} - Item normalisé format book
 */
export function normalizeAmazonBookSearchItem(item) {
  const marketplace = getMarketplaceInfo(item.marketplace);
  
  return {
    type: 'book',
    subtype: null,
    source: 'amazon',
    sourceId: item.asin,
    
    name: item.title || 'Sans titre',
    name_original: null,
    
    authors: [],
    authorsDetailed: null,
    
    publisher: null,
    collection: null,
    
    releaseDate: null,
    year: null,
    
    tome: null,
    series: null,
    
    synopsis: null,
    
    genres: [],
    
    language: null,
    
    physical: {
      pages: null,
      format: null,
      coverType: null
    },
    
    identifiers: {
      isbn: null,
      isbn10: null,
      isbn13: null,
      amazon_asin: item.asin
    },
    
    pricing: {
      price: item.priceValue || null,
      currency: item.currency || marketplace.currency,
      formatted: item.price || null
    },
    
    images: [{
      url: item.image || null,
      is_main: true
    }],
    
    urls: {
      detail: item.url || `https://${marketplace.domain}/dp/${item.asin}`,
      preview: null,
      info: null
    },
    
    // Données Amazon spécifiques
    amazon_data: {
      asin: item.asin,
      is_prime: item.isPrime || false,
      rating: item.rating || null,
      review_count: item.reviewCount || null,
      marketplace: marketplace.code
    }
  };
}

/**
 * Normalise les détails d'un produit Amazon Books vers le format book
 * @param {object} data - Données brutes
 * @returns {object} - Données normalisées format book
 */
export function normalizeAmazonBookDetail(data) {
  if (!data) return null;
  
  const marketplace = getMarketplaceInfo(data.marketplace);
  
  // Images
  const images = [];
  if (data.images && Array.isArray(data.images)) {
    data.images.forEach((url, index) => {
      images.push({ url, is_main: index === 0 });
    });
  } else if (data.image) {
    images.push({ url: data.image, is_main: true });
  }
  
  // ISBN
  const identifiers = {
    isbn: data.isbn13 || data.isbn10 || null,
    isbn10: data.isbn10 || null,
    isbn13: data.isbn13 || null,
    amazon_asin: data.asin,
    barcode: data.barcode || null
  };
  
  return {
    type: 'book',
    subtype: null,
    source: 'amazon',
    sourceId: data.asin,
    
    name: data.title || 'Sans titre',
    name_original: null,
    
    authors: data.brand ? [data.brand] : [],
    authorsDetailed: null,
    
    publisher: null,
    collection: null,
    
    releaseDate: data.releaseDate || null,
    releaseDate_original: data.releaseDateText || null,
    year: data.releaseDate ? parseInt(data.releaseDate.substring(0, 4), 10) : null,
    
    tome: null,
    series: null,
    
    synopsis: data.description || null,
    synopsis_original: null,
    
    genres: [],
    genres_original: [],
    
    language: null,
    
    physical: {
      pages: data.details?.Pages || data.details?.['Nombre de pages'] || null,
      format: data.details?.Format || null,
      coverType: null
    },
    
    identifiers,
    
    pricing: {
      price: data.priceValue || null,
      currency: data.currency || marketplace.currency,
      formatted: data.price || null
    },
    
    images,
    
    urls: {
      detail: data.url || `https://${marketplace.domain}/dp/${data.asin}`,
      preview: null,
      info: null
    },
    
    // Données Amazon spécifiques
    amazon_data: {
      asin: data.asin,
      is_prime: data.isPrime || false,
      availability: data.availability || null,
      availability_text: data.availabilityText || null,
      rating: data.rating || null,
      review_count: data.reviewCount || null,
      marketplace: marketplace.code,
      details: data.details || {}
    }
  };
}

// ----------------------------------------------------------------------------
// MOVIES - Format unifié avec TMDB, IMDB
// ----------------------------------------------------------------------------

/**
 * Normalise un résultat de recherche Amazon Movies vers le format movie
 * @param {object} item - Item brut
 * @returns {object} - Item normalisé format movie
 */
export function normalizeAmazonMovieSearchItem(item) {
  const marketplace = getMarketplaceInfo(item.marketplace);
  
  return {
    provider_id: item.asin,
    imdb_id: null,
    tmdb_id: null,
    amazon_asin: item.asin,
    
    title: item.title || '',
    original_title: null,
    
    description: null,
    year: null,
    release_date: null,
    
    poster_url: item.image || null,
    
    rating_value: item.rating || null,
    rating_count: item.reviewCount || null,
    
    genres: [],
    original_language: null,
    
    // Données Amazon spécifiques
    amazon_data: {
      asin: item.asin,
      price: item.price || null,
      price_value: item.priceValue || null,
      currency: item.currency || marketplace.currency,
      is_prime: item.isPrime || false,
      marketplace: marketplace.code
    },
    
    source_url: item.url || `https://${marketplace.domain}/dp/${item.asin}`,
    source: 'amazon'
  };
}

/**
 * Normalise les détails d'un produit Amazon Movies vers le format movie
 * @param {object} data - Données brutes
 * @returns {object} - Données normalisées format movie
 */
export function normalizeAmazonMovieDetail(data) {
  if (!data) return null;
  
  const marketplace = getMarketplaceInfo(data.marketplace);
  
  // Images
  const images = [];
  if (data.images && Array.isArray(data.images)) {
    data.images.forEach((url, index) => {
      images.push({ type: index === 0 ? 'poster' : 'screenshot', url });
    });
  }
  
  return {
    provider_id: data.asin,
    imdb_id: null,
    tmdb_id: null,
    tvdb_id: null,
    amazon_asin: data.asin,
    
    title: data.title || '',
    original_title: null,
    tagline: null,
    
    description: data.description || null,
    
    year: data.releaseDate ? parseInt(data.releaseDate.substring(0, 4), 10) : null,
    release_date: data.releaseDate || null,
    runtime_minutes: null,
    status: null,
    
    is_adult: false,
    
    poster_url: data.image || (data.images && data.images[0]) || null,
    backdrop_url: null,
    images,
    trailers: [],
    
    rating_value: data.rating || null,
    rating_count: data.reviewCount || null,
    popularity: null,
    metacritic_score: null,
    
    genres: [],
    keywords: [],
    certifications: data.pegi ? [{ country: 'FR', rating: `PEGI ${data.pegi}` }] : [],
    
    original_language: null,
    languages: [],
    countries: [],
    studios: data.brand ? [data.brand] : [],
    
    budget: null,
    revenue: null,
    
    directors: [],
    writers: [],
    cast: [],
    
    collection: null,
    
    external_ids: {
      amazon_asin: data.asin,
      barcode: data.barcode || null
    },
    
    recommendations: [],
    similar: [],
    
    // Données Amazon spécifiques
    amazon_data: {
      asin: data.asin,
      price: data.price || null,
      price_value: data.priceValue || null,
      currency: data.currency || marketplace.currency,
      is_prime: data.isPrime || false,
      availability: data.availability || null,
      availability_text: data.availabilityText || null,
      marketplace: marketplace.code,
      format: data.details?.Format || null,
      details: data.details || {}
    },
    
    source_url: data.url || `https://${marketplace.domain}/dp/${data.asin}`,
    source: 'amazon'
  };
}

// ----------------------------------------------------------------------------
// MUSIC - Format unifié avec MusicBrainz, Discogs, Deezer
// ----------------------------------------------------------------------------

/**
 * Normalise un résultat de recherche Amazon Music vers le format album
 * @param {object} item - Item brut
 * @returns {object} - Item normalisé format album
 */
export function normalizeAmazonMusicSearchItem(item) {
  const marketplace = getMarketplaceInfo(item.marketplace);
  
  // Essayer d'extraire l'artiste du titre
  let artist = null;
  let albumTitle = item.title || '';
  const titleMatch = (item.title || '').match(/^(.+?)\s*[-–:]\s*(.+)$/);
  if (titleMatch) {
    artist = titleMatch[1].trim();
    albumTitle = titleMatch[2].trim();
  }
  
  return {
    id: `amazon_${item.asin}`,
    provider: 'amazon',
    provider_id: item.asin,
    type: 'album',
    album_type: 'album',
    
    title: albumTitle,
    artist: artist,
    artist_id: null,
    
    year: null,
    release_date: null,
    
    genres: [],
    track_count: null,
    explicit: false,
    
    images: {
      thumbnail: item.image || null,
      cover: item.image || null,
      cover_large: null
    },
    
    external_ids: {
      musicbrainz_id: null,
      discogs_id: null,
      deezer_id: null,
      itunes_id: null,
      amazon_asin: item.asin,
      barcode: null
    },
    
    // Données Amazon spécifiques
    amazon_data: {
      asin: item.asin,
      price: item.price || null,
      price_value: item.priceValue || null,
      currency: item.currency || marketplace.currency,
      is_prime: item.isPrime || false,
      rating: item.rating || null,
      review_count: item.reviewCount || null,
      marketplace: marketplace.code
    },
    
    url: item.url || `https://${marketplace.domain}/dp/${item.asin}`,
    score: null
  };
}

/**
 * Normalise les détails d'un produit Amazon Music vers le format album
 * @param {object} data - Données brutes
 * @returns {object} - Données normalisées format album
 */
export function normalizeAmazonMusicDetail(data) {
  if (!data) return null;
  
  const marketplace = getMarketplaceInfo(data.marketplace);
  
  // Essayer d'extraire l'artiste du titre ou de la marque
  let artist = data.brand || null;
  let albumTitle = data.title || '';
  if (!artist) {
    const titleMatch = (data.title || '').match(/^(.+?)\s*[-–:]\s*(.+)$/);
    if (titleMatch) {
      artist = titleMatch[1].trim();
      albumTitle = titleMatch[2].trim();
    }
  }
  
  // Images
  const images = {
    thumbnail: data.image || (data.images && data.images[0]) || null,
    cover: data.image || (data.images && data.images[0]) || null,
    cover_large: data.images && data.images.length > 1 ? data.images[1] : null,
    all: data.images || []
  };
  
  return {
    id: `amazon_${data.asin}`,
    provider: 'amazon',
    provider_id: data.asin,
    type: 'album',
    album_type: 'album',
    album_subtypes: [],
    
    title: albumTitle,
    
    artists: artist ? [{
      id: null,
      name: artist,
      role: 'main',
      join_phrase: null
    }] : [],
    artist: artist,
    
    year: data.releaseDate ? parseInt(data.releaseDate.substring(0, 4), 10) : null,
    release_date: data.releaseDate || null,
    original_release_date: null,
    country: marketplace.code.toUpperCase(),
    
    genres: [],
    styles: [],
    tags: [],
    
    label: data.brand || null,
    labels: [],
    
    tracks: [],
    track_count: data.details?.['Nombre de disques'] || null,
    disc_count: null,
    
    duration_seconds: null,
    duration_formatted: null,
    
    formats: data.details?.Format ? [data.details.Format] : [],
    
    rating: data.rating ? {
      value: data.rating,
      max: 5,
      votes: data.reviewCount || null,
      source: 'amazon'
    } : null,
    
    community: null,
    
    pricing: {
      price: data.priceValue || null,
      currency: data.currency || marketplace.currency,
      formatted: data.price || null
    },
    
    explicit: false,
    
    images,
    
    external_ids: {
      musicbrainz_id: null,
      discogs_id: null,
      deezer_id: null,
      itunes_id: null,
      amazon_asin: data.asin,
      barcode: data.barcode || null,
      upc: data.barcode || null
    },
    
    releases: [],
    
    notes: data.description || null,
    
    // Données Amazon spécifiques
    amazon_data: {
      asin: data.asin,
      price: data.price || null,
      price_value: data.priceValue || null,
      currency: data.currency || marketplace.currency,
      is_prime: data.isPrime || false,
      availability: data.availability || null,
      availability_text: data.availabilityText || null,
      marketplace: marketplace.code,
      details: data.details || {}
    },
    
    url: data.url || `https://${marketplace.domain}/dp/${data.asin}`
  };
}

// ----------------------------------------------------------------------------
// TOYS - Format générique enrichi
// ----------------------------------------------------------------------------

/**
 * Normalise un résultat de recherche Amazon Toys vers le format toy
 * @param {object} item - Item brut
 * @returns {object} - Item normalisé format toy
 */
export function normalizeAmazonToySearchItem(item) {
  const marketplace = getMarketplaceInfo(item.marketplace);
  
  return {
    type: 'toy',
    source: 'amazon',
    source_id: item.asin,
    
    name: item.title || '',
    brand: null,
    
    description: null,
    
    image: item.image || null,
    images: item.image ? [item.image] : [],
    
    price: {
      value: item.priceValue || null,
      currency: item.currency || marketplace.currency,
      formatted: item.price || null
    },
    
    rating: item.rating ? {
      value: item.rating,
      count: item.reviewCount || null,
      source: 'amazon'
    } : null,
    
    age_range: null,
    
    identifiers: {
      amazon_asin: item.asin,
      barcode: null
    },
    
    // Données Amazon spécifiques
    amazon_data: {
      asin: item.asin,
      is_prime: item.isPrime || false,
      marketplace: marketplace.code
    },
    
    url: item.url || `https://${marketplace.domain}/dp/${item.asin}`
  };
}

/**
 * Normalise les détails d'un produit Amazon Toys vers le format toy
 * @param {object} data - Données brutes
 * @returns {object} - Données normalisées format toy
 */
export function normalizeAmazonToyDetail(data) {
  if (!data) return null;
  
  const marketplace = getMarketplaceInfo(data.marketplace);
  
  return {
    type: 'toy',
    source: 'amazon',
    source_id: data.asin,
    
    name: data.title || '',
    brand: data.brand || null,
    
    description: data.description || null,
    
    image: data.image || (data.images && data.images[0]) || null,
    images: data.images || [],
    
    price: {
      value: data.priceValue || null,
      currency: data.currency || marketplace.currency,
      formatted: data.price || null
    },
    
    rating: data.rating ? {
      value: data.rating,
      count: data.reviewCount || null,
      source: 'amazon'
    } : null,
    
    age_range: data.details?.['Âge recommandé'] || data.details?.['Age Range'] || null,
    
    identifiers: {
      amazon_asin: data.asin,
      barcode: data.barcode || null,
      barcode_type: data.barcodeType || null
    },
    
    attributes: data.details || {},
    
    // Données Amazon spécifiques
    amazon_data: {
      asin: data.asin,
      is_prime: data.isPrime || false,
      availability: data.availability || null,
      availability_text: data.availabilityText || null,
      marketplace: marketplace.code
    },
    
    url: data.url || `https://${marketplace.domain}/dp/${data.asin}`
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
