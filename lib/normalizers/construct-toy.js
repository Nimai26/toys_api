/**
 * lib/normalizers/construct-toy.js
 * Fonctions de normalisation pour le type construct_toy
 * 
 * Transforme les données brutes des providers vers le format harmonisé v3.0.0
 * 
 * @module normalizers/construct-toy
 */

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Mapping des statuts de disponibilité vers le format normalisé
 */
export const AVAILABILITY_STATUS_MAP = {
  // LEGO
  'E_AVAILABLE': 'in_stock',
  'F_BACKORDER_FOR_DATE': 'backorder',
  'C_OUT_OF_STOCK': 'out_of_stock',
  'D_TEMPORARILY_SOLD_OUT': 'temporarily_unavailable',
  
  // Playmobil
  'available': 'in_stock',
  'out_of_stock': 'out_of_stock',
  
  // Klickypedia
  'discontinued': 'retired',
  'unknown': 'unknown',
  
  // Valeurs normalisées (passthrough)
  'in_stock': 'in_stock',
  'out_of_stock': 'out_of_stock',
  'backorder': 'backorder',
  'preorder': 'preorder',
  'temporarily_unavailable': 'temporarily_unavailable',
  'retired': 'retired',
  'coming_soon': 'coming_soon'
};

/**
 * Mapping theme_id Rebrickable → nom du thème
 */
export const REBRICKABLE_THEME_MAP = {
  1: 'Technic',
  158: 'Star Wars',
  246: 'City',
  435: 'Friends',
  494: 'NINJAGO',
  577: 'Minecraft',
  610: 'Ideas',
  673: 'Speed Champions',
  687: 'Creator Expert',
  688: 'Architecture',
  695: 'Botanical Collection',
  696: 'Art',
  697: 'Icons'
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Normalise un statut de disponibilité
 * @param {string|boolean} status - Statut brut
 * @returns {string} Statut normalisé
 */
export function normalizeAvailabilityStatus(status) {
  if (status === null || status === undefined) return 'unknown';
  
  // Boolean (Mega: inStock)
  if (typeof status === 'boolean') {
    return status ? 'in_stock' : 'out_of_stock';
  }
  
  const str = String(status).toLowerCase();
  return AVAILABILITY_STATUS_MAP[status] || AVAILABILITY_STATUS_MAP[str] || 'unknown';
}

/**
 * Parse une tranche d'âge vers min/max
 * @param {string} ageRange - Ex: "18+", "6-12", "3+"
 * @returns {{minAge: number|null, maxAge: number|null, ageRange: string|null}}
 */
export function parseAgeRange(ageRange) {
  if (!ageRange) return { minAge: null, maxAge: null, ageRange: null };
  
  const str = String(ageRange).trim();
  
  // Format "18+" ou "3+"
  const plusMatch = str.match(/(\d+)\s*\+/);
  if (plusMatch) {
    return { 
      minAge: parseInt(plusMatch[1]), 
      maxAge: null, 
      ageRange: `${plusMatch[1]}+` 
    };
  }
  
  // Format "6-12" ou "6 - 12"
  const rangeMatch = str.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    return { 
      minAge: parseInt(rangeMatch[1]), 
      maxAge: parseInt(rangeMatch[2]), 
      ageRange: `${rangeMatch[1]}-${rangeMatch[2]}` 
    };
  }
  
  // Nombre seul
  const numMatch = str.match(/(\d+)/);
  if (numMatch) {
    return { 
      minAge: parseInt(numMatch[1]), 
      maxAge: null, 
      ageRange: `${numMatch[1]}+` 
    };
  }
  
  return { minAge: null, maxAge: null, ageRange: null };
}

/**
 * Extrait l'âge depuis un titre (format Mega: "... - 7 Ans Et +")
 * @param {string} title - Titre du produit
 * @returns {{minAge: number|null, maxAge: number|null, ageRange: string|null}}
 */
export function extractAgeFromTitle(title) {
  if (!title) return { minAge: null, maxAge: null, ageRange: null };
  
  const match = title.match(/(\d+)\s*(?:ans?|years?)\s*(?:et\s*)?\+/i);
  if (match) {
    return {
      minAge: parseInt(match[1]),
      maxAge: null,
      ageRange: `${match[1]}+`
    };
  }
  
  return { minAge: null, maxAge: null, ageRange: null };
}

