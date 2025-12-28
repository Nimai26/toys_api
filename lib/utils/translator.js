/**
 * lib/utils/translator.js - Service de traduction automatique
 * toys_api v2.3.0
 * 
 * Fonction réutilisable pour traduire des champs via auto_trad.
 * Activée uniquement si autoTrad=1 est passé explicitement dans la requête.
 * 
 * Utilise des dictionnaires locaux pour les traductions rapides (fast path)
 * avec fallback sur l'API auto_trad pour les langues non couvertes.
 * 
 * @module utils/translator
 */

import { createLogger } from './logger.js';
import {
  AUTO_TRAD_URL,
  AUTO_TRAD_ENABLED
} from '../config.js';
import {
  MEDIA_GENRES,
  VIDEOGAME_GENRES,
  MUSIC_GENRES,
  BOOK_GENRES,
  BOARDGAME_GENRES,
  TOY_CATEGORIES,
  lookupInDictionary,
  lookupInAllDictionaries
} from './genre-dictionaries.js';

const log = createLogger('Translator');

// ============================================================================
// ALIAS VERS LES DICTIONNAIRES EXTERNES
// ============================================================================

// Export des dictionnaires pour utilisation externe
export {
  MEDIA_GENRES,
  VIDEOGAME_GENRES,
  MUSIC_GENRES,
  BOOK_GENRES,
  BOARDGAME_GENRES,
  TOY_CATEGORIES,
  lookupInDictionary,
  lookupInAllDictionaries
};

// Alias pour rétrocompatibilité
const GENRE_TRANSLATIONS = MEDIA_GENRES;

// Cache pour les traductions de genres via API (évite les appels répétés)
const genreApiCache = new Map();

/**
 * Traduit un genre en utilisant le dictionnaire local
 * @param {string} genre - Genre en anglais
 * @param {string} lang - Code langue cible (fr, de, es, it, pt)
 * @returns {string|null} - Genre traduit ou null si non trouvé dans le dictionnaire
 */
function translateGenreFromDict(genre, lang) {
  if (!genre || !lang || lang === 'en') return genre;
  
  const key = genre.toLowerCase().trim();
  const translations = GENRE_TRANSLATIONS[key];
  
  if (translations && translations[lang]) {
    return translations[lang];
  }
  
  return null; // Non trouvé dans le dictionnaire
}

/**
 * Traduit un genre via l'API auto_trad (fallback)
 * @param {string} genre - Genre en anglais
 * @param {string} lang - Code langue cible
 * @returns {Promise<string>} - Genre traduit ou original si échec
 */
