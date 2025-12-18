/**
 * lib/normalizers/book.js - Fonctions de normalisation pour le type book
 * 
 * Normalise les données des providers book vers un format harmonisé v3.0
 * 
 * Providers supportés:
 * - OpenLibrary
 * - Google Books
 * - Bedetheque
 * - ComicVine
 * 
 * @module normalizers/book
 */

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Mapping des codes langue ISO 639-2 vers ISO 639-1
 */
const LANG_MAP_639_2_TO_1 = {
  'eng': 'en',
  'fre': 'fr',
  'fra': 'fr',
  'spa': 'es',
  'ger': 'de',
  'deu': 'de',
  'ita': 'it',
  'por': 'pt',
  'jpn': 'ja',
  'chi': 'zh',
  'zho': 'zh',
  'kor': 'ko',
  'rus': 'ru',
  'ara': 'ar',
  'tur': 'tr',
  'pol': 'pl',
  'nld': 'nl',
  'dut': 'nl',
  'lat': 'la',
  'gre': 'el',
  'ell': 'el'
};

/**
 * Mapping des rôles d'auteurs (Bedetheque) vers anglais
 */
const AUTHOR_ROLE_MAP = {
  'Scénario': 'writer',
  'Dessin': 'artist',
  'Couleurs': 'colorist',
  'Encrage': 'inker',
  'Couverture': 'cover',
  'Lettrage': 'letterer',
  'Traduction': 'translator'
};

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Normalise un code langue vers ISO 639-1
 */
export function normalizeLanguageCode(lang) {
  if (!lang) return null;
  
  // Déjà en ISO 639-1 (2 caractères)
  if (lang.length === 2) {
    return lang.toLowerCase();
  }
  
  // ISO 639-2 (3 caractères)
  if (lang.length === 3) {
    return LANG_MAP_639_2_TO_1[lang.toLowerCase()] || lang.substring(0, 2).toLowerCase();
  }
  
  return lang.substring(0, 2).toLowerCase();
}

/**
 * Normalise une date vers format ISO (YYYY-MM-DD)
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  const str = String(dateStr).trim();
  
  // Déjà au format ISO complet
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // Format MM/YYYY (Bedetheque)
  if (/^(\d{2})\/(\d{4})$/.test(str)) {
    const [, month, year] = str.match(/^(\d{2})\/(\d{4})$/);
    return `${year}-${month}-01`;
  }
  
  // Format YYYY-MM
  if (/^\d{4}-\d{2}$/.test(str)) {
    return `${str}-01`;
  }
  
  // Année seule
  if (/^\d{4}$/.test(str)) {
    return `${str}-01-01`;
  }
  
  // Essayer de parser une date complète
  const dateMatch = str.match(/(\d{4})[-/]?(\d{2})?[-/]?(\d{2})?/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    return `${year}-${month || '01'}-${day || '01'}`;
  }
  
  return null;
}

/**
 * Extrait l'année d'une date
 */
