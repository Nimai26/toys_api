/**
 * lib/providers/rebrickable.js - Provider Rebrickable API
 * 
 * API officielle Rebrickable pour les sets LEGO, pièces et minifigs
 * 
 * @module providers/rebrickable
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { translateText, extractLangCode } from '../utils/translator.js';
import { REBRICKABLE_BASE_URL, REBRICKABLE_DEFAULT_MAX, DEFAULT_LOCALE } from '../config.js';
import { normalizeRebrickableSearch, normalizeRebrickableDetail } from '../normalizers/construct-toy.js';
import { fetchViaProxy } from '../utils/fetch-proxy.js';

const log = createLogger('Rebrickable');

// Import pour l'enrichissement croisé
let getProductDetails, getBuildingInstructions;

// Fonction pour injection de dépendances (évite import circulaire)
export function setLegoFunctions(productDetailsFn, buildingInstructionsFn) {
  getProductDetails = productDetailsFn;
  getBuildingInstructions = buildingInstructionsFn;
}

// ========================================
// Fonctions API Rebrickable
// ========================================

/**
 * Requête générique à l'API Rebrickable
 * @param {string} endpoint - Endpoint API
 * @param {string} apiKey - Clé API Rebrickable
 * @param {object} params - Paramètres de requête
 * @returns {Promise<object>} - Réponse JSON
 */
