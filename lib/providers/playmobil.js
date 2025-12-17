/**
 * lib/providers/playmobil.js - Provider Playmobil
 * 
 * Recherche et détails de produits Playmobil via scraping
 * Site: playmobil.com
 * 
 * @module providers/playmobil
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { decodeHtmlEntities } from '../utils/helpers.js';
import { DEFAULT_LOCALE, MAX_RETRIES } from '../config.js';

const log = createLogger('Playmobil');

// ========================================
// Configuration Playmobil
// ========================================
const PLAYMOBIL_BASE_URL = 'https://www.playmobil.com';
const PLAYMOBIL_MEDIA_URL = 'https://media.playmobil.com/i/playmobil';
const PLAYMOBIL_INSTRUCTIONS_URL = 'https://playmobil.a.bigcontent.io/v1/static';

// Mapping des locales vers les URLs Playmobil
const LOCALE_MAP = {
  'fr-FR': 'fr-fr',
  'fr-BE': 'fr-be',
  'fr-CH': 'fr-ch',
  'fr-CA': 'fr-ca',
  'en-US': 'en-us',
  'en-GB': 'en-gb',
  'en-CA': 'en-ca',
  'de-DE': 'de-de',
  'de-AT': 'de-at',
  'de-CH': 'de-ch',
  'es-ES': 'es-es',
  'es-MX': 'es-mx',
  'it-IT': 'it-it',
  'nl-NL': 'nl-nl',
  'nl-BE': 'nl-be',
  'pt-PT': 'pt-pt'
};

// ========================================
// Fonctions utilitaires
// ========================================

/**
 * Normalise une locale vers le format Playmobil
 */
function normalizeLocale(lang) {
  if (!lang) return 'fr-fr';
  
  // Si déjà au bon format
  const lower = lang.toLowerCase();
  if (LOCALE_MAP[lang.toUpperCase().replace('_', '-')]) {
    return LOCALE_MAP[lang.toUpperCase().replace('_', '-')];
  }
  
  // Cherche une correspondance partielle
  for (const [key, value] of Object.entries(LOCALE_MAP)) {
    if (key.toLowerCase().startsWith(lower.split('-')[0])) {
      return value;
    }
  }
  
  return 'fr-fr';
}

/**
 * Extrait le code produit d'une URL ou d'un ID
 */
export function extractPlaymobilProductId(input) {
  if (!input) return null;
  
  const str = String(input);
  
  // ID numérique direct (4-6 chiffres)
  const numericMatch = str.match(/^(\d{4,6})$/);
  if (numericMatch) return numericMatch[1];
  
  // Extraction depuis URL: /product-name/71148.html
  const urlMatch = str.match(/\/(\d{4,6})\.html/);
  if (urlMatch) return urlMatch[1];
  
  // Extraction depuis slug avec ID
  const slugMatch = str.match(/(\d{4,6})(?:\?|$)/);
  if (slugMatch) return slugMatch[1];
  
  return null;
}

/**
 * Valide un ID produit Playmobil
 */
export function isValidPlaymobilProductId(id) {
  if (!id) return false;
  const idStr = String(id);
  return /^\d{4,6}$/.test(idStr);
}

/**
 * Construit l'URL d'une image produit
 */
function buildImageUrl(productId, size = 512) {
  return `${PLAYMOBIL_MEDIA_URL}/${productId}_product_detail?w=${size}&fmt=auto&strip=true&qlt=80`;
}

/**
 * Construit l'URL du thumbnail
 */
function buildThumbnailUrl(productId) {
  return `${PLAYMOBIL_MEDIA_URL}/${productId}_product_detail?w=200&sm=aspect&aspect=1:1&fmt=auto&strip=true&qlt=80`;
}

/**
 * Construit l'URL des instructions de montage
 */
function buildInstructionsUrl(productId) {
  return `${PLAYMOBIL_INSTRUCTIONS_URL}/${productId}_buildinginstruction`;
}

/**
 * Parse les données JSON encodées en HTML entities
 */
function parseDataLayerJson(dataStr) {
  try {
    const decoded = decodeHtmlEntities(dataStr);
    return JSON.parse(decoded);
  } catch (err) {
    log.debug(`Erreur parsing JSON: ${err.message}`);
    return null;
  }
}