export function extractYear(dateStr) {
  if (!dateStr) return null;
  
  const match = String(dateStr).match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Normalise un ISBN
 */
export function normalizeIsbn(isbn) {
  if (!isbn) return { isbn: null, isbn10: null, isbn13: null };
  
  const cleaned = String(isbn).replace(/[-\s]/g, '').toUpperCase();
  
  if (cleaned.length === 13 && /^\d{13}$/.test(cleaned)) {
    return {
      isbn: cleaned,
      isbn13: cleaned,
      isbn10: isbn13to10(cleaned)
    };
  }
  
  if (cleaned.length === 10 && /^\d{9}[\dX]$/.test(cleaned)) {
    return {
      isbn: cleaned,
      isbn10: cleaned,
      isbn13: isbn10to13(cleaned)
    };
  }
  
  return { isbn: cleaned || null, isbn10: null, isbn13: null };
}

/**
 * Convertit ISBN-10 en ISBN-13
 */
export function isbn10to13(isbn10) {
  if (!isbn10) return null;
  const cleaned = String(isbn10).replace(/[-\s]/g, '').toUpperCase();
  if (!/^\d{9}[\dX]$/.test(cleaned)) return null;
  
  const core = '978' + cleaned.substring(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(core[i], 10);
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  const mod = sum % 10;
  const check = (mod === 0) ? 0 : (10 - mod);
  return core + check;
}

/**
 * Convertit ISBN-13 en ISBN-10 (si possible)
 */
export function isbn13to10(isbn13) {
  if (!isbn13) return null;
  const cleaned = String(isbn13).replace(/[-\s]/g, '');
  if (!/^\d{13}$/.test(cleaned)) return null;
  if (!cleaned.startsWith('978')) return null; // Seul 978 peut être converti
  
  const core = cleaned.substring(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += (i + 1) * parseInt(core[i], 10);
  }
  const check = sum % 11;
  const checkChar = check === 10 ? 'X' : String(check);
  return core + checkChar;
}

/**
 * Extrait le nom de série depuis les genres OpenLibrary
 */
export function extractSeriesFromGenres(genres) {
  if (!Array.isArray(genres)) return null;
  
  for (const genre of genres) {
    if (typeof genre === 'string' && genre.toLowerCase().startsWith('series:')) {
      return genre.substring(7).trim();
    }
  }
  return null;
}

/**
 * Nettoie les genres (retire les séries, etc.)
 */
export function cleanGenres(genres) {
  if (!Array.isArray(genres)) return [];
  
  return genres.filter(g => {
    if (typeof g !== 'string') return false;
    // Retire les entrées "series:..."
    if (g.toLowerCase().startsWith('series:')) return false;
    // Retire les entrées trop courtes
    if (g.length < 2) return false;
    return true;
  });
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Crée un résultat de recherche harmonisé
 */
export function createSearchResult({
  source,
  sourceId,
  name,
  name_original = null,
  image = null,
  detailUrl
}) {
  return {
    type: 'book',
    source,
    sourceId: String(sourceId),
    name: name || 'Sans titre',
    name_original: name_original || null,
    image: image || null,
    detailUrl
  };
}

/**
 * Crée un résultat de détail harmonisé
 */
export function createDetailResult({
  source,
  sourceId,
  subtype = null,
  name,
  name_original = null,
  authors = [],
  authorsDetailed = null,
  publisher = null,
  collection = null,
  releaseDate = null,
  releaseDate_original = null,
  year = null,
  series = null,
  synopsis = null,
  synopsis_original = null,
  genres = [],
  genres_original = [],
  language = null,
  physical = {},
  identifiers = {},
  pricing = {},
  images = [],
  urls = {},
  meta = {}
}) {
  return {
    type: 'book',
    subtype,
    source,
    sourceId: String(sourceId),
    
    name: name || 'Sans titre',
    name_original: name_original || null,
    
    authors: authors || [],
    authorsDetailed: authorsDetailed || null,
    
    publisher: publisher || null,
    collection: collection || null,
    
    releaseDate: releaseDate || null,
    releaseDate_original: releaseDate_original || null,
    year: year || null,
    
    series: series || null,
    
    synopsis: synopsis || null,
    synopsis_original: synopsis_original || null,
    
    genres: genres || [],
    genres_original: genres_original || [],
    
    language: language || null,
    
    physical: {
      pages: physical.pages || null,
      format: physical.format || null,
      coverType: physical.coverType || null,
      isOriginalEdition: physical.isOriginalEdition ?? null
    },
    
    identifiers: {
      isbn: identifiers.isbn || null,
      isbn10: identifiers.isbn10 || null,
      isbn13: identifiers.isbn13 || null
    },
    
    pricing: {
      price: pricing.price ?? null,
      currency: pricing.currency || (pricing.price ? 'EUR' : null),
      estimation: pricing.estimation ?? null
    },
    
    images: images || [],
    
    urls: {
      detail: urls.detail || null,
      preview: urls.preview || null,
      info: urls.info || null
    },
    
    meta: {
      subjectPlaces: meta.subjectPlaces || null,
      subjectTimes: meta.subjectTimes || null,
      subjectPeople: meta.subjectPeople || null,
      issueCount: meta.issueCount ?? null,
      status: meta.status || null,
      links: meta.links || null
    }
  };
}

// ============================================================================
// OPENLIBRARY NORMALIZERS
// ============================================================================

/**
 * Normalise un résultat de recherche OpenLibrary
 */
export function normalizeOpenLibrarySearch(item) {
  return createSearchResult({
    source: 'openlibrary',
    sourceId: item.id,
    name: item.title,
    name_original: item.originalTitle,
    image: item.image?.[0] || null,
    detailUrl: `/openlibrary/book/${item.id}`
  });
}

/**
 * Normalise les détails OpenLibrary
 */
export function normalizeOpenLibraryDetail(data) {
  const isbnInfo = normalizeIsbn(data.isbn);
  const seriesName = extractSeriesFromGenres(data.genres);
  const cleanedGenres = cleanGenres(data.genres);
  
  return createDetailResult({
    source: 'openlibrary',
    sourceId: data.id,
    subtype: data.type, // 'work' ou 'edition'
    name: data.title,
    name_original: data.originalTitle,
    authors: data.authors || [],
    publisher: data.editors?.[0] || null,
    releaseDate: normalizeDate(data.releaseDate),
    releaseDate_original: data.releaseDate,
    year: extractYear(data.releaseDate),
    series: seriesName ? { id: null, name: seriesName, position: data.tome } : null,
    synopsis: data.synopsis,
    synopsis_original: data.synopsis,
    genres: cleanedGenres,
    genres_original: data.genres || [],
    language: normalizeLanguageCode(data.language),
    physical: {
      pages: data.pages,
      format: data.physicalFormat || null
    },
    identifiers: isbnInfo,
    images: data.image || [],
    urls: {
      detail: data.url
    },
    meta: {
      subjectPlaces: data.subjectPlaces?.length > 0 ? data.subjectPlaces : null,
      subjectTimes: data.subjectTimes?.length > 0 ? data.subjectTimes : null,
      subjectPeople: data.subjectPeople?.length > 0 ? data.subjectPeople : null,
      links: data.links?.length > 0 ? data.links : null
    }
  });
}

// ============================================================================
// GOOGLE BOOKS NORMALIZERS
// ============================================================================

/**
 * Normalise un résultat de recherche Google Books
 */
export function normalizeGoogleBooksSearch(item) {
  return createSearchResult({
    source: 'google_books',
    sourceId: item.id,
    name: item.title,
    name_original: item.originalTitle,
    image: item.image?.[0] || null,
    detailUrl: `/googlebooks/book/${item.id}`
  });
}

/**
 * Normalise les détails Google Books
 */
export function normalizeGoogleBooksDetail(data) {
  const isbnInfo = normalizeIsbn(data.isbn);
  
  return createDetailResult({
    source: 'google_books',
    sourceId: data.id,
    subtype: null,
    name: data.title,
    name_original: data.originalTitle,
    authors: data.authors || [],
    publisher: data.editors?.[0] || null,
    releaseDate: normalizeDate(data.releaseDate),
    releaseDate_original: data.releaseDate,
    year: extractYear(data.releaseDate),
    synopsis: data.synopsis || data.synopsisTranslated,
    synopsis_original: data.synopsisOriginal || data.synopsis,
    genres: data.genres || data.genresTranslated || [],
    genres_original: data.genresOriginal || data.genres || [],
    language: normalizeLanguageCode(data.language),
    physical: {
      pages: data.pages
    },
    identifiers: isbnInfo,
    images: data.image || [],
    urls: {
      detail: data.infoLink,
      preview: data.previewLink
    }
  });
}

// ============================================================================
// BEDETHEQUE NORMALIZERS
// ============================================================================

/**
 * Normalise un résultat de recherche Bedetheque (albums)
 */
export function normalizeBedethequeSearch(item) {
  return createSearchResult({
    source: 'bedetheque',
    sourceId: item.id,
    name: item.title,
    name_original: null,
    image: item.image?.[0] || null,
    detailUrl: `/bedetheque/album/${item.id}`
  });
}

/**
 * Normalise un résultat de recherche Bedetheque (séries)
 */
export function normalizeBedethequeSerieSearch(item) {
  return createSearchResult({
    source: 'bedetheque',
    sourceId: item.id,
    name: item.name,
    name_original: null,
    image: null,
    detailUrl: `/bedetheque/serie/${item.id}`
  });
}

/**
 * Normalise les auteurs détaillés Bedetheque
 */
function normalizeBedethequeAuthors(authorsDetailed) {
  if (!Array.isArray(authorsDetailed)) return null;
  
  return authorsDetailed.map(a => ({
    id: a.id || null,
    name: a.name,
    role: a.role,
    roleEn: AUTHOR_ROLE_MAP[a.role] || a.role.toLowerCase()
  }));
}

/**
 * Normalise les détails d'un album Bedetheque
 */
export function normalizeBedethequeAlbumDetail(data) {
  const isbnInfo = normalizeIsbn(data.isbn);
  
  return createDetailResult({
    source: 'bedetheque',
    sourceId: data.id,
    subtype: 'album',
    name: data.title,
    name_original: data.originalTitle,
    authors: data.authors || [],
    authorsDetailed: normalizeBedethequeAuthors(data.authorsDetailed),
    publisher: data.editors?.[0] || null,
    collection: data.collection,
    releaseDate: normalizeDate(data.releaseDate),
    releaseDate_original: data.releaseDate,
    year: data.year || extractYear(data.releaseDate),
    series: data.serie ? {
      id: String(data.serie.id),
      name: data.serie.name,
      position: data.tome
    } : null,
    synopsis: data.synopsis,
    synopsis_original: data.synopsis,
    genres: data.genres || [],
    genres_original: data.genres || [],
    language: data.language || 'fr',
    physical: {
      pages: data.pages,
      format: data.format,
      coverType: data.coverType,
      isOriginalEdition: data.isOriginalEdition
    },
    identifiers: isbnInfo,
    pricing: {
      price: data.price,
      currency: 'EUR',
      estimation: data.estimation
    },
    images: data.image || [],
    urls: {
      detail: data.url
    }
  });
}

/**
 * Normalise les détails d'une série Bedetheque
 */
export function normalizeBedethequeSerieDetail(data) {
  return createDetailResult({
    source: 'bedetheque',
    sourceId: data.id,
    subtype: 'serie',
    name: data.title,
    name_original: data.originalTitle,
    authors: data.authors || [],
    synopsis: data.synopsis,
    synopsis_original: data.synopsis,
    genres: data.genres || [],
    genres_original: data.genres || [],
    language: data.language || 'fr',
    images: data.image || [],
    urls: {
      detail: data.url
    },
    meta: {
      issueCount: data.albumCount,
      status: data.status
    }
  });
}

// ============================================================================
// COMICVINE NORMALIZERS
// ============================================================================

/**
 * Normalise un résultat de recherche ComicVine
 */
export function normalizeComicVineSearch(item) {
  const type = item.type || 'volume';
  const detailPath = type === 'issue' ? 'issue' : 'volume';
  
  return createSearchResult({
    source: 'comicvine',
    sourceId: item.id,
    name: item.title,
    name_original: null,
    image: item.image?.[0] || null,
    detailUrl: `/comicvine/${detailPath}/${item.id}`
  });
}

/**
 * Normalise les détails d'un volume ComicVine
 */
export function normalizeComicVineVolumeDetail(data) {
  return createDetailResult({
    source: 'comicvine',
    sourceId: data.id,
    subtype: 'volume',
    name: data.title,
    name_original: data.originalTitle,
    authors: data.authors || [],
    publisher: data.editors?.[0] || null,
    releaseDate: normalizeDate(data.releaseDate),
    releaseDate_original: data.releaseDate,
    year: extractYear(data.releaseDate),
    series: data.serie ? {
      id: String(data.serie.id),
      name: data.serie.name,
      position: null
    } : null,
    synopsis: data.synopsis || data.synopsisTranslated,
    synopsis_original: data.synopsisOriginal || data.synopsis,
    genres: data.genres || [],
    genres_original: data.genres || [],
    language: data.language || 'en',
    images: data.image || [],
    urls: {
      detail: data.url
    },
    meta: {
      issueCount: data.issueCount
    }
  });
}

/**
 * Normalise les détails d'un issue ComicVine
 */
export function normalizeComicVineIssueDetail(data) {
  return createDetailResult({
    source: 'comicvine',
    sourceId: data.id,
    subtype: 'issue',
    name: data.title,
    name_original: data.originalTitle,
    authors: data.authors || [],
    publisher: data.editors?.[0] || null,
    releaseDate: normalizeDate(data.releaseDate),
    releaseDate_original: data.releaseDate,
    year: extractYear(data.releaseDate),
    series: data.serie ? {
      id: String(data.serie.id),
      name: data.serie.name,
      position: data.tome
    } : null,
    synopsis: data.synopsis || data.synopsisTranslated,
    synopsis_original: data.synopsisOriginal || data.synopsis,
    genres: data.genres || [],
    genres_original: data.genres || [],
    language: data.language || 'en',
    images: data.image || [],
    urls: {
      detail: data.url
    }
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Utilitaires
  normalizeLanguageCode,
  normalizeDate,
  extractYear,
  normalizeIsbn,
  isbn10to13,
  isbn13to10,
  extractSeriesFromGenres,
  cleanGenres,
  
  // Factory
  createSearchResult,
  createDetailResult,
  
  // OpenLibrary
  normalizeOpenLibrarySearch,
  normalizeOpenLibraryDetail,
  
  // Google Books
  normalizeGoogleBooksSearch,
  normalizeGoogleBooksDetail,
  
  // Bedetheque
  normalizeBedethequeSearch,
  normalizeBedethequeSerieSearch,
  normalizeBedethequeAlbumDetail,
  normalizeBedethequeSerieDetail,
  
  // ComicVine
  normalizeComicVineSearch,
  normalizeComicVineVolumeDetail,
  normalizeComicVineIssueDetail
};