/**
 * Extrait l'année d'une date
 * @param {string|number|Date} date - Date ou année
 * @returns {number|null}
 */
export function extractYear(date) {
  if (!date) return null;
  
  if (typeof date === 'number') {
    return date >= 1900 && date <= 2100 ? date : null;
  }
  
  if (date instanceof Date) {
    return date.getFullYear();
  }
  
  const str = String(date);
  
  // Format ISO ou YYYY-MM-DD
  if (str.includes('-') || str.includes('T')) {
    const year = parseInt(str.substring(0, 4));
    return year >= 1900 && year <= 2100 ? year : null;
  }
  
  // Année seule
  const year = parseInt(str);
  return year >= 1900 && year <= 2100 ? year : null;
}

/**
 * Calcule le prix par pièce
 * @param {number} price - Prix total
 * @param {number} pieceCount - Nombre de pièces
 * @returns {number|null}
 */
export function calculatePricePerPiece(price, pieceCount) {
  if (!price || !pieceCount || pieceCount === 0) return null;
  return Math.round((price / pieceCount) * 1000) / 1000;
}

/**
 * Génère l'URL de détails pour un provider
 * @param {string} provider - Nom du provider
 * @param {string} id - ID du produit
 * @returns {string}
 */
export function generateDetailUrl(provider, id) {
  const routes = {
    'lego': `/lego/product/${id}`,
    'playmobil': `/playmobil/product/${id}`,
    'klickypedia': `/klickypedia/product/${id}`,
    'mega': `/mega/product/${id}`,
    'rebrickable': `/rebrickable/set/${id}`
  };
  return routes[provider] || `/${provider}/product/${id}`;
}

/**
 * Nettoie un titre (supprime les suffixes standards)
 * @param {string} title - Titre brut
 * @returns {string}
 */
export function cleanTitle(title) {
  if (!title) return null;
  
  return title
    // Supprimer les suffixes d'âge
    .replace(/\s*[-–]\s*(?:Jouet|Briques?)\s*[Dd]e\s*[Cc]onstruction\s*[-–]\s*\d+\s*[Aa]ns?\s*[Ee]t\s*\+/gi, '')
    .replace(/\s*[-–]\s*\d+\s*[Aa]ns?\s*[Ee]t\s*\+/gi, '')
    // Supprimer les mentions de pièces
    .replace(/\s*\(\d+\s*(?:Pieces?|Pcs?|pièces?|Onderdelen|Teile|Pezzi)\)/gi, '')
    .trim();
}

/**
 * Extrait la franchise depuis le titre ou la marque
 * @param {string} title - Titre du produit
 * @param {string} brand - Marque
 * @returns {string|null}
 */
export function extractFranchise(title, brand) {
  if (!title) return null;
  
  const franchises = [
    'Pokémon', 'Pokemon',
    'Star Wars',
    'Harry Potter',
    'Marvel', 'Spider-Man', 'Spiderman',
    'DC', 'Batman', 'Superman',
    'Minecraft',
    'Jurassic', 'Jurassic World', 'Jurassic Park',
    'Disney', 'Frozen', 'Elsa',
    'Transformers',
    'Hot Wheels',
    'Barbie',
    'Halo',
    'Call of Duty',
    'Destiny',
    'Assassin\'s Creed'
  ];
  
  const titleLower = title.toLowerCase();
  
  for (const franchise of franchises) {
    if (titleLower.includes(franchise.toLowerCase())) {
      // Normaliser certains noms
      if (franchise.toLowerCase() === 'pokemon') return 'Pokémon';
      if (franchise.toLowerCase() === 'spiderman') return 'Spider-Man';
      return franchise;
    }
  }
  
  return null;
}

/**
 * Convertit un prix en centimes vers un nombre décimal
 * @param {number} centAmount - Montant en centimes
 * @returns {number|null}
 */
export function centToDecimal(centAmount) {
  if (centAmount === null || centAmount === undefined) return null;
  return Math.round(centAmount) / 100;
}

/**
 * Formate un prix avec devise
 * @param {number} amount - Montant
 * @param {string} currency - Code devise
 * @returns {string|null}
 */
