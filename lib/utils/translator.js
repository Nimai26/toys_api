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
