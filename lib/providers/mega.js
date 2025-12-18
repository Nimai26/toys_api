/**
 * lib/providers/mega.js - Provider MEGA Construx
 * 
 * API Searchspring pour les sets de construction Mattel MEGA
 * Ne nécessite pas FlareSolverr (API publique)
 * 
 * @module providers/mega
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { translateText, extractLangCode } from '../utils/translator.js';
import {
  FSR_BASE,
  MEGA_API_URL_US,
  MEGA_API_URL_EU,
  MEGA_SITE_ID_US,
  MEGA_SITE_ID_EU,
  MEGA_BASE_URL_US,
  MEGA_BASE_URL_EU,
  MEGA_DEFAULT_LANG,
  MEGA_LANG_REGION,
  MEGA_DEFAULT_MAX,
  USER_AGENT
} from '../config.js';
import { getFsrSessionId } from '../utils/flaresolverr.js';
import { normalizeMegaSearch, normalizeMegaDetail } from '../normalizers/construct-toy.js';

const log = createLogger('MEGA');

// ============================================================================
// RECHERCHE ET DÉTAILS PRODUITS
// ============================================================================

/**
 * Recherche de produits Mega Construx via l'API Searchspring
 * @param {string} query - Terme de recherche
 * @param {object} options - Options { max, lang }
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchMega(query, options = {}) {
  metrics.sources.mega.requests++;
  const max = Math.min(options.max || MEGA_DEFAULT_MAX, 100);
  const lang = options.lang || MEGA_DEFAULT_LANG;
  
  // Déterminer la région selon la langue
  const region = MEGA_LANG_REGION[lang] || 'EU';
  const apiUrl = region === 'US' ? MEGA_API_URL_US : MEGA_API_URL_EU;
  const siteId = region === 'US' ? MEGA_SITE_ID_US : MEGA_SITE_ID_EU;
  const baseUrl = region === 'US' ? MEGA_BASE_URL_US : MEGA_BASE_URL_EU;
  const currency = region === 'US' ? 'USD' : 'EUR';
  
  const cacheKey = `mega_search_${query}_${max}_${lang}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }

  try {
    log.debug(`Recherche: "${query}" (max: ${max}, lang: ${lang}, region: ${region})`);
    
    let url = `${apiUrl}?siteId=${siteId}&q=${encodeURIComponent(query)}&resultsFormat=native&resultsPerPage=${max}`;
    if (region === 'EU') {
      url += `&filter.ss_filter_tags_language=${lang}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`Searchspring error: ${response.status}`);
    }

    const data = await response.json();
    
    const results = (data.results || []).map(item => {
      // Extraire le nombre de pièces du titre
      const piecesMatch = item.name?.match(/\((\d+)\s*(?:Pieces?|Pcs?|pièces?|Onderdelen|Teile|Pezzi)\)/i);
      const pieces = piecesMatch ? parseInt(piecesMatch[1]) : null;
      
      // Construire l'URL produit
      let productUrl = null;
      if (item.url) {
        if (region === 'EU') {
          const langPrefix = lang.toLowerCase();
          productUrl = `${baseUrl}/${langPrefix}${item.url}`;
        } else {
          productUrl = `${baseUrl}${item.url}`;
        }
      }
      
      return {
        id: item.uid || item.id,
        type: 'building_set',
        title: item.name,
        description: item.description || null,
        brand: item.brand || 'MEGA',
        sku: item.sku || null,
        price: item.price ? parseFloat(item.price) : null,
        currency: currency,
        images: item.images || (item.imageUrl ? [item.imageUrl] : []),
        thumbnail: item.thumbnailImageUrl || item.imageUrl || null,
        pieces: pieces,
        rating: item.rating ? parseFloat(item.rating) : null,
        ratingCount: item.ratingCount ? parseInt(item.ratingCount) : null,
        inStock: item.ss_available === '1' || item.in_stock_offers === '1',
        url: productUrl,
        source: 'mega'
      };
    });

    const result = {
      query,
      lang,
      region,
      totalResults: data.pagination?.totalResults || results.length,
      resultsCount: results.length,
      results,
      source: 'mega'
    };

    log.debug(`✅ ${results.length} produits trouvés (total: ${result.totalResults})`);
    setCache(cacheKey, result);
    return result;

  } catch (err) {
    metrics.sources.mega.errors++;
    throw err;
  }
}

/**
 * Récupère les détails d'un produit Mega Construx par ID ou SKU
 * @param {string} productId - ID ou SKU du produit
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails du produit
 */
