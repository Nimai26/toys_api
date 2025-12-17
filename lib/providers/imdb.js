/**
 * lib/providers/imdb.js - Provider IMDB
 * 
 * API IMDB via imdbapi.dev (gratuit, sans clé API)
 * Traduction automatique du plot via auto_trad
 * 
 * @module providers/imdb
 */

import { getCached, setCache, metrics, translateText, isAutoTradEnabled, extractLangCode, translateGenres } from '../utils/index.js';
import { createLogger } from '../utils/logger.js';
import {
  IMDB_BASE_URL,
  IMDB_DEFAULT_MAX,
  IMDB_MAX_LIMIT
} from '../config.js';

const log = createLogger('IMDB');

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche de titres sur IMDB via imdbapi.dev
 * @param {string} query - Terme de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchImdb(query, options = {}) {
  const {
    max = IMDB_DEFAULT_MAX
  } = options;
  
  const limit = Math.min(max, IMDB_MAX_LIMIT);
  
  const cacheKey = `imdb_search_${query}_${limit}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: ${query}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Recherche: "${query}" (limit: ${limit})`);
  metrics.sources.imdb.requests++;
  
  try {
    const params = new URLSearchParams({
      query: query,
      limit: limit
    });
    
    const url = `${IMDB_BASE_URL}/search/titles?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur IMDB ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    const results = (data.titles || []).map(item => ({
      id: item.id,
      type: item.type,
      title: item.primaryTitle,
      originalTitle: item.originalTitle,
      year: item.startYear,
      endYear: item.endYear || null,
      runtimeMinutes: item.runtimeSeconds ? Math.round(item.runtimeSeconds / 60) : null,
      genres: item.genres || [],
      rating: item.rating ? {
        average: item.rating.aggregateRating,
        votes: item.rating.voteCount
      } : null,
      poster: item.primaryImage?.url || null,
      posterWidth: item.primaryImage?.width || null,
      posterHeight: item.primaryImage?.height || null,
      isAdult: item.isAdult || false,
      url: `https://www.imdb.com/title/${item.id}/`,
      source: "imdb"
    }));
    
    const result = {
      query,
      resultsCount: results.length,
      results,
      source: "imdb"
    };
    
    log.debug(`✅ ${results.length} résultat(s) trouvé(s)`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.imdb.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS
// ============================================================================

/**
 * Récupère les détails d'un titre IMDB par ID
 * @param {string} titleId - ID IMDB (format: tt1234567)
 * @param {object} options - Options (lang: langue, autoTrad: activer traduction)
 * @returns {Promise<object>} - Détails du titre
 */
export async function getImdbTitleById(titleId, options = {}) {
  const { lang = 'en', autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  // Cache inclut la langue ET le flag autoTrad
  const cacheKey = `imdb_title_${titleId}_${destLang}_${shouldTranslate ? 'trad' : 'notrad'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: title ${titleId} (${destLang}, autoTrad=${shouldTranslate})`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Récupération titre: ${titleId} (lang: ${destLang}, autoTrad: ${shouldTranslate})`);
  metrics.sources.imdb.requests++;
  
  try {
    const url = `${IMDB_BASE_URL}/titles/${titleId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      if (response.status === 404 || response.status === 5) {
        throw new Error(`Titre IMDB ${titleId} non trouvé`);
      }
      const errorText = await response.text();
      throw new Error(`Erreur IMDB ${response.status}: ${errorText}`);
    }
    
    const title = await response.json();
    
    if (title.code === 5 || title.message === 'Not Found') {
      throw new Error(`Titre IMDB ${titleId} non trouvé`);
    }
    
    // Traduction du plot si activée
    let plot = title.plot || null;
    let plotOriginal = null;
    let plotTranslated = false;
    
    if (title.plot && shouldTranslate) {
      const translation = await translateText(title.plot, destLang, { enabled: true });
      if (translation.translated) {
        plotOriginal = title.plot;
        plot = translation.text;
        plotTranslated = true;
      }
    }
    
    // Traduction des genres si activée (approche hybride : dictionnaire + API)
    const genresData = shouldTranslate 
      ? await translateGenres(title.genres || [], destLang)
      : { genres: title.genres || [], genresOriginal: undefined, genresTranslated: false };
    
    const result = {
      id: title.id,
      type: title.type,
      title: title.primaryTitle,
      originalTitle: title.originalTitle || title.primaryTitle,
      year: title.startYear,
      endYear: title.endYear || null,
      runtimeMinutes: title.runtimeSeconds ? Math.round(title.runtimeSeconds / 60) : null,
      isAdult: title.isAdult || false,
      
      rating: title.rating ? {
        average: title.rating.aggregateRating,
        votes: title.rating.voteCount
      } : null,
      
      metacritic: title.metacritic ? {
        score: title.metacritic.score,
        reviewCount: title.metacritic.reviewCount
      } : null,
      
      // Plot traduit SEULEMENT si autoTrad=1
      plot,
      plotOriginal: plotTranslated ? plotOriginal : undefined,
      plotTranslated,
      
      // Genres traduits SEULEMENT si autoTrad=1
      genres: genresData.genres,
      genresOriginal: genresData.genresOriginal,
      genresTranslated: genresData.genresTranslated,
      
      poster: title.primaryImage?.url || null,
      posterWidth: title.primaryImage?.width || null,
      posterHeight: title.primaryImage?.height || null,
      
      directors: (title.directors || []).map(d => ({
        id: d.id,
        name: d.displayName,
        alternativeNames: d.alternativeNames || [],
        image: d.primaryImage?.url || null,
        professions: d.primaryProfessions || []
      })),
      
      writers: (title.writers || []).map(w => ({
        id: w.id,
        name: w.displayName,
        alternativeNames: w.alternativeNames || [],
        image: w.primaryImage?.url || null,
        professions: w.primaryProfessions || []
      })),
      
      stars: (title.stars || []).map(s => ({
        id: s.id,
        name: s.displayName,
        alternativeNames: s.alternativeNames || [],
        image: s.primaryImage?.url || null,
        professions: s.primaryProfessions || []
      })),
      
      originCountries: (title.originCountries || []).map(c => ({
        code: c.code,
        name: c.name
      })),
      
      spokenLanguages: (title.spokenLanguages || []).map(l => ({
        code: l.code,
        name: l.name
      })),
      
      interests: (title.interests || []).filter(i => !i.isSubgenre).map(i => ({
        id: i.id,
        name: i.name
      })),
      subgenres: (title.interests || []).filter(i => i.isSubgenre).map(i => ({
        id: i.id,
        name: i.name
      })),
      
      url: `https://www.imdb.com/title/${title.id}/`,
      source: "imdb"
    };
    
    log.debug(`✅ Titre récupéré: ${result.title}`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.imdb.errors++;
    throw err;
  }
}

// ============================================================================
// BROWSE
// ============================================================================

/**
 * Liste/Browse des titres IMDB avec filtres
 * @param {object} options - Options de filtrage
 * @returns {Promise<object>} - Liste de titres
 */
export async function browseImdbTitles(options = {}) {
  const {
    types = [],
    genres = [],
    startYear = null,
    endYear = null,
    minRating = null,
    maxRating = null,
    sortBy = 'SORT_BY_POPULARITY',
    sortOrder = 'DESC',
    pageToken = null,
    limit = IMDB_DEFAULT_MAX
  } = options;
  
  const cacheKey = `imdb_browse_${types.join(',')}_${genres.join(',')}_${startYear}_${endYear}_${minRating}_${maxRating}_${sortBy}_${sortOrder}_${pageToken}_${limit}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: browse`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Browse titles: types=${types.join(',')}, genres=${genres.join(',')}, years=${startYear}-${endYear}`);
  metrics.sources.imdb.requests++;
  
  try {
    const params = new URLSearchParams();
    
    if (types.length > 0) {
      types.forEach(t => params.append('types', t));
    }
    
    if (genres.length > 0) {
      genres.forEach(g => params.append('genres', g));
    }
    
    if (startYear) params.append('startYear', startYear);
    if (endYear) params.append('endYear', endYear);
    
    if (minRating !== null) params.append('minAggregateRating', minRating);
    if (maxRating !== null) params.append('maxAggregateRating', maxRating);
    
    params.append('sortBy', sortBy);
    params.append('sortOrder', sortOrder);
    
    if (pageToken) params.append('pageToken', pageToken);
    
    const url = `${IMDB_BASE_URL}/titles?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur IMDB ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    const titles = (data.titles || []).slice(0, limit);
    
    const results = titles.map(item => ({
      id: item.id,
      type: item.type,
      title: item.primaryTitle,
      originalTitle: item.originalTitle,
      year: item.startYear,
      endYear: item.endYear || null,
      runtimeMinutes: item.runtimeSeconds ? Math.round(item.runtimeSeconds / 60) : null,
      genres: item.genres || [],
      rating: item.rating ? {
        average: item.rating.aggregateRating,
        votes: item.rating.voteCount
      } : null,
      plot: item.plot || null,
      poster: item.primaryImage?.url || null,
      isAdult: item.isAdult || false,
      url: `https://www.imdb.com/title/${item.id}/`,
      source: "imdb"
    }));
    
    const result = {
      filters: {
        types: types.length > 0 ? types : 'all',
        genres: genres.length > 0 ? genres : 'all',
        years: {
          start: startYear || 'any',
          end: endYear || 'any'
        },
        rating: {
          min: minRating || 'any',
          max: maxRating || 'any'
        },
        sortBy,
        sortOrder
      },
      totalCount: data.totalCount || null,
      resultsCount: results.length,
      nextPageToken: data.nextPageToken || null,
      results,
      source: "imdb"
    };
    
    log.debug(`✅ ${results.length} titre(s) trouvé(s) sur ${data.totalCount || '?'} total`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.imdb.errors++;
    throw err;
  }
}
