/**
 * lib/providers/klickypedia.js - Klickypedia Provider
 * toys_api v2.4.0
 * 
 * Klickypedia est une encyclopédie Playmobil communautaire
 * avec des informations détaillées sur les sets (noms traduits, thèmes, figures, etc.)
 * 
 * Source: https://www.klickypedia.com
 * Langues supportées: fr, es, de (en par défaut)
 */

import { createLogger } from '../utils/logger.js';
import { decodeHtmlEntities } from '../utils/helpers.js';
import {
  KLICKYPEDIA_BASE_URL,
  KLICKYPEDIA_DEFAULT_MAX,
  KLICKYPEDIA_MAX_LIMIT,
  KLICKYPEDIA_DEFAULT_LANG,
  USER_AGENT,
  MAX_RETRIES
} from '../config.js';

const log = createLogger('Klickypedia');

// ========================================
// Configuration
// ========================================

// Mapping des langues vers le paramètre elang
const LANG_MAP = {
  'fr': 'fr',
  'fr-fr': 'fr',
  'es': 'es',
  'es-es': 'es',
  'de': 'de',
  'de-de': 'de',
  'en': 'en',
  'en-us': 'en',
  'en-gb': 'en'
};

// Mapping des drapeaux vers les codes langue
const FLAG_TO_LANG = {
  'flag-france': 'fr',
  'flag-spain': 'es',
  'flag-germany': 'de',
  'flag-greatbritain': 'en'
};

// ========================================
// Fonctions utilitaires
// ========================================

/**
 * Normalise le code langue pour Klickypedia
 */
function normalizeLocale(lang) {
  if (!lang) return KLICKYPEDIA_DEFAULT_LANG;
  const lower = lang.toLowerCase();
  return LANG_MAP[lower] || LANG_MAP[lower.split('-')[0]] || KLICKYPEDIA_DEFAULT_LANG;
}

/**
 * Extrait l'ID du produit depuis l'URL
 * Ex: /sets/71148-asterix-pyramid/ -> 71148
 */
function extractProductId(url) {
  const match = url.match(/\/sets\/(\d+(?:-[a-z]{2,3})?)-/i);
  return match ? match[1] : null;
}

/**
 * Extrait le slug depuis l'URL
 * Ex: /sets/71148-asterix-pyramid/ -> 71148-asterix-pyramid
 */
function extractSlug(url) {
  const match = url.match(/\/sets\/([^\/]+)\/?$/);
  return match ? match[1] : null;
}

/**
 * Délai entre les requêtes (respecter le site)
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// Fonction de recherche
// ========================================

/**
 * Recherche des sets Playmobil sur Klickypedia
 * @param {string} searchTerm - Terme de recherche
 * @param {string} lang - Code langue (fr, es, de, en)
 * @param {number} retries - Nombre de tentatives
 * @param {number} maxResults - Nombre max de résultats
 * @returns {Object} Résultats de recherche
 */
