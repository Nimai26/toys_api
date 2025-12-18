/**
 * lib/providers/googlebooks.js - Provider Google Books
 * 
 * API Google Books pour recherche et détails de livres
 * Nécessite une clé API Google
 * 
 * @module providers/googlebooks
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { translateText, translateGenres, extractLangCode } from '../utils/translator.js';
import {
  GOOGLE_BOOKS_BASE_URL,
  GOOGLE_BOOKS_DEFAULT_MAX,
  GOOGLE_BOOKS_MAX_LIMIT,
  USER_AGENT
} from '../config.js';
import {
  normalizeGoogleBooksSearch,
  normalizeGoogleBooksDetail
} from '../normalizers/book.js';

const log = createLogger('GoogleBooks');

// ============================================================================
// UTILITAIRES ISBN
// ============================================================================

/**
 * Vérifie si une chaîne est un ISBN (format, pas checksum)
 */
export function isIsbn(query) {
  if (!query) return false;
  const cleaned = String(query).replace(/[-\s]/g, '').toUpperCase();
  if (/^\d{13}$/.test(cleaned)) return true;
  if (/^\d{9}[\dX]$/.test(cleaned)) return true;
  return false;
}

/**
 * Valide un ISBN (checksum)
 */
export function validateIsbn(isbn) {
  if (!isbn) return false;
  const cleaned = String(isbn).replace(/[-\s]/g, '').toUpperCase();
  
  if (/^\d{13}$/.test(cleaned)) {
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      const digit = parseInt(cleaned[i], 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    return sum % 10 === 0;
  }
  
  if (/^\d{9}[\dX]$/.test(cleaned)) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += (i + 1) * parseInt(cleaned[i], 10);
    }
    const check = sum % 11;
    const last = cleaned[9];
    if (check === 10) return last === 'X';
    return parseInt(last, 10) === check;
  }
  
  return false;
}

/**
 * Convertit ISBN-10 en ISBN-13
 */