export function formatPrice(amount, currency) {
  if (amount === null || amount === undefined) return null;
  
  const symbols = {
    'EUR': '€',
    'USD': '$',
    'GBP': '£',
    'CHF': 'CHF'
  };
  
  const symbol = symbols[currency] || currency || '';
  
  // S'assurer que amount est un nombre
  const numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(numAmount)) {
    return null;
  }
  
  // Format européen pour EUR
  if (currency === 'EUR') {
    return `${numAmount.toFixed(2).replace('.', ',')} ${symbol}`.trim();
  }
  
  // Format US/UK
  return `${symbol}${numAmount.toFixed(2)}`.trim();
}

// ============================================================================
// NORMALISATION FORMAT RECHERCHE
// ============================================================================

/**
 * Crée un objet de recherche normalisé vide
 * @returns {object}
 */
export function createSearchResult() {
  return {
    type: 'construct_toy',
    source: null,
    sourceId: null,
    name: null,
    name_original: null,
    image: null,
    detailUrl: null
  };
}

/**
 * Normalise un résultat de recherche LEGO
 * @param {object} raw - Données brutes
 * @returns {object}
 */
export function normalizeLegoSearch(raw) {
  const result = createSearchResult();
  
  result.source = 'lego';
  result.sourceId = raw.productCode || raw.id;
  result.name = raw.name;
  result.name_original = null;
  result.image = raw.thumb || raw.baseImgUrl || raw.image || raw.primaryImage;
  result.detailUrl = generateDetailUrl('lego', result.sourceId);
  
  return result;
}

/**
 * Normalise un résultat de recherche Playmobil
 * @param {object} raw - Données brutes
 * @returns {object}
 */
export function normalizePlaymobilSearch(raw) {
  const result = createSearchResult();
  
  result.source = 'playmobil';
  result.sourceId = raw.productCode || raw.id;
  result.name = raw.name;
  result.name_original = null;
  result.image = raw.thumb || raw.baseImgUrl;
  result.detailUrl = generateDetailUrl('playmobil', result.sourceId);
  
  return result;
}

/**
 * Normalise un résultat de recherche Klickypedia
 * @param {object} raw - Données brutes
 * @param {string} lang - Langue demandée
 * @returns {object}
 */
export function normalizeKlickypediaSearch(raw, lang = 'fr') {
  const result = createSearchResult();
  
  result.source = 'klickypedia';
  result.sourceId = raw.productCode || raw.id;
  
  // Utiliser la traduction si disponible
  if (raw.translations && raw.translations[lang]) {
    result.name = raw.translations[lang];
    result.name_original = raw.name;
  } else {
    result.name = raw.name || raw.fullName;
    result.name_original = null;
  }
  
  result.image = raw.thumb || raw.baseImgUrl;
  result.detailUrl = generateDetailUrl('klickypedia', result.sourceId);
  
  return result;
}

/**
 * Normalise un résultat de recherche Mega
 * @param {object} raw - Données brutes
 * @returns {object}
 */
export function normalizeMegaSearch(raw) {
  const result = createSearchResult();
  
  result.source = 'mega';
  result.sourceId = raw.id;
  result.name = cleanTitle(raw.title || raw.name);
  result.name_original = raw.title || raw.name;
  result.image = raw.thumbnail || (raw.images && raw.images[0]);
  result.detailUrl = generateDetailUrl('mega', raw.sku || raw.id);
  
  return result;
}

/**
 * Normalise un résultat de recherche Rebrickable
 * @param {object} raw - Données brutes
 * @returns {object}
 */
export function normalizeRebrickableSearch(raw) {
  const result = createSearchResult();
  
  result.source = 'rebrickable';
  result.sourceId = raw.set_num;
  result.name = raw.name;
  result.name_original = null;
  result.image = raw.set_img_url;
  result.detailUrl = generateDetailUrl('rebrickable', raw.set_num);
  
  return result;
}

// ============================================================================
// NORMALISATION FORMAT DÉTAILS
// ============================================================================

/**
 * Crée un objet de détails normalisé vide
 * @returns {object}
 */
