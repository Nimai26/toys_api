/**
 * lib/providers/barcode.js - Provider d'identification par code-barres
 * 
 * Gère l'identification de produits via UPC, EAN, ISBN
 * Sources: UPC Item DB, Open Food Facts, BNF, OpenLibrary, Google Books
 * 
 * @module providers/barcode
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { decodeHtmlEntities } from '../utils/helpers.js';
import { searchOpenLibraryByIsbn } from './openlibrary.js';
import {
  searchMusicBrainzByBarcode,
} from './musicbrainz.js';
import {
  searchDiscogsByBarcode
} from './discogs.js';
import { searchJVC } from './jvc.js';
import {
  UPCITEMDB_BASE_URL,
  OPENFOODFACTS_BASE_URL,
  USER_AGENT,
  RAWG_BASE_URL,
  GOOGLE_BOOKS_BASE_URL
} from '../config.js';

const log = createLogger('Barcode');

// ========================================
// Détection du type de code-barres
// ========================================

/**
 * Détecte le type de code-barres
 * @param {string} code - Code-barres
 * @returns {object} - Type et informations
 */
export function detectBarcodeType(code) {
  // Nettoyer le code (retirer espaces et tirets)
  const cleanCode = code.replace(/[-\s]/g, '');
  
  // ISBN-10: 10 chiffres (ou 9 + X)
  if (/^(\d{9}[\dX])$/.test(cleanCode)) {
    return { type: 'ISBN-10', code: cleanCode, category: 'book' };
  }
  
  // ISBN-13: 13 chiffres commençant par 978 ou 979
  if (/^(978|979)\d{10}$/.test(cleanCode)) {
    return { type: 'ISBN-13', code: cleanCode, category: 'book' };
  }
  
  // EAN-13: 13 chiffres
  if (/^\d{13}$/.test(cleanCode)) {
    return { type: 'EAN-13', code: cleanCode, category: 'general' };
  }
  
  // UPC-A: 12 chiffres
  if (/^\d{12}$/.test(cleanCode)) {
    return { type: 'UPC-A', code: cleanCode, category: 'general' };
  }
  
  // EAN-8: 8 chiffres
  if (/^\d{8}$/.test(cleanCode)) {
    return { type: 'EAN-8', code: cleanCode, category: 'general' };
  }
  
  // Code inconnu
  return { type: 'unknown', code: cleanCode, category: 'unknown' };
}

/**
 * Convertit ISBN-10 en ISBN-13
 * @param {string} isbn10 - ISBN-10
 * @returns {string|null} - ISBN-13
 */