export async function rebrickableRequest(endpoint, apiKey, params = {}) {
  const url = new URL(`${REBRICKABLE_BASE_URL}${endpoint}`);
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  }
  
  log.debug(` Requête: ${url.toString()}`);
  
  const response = await fetchViaProxy(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `key ${apiKey}`,
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    log.error(` Erreur HTTP ${response.status}: ${errorText}`);
    
    if (response.status === 401) {
      throw new Error("Clé API Rebrickable invalide ou manquante");
    } else if (response.status === 404) {
      throw new Error("Set non trouvé");
    } else if (response.status === 429) {
      throw new Error("Limite de requêtes Rebrickable dépassée (rate limit)");
    }
    
    throw new Error(`Erreur Rebrickable: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

/**
 * Recherche des sets LEGO sur Rebrickable
 * @param {string} query - Terme de recherche
 * @param {string} apiKey - Clé API Rebrickable
 * @param {number} maxResults - Nombre max de résultats
 * @param {object} options - Options supplémentaires
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchRebrickable(query, apiKey, maxResults = REBRICKABLE_DEFAULT_MAX, options = {}) {
  const cacheKey = `rebrickable_search_${query}_${maxResults}_${JSON.stringify(options)}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(` Cache hit pour recherche: ${query}`);
    return cached;
  }
  
  metrics.sources.rebrickable = metrics.sources.rebrickable || { requests: 0, errors: 0 };
  metrics.sources.rebrickable.requests++;
  
  const params = {
    search: query,
    page_size: Math.min(maxResults, 1000),
    ordering: '-year',
    ...options
  };
  
  try {
    const data = await rebrickableRequest('/lego/sets/', apiKey, params);
    
    const result = {
      count: data.count || 0,
      next: data.next,
      previous: data.previous,
      sets: (data.results || []).map(set => ({
        set_num: set.set_num,
        name: set.name,
        year: set.year,
        theme_id: set.theme_id,
        num_parts: set.num_parts,
        set_img_url: set.set_img_url,
        set_url: set.set_url,
        last_modified_dt: set.last_modified_dt
      })),
      source: "rebrickable"
    };
    
    log.debug(` ✅ ${result.count} sets trouvés pour "${query}"`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.rebrickable.errors++;
    throw err;
  }
}

/**
 * Récupère les détails d'un set LEGO par son numéro
 * @param {string} setNum - Numéro du set (ex: "75192-1")
 * @param {string} apiKey - Clé API Rebrickable
 * @returns {Promise<object>} - Détails du set
 */
export async function getRebrickableSet(setNum, apiKey) {
  if (!setNum.includes('-')) {
    setNum = `${setNum}-1`;
  }
  
  const cacheKey = `rebrickable_set_${setNum}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(` Cache hit pour set: ${setNum}`);
    return cached;
  }
  
  metrics.sources.rebrickable = metrics.sources.rebrickable || { requests: 0, errors: 0 };
  metrics.sources.rebrickable.requests++;
  
  try {
    const data = await rebrickableRequest(`/lego/sets/${setNum}/`, apiKey);
    
    const result = {
      set_num: data.set_num,
      name: data.name,
      year: data.year,
      theme_id: data.theme_id,
      num_parts: data.num_parts,
      set_img_url: data.set_img_url,
      set_url: data.set_url,
      last_modified_dt: data.last_modified_dt,
      source: "rebrickable"
    };
    
    log.debug(` ✅ Set trouvé: ${result.name} (${result.set_num})`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.rebrickable.errors++;
    throw err;
  }
}

/**
 * Récupère les pièces d'un set LEGO
 * @param {string} setNum - Numéro du set
 * @param {string} apiKey - Clé API Rebrickable
 * @param {number} maxParts - Nombre max de pièces à retourner
 * @returns {Promise<object>} - Liste des pièces
 */
export async function getRebrickableSetParts(setNum, apiKey, maxParts = 500) {
  if (!setNum.includes('-')) {
    setNum = `${setNum}-1`;
  }
  
  const cacheKey = `rebrickable_parts_${setNum}_${maxParts}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(` Cache hit pour pièces: ${setNum}`);
    return cached;
  }
  
  metrics.sources.rebrickable = metrics.sources.rebrickable || { requests: 0, errors: 0 };
  metrics.sources.rebrickable.requests++;
  
  try {
    const data = await rebrickableRequest(`/lego/sets/${setNum}/parts/`, apiKey, {
      page_size: Math.min(maxParts, 1000)
    });
    
    const result = {
      set_num: setNum,
      count: data.count || 0,
      parts: (data.results || []).map(p => ({
        part_num: p.part?.part_num,
        name: p.part?.name,
        part_cat_id: p.part?.part_cat_id,
        part_url: p.part?.part_url,
        part_img_url: p.part?.part_img_url,
        color_id: p.color?.id,
        color_name: p.color?.name,
        color_rgb: p.color?.rgb,
        quantity: p.quantity,
        is_spare: p.is_spare,
        element_id: p.element_id
      })),
      source: "rebrickable"
    };
    
    log.debug(` ✅ ${result.count} pièces pour set ${setNum}`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.rebrickable.errors++;
    throw err;
  }
}

/**
 * Récupère les minifigs d'un set LEGO
 * @param {string} setNum - Numéro du set
 * @param {string} apiKey - Clé API Rebrickable
 * @returns {Promise<object>} - Liste des minifigs
 */
export async function getRebrickableSetMinifigs(setNum, apiKey) {
  if (!setNum.includes('-')) {
    setNum = `${setNum}-1`;
  }
  
  const cacheKey = `rebrickable_minifigs_${setNum}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(` Cache hit pour minifigs: ${setNum}`);
    return cached;
  }
  
  metrics.sources.rebrickable = metrics.sources.rebrickable || { requests: 0, errors: 0 };
  metrics.sources.rebrickable.requests++;
  
  try {
    const data = await rebrickableRequest(`/lego/sets/${setNum}/minifigs/`, apiKey);
    
    const result = {
      set_num: setNum,
      count: data.count || 0,
      minifigs: (data.results || []).map(m => ({
        fig_num: m.set_num,
        name: m.set_name,
        quantity: m.quantity,
        set_img_url: m.set_img_url
      })),
      source: "rebrickable"
    };
    
    log.debug(` ✅ ${result.count} minifigs pour set ${setNum}`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.rebrickable.errors++;
    throw err;
  }
}

/**
 * Récupère les thèmes LEGO disponibles
 * @param {string} apiKey - Clé API Rebrickable
 * @param {number|null} parentId - ID du thème parent (optionnel)
 * @returns {Promise<object>} - Liste des thèmes
 */
export async function getRebrickableThemes(apiKey, parentId = null) {
  const cacheKey = `rebrickable_themes_${parentId || 'all'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(` Cache hit pour thèmes`);
    return cached;
  }
  
  metrics.sources.rebrickable = metrics.sources.rebrickable || { requests: 0, errors: 0 };
  metrics.sources.rebrickable.requests++;
  
  try {
    const params = { page_size: 1000 };
    if (parentId) {
      params.parent_id = parentId;
    }
    
    const data = await rebrickableRequest('/lego/themes/', apiKey, params);
    
    const result = {
      count: data.count || 0,
      themes: (data.results || []).map(t => ({
        id: t.id,
        name: t.name,
        parent_id: t.parent_id
      })),
      source: "rebrickable"
    };
    
    log.debug(` ✅ ${result.count} thèmes récupérés`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.rebrickable.errors++;
    throw err;
  }
}

/**
 * Récupère les couleurs LEGO disponibles
 * @param {string} apiKey - Clé API Rebrickable
 * @returns {Promise<object>} - Liste des couleurs
 */
export async function getRebrickableColors(apiKey) {
  const cacheKey = 'rebrickable_colors';
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(` Cache hit pour couleurs`);
    return cached;
  }
  
  metrics.sources.rebrickable = metrics.sources.rebrickable || { requests: 0, errors: 0 };
  metrics.sources.rebrickable.requests++;
  
  try {
    const data = await rebrickableRequest('/lego/colors/', apiKey, { page_size: 500 });
    
    const result = {
      count: data.count || 0,
      colors: (data.results || []).map(c => ({
        id: c.id,
        name: c.name,
        rgb: c.rgb,
        is_trans: c.is_trans
      })),
      source: "rebrickable"
    };
    
    log.debug(` ✅ ${result.count} couleurs récupérées`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.rebrickable.errors++;
    throw err;
  }
}

// ========================================
// Utilitaires de conversion
// ========================================

/**
 * Convertit un ID LEGO en format Rebrickable
 * @param {string} legoId - ID LEGO (ex: "75192")
 * @returns {string|null} - ID Rebrickable (ex: "75192-1")
 */
export function legoIdToRebrickable(legoId) {
  if (!legoId) return null;
  const id = String(legoId).trim();
  if (id.includes('-')) return id;
  return `${id}-1`;
}

/**
 * Convertit un ID Rebrickable en format LEGO
 * @param {string} rebrickableId - ID Rebrickable (ex: "75192-1")
 * @returns {string|null} - ID LEGO (ex: "75192")
 */
export function rebrickableIdToLego(rebrickableId) {
  if (!rebrickableId) return null;
  const id = String(rebrickableId).trim();
  return id.replace(/-\d+$/, '');
}

/**
 * Détecte si une requête est un ID de set
 * @param {string} query - Requête
 * @returns {boolean}
 */
export function isSetNumber(query) {
  if (!query) return false;
  const q = String(query).trim();
  return /^\d{4,6}(-\d+)?$/.test(q);
}

/**
 * Récupère les infos complètes d'un set (avec pièces et minifigs)
 * @param {string} setNum - Numéro du set
 * @param {string} apiKey - Clé API Rebrickable
 * @param {object} options - Options
 * @returns {Promise<object>} - Set complet
 */
export async function getRebrickableSetFull(setNum, apiKey, options = {}) {
  const {
    includeParts = true,
    includeMinifigs = true,
    maxParts = 500
  } = options;
  
  if (!setNum.includes('-')) {
    setNum = `${setNum}-1`;
  }
  
  const cacheKey = `rebrickable_full_${setNum}_${includeParts}_${includeMinifigs}_${maxParts}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(` Cache hit pour set complet: ${setNum}`);
    return cached;
  }
  
  log.debug(` Récupération complète du set ${setNum}...`);
  
  const setData = await getRebrickableSet(setNum, apiKey);
  
  const result = {
    ...setData,
    minifigs: null,
    parts: null
  };
  
  const promises = [];
  
  if (includeMinifigs) {
    promises.push(
      getRebrickableSetMinifigs(setNum, apiKey)
        .then(data => { result.minifigs = data; })
        .catch(err => { 
          log.warn(` Erreur minifigs: ${err.message}`);
          result.minifigs = { count: 0, minifigs: [], error: err.message };
        })
    );
  }
  
  if (includeParts) {
    promises.push(
      getRebrickableSetParts(setNum, apiKey, maxParts)
        .then(data => { result.parts = data; })
        .catch(err => {
          log.warn(` Erreur parts: ${err.message}`);
          result.parts = { count: 0, parts: [], error: err.message };
        })
    );
  }
  
  await Promise.all(promises);
  
  log.debug(` ✅ Set complet: ${result.name}, ${result.minifigs?.count || 0} minifigs, ${result.parts?.count || 0} parts`);
  
  setCache(cacheKey, result);
  return result;
}

/**
 * Enrichit les données LEGO avec les infos Rebrickable
 * @param {object} legoData - Données LEGO
 * @param {string} apiKey - Clé API Rebrickable
 * @returns {Promise<object>} - Données enrichies
 */
export async function enrichLegoWithRebrickable(legoData, apiKey) {
  if (!apiKey || !legoData) return legoData;
  
  const productCode = legoData.productCode || legoData.id;
  if (!productCode) return legoData;
  
  const setNum = legoIdToRebrickable(productCode);
  
  log.debug(` Enrichissement LEGO ${productCode} avec Rebrickable...`);
  
  try {
    const [minifigsData, partsData] = await Promise.all([
      getRebrickableSetMinifigs(setNum, apiKey).catch(err => {
        log.warn(` Minifigs non trouvées: ${err.message}`);
        return null;
      }),
      getRebrickableSetParts(setNum, apiKey, 100).catch(err => {
        log.warn(` Parts non trouvées: ${err.message}`);
        return null;
      })
    ]);
    
    const enriched = {
      ...legoData,
      rebrickable: {
        set_num: setNum,
        minifigs: minifigsData ? {
          count: minifigsData.count,
          items: minifigsData.minifigs
        } : null,
        parts: partsData ? {
          count: partsData.count,
          sample: partsData.parts.slice(0, 20)
        } : null
      }
    };
    
    log.debug(` ✅ LEGO enrichi avec ${minifigsData?.count || 0} minifigs, ${partsData?.count || 0} parts`);
    return enriched;
    
  } catch (err) {
    log.warn(` Échec enrichissement: ${err.message}`);
    return legoData;
  }
}

/**
 * Enrichit les données Rebrickable avec les infos LEGO
 * @param {object} rebrickableData - Données Rebrickable
 * @param {string} lang - Langue/locale
 * @returns {Promise<object>} - Données enrichies
 */
export async function enrichRebrickableWithLego(rebrickableData, lang = DEFAULT_LOCALE) {
  if (!rebrickableData || !getProductDetails || !getBuildingInstructions) return rebrickableData;
  
  const setNum = rebrickableData.set_num;
  if (!setNum) return rebrickableData;
  
  const legoId = rebrickableIdToLego(setNum);
  
  log.debug(` Enrichissement Rebrickable ${setNum} avec LEGO...`);
  
  try {
    const instructions = await getBuildingInstructions(legoId, lang).catch(err => {
      log.warn(` Instructions non trouvées: ${err.message}`);
      return null;
    });
    
    const productDetails = await getProductDetails(legoId, lang).catch(err => {
      log.warn(` Détails produit non trouvés: ${err.message}`);
      return null;
    });
    
    const enriched = {
      ...rebrickableData,
      lego: {
        id: legoId,
        url: productDetails?.url || `https://www.lego.com/${lang.toLowerCase()}/product/${legoId}`,
        price: productDetails?.price || null,
        listPrice: productDetails?.listPrice || null,
        availability: productDetails?.availability || null,
        availabilityText: productDetails?.availabilityText || null,
        instructions: instructions ? {
          count: instructions.manuals?.length || 0,
          manuals: instructions.manuals || []
        } : null
      }
    };
    
    log.debug(` ✅ Rebrickable enrichi avec ${instructions?.manuals?.length || 0} manuels`);
    return enriched;
    
  } catch (err) {
    log.warn(` Échec enrichissement: ${err.message}`);
    return rebrickableData;
  }
}