export async function getMegaProductById(productId, options = {}) {
  metrics.sources.mega.requests++;
  const lang = options.lang || MEGA_DEFAULT_LANG;
  const { autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const region = MEGA_LANG_REGION[lang] || 'EU';
  const apiUrl = region === 'US' ? MEGA_API_URL_US : MEGA_API_URL_EU;
  const siteId = region === 'US' ? MEGA_SITE_ID_US : MEGA_SITE_ID_EU;
  const baseUrl = region === 'US' ? MEGA_BASE_URL_US : MEGA_BASE_URL_EU;
  const currency = region === 'US' ? 'USD' : 'EUR';
  
  const cacheKey = `mega_product_${productId}_${lang}_${shouldTranslate ? 'trad' : 'notrad'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }

  try {
    log.debug(`Récupération produit: ${productId} (lang: ${lang})`);
    
    let url = `${apiUrl}?siteId=${siteId}&q=${encodeURIComponent(productId)}&resultsFormat=native&resultsPerPage=10`;
    if (region === 'EU') {
      url += `&filter.ss_filter_tags_language=${lang}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`Searchspring error: ${response.status}`);
    }

    const data = await response.json();
    
    // Trouver le produit correspondant
    let item = (data.results || []).find(r => 
      r.uid === productId || 
      r.sku === productId || 
      r.id === productId ||
      r.sku?.toUpperCase() === productId.toUpperCase()
    );
    
    if (!item && data.results?.length > 0) {
      item = data.results[0];
    }
    
    if (!item) {
      throw new Error(`Produit non trouvé: ${productId}`);
    }
    
    // Extraire les données enrichies
    let enrichedData = {};
    try {
      if (item.metafields) {
        const metaStr = item.metafields.replace(/&quot;/g, '"');
        
        const ageMatch = metaStr.match(/"age_grade":\s*"([^"]+)"/);
        if (ageMatch) enrichedData.ageRange = ageMatch[1];
        
        const upcMatch = metaStr.match(/"upc_ean":\s*"([^"]+)"/);
        if (upcMatch) enrichedData.upc = upcMatch[1];
        
        const categoryMatch = metaStr.match(/"web_category":\s*"([^"]+)"/);
        if (categoryMatch) enrichedData.category = categoryMatch[1];
        
        const subtypeMatch = metaStr.match(/"subtype":\s*"([^"]+)"/);
        if (subtypeMatch) enrichedData.franchise = subtypeMatch[1];
        
        const features = [];
        for (let i = 1; i <= 5; i++) {
          const featureMatch = metaStr.match(new RegExp(`"bullet_feature_${i}":\\s*"([^"]+)"`));
          if (featureMatch) {
            features.push(featureMatch[1].replace(/\\"/g, '"'));
          }
        }
        if (features.length > 0) enrichedData.features = features;
      }
    } catch (e) {
      log.debug(`Erreur parsing metafields: ${e.message}`);
    }
    
    const piecesMatch = item.name?.match(/\((\d+)\s*(?:Pieces?|Pcs?|pièces?)\)/i);
    const pieces = piecesMatch ? parseInt(piecesMatch[1]) : null;
    
    let productUrl = null;
    if (item.url) {
      if (region === 'EU') {
        productUrl = `${baseUrl}/${lang.toLowerCase()}${item.url}`;
      } else {
        productUrl = `${baseUrl}${item.url}`;
      }
    }
    
    // Description originale
    const descriptionOriginal = item.description || null;
    
    // Applique la traduction si demandée
    let finalDescription = descriptionOriginal;
    let descriptionTranslated = null;
    
    if (shouldTranslate && destLang && descriptionOriginal) {
      const translatedDesc = await translateText(descriptionOriginal, destLang);
      if (translatedDesc !== descriptionOriginal) {
        finalDescription = translatedDesc;
        descriptionTranslated = translatedDesc;
      }
    }
    
    const result = {
      id: item.uid || item.id,
      type: 'building_set',
      title: item.name,
      description: finalDescription,
      descriptionOriginal: descriptionOriginal,
      descriptionTranslated: descriptionTranslated,
      brand: item.brand || 'MEGA',
      sku: item.sku || null,
      price: item.price ? parseFloat(item.price) : null,
      currency: currency,
      images: item.images || (item.imageUrl ? [item.imageUrl] : []),
      thumbnail: item.thumbnailImageUrl || item.imageUrl || null,
      pieces: pieces,
      ageRange: enrichedData.ageRange || null,
      upc: enrichedData.upc || null,
      category: enrichedData.category || null,
      franchise: enrichedData.franchise || null,
      features: enrichedData.features || null,
      rating: item.rating ? parseFloat(item.rating) : null,
      ratingCount: item.ratingCount ? parseInt(item.ratingCount) : null,
      inStock: item.ss_available === '1' || item.in_stock_offers === '1',
      url: productUrl,
      lang: lang,
      source: 'mega'
    };

    log.debug(`✅ Produit récupéré: ${result.title}`);
    setCache(cacheKey, result);
    return result;

  } catch (err) {
    metrics.sources.mega.errors++;
    throw err;
  }
}

