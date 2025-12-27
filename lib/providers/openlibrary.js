/**
 * lib/providers/openlibrary.js - Provider OpenLibrary
 * 
 * API OpenLibrary pour recherche et détails de livres
 * Gratuit, sans clé API
 * 
 * @module providers/openlibrary
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { translateText, translateGenres, extractLangCode } from '../utils/translator.js';
import {
  OPENLIBRARY_BASE_URL,
  OPENLIBRARY_DEFAULT_MAX,
  OPENLIBRARY_MAX_LIMIT,
  USER_AGENT
} from '../config.js';
import {
  normalizeOpenLibrarySearch,
  normalizeOpenLibraryDetail
} from '../normalizers/book.js';

const log = createLogger('OpenLibrary');

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Vérifie si une chaîne est un ISBN
 */
function isIsbn(query) {
  if (!query) return false;
  const cleaned = String(query).replace(/[-\s]/g, '').toUpperCase();
  if (/^\d{13}$/.test(cleaned)) return true;
  if (/^\d{9}[\dX]$/.test(cleaned)) return true;
  return false;
}

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur OpenLibrary API
 * @param {string} query - Requête de recherche (texte ou ISBN)
 * @param {object} options - Options (lang, maxResults)
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchOpenLibrary(query, options = {}) {
  const {
    lang = null,
    maxResults = OPENLIBRARY_DEFAULT_MAX
  } = options;
  
  const isIsbnQuery = isIsbn(query);
  const searchType = isIsbnQuery ? 'isbn' : 'text';
  const limit = Math.min(Math.max(1, maxResults), OPENLIBRARY_MAX_LIMIT);
  
  const cacheKey = `openlibrary_search_${searchType}_${query}_${lang}_${limit}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit pour: ${query}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Recherche ${searchType}: "${query}" (lang: ${lang || 'any'}, max: ${limit})`);
  metrics.sources.openlibrary.requests++;
  
  try {
    let result;
    
    if (isIsbnQuery) {
      result = await searchOpenLibraryByIsbn(query, lang);
    } else {
      result = await searchOpenLibraryByText(query, lang, limit);
    }
    
    log.debug(`✅ ${result.totalItems || result.count} résultats trouvés`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.openlibrary.errors++;
    throw err;
  }
}

/**
 * Recherche OpenLibrary par ISBN
 */
