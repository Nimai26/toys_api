/**
 * lib/providers/comicvine.js - Provider Comic Vine
 * 
 * API Comic Vine pour comics américains
 * Nécessite une clé API Comic Vine
 * 
 * @module providers/comicvine
 */

import { metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { fetchViaProxy } from '../utils/fetch-proxy.js';
import { translateText, translateGenres, extractLangCode } from '../utils/translator.js';
import { stripHtml } from '../utils/helpers.js';
import {
  COMICVINE_API_KEY,
  COMICVINE_BASE_URL,
  COMICVINE_DEFAULT_MAX,
  COMICVINE_MAX_LIMIT,
  USER_AGENT
} from '../config.js';
import {
  normalizeComicVineSearch,
  normalizeComicVineVolumeDetail,
  normalizeComicVineIssueDetail
} from '../normalizers/book.js';

const log = createLogger('ComicVine');

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur Comic Vine
 * @param {string} query - Terme de recherche
 * @param {string} apiKey - Clé API Comic Vine
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchComicVine(query, apiKey, options = {}) {
  metrics.sources.comicvine.requests++;
  
  // Utiliser la clé passée en paramètre ou celle de l'environnement
  const effectiveApiKey = apiKey || COMICVINE_API_KEY;
  if (!effectiveApiKey) {
    throw new Error("Comic Vine API key is required. Set COMICVINE_API_KEY or pass via X-Api-Key header.");
  }
  
  const max = Math.min(options.max || COMICVINE_DEFAULT_MAX, COMICVINE_MAX_LIMIT);
  const resourceType = options.type || 'volume'; // volume, issue, character, person
  
  const cacheKey = `comicvine_search_${resourceType}_${query}_${max}`;
  try {
    const params = new URLSearchParams({
      api_key: effectiveApiKey,
      format: 'json',
      query: query,
      resources: resourceType,
      limit: max.toString()
    });

    const url = `${COMICVINE_BASE_URL}/search/?${params.toString()}`;
    log.debug(`Recherche: ${query} (type: ${resourceType}, max: ${max})`);

    const response = await fetchViaProxy(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`Comic Vine API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error !== "OK") {
      throw new Error(`Comic Vine error: ${data.error}`);
    }

    const results = (data.results || []).map(item => {
      // Prendre uniquement l'image originale (meilleure qualité)
      const bestImage = item.image?.original_url || item.image?.medium_url || item.image?.thumb_url || null;
      const imageArray = bestImage ? [bestImage] : [];
      
      // Structure commune pour différents types de ressources
      const result = {
        id: item.id,
        type: item.resource_type,
        title: item.name,
        originalTitle: null,
        authors: [],
        editors: item.publisher ? [item.publisher.name] : [],
        releaseDate: item.cover_date || (item.start_year ? `${item.start_year}` : null),
        genres: [],
        pages: null,
        serie: item.volume ? { id: item.volume.id, name: item.volume.name } : null,
        synopsis: item.deck || null,
        language: 'en',
        tome: item.issue_number || null,
        image: imageArray,
        isbn: null,
        price: null,
        url: item.site_detail_url,
        source: 'comicvine'
      };

      // Champs spécifiques aux volumes
      if (item.resource_type === 'volume') {
        result.serie = { id: item.id, name: item.name };
        result.issueCount = item.count_of_issues;
      }

      // Champs spécifiques aux issues
      if (item.resource_type === 'issue') {
        result.tome = item.issue_number;
        result.releaseDate = item.cover_date || item.store_date || null;
      }

      // Champs spécifiques aux personnages
      if (item.resource_type === 'character') {
        result.realName = item.real_name;
      }

      return result;
    });

    const result = {
      query,
      resourceType,
      totalResults: data.number_of_total_results,
      pageResults: data.number_of_page_results,
      resultsCount: results.length,
      results,
      source: 'comicvine'
    };

    log.debug(`✅ ${results.length} résultats trouvés`);
    return result;

  } catch (err) {
    metrics.sources.comicvine.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS VOLUME
// ============================================================================

/**
 * Récupère les détails d'un volume Comic Vine par ID
 * @param {string|number} volumeId - ID du volume
 * @param {string} apiKey - Clé API Comic Vine
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails du volume
 */
export async function getComicVineVolume(volumeId, apiKey, options = {}) {
  metrics.sources.comicvine.requests++;
  
  // Utiliser la clé passée en paramètre ou celle de l'environnement
  const effectiveApiKey = apiKey || COMICVINE_API_KEY;
  if (!effectiveApiKey) {
    throw new Error("Comic Vine API key is required. Set COMICVINE_API_KEY or pass via X-Api-Key header.");
  }
  
  const { lang = null, autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `comicvine_volume_${volumeId}_${shouldTranslate ? 'trad_' + destLang : 'notrad'}`;
  try {
    const url = `${COMICVINE_BASE_URL}/volume/4050-${volumeId}/?api_key=${effectiveApiKey}&format=json`;
    log.debug(`Récupération volume ID: ${volumeId}`);

    const response = await fetchViaProxy(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`Comic Vine API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error !== "OK") {
      throw new Error(`Comic Vine error: ${data.error}`);
    }

    const item = data.results;
    if (!item) {
      return null;
    }

    // Prendre uniquement l'image originale (meilleure qualité)
    const bestImage = item.image?.original_url || item.image?.medium_url || item.image?.thumb_url || null;
    const imageArray = bestImage ? [bestImage] : [];
    
    // Extraire les auteurs depuis person_credits (pas "people")
    const authorsList = (item.person_credits || []).map(p => p.name);
    
    // Synopsis: préférer description (complet) sinon deck (court)
    // Nettoyer le HTML avant traitement
    const rawSynopsis = item.description || item.deck || null;
    const synopsisOriginal = stripHtml(rawSynopsis);
    
    // Applique la traduction si demandée
    let finalSynopsis = synopsisOriginal;
    let synopsisTranslated = null;
    
    if (shouldTranslate && destLang && synopsisOriginal) {
      const result = await translateText(synopsisOriginal, destLang, { enabled: true });
      if (result.translated) {
        finalSynopsis = result.text;
        synopsisTranslated = result.text;
      }
    }
    
    const result = {
      id: item.id,
      type: 'volume',
      title: item.name,
      originalTitle: null,
      authors: authorsList,
      editors: item.publisher ? [item.publisher.name] : [],
      releaseDate: item.start_year ? `${item.start_year}` : null,
      genres: [],
      pages: null,
      serie: { id: item.id, name: item.name },
      synopsis: finalSynopsis,
      synopsisOriginal: synopsisOriginal,
      synopsisTranslated: synopsisTranslated,
      language: 'en',
      tome: null,
      image: imageArray,
      isbn: null,
      price: null,
      issueCount: item.count_of_issues,
      url: item.site_detail_url,
      source: 'comicvine'
    };

    log.debug(`✅ Volume récupéré: ${result.title} (${result.issueCount} issues)`);
    return result;

  } catch (err) {
    metrics.sources.comicvine.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS ISSUE
// ============================================================================

/**
 * Récupère les détails d'un issue Comic Vine par ID
 * @param {string|number} issueId - ID de l'issue
 * @param {string} apiKey - Clé API Comic Vine
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails de l'issue
 */
export async function getComicVineIssue(issueId, apiKey, options = {}) {
  metrics.sources.comicvine.requests++;
  
  // Utiliser la clé passée en paramètre ou celle de l'environnement
  const effectiveApiKey = apiKey || COMICVINE_API_KEY;
  if (!effectiveApiKey) {
    throw new Error("Comic Vine API key is required. Set COMICVINE_API_KEY or pass via X-Api-Key header.");
  }
  
  const { lang = null, autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `comicvine_issue_${issueId}_${shouldTranslate ? 'trad_' + destLang : 'notrad'}`;
  try {
    const url = `${COMICVINE_BASE_URL}/issue/4000-${issueId}/?api_key=${effectiveApiKey}&format=json`;
    log.debug(`Récupération issue ID: ${issueId}`);

    const response = await fetchViaProxy(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`Comic Vine API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error !== "OK") {
      throw new Error(`Comic Vine error: ${data.error}`);
    }

    const item = data.results;
    if (!item) {
      return null;
    }

    // Prendre uniquement l'image originale (meilleure qualité)
    const bestImage = item.image?.original_url || item.image?.medium_url || item.image?.thumb_url || null;
    const imageArray = bestImage ? [bestImage] : [];
    
    // Extraire les auteurs depuis person_credits
    const authorsList = (item.person_credits || []).map(p => p.name);
    
    // Synopsis: préférer description (complet) sinon deck (court)
    // Nettoyer le HTML avant traitement
    const rawSynopsis = item.description || item.deck || null;
    const synopsisOriginal = stripHtml(rawSynopsis);
    
    // Applique la traduction si demandée
    let finalSynopsis = synopsisOriginal;
    let synopsisTranslated = null;
    
    if (shouldTranslate && destLang && synopsisOriginal) {
      const result = await translateText(synopsisOriginal, destLang, { enabled: true });
      if (result.translated) {
        finalSynopsis = result.text;
        synopsisTranslated = result.text;
      }
    }

    const result = {
      id: item.id,
      type: 'issue',
      title: item.name || (item.volume ? `${item.volume.name} #${item.issue_number}` : `Issue #${item.issue_number}`),
      originalTitle: null,
      authors: authorsList,
      editors: item.volume?.publisher ? [item.volume.publisher] : [],
      releaseDate: item.cover_date || item.store_date || null,
      genres: [],
      pages: null,
      serie: item.volume ? { id: item.volume.id, name: item.volume.name } : null,
      synopsis: finalSynopsis,
      synopsisOriginal: synopsisOriginal,
      synopsisTranslated: synopsisTranslated,
      language: 'en',
      tome: item.issue_number,
      image: imageArray,
      isbn: null,
      price: null,
      url: item.site_detail_url,
      source: 'comicvine'
    };

    log.debug(`✅ Issue récupéré: ${result.serie?.name} #${result.tome}`);
    return result;

  } catch (err) {
    metrics.sources.comicvine.errors++;
    throw err;
  }
}

// ============================================================================
// LISTE DES ISSUES D'UN VOLUME
// ============================================================================

/**
 * Récupère tous les issues d'un volume ComicVine
 * @param {string|number} volumeId - ID du volume
 * @param {string} apiKey - Clé API ComicVine
 * @param {object} options - Options
 * @returns {Promise<object>} - Liste des issues harmonisée
 */
export async function getComicVineIssues(volumeId, apiKey, options = {}) {
  metrics.sources.comicvine.requests++;
  
  const effectiveApiKey = apiKey || COMICVINE_API_KEY;
  if (!effectiveApiKey) {
    throw new Error("Comic Vine API key is required.");
  }

  const max = options.max || 100; // Limite par défaut
  const cacheKey = `comicvine_issues_${volumeId}_${max}`;

  try {
    const params = new URLSearchParams({
      api_key: effectiveApiKey,
      format: 'json',
      filter: `volume:${volumeId}`,
      field_list: 'id,name,issue_number,cover_date,store_date,description,deck,image,volume',
      limit: max.toString(),
      sort: 'cover_date:asc'
    });

    const url = `${COMICVINE_BASE_URL}/issues/?${params.toString()}`;
    log.debug(`Récupération issues du volume: ${volumeId}`);

    const response = await fetchViaProxy(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`Comic Vine API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error !== "OK") {
      throw new Error(`Comic Vine error: ${data.error}`);
    }

    // Transformer en format harmonisé
    const issues = (data.results || []).map(item => {
      const bestImage = item.image?.original_url || item.image?.medium_url || item.image?.thumb_url || null;
      
      return {
        id: item.id,
        number: item.issue_number,
        title: item.name || null,
        coverDate: item.cover_date || null,
        storeDate: item.store_date || null,
        synopsis: stripHtml(item.deck || item.description || null),
        image: bestImage,
        url: item.site_detail_url
      };
    });

    const result = {
      volumeId: parseInt(volumeId),
      volume: issues.length > 0 ? issues[0].volume : null,
      issues,
      totalIssues: data.number_of_total_results || issues.length,
      returnedCount: issues.length,
      source: 'comicvine'
    };

    log.debug(`✅ ${issues.length} issues récupérés pour volume ${volumeId}`);
    return result;

  } catch (err) {
    metrics.sources.comicvine.errors++;
    throw err;
  }
}

// ============================================================================
// FONCTIONS NORMALISÉES (v3.0)
// ============================================================================

/**
 * Recherche ComicVine avec résultats normalisés
 * @param {string} query - Requête de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<Array>} - Résultats normalisés
 */
export async function searchComicVineNormalized(query, options = {}) {
  const result = await searchComicVine(query, options);
  return (result.results || []).map(normalizeComicVineSearch);
}

/**
 * Récupère les détails d'un volume ComicVine normalisés
 * @param {string|number} volumeId - ID du volume
 * @param {string} apiKey - Clé API ComicVine
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getComicVineVolumeNormalized(volumeId, apiKey, options = {}) {
  const result = await getComicVineVolume(volumeId, apiKey, options);
  return normalizeComicVineVolumeDetail(result);
}

/**
 * Récupère les détails d'un issue ComicVine normalisés
 * @param {string|number} issueId - ID de l'issue
 * @param {string} apiKey - Clé API ComicVine
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getComicVineIssueNormalized(issueId, apiKey, options = {}) {
  const result = await getComicVineIssue(issueId, apiKey, options);
  return normalizeComicVineIssueDetail(result);
}
