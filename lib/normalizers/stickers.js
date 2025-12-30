/**
 * lib/normalizers/stickers.js - Normalizers pour type stickers
 * 
 * Transforme les données Paninimania en format normalisé
 * 
 * @module normalizers/stickers
 */

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Mapping des types de stickers spéciaux vers noms normalisés
 */
const SPECIAL_STICKER_TYPE_MAP = {
  // Français → Anglais normalisé
  'brillantes': 'shiny',
  'brillante': 'shiny',
  'hologrammes': 'holographic',
  'hologramme': 'holographic',
  'fluorescentes': 'fluorescent',
  'fluorescente': 'fluorescent',
  'métallisées': 'metallic',
  'métallisée': 'metallic',
  'metallisees': 'metallic',
  'metallisee': 'metallic',
  'pailletées': 'glitter',
  'pailletée': 'glitter',
  'pailletees': 'glitter',
  'pailletee': 'glitter',
  'transparentes': 'transparent',
  'transparente': 'transparent',
  'puzzle': 'puzzle',
  'relief': '3d',
  '3d': '3d',
  'lenticulaires': '3d',
  'lenticulaire': '3d',
  'autocollantes': 'sticker',
  'autocollante': 'sticker',
  'tatouages': 'tattoo',
  'tatouage': 'tattoo',
  'phosphorescentes': 'glow_in_dark',
  'phosphorescente': 'glow_in_dark',
  'dorées': 'gold',
  'dorée': 'gold',
  'dorees': 'gold',
  'doree': 'gold',
  'argentées': 'silver',
  'argentée': 'silver',
  'argentees': 'silver',
  'argentee': 'silver'
};

/**
 * Mapping des mois français vers numéros
 */