export async function searchKlickypedia(searchTerm, lang = KLICKYPEDIA_DEFAULT_LANG, retries = MAX_RETRIES, maxResults = KLICKYPEDIA_DEFAULT_MAX) {
  const normalizedLang = normalizeLocale(lang);
  const effectiveMax = Math.min(maxResults || KLICKYPEDIA_DEFAULT_MAX, KLICKYPEDIA_MAX_LIMIT);
  
  log.debug(`Recherche Klickypedia: "${searchTerm}" (lang=${normalizedLang}, max=${effectiveMax})`);
  
  const url = `${KLICKYPEDIA_BASE_URL}/?s=${encodeURIComponent(searchTerm)}&elang=${normalizedLang}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': `${normalizedLang},en;q=0.5`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      const products = parseSearchResults(html, effectiveMax);
      
      log.info(`✅ Trouvé ${products.length} sets Klickypedia pour "${searchTerm}"`);
      
      return {
        products,
        total: products.length,
        count: products.length,
        resultFor: searchTerm,
        source: 'klickypedia',
        lang: normalizedLang
      };
      
    } catch (error) {
      log.warn(`Tentative ${attempt}/${retries} échouée: ${error.message}`);
      if (attempt < retries) {
        await delay(1000 * attempt);
      } else {
        log.error(`❌ Échec recherche Klickypedia après ${retries} tentatives`);
        throw error;
      }
    }
  }
}

/**
 * Parse les résultats de recherche HTML
 */
function parseSearchResults(html, maxResults) {
  const products = [];
  
  // Pattern simplifié pour extraire les items de recherche
  // Cherche: <div class="thumb-wrap"><a href="URL" title="TITLE"><img src="THUMB"
  const itemPattern = /<div class="thumb-wrap"><a href="([^"]+)"[^>]*title="([^"]+)"[^>]*><img[^>]+src="([^"]+)"/gi;
  
  let match;
  let position = 0;
  
  while ((match = itemPattern.exec(html)) !== null && products.length < maxResults) {
    const [, url, titleAttr, thumb] = match;
    
    // Ne garder que les URLs de sets
    if (!url.includes('/sets/')) continue;
    
    position++;
    
    const productId = extractProductId(url);
    const slug = extractSlug(url);
    
    if (!productId) continue;
    
    // Extraire le nom et les années depuis le title
    // Format: "71087 - Astérix : Le calendrier de l'Avent pirate"
    const cleanTitle = decodeHtmlEntities(titleAttr);
    const nameParts = cleanTitle.match(/^(\d+(?:-[a-z]{2,3})?)\s*-\s*(.+)$/i);
    const displayName = nameParts ? nameParts[2].trim() : cleanTitle;
    
    // Chercher les années dans le HTML suivant cet item
    const afterMatch = html.substring(match.index, match.index + 1000);
    const yearsMatch = afterMatch.match(/sets-contador[^>]*>.*?(\d{4}).*?(?:(\d{4}))?/i);
    const released = yearsMatch?.[1] ? parseInt(yearsMatch[1]) : null;
    const discontinued = yearsMatch?.[2] ? parseInt(yearsMatch[2]) : null;
    
    products.push({
      id: productId,
      productCode: productId,
      name: displayName,
      fullName: cleanTitle,
      slug,
      url: url.startsWith('http') ? url : `${KLICKYPEDIA_BASE_URL}${url}`,
      thumb: thumb,
      position,
      released,
      discontinued,
      source: 'klickypedia'
    });
  }
  
  return products;
}

// ========================================
// Fonction de détails produit
// ========================================

/**
 * Récupère les détails d'un set Playmobil sur Klickypedia
 * @param {string} productId - ID du produit (ex: 71148)
 * @param {string} lang - Code langue
 * @param {number} retries - Nombre de tentatives
 * @returns {Object} Détails du produit
 */
export async function getKlickypediaProductDetails(productId, lang = KLICKYPEDIA_DEFAULT_LANG, retries = MAX_RETRIES) {
  const normalizedLang = normalizeLocale(lang);
  const cleanId = String(productId).trim();
  
  log.debug(`Récupération détails Klickypedia: ${cleanId} (lang=${normalizedLang})`);
  
  // D'abord, on cherche le produit pour obtenir l'URL exacte
  const searchResults = await searchKlickypedia(cleanId, normalizedLang, retries, 10);
  
  // Trouver le produit exact
  const product = searchResults.products.find(p => 
    p.id === cleanId || 
    p.productCode === cleanId ||
    p.id.startsWith(cleanId)
  );
  
  if (!product) {
    log.warn(`Produit ${cleanId} non trouvé sur Klickypedia`);
    return null;
  }
  
  // Récupérer la page de détails
  const productUrl = `${product.url}?elang=${normalizedLang}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(productUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': `${normalizedLang},en;q=0.5`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      const details = parseProductDetails(html, cleanId, normalizedLang);
      
      // Fusionner avec les données de recherche
      const result = {
        ...product,
        ...details,
        lang: normalizedLang
      };
      
      log.info(`✅ Détails Klickypedia ${cleanId}: ${result.name}`);
      
      return result;
      
    } catch (error) {
      log.warn(`Tentative ${attempt}/${retries} échouée: ${error.message}`);
      if (attempt < retries) {
        await delay(1000 * attempt);
      } else {
        log.error(`❌ Échec récupération détails Klickypedia après ${retries} tentatives`);
        throw error;
      }
    }
  }
}

/**
 * Parse les détails d'un produit depuis le HTML
 */
