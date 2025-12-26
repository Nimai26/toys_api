/**
 * lib/providers/transformerland.js - Provider Transformerland
 * 
 * Boutique en ligne spécialisée Transformers
 * Nécessite FlareSolverr pour le scraping
 * 
 * @module providers/transformerland
 */

import { getCached, setCache } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { translateText, extractLangCode } from '../utils/translator.js';
import { decodeHtmlEntities } from '../utils/helpers.js';
import {
  TRANSFORMERLAND_BASE_URL,
  TRANSFORMERLAND_SEARCH_URL,
  TRANSFORMERLAND_DEFAULT_MAX,
  MAX_RETRIES
} from '../config.js';
import {
  ensureFsrSession,
  destroyFsrSession,
  fsrRequest,
  getFsrSessionId,
  cleanupFsrSession
} from '../utils/flaresolverr.js';

import {
  normalizeTransformerlandSearch,
  normalizeTransformerlandDetail
} from '../normalizers/collectible.js';

const log = createLogger('Transformerland');

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur Transformerland via scraping
 * @param {string} term - Terme de recherche
 * @param {number} maxResults - Nombre max de résultats
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchTransformerland(term, maxResults = TRANSFORMERLAND_DEFAULT_MAX, retries = MAX_RETRIES) {
  const cacheKey = `transformerland:search:${term}:${maxResults}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour recherche: "${term}"`);
      
      await ensureFsrSession();
      const sessionId = getFsrSessionId();
      
      const searchUrl = `${TRANSFORMERLAND_SEARCH_URL}?term=${encodeURIComponent(term)}`;
      log.debug(`URL: ${searchUrl}`);

      const pageSolution = await fsrRequest("request.get", searchUrl, sessionId, {
        waitInSeconds: 1
      }, 45000);
      
      const html = pageSolution.response || "";
      const results = [];

      // Parser les store-items
      const storeItemRegex = /<div\s+class="store-item"[^>]*>([\s\S]*?)(?=<div\s+class="store-item"|<div\s+class="store-pagination"|$)/gi;
      let itemMatch;
      
      while ((itemMatch = storeItemRegex.exec(html)) !== null && results.length < maxResults) {
        const itemHtml = itemMatch[1];
        
        try {
          const skuMatch = itemHtml.match(/<meta\s+itemprop="sku"\s+content="([^"]+)"/i);
          const sku = skuMatch ? skuMatch[1] : null;
          
          const nameMatch = itemHtml.match(/<meta\s+itemprop="name"\s+content="([^"]+)"/i);
          const name = nameMatch ? decodeHtmlEntities(nameMatch[1]) : null;
          
          let itemUrl = null;
          const urlMatch = itemHtml.match(/<a\s+[^>]*href="([^"]*\/store\/item\/[^"]+)"/i);
          if (urlMatch) {
            itemUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : `${TRANSFORMERLAND_BASE_URL}${urlMatch[1]}`;
          }
          
          let image = null;
          const imgMatch = itemHtml.match(/<img[^>]+src="([^"]*\/image\/inventory\/[^"]+)"/i);
          if (imgMatch) {
            image = imgMatch[1].startsWith('http') ? imgMatch[1] : `${TRANSFORMERLAND_BASE_URL}${imgMatch[1]}`;
            image = image.replace('/thumbnails/', '/hires/');
          }
          
          const priceMatch = itemHtml.match(/<meta\s+itemprop="price"\s+content="([^"]+)"/i);
          const price = priceMatch ? parseFloat(priceMatch[1]) : null;
          
          const currencyMatch = itemHtml.match(/<meta\s+itemprop="priceCurrency"\s+content="([^"]+)"/i);
          const currency = currencyMatch ? currencyMatch[1] : "USD";
          
          const availMatch = itemHtml.match(/<link\s+itemprop="availability"\s+href="([^"]+)"/i);
          let availability = "unknown";
          if (availMatch) {
            availability = availMatch[1].includes("InStock") ? "in_stock" : "out_of_stock";
          }
          
          const subgroupMatch = itemHtml.match(/<div\s+class="desc-subgroup"[^>]*>([^<]+)/i);
          const series = subgroupMatch ? decodeHtmlEntities(subgroupMatch[1].trim()) : null;
          
          const condMatch = itemHtml.match(/<div\s+class="desc-cond"[^>]*>([^<]+)/i);
          const condition = condMatch ? decodeHtmlEntities(condMatch[1].trim()) : null;
          
          if (sku && name) {
            results.push({
              id: sku,
              name: name,
              url: itemUrl,
              image: image,
              price: price,
              currency: currency,
              availability: availability,
              series: series,
              condition: condition
            });
          }
        } catch (parseErr) {
          log.warn(`Erreur parsing item: ${parseErr.message}`);
        }
      }
      
      log.debug(`✅ ${results.length} résultats trouvés`);
      
      const result = {
        query: term,
        count: results.length,
        results: results,
        source: 'transformerland'
      };
      
      setCache(cacheKey, result);
      return result;
      
    } catch (err) {
      lastError = err;
      log.error(`Erreur tentative ${attempt}: ${err.message}`);
      await cleanupFsrSession();
      if (attempt >= retries) break;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  
  throw lastError || new Error("Échec après toutes les tentatives");
}

