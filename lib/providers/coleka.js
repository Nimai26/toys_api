/**
 * lib/providers/coleka.js - Provider Coleka
 * 
 * Site de référencement de figurines, LEGO, Funko Pop, etc.
 * Nécessite FlareSolverr pour contourner la protection anti-bot
 * 
 * @module providers/coleka
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import {
  COLEKA_BASE_URL,
  COLEKA_DEFAULT_NBPP,
  MAX_RETRIES
} from '../config.js';
import {
  ensureFsrSession,
  destroyFsrSession,
  fsrRequest,
  solveColekaChallenge,
  getFsrSessionId,
  cleanupFsrSession
} from '../utils/flaresolverr.js';

import {
  normalizeColekaSearch,
  normalizeColekaDetail
} from '../normalizers/collectible.js';

const log = createLogger('Coleka');

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur Coleka via scraping
 * @param {string} searchTerm - Terme de recherche
 * @param {number} nbpp - Nombre de résultats par page
 * @param {string} lang - Langue (fr, en)
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchColeka(searchTerm, nbpp = COLEKA_DEFAULT_NBPP, lang = "fr", retries = MAX_RETRIES) {
  const cacheKey = `coleka:search:${searchTerm}:${nbpp}:${lang}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour recherche: "${searchTerm}"`);
      
      // Créer une nouvelle session FSR
      await cleanupFsrSession();
      await ensureFsrSession();
      
      if (!getFsrSessionId()) {
        throw new Error("Impossible de créer une session FlareSolverr");
      }
      
      // Récupérer l'ID de session FSR
      const sessionId = getFsrSessionId();
      
      // Étape 1: Visiter la page d'accueil
      log.debug("Étape 1: Visite de la page d'accueil...");
      const homeUrl = `${COLEKA_BASE_URL}/${lang}`;
      
      const homeSolution = await fsrRequest("request.get", homeUrl, sessionId, {
        waitInSeconds: 1
      }, 90000);
      
      const homeHtml = homeSolution.response || "";
      
      // Vérifier si on a le challenge
      if (homeHtml.includes("Simple vérification") || homeHtml.includes("Visiter COLEKA") || homeHtml.includes("verifyBtn")) {
        log.debug("Étape 2: Challenge détecté, résolution...");
        const challengeSolved = await solveColekaChallenge(sessionId, lang);
        if (!challengeSolved) {
          throw new Error("Protection anti-bot non contournée");
        }
        await new Promise(r => setTimeout(r, 500));
      }
      
      // Étape 3: Page de recherche
      const searchUrl = `${COLEKA_BASE_URL}/${lang}/search?q=${encodeURIComponent(searchTerm)}&nbpp=${nbpp}`;
      log.debug("Étape 3: Visite de la page de recherche");
      
      const pageSolution = await fsrRequest("request.get", searchUrl, sessionId, {
        waitInSeconds: 3
      }, 120000);
      
      const html = pageSolution.response || "";
      
      if (html.includes("Simple vérification") || html.includes("Visiter COLEKA")) {
        throw new Error("Protection anti-bot non contournée");
      }
      
      const result = {
        query: searchTerm,
        products: [],
        total: 0,
        source: "coleka"
      };
      
      // Parser les résultats - chercher les blocs produits avec images
      // Structure Coleka: les produits sont dans des blocs contenant un lien et une image
      const productBlockPattern = /<a[^>]*href="(\/[a-z]{2}\/[^"]*_i\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
      const allBlocks = [...html.matchAll(productBlockPattern)];
      const seenUrls = new Set();
      
      // Aussi chercher les images dans le HTML global pour les associer
      const imageMap = new Map();
      const imgPattern = /<img[^>]*(?:data-src|src)="([^"]*(?:coleka\.com|cloudfront)[^"]*)"[^>]*>/gi;
      for (const imgMatch of html.matchAll(imgPattern)) {
        const imgUrl = imgMatch[1];
        // Extraire l'ID produit depuis l'URL de l'image si possible
        const idMatch = imgUrl.match(/_i(\d+)|\/(\d+)(?:_|\.)/);
        if (idMatch) {
          const productId = idMatch[1] || idMatch[2];
          if (!imageMap.has(productId)) {
            imageMap.set(productId, imgUrl.startsWith('http') ? imgUrl : 'https:' + imgUrl);
          }
        }
      }
      
      for (const match of allBlocks) {
        const url = match[1];
        const content = match[2];
        
        if (url.includes('/search') || url.includes('/user') || url.includes('/market') ||
            url.includes('/verify') || url.includes('#') ||
            url.match(/^\/[a-z]{2}\/?$/) || url.match(/^\/[a-z]{2}\/[^\/]+\/?$/)) {
          continue;
        }
        
        const segments = url.split('/').filter(s => s.length > 0);
        if (segments.length < 3) continue;
        
        const fullUrl = COLEKA_BASE_URL + url;
        if (seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);
        
        // Extraire l'ID produit depuis l'URL (format: nom_i123456)
        const productIdMatch = url.match(/_i(\d+)$/);
        const productId = productIdMatch ? productIdMatch[1] : null;
        
        // Chercher l'image dans le contenu du lien
        let imageUrl = null;
        const imgInContent = content.match(/<img[^>]*(?:data-src|src)="([^"]+)"[^>]*>/i);
        if (imgInContent) {
          imageUrl = imgInContent[1].startsWith('http') ? imgInContent[1] : 'https:' + imgInContent[1];
        } else if (productId && imageMap.has(productId)) {
          // Fallback: utiliser l'image trouvée globalement avec le même ID
          imageUrl = imageMap.get(productId);
        }
        
        let textContent = content
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (textContent.length > 0 && textContent.length < 200) {
          result.products.push({
            id: segments[segments.length - 1],
            name: textContent,
            url: fullUrl,
            path: url,
            category: segments[1],
            collection: segments.slice(2, -1).join('/'),
            image: imageUrl
          });
        }
      }
      
      result.total = result.products.length;
      log.debug(`✅ Trouvé ${result.total} produits`);
      
      setCache(cacheKey, result);
      return result;

    } catch (err) {
      lastError = err;
      log.warn(`Erreur tentative ${attempt}: ${err.message}`);
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
 * Récupère les détails d'un item Coleka
 * @param {string} itemId - ID, URL ou chemin de l'item (ex: "fr/lego/star-wars/75192-millennium-falcon")
 * @param {string} lang - Langue (fr, en)
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Détails de l'item
 */