/**
 * Recherche intelligente sur Rebrickable
 * @param {string} query - Requête de recherche
 * @param {string} apiKey - Clé API Rebrickable
 * @param {object} options - Options
 * @returns {Promise<object>} - Résultats
 */
export async function smartRebrickableSearch(query, apiKey, options = {}) {
  const {
    page = 1,
    pageSize = 20,
    enrichWithLego = false,
    lang = DEFAULT_LOCALE,
    ...searchOptions
  } = options;
  
  if (isSetNumber(query)) {
    log.debug(` Recherche par ID de set: ${query}`);
    
    let setData = await getRebrickableSetFull(query, apiKey, {
      includeParts: true,
      includeMinifigs: true,
      maxParts: options.maxParts || 500
    });
    
    if (enrichWithLego) {
      setData = await enrichRebrickableWithLego(setData, lang);
    }
    
    return {
      ...setData,
      type: 'set_id',
      lego_id: rebrickableIdToLego(setData.set_num)
    };
  }
  
  log.debug(` Recherche par texte: "${query}" (page ${page}, ${pageSize}/page)`);
  
  const cacheKey = `rebrickable_smart_${query}_${page}_${pageSize}_${JSON.stringify(searchOptions)}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(` Cache hit pour recherche smart: ${query}`);
    return cached;
  }
  
  metrics.sources.rebrickable = metrics.sources.rebrickable || { requests: 0, errors: 0 };
  metrics.sources.rebrickable.requests++;
  
  const params = {
    search: query,
    page: page,
    page_size: pageSize,
    ordering: '-year',
    ...searchOptions
  };
  
  try {
    const data = await rebrickableRequest('/lego/sets/', apiKey, params);
    
    const result = {
      query: query,
      type: 'text_search',
      pagination: {
        page: page,
        page_size: pageSize,
        total_count: data.count || 0,
        total_pages: Math.ceil((data.count || 0) / pageSize),
        has_next: !!data.next,
        has_previous: !!data.previous
      },
      sets: (data.results || []).map(set => ({
        set_num: set.set_num,
        lego_id: rebrickableIdToLego(set.set_num),
        name: set.name,
        year: set.year,
        theme_id: set.theme_id,
        num_parts: set.num_parts,
        set_img_url: set.set_img_url,
        set_url: set.set_url,
        last_modified_dt: set.last_modified_dt
      })),
      source: "rebrickable"
    };
    
    log.debug(` ✅ ${result.pagination.total_count} sets trouvés, page ${page}/${result.pagination.total_pages}`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.rebrickable.errors++;
    throw err;
  }
}

// ========================================
// Fonctions de normalisation v3.0.0
// ========================================

/**
 * Recherche Rebrickable avec retour normalisé v3.0.0
 * @param {string} query - Terme de recherche
 * @param {string} apiKey - Clé API Rebrickable
 * @param {number} maxResults - Nombre max de résultats
 * @param {object} options - Options supplémentaires
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function searchRebrickableNormalized(query, apiKey, maxResults = REBRICKABLE_DEFAULT_MAX, options = {}) {
  const raw = await searchRebrickable(query, apiKey, maxResults, options);
  
  return {
    results: (raw.sets || []).map(s => normalizeRebrickableSearch(s)),
    total: raw.count || 0,
    count: (raw.sets || []).length,
    query: query,
    source: 'rebrickable'
  };
}

/**
 * Détails set Rebrickable avec retour normalisé v3.0.0
 * Inclut automatiquement les pièces et minifigs
 * @param {string} setNum - Numéro du set
 * @param {string} apiKey - Clé API Rebrickable
 * @param {object} options - Options (includeParts, includeMinifigs, maxParts)
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getRebrickableSetNormalized(setNum, apiKey, options = {}) {
  const { includeParts = true, includeMinifigs = true, maxParts = 500 } = options;
  
  // Récupérer le set de base
  const rawSet = await getRebrickableSet(setNum, apiKey);
  
  // Enrichir avec pièces et minifigs si demandé
  const enriched = { ...rawSet };
  
  if (includeParts) {
    try {
      enriched.parts = await getRebrickableSetParts(setNum, apiKey, maxParts);
    } catch (e) {
      log.debug(`Impossible de récupérer les pièces: ${e.message}`);
      enriched.parts = { count: 0, parts: [] };
    }
  }
  
  if (includeMinifigs) {
    try {
      enriched.minifigs = await getRebrickableSetMinifigs(setNum, apiKey);
    } catch (e) {
      log.debug(`Impossible de récupérer les minifigs: ${e.message}`);
      enriched.minifigs = { count: 0, minifigs: [] };
    }
  }
  
  return normalizeRebrickableDetail(enriched);
}

// Export des fonctions de normalisation
export { normalizeRebrickableSearch, normalizeRebrickableDetail };