/**
 * Extrait les infos produit depuis data-datalayer-impression
 */
function parseProductFromDataLayer(dataStr) {
  const data = parseDataLayerJson(dataStr);
  if (!data?.ecommerce?.items?.[0]) return null;
  
  const item = data.ecommerce.items[0];
  return {
    id: item.item_id,
    sku: item.item_sku,
    name: decodeHtmlEntities(item.item_name || ''),
    brand: item.item_brand || 'Playmobil',
    price: item.price,
    discountPrice: item.discount_price,
    discount: item.discount || null,
    currency: item.currency || 'EUR',
    category: item.item_category || null,
    category2: item.item_category2 || null
  };
}

// ========================================
// Fonction principale de recherche
// ========================================

/**
 * Recherche de produits Playmobil via scraping
 * @param {string} searchTerm - Terme de recherche
 * @param {string} lang - Langue/locale (default: fr-FR)
 * @param {number} retries - Nombre max de tentatives
 * @param {number} maxResults - Nombre max de résultats
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchPlaymobil(searchTerm, lang = DEFAULT_LOCALE, retries = MAX_RETRIES, maxResults = 24) {
  const locale = normalizeLocale(lang);
  const cacheKey = `playmobil:search:${searchTerm}:${locale}:${maxResults}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  metrics.sources.playmobil = metrics.sources.playmobil || { requests: 0, errors: 0 };
  metrics.sources.playmobil.requests++;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour recherche: "${searchTerm}" (locale: ${locale})`);
      
      const searchUrl = `${PLAYMOBIL_BASE_URL}/${locale}/resultat-de-la-recherche/?q=${encodeURIComponent(searchTerm)}`;
      log.debug(`URL: ${searchUrl}`);
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': `${locale.replace('-', '_')},${locale.split('-')[0]};q=0.9,en;q=0.8`,
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      log.debug(`Page reçue, taille: ${html.length} caractères`);
      
      const products = [];
      
      // Méthode 1: Extraire depuis JSON-LD ItemList
      const itemListMatch = html.match(/"@type"\s*:\s*"ItemList"[^}]*"itemListElement"\s*:\s*\[([\s\S]*?)\]\s*\}/);
      if (itemListMatch) {
        try {
          const itemListJson = `{"itemListElement":[${itemListMatch[1]}]}`;
          const itemList = JSON.parse(itemListJson);
          
          for (const item of itemList.itemListElement || []) {
            if (item.url && products.length < maxResults) {
              const productId = extractPlaymobilProductId(item.url);
              if (productId && isValidPlaymobilProductId(productId)) {
                products.push({
                  id: productId,
                  productCode: productId,
                  url: item.url,
                  position: item.position
                });
              }
            }
          }
          log.debug(`Trouvé ${products.length} produits via JSON-LD ItemList`);
        } catch (parseErr) {
          log.debug(`Erreur parsing JSON-LD: ${parseErr.message}`);
        }
      }
      
      // Méthode 2: Extraire depuis data-datalayer-impression
      const dataLayerPattern = /data-datalayer-impression="(\{[^"]+\})"/g;
      let match;
      const seenIds = new Set(products.map(p => p.id));
      
      while ((match = dataLayerPattern.exec(html)) !== null && products.length < maxResults) {
        const productData = parseProductFromDataLayer(match[1]);
        if (productData && productData.id && !seenIds.has(productData.id) && isValidPlaymobilProductId(productData.id)) {
          seenIds.add(productData.id);
          
          // Enrichir le produit existant ou ajouter
          const existingProduct = products.find(p => p.id === productData.id);
          if (existingProduct) {
            Object.assign(existingProduct, {
              name: productData.name,
              price: productData.price,
              discountPrice: productData.discountPrice,
              currency: productData.currency,
              category: productData.category
            });
          } else {
            products.push({
              id: productData.id,
              productCode: productData.sku || productData.id,
              name: productData.name,
              thumb: buildThumbnailUrl(productData.id),
              baseImgUrl: buildImageUrl(productData.id),
              price: productData.price,
              discountPrice: productData.discountPrice,
              currency: productData.currency,
              category: productData.category,
              brand: productData.brand
            });
          }
        }
      }
      
      // Enrichir les produits sans nom avec les données data-layer
      for (const product of products) {
        if (!product.name) {
          // Chercher dans le HTML le nom associé à cet ID
          const namePattern = new RegExp(`item_id&quot;:&quot;${product.id}&quot;[^}]*item_name&quot;:&quot;([^&]+)&quot;`);
          const nameMatch = html.match(namePattern);
          if (nameMatch) {
            product.name = decodeHtmlEntities(nameMatch[1]);
          }
        }
        
        // Ajouter les URLs d'image si manquantes
        if (!product.thumb) {
          product.thumb = buildThumbnailUrl(product.id);
        }
        if (!product.baseImgUrl) {
          product.baseImgUrl = buildImageUrl(product.id);
        }
      }
      
      log.info(`✅ Trouvé ${products.length} produits Playmobil pour "${searchTerm}"`);
      
      const result = {
        products,
        total: products.length,
        count: products.length,
        resultFor: searchTerm,
        source: 'playmobil',
        lang: locale
      };
      
      setCache(cacheKey, result);
      return result;
      
    } catch (err) {
      lastError = err;
      log.error(`Erreur tentative ${attempt}: ${err.message}`);
      
      if (attempt >= retries) break;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  
  metrics.sources.playmobil.errors++;
  throw lastError || new Error(`Échec recherche Playmobil après ${retries} tentatives`);
}

// ========================================
// Récupération des détails d'un produit
// ========================================

/**
 * Récupère les détails d'un produit Playmobil
 * @param {string} productId - ID du produit (ex: "71148")
 * @param {string} lang - Langue/locale
 * @param {number} retries - Nombre max de tentatives
 * @returns {Promise<object>} - Détails du produit
 */