export function isbn10to13(isbn10) {
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

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur Google Books API
 * @param {string} query - Requête de recherche (texte ou ISBN)
 * @param {string} apiKey - Clé API Google
 * @param {object} options - Options (lang, maxResults)
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchGoogleBooks(query, apiKey, options = {}) {
  const {
    lang = null,
    maxResults = GOOGLE_BOOKS_DEFAULT_MAX
  } = options;
  
  if (!apiKey) {
    throw new Error("Clé API Google Books requise");
  }
  
  const isIsbnQuery = isIsbn(query);
  const searchType = isIsbnQuery ? 'isbn' : 'text';
  const limit = Math.min(Math.max(1, maxResults), GOOGLE_BOOKS_MAX_LIMIT);
  
  const cacheKey = `googlebooks_search_${searchType}_${query}_${lang}_${limit}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit pour: ${query}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Recherche ${searchType}: "${query}" (lang: ${lang || 'any'}, max: ${limit})`);
  metrics.sources.googlebooks.requests++;
  
  try {
    let url = `${GOOGLE_BOOKS_BASE_URL}/volumes?`;
    
    if (isIsbnQuery) {
      const cleanedIsbn = query.replace(/[-\s]/g, '');
      url += `q=isbn:${encodeURIComponent(cleanedIsbn)}`;
    } else {
      url += `q=${encodeURIComponent(query)}`;
    }
    
    url += `&key=${encodeURIComponent(apiKey)}`;
    url += `&maxResults=${limit}`;
    
    if (lang) {
      const langCode = lang.substring(0, 2).toLowerCase();
      url += `&langRestrict=${langCode}`;
    }
    
    log.debug(`URL: ${url.replace(apiKey, '***')}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log.error(`Erreur HTTP ${response.status}: ${errorText}`);
      
      if (response.status === 403) {
        throw new Error("Clé API Google Books invalide ou quota dépassé");
      } else if (response.status === 429) {
        throw new Error("Trop de requêtes - rate limit atteint");
      }
      throw new Error(`Erreur Google Books API: ${response.status}`);
    }
    
    const data = await response.json();
    const items = data.items || [];
    const totalItems = data.totalItems || 0;
    
    const books = items.map(item => {
      const vol = item.volumeInfo || {};
      
      const identifiers = {};
      if (vol.industryIdentifiers) {
        for (const id of vol.industryIdentifiers) {
          if (id.type === 'ISBN_10') identifiers.isbn_10 = id.identifier;
          else if (id.type === 'ISBN_13') identifiers.isbn_13 = id.identifier;
          else if (id.type === 'OTHER') identifiers.other = id.identifier;
        }
      }
      
      let coverUrl = null;
      if (vol.imageLinks) {
        coverUrl = vol.imageLinks.extraLarge || 
                   vol.imageLinks.large || 
                   vol.imageLinks.medium || 
                   vol.imageLinks.small || 
                   vol.imageLinks.thumbnail;
        if (coverUrl) {
          coverUrl = coverUrl.replace(/&edge=curl/g, '')
                            .replace(/zoom=\d+/g, 'zoom=1')
                            .replace('http://', 'https://');
        }
      }
      
      return {
        id: item.id,
        title: vol.title || null,
        originalTitle: null,
        authors: vol.authors || [],
        editors: vol.publisher ? [vol.publisher] : [],
        releaseDate: vol.publishedDate || null,
        genres: vol.categories || [],
        pages: vol.pageCount || null,
        serie: null,
        synopsis: vol.description || null,
        language: vol.language || null,
        tome: null,
        image: coverUrl ? [coverUrl] : [],
        isbn: identifiers.isbn_13 || identifiers.isbn_10 || null,
        price: null,
        previewLink: vol.previewLink || null,
        source: 'google_books'
      };
    });
    
    const result = {
      query: query,
      type: searchType,
      totalItems: totalItems,
      count: books.length,
      books: books,
      source: "google_books"
    };
    
    log.debug(`✅ ${totalItems} résultats trouvés, ${books.length} retournés`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.googlebooks.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS
// ============================================================================

/**
 * Récupère les détails d'un livre par son ID Google Books
 * @param {string} volumeId - ID du volume Google Books
 * @param {string} apiKey - Clé API Google
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails du livre
 */
export async function getGoogleBookById(volumeId, apiKey, options = {}) {
  if (!apiKey) {
    throw new Error("Clé API Google Books requise");
  }
  
  const { lang = null, autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `googlebooks_volume_${volumeId}_${shouldTranslate ? 'trad_' + destLang : 'notrad'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit pour volume: ${volumeId}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Récupération volume: ${volumeId}`);
  metrics.sources.googlebooks.requests++;
  
  try {
    const url = `${GOOGLE_BOOKS_BASE_URL}/volumes/${encodeURIComponent(volumeId)}?key=${encodeURIComponent(apiKey)}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Volume ${volumeId} non trouvé`);
      } else if (response.status === 403) {
        throw new Error("Clé API Google Books invalide ou quota dépassé");
      }
      throw new Error(`Erreur Google Books API: ${response.status}`);
    }
    
    const item = await response.json();
    const vol = item.volumeInfo || {};
    
    const identifiers = {};
    if (vol.industryIdentifiers) {
      for (const id of vol.industryIdentifiers) {
        if (id.type === 'ISBN_10') identifiers.isbn_10 = id.identifier;
        else if (id.type === 'ISBN_13') identifiers.isbn_13 = id.identifier;
        else identifiers[id.type.toLowerCase()] = id.identifier;
      }
    }
    
    const covers = {};
    if (vol.imageLinks) {
      for (const [size, url] of Object.entries(vol.imageLinks)) {
        covers[size] = url.replace('http://', 'https://').replace(/&edge=curl/g, '');
      }
    }
    
    const imageArray = [];
    if (covers.extraLarge) imageArray.push(covers.extraLarge);
    if (covers.large) imageArray.push(covers.large);
    if (covers.medium) imageArray.push(covers.medium);
    if (covers.small) imageArray.push(covers.small);
    if (covers.thumbnail) imageArray.push(covers.thumbnail);
    
    // Synopsis et genres originaux
    const synopsisOriginal = vol.description || null;
    const genresList = vol.categories || [];
    
    // Applique la traduction si demandée
    let finalSynopsis = synopsisOriginal;
    let synopsisTranslated = null;
    let genresTranslated = null;
    
    if (shouldTranslate && destLang) {
      // Traduit le synopsis
      if (synopsisOriginal) {
        const translatedSynopsis = await translateText(synopsisOriginal, destLang);
        if (translatedSynopsis !== synopsisOriginal) {
          finalSynopsis = translatedSynopsis;
          synopsisTranslated = translatedSynopsis;
        }
      }
      
      // Traduit les genres/catégories
      if (genresList.length > 0) {
        genresTranslated = await translateGenres(genresList, destLang, 'book');
      }
    }
    
    const result = {
      id: item.id,
      title: vol.title || null,
      originalTitle: null,
      authors: vol.authors || [],
      editors: vol.publisher ? [vol.publisher] : [],
      releaseDate: vol.publishedDate || null,
      genres: genresTranslated || genresList,
      genresOriginal: genresList,
      genresTranslated: genresTranslated,
      pages: vol.pageCount || null,
      serie: null,
      synopsis: finalSynopsis,
      synopsisOriginal: synopsisOriginal,
      synopsisTranslated: synopsisTranslated,
      language: vol.language || null,
      tome: null,
      image: imageArray,
      isbn: identifiers.isbn_13 || identifiers.isbn_10 || null,
      price: null,
      previewLink: vol.previewLink || null,
      infoLink: vol.infoLink || null,
      source: "google_books"
    };
    
    log.debug(`✅ Volume récupéré: ${result.title}`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.googlebooks.errors++;
    throw err;
  }
}

// ============================================================================
// FONCTIONS NORMALISÉES (v3.0)
// ============================================================================

/**
 * Recherche Google Books avec résultats normalisés
 * @param {string} query - Requête de recherche
 * @param {string} apiKey - Clé API Google
 * @param {object} options - Options de recherche
 * @returns {Promise<Array>} - Résultats normalisés
 */
export async function searchGoogleBooksNormalized(query, apiKey, options = {}) {
  const result = await searchGoogleBooks(query, apiKey, options);
  return (result.books || []).map(normalizeGoogleBooksSearch);
}

/**
 * Récupère les détails Google Books normalisés
 * @param {string} volumeId - ID du volume
 * @param {string} apiKey - Clé API Google
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getGoogleBookByIdNormalized(volumeId, apiKey, options = {}) {
  const result = await getGoogleBookById(volumeId, apiKey, options);
  return normalizeGoogleBooksDetail(result);
}