export function createDetailResult() {
  return {
    type: 'construct_toy',
    source: null,
    sourceId: null,
    sourceRef: null,
    
    productCode: null,
    sku: null,
    ean: null,
    upc: null,
    
    name: null,
    name_original: null,
    description: null,
    description_original: null,
    slug: null,
    
    brand: null,
    theme: null,
    theme_original: null,
    subtheme: null,
    subtheme_original: null,
    franchise: null,
    
    specs: {
      pieceCount: null,
      figureCount: null,
      minAge: null,
      maxAge: null,
      ageRange: null,
      weight: null,
      dimensions: {
        width: null,
        height: null,
        depth: null,
        unit: 'cm'
      },
      scale: null,
      difficulty: null
    },
    
    packaging: {
      format: null,
      weight: null,
      dimensions: {
        width: null,
        height: null,
        depth: null
      }
    },
    
    pricing: {
      price: null,
      originalPrice: null,
      currency: null,
      currencySymbol: null,
      formatted: null,
      discount: null,
      onSale: false,
      pricePerPiece: null
    },
    
    availability: {
      status: 'unknown',
      statusText: null,
      statusText_original: null,
      inStock: null,
      quantity: null,
      canAddToBag: null,
      isNew: null,
      isExclusive: null,
      isRetired: null,
      isComingSoon: null,
      releaseDate: null,
      releaseYear: null,
      retireDate: null,
      retireYear: null
    },
    
    rating: {
      average: null,
      count: null,
      distribution: null
    },
    
    instructions: {
      available: false,
      count: null,
      format: null,
      manuals: []
    },
    
    parts: {
      totalCount: null,
      uniqueCount: null,
      spareCount: null,
      items: []
    },
    
    minifigs: {
      count: null,
      items: []
    },
    
    images: {
      primary: null,
      thumbnail: null,
      box_front: null,
      box_back: null,
      gallery: []
    },
    
    videos: [],
    
    urls: {
      official: null,
      source: null,
      api: null
    },
    
    translations: {
      en: null,
      fr: null,
      de: null,
      es: null,
      it: null,
      pt: null,
      nl: null,
      ja: null
    },
    
    related: {
      alternates: [],
      similar: [],
      series: [],
      accessories: []
    },
    
    tags: [],
    categories: [],
    features: [],
    
    meta: {
      fetchedAt: new Date().toISOString(),
      lastModified: null,
      lang: null,
      locale: null
    }
  };
}

/**
 * Normalise les détails LEGO
 * @param {object} raw - Données brutes
 * @param {string} lang - Locale
 * @returns {object}
 */
export function normalizeLegoDetail(raw, lang = 'fr-FR') {
  const result = createDetailResult();
  
  // Identification
  result.source = 'lego';
  result.sourceId = raw.productCode || raw.id;
  result.sourceRef = raw.productCode;
  result.productCode = raw.productCode;
  result.sku = raw.variant?.sku || raw.sku;
  
  // Noms
  result.name = raw.name;
  result.description = raw.description;
  result.slug = raw.slug;
  
  // Marque et thème
  result.brand = 'LEGO';
  result.theme = raw.theme;
  
  // Specs
  const ageData = parseAgeRange(raw.ageRange || raw.variant?.attributes?.ageRange);
  result.specs.pieceCount = raw.pieceCount || raw.variant?.attributes?.pieceCount;
  result.specs.figureCount = raw.minifiguresCount || 0;
  result.specs.minAge = ageData.minAge;
  result.specs.maxAge = ageData.maxAge;
  result.specs.ageRange = ageData.ageRange;
  
  if (raw.dimensions) {
    result.specs.dimensions.width = raw.dimensions.width ? parseFloat(raw.dimensions.width) : null;
    result.specs.dimensions.height = raw.dimensions.height ? parseFloat(raw.dimensions.height) : null;
    result.specs.dimensions.depth = raw.dimensions.depth ? parseFloat(raw.dimensions.depth) : null;
  }
  
  // Prix
  const price = raw.price || raw.variant?.price;
  const listPrice = raw.listPrice || raw.variant?.listPrice;
  
  if (price) {
    result.pricing.price = price.centAmount ? centToDecimal(price.centAmount) : price;
    result.pricing.currency = price.currencyCode || 'EUR';
    result.pricing.currencySymbol = price.currencyCode === 'EUR' ? '€' : '$';
    result.pricing.formatted = price.formattedAmount || formatPrice(result.pricing.price, result.pricing.currency);
  }
  
  if (listPrice) {
    result.pricing.originalPrice = listPrice.centAmount ? centToDecimal(listPrice.centAmount) : listPrice;
  }
  
  result.pricing.onSale = raw.onSale || raw.variant?.salePercentage > 0;
  result.pricing.discount = raw.variant?.salePercentage || null;
  result.pricing.pricePerPiece = calculatePricePerPiece(result.pricing.price, result.specs.pieceCount);
  
  // Disponibilité
  const availStatus = raw.availabilityStatus || raw.variant?.attributes?.availabilityStatus;
  result.availability.status = normalizeAvailabilityStatus(availStatus);
  result.availability.statusText = raw.availabilityText || raw.variant?.attributes?.availabilityText;
  result.availability.inStock = result.availability.status === 'in_stock';
  result.availability.canAddToBag = raw.canAddToBag || raw.variant?.attributes?.canAddToBag;
  result.availability.isNew = raw.isNew || raw.variant?.attributes?.isNew;
  result.availability.isExclusive = raw.isExclusive;
  
  // Rating
  result.rating.average = raw.rating || raw.variant?.attributes?.rating;
  result.rating.count = raw.reviewCount;
  
  // Instructions
  if (raw.instructions) {
    result.instructions.available = true;
    result.instructions.count = raw.instructions.count || raw.instructions.manuals?.length;
    result.instructions.format = 'pdf';
    result.instructions.manuals = (raw.instructions.manuals || []).map(m => ({
      id: m.id,
      description: m.description,
      url: m.url,
      pdfUrl: m.pdfUrl || m.url
    }));
  }
  
  // Images
  result.images.primary = raw.baseImgUrl || (raw.images && raw.images[0]);
  result.images.thumbnail = raw.thumb || raw.primaryImage || result.images.primary;
  if (Array.isArray(raw.images)) {
    result.images.gallery = raw.images.slice(1);
  }
  
  // URLs
  result.urls.official = `https://www.lego.com/${lang.toLowerCase()}/product/${raw.slug || raw.productCode}`;
  result.urls.source = result.urls.official;
  
  // Minifigs
  result.minifigs.count = raw.minifiguresCount || 0;
  
  // Tags
  if (raw.featuredFlags) {
    result.tags = Array.isArray(raw.featuredFlags) ? raw.featuredFlags : [raw.featuredFlags];
  }
  if (raw.isNew) result.tags.push('new');
  if (raw.isExclusive) result.tags.push('exclusive');
  
  // Meta
  result.meta.lang = lang.split('-')[0];
  result.meta.locale = lang;
  
  return result;
}