const FRENCH_MONTHS = {
  'janvier': '01',
  'février': '02',
  'fevrier': '02',
  'mars': '03',
  'avril': '04',
  'mai': '05',
  'juin': '06',
  'juillet': '07',
  'août': '08',
  'aout': '08',
  'septembre': '09',
  'octobre': '10',
  'novembre': '11',
  'décembre': '12',
  'decembre': '12'
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalise un type de sticker spécial
 * @param {string} type - Type original (français)
 * @returns {string} - Type normalisé
 */
function normalizeSpecialStickerType(type) {
  if (!type) return 'other';
  
  const normalized = type.toLowerCase().trim();
  return SPECIAL_STICKER_TYPE_MAP[normalized] || 'other';
}

/**
 * Parse une date française en format ISO
 * @param {string} dateStr - Date (ex: "janvier 2020", "2020", "15 mars 2019")
 * @returns {string|null} - Date ISO ou null
 */
function parseFrenchDate(dateStr) {
  if (!dateStr) return null;
  
  const str = dateStr.toLowerCase().trim();
  
  // Pattern: "année" seule (ex: "2020")
  const yearOnlyMatch = str.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    return yearOnlyMatch[1];
  }
  
  // Pattern: "mois année" (ex: "janvier 2020")
  const monthYearMatch = str.match(/([a-zéûà]+)\s+(\d{4})/i);
  if (monthYearMatch) {
    const month = FRENCH_MONTHS[monthYearMatch[1].toLowerCase()];
    const year = monthYearMatch[2];
    if (month) {
      return `${year}-${month}`;
    }
    return year;
  }
  
  // Pattern: "jour mois année" (ex: "15 mars 2019")
  const fullDateMatch = str.match(/(\d{1,2})\s+([a-zéûà]+)\s+(\d{4})/i);
  if (fullDateMatch) {
    const day = fullDateMatch[1].padStart(2, '0');
    const month = FRENCH_MONTHS[fullDateMatch[2].toLowerCase()];
    const year = fullDateMatch[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
    return year;
  }
  
  // Extraction année comme fallback
  const anyYearMatch = str.match(/(\d{4})/);
  if (anyYearMatch) {
    return anyYearMatch[1];
  }
  
  return null;
}

/**
 * Extrait l'année d'une date
 * @param {string} dateStr - Date (diverses formats)
 * @returns {number|null} - Année ou null
 */
function extractYear(dateStr) {
  if (!dateStr) return null;
  
  // Si c'est déjà un nombre
  if (typeof dateStr === 'number') return dateStr;
  
  const match = String(dateStr).match(/(\d{4})/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Génère un range lisible depuis les items
 * @param {Array<number>} items - Liste de numéros
 * @returns {string|null} - Range (ex: "1-180")
 */
function generateRange(items) {
  if (!items || items.length === 0) return null;
  
  const sorted = [...items].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  if (min === max) return String(min);
  return `${min}-${max}`;
}

// ============================================================================
// NORMALIZERS PANINIMANIA
// ============================================================================

/**
 * Normalise un résultat de recherche Paninimania
 * @param {object} item - Item brut de recherche
 * @returns {object} - Item normalisé
 */
function normalizePaninimaniaSingleSearchResult(item) {
  const year = extractYear(item.year);
  const releaseDate = item.year ? parseFrenchDate(item.year) : null;
  
  return {
    id: String(item.id),
    source: 'paninimania',
    name: item.title || null,
    url: item.url || null,
    thumbnail: item.thumbnail || item.image || null,
    year: year,
    release_date: releaseDate
  };
}

/**
 * Normalise les résultats de recherche Paninimania
 * @param {object} rawData - Données brutes de searchPaninimania
 * @returns {object} - Données normalisées
 */
export function normalizePaninimiaSearch(rawData) {
  if (!rawData) {
    return {
      source: 'paninimania',
      query: null,
      total: 0,
      results: []
    };
  }
  
  const results = (rawData.results || []).map(item => 
    normalizePaninimaniaSingleSearchResult(item)
  );
  
  return {
    source: 'paninimania',
    query: rawData.query || null,
    total: results.length,
    results
  };
}

/**
 * Normalise les détails d'un album Paninimania
 * @param {object} rawData - Données brutes de getPaninimanialbumDetails
 * @returns {object} - Données normalisées
 */
export function normalizePaninimiaAlbumDetail(rawData) {
  if (!rawData) return null;
  
  // Construire le tableau d'images
  const images = [];
  
  // Image principale
  if (rawData.mainImage) {
    images.push({
      url: rawData.mainImage,
      thumbnail: rawData.mainImage.replace('b.jpg', 's.jpg'),
      caption: null,
      is_main: true
    });
  }
  
  // Images additionnelles
  if (rawData.additionalImages && Array.isArray(rawData.additionalImages)) {
    for (const img of rawData.additionalImages) {
      images.push({
        url: img.url,
        thumbnail: img.url,
        caption: img.caption || null,
        is_main: false
      });
    }
  }
  
  // Normaliser la checklist
  let checklist = null;
  if (rawData.checklist) {
    checklist = {
      total: rawData.checklist.total || 0,
      range: generateRange(rawData.checklist.items) || rawData.checklist.raw,
      items: rawData.checklist.items || []
    };
    
    // Ajouter le total avec spéciales si disponible
    if (rawData.checklist.totalWithSpecials) {
      checklist.totalWithSpecials = rawData.checklist.totalWithSpecials;
    }
  }
  
  // Normaliser les stickers spéciaux
  const specialStickers = [];
  if (rawData.specialStickers && Array.isArray(rawData.specialStickers)) {
    // Nouveau format : tableau d'objets {name, raw, total, list}
    for (const item of rawData.specialStickers) {
      specialStickers.push({
        type: normalizeSpecialStickerType(item.name),
        type_original: item.name,
        total: item.total || 0,
        range: item.raw || generateRange(item.list),
        items: item.list || []
      });
    }
  } else if (rawData.specialStickers && typeof rawData.specialStickers === 'object') {
    // Ancien format : objet {type: {raw, total, items}}
    for (const [typeOriginal, data] of Object.entries(rawData.specialStickers)) {
      specialStickers.push({
        type: normalizeSpecialStickerType(typeOriginal),
        type_original: typeOriginal,
        total: data.total || 0,
        range: generateRange(data.items) || data.raw,
        items: data.items || []
      });
    }
  }
  
  // Parser la date
  const releaseDate = parseFrenchDate(rawData.releaseDate);
  const year = extractYear(rawData.releaseDate);
  
  return {
    id: String(rawData.id),
    source: 'paninimania',
    name: rawData.title || null,
    description: rawData.description || null,
    url: rawData.url || null,
    
    images,
    
    barcode: rawData.barcode || null,
    copyright: rawData.copyright || null,
    
    release_date: releaseDate,
    year: year,
    
    publisher: rawData.editor || null,
    
    categories: rawData.categories || [],
    
    checklist,
    
    special_stickers: specialStickers.length > 0 ? specialStickers : [],
    
    articles: rawData.articles || []
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Helpers exposés pour tests
  normalizeSpecialStickerType,
  parseFrenchDate,
  extractYear,
  generateRange
};