export async function getPlaymobilProductDetails(productId, lang = DEFAULT_LOCALE, retries = MAX_RETRIES) {
  const cleanId = extractPlaymobilProductId(productId);
  if (!cleanId || !isValidPlaymobilProductId(cleanId)) {
    throw new Error(`ID produit Playmobil invalide: ${productId}`);
  }
  
  const locale = normalizeLocale(lang);
  const cacheKey = `playmobil:product:${cleanId}:${locale}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  metrics.sources.playmobil = metrics.sources.playmobil || { requests: 0, errors: 0 };
  metrics.sources.playmobil.requests++;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour produit: ${cleanId} (locale: ${locale})`);
      
      // D'abord, trouver l'URL du produit via recherche
      const searchResult = await searchPlaymobil(cleanId, lang, 1, 5);
      
      let productUrl = null;
      let productSlug = null;
      
      if (searchResult.products.length > 0) {
        const found = searchResult.products.find(p => p.id === cleanId || p.productCode === cleanId);
        if (found && found.url) {
          productUrl = found.url;
        }
      }
      
      // Si pas trouvé via recherche, construire l'URL générique
      if (!productUrl) {
        // Fallback: URL directe (peut ne pas fonctionner si le slug est différent)
        productUrl = `${PLAYMOBIL_BASE_URL}/${locale}/product/${cleanId}.html`;
      }
      
      log.debug(`URL produit: ${productUrl}`);
      
      const response = await fetch(productUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': `${locale.replace('-', '_')},${locale.split('-')[0]};q=0.9,en;q=0.8`
        },
        redirect: 'follow'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      log.debug(`Page produit reçue, taille: ${html.length} caractères`);
      
      // Extraire les données depuis data-datalayer (view_item event)
      let productData = null;
      
      // Chercher tous les data-datalayer et trouver celui avec view_item
      const allDataLayers = html.matchAll(/data-datalayer="([^"]+)"/g);
      for (const match of allDataLayers) {
        const rawJson = match[1];
        if (rawJson.includes('view_item')) {
          try {
            const decoded = decodeHtmlEntities(rawJson);
            const dataArray = JSON.parse(decoded);
            const viewItem = Array.isArray(dataArray) 
              ? dataArray.find(d => d.event === 'view_item')
              : (dataArray.event === 'view_item' ? dataArray : null);
            
            if (viewItem?.ecommerce?.items?.[0]) {
              const item = viewItem.ecommerce.items[0];
              productData = {
                id: item.item_id,
                sku: item.item_sku,
                name: decodeHtmlEntities(item.item_name || ''),
                price: parseFloat(item.price) || null,
                discountPrice: parseFloat(item.discount_price) || null,
                discount: item.discount || null,
                currency: item.currency || 'EUR',
                category: item.item_category || null,
                category2: item.item_category2 || null,
                brand: item.item_brand || 'Playmobil'
              };
              log.debug(`Prix extrait depuis data-datalayer: ${productData.price}€`);
              break;
            }
          } catch (parseErr) {
            log.debug(`Erreur parsing dataLayer: ${parseErr.message}`);
          }
        }
      }
      
      // Extraire le titre
      let name = productData?.name || null;
      if (!name) {
        const titleMatch = html.match(/pdpMain__productTitle[^>]*>([^<]+)</);
        if (titleMatch) {
          name = decodeHtmlEntities(titleMatch[1].trim());
        }
      }
      // Double décodage pour les entités HTML imbriquées
      if (name) {
        name = decodeHtmlEntities(name);
      }
      
      // Extraire la description
      let description = null;
      const descItems = [];
      const descPattern = /<li[^>]*>\s*<span[^>]*>[\s\S]*?<\/span>\s*([^<]+)<\/li>/gi;
      let descMatch;
      while ((descMatch = descPattern.exec(html)) !== null) {
        const text = descMatch[1].trim();
        if (text && text.length > 10 && !text.includes('svg') && !text.includes('icon')) {
          descItems.push(decodeHtmlEntities(text));
        }
      }
      if (descItems.length > 0) {
        description = descItems.join('\n');
      }
      
      // Extraire le nombre de pièces
      let pieceCount = null;
      const pieceMatch = html.match(/(\d+)\s*pi[eè]ces/i);
      if (pieceMatch) {
        pieceCount = parseInt(pieceMatch[1], 10);
      }
      
      // Extraire l'âge recommandé
      let ageRange = null;
      const ageMatch = html.match(/(\d+)\s*[-–]\s*(\d+)\s*ans|(\d+)\+?\s*ans/i);
      if (ageMatch) {
        if (ageMatch[1] && ageMatch[2]) {
          ageRange = `${ageMatch[1]}-${ageMatch[2]}`;
        } else if (ageMatch[3]) {
          ageRange = `${ageMatch[3]}+`;
        }
      }
      
      // Extraire les images
      const images = [];
      const imagePattern = new RegExp(`media\\.playmobil\\.com/i/playmobil/${cleanId}_[^"'&\\s]+`, 'g');
      const seenImages = new Set();
      let imgMatch;
      while ((imgMatch = imagePattern.exec(html)) !== null) {
        const imgUrl = `https://${imgMatch[0].split('?')[0]}`;
        if (!seenImages.has(imgUrl)) {
          seenImages.add(imgUrl);
          images.push(imgUrl);
        }
      }
      
      // Construire le résultat (format similaire à LEGO)
      const result = {
        id: cleanId,
        productCode: cleanId,
        name: name || `Playmobil ${cleanId}`,
        slug: productUrl.split('/').slice(-1)[0].replace('.html', ''),
        description: description,
        price: productData?.price || null,
        discountPrice: productData?.discountPrice !== productData?.price ? productData?.discountPrice : null,
        currency: productData?.currency || 'EUR',
        availability: {
          status: 'available', // Par défaut, à améliorer avec parsing
          text: null
        },
        attributes: {
          pieceCount: pieceCount,
          ageRange: ageRange,
          rating: null,
          canAddToBag: true
        },
        category: productData?.category || null,
        subcategory: productData?.category2 || null,
        images: images.length > 0 ? images : [buildImageUrl(cleanId, 1024)],
        thumb: buildThumbnailUrl(cleanId),
        baseImgUrl: buildImageUrl(cleanId),
        instructions: buildInstructionsUrl(cleanId),
        url: productUrl,
        brand: 'Playmobil',
        source: 'playmobil',
        lang: locale
      };
      
      log.info(`✅ Produit Playmobil ${cleanId}: ${result.name}`);
      
      setCache(cacheKey, result);
      return result;
      
    } catch (err) {
      lastError = err;
      log.error(`Erreur tentative ${attempt}: ${err.message}`);
      
      if (attempt >= retries) break;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  
  metrics.sources.playmobil.errors++;
  throw lastError || new Error(`Échec récupération produit Playmobil ${cleanId} après ${retries} tentatives`);
}

