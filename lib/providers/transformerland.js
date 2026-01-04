/**
 * lib/providers/transformerland.js - Provider Transformerland
 * 
 * Boutique en ligne spécialisée Transformers
 * Nécessite FlareSolverr pour le scraping
 * 
 * @module providers/transformerland
 */

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
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour recherche: "${term}"`);
      
      await ensureFsrSession();
      const sessionId = getFsrSessionId();
      
      const searchUrl = `${TRANSFORMERLAND_SEARCH_URL}?action=show_names&term=${encodeURIComponent(term)}`;
      log.debug(`URL: ${searchUrl}`);

      const pageSolution = await fsrRequest("request.get", searchUrl, sessionId, {
        waitInSeconds: 3  // Plus de temps pour le chargement JS
      }, 60000);
      
      const html = pageSolution.response || "";
      log.debug(`HTML reçu: ${html.length} caractères`);
      
      // DEBUG: Sauvegarder le HTML complet pour analyse
      const fs = await import('fs');
      fs.writeFileSync('/tmp/transformerland_search.html', html);
      log.info(`HTML complet sauvegardé: ${html.length} caractères`);
      
      const results = [];

      // Parser les résultats de show_parent_g12.php (format tableau)
      // Structure: <tr bgcolor="..."><td>image</td><td>Set Name: ... Series: ... Subgroup: ... Allegiance: ...</td></tr>
      const rowRegex = /<tr\s+bgcolor="[^"]*"[^>]*>[\s\S]*?<a\s+href="\?action=show_parent&(?:amp;)?toyid=(\d+)"[^>]*>[\s\S]*?<img\s+src="([^"]+)"[^>]*>[\s\S]*?Set Name:\s*<a[^>]*>([^<]+)<\/a>[\s\S]*?Series:\s*([^<]+)<br>[\s\S]*?Subgroup:\s*([^<]+)<br>[\s\S]*?Allegiance:\s*([^<]+)<\/td>/gi;
      
      let rowMatch;
      while ((rowMatch = rowRegex.exec(html)) !== null && results.length < maxResults) {
        try {
          const [, toyId, thumbnailPath, rawName, rawSeries, rawSubgroup, rawAllegiance] = rowMatch;
          
          const name = decodeHtmlEntities(rawName.trim());
          const series = decodeHtmlEntities(rawSeries.trim());
          const subgroup = decodeHtmlEntities(rawSubgroup.trim());
          const allegiance = decodeHtmlEntities(rawAllegiance.trim());
          
          // Extraire l'année du subgroup (format "Leaders (1984)" ou "(1984)")
          let year = null;
          const yearMatch = subgroup.match(/\((\d{4})\)/);
          if (yearMatch) {
            year = parseInt(yearMatch[1], 10);
          }
          
          // URL de détail
          const itemUrl = `${TRANSFORMERLAND_BASE_URL}/show_parent_g12.php?action=show_parent&toyid=${toyId}`;
          
          // Image thumbnail -> essayer d'avoir une version plus grande
          let image = thumbnailPath.startsWith('http') ? thumbnailPath : `${TRANSFORMERLAND_BASE_URL}${thumbnailPath}`;
          // Conserver le thumbnail, l'image pleine taille sera récupérée dans les détails
          
          if (toyId && name) {
            results.push({
              id: toyId,
              name: name,
              url: itemUrl,
              image: image,
              price: null, // Pas de prix dans cette vue (c'est un guide, pas une boutique)
              currency: null,
              availability: null,
              series: series,
              subgroup: subgroup,
              allegiance: allegiance,
              year: year,
              condition: null
            });
          }
        } catch (parseErr) {
          log.warn(`Erreur parsing row: ${parseErr.message}`);
        }
      }
      
      log.debug(`Parser tableau: ${results.length} résultats trouvés`)
      
      log.debug(`✅ ${results.length} résultats trouvés`);
      
      const result = {
        query: term,
        count: results.length,
        results: results,
        source: 'transformerland'
      };
      
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
 * @param {string} itemId - toyId numérique (pour show_parent_g12.php) ou URL complète
 * @param {number} retries - Nombre de tentatives
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails de l'item
 */
export async function getTransformerlandItemDetails(itemId, retries = MAX_RETRIES, options = {}) {
  const { lang = 'en', autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  // Construire l'URL - supporte:
  // 1. toyId numérique (ex: "14926") -> show_parent_g12.php?action=show_parent&toyid=14926
  // 2. URL complète (ex: "https://...")
  // 3. Chemin relatif (ex: "/store/item/...")
  let itemUrl;
  const isNumericId = /^\d+$/.test(itemId);
  
  if (isNumericId) {
    // Format guide de collectionneurs avec toyId
    itemUrl = `${TRANSFORMERLAND_BASE_URL}/show_parent_g12.php?action=show_parent&toyid=${itemId}`;
  } else if (itemId.startsWith('http')) {
    itemUrl = itemId;
  } else if (itemId.startsWith('/')) {
    itemUrl = `${TRANSFORMERLAND_BASE_URL}${itemId}`;
  } else {
    // Fallback: supposer toyId
    itemUrl = `${TRANSFORMERLAND_BASE_URL}/show_parent_g12.php?action=show_parent&toyid=${itemId}`;
  }
  
  const cacheKey = `transformerland:item:${itemId}:${shouldTranslate ? 'trad' : 'notrad'}:${destLang || 'none'}`;
  
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
      
      // Debug: sauvegarder le HTML complet pour analyse
      const fs = await import('fs');
      fs.writeFileSync('/tmp/transformerland_detail.html', html);
      log.info(`HTML détail sauvegardé: ${html.length} caractères`);
      
      // Vérifier si Cloudflare challenge non résolu
      if (html.includes("Just a moment") || html.includes("challenge-platform")) {
        log.warn(`Challenge Cloudflare non résolu pour: ${itemId}`);
        throw new Error(`Challenge Cloudflare non résolu: ${itemId}`);
      }
      
      // Vérifier si item non trouvé (page d'erreur spécifique ou page très courte sans contenu)
      if (html.includes("Item not found") || html.includes("Page not found") || 
          (html.length < 3000 && !html.includes('<meta itemprop="sku"'))) {
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
      
      // Détecter si c'est une page de guide (show_parent_g12.php) ou de boutique (/store/)
      const isGuidePage = itemUrl.includes('show_parent_g12.php') || html.includes("Collector's Guide Toy Info");
      
      if (isGuidePage) {
        // === PARSER POUR LES PAGES DU GUIDE DE COLLECTIONNEURS ===
        
        // Extraire le titre depuis la balise title
        // Format: "Leaders Optimus Prime (Transformers, G1, Autobot) | Transformerland.com"
        const titleMatch = html.match(/<title>([^|<]+)/i);
        if (titleMatch) {
          const fullTitle = decodeHtmlEntities(titleMatch[1].trim());
          // Extraire: "Subgroup Name (ToyLine, Series, Allegiance)"
          const titleParts = fullTitle.match(/^(.+?)\s*\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
          if (titleParts) {
            const [, nameWithSubgroup, toyLine, series, allegiance] = titleParts;
            item.name = nameWithSubgroup.trim();
            item.series = series.trim();
            item.faction = allegiance.trim();
            item.attributes.toyLine = toyLine.trim();
          } else {
            item.name = fullTitle;
          }
        }
        
        // Extraire les infos depuis le tableau
        // Series
        const seriesMatch = html.match(/<th[^>]*>Series:<\/th>\s*<td><a[^>]*>([^<]+)<\/a>/i);
        if (seriesMatch) item.series = decodeHtmlEntities(seriesMatch[1].trim());
        
        // Subgroup
        const subgroupMatch = html.match(/<th[^>]*>Subgroup:<\/th>\s*<td><a[^>]*>([^<]+)<\/a>/i);
        if (subgroupMatch) item.subgroup = decodeHtmlEntities(subgroupMatch[1].trim());
        
        // Alliance/Allegiance/Faction
        const allianceMatch = html.match(/<th[^>]*>Alliance:<\/th>\s*<td>([^<]+)<\/td>/i);
        if (allianceMatch) item.faction = decodeHtmlEntities(allianceMatch[1].trim());
        
        // Toy Line
        const toyLineMatch = html.match(/<th[^>]*>Toy Line:<\/th>\s*<td><a[^>]*>([^<]+)<\/a>/i);
        if (toyLineMatch) item.attributes.toyLine = decodeHtmlEntities(toyLineMatch[1].trim());
        
        // Extraire l'image principale depuis og:image
        const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
        if (ogImageMatch) {
          let mainImg = ogImageMatch[1];
          // Convertir thumbnail en haute résolution si possible
          mainImg = mainImg.replace('/thumbnails/', '/reference_images/');
          item.images.push(mainImg);
        }
        
        // Extraire les images des figures du set (reference_images)
        const refImagePattern = /<a\s+href="(\/image\/reference_images\/[^"]+)"/gi;
        let refImgMatch;
        const seenImages = new Set(item.images);
        while ((refImgMatch = refImagePattern.exec(html)) !== null) {
          let imgUrl = `${TRANSFORMERLAND_BASE_URL}${refImgMatch[1]}`;
          if (!seenImages.has(imgUrl)) {
            seenImages.add(imgUrl);
            item.images.push(imgUrl);
          }
        }
        
        // Extraire les scans (instructions, specs)
        const scanPattern = /<a\s+href="(\/image\/archive\/[^"]+\/full\/[^"]+)"/gi;
        let scanMatch;
        while ((scanMatch = scanPattern.exec(html)) !== null) {
          let imgUrl = `${TRANSFORMERLAND_BASE_URL}${scanMatch[1]}`;
          if (!seenImages.has(imgUrl)) {
            seenImages.add(imgUrl);
            item.images.push(imgUrl);
          }
        }
        
        // Extraire l'année depuis les variantes listées
        // Chercher le premier "Year: XXXX" dans le HTML
        const yearMatch = html.match(/Year:\s*(\d{4})/i);
        if (yearMatch) item.year = parseInt(yearMatch[1]);
        
        // Extraire la description depuis meta description
        const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
        if (metaDescMatch) {
          item.description = decodeHtmlEntities(metaDescMatch[1].trim());
        }
        
        // Taille depuis les figures
        const sizeMatch = html.match(/Size:\s*([\d.]+)"\s*\(([\d.]+)cm\)/i);
        if (sizeMatch) {
          item.size = `${sizeMatch[1]}" (${sizeMatch[2]}cm)`;
        }
        
        // Disponibilité - chercher si au moins un "In Stock" existe
        if (html.includes('In Stock')) {
          item.availability = 'in_stock';
        } else if (html.includes('Sold Out')) {
          item.availability = 'out_of_stock';
        }
        
        // Pas de prix pour les pages de guide (ce sont des références, pas des ventes)
        item.price = null;
        
      } else {
        // === PARSER POUR LES PAGES DE LA BOUTIQUE (ancien code) ===
        
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
        // Transformerland est toujours en anglais, on spécifie sourceLang pour éviter la détection heuristique
        if (descriptionOriginal) {
          const result = await translateText(descriptionOriginal, destLang, { enabled: true, sourceLang: 'en' });
          if (result.translated) {
            item.description = result.text;
            descriptionTranslated = result.text;
          }
        }
        if (nameOriginal) {
          const result = await translateText(nameOriginal, destLang, { enabled: true, sourceLang: 'en' });
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