export async function searchOpenLibraryByIsbn(isbn, lang = null) {
  const cleanedIsbn = isbn.replace(/[-\s]/g, '');
  const url = `${OPENLIBRARY_BASE_URL}/api/books?bibkeys=ISBN:${encodeURIComponent(cleanedIsbn)}&format=json&jscmd=data`;
  
  log.debug(`URL ISBN: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT
    }
  });
  
  if (!response.ok) {
    throw new Error(`Erreur OpenLibrary API: ${response.status}`);
  }
  
  const data = await response.json();
  const key = `ISBN:${cleanedIsbn}`;
  
  if (!data[key]) {
    return {
      query: isbn,
      type: 'isbn',
      totalItems: 0,
      count: 0,
      books: [],
      source: "openlibrary"
    };
  }
  
  const book = data[key];
  const parsedBook = parseOpenLibraryBook(book, cleanedIsbn);
  
  return {
    query: isbn,
    type: 'isbn',
    totalItems: 1,
    count: 1,
    books: [parsedBook],
    source: "openlibrary"
  };
}

/**
 * Recherche OpenLibrary par texte
 */
export async function searchOpenLibraryByText(query, lang = null, limit = OPENLIBRARY_DEFAULT_MAX) {
  let url = `${OPENLIBRARY_BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
  
  if (lang) {
    const langCode = lang.substring(0, 2).toLowerCase();
    const langMap = { 'en': 'eng', 'fr': 'fre', 'es': 'spa', 'de': 'ger', 'it': 'ita', 'pt': 'por' };
    if (langMap[langCode]) {
      url += `&language=${langMap[langCode]}`;
    }
  }
  
  log.debug(`URL texte: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT
    }
  });
  
  if (!response.ok) {
    throw new Error(`Erreur OpenLibrary API: ${response.status}`);
  }
  
  const data = await response.json();
  const docs = data.docs || [];
  const numFound = data.numFound || 0;
  
  const books = docs.map(doc => {
    const title = doc.title || doc.title_suggest || null;
    const authors = doc.author_name || [];
    const editors = doc.publisher || [];
    
    let releaseDate = null;
    if (doc.first_publish_year) {
      releaseDate = String(doc.first_publish_year);
    } else if (doc.publish_year && doc.publish_year.length > 0) {
      releaseDate = String(doc.publish_year[0]);
    }
    
    let isbn = null;
    if (doc.isbn && doc.isbn.length > 0) {
      for (const isb of doc.isbn) {
        const cleaned = isb.replace(/[-\s]/g, '');
        if (cleaned.length === 13) {
          isbn = cleaned;
          break;
        } else if (cleaned.length === 10 && !isbn) {
          isbn = cleaned;
        }
      }
    }
    
    const images = [];
    if (doc.cover_i) {
      images.push(`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`);
      images.push(`https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`);
      images.push(`https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg`);
    } else if (isbn) {
      images.push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`);
      images.push(`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`);
      images.push(`https://covers.openlibrary.org/b/isbn/${isbn}-S.jpg`);
    }
    
    const olKey = doc.key || null;
    const olId = olKey ? olKey.replace('/works/', '') : null;
    const genres = doc.subject ? doc.subject.slice(0, 10) : [];
    const language = doc.language ? doc.language[0] : null;
    
    return {
      id: olId,
      type: "book",
      title: title,
      originalTitle: null,
      authors: authors,
      editors: editors,
      releaseDate: releaseDate,
      genres: genres,
      pages: null,
      serie: null,
      synopsis: null,
      language: language,
      tome: null,
      image: images,
      isbn: isbn,
      price: null,
      url: olId ? `https://openlibrary.org/works/${olId}` : null,
      source: "openlibrary"
    };
  });
  
  return {
    query: query,
    type: 'text',
    totalItems: numFound,
    count: books.length,
    books: books,
    source: "openlibrary"
  };
}

/**
 * Parse un livre OpenLibrary (format bibkeys/data)
 */
export function parseOpenLibraryBook(book, isbn = null) {
  const authors = (book.authors || []).map(a => a.name).filter(Boolean);
  const editors = (book.publishers || []).map(p => p.name).filter(Boolean);
  
  let isbnValue = null;
  if (book.identifiers) {
    if (book.identifiers.isbn_13 && book.identifiers.isbn_13[0]) {
      isbnValue = book.identifiers.isbn_13[0];
    } else if (book.identifiers.isbn_10 && book.identifiers.isbn_10[0]) {
      isbnValue = book.identifiers.isbn_10[0];
    }
  }
  if (!isbnValue && isbn) {
    isbnValue = isbn.replace(/[-\s]/g, '');
  }
  
  const olId = book.identifiers?.openlibrary?.[0] || null;
  
  const images = [];
  if (book.cover) {
    if (book.cover.large) images.push(book.cover.large);
    if (book.cover.medium) images.push(book.cover.medium);
    if (book.cover.small) images.push(book.cover.small);
  }
  
  const genres = (book.subjects || []).map(s => s.name).filter(Boolean).slice(0, 10);
  
  let synopsis = null;
  if (book.excerpts && book.excerpts.length > 0) {
    synopsis = book.excerpts[0].text || null;
  } else if (book.notes) {
    synopsis = typeof book.notes === 'string' ? book.notes : book.notes.value || null;
  }
  
  return {
    id: olId,
    type: "book",
    title: book.title || null,
    originalTitle: null,
    authors: authors,
    editors: editors,
    releaseDate: book.publish_date || null,
    genres: genres,
    pages: book.number_of_pages || null,
    serie: null,
    synopsis: synopsis,
    language: null,
    tome: null,
    image: images,
    isbn: isbnValue,
    price: null,
    url: book.url || (olId ? `https://openlibrary.org/books/${olId}` : null),
    source: "openlibrary"
  };
}

// ============================================================================
// DÉTAILS
// ============================================================================

