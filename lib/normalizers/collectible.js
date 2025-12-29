/**
 * lib/normalizers/collectible.js - Normaliseur pour objets de collection
 * 
 * Normalise les réponses de Coleka, Lulu-Berlu, Transformerland
 * vers un format unifié v3.0.0
 * 
 * @module normalizers/collectible
 */

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalise une condition d'item
 * @param {string} condition - Condition source
 * @returns {string} Condition normalisée
 */
export function normalizeCondition(condition) {
  if (!condition) return 'unknown';
  
  const c = String(condition).toLowerCase();
  
  // Sealed/New
  if (c.includes('sealed') || c.includes('misb') || c.includes('mib') || 
      c === 'new' || c === 'neuf') {
    return 'sealed';
  }
  
  // Mint
  if (c.includes('mint') || c.includes('near mint') || c === 'a+' || c === 'parfait') {
    return 'mint';
  }
  
  // Complete
  if (c.includes('complete') || c.includes('complet') || c.includes('c10') || 
      c.includes('with box')) {
    return 'complete';
  }
  
  // Loose
  if (c.includes('loose') || c.includes('no box') || c.includes('opened') || 
      c.includes('sans boîte')) {
    return 'loose';
  }
  
  // Incomplete
  if (c.includes('incomplete') || c.includes('incomplet') || c.includes('missing')) {
    return 'incomplete';
  }
  
  // Damaged
  if (c.includes('damaged') || c.includes('broken') || c.includes('for parts') || 
      c.includes('endommagé') || c.includes('cassé')) {
    return 'damaged';
  }
  
  return 'unknown';
}

/**
 * Normalise une disponibilité
 * @param {string} availability - Disponibilité source
 * @returns {string} Disponibilité normalisée
 */
export function normalizeAvailability(availability) {
  if (!availability) return 'unknown';
  
  const a = String(availability).toLowerCase();
  
  // In stock
  if (a.includes('instock') || a.includes('in_stock') || a.includes('en stock') || 
      a.includes('available') || a.includes('disponible')) {
    return 'in_stock';
  }
  
  // Out of stock
  if (a.includes('outofstock') || a.includes('out_of_stock') || a.includes('rupture') || 
      a.includes('unavailable') || a.includes('épuisé') || a.includes('indisponible')) {
    return 'out_of_stock';
  }
  
  // Preorder
  if (a.includes('preorder') || a.includes('précommande') || a.includes('pre-order')) {
    return 'preorder';
  }
  
  return 'unknown';
}

/**
 * Normalise les images en tableau d'objets { url } sans doublons
 * Préfère les grandes images (-grande.) aux moyennes (-moyenne.)
 * @param {Object|Array|string} images - Images source (objet avec thumbnail/main/all, tableau, ou string)
 * @returns {Array<{url: string}>} Tableau d'images normalisées
 */
export function normalizeImages(images) {
  if (!images) return [];
  
  const urls = new Set();
  
  // Collecter toutes les URLs
  if (typeof images === 'string') {
    urls.add(images);
  } else if (Array.isArray(images)) {
    images.forEach(img => {
      if (typeof img === 'string') urls.add(img);
      else if (img?.url) urls.add(img.url);
    });
  } else if (typeof images === 'object') {
    // Format { thumbnail, main, all }
    if (images.thumbnail) urls.add(images.thumbnail);
    if (images.main) urls.add(images.main);
    if (Array.isArray(images.all)) {
      images.all.forEach(img => {
        if (typeof img === 'string') urls.add(img);
        else if (img?.url) urls.add(img.url);
      });
    }
  }
  
  // Convertir en tableau et préférer les grandes images
  const urlArray = Array.from(urls);
  
  // Grouper par base d'image (sans -moyenne/-grande)
  const imageGroups = new Map();
  
  urlArray.forEach(url => {
    // Extraire la base de l'URL (sans le suffixe de taille)
    const baseMatch = url.match(/^(.+?)(-(?:moyenne|grande|small|medium|large|thumb))?(\.[^.]+)$/);
    if (baseMatch) {
      const [, base, size, ext] = baseMatch;
      const key = base + ext;
      const priority = (size?.includes('grande') || size?.includes('large')) ? 2 : 
                       (size?.includes('moyenne') || size?.includes('medium')) ? 1 : 0;
      
      if (!imageGroups.has(key) || imageGroups.get(key).priority < priority) {
        imageGroups.set(key, { url, priority });
      }
    } else {
      // URL sans pattern reconnu, garder telle quelle
      imageGroups.set(url, { url, priority: 0 });
    }
  });
  
  // Retourner les meilleures images sans doublons
  return Array.from(imageGroups.values()).map(({ url }) => ({ url }));
}