// ============================================================================
// INSTRUCTIONS DE MONTAGE
// ============================================================================

/**
 * Récupère les instructions de montage pour un produit Mega par SKU
 * @param {string} sku - SKU du produit (ex: HMW05, HTH96)
 * @returns {Promise<object>} - Informations sur les instructions
 */
export async function getMegaInstructions(sku) {
  metrics.sources.mega.requests++;
  
  const skuLower = sku.toLowerCase();
  const cacheKey = `mega_instructions_${skuLower}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }

  try {
    log.debug(`Recherche instructions pour SKU: ${sku}`);
    
    const categories = [
      '', 'en-us-category-pokemon', 'en-us-category-halo', 'en-us-category-barbie',
      'en-us-category-hot-wheels', 'en-us-category-masters-of-the-universe',
      'en-us-category-tesla', 'en-us-category-other'
    ];
    
    const baseUrl = `${MEGA_BASE_URL_US}/blogs/mega-building-instructions`;
    
    const extractPdfFromHtml = (html) => {
      const regex = new RegExp(
        `aria-label="([^"]+)\\s*-\\s*${skuLower}"[^>]*href="(https://assets\\.contentstack\\.io[^"]+\\.pdf)"`, 'i'
      );
      const match = html.match(regex);
      return match ? { name: match[1].trim(), url: match[2] } : null;
    };
    
    const scrapeCategory = async (category) => {
      const url = category ? `${baseUrl}/tagged/${category}` : baseUrl;
      try {
        const response = await fetch(`${FSR_BASE}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cmd: "request.get", url, maxTimeout: 30000, session: getFsrSessionId()
          })
        });
        const data = await response.json();
        if (data.status === "ok" && data.solution?.response) {
          const result = extractPdfFromHtml(data.solution.response);
          if (result) return { ...result, category: category || 'page principale' };
        }
      } catch (e) {
        log.debug(`Erreur scraping ${url}: ${e.message}`);
      }
      return null;
    };
    
    const results = await Promise.all(categories.map(cat => scrapeCategory(cat)));
    const found = results.find(r => r !== null);
    
    if (!found) throw new Error(`Instructions non trouvées pour SKU: ${sku}`);
    
    log.debug(`✅ Instructions trouvées pour ${sku} dans ${found.category}`);
    
    const result = {
      sku: sku.toUpperCase(),
      productName: found.name,
      instructionsUrl: found.url,
      format: 'PDF',
      source: 'mega',
      note: 'Instructions officielles Mattel'
    };

    setCache(cacheKey, result, 86400000); // 24h cache
    return result;

  } catch (err) {
    metrics.sources.mega.errors++;
    throw err;
  }
}

/**
 * Liste toutes les instructions disponibles pour une catégorie Mega
 * @param {string} category - Catégorie (pokemon, halo, barbie, hot-wheels, etc.)
 * @returns {Promise<object>} - Liste des instructions
 */
export async function listMegaInstructions(category = '') {
  metrics.sources.mega.requests++;
  
  const cacheKey = `mega_instructions_list_${category || 'all'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }

  try {
    log.debug(`Liste instructions pour catégorie: ${category || 'toutes'}`);
    
    const categoryMap = {
      'pokemon': 'en-us-category-pokemon',
      'halo': 'en-us-category-halo',
      'barbie': 'en-us-category-barbie',
      'hot-wheels': 'en-us-category-hot-wheels',
      'hotwheels': 'en-us-category-hot-wheels',
      'motu': 'en-us-category-masters-of-the-universe',
      'masters': 'en-us-category-masters-of-the-universe',
      'tesla': 'en-us-category-tesla',
      'other': 'en-us-category-other'
    };
    
    const mattelCategory = categoryMap[category.toLowerCase()] || category;
    const baseUrl = `${MEGA_BASE_URL_US}/blogs/mega-building-instructions`;
    const url = mattelCategory ? `${baseUrl}/tagged/${mattelCategory}` : baseUrl;
    
    const response = await fetch(`${FSR_BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get", url, maxTimeout: 30000, session: getFsrSessionId()
      })
    });

    const data = await response.json();
    if (data.status !== "ok") throw new Error(`FlareSolverr error: ${data.message || 'Unknown error'}`);

    const html = data.solution?.response || "";
    const instructions = [];
    const regex = /aria-label="([^"]+)\s*-\s*([^"]+)"[^>]*href="(https:\/\/assets\.contentstack\.io[^"]+\.pdf)"/gi;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      instructions.push({
        sku: match[2].trim().toUpperCase(),
        productName: match[1].trim(),
        instructionsUrl: match[3],
        format: 'PDF'
      });
    }
    
    const result = { category: category || 'all', count: instructions.length, instructions, source: 'mega' };
    log.debug(`✅ ${instructions.length} instructions trouvées`);
    setCache(cacheKey, result, 21600000); // 6h cache
    return result;

  } catch (err) {
    metrics.sources.mega.errors++;
    throw err;
  }
}

// ========================================
// Fonctions de normalisation v3.0.0
// ========================================

/**
 * Recherche Mega avec retour normalisé v3.0.0
 * @param {string} query - Terme de recherche
 * @param {object} options - Options (max, lang)
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function searchMegaNormalized(query, options = {}) {
  const raw = await searchMega(query, options);
  
  return {
    results: (raw.results || []).map(p => normalizeMegaSearch(p)),
    total: raw.totalResults || 0,
    count: raw.resultsCount || 0,
    query: raw.query || query,
    source: 'mega'
  };
}

/**
 * Détails produit Mega avec retour normalisé v3.0.0
 * @param {string} productId - ID ou SKU du produit
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getMegaProductByIdNormalized(productId, options = {}) {
  const raw = await getMegaProductById(productId, options);
  return normalizeMegaDetail(raw, options.lang || MEGA_DEFAULT_LANG);
}

// Export des fonctions de normalisation
export { normalizeMegaSearch, normalizeMegaDetail };