/**
 * Récupère les détails d'un livre par son ID OpenLibrary
 * @param {string} olId - ID OpenLibrary (ex: OL1234W pour work, OL1234M pour edition)
 * @returns {Promise<object>} - Détails du livre
 */
export async function getOpenLibraryById(olId) {
  const cacheKey = `openlibrary_${olId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit pour: ${olId}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Récupération: ${olId}`);
  metrics.sources.openlibrary.requests++;
  
  try {
    let url;
    const isWork = olId.endsWith('W');
    const isEdition = olId.endsWith('M');
    
    if (isWork) {
      url = `${OPENLIBRARY_BASE_URL}/works/${olId}.json`;
    } else if (isEdition) {
      url = `${OPENLIBRARY_BASE_URL}/books/${olId}.json`;
    } else {
      url = `${OPENLIBRARY_BASE_URL}/works/OL${olId}W.json`;
    }
    
    log.debug(`URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Livre ${olId} non trouvé sur OpenLibrary`);
      }
      throw new Error(`Erreur OpenLibrary API: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Format work
    if (data.type?.key === '/type/work') {
      const images = data.covers ? data.covers.slice(0, 5).map(id => 
        `https://covers.openlibrary.org/b/id/${id}-L.jpg`
      ) : [];
      if (data.covers && data.covers[0]) {
        images.push(`https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg`);
      }
      
      const genres = data.subjects || [];
      const synopsis = typeof data.description === 'string' ? data.description : data.description?.value || null;
      
      // Récupérer les auteurs
      let authors = [];
      if (data.authors && data.authors.length > 0) {
        const authorPromises = data.authors.slice(0, 5).map(async (authorRef) => {
          const authorKey = authorRef.author?.key || authorRef.key;
          if (!authorKey) return null;
          try {
            const authorResp = await fetch(`${OPENLIBRARY_BASE_URL}${authorKey}.json`, {
              headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT }
            });
            if (authorResp.ok) {
              const authorData = await authorResp.json();
              return authorData.name || authorData.personal_name || null;
            }
          } catch (e) {
            log.debug(`Erreur récupération auteur: ${e.message}`);
          }
          return null;
        });
        const authorResults = await Promise.all(authorPromises);
        authors = authorResults.filter(Boolean);
      }
      
      // Récupérer éditions pour ISBN
      let isbn = null;
      let editors = [];
      let pages = null;
      let releaseDate = data.first_publish_date || null;
      let language = null;
      
      try {
        const editionsUrl = `${OPENLIBRARY_BASE_URL}/works/${olId}/editions.json?limit=5`;
        const editionsResp = await fetch(editionsUrl, {
          headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT }
        });
        
        if (editionsResp.ok) {
          const editionsData = await editionsResp.json();
          const editions = editionsData.entries || [];
          
          for (const edition of editions) {
            if (!isbn) {
              isbn = edition.isbn_13?.[0] || edition.isbn_10?.[0] || null;
            }
            if (editors.length === 0 && edition.publishers) {
              editors = edition.publishers;
            }
            if (!pages && edition.number_of_pages) {
              pages = edition.number_of_pages;
            }
            if (!language && edition.languages) {
              language = edition.languages[0]?.key?.replace('/languages/', '') || null;
            }
            if (isbn && editors.length > 0 && pages && language) break;
          }
        }
      } catch (e) {
        log.debug(`Erreur récupération éditions: ${e.message}`);
      }
      
      const result = {
        id: olId,
        type: "work",
        title: data.title || null,
        originalTitle: null,
        authors: authors,
        editors: editors,
        releaseDate: releaseDate,
        genres: genres.slice(0, 15),
        pages: pages,
        serie: null,
        synopsis: synopsis,
        language: language,
        tome: null,
        image: images,
        isbn: isbn,
        price: null,
        url: `https://openlibrary.org/works/${olId}`,
        source: "openlibrary",
        subjectPlaces: data.subject_places || [],
        subjectTimes: data.subject_times || [],
        subjectPeople: data.subject_people || [],
        links: data.links || []
      };
      
      log.debug(`✅ Work récupéré: ${result.title}`);
      setCache(cacheKey, result);
      return result;
    }
    
    // Format edition
    const images = data.covers ? data.covers.slice(0, 3).map(id => 
      `https://covers.openlibrary.org/b/id/${id}-L.jpg`
    ) : [];
    if (data.covers && data.covers[0]) {
      images.push(`https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg`);
    }
    
    const isbn = data.isbn_13?.[0] || data.isbn_10?.[0] || null;
    const synopsis = typeof data.description === 'string' ? data.description : data.description?.value || null;
    const languages = data.languages ? data.languages.map(l => l.key?.replace('/languages/', '')) : [];
    
    // Récupérer auteurs depuis work parent
    let authors = [];
    if (data.works && data.works[0]?.key) {
      try {
        const workResp = await fetch(`${OPENLIBRARY_BASE_URL}${data.works[0].key}.json`, {
          headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT }
        });
        if (workResp.ok) {
          const workData = await workResp.json();
          if (workData.authors && workData.authors.length > 0) {
            const authorPromises = workData.authors.slice(0, 5).map(async (authorRef) => {
              const authorKey = authorRef.author?.key || authorRef.key;
              if (!authorKey) return null;
              try {
                const authorResp = await fetch(`${OPENLIBRARY_BASE_URL}${authorKey}.json`, {
                  headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT }
                });
                if (authorResp.ok) {
                  const authorData = await authorResp.json();
                  return authorData.name || authorData.personal_name || null;
                }
              } catch (e) {}
              return null;
            });
            const authorResults = await Promise.all(authorPromises);
            authors = authorResults.filter(Boolean);
          }
        }
      } catch (e) {
        log.debug(`Erreur récupération work parent: ${e.message}`);
      }
    }
    
    const result = {
      id: olId,
      type: "edition",
      title: data.title || null,
      originalTitle: null,
      authors: authors,
      editors: data.publishers || [],
      releaseDate: data.publish_date || null,
      genres: [],
      pages: data.number_of_pages || null,
      serie: null,
      synopsis: synopsis,
      language: languages[0] || null,
      tome: null,
      image: images,
      isbn: isbn,
      price: null,
      url: `https://openlibrary.org/books/${olId}`,
      source: "openlibrary",
      physicalFormat: data.physical_format || null,
      workKey: data.works?.[0]?.key || null,
      allLanguages: languages
    };
    
    log.debug(`✅ Edition récupérée: ${result.title}`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.openlibrary.errors++;
    throw err;
  }
}