// ========================================
// Récupération des instructions de montage
// ========================================

/**
 * Récupère l'URL des instructions de montage pour un produit
 * @param {string} productId - ID du produit
 * @returns {Promise<object>} - Informations sur les instructions
 */
export async function getPlaymobilInstructions(productId) {
  const cleanId = extractPlaymobilProductId(productId);
  if (!cleanId || !isValidPlaymobilProductId(cleanId)) {
    throw new Error(`ID produit Playmobil invalide: ${productId}`);
  }
  
  const cacheKey = `playmobil:instructions:${cleanId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  const instructionsUrl = buildInstructionsUrl(cleanId);
  
  try {
    // Vérifier que les instructions existent
    const response = await fetch(instructionsUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const result = {
      productId: cleanId,
      available: response.ok,
      url: response.ok ? instructionsUrl : null,
      format: 'PDF',
      source: 'playmobil'
    };
    
    if (response.ok) {
      log.info(`✅ Instructions trouvées pour Playmobil ${cleanId}`);
    } else {
      log.debug(`Instructions non disponibles pour Playmobil ${cleanId}`);
    }
    
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    log.error(`Erreur vérification instructions ${cleanId}: ${err.message}`);
    return {
      productId: cleanId,
      available: false,
      url: null,
      error: err.message,
      source: 'playmobil'
    };
  }
}

// ========================================
// Recherche de notices via API Demandware
// ========================================

/**
 * Recherche des notices de montage via l'API Playmobil
 * @param {string} query - Terme de recherche (ID produit)
 * @param {string} lang - Langue/locale
 * @returns {Promise<object>} - Résultats de la recherche de notices
 */
export async function searchPlaymobilInstructions(query, lang = DEFAULT_LOCALE) {
  const locale = normalizeLocale(lang);
  const cacheKey = `playmobil:instructions:search:${query}:${locale}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  const siteCode = locale.toUpperCase().replace('-', '-Site/');
  const apiUrl = `${PLAYMOBIL_BASE_URL}/on/demandware.store/Sites-${locale.split('-')[1].toUpperCase()}-Site/${locale.replace('-', '_')}/BuildingInstructions-Search?searchQuery=${encodeURIComponent(query)}`;
  
  log.debug(`Recherche notices: ${apiUrl}`);
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const results = [];
    
    // Extraire les liens vers les instructions
    const linkPattern = /href="(https:\/\/playmobil\.a\.bigcontent\.io\/v1\/static\/(\d+)_buildinginstruction)"/g;
    let match;
    const seenIds = new Set();
    
    while ((match = linkPattern.exec(html)) !== null) {
      const instructionUrl = match[1];
      const productId = match[2];
      
      if (!seenIds.has(productId)) {
        seenIds.add(productId);
        
        // Extraire le nom du produit associé
        const namePattern = new RegExp(`item_id&quot;:&quot;${productId}&quot;[^}]*item_name&quot;:&quot;([^&]+)&quot;`);
        const nameMatch = html.match(namePattern);
        
        results.push({
          productId,
          name: nameMatch ? decodeHtmlEntities(nameMatch[1]) : `Playmobil ${productId}`,
          instructionsUrl: instructionUrl,
          format: 'PDF'
        });
      }
    }
    
    const result = {
      query,
      results,
      count: results.length,
      source: 'playmobil'
    };
    
    log.info(`✅ Trouvé ${results.length} notices pour "${query}"`);
    
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    log.error(`Erreur recherche notices: ${err.message}`);
    return {
      query,
      results: [],
      count: 0,
      error: err.message,
      source: 'playmobil'
    };
  }
}

// ========================================
// Export des fonctions
// ========================================
export {
  normalizeLocale,
  buildImageUrl,
  buildThumbnailUrl,
  buildInstructionsUrl,
  PLAYMOBIL_BASE_URL,
  PLAYMOBIL_MEDIA_URL,
  PLAYMOBIL_INSTRUCTIONS_URL,
  LOCALE_MAP
};