/**
 * Normalise les détails Playmobil
 * @param {object} raw - Données brutes
 * @param {string} lang - Locale
 * @returns {object}
 */
export function normalizePlaymobilDetail(raw, lang = 'fr-FR') {
  const result = createDetailResult();
  
  // Identification
  result.source = 'playmobil';
  result.sourceId = raw.productCode || raw.id;
  result.sourceRef = raw.productCode;
  result.productCode = raw.productCode;
  
  // Noms
  result.name = raw.name;
  result.description = raw.description;
  result.slug = raw.slug || raw.productCode;
  
  // Marque et thème
  result.brand = 'Playmobil';
  result.theme = raw.category ? raw.category.charAt(0).toUpperCase() + raw.category.slice(1) : null;
  result.subtheme = raw.subcategory;
  
  // Specs
  const ageData = parseAgeRange(raw.attributes?.ageRange);
  result.specs.pieceCount = raw.attributes?.pieceCount;
  result.specs.minAge = ageData.minAge;
  result.specs.maxAge = ageData.maxAge;
  result.specs.ageRange = ageData.ageRange;
  
  // Prix
  if (raw.price !== null && raw.price !== undefined) {
    result.pricing.price = raw.discountPrice || raw.price;
    result.pricing.originalPrice = raw.discountPrice ? raw.price : null;
    result.pricing.currency = raw.currency || 'EUR';
    result.pricing.currencySymbol = result.pricing.currency === 'EUR' ? '€' : '$';
    result.pricing.formatted = formatPrice(result.pricing.price, result.pricing.currency);
    result.pricing.onSale = raw.discountPrice !== null && raw.discountPrice !== undefined;
    result.pricing.pricePerPiece = calculatePricePerPiece(result.pricing.price, result.specs.pieceCount);
  }
  
  // Disponibilité
  result.availability.status = normalizeAvailabilityStatus(raw.availability?.status);
  result.availability.statusText = raw.availability?.text;
  result.availability.inStock = result.availability.status === 'in_stock';
  result.availability.canAddToBag = raw.attributes?.canAddToBag;
  
  // Rating
  result.rating.average = raw.attributes?.rating;
  
  // Instructions
  if (raw.instructions) {
    result.instructions.available = true;
    result.instructions.count = 1;
    result.instructions.format = 'pdf';
    result.instructions.manuals = [{
      url: raw.instructions,
      pdfUrl: raw.instructions
    }];
  }
  
  // Images
  result.images.primary = raw.baseImgUrl;
  result.images.thumbnail = raw.thumb;
  if (Array.isArray(raw.images)) {
    result.images.gallery = raw.images;
    // Extraire box_front et box_back si présents
    for (const img of raw.images) {
      if (img.includes('_box_front')) result.images.box_front = img;
      if (img.includes('_box_back')) result.images.box_back = img;
    }
  }
  
  // URLs
  result.urls.official = raw.url;
  result.urls.source = raw.url;
  
  // Catégories
  if (raw.category) {
    result.categories.push(raw.category);
  }
  
  // Meta
  result.meta.lang = lang.split('-')[0];
  result.meta.locale = lang;
  
  return result;
}