async function translateGenreViaApi(genre, lang) {
  if (!AUTO_TRAD_URL || !AUTO_TRAD_ENABLED) {
    return genre;
  }
  
  // Vérifier le cache API
  const cacheKey = `${genre.toLowerCase()}_${lang}`;
  if (genreApiCache.has(cacheKey)) {
    return genreApiCache.get(cacheKey);
  }
  
  try {
    const response = await fetch(`${AUTO_TRAD_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: genre, dest_lang: lang }),
      signal: AbortSignal.timeout(3000) // Timeout court pour les genres
    });
    
    if (!response.ok) {
      return genre;
    }
    
    const data = await response.json();
    if (data.results && data.results[0] && data.results[0].translated) {
      const translated = data.results[0].translated;
      // Mettre en cache pour les prochaines fois
      genreApiCache.set(cacheKey, translated);
      log.debug(`Genre traduit via API: ${genre} → ${translated} (${lang})`);
      return translated;
    }
    
    return genre;
  } catch (err) {
    log.debug(`Échec traduction genre via API: ${genre} (${err.message})`);
    return genre;
  }
}

/**
 * Traduit un genre avec approche hybride : dictionnaire d'abord, puis API si non trouvé
 * @param {string} genre - Genre à traduire
 * @param {string} lang - Code langue cible
 * @returns {Promise<string>} - Genre traduit
 */
export async function translateGenre(genre, lang) {
  if (!genre || !lang) return genre;
  
  // 1. Essayer le dictionnaire local (rapide)
  const fromDict = translateGenreFromDict(genre, lang);
  if (fromDict !== null) {
    return fromDict;
  }
  
  // 2. Fallback sur l'API auto_trad
  return await translateGenreViaApi(genre, lang);
}

/**
 * Traduit un tableau de genres (approche hybride)
 * @param {string[]} genres - Tableau de genres en anglais
 * @param {string} lang - Code langue cible
 * @param {object} options - Options de traduction
 * @param {string} options.sourceLang - Langue source connue (optionnel)
 * @returns {Promise<{genres: string[], genresOriginal: string[], genresTranslated: boolean}>}
 */
export async function translateGenres(genres, lang, options = {}) {
  const { sourceLang = null } = options;
  
  if (!genres || !genres.length || !lang) {
    return { genres, genresOriginal: undefined, genresTranslated: false };
  }
  
  const targetLang = extractLangCode(lang);
  const sourceLanguage = sourceLang ? extractLangCode(sourceLang) : null;
  
  // Si langue source connue et identique à la cible, pas de traduction
  if (sourceLanguage && sourceLanguage === targetLang) {
    return { genres, genresOriginal: undefined, genresTranslated: false };
  }
  
  // Traduire tous les genres (en parallèle pour les appels API)
  const translatedGenres = await Promise.all(
    genres.map(g => translateGenre(g, targetLang))
  );
  
  const hasTranslations = translatedGenres.some((g, i) => g !== genres[i]);
  
  return {
    genres: translatedGenres,
    genresOriginal: hasTranslations ? genres : undefined,
    genresTranslated: hasTranslations
  };
}

// ============================================================================
// DÉTECTION DE LANGUE
// ============================================================================

/**
 * Détecte si un texte est probablement en anglais (heuristique simple)
 * @param {string} text - Texte à analyser
 * @returns {boolean} - true si probablement en anglais
 */
function isLikelyEnglish(text) {
  if (!text || text.length < 20) return false;
  
  // Mots anglais très courants
  const englishWords = /\b(the|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|can|of|in|to|for|with|on|at|by|from|as|into|through|during|before|after|above|below|between|under|again|further|then|once|here|there|when|where|why|how|all|each|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|just|also|now|and|but|or|if|because|until|while|although|though|whether|either|neither|both|which|what|who|whom|whose|this|that|these|those|it|its|they|their|them|he|she|him|her|his|we|us|our|you|your|i|my|me)\b/gi;
  
  const matches = text.match(englishWords) || [];
  const wordCount = text.split(/\s+/).length;
  const ratio = matches.length / wordCount;
  
  // Si plus de 25% de mots anglais courants, probablement en anglais
  return ratio > 0.25;
}

/**
 * Extrait le code langue court (fr, de, es) depuis un locale complet (fr-FR, de-DE)
 * @param {string} lang - Code langue (ex: "fr-FR", "fr", "de-DE")
 * @returns {string} - Code court (ex: "fr", "de")
 */
export function extractLangCode(lang) {
  if (!lang) return 'en';
  return lang.split('-')[0].toLowerCase();
}

// ============================================================================
// TRADUCTION
// ============================================================================

/**
 * Traduit un texte via le service auto_trad
 * 
 * @param {string} text - Texte à traduire
 * @param {string} destLang - Langue de destination (ex: "fr", "fr-FR", "de", "es")
 * @param {object} options - Options de traduction
 * @param {boolean} options.enabled - Si la traduction est activée (paramètre autoTrad)
 * @param {string} options.fallback - Langue de fallback si échec (défaut: texte original)
 * @param {boolean} options.detectEnglish - Détecte si déjà en anglais pour éviter traduction inutile
 * @returns {Promise<{text: string, translated: boolean, from?: string, to?: string}>}
 */
export async function translateText(text, destLang, options = {}) {
  const {
    enabled = false,
    fallback = null,
    detectEnglish = true,
    sourceLang = null  // Nouvelle option: langue source connue
  } = options;
  
  const result = { text, translated: false };
  
  // Ne traduit QUE si autoTrad=1 est passé explicitement
  if (!text || !enabled || !AUTO_TRAD_ENABLED || !AUTO_TRAD_URL) {
    return result;
  }
  
  const targetLang = extractLangCode(destLang);
  const sourceLanguage = sourceLang ? extractLangCode(sourceLang) : null;
  
  // Si langue source connue et identique à la cible, pas de traduction
  if (sourceLanguage && sourceLanguage === targetLang) {
    return result;
  }
  
  // Si pas de langue source connue, utiliser la détection heuristique
  // mais seulement pour éviter de traduire un texte déjà dans la langue cible
  if (!sourceLanguage && detectEnglish) {
    // Si on veut traduire vers anglais et que le texte semble déjà anglais, skip
    if (targetLang === 'en' && isLikelyEnglish(text)) {
      log.debug(`Texte probablement déjà en anglais, traduction ignorée`);
      return result;
    }
    // Si on veut traduire vers français et que le texte semble déjà français, skip
    if (targetLang === 'fr' && !isLikelyEnglish(text)) {
      log.debug(`Texte probablement déjà en français, traduction ignorée`);
      return result;
    }
  }
  
  try {
    log.debug(`Traduction vers ${targetLang}: "${text.substring(0, 50)}..."`);
    
    // Timeout dynamique : 5s de base + 1s par 500 caractères (max 30s)
    const timeoutMs = Math.min(5000 + Math.floor(text.length / 500) * 1000, 30000);
    
    const response = await fetch(`${AUTO_TRAD_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text, 
        dest_lang: targetLang 
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    
    if (!response.ok) {
      log.warn(`Erreur traduction HTTP ${response.status}`);
      return fallback ? { text: fallback, translated: false } : result;
    }
    
    const data = await response.json();
    
    if (data.results && data.results[0] && data.results[0].translated) {
      const translatedText = data.results[0].translated;
      const detectedLang = data.results[0].detected_lang || 'en';
      
      log.debug(`✅ Traduit de ${detectedLang} vers ${targetLang}`);
      
      return {
        text: translatedText,
        translated: true,
        from: detectedLang,
        to: targetLang
      };
    }
    
    return result;
  } catch (err) {
    if (err.name === 'TimeoutError') {
      log.warn(`Timeout traduction (5s)`);
    } else {
      log.warn(`Service de traduction indisponible: ${err.message}`);
    }
    return fallback ? { text: fallback, translated: false } : result;
  }
}

/**
 * Traduit plusieurs champs d'un objet
 * 
 * @param {object} obj - Objet contenant les champs à traduire
 * @param {string[]} fields - Liste des champs à traduire
 * @param {string} destLang - Langue de destination
 * @param {object} options - Options de traduction
 * @returns {Promise<object>} - Objet avec champs traduits + métadonnées
 */
export async function translateFields(obj, fields, destLang, options = {}) {
  if (!obj || !fields || !fields.length) return obj;
  
  const translations = {};
  
  for (const field of fields) {
    const value = obj[field];
    if (typeof value === 'string' && value.trim()) {
      const result = await translateText(value, destLang, options);
      if (result.translated) {
        obj[field] = result.text;
        translations[field] = {
          from: result.from,
          to: result.to
        };
      }
    }
  }
  
  // Ajouter les métadonnées de traduction si au moins un champ traduit
  if (Object.keys(translations).length > 0) {
    obj._translations = translations;
  }
  
  return obj;
}

/**
 * Helper pour vérifier si autoTrad est activé depuis une requête
 * @param {object} query - req.query de Express
 * @returns {boolean}
 */
export function isAutoTradEnabled(query) {
  return query.autoTrad === '1' || query.autoTrad === 'true' || query.autoTrad === true;
}
// ============================================================================
// FONCTIONS DE TRADUCTION PAR DOMAINE
// ============================================================================

/**
 * Traduit un genre/catégorie avec dictionnaire spécifique au domaine
 * @param {string} term - Terme à traduire
 * @param {string} lang - Code langue cible
 * @param {string} category - Catégorie (media, videogame, music, book, boardgame, toy)
 * @returns {Promise<string>} - Terme traduit
 */
export async function translateByCategory(term, lang, category = 'media') {
  if (!term || !lang || lang === 'en') return term;
  
  // 1. Essayer le dictionnaire spécifique au domaine
  const fromDict = lookupInDictionary(term, lang, category);
  if (fromDict !== null) {
    return fromDict;
  }
  
  // 2. Fallback sur l'API auto_trad
  return await translateGenreViaApi(term, lang);
}

/**
 * Traduit un tableau de termes par catégorie
 * @param {string[]} terms - Termes à traduire
 * @param {string} lang - Code langue cible
 * @param {string} category - Catégorie de dictionnaire
 * @returns {Promise<{terms: string[], termsOriginal: string[], termsTranslated: boolean}>}
 */
export async function translateTermsByCategory(terms, lang, category = 'media') {
  if (!terms || !terms.length || !lang || lang === 'en') {
    return { terms, termsOriginal: undefined, termsTranslated: false };
  }
  
  const translatedTerms = await Promise.all(
    terms.map(t => translateByCategory(t, lang, category))
  );
  
  const hasTranslations = translatedTerms.some((t, i) => t !== terms[i]);
  
  return {
    terms: translatedTerms,
    termsOriginal: hasTranslations ? terms : undefined,
    termsTranslated: hasTranslations
  };
}

// Fonctions spécialisées par domaine (shortcuts)

/**
 * Traduit des genres de jeux vidéo
 */
export async function translateVideoGameGenres(genres, lang) {
  return translateTermsByCategory(genres, lang, 'videogame');
}

/**
 * Traduit des genres musicaux
 */
export async function translateMusicGenres(genres, lang) {
  return translateTermsByCategory(genres, lang, 'music');
}

/**
 * Traduit des genres littéraires
 */
export async function translateBookGenres(genres, lang) {
  return translateTermsByCategory(genres, lang, 'book');
}

/**
 * Traduit des catégories de jeux de société
 */
export async function translateBoardGameCategories(categories, lang) {
  return translateTermsByCategory(categories, lang, 'boardgame');
}

/**
 * Traduit des catégories de jouets
 */
export async function translateToyCategories(categories, lang) {
  return translateTermsByCategory(categories, lang, 'toy');
}

/**
 * Traduit un texte vers l'anglais (pour les recherches dans les APIs anglophones)
 * Utile pour Rebrickable, IMDB, etc. qui indexent en anglais
 * 
 * NOTE: Les articles anglais (The, A, An) sont retirés du début car ils
 * interfèrent avec les recherches sur la plupart des APIs (Rebrickable, etc.)
 * 
 * @param {string} text - Texte à traduire
 * @param {string} [sourceLang] - Langue source (auto-détection si non spécifié)
 * @returns {Promise<{text: string, translated: boolean, originalText?: string}>}
 */
export async function translateToEnglish(text, sourceLang = null) {
  const result = { text, translated: false };
  
  if (!text || !AUTO_TRAD_ENABLED || !AUTO_TRAD_URL) {
    return result;
  }
  
  // Si la langue source est explicitement anglais, ne pas traduire
  if (sourceLang === 'en') {
    return result;
  }
  
  // Ne pas essayer de traduire les numéros de sets (ex: 75192, 75192-1)
  if (/^\d+(-\d+)?$/.test(text.trim())) {
    return result;
  }
  
  try {
    log.debug(`Traduction vers anglais: "${text}" (source: ${sourceLang || 'auto'})`);
    
    const response = await fetch(`${AUTO_TRAD_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text, 
        dest_lang: 'en',
        src_lang: sourceLang || undefined
      }),
      signal: AbortSignal.timeout(3000) // Timeout 3s
    });
    
    if (!response.ok) {
      log.warn(`Erreur traduction vers EN HTTP ${response.status}`);
      return result;
    }
    
    const data = await response.json();
    
    if (data.results && data.results[0] && data.results[0].translated) {
      let translatedText = data.results[0].translated;
      const detectedLang = data.results[0].source_lang || 'unknown';
      
      // Vérifier si le texte a vraiment été traduit (différent de l'original)
      if (translatedText.toLowerCase().trim() !== text.toLowerCase().trim()) {
        // Retirer les articles anglais du début pour optimiser les recherches API
        // "The millennium falcon" → "millennium falcon"
        // "A spaceship" → "spaceship"
        const originalTranslated = translatedText;
        translatedText = translatedText.replace(/^(the|a|an)\s+/i, '').trim();
        
        const articleRemoved = translatedText !== originalTranslated;
        if (articleRemoved) {
          log.debug(`Article retiré: "${originalTranslated}" → "${translatedText}"`);
        }
        
        log.info(`✅ Traduit "${text}" → "${translatedText}" (${detectedLang} → en)`);
        
        return {
          text: translatedText,
          translated: true,
          originalText: text,
          from: detectedLang
        };
      } else {
        log.debug(`Texte inchangé après traduction (probablement déjà en anglais)`);
        return result;
      }
    }
    
    return result;
  } catch (err) {
    if (err.name === 'TimeoutError') {
      log.warn(`Timeout traduction vers EN (3s)`);
    } else {
      log.warn(`Traduction vers EN échouée: ${err.message}`);
    }
    return result;
  }
}

/**
 * Traduit les descriptions des résultats de recherche si autoTrad est activé
 * Fonction utilitaire partagée pour toutes les routes /search
 * 
 * @param {Array} items - Les items à traduire
 * @param {boolean} autoTrad - Si la traduction automatique est activée
 * @param {string} lang - La langue cible (fr, es, de, etc.)
 * @returns {Promise<Array>} - Les items avec descriptions traduites
 */
export async function translateSearchDescriptions(items, autoTrad, lang) {
  // Ne pas traduire si autoTrad désactivé ou langue anglaise demandée
  if (!autoTrad || !lang || lang === 'en') {
    return items;
  }
  
  // Limiter la traduction aux 10 premiers résultats pour éviter les timeouts
  // Les autres gardent leur description originale
  const MAX_TRANSLATIONS = 10;
  const toTranslate = items.slice(0, MAX_TRANSLATIONS);
  const remaining = items.slice(MAX_TRANSLATIONS);
  
  // Traduire en parallèle (5 max c'est raisonnable)
  const translatedBatch = await Promise.all(
    toTranslate.map(async (item) => {
      if (!item.description) return item;
      
      const translated = await translateText(item.description, lang, { enabled: true });
      return {
        ...item,
        description: translated.text,
        descriptionTranslated: translated.translated
      };
    })
  );
  
  // Retourner les traduits + les non-traduits
  return [...translatedBatch, ...remaining];
}