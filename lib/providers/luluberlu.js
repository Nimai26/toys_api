/**
 * lib/providers/luluberlu.js - Provider Lulu-Berlu
 * 
 * Site de figurines vintage françaises
 * Nécessite FlareSolverr pour le scraping
 * 
 * @module providers/luluberlu
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { decodeHtmlEntities } from '../utils/helpers.js';
import {
  LULUBERLU_BASE_URL,
  LULUBERLU_SEARCH_URL,
  LULUBERLU_DEFAULT_MAX,
  LULUBERLU_RESULTS_PER_PAGE,
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
  normalizeLuluBerluSearch,
  normalizeLuluBerluDetail
} from '../normalizers/collectible.js';

const log = createLogger('LuluBerlu');

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur Lulu-Berlu via scraping
 * @param {string} searchTerm - Terme de recherche
 * @param {number} maxResults - Nombre max de résultats
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchLuluBerlu(searchTerm, maxResults = LULUBERLU_DEFAULT_MAX, retries = MAX_RETRIES) {
  const cacheKey = `luluberlu:search:${searchTerm}:${maxResults}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour recherche: "${searchTerm}"`);
      
      await ensureFsrSession();
      const sessionId = getFsrSessionId();
      
      const result = {
        query: searchTerm,
        products: [],
        total: 0,
        source: "lulu-berlu"
      };
      
      const pagesNeeded = Math.ceil(maxResults / LULUBERLU_RESULTS_PER_PAGE);
      let allProducts = [];
      let totalFromSite = 0;
      
      for (let page = 1; page <= pagesNeeded; page++) {
        const searchUrl = `${LULUBERLU_SEARCH_URL}?keywords=${encodeURIComponent(searchTerm)}&ok=%A1&numPage=${page}`;
        log.debug(`Page ${page}/${pagesNeeded}`);
        
        const pageSolution = await fsrRequest("request.get", searchUrl, sessionId, {
          waitInSeconds: 1
        }, 45000);
        
        const html = pageSolution.response || "";
        
        if (page === 1) {
          const totalMatch = html.match(/(\d+)\s*articles?\s+sur\s+(\d+)/i);
          if (totalMatch) {
            totalFromSite = parseInt(totalMatch[2], 10);
          }
        }
        
        // Extraire les produits
        const idPattern = /idproduit="(\d+)"/gi;
        const idMatches = [...html.matchAll(idPattern)];
        const seenIds = new Set(allProducts.map(p => p.id));
        
        for (const idMatch of idMatches) {
          const productId = idMatch[1];
          if (seenIds.has(productId)) continue;
          seenIds.add(productId);
          
          const idIndex = html.toLowerCase().indexOf(`idproduit="${productId}"`);
          if (idIndex === -1) continue;
          
          const contextStart = Math.max(0, idIndex - 200);
          const contextEnd = Math.min(html.length, idIndex + 3000);
          const context = html.substring(contextStart, contextEnd);
          
          const product = {
            id: productId,
            name: null,
            url: null,
            image: null,
            brand: null,
            availability: null,
            price: null
          };
          
          const urlPattern = new RegExp(`href="([^"]+a${productId}\\.html)"`, 'i');
          const urlMatch = context.match(urlPattern);
          if (urlMatch) {
            product.url = urlMatch[1].startsWith('http') ? urlMatch[1] : LULUBERLU_BASE_URL + (urlMatch[1].startsWith('/') ? '' : '/') + urlMatch[1];
          }
          
          const nameMatch = context.match(/(?:alt|title)="([^"]{10,})"/i);
          if (nameMatch && !nameMatch[1].toLowerCase().includes('ajouter')) {
            product.name = nameMatch[1].trim();
          }
          
          const imgMatch = context.match(/(?:data-lazy|data-url-img)="([^"]+)"/i);
          if (imgMatch) {
            let imgUrl = imgMatch[1];
            if (!imgUrl.startsWith('http')) {
              imgUrl = LULUBERLU_BASE_URL + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
            }
            product.image = imgUrl;
          }
          
          const brandMatch = context.match(/class="bp_marque"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
          if (brandMatch) {
            product.brand = brandMatch[1].trim();
          }
          
          const stockMatch = context.match(/<span class="articleDispo">[\s\S]*?>(En stock|Non disponible|Épuisé|Précommande)/i);
          if (stockMatch) {
            const status = stockMatch[1].toLowerCase();
            product.availability = status.includes('stock') ? 'in_stock' : 
                                   status.includes('précommande') ? 'preorder' : 'out_of_stock';
          }
          
          const priceMatch = context.match(/(\d+,\d+)\s*(?:€|&euro;)/i);
          if (priceMatch) {
            product.price = parseFloat(priceMatch[1].replace(',', '.'));
          }
          
          if (product.name || product.url) {
            allProducts.push(product);
          }
        }
        
        if (allProducts.length >= maxResults) break;
        if (totalFromSite > 0 && allProducts.length >= totalFromSite) break;
        if (!html.includes('numPage=' + (page + 1))) break;
      }
      
      result.products = allProducts.slice(0, maxResults);
      result.total = totalFromSite || allProducts.length;
      
      log.debug(`✅ Trouvé ${result.products.length}/${result.total} produits`);
      
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
 * Récupère les détails d'un item Lulu-Berlu
 * @param {string} itemId - ID, URL ou chemin de l'item
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Détails de l'item
 */
export async function getLuluBerluItemDetails(itemId, retries = MAX_RETRIES) {
  const cacheKey = `luluberlu:item:${itemId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour item: "${itemId}"`);
      
      const sessionId = await ensureFsrSession();
      
      if (!sessionId) {
        throw new Error("Impossible de créer une session FlareSolverr");
      }
      
      // Construire l'URL de l'item
      let itemUrl;
      if (itemId.startsWith('http')) {
        itemUrl = itemId;
      } else if (itemId.includes('.html')) {
        itemUrl = itemId.startsWith('/') ? `${LULUBERLU_BASE_URL}${itemId}` : `${LULUBERLU_BASE_URL}/${itemId}`;
      } else if (/^\d+$/.test(itemId)) {
        // ID numérique seul - essayer de construire une URL directe vers l'article
        // Sur Lulu-Berlu, les URLs suivent le pattern: /category/name-aID.html
        // On tente d'accéder directement à l'URL de recherche par ID produit
        log.debug(`ID numérique détecté: ${itemId}, recherche de l'URL du produit...`);
        
        // Construire l'URL directe du produit via la page de recherche par ID
        const searchByIdUrl = `${LULUBERLU_BASE_URL}/recherche?keywords=a${itemId}`;
        log.debug(`Recherche par ID: ${searchByIdUrl}`);
        
        const searchSolution = await fsrRequest("request.get", searchByIdUrl, sessionId, {
          waitInSeconds: 1
        }, 45000);
        
        const searchHtml = searchSolution.response || "";
        
        // Chercher l'URL du produit avec cet ID
        const urlPattern = new RegExp(`href="([^"]*a${itemId}\\.html)"`, 'i');
        const urlMatch = searchHtml.match(urlPattern);
        
        if (urlMatch) {
          itemUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : LULUBERLU_BASE_URL + (urlMatch[1].startsWith('/') ? '' : '/') + urlMatch[1];
          log.debug(`URL trouvée pour l'ID ${itemId}: ${itemUrl}`);
        } else {
          throw new Error(`Produit avec l'ID ${itemId} non trouvé sur Lulu-Berlu`);
        }
      } else {
        itemUrl = `${LULUBERLU_BASE_URL}/${itemId}`;
      }
      
      log.debug(`Visite de: ${itemUrl}`);
      
      const pageSolution = await fsrRequest("request.get", itemUrl, sessionId, {
        waitInSeconds: 1
      }, 45000);
      
      const html = pageSolution.response || "";
      log.debug(`Page item reçue, taille: ${html.length}`);
      
      if (html.includes("Page non trouvée") || html.includes("Error 404") || html.length < 5000) {
        throw new Error("Item non trouvé");
      }
      
      const item = {
        id: itemId,
        name: null,
        url: itemUrl,
        images: [],
        description: null,
        brand: null,
        reference: null,
        price: null,
        availability: null,
        attributes: {},
        source: "lulu-berlu"
      };
      
      // Extraire l'ID depuis le HTML
      const idMatch = html.match(/id_article"\s*value="(\d+)"/i);
      if (idMatch) item.id = idMatch[1];
      
      // Extraction du nom
      const namePatterns = [
        /<title>([^<]+)<\/title>/i,
        /<h1[^>]*>([^<]+)<\/h1>/i,
        /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i
      ];
      for (const pattern of namePatterns) {
        const match = html.match(pattern);
        if (match) {
          item.name = match[1].trim().replace(/ - Lulu Berlu$/, '').replace(/\s+/g, ' ');
          if (item.name.length > 0) break;
        }
      }
      
      // Extraction des images
      const mainImageSection = html.match(/<div[^>]*class="[^"]*fa_bloc-image[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*fa_bloc-details[^"]*"/i);
      const imageHtml = mainImageSection ? mainImageSection[1] : '';
      const seenImages = new Set();
      
      const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
      if (ogImageMatch) {
        let imgUrl = ogImageMatch[1].replace('-moyenne.', '-grande.');
        if (!seenImages.has(imgUrl)) {
          seenImages.add(imgUrl);
          item.images.push(imgUrl);
        }
      }
      
      if (imageHtml) {
        const hrefPattern = /href="([^"]*p-image-\d+-grande\.[^"]+)"/gi;
        for (const m of [...imageHtml.matchAll(hrefPattern)]) {
          let imgUrl = m[1];
          if (!imgUrl.startsWith('http')) imgUrl = LULUBERLU_BASE_URL + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
          if (!seenImages.has(imgUrl)) {
            seenImages.add(imgUrl);
            item.images.push(imgUrl);
          }
        }
      }
      
      // Extraction du prix
      const pricePatterns = [/itemprop="price"[^>]*content="([^"]+)"/i, /(\d+[.,]\d+)\s*(?:€|&euro;|EUR)/i];
      for (const pattern of pricePatterns) {
        const match = html.match(pattern);
        if (match) {
          item.price = parseFloat(match[1].replace(',', '.'));
          break;
        }
      }
      
      // Extraction de la référence
      const skuMatch = html.match(/itemprop="sku"[^>]*content="([^"]+)"/i);
      if (skuMatch) item.reference = skuMatch[1];
      
      // Extraction de la marque
      const brandPatterns = [
        /itemprop="brand"[^>]*content="([^"]+)"/i,
        /<span[^>]*itemprop="brand"[^>]*>([^<]+)<\/span>/i
      ];
      for (const pattern of brandPatterns) {
        const match = html.match(pattern);
        if (match) {
          item.brand = match[1].trim();
          break;
        }
      }
      
      // Extraction de la disponibilité
      const availMatch = html.match(/itemprop="availability"[^>]*content="([^"]+)"/i);
      if (availMatch) {
        const status = availMatch[1].toLowerCase();
        item.availability = status.includes('instock') ? 'in_stock' : 
                           status.includes('preorder') ? 'preorder' : 'out_of_stock';
      }
      
      // Extraction de la description
      const descMatch = html.match(/<meta[^>]*(?:name="description"|property="og:description")[^>]*content="([^"]+)"/i);
      if (descMatch) {
        item.description = decodeHtmlEntities(descMatch[1]);
      }
      
      // Extraction des attributs depuis la description ou le contenu
      item.attributes = {};
      
      // Chercher dans le HTML brut les attributs de type "Texte : valeur"
      // Les patterns s'arrêtent avant le prochain attribut ou fin de texte
      const attributePatterns = [
        { key: 'type', pattern: /Type\s*:\s*([^<\n]+?)(?=\s*(?:Matière|Taille|Origine|Année|Condition|$))/i },
        { key: 'material', pattern: /Mati[èe]re\s*:\s*([^<\n]+?)(?=\s*(?:Type|Taille|Origine|Année|Condition|$))/i },
        { key: 'size', pattern: /(?:Taille|Hauteur)\s*:\s*([^<\n]+?)(?=\s*(?:Type|Matière|Origine|Année|Condition|$))/i },
        { key: 'origin', pattern: /Origine\s*:\s*([^<\n]+?)(?=\s*(?:Type|Matière|Taille|Année|Condition|$))/i },
        { key: 'year', pattern: /Ann[ée]e\s*:\s*(\d{4})/i },
        { key: 'condition', pattern: /Condition\s*:\s*([^<\n]+?)(?=\s*(?:Type|Matière|Taille|Origine|Année|$|\.))/i }
      ];
      
      // Chercher dans la description meta
      const descriptionText = item.description || '';
      
      // Chercher aussi dans le bloc de détails du produit
      const detailsBlockMatch = html.match(/<div[^>]*class="[^"]*(?:fa_bloc-details|product-details|description)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const detailsText = detailsBlockMatch ? detailsBlockMatch[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ') : '';
      
      // Combiner tous les textes pour la recherche
      const fullText = `${descriptionText} ${detailsText}`;
      
      for (const { key, pattern } of attributePatterns) {
        const match = fullText.match(pattern);
        if (match) {
          let value = match[1].trim().replace(/\s+/g, ' ');
          // Nettoyer les valeurs
          value = value.replace(/&nbsp;/g, '').replace(/^\s*:\s*/, '').trim();
          if (value && value.length > 0 && value.length < 100) {
            item.attributes[key] = value;
          }
        }
      }
      
      log.debug(`✅ Item récupéré: ${item.name || item.id}`);
      setCache(cacheKey, item);
      return item;

    } catch (err) {
      lastError = err;
      log.warn(`Erreur tentative ${attempt}: ${err.message}`);
      if (getFsrSessionId()) await destroyFsrSession();
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
 * Recherche Lulu-Berlu avec résultat normalisé v3.0.0
 * @param {string} searchTerm - Terme de recherche
 * @param {number} maxResults - Nombre max de résultats
 * @returns {Promise<Object>} Résultat normalisé
 */
export async function searchLuluBerluNormalized(searchTerm, maxResults = LULUBERLU_DEFAULT_MAX) {
  const rawResult = await searchLuluBerlu(searchTerm, maxResults);
  return normalizeLuluBerluSearch(rawResult);
}

/**
 * Détails d'un item Lulu-Berlu avec résultat normalisé v3.0.0
 * @param {string} itemId - ID, URL ou chemin de l'item
 * @returns {Promise<Object>} Détail normalisé
 */
export async function getLuluBerluItemDetailsNormalized(itemId) {
  const rawResult = await getLuluBerluItemDetails(itemId);
  return normalizeLuluBerluDetail(rawResult);
}