/**
 * Normalise les détails Klickypedia
 * @param {object} raw - Données brutes
 * @param {string} lang - Langue
 * @returns {object}
 */
export function normalizeKlickypediaDetail(raw, lang = 'fr') {
  const result = createDetailResult();
  
  // Identification
  result.source = 'klickypedia';
  result.sourceId = raw.productCode || raw.id;
  result.sourceRef = raw.productCode;
  result.productCode = raw.productCode;
  
  // Noms avec traduction
  if (raw.translations && raw.translations[lang]) {
    result.name = raw.translations[lang];
    result.name_original = raw.name;
  } else {
    result.name = raw.name;
  }
  result.description = raw.description;
  result.slug = raw.slug;
  
  // Marque et thème
  result.brand = 'Playmobil';
  result.theme = raw.attributes?.theme;
  
  // Specs
  result.specs.figureCount = raw.attributes?.figureCount;
  
  // Packaging
  result.packaging.format = raw.attributes?.format;
  
  // Disponibilité (historique)
  result.availability.status = normalizeAvailabilityStatus(raw.availability?.status);
  result.availability.isRetired = raw.availability?.status === 'discontinued';
  result.availability.releaseYear = raw.released || raw.availability?.released;
  result.availability.retireYear = raw.discontinued || raw.availability?.discontinued;
  
  if (result.availability.releaseYear) {
    result.availability.releaseDate = `${result.availability.releaseYear}-01-01`;
  }
  if (result.availability.retireYear) {
    result.availability.retireDate = `${result.availability.retireYear}-01-01`;
  }
  
  // Images
  result.images.primary = raw.baseImgUrl;
  result.images.thumbnail = raw.thumb;
  if (Array.isArray(raw.images)) {
    result.images.gallery = raw.images;
  }
  
  // URLs
  result.urls.source = raw.url;
  
  // Traductions
  if (raw.translations) {
    result.translations = { ...result.translations, ...raw.translations };
  }
  
  // Tags
  if (raw.attributes?.tags) {
    result.tags = Array.isArray(raw.attributes.tags) ? raw.attributes.tags : [raw.attributes.tags];
  }
  
  // Catégories
  if (raw.category) {
    result.categories.push(raw.category);
  }
  
  // Meta
  result.meta.lang = lang;
  
  return result;
}

/**
 * Normalise les détails Mega
 * @param {object} raw - Données brutes
 * @param {string} lang - Locale
 * @returns {object}
 */
export function normalizeMegaDetail(raw, lang = 'fr-FR') {
  const result = createDetailResult();
  
  // Identification
  result.source = 'mega';
  result.sourceId = raw.id;
  result.sourceRef = raw.sku;
  result.productCode = raw.sku;
  result.sku = raw.sku;
  
  // Noms
  result.name = cleanTitle(raw.title || raw.name);
  result.name_original = raw.title || raw.name;
  result.description = raw.description;
  
  // Marque et thème
  result.brand = raw.brand || 'MEGA';
  result.franchise = extractFranchise(raw.title || raw.name, raw.brand);
  
  // Specs
  const ageData = extractAgeFromTitle(raw.title || raw.name);
  result.specs.pieceCount = raw.pieces;
  result.specs.minAge = ageData.minAge;
  result.specs.maxAge = ageData.maxAge;
  result.specs.ageRange = ageData.ageRange;
  
  // Prix
  if (raw.price !== null && raw.price !== undefined) {
    result.pricing.price = raw.price;
    result.pricing.currency = raw.currency || 'EUR';
    result.pricing.currencySymbol = result.pricing.currency === 'EUR' ? '€' : '$';
    result.pricing.formatted = formatPrice(raw.price, result.pricing.currency);
    result.pricing.pricePerPiece = calculatePricePerPiece(raw.price, raw.pieces);
  }
  
  // Disponibilité
  result.availability.status = normalizeAvailabilityStatus(raw.inStock);
  result.availability.inStock = raw.inStock;
  
  // Rating
  result.rating.average = raw.rating;
  result.rating.count = raw.ratingCount;
  
  // Images
  if (Array.isArray(raw.images) && raw.images.length > 0) {
    result.images.primary = raw.images[0];
    result.images.gallery = raw.images.slice(1);
  }
  result.images.thumbnail = raw.thumbnail;
  
  // URLs
  result.urls.official = raw.url;
  result.urls.source = raw.url;
  
  // Meta
  result.meta.lang = lang.split('-')[0];
  result.meta.locale = lang;
  
  return result;
}

