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

// Cache pour les noms localisés (SKU -> Nom FR/DE/ES/etc.)
const localizedNamesCache = new Map();
const LOCALIZED_NAMES_CACHE_TTL = 3600000; // 1 heure

// Mapping des langues vers les catégories du site EU
const MEGA_EU_CATEGORIES = [
  'pokemon', 'halo', 'masters-of-the-universe', 'hot-wheels', 
  'barbie', 'minecraft', 'game-of-thrones', 'call-of-duty',
  'star-trek', 'american-girl', 'hello-kitty', 'teenage-mutant-ninja-turtles'
];

// ============================================================================
// FONCTIONS DE LOCALISATION DES NOMS
// ============================================================================

/**
 * Récupère les noms localisés depuis une page d'instructions EU
 * @param {string} category - Catégorie (pokemon, halo, etc.)
 * @param {string} langCode - Code langue (fr, de, es, etc.)
 * @returns {Promise<Map<string, string>>} - Map SKU -> Nom localisé
 */
async function fetchLocalizedNamesFromCategory(category, langCode) {
  // NOTE: Le site shopping.mattel.com utilise la géolocalisation IP pour déterminer la langue,
  // donc depuis un serveur européen, on récupère toujours les noms FR quelle que soit l'URL.
  // On utilise donc fr-fr comme locale fixe pour la cohérence.
  const locale = 'fr-fr';
  // URL: /fr-fr/blogs/mega-building-instructions/tagged/fr-fr-category-pokemon
  const url = `https://shopping.mattel.com/${locale}/blogs/mega-building-instructions/tagged/${locale}-category-${category}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) return new Map();
    
    const html = await response.text();
    const names = new Map();
    
    // Pattern: "Nom FR - sku" (ex: "Pikachu en Mouvement - hgc23")
    const pattern = /"([^"]+)\s+-\s+([a-zA-Z]{2,5}[0-9]{2,5})"/gi;
    let match;
    
    while ((match = pattern.exec(html)) !== null) {
      const [, name, sku] = match;
      // Normaliser le SKU en majuscules
      names.set(sku.toUpperCase(), name.trim());
    }
    
    log.debug(`📚 ${names.size} noms ${langCode.toUpperCase()} trouvés pour catégorie ${category}`);
    return names;
    
  } catch (error) {
    log.debug(`⚠️ Erreur récupération noms ${langCode} pour ${category}: ${error.message}`);
    return new Map();
  }
}

/**
 * Récupère tous les noms localisés pour une langue
 * @param {string} langCode - Code langue (fr, de, es, etc.)
 * @returns {Promise<Map<string, string>>} - Map SKU -> Nom localisé
 */
async function getLocalizedNames(langCode) {
  if (!langCode || langCode === 'en') return new Map();
  
  // NOTE: Comme le site Mattel EU utilise la géolocalisation IP,
  // on récupère toujours les noms FR depuis un serveur européen.
  // On utilise donc un cache unique 'eu' pour toutes les langues européennes.
  const cacheKey = 'mega_names_eu';
  const cached = localizedNamesCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < LOCALIZED_NAMES_CACHE_TTL) {
    log.debug(`Cache HIT pour noms EU (${cached.data.size} noms)`);
    return cached.data;
  }
  
  log.info(`🌍 Récupération des noms MEGA EU (FR)...`);
  
  const allNames = new Map();
  
  // Récupérer en parallèle toutes les catégories principales
  const promises = MEGA_EU_CATEGORIES.map(cat => 
    fetchLocalizedNamesFromCategory(cat, langCode)
  );
  
  const results = await Promise.allSettled(promises);
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const [sku, name] of result.value) {
        allNames.set(sku, name);
      }
    }
  }
  
  log.info(`✅ ${allNames.size} noms MEGA EU chargés`);
  
  // Mettre en cache
  
  // Mettre en cache
  localizedNamesCache.set(cacheKey, {
    data: allNames,
    timestamp: Date.now()
  });
  
  return allNames;
}

/**
 * Extrait le SKU d'un nom de produit MEGA
 * @param {string} productName - Nom du produit (ex: "MEGA Pokémon Pikachu HGC23")
 * @returns {string|null} - SKU extrait ou null
 */
function extractSkuFromName(productName) {
  if (!productName) return null;
  // Pattern: lettres + chiffres à la fin du nom (ex: HGC23, HTJ06)
  const match = productName.match(/\b([A-Z]{2,5}[0-9]{2,5})\b/i);
  return match ? match[1].toUpperCase() : null;
}

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
  
  // IMPORTANT: L'API US (shop.mattel.com) contient les produits MEGA Construx
  // L'API EU (shopping.mattel.com) contient principalement Barbie/autres jouets Mattel
  // On utilise donc toujours l'API US pour la recherche MEGA
  const apiUrl = MEGA_API_URL_US;
  const siteId = MEGA_SITE_ID_US;
  const baseUrl = MEGA_BASE_URL_US;
  const currency = 'USD';
  
  const cacheKey = `mega_search_${query}_${max}_${lang}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }

  try {
    log.debug(`Recherche: "${query}" (max: ${max}, lang: ${lang}, API: US)`);
    
    const url = `${apiUrl}?siteId=${siteId}&q=${encodeURIComponent(query)}&resultsFormat=native&resultsPerPage=${max * 3}`;
    
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
    
    // Filtrer pour ne garder que les versions anglaises (sans suffixe de langue dans l'URL)
    // L'API US retourne des produits de toutes les régions (es-mx, pt-br, fr-ca, etc.)
    const langSuffixes = ['-es-mx', '-pt-br', '-fr-ca', '-de-de', '-fr-fr', '-en-gb', '-es-es', '-it-it', '-nl-nl'];
    const filteredItems = (data.results || []).filter(item => {
      const handle = item.handle || item.url || '';
      // Garder uniquement les produits sans suffixe de langue (version US/anglaise)
      return !langSuffixes.some(suffix => handle.endsWith(suffix));
    });
    
    // Dédupliquer par SKU (garder le premier de chaque SKU)
    const seenSkus = new Set();
    const uniqueItems = filteredItems.filter(item => {
      const sku = item.sku || extractSkuFromName(item.name);
      if (!sku) return true; // Garder les items sans SKU
      if (seenSkus.has(sku)) return false;
      seenSkus.add(sku);
      return true;
    });
    
    const results = uniqueItems.slice(0, max).map(item => {
      // Extraire le nombre de pièces du titre
      const piecesMatch = item.name?.match(/\((\d+)\s*(?:Pieces?|Pcs?|pièces?|Onderdelen|Teile|Pezzi)\)/i);
      const pieces = piecesMatch ? parseInt(piecesMatch[1]) : null;
      
      // Construire l'URL produit (toujours US pour MEGA)
      let productUrl = item.url ? `${baseUrl}${item.url}` : null;
      
      // Extraire le SKU depuis le nom ou le champ sku
      const sku = item.sku || extractSkuFromName(item.name);
      
      return {
        id: item.uid || item.id,
        type: 'building_set',
        title: item.name,
        title_original: item.name,
        description: item.description || null,
        brand: item.brand || 'MEGA',
        sku: sku,
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

    // Localisation des noms EU si langue non-anglaise demandée
    const langCode = extractLangCode(lang);
    if (langCode && langCode !== 'en') {
      try {
        const localizedNames = await getLocalizedNames(langCode);
        if (localizedNames.size > 0) {
          log.debug(`Localisation: ${localizedNames.size} noms EU disponibles`);
          for (const product of results) {
            const sku = product.sku;
            if (sku && localizedNames.has(sku)) {
              product.title = localizedNames.get(sku);
            }
          }
        }
      } catch (locErr) {
        log.debug(`Localisation échouée (non-bloquant): ${locErr.message}`);
      }
    }

    const result = {
      query,
      lang,
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
  
  // NOTE: Toujours utiliser l'API US pour les détails car les UID proviennent de cette API
  // L'API EU n'a pas les mêmes produits/UIDs
  const apiUrl = MEGA_API_URL_US;
  const siteId = MEGA_SITE_ID_US;
  const baseUrl = MEGA_BASE_URL_US;
  const currency = 'USD';
  
  const cacheKey = `mega_product_${productId}_${lang}_${shouldTranslate ? 'trad' : 'notrad'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }

  try {
    log.debug(`Récupération produit: ${productId} (lang: ${lang})`);
    
    // Toujours utiliser l'API US sans filtre de langue
    const url = `${apiUrl}?siteId=${siteId}&q=${encodeURIComponent(productId)}&resultsFormat=native&resultsPerPage=10`;
    
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
    
    // URL toujours vers le site US
    const productUrl = item.url ? `${baseUrl}${item.url}` : null;
    
    // Récupérer le nom localisé si disponible
    const localizedNames = await getLocalizedNames(destLang);
    const sku = item.sku?.toUpperCase();
    const localizedName = sku ? localizedNames.get(sku) : null;
    const titleOriginal = item.name;
    const title = localizedName || item.name;
    
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
      title: title,
      titleOriginal: titleOriginal,
      titleLocalized: localizedName || null,
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
    
    // Sites et catégories à chercher (EU en priorité car plus complet)
    const sites = [
      {
        baseUrl: `${MEGA_BASE_URL_EU}/fr-fr/blogs/mega-building-instructions`,
        categories: [
          '', 'fr-fr-category-pokemon', 'fr-fr-category-halo', 'fr-fr-category-barbie',
          'fr-fr-category-hot-wheels', 'fr-fr-category-masters-of-the-universe',
          'fr-fr-category-minecraft', 'fr-fr-category-hello-kitty', 'fr-fr-category-other'
        ],
        name: 'EU'
      },
      {
        baseUrl: `${MEGA_BASE_URL_US}/blogs/mega-building-instructions`,
        categories: [
          '', 'en-us-category-pokemon', 'en-us-category-halo', 'en-us-category-barbie',
          'en-us-category-hot-wheels', 'en-us-category-masters-of-the-universe',
          'en-us-category-tesla', 'en-us-category-other'
        ],
        name: 'US'
      }
    ];
    
    const extractPdfFromHtml = (html) => {
      const regex = new RegExp(
        `aria-label="([^"]+)\\s*-\\s*${skuLower}"[^>]*href="(https://assets\\.contentstack\\.io[^"]+\\.pdf)"`, 'i'
      );
      const match = html.match(regex);
      return match ? { name: match[1].trim(), url: match[2] } : null;
    };
    
    const scrapeCategory = async (baseUrl, category) => {
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
    
    // Chercher sur chaque site séquentiellement (EU d'abord)
    let found = null;
    for (const site of sites) {
      log.debug(`Recherche instructions sur ${site.name}...`);
      const results = await Promise.all(
        site.categories.map(cat => scrapeCategory(site.baseUrl, cat))
      );
      found = results.find(r => r !== null);
      if (found) {
        found.site = site.name;
        break;
      }
    }
    
    if (!found) throw new Error(`Instructions non trouvées pour SKU: ${sku}`);
    
    log.debug(`✅ Instructions trouvées pour ${sku} sur ${found.site} dans ${found.category}`);
    
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
 * @param {string} site - Site à utiliser ('eu' ou 'us', défaut: 'eu')
 * @returns {Promise<object>} - Liste des instructions
 */
export async function listMegaInstructions(category = '', site = 'eu') {
  metrics.sources.mega.requests++;
  
  const cacheKey = `mega_instructions_list_${site}_${category || 'all'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }

  try {
    log.debug(`Liste instructions pour catégorie: ${category || 'toutes'} (site: ${site.toUpperCase()})`);
    
    // Mapping des catégories selon le site
    const categoryMapEU = {
      'pokemon': 'fr-fr-category-pokemon',
      'halo': 'fr-fr-category-halo',
      'barbie': 'fr-fr-category-barbie',
      'hot-wheels': 'fr-fr-category-hot-wheels',
      'hotwheels': 'fr-fr-category-hot-wheels',
      'motu': 'fr-fr-category-masters-of-the-universe',
      'masters': 'fr-fr-category-masters-of-the-universe',
      'minecraft': 'fr-fr-category-minecraft',
      'hello-kitty': 'fr-fr-category-hello-kitty',
      'other': 'fr-fr-category-other'
    };
    
    const categoryMapUS = {
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
    
    const isEU = site.toLowerCase() === 'eu';
    const categoryMap = isEU ? categoryMapEU : categoryMapUS;
    const mattelCategory = categoryMap[category.toLowerCase()] || category;
    const baseUrl = isEU 
      ? `${MEGA_BASE_URL_EU}/fr-fr/blogs/mega-building-instructions`
      : `${MEGA_BASE_URL_US}/blogs/mega-building-instructions`;
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
    
    const result = { category: category || 'all', site: site.toUpperCase(), count: instructions.length, instructions, source: 'mega' };
    log.debug(`✅ ${instructions.length} instructions trouvées sur ${site.toUpperCase()}`);
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
