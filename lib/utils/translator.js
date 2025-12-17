/**
 * lib/utils/translator.js - Service de traduction automatique
 * toys_api v2.2.0
 * 
 * Fonction réutilisable pour traduire des champs via auto_trad.
 * Activée uniquement si autoTrad=1 est passé explicitement dans la requête.
 * 
 * @module utils/translator
 */

import { createLogger } from './logger.js';
import {
  AUTO_TRAD_URL,
  AUTO_TRAD_ENABLED
} from '../config.js';

const log = createLogger('Translator');

// ============================================================================
// DICTIONNAIRES DE TRADUCTION (genres, types, etc.)
// ============================================================================

/**
 * Dictionnaire de genres IMDB/média en plusieurs langues
 * Clé = genre anglais (lowercase), Valeur = traductions par langue
 */
const GENRE_TRANSLATIONS = {
  // Genres principaux
  action: { fr: 'Action', de: 'Action', es: 'Acción', it: 'Azione', pt: 'Ação' },
  adventure: { fr: 'Aventure', de: 'Abenteuer', es: 'Aventura', it: 'Avventura', pt: 'Aventura' },
  animation: { fr: 'Animation', de: 'Animation', es: 'Animación', it: 'Animazione', pt: 'Animação' },
  biography: { fr: 'Biographie', de: 'Biografie', es: 'Biografía', it: 'Biografia', pt: 'Biografia' },
  comedy: { fr: 'Comédie', de: 'Komödie', es: 'Comedia', it: 'Commedia', pt: 'Comédia' },
  crime: { fr: 'Crime', de: 'Krimi', es: 'Crimen', it: 'Crimine', pt: 'Crime' },
  documentary: { fr: 'Documentaire', de: 'Dokumentation', es: 'Documental', it: 'Documentario', pt: 'Documentário' },
  drama: { fr: 'Drame', de: 'Drama', es: 'Drama', it: 'Dramma', pt: 'Drama' },
  family: { fr: 'Famille', de: 'Familie', es: 'Familia', it: 'Famiglia', pt: 'Família' },
  fantasy: { fr: 'Fantastique', de: 'Fantasy', es: 'Fantasía', it: 'Fantasy', pt: 'Fantasia' },
  'film-noir': { fr: 'Film Noir', de: 'Film Noir', es: 'Cine Negro', it: 'Film Noir', pt: 'Film Noir' },
  history: { fr: 'Histoire', de: 'Geschichte', es: 'Historia', it: 'Storia', pt: 'História' },
  horror: { fr: 'Horreur', de: 'Horror', es: 'Terror', it: 'Horror', pt: 'Terror' },
  music: { fr: 'Musique', de: 'Musik', es: 'Música', it: 'Musica', pt: 'Música' },
  musical: { fr: 'Comédie musicale', de: 'Musical', es: 'Musical', it: 'Musical', pt: 'Musical' },
  mystery: { fr: 'Mystère', de: 'Mystery', es: 'Misterio', it: 'Mistero', pt: 'Mistério' },
  romance: { fr: 'Romance', de: 'Romantik', es: 'Romance', it: 'Romantico', pt: 'Romance' },
  'sci-fi': { fr: 'Science-Fiction', de: 'Sci-Fi', es: 'Ciencia Ficción', it: 'Fantascienza', pt: 'Ficção Científica' },
  'science fiction': { fr: 'Science-Fiction', de: 'Sci-Fi', es: 'Ciencia Ficción', it: 'Fantascienza', pt: 'Ficção Científica' },
  sport: { fr: 'Sport', de: 'Sport', es: 'Deporte', it: 'Sport', pt: 'Esporte' },
  thriller: { fr: 'Thriller', de: 'Thriller', es: 'Suspense', it: 'Thriller', pt: 'Suspense' },
  war: { fr: 'Guerre', de: 'Krieg', es: 'Guerra', it: 'Guerra', pt: 'Guerra' },
  western: { fr: 'Western', de: 'Western', es: 'Western', it: 'Western', pt: 'Faroeste' },
  // Genres supplémentaires
  adult: { fr: 'Adulte', de: 'Erwachsene', es: 'Adulto', it: 'Adulti', pt: 'Adulto' },
  news: { fr: 'Actualités', de: 'Nachrichten', es: 'Noticias', it: 'Notizie', pt: 'Notícias' },
  'reality-tv': { fr: 'Télé-réalité', de: 'Reality-TV', es: 'Reality', it: 'Reality', pt: 'Reality Show' },
  'talk-show': { fr: 'Talk-show', de: 'Talkshow', es: 'Talk Show', it: 'Talk Show', pt: 'Talk Show' },
  'game-show': { fr: 'Jeu télévisé', de: 'Spielshow', es: 'Concurso', it: 'Game Show', pt: 'Programa de TV' },
  short: { fr: 'Court-métrage', de: 'Kurzfilm', es: 'Cortometraje', it: 'Cortometraggio', pt: 'Curta-metragem' }
};

/**
 * Traduit un genre en utilisant le dictionnaire local
 * @param {string} genre - Genre en anglais
 * @param {string} lang - Code langue cible (fr, de, es, it, pt)
 * @returns {string} - Genre traduit ou original si non trouvé
 */
export function translateGenre(genre, lang) {
  if (!genre || !lang || lang === 'en') return genre;
  
  const key = genre.toLowerCase().trim();
  const translations = GENRE_TRANSLATIONS[key];
  
  if (translations && translations[lang]) {
    return translations[lang];
  }
  
  // Fallback: retourner le genre original avec majuscule
  return genre;
}

/**
 * Traduit un tableau de genres
 * @param {string[]} genres - Tableau de genres en anglais
 * @param {string} lang - Code langue cible
 * @returns {{genres: string[], genresOriginal: string[], genresTranslated: boolean}}
 */
export function translateGenres(genres, lang) {
  if (!genres || !genres.length || !lang || lang === 'en') {
    return { genres, genresOriginal: undefined, genresTranslated: false };
  }
  
  const translatedGenres = genres.map(g => translateGenre(g, lang));
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
    detectEnglish = true
  } = options;
  
  const result = { text, translated: false };
  
  // Ne traduit QUE si autoTrad=1 est passé explicitement
  if (!text || !enabled || !AUTO_TRAD_ENABLED || !AUTO_TRAD_URL) {
    return result;
  }
  
  const targetLang = extractLangCode(destLang);
  
  // Ne pas traduire si anglais demandé
  if (targetLang === 'en') {
    return result;
  }
  
  // Optionnel: détection heuristique si le texte est en anglais
  if (detectEnglish && !isLikelyEnglish(text)) {
    log.debug(`Texte probablement déjà dans une autre langue, traduction ignorée`);
    return result;
  }
  
  try {
    log.debug(`Traduction vers ${targetLang}: "${text.substring(0, 50)}..."`);
    
    const response = await fetch(`${AUTO_TRAD_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text, 
        dest_lang: targetLang 
      }),
      signal: AbortSignal.timeout(5000) // Timeout 5s
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