export function isbn10ToIsbn13(isbn10) {
  const cleanIsbn = isbn10.replace(/[-\s]/g, '');
  if (cleanIsbn.length !== 10) return null;
  
  const isbn13Base = '978' + cleanIsbn.substring(0, 9);
  
  // Calculer le chiffre de contrôle ISBN-13
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(isbn13Base[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  
  return isbn13Base + checkDigit;
}

// ========================================
// Sources de données
// ========================================

/**
 * Recherche un produit par UPC/EAN sur UPC Item DB
 * @param {string} code - Code UPC ou EAN
 * @returns {Promise<object>} - Informations produit
 */
export async function searchUpcItemDb(code) {
  const url = `${UPCITEMDB_BASE_URL}?upc=${encodeURIComponent(code)}`;
  
  log.debug(` UPC Item DB: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT
    }
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Limite quotidienne UPC Item DB atteinte (100 req/jour)');
    }
    throw new Error(`Erreur UPC Item DB: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.code === 'OK' && data.items && data.items.length > 0) {
    const item = data.items[0];
    return {
      found: true,
      source: 'upcitemdb',
      barcode: code,
      title: item.title || null,
      description: item.description || null,
      brand: item.brand || null,
      category: item.category || null,
      images: item.images || [],
      offers: (item.offers || []).map(o => ({
        merchant: o.merchant,
        price: o.price,
        currency: o.currency || 'USD',
        link: o.link
      })),
      raw: item
    };
  }
  
  return { found: false, source: 'upcitemdb', barcode: code };
}

/**
 * Recherche un produit par UPC/EAN sur Open Food Facts
 * @param {string} code - Code UPC ou EAN
 * @returns {Promise<object>} - Informations produit
 */
export async function searchOpenFoodFacts(code) {
  const url = `${OPENFOODFACTS_BASE_URL}/${encodeURIComponent(code)}.json`;
  
  log.debug(` Open Food Facts: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': `ToysAPI/1.0 - Educational Project`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Erreur Open Food Facts: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.status === 1 && data.product) {
    const p = data.product;
    return {
      found: true,
      source: 'openfoodfacts',
      barcode: code,
      title: p.product_name || p.product_name_fr || null,
      brand: p.brands || null,
      category: p.categories || null,
      image: p.image_url || p.image_front_url || null,
      quantity: p.quantity || null,
      ingredients: p.ingredients_text_fr || p.ingredients_text || null,
      nutriscore: p.nutriscore_grade || null,
      raw: p
    };
  }
  
  return { found: false, source: 'openfoodfacts', barcode: code };
}

/**
 * Recherche un livre sur la BNF par ISBN
 * @param {string} isbn - ISBN
 * @returns {Promise<object>} - Résultat BNF
 */
export async function searchBnfByIsbn(isbn) {
  // API SRU de la BNF
  const cleanIsbn = isbn.replace(/[-\s]/g, '');
  const url = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=bib.isbn%20adj%20%22${encodeURIComponent(cleanIsbn)}%22&recordSchema=dublincore&maximumRecords=1`;
  
  log.debug(` BNF: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/xml',
      'User-Agent': USER_AGENT
    }
  });
  
  if (!response.ok) {
    throw new Error(`Erreur BNF: ${response.status}`);
  }
  
  const xml = await response.text();
  
  // Parser le XML simple (Dublin Core)
  const titleMatch = xml.match(/<dc:title>([^<]+)<\/dc:title>/);
  const creatorMatch = xml.match(/<dc:creator>([^<]+)<\/dc:creator>/g);
  const publisherMatch = xml.match(/<dc:publisher>([^<]+)<\/dc:publisher>/);
  const dateMatch = xml.match(/<dc:date>([^<]+)<\/dc:date>/);
  const descMatch = xml.match(/<dc:description>([^<]+)<\/dc:description>/);
  const subjectMatch = xml.match(/<dc:subject>([^<]+)<\/dc:subject>/g);
  
  if (titleMatch) {
    return {
      found: true,
      source: 'bnf',
      isbn: cleanIsbn,
      title: decodeHtmlEntities(titleMatch[1]),
      authors: creatorMatch ? creatorMatch.map(m => {
        const match = m.match(/<dc:creator>([^<]+)<\/dc:creator>/);
        return match ? decodeHtmlEntities(match[1]) : null;
      }).filter(Boolean) : [],
      publisher: publisherMatch ? decodeHtmlEntities(publisherMatch[1]) : null,
      date: dateMatch ? dateMatch[1] : null,
      description: descMatch ? decodeHtmlEntities(descMatch[1]) : null,
      subjects: subjectMatch ? subjectMatch.map(m => {
        const match = m.match(/<dc:subject>([^<]+)<\/dc:subject>/);
        return match ? decodeHtmlEntities(match[1]) : null;
      }).filter(Boolean) : []
    };
  }
  
  return { found: false, source: 'bnf', isbn: cleanIsbn };
}

// ========================================
// Recherche de livres par ISBN
// ========================================

/**
 * Recherche un livre par ISBN
 * @param {string} isbn - ISBN-10 ou ISBN-13
 * @param {string} googleBooksApiKey - Clé API Google Books (optionnelle)
 * @param {string} lang - Langue préférée (optionnelle)
 * @returns {Promise<object>} - Informations livre
 */
export async function searchBookByIsbn(isbn, googleBooksApiKey = null, lang = null) {
  const results = {
    isbn: isbn,
    found: false,
    sources: [],
    lang: lang
  };
  
  // 1. OpenLibrary (gratuit, priorité)
  try {
    const olResult = await searchOpenLibraryByIsbn(isbn);
    if (olResult.books && olResult.books.length > 0) {
      const book = olResult.books[0];
      results.found = true;
      results.title = book.title;
      results.authors = book.authors;
      results.publisher = book.publisher;
      results.publishedDate = book.publishedDate;
      results.pageCount = book.pageCount;
      results.cover = book.thumbnail || book.cover;
      results.description = book.description;
      results.subjects = book.subjects;
      results.sources.push({
        name: 'openlibrary',
        data: book
      });
    }
  } catch (err) {
    log.error(' OpenLibrary error:', err.message);
  }
  
  // 2. Google Books (si clé fournie)
  if (googleBooksApiKey) {
    try {
      let gbUrl = `${GOOGLE_BOOKS_BASE_URL}/volumes?q=isbn:${isbn}&key=${googleBooksApiKey}`;
      // Ajouter restriction de langue si spécifiée (fr, en, de, etc.)
      if (lang) {
        const langCode = lang.substring(0, 2).toLowerCase();
        gbUrl += `&langRestrict=${langCode}`;
      }
      const gbResponse = await fetch(gbUrl);
      
      if (gbResponse.ok) {
        const gbData = await gbResponse.json();
        if (gbData.items && gbData.items.length > 0) {
          const vol = gbData.items[0].volumeInfo;
          results.found = true;
          if (!results.title) results.title = vol.title;
          if (!results.authors) results.authors = vol.authors;
          if (!results.publisher) results.publisher = vol.publisher;
          if (!results.publishedDate) results.publishedDate = vol.publishedDate;
          if (!results.pageCount) results.pageCount = vol.pageCount;
          if (!results.cover && vol.imageLinks) {
            results.cover = vol.imageLinks.thumbnail || vol.imageLinks.smallThumbnail;
          }
          if (!results.description) results.description = vol.description;
          
          results.sources.push({
            name: 'googlebooks',
            data: {
              id: gbData.items[0].id,
              title: vol.title,
              subtitle: vol.subtitle,
              authors: vol.authors,
              publisher: vol.publisher,
              publishedDate: vol.publishedDate,
              description: vol.description,
              pageCount: vol.pageCount,
              categories: vol.categories,
              averageRating: vol.averageRating,
              ratingsCount: vol.ratingsCount,
              imageLinks: vol.imageLinks,
              language: vol.language,
              previewLink: vol.previewLink,
              infoLink: vol.infoLink
            }
          });
        }
      }
    } catch (err) {
      log.error(' Google Books error:', err.message);
    }
  }
  
  // 3. BNF (Bibliothèque Nationale de France) pour livres français
  try {
    const bnfResult = await searchBnfByIsbn(isbn);
    if (bnfResult.found) {
      results.found = true;
      if (!results.title) results.title = bnfResult.title;
      if (!results.authors) results.authors = bnfResult.authors;
      if (!results.publisher) results.publisher = bnfResult.publisher;
      if (!results.publishedDate) results.publishedDate = bnfResult.date;
      
      results.sources.push({
        name: 'bnf',
        data: bnfResult
      });
    }
  } catch (err) {
    log.error(' BNF error:', err.message);
  }
  
  return results;
}

// ========================================
// Identification de produits spécifiques
// ========================================

/**
 * Tente d'identifier un jeu vidéo à partir des infos produit
 * @param {object} productInfo - Infos du produit (title, category, brand)
 * @param {object} apiKeys - Clés API optionnelles
 * @returns {Promise<object|null>} - Infos jeu vidéo ou null
 */
export async function tryIdentifyVideoGame(productInfo, apiKeys = {}) {
  if (!productInfo.title) return null;
  
  const title = productInfo.title;
  const category = (productInfo.category || '').toLowerCase();
  const brand = (productInfo.brand || '').toLowerCase();
  
  // Mots-clés suggérant un jeu vidéo
  const gameKeywords = ['game', 'jeu', 'video', 'nintendo', 'playstation', 'xbox', 'ps4', 'ps5', 'switch', 'steam', 'pc game', 'console'];
  const isLikelyGame = gameKeywords.some(kw => 
    title.toLowerCase().includes(kw) || category.includes(kw) || brand.includes(kw)
  );
  
  if (!isLikelyGame) return null;
  
  // Extraire le nom du jeu (retirer plateforme, édition, etc.)
  let gameName = title
    .replace(/\b(ps[345]|xbox|switch|nintendo|pc|steam|playstation|edition|day one|collector|goty|game of the year)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  // Essayer RAWG si clé disponible
  if (apiKeys.rawg) {
    try {
      const rawgUrl = `${RAWG_BASE_URL}/games?key=${apiKeys.rawg}&search=${encodeURIComponent(gameName)}&page_size=1`;
      const response = await fetch(rawgUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const game = data.results[0];
          return {
            identified: true,
            source: 'rawg',
            game: {
              id: game.id,
              name: game.name,
              slug: game.slug,
              released: game.released,
              rating: game.rating,
              platforms: game.platforms?.map(p => p.platform.name) || [],
              genres: game.genres?.map(g => g.name) || [],
              background_image: game.background_image
            }
          };
        }
      }
    } catch (err) {
      log.error(' RAWG identification error:', err.message);
    }
  }
  
  // Essayer JVC (scraping) pour les jeux français
  try {
    const jvcResult = await searchJVC(gameName, { max: 1 });
    if (jvcResult.results && jvcResult.results.length > 0) {
      const game = jvcResult.results[0];
      return {
        identified: true,
        source: 'jvc',
        game: {
          id: game.id,
          name: game.title,
          url: game.url,
          platforms: game.platforms || [],
          releaseDate: game.releaseDate,
          image: game.image
        }
      };
    }
  } catch (err) {
    log.error(' JVC identification error:', err.message);
  }
  
  return null;
}

/**
 * Tente d'identifier un album de musique à partir des infos produit
 * @param {object} productInfo - Infos du produit (title, category, brand)
 * @param {string} barcode - Code-barres original
 * @returns {Promise<object|null>} - Infos musique ou null
 */
export async function tryIdentifyMusic(productInfo, barcode) {
  if (!productInfo.title) return null;
  
  const title = productInfo.title.toLowerCase();
  const category = (productInfo.category || '').toLowerCase();
  const brand = (productInfo.brand || '').toLowerCase();
  
  // Mots-clés suggérant un CD/vinyle/musique
  const musicKeywords = [
    'cd', 'vinyl', 'vinyle', 'album', 'lp', 'ep', 'record', 'disque',
    'music', 'musique', 'audio', 'soundtrack', 'ost', 'compilation',
    'sony music', 'universal music', 'warner music', 'emi', 'bmg',
    'atlantic', 'columbia', 'rca', 'decca', 'polydor', 'virgin',
    'parlophone', 'capitol', 'interscope', 'def jam', 'island'
  ];
  
  const isLikelyMusic = musicKeywords.some(kw => 
    title.includes(kw) || category.includes(kw) || brand.includes(kw)
  );
  
  if (!isLikelyMusic) return null;
  
  // Rechercher sur MusicBrainz par code-barres
  try {
    const mbResult = await searchMusicBrainzByBarcode(barcode);
    if (mbResult.found) {
      return {
        identified: true,
        source: 'musicbrainz',
        title: mbResult.title,
        artist: mbResult.artist,
        releaseDate: mbResult.date,
        label: mbResult.label,
        coverUrl: mbResult.coverUrl,
        mbId: mbResult.id,
        releaseGroupId: mbResult.releaseGroupId,
        mbUrl: mbResult.mbUrl,
        sources: ['musicbrainz']
      };
    }
  } catch (err) {
    log.error(' MusicBrainz identification error:', err.message);
  }
  
  return null;
}

/**
 * Recherche directe de musique par code-barres (MusicBrainz + Discogs)
 * @param {string} barcode - Code-barres
 * @param {string} discogsToken - Token Discogs (optionnel)
 * @returns {Promise<object>} - Résultat musique
 */
export async function searchMusicByBarcode(barcode, discogsToken = null) {
  const result = {
    found: false,
    barcode,
    sources: []
  };
  
  // 1. MusicBrainz
  try {
    metrics.sources.musicbrainz = metrics.sources.musicbrainz || { requests: 0, errors: 0 };
    metrics.sources.musicbrainz.requests++;
    const mbResult = await searchMusicBrainzByBarcode(barcode);
    if (mbResult.found) {
      result.found = true;
      result.title = mbResult.title;
      result.artist = mbResult.artist;
      result.releaseDate = mbResult.date;
      result.country = mbResult.country;
      result.label = mbResult.label;
      result.catalogNumber = mbResult.catalogNumber;
      result.coverUrl = mbResult.coverUrl;
      result.mbId = mbResult.id;
      result.releaseGroupId = mbResult.releaseGroupId;
      result.mbUrl = mbResult.mbUrl;
      result.sources.push('musicbrainz');
    }
  } catch (err) {
    log.error(' MusicBrainz error:', err.message);
  }
  
  // 2. Discogs (complément ou fallback)
  try {
    metrics.sources.discogs = metrics.sources.discogs || { requests: 0, errors: 0 };
    metrics.sources.discogs.requests++;
    const discogsResult = await searchDiscogsByBarcode(barcode, discogsToken);
    if (discogsResult.found) {
      result.found = true;
      result.sources.push('discogs');
      
      // Compléter les données manquantes
      if (!result.title) result.title = discogsResult.albumTitle;
      if (!result.artist) result.artist = discogsResult.artist;
      if (!result.coverUrl) result.coverUrl = discogsResult.coverUrl;
      if (!result.releaseDate && discogsResult.year) result.releaseDate = discogsResult.year.toString();
      
      // Données spécifiques Discogs
      result.discogs = {
        id: discogsResult.id,
        format: discogsResult.format,
        label: discogsResult.label,
        genre: discogsResult.genre,
        country: discogsResult.country,
        url: discogsResult.discogsUrl
      };
    }
  } catch (err) {
    log.error(' Discogs error:', err.message);
  }
  
  return result;
}

// ========================================
// Recherche complète par code-barres
// ========================================

/**
 * Recherche complète par code-barres
 * @param {string} code - Code-barres (UPC, EAN, ISBN)
 * @param {object} options - Options (apiKeys, enrichGameData)
 * @returns {Promise<object>} - Résultat complet
 */
export async function searchByBarcode(code, options = {}) {
  const { apiKeys = {}, enrichGameData = true, enrichMusicData = true } = options;
  
  const barcodeInfo = detectBarcodeType(code);
  
  const result = {
    barcode: barcodeInfo.code,
    barcodeType: barcodeInfo.type,
    category: barcodeInfo.category,
    product: null,
    book: null,
    videoGame: null,
    music: null,
    sources: [],
    searchedAt: new Date().toISOString()
  };
  
  // === Traitement ISBN (Livres) ===
  if (barcodeInfo.category === 'book' || barcodeInfo.type === 'ISBN-10' || barcodeInfo.type === 'ISBN-13') {
    let isbn = barcodeInfo.code;
    if (barcodeInfo.type === 'ISBN-10') {
      // Convertir en ISBN-13 pour plus de compatibilité
      const isbn13 = isbn10ToIsbn13(isbn);
      result.isbn10 = isbn;
      result.isbn13 = isbn13;
      isbn = isbn13 || isbn;
    } else {
      result.isbn13 = isbn;
    }
    
    const bookResult = await searchBookByIsbn(isbn, apiKeys.googleBooks);
    
    if (bookResult.found) {
      result.category = 'book';
      result.book = {
        title: bookResult.title,
        authors: bookResult.authors,
        publisher: bookResult.publisher,
        publishedDate: bookResult.publishedDate,
        pageCount: bookResult.pageCount,
        cover: bookResult.cover,
        description: bookResult.description,
        subjects: bookResult.subjects
      };
      result.sources = bookResult.sources.map(s => s.name);
    }
    
    return result;
  }
  
  // === Traitement UPC/EAN (Produits généraux) ===
  
  // 1. UPC Item DB (base généraliste)
  try {
    const upcResult = await searchUpcItemDb(barcodeInfo.code);
    if (upcResult.found) {
      result.product = {
        title: upcResult.title,
        description: upcResult.description,
        brand: upcResult.brand,
        category: upcResult.category,
        images: upcResult.images,
        offers: upcResult.offers
      };
      result.sources.push('upcitemdb');
      
      // Tenter d'identifier comme jeu vidéo
      if (enrichGameData) {
        const gameInfo = await tryIdentifyVideoGame(upcResult, apiKeys);
        if (gameInfo) {
          result.category = 'videogame';
          result.videoGame = gameInfo;
        }
      }
      
      // Tenter d'identifier comme musique (CD, vinyle)
      if (enrichMusicData && !result.videoGame) {
        const musicInfo = await tryIdentifyMusic(upcResult, barcodeInfo.code);
        if (musicInfo) {
          result.category = 'music';
          result.music = musicInfo;
        }
      }
    }
  } catch (err) {
    log.error(' UPC Item DB error:', err.message);
    // Continue avec d'autres sources
  }
  
  // 2. Open Food Facts (pour produits alimentaires)
  if (!result.product) {
    try {
      const offResult = await searchOpenFoodFacts(barcodeInfo.code);
      if (offResult.found) {
        result.product = {
          title: offResult.title,
          brand: offResult.brand,
          category: offResult.category,
          images: offResult.image ? [offResult.image] : [],
          quantity: offResult.quantity,
          nutriscore: offResult.nutriscore
        };
        result.category = 'food';
        result.sources.push('openfoodfacts');
      }
    } catch (err) {
      log.error(' Open Food Facts error:', err.message);
    }
  }
  
  // 3. Fallback Musique: Si rien trouvé, tenter directement sur MusicBrainz/Discogs
  if (!result.product && !result.book && enrichMusicData) {
    try {
      const musicResult = await searchMusicByBarcode(barcodeInfo.code, apiKeys.discogs);
      if (musicResult.found) {
        result.category = 'music';
        result.music = musicResult;
        result.sources.push(...musicResult.sources);
      }
    } catch (err) {
      log.error(' Music fallback error:', err.message);
    }
  }
  
  // Déterminer si produit trouvé
  result.found = !!(result.product || result.book || result.videoGame || result.music);
  
  return result;
}