/**
 * Parse une année depuis une chaîne
 * @param {string|number} value - Valeur source
 * @returns {number|null}
 */
function parseYear(value) {
  if (!value) return null;
  if (typeof value === 'number') return value;
  
  const match = String(value).match(/\b(19[5-9]\d|20[0-3]\d)\b/);
  return match ? parseInt(match[1], 10) : null;
}

// ============================================================================
// COLEKA NORMALIZERS
// ============================================================================

/**
 * Normalise un item de recherche Coleka
 * @param {Object} item - Item brut
 * @returns {Object} Item normalisé
 */
export function normalizeColekaSearchItem(item) {
  return {
    id: `coleka_${item.id || item.path?.split('/').pop() || 'unknown'}`,
    provider: 'coleka',
    provider_id: item.id || item.path?.split('/').pop() || '',
    type: 'collectible',
    name: item.name || '',
    brand: null,
    series: null,
    category: item.category || null,
    year: null,
    condition: 'unknown',
    availability: 'unknown',
    pricing: null,
    images: {
      thumbnail: item.image || null,
      main: item.image || null
    },
    url: item.url || null
  };
}

/**
 * Normalise une réponse de recherche Coleka
 * @param {Object} response - Réponse brute
 * @returns {Object} Réponse normalisée
 */
export function normalizeColekaSearch(response) {
  if (!response) return { query: '', provider: 'coleka', total_results: 0, results: [] };
  
  return {
    query: response.query || '',
    provider: 'coleka',
    total_results: response.total || response.products?.length || 0,
    results: (response.products || []).map(normalizeColekaSearchItem)
  };
}

/**
 * Normalise un détail d'item Coleka
 * @param {Object} data - Données brutes
 * @returns {Object} Détail normalisé
 */
export function normalizeColekaDetail(data) {
  if (!data) return null;
  
  const providerId = data.id || data.url?.split('/').pop() || 'unknown';
  
  // Extraire les pièces depuis les attributs
  let piecesCount = null;
  if (data.attributes?.pièces) {
    piecesCount = parseInt(data.attributes.pièces, 10) || null;
  }
  
  return {
    id: `coleka_${providerId}`,
    provider: 'coleka',
    provider_id: providerId,
    type: 'collectible',
    name: data.name || '',
    name_original: null,
    name_translated: null,
    
    description: data.description || null,
    description_original: null,
    description_translated: null,
    
    brand: data.brand || null,
    manufacturer: data.brand || null,
    series: data.series || null,
    subseries: data.collection || null,
    category: data.category || null,
    
    reference: data.reference || null,
    barcode: data.barcode || null,
    year: parseYear(data.year),
    
    condition: 'unknown',
    availability: 'unknown',
    
    pricing: null,
    
    attributes: {
      faction: null,
      size: null,
      pieces_count: piecesCount,
      categories: data.attributes?.categories || [],
      custom: { ...data.attributes }
    },
    
    images: normalizeImages(data.images),
    
    url: data.url || null
  };
}

// ============================================================================
// LULU-BERLU NORMALIZERS
// ============================================================================

/**
 * Normalise un item de recherche Lulu-Berlu
 * @param {Object} item - Item brut
 * @returns {Object} Item normalisé
 */
export function normalizeLuluBerluSearchItem(item) {
  return {
    id: `luluberlu_${item.id || 'unknown'}`,
    provider: 'lulu-berlu',
    provider_id: String(item.id || ''),
    type: 'collectible',
    name: item.name || '',
    brand: item.brand || null,
    series: null,
    category: null,
    year: null,
    condition: 'unknown',
    availability: normalizeAvailability(item.availability),
    pricing: item.price ? {
      price: item.price,
      currency: 'EUR'
    } : null,
    images: normalizeImages(item.image),
    url: item.url || null
  };
}

/**
 * Normalise une réponse de recherche Lulu-Berlu
 * @param {Object} response - Réponse brute
 * @returns {Object} Réponse normalisée
 */
export function normalizeLuluBerluSearch(response) {
  if (!response) return { query: '', provider: 'lulu-berlu', total_results: 0, results: [] };
  
  return {
    query: response.query || '',
    provider: 'lulu-berlu',
    total_results: response.total || response.products?.length || 0,
    results: (response.products || []).map(normalizeLuluBerluSearchItem)
  };
}

/**
 * Normalise un détail d'item Lulu-Berlu
 * @param {Object} data - Données brutes
 * @returns {Object} Détail normalisé
 */