export async function getColekaItemDetails(itemId, lang = "fr", retries = MAX_RETRIES) {
  // Construire l'URL
  let itemUrl;
  if (itemId.startsWith('http')) {
    itemUrl = itemId;
  } else if (itemId.startsWith('/')) {
    itemUrl = `${COLEKA_BASE_URL}${itemId}`;
  } else {
    itemUrl = `${COLEKA_BASE_URL}/${lang}/${itemId}`;
  }
  
  const cacheKey = `coleka:item:${itemUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour item: "${itemId}"`);
      
      // Créer une nouvelle session FSR
      await cleanupFsrSession();
      await ensureFsrSession();
      
      const sessionId = getFsrSessionId();
      if (!sessionId) {
        throw new Error("Impossible de créer une session FlareSolverr");
      }
      
      // Visiter d'abord la page d'accueil pour initialiser la session
      const homeUrl = `${COLEKA_BASE_URL}/${lang}`;
      const homeSolution = await fsrRequest("request.get", homeUrl, sessionId, {
        waitInSeconds: 1
      }, 90000);
      
      const homeHtml = homeSolution.response || "";
      
      // Résoudre le challenge si nécessaire
      if (homeHtml.includes("Simple vérification") || homeHtml.includes("Visiter COLEKA") || homeHtml.includes("verifyBtn")) {
        log.debug("Challenge détecté, résolution...");
        const challengeSolved = await solveColekaChallenge(sessionId, lang);
        if (!challengeSolved) {
          throw new Error("Protection anti-bot non contournée");
        }
        await new Promise(r => setTimeout(r, 500));
      }
      
      // Accéder à la page de l'item
      log.debug(`Accès à: ${itemUrl}`);
      const pageSolution = await fsrRequest("request.get", itemUrl, sessionId, {
        waitInSeconds: 2
      }, 90000);
      
      const html = pageSolution.response || "";
      
      if (html.includes("Simple vérification") || html.includes("Visiter COLEKA")) {
        throw new Error("Protection anti-bot non contournée");
      }
      
      if (html.includes("Page introuvable") || html.includes("404") || html.length < 3000) {
        throw new Error(`Item non trouvé: ${itemId}`);
      }
      
      const item = {
        id: itemId,
        url: itemUrl,
        name: null,
        images: [],
        description: null,
        brand: null,
        series: null,
        reference: null,
        year: null,
        barcode: null,
        attributes: {},
        source: "coleka"
      };
      
      // Extraire le titre depuis <h1> ou meta og:title
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) {
        item.name = h1Match[1].trim();
      } else {
        const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
        if (ogTitleMatch) {
          item.name = ogTitleMatch[1].trim();
        }
      }
      
      // Extraire la description
      const descMatch = html.match(/<meta[^>]*(?:name="description"|property="og:description")[^>]*content="([^"]+)"/i);
      if (descMatch) {
        item.description = descMatch[1].trim();
      }
      
      // Extraire l'image principale (og:image)
      const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
      if (ogImageMatch) {
        item.images.push(ogImageMatch[1]);
      }
      
      // Extraire les images de la galerie
      const galleryPattern = /<img[^>]*(?:class="[^"]*(?:product|gallery|item)[^"]*"|data-src="([^"]+)")[^>]*src="([^"]+)"/gi;
      let imgMatch;
      const seenImages = new Set(item.images);
      while ((imgMatch = galleryPattern.exec(html)) !== null) {
        const imgUrl = imgMatch[1] || imgMatch[2];
        if (imgUrl && !seenImages.has(imgUrl) && !imgUrl.includes('placeholder') && !imgUrl.includes('logo')) {
          const fullUrl = imgUrl.startsWith('http') ? imgUrl : `${COLEKA_BASE_URL}${imgUrl}`;
          if (!seenImages.has(fullUrl)) {
            seenImages.add(fullUrl);
            item.images.push(fullUrl);
          }
        }
      }
      
      // Extraire les données structurées JSON-LD si présentes
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const jsonLd = JSON.parse(jsonLdMatch[1]);
          if (jsonLd['@type'] === 'Product' || jsonLd.name) {
            item.name = item.name || jsonLd.name;
            item.description = item.description || jsonLd.description;
            item.brand = jsonLd.brand?.name || jsonLd.brand;
            if (jsonLd.image) {
              const images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
              for (const img of images) {
                if (!seenImages.has(img)) {
                  seenImages.add(img);
                  item.images.push(img);
                }
              }
            }
            if (jsonLd.gtin13 || jsonLd.gtin || jsonLd.ean) {
              item.barcode = jsonLd.gtin13 || jsonLd.gtin || jsonLd.ean;
            }
            if (jsonLd.sku || jsonLd.productID) {
              item.reference = jsonLd.sku || jsonLd.productID;
            }
          }
        } catch (e) {
          log.debug(`Erreur parsing JSON-LD: ${e.message}`);
        }
      }
      
      // Extraire les attributs depuis les tables ou listes de caractéristiques
      const attrPatterns = [
        /<(?:tr|li)[^>]*>\s*<(?:td|span)[^>]*>([^<]+)<\/(?:td|span)>\s*<(?:td|span)[^>]*>([^<]+)<\/(?:td|span)>/gi,
        /<(?:dt|label)[^>]*>([^<]+)<\/(?:dt|label)>\s*<(?:dd|span)[^>]*>([^<]+)<\/(?:dd|span)>/gi
      ];
      
      for (const pattern of attrPatterns) {
        let attrMatch;
        while ((attrMatch = pattern.exec(html)) !== null) {
          const key = attrMatch[1].replace(/:$/, '').trim().toLowerCase();
          const value = attrMatch[2].trim();
          
          if (key && value && value.length < 200) {
            // Mapper vers les champs standards
            if (key.includes('marque') || key.includes('brand')) {
              item.brand = item.brand || value;
            } else if (key.includes('série') || key.includes('series') || key.includes('collection')) {
              item.series = item.series || value;
            } else if (key.includes('référence') || key.includes('reference') || key.includes('sku')) {
              item.reference = item.reference || value;
            } else if (key.includes('année') || key.includes('year') || key.includes('date')) {
              const yearMatch = value.match(/\d{4}/);
              if (yearMatch) item.year = parseInt(yearMatch[0]);
            } else if (key.includes('ean') || key.includes('barcode') || key.includes('gtin')) {
              item.barcode = item.barcode || value;
            } else {
              item.attributes[key] = value;
            }
          }
        }
      }
      
      // Extraire la catégorie depuis le fil d'Ariane
      const breadcrumbMatch = html.match(/<(?:nav|ol|ul)[^>]*(?:class="[^"]*breadcrumb[^"]*"|aria-label="[^"]*breadcrumb[^"]*")[^>]*>([\s\S]*?)<\/(?:nav|ol|ul)>/i);
      if (breadcrumbMatch) {
        const crumbs = [];
        const crumbPattern = /<a[^>]*>([^<]+)<\/a>/gi;
        let crumbMatch;
        while ((crumbMatch = crumbPattern.exec(breadcrumbMatch[1])) !== null) {
          const crumb = crumbMatch[1].trim();
          if (crumb && crumb.toLowerCase() !== 'accueil' && crumb.toLowerCase() !== 'home') {
            crumbs.push(crumb);
          }
        }
        if (crumbs.length > 0) {
          item.attributes.categories = crumbs;
        }
      }
      
      // Extraire les licences/marques depuis la structure <dt>Licence</dt><dd><ul>...</ul></dd>
      const licenceMatch = html.match(/<dt>Licence<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
      if (licenceMatch) {
        const brands = [];
        const licencePattern = /<a[^>]*>(?:<span[^>]*>[^<]*<\/span>)?([^<]+)<\/a>/gi;
        let licMatch;
        while ((licMatch = licencePattern.exec(licenceMatch[1])) !== null) {
          const brand = licMatch[1].trim();
          if (brand && brand.length > 0) {
            brands.push(brand);
          }
        }
        // Utiliser la première licence comme brand principal, stocker toutes dans brands
        if (brands.length > 0) {
          item.brand = item.brand || brands[0];
          item.brands = brands;
        }
      }
      
      if (!item.name) {
        throw new Error(`Impossible d'extraire les informations de l'item: ${itemUrl}`);
      }
      
      log.debug(`✅ Item récupéré: ${item.name}`);
      setCache(cacheKey, item);
      return item;

    } catch (err) {
      lastError = err;
      log.warn(`Erreur tentative ${attempt}: ${err.message}`);
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
 * Recherche Coleka avec résultat normalisé v3.0.0
 * @param {string} searchTerm - Terme de recherche
 * @param {number} nbpp - Nombre de résultats par page
 * @param {string} lang - Langue (fr, en)
 * @returns {Promise<Object>} Résultat normalisé
 */
export async function searchColekaNormalized(searchTerm, nbpp = COLEKA_DEFAULT_NBPP, lang = "fr") {
  const rawResult = await searchColeka(searchTerm, nbpp, lang);
  return normalizeColekaSearch(rawResult);
}

/**
 * Détails d'un item Coleka avec résultat normalisé v3.0.0
 * @param {string} itemId - ID, URL ou chemin de l'item
 * @param {string} lang - Langue (fr, en)
 * @returns {Promise<Object>} Détail normalisé
 */
export async function getColekaItemDetailsNormalized(itemId, lang = "fr") {
  const rawResult = await getColekaItemDetails(itemId, lang);
  return normalizeColekaDetail(rawResult);
}