// ============================================================================
// DÉTAILS ITEM
// ============================================================================

/**
 * Récupère les détails d'un item Transformerland
 * @param {string} itemId - ID (SKU), URL complète ou chemin de l'item
 * @param {number} retries - Nombre de tentatives
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails de l'item
 */
export async function getTransformerlandItemDetails(itemId, retries = MAX_RETRIES, options = {}) {
  const { lang = 'en', autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  // Construire l'URL
  let itemUrl;
  if (itemId.startsWith('http')) {
    itemUrl = itemId;
  } else if (itemId.startsWith('/')) {
    itemUrl = `${TRANSFORMERLAND_BASE_URL}${itemId}`;
  } else {
    // Supposer que c'est un SKU - construire l'URL de l'item
    itemUrl = `${TRANSFORMERLAND_BASE_URL}/store/item/${itemId}`;
  }
  
  const cacheKey = `transformerland:item:${itemId}:${shouldTranslate ? 'trad' : 'notrad'}:${destLang || 'none'}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour item: "${itemId}"`);
      
      await ensureFsrSession();
      const sessionId = getFsrSessionId();
      
      log.debug(`Accès à: ${itemUrl}`);
      const pageSolution = await fsrRequest("request.get", itemUrl, sessionId, {
        waitInSeconds: 2
      }, 45000);
      
      const html = pageSolution.response || "";
      
      if (html.includes("Item not found") || html.includes("404") || html.length < 3000) {
        throw new Error(`Item non trouvé: ${itemId}`);
      }
      
      const item = {
        id: itemId,
        url: itemUrl,
        name: null,
        images: [],
        description: null,
        price: null,
        currency: "USD",
        availability: "unknown",
        condition: null,
        series: null,
        subgroup: null,
        faction: null,
        size: null,
        year: null,
        manufacturer: null,
        attributes: {},
        source: "transformerland"
      };
      
      // Extraire les données Schema.org/Product depuis les meta itemprop
      const skuMatch = html.match(/<meta\s+itemprop="sku"\s+content="([^"]+)"/i);
      if (skuMatch) item.id = skuMatch[1];
      
      const nameMatch = html.match(/<meta\s+itemprop="name"\s+content="([^"]+)"/i);
      if (nameMatch) item.name = decodeHtmlEntities(nameMatch[1]);
      
      const descMatch = html.match(/<meta\s+itemprop="description"\s+content="([^"]+)"/i);
      if (descMatch) item.description = decodeHtmlEntities(descMatch[1]);
      
      const priceMatch = html.match(/<meta\s+itemprop="price"\s+content="([^"]+)"/i);
      if (priceMatch) item.price = parseFloat(priceMatch[1]);
      
      const currencyMatch = html.match(/<meta\s+itemprop="priceCurrency"\s+content="([^"]+)"/i);
      if (currencyMatch) item.currency = currencyMatch[1];
      
      const availMatch = html.match(/<link\s+itemprop="availability"\s+href="([^"]+)"/i);
      if (availMatch) {
        item.availability = availMatch[1].includes("InStock") ? "in_stock" : "out_of_stock";
      }
      
      // Extraire l'image principale
      const mainImgMatch = html.match(/<img[^>]+id="mainphoto"[^>]+src="([^"]+)"/i);
      if (mainImgMatch) {
        let imgUrl = mainImgMatch[1];
        if (!imgUrl.startsWith('http')) {
          imgUrl = `${TRANSFORMERLAND_BASE_URL}${imgUrl}`;
        }
        // Utiliser la version haute résolution
        imgUrl = imgUrl.replace('/thumbnails/', '/hires/');
        item.images.push(imgUrl);
      }
      
      // Extraire les images de la galerie
      const thumbPattern = /<a[^>]*href="([^"]*\/image\/inventory\/[^"]+)"/gi;
      let thumbMatch;
      const seenImages = new Set(item.images);
      while ((thumbMatch = thumbPattern.exec(html)) !== null) {
        let imgUrl = thumbMatch[1];
        if (!imgUrl.startsWith('http')) {
          imgUrl = `${TRANSFORMERLAND_BASE_URL}${imgUrl}`;
        }
        imgUrl = imgUrl.replace('/thumbnails/', '/hires/');
        if (!seenImages.has(imgUrl)) {
          seenImages.add(imgUrl);
          item.images.push(imgUrl);
        }
      }
      
      // Extraire les caractéristiques depuis les div desc-*
      const seriesMatch = html.match(/<div\s+class="desc-group"[^>]*>([^<]+)/i);
      if (seriesMatch) item.series = decodeHtmlEntities(seriesMatch[1].trim());
      
      const subgroupMatch = html.match(/<div\s+class="desc-subgroup"[^>]*>([^<]+)/i);
      if (subgroupMatch) item.subgroup = decodeHtmlEntities(subgroupMatch[1].trim());
      
      const condMatch = html.match(/<div\s+class="desc-cond"[^>]*>([^<]+)/i);
      if (condMatch) item.condition = decodeHtmlEntities(condMatch[1].trim());
      
      const factionMatch = html.match(/<div\s+class="desc-faction"[^>]*>([^<]+)/i);
      if (factionMatch) item.faction = decodeHtmlEntities(factionMatch[1].trim());
      
      const sizeMatch = html.match(/<div\s+class="desc-size"[^>]*>([^<]+)/i);
      if (sizeMatch) item.size = decodeHtmlEntities(sizeMatch[1].trim());
      
      // Extraire l'année depuis la série ou la description
      const yearMatch = (item.series || item.description || "").match(/\b(19[89]\d|20[0-2]\d)\b/);
      if (yearMatch) item.year = parseInt(yearMatch[1]);
      
      // Extraire le fabricant (Hasbro, Takara, etc.)
      const mfgPatterns = [
        /(?:by|from|manufacturer[:\s]+)([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
        /(Hasbro|Takara|Tomy|TakaraTomy|Bandai|FansProject|MMC|DX9|TFC|Unique Toys)/i
      ];
      for (const pattern of mfgPatterns) {
        const mfgMatch = (item.description || html).match(pattern);
        if (mfgMatch) {
          item.manufacturer = mfgMatch[1].trim();
          break;
        }
      }
      
      // Extraire les attributs additionnels depuis les tables
      const tableRowPattern = /<tr[^>]*>\s*<t[dh][^>]*>([^<]+)<\/t[dh]>\s*<t[dh][^>]*>([^<]+)<\/t[dh]>/gi;
      let rowMatch;
      while ((rowMatch = tableRowPattern.exec(html)) !== null) {
        const key = rowMatch[1].replace(/:$/, '').trim().toLowerCase();
        const value = decodeHtmlEntities(rowMatch[2].trim());
        
        if (key && value && !item.attributes[key]) {
          item.attributes[key] = value;
        }
      }
      
      // Fallback: extraire le nom depuis le titre de la page
      if (!item.name) {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
          item.name = decodeHtmlEntities(titleMatch[1].replace(/\s*[-|]\s*Transformerland.*$/i, '').trim());
        }
      }
      
      if (!item.name) {
        throw new Error(`Impossible d'extraire les informations de l'item: ${itemUrl}`);
      }
      
      // Descriptions originales
      const descriptionOriginal = item.description;
      const nameOriginal = item.name;
      
      // Applique la traduction si demandée
      let descriptionTranslated = null;
      let nameTranslated = null;
      
      if (shouldTranslate && destLang) {
        if (descriptionOriginal) {
          const result = await translateText(descriptionOriginal, destLang, { enabled: true });
          if (result.translated) {
            item.description = result.text;
            descriptionTranslated = result.text;
          }
        }
        if (nameOriginal) {
          const result = await translateText(nameOriginal, destLang, { enabled: true });
          if (result.translated) {
            item.name = result.text;
            nameTranslated = result.text;
          }
        }
      }
      
      // Ajouter les champs de traduction
      item.nameOriginal = nameOriginal;
      item.nameTranslated = nameTranslated;
      item.descriptionOriginal = descriptionOriginal;
      item.descriptionTranslated = descriptionTranslated;
      
      log.debug(`✅ Item récupéré: ${item.name}`);
      setCache(cacheKey, item);
      return item;

    } catch (err) {
      lastError = err;
      log.error(`Erreur tentative ${attempt}: ${err.message}`);
      await cleanupFsrSession();
      if (attempt >= retries) break;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  
  throw lastError || new Error("Échec après toutes les tentatives");
}

// ============================================================================
// FONCTIONS NORMALISÉES (v3.0.0)
// ============================================================================

/**
 * Recherche Transformerland avec résultat normalisé v3.0.0
 * @param {string} term - Terme de recherche
 * @param {number} maxResults - Nombre max de résultats
 * @returns {Promise<Object>} Résultat normalisé
 */
export async function searchTransformerlandNormalized(term, maxResults = TRANSFORMERLAND_DEFAULT_MAX) {
  const rawResult = await searchTransformerland(term, maxResults);
  return normalizeTransformerlandSearch(rawResult);
}

/**
 * Détails d'un item Transformerland avec résultat normalisé v3.0.0
 * @param {string} itemId - ID (SKU), URL complète ou chemin de l'item
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<Object>} Détail normalisé
 */
export async function getTransformerlandItemDetailsNormalized(itemId, options = {}) {
  const rawResult = await getTransformerlandItemDetails(itemId, MAX_RETRIES, options);
  return normalizeTransformerlandDetail(rawResult);
}