function parseProductDetails(html, productId, lang) {
  const details = {
    id: productId,
    productCode: productId,
    translations: {},
    theme: null,
    format: null,
    released: null,
    discontinued: null,
    exclusive: null,
    exportMarket: null,
    figureCount: null,
    tags: [],
    images: [],
    description: null
  };
  
  // Extraire le titre principal
  // Pattern: <h1 itemprop="name" class="entry-title">...Playmobil 71148 - pyramide astérix</h1>
  const titleMatch = html.match(/<h1[^>]*class="entry-title"[^>]*>[\s\S]*?Playmobil\s*(\d+(?:-[a-z]{2,3})?)\s*-\s*([^<]+)<\/h1>/i);
  if (titleMatch) {
    details.name = decodeHtmlEntities(titleMatch[2].trim());
  }
  
  // Extraire les traductions depuis la boîte d'info
  // Pattern: <img src="...flag-france.png">...<br> suivi du nom traduit
  const translationPattern = /flag-([a-z]+)\.png"[^>]*>\s*([^<]+)<br>/gi;
  let transMatch;
  while ((transMatch = translationPattern.exec(html)) !== null) {
    const [, flag, translatedName] = transMatch;
    const langCode = FLAG_TO_LANG[`flag-${flag}`];
    if (langCode && translatedName.trim()) {
      details.translations[langCode] = decodeHtmlEntities(translatedName.trim());
    }
  }
  
  // Si on a une traduction pour la langue demandée, l'utiliser comme nom principal
  if (details.translations[lang]) {
    details.name = details.translations[lang];
  }
  
  // Extraire le thème
  const themeMatch = html.match(/<strong>Thème\s*:<\/strong>\s*<a[^>]+>([^<]+)<\/a>/i) ||
                     html.match(/<strong>Theme\s*:<\/strong>\s*<a[^>]+>([^<]+)<\/a>/i);
  if (themeMatch) {
    details.theme = decodeHtmlEntities(themeMatch[1].trim());
  }
  
  // Extraire le format
  const formatMatch = html.match(/<strong>Format\s*:<\/strong>\s*<a[^>]+>([^<]+)<\/a>/i);
  if (formatMatch) {
    details.format = decodeHtmlEntities(formatMatch[1].trim());
  }
  
  // Extraire l'année de sortie
  const releasedMatch = html.match(/<strong>Sortie\s*:<\/strong>\s*<a[^>]+>(\d{4})<\/a>/i) ||
                        html.match(/<strong>Released\s*:<\/strong>\s*<a[^>]+>(\d{4})<\/a>/i);
  if (releasedMatch) {
    details.released = parseInt(releasedMatch[1]);
  }
  
  // Extraire l'année de fin de vie
  const discontinuedMatch = html.match(/<strong>Fin de vie\s*:<\/strong>\s*<a[^>]+>(\d{4})<\/a>/i) ||
                            html.match(/<strong>Discontinued\s*:<\/strong>\s*<a[^>]+>(\d{4})<\/a>/i);
  if (discontinuedMatch) {
    details.discontinued = parseInt(discontinuedMatch[1]);
  }
  
  // Extraire le nombre de figurines
  const figuresMatch = html.match(/<strong>Chiffres\s*:<\/strong>\s*(\d+)/i) ||
                       html.match(/<strong>Figures\s*:<\/strong>\s*(\d+)/i);
  if (figuresMatch) {
    details.figureCount = parseInt(figuresMatch[1]);
  }
  
  // Extraire les tags
  const tagsMatch = html.match(/<div class="settags">([\s\S]*?)<\/div>/i);
  if (tagsMatch) {
    const tagPattern = /<a[^>]+>([^<]+)<\/a>/gi;
    let tagMatch;
    while ((tagMatch = tagPattern.exec(tagsMatch[1])) !== null) {
      details.tags.push(decodeHtmlEntities(tagMatch[1].trim()));
    }
  }
  
  // Extraire l'image principale depuis og:image ou JSON-LD
  const ogImageMatch = html.match(/og:image"\s+content="([^"]+)"/);
  if (ogImageMatch) {
    details.images.push(ogImageMatch[1]);
  }
  
  // Extraire l'image depuis JSON-LD
  const jsonLdMatch = html.match(/"contentUrl":"([^"]+)"/);
  if (jsonLdMatch && !details.images.includes(jsonLdMatch[1])) {
    details.images.push(jsonLdMatch[1]);
  }
  
  // Définir le thumb
  if (details.images.length > 0) {
    details.thumb = details.images[0];
    details.baseImgUrl = details.images[0];
  }
  
  // Construire la description à partir des infos
  const descParts = [];
  if (details.theme) descParts.push(`Thème: ${details.theme}`);
  if (details.format) descParts.push(`Format: ${details.format}`);
  if (details.figureCount) descParts.push(`Figurines: ${details.figureCount}`);
  if (details.released) descParts.push(`Sortie: ${details.released}`);
  if (details.discontinued) descParts.push(`Fin de vie: ${details.discontinued}`);
  if (details.tags.length > 0) descParts.push(`Tags: ${details.tags.join(', ')}`);
  
  if (descParts.length > 0) {
    details.description = descParts.join('\n');
  }
  
  // Format normalisé (similaire à LEGO/Playmobil)
  return {
    id: details.id,
    productCode: details.productCode,
    name: details.name || `Playmobil ${productId}`,
    translations: details.translations,
    description: details.description,
    price: null, // Klickypedia n'a pas les prix
    currency: null,
    availability: {
      status: details.discontinued ? 'discontinued' : 'unknown',
      released: details.released,
      discontinued: details.discontinued
    },
    attributes: {
      figureCount: details.figureCount,
      theme: details.theme,
      format: details.format,
      tags: details.tags
    },
    category: details.theme?.toLowerCase() || null,
    images: details.images,
    thumb: details.thumb,
    baseImgUrl: details.baseImgUrl,
    brand: 'Playmobil',
    source: 'klickypedia'
  };
}

// ========================================
// Exports
// ========================================

export default {
  searchKlickypedia,
  getKlickypediaProductDetails
};