/**
 * Normalise les détails Rebrickable
 * @param {object} raw - Données brutes (set + parts + minifigs)
 * @returns {object}
 */
export function normalizeRebrickableDetail(raw) {
  const result = createDetailResult();
  
  // Identification
  result.source = 'rebrickable';
  result.sourceId = raw.set_num;
  result.sourceRef = raw.set_num.replace(/-\d+$/, ''); // Enlever le suffixe -1
  result.productCode = raw.set_num;
  
  // Noms
  result.name = raw.name;
  result.slug = raw.set_url ? raw.set_url.split('/').filter(Boolean).pop() : null;
  
  // Marque et thème
  result.brand = 'LEGO';
  result.theme = REBRICKABLE_THEME_MAP[raw.theme_id] || null;
  
  // Specs
  result.specs.pieceCount = raw.num_parts;
  result.availability.releaseYear = raw.year;
  result.availability.status = 'unknown';
  
  // Parts (si inclus)
  if (raw.parts) {
    result.parts.totalCount = raw.num_parts;
    result.parts.uniqueCount = raw.parts.count || (raw.parts.parts ? raw.parts.parts.length : null);
    
    // Compter les pièces de rechange
    if (raw.parts.parts) {
      result.parts.spareCount = raw.parts.parts.filter(p => p.is_spare).length;
      result.parts.items = raw.parts.parts.map(p => ({
        partNum: p.part_num,
        name: p.name,
        color: p.color_name,
        colorRgb: p.color_rgb,
        quantity: p.quantity,
        isSpare: p.is_spare,
        imageUrl: p.part_img_url,
        elementId: p.element_id
      }));
    }
  }
  
  // Minifigs (si inclus)
  if (raw.minifigs) {
    result.minifigs.count = raw.minifigs.count || 0;
    if (raw.minifigs.minifigs) {
      result.minifigs.items = raw.minifigs.minifigs.map(m => ({
        id: m.fig_num || m.set_num,
        name: m.name || m.set_name,
        quantity: m.quantity,
        imageUrl: m.set_img_url,
        numParts: m.num_parts
      }));
    }
  }
  
  result.specs.figureCount = result.minifigs.count;
  
  // Images
  result.images.primary = raw.set_img_url;
  result.images.thumbnail = raw.set_img_url;
  
  // URLs
  result.urls.source = raw.set_url;
  result.urls.api = `https://rebrickable.com/api/v3/lego/sets/${raw.set_num}/`;
  
  // Meta
  result.meta.lastModified = raw.last_modified_dt;
  
  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Constantes
  AVAILABILITY_STATUS_MAP,
  REBRICKABLE_THEME_MAP,
  
  // Utilitaires
  normalizeAvailabilityStatus,
  parseAgeRange,
  extractAgeFromTitle,
  extractYear,
  calculatePricePerPiece,
  generateDetailUrl,
  cleanTitle,
  extractFranchise,
  centToDecimal,
  formatPrice,
  
  // Recherche
  createSearchResult,
  normalizeLegoSearch,
  normalizePlaymobilSearch,
  normalizeKlickypediaSearch,
  normalizeMegaSearch,
  normalizeRebrickableSearch,
  
  // Détails
  createDetailResult,
  normalizeLegoDetail,
  normalizePlaymobilDetail,
  normalizeKlickypediaDetail,
  normalizeMegaDetail,
  normalizeRebrickableDetail
};