// ============================================================================
// FONCTIONS NORMALISÉES (v3.0)
// ============================================================================

/**
 * Recherche OpenLibrary avec résultats normalisés
 * @param {string} query - Requête de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<Array>} - Résultats normalisés
 */
export async function searchOpenLibraryNormalized(query, options = {}) {
  const result = await searchOpenLibrary(query, options);
  return (result.books || []).map(normalizeOpenLibrarySearch);
}

/**
 * Récupère les détails OpenLibrary normalisés avec traduction optionnelle
 * @param {string} olId - ID OpenLibrary
 * @param {object} options - Options de traduction { lang, autoTrad }
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getOpenLibraryByIdNormalized(olId, options = {}) {
  const { lang = null, autoTrad = false } = options;
  const result = await getOpenLibraryById(olId);
  const normalized = normalizeOpenLibraryDetail(result);
  
  // Appliquer la traduction si demandée
  const shouldTranslate = autoTrad && lang;
  const destLang = lang ? extractLangCode(lang) : null;
  
  if (shouldTranslate && destLang) {
    // Traduire le synopsis
    if (normalized.synopsis) {
      try {
        const synopsisResult = await translateText(normalized.synopsis, destLang, { enabled: true });
        if (synopsisResult.translated) {
          normalized.synopsis = synopsisResult.text;
        }
      } catch (err) {
        log.debug(`Erreur traduction synopsis: ${err.message}`);
      }
    }
    
    // Traduire les genres
    if (normalized.genres && normalized.genres.length > 0) {
      try {
        const genresTranslated = await translateGenres(normalized.genres, destLang, 'book');
        if (genresTranslated && genresTranslated.length > 0) {
          normalized.genres = genresTranslated;
        }
      } catch (err) {
        log.debug(`Erreur traduction genres: ${err.message}`);
      }
    }
  }
  
  return normalized;
}