export function normalizeLuluBerluDetail(data) {
  if (!data) return null;
  
  const providerId = String(data.id || 'unknown');
  const attrs = data.attributes || {};
  
  // Extraire l'année depuis les attributs si disponible
  const year = attrs.year ? parseInt(attrs.year, 10) : null;
  
  // Mapper la condition depuis les attributs
  const conditionFromAttrs = attrs.condition ? normalizeCondition(attrs.condition) : 'unknown';
  
  return {
    id: `luluberlu_${providerId}`,
    provider: 'lulu-berlu',
    provider_id: providerId,
    type: 'collectible',
    name: data.name || '',
    name_original: null,
    name_translated: null,
    
    description: data.description || null,
    description_original: null,
    description_translated: null,
    
    brand: data.brand || null,
    manufacturer: data.brand || null,
    series: null,
    subseries: null,
    category: attrs.type || null,
    
    reference: data.reference || null,
    barcode: null,
    year: year,
    
    condition: conditionFromAttrs,
    availability: normalizeAvailability(data.availability),
    
    pricing: data.price ? {
      price: data.price,
      currency: 'EUR'
    } : null,
    
    attributes: {
      type: attrs.type || null,
      material: attrs.material || null,
      size: attrs.size || null,
      origin: attrs.origin || null,
      condition_details: attrs.condition || null
    },
    
    images: normalizeImages(data.images),
    
    url: data.url || null
  };
}

// ============================================================================
// TRANSFORMERLAND NORMALIZERS
// ============================================================================

/**
 * Normalise un item de recherche Transformerland
 * @param {Object} item - Item brut
 * @returns {Object} Item normalisé
 */
export function normalizeTransformerlandSearchItem(item) {
  return {
    id: `transformerland_${item.id || 'unknown'}`,
    provider: 'transformerland',
    provider_id: item.id || '',
    type: 'collectible',
    name: item.name || '',
    brand: 'Hasbro', // Transformers = principalement Hasbro
    series: item.series || null,
    category: 'transformers',
    year: null,
    condition: normalizeCondition(item.condition),
    availability: normalizeAvailability(item.availability),
    pricing: item.price ? {
      price: item.price,
      currency: item.currency || 'USD'
    } : null,
    images: {
      thumbnail: item.image || null,
      main: item.image || null
    },
    url: item.url || null
  };
}

/**
 * Normalise une réponse de recherche Transformerland
 * @param {Object} response - Réponse brute
 * @returns {Object} Réponse normalisée
 */
export function normalizeTransformerlandSearch(response) {
  if (!response) return { query: '', provider: 'transformerland', total_results: 0, results: [] };
  
  return {
    query: response.query || '',
    provider: 'transformerland',
    total_results: response.count || response.results?.length || 0,
    results: (response.results || []).map(normalizeTransformerlandSearchItem)
  };
}

/**
 * Normalise un détail d'item Transformerland
 * @param {Object} data - Données brutes
 * @returns {Object} Détail normalisé
 */
export function normalizeTransformerlandDetail(data) {
  if (!data) return null;
  
  const providerId = data.id || 'unknown';
  
  return {
    id: `transformerland_${providerId}`,
    provider: 'transformerland',
    provider_id: providerId,
    type: 'collectible',
    name: data.name || data.nameTranslated || '',
    name_original: data.nameOriginal || null,
    name_translated: data.nameTranslated || null,
    
    description: data.description || data.descriptionTranslated || null,
    description_original: data.descriptionOriginal || null,
    description_translated: data.descriptionTranslated || null,
    
    brand: data.manufacturer || 'Hasbro',
    manufacturer: data.manufacturer || null,
    series: data.series || null,
    subseries: data.subgroup || null,
    category: 'transformers',
    
    reference: data.id || null,
    barcode: null,
    year: parseYear(data.year),
    
    condition: normalizeCondition(data.condition),
    availability: normalizeAvailability(data.availability),
    
    pricing: data.price ? {
      price: data.price,
      currency: data.currency || 'USD'
    } : null,
    
    attributes: {
      faction: data.faction || null,
      size: data.size || null,
      pieces_count: null,
      categories: [],
      custom: data.attributes || {}
    },
    
    images: {
      thumbnail: data.images?.[0] || null,
      main: data.images?.[0] || null,
      all: data.images || []
    },
    
    url: data.url || null
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Helpers
  normalizeCondition,
  normalizeAvailability,
  
  // Coleka
  normalizeColekaSearch,
  normalizeColekaSearchItem,
  normalizeColekaDetail,
  
  // Lulu-Berlu
  normalizeLuluBerluSearch,
  normalizeLuluBerluSearchItem,
  normalizeLuluBerluDetail,
  
  // Transformerland
  normalizeTransformerlandSearch,
  normalizeTransformerlandSearchItem,
  normalizeTransformerlandDetail
};
