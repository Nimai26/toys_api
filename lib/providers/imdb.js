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

// Import des normalizers v3.0.0
import {
  normalizeImdbMovieSearch,
  normalizeImdbMovieDetail,
  normalizeImdbSeriesSearch,
  normalizeImdbSeriesDetail
} from '../normalizers/index.js';

const log = createLogger('IMDB');

// Fonction utilitaire pour retry avec délai exponentiel
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Si rate limited (429), attendre et réessayer
      if (response.status === 429) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          log.warn(`Rate limited (429), tentative ${attempt}/${maxRetries}, attente ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        log.warn(`Erreur réseau, tentative ${attempt}/${maxRetries}, attente ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError || new Error('Max retries exceeded');
}

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
    
    const response = await fetchWithRetry(url, {
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
// INFOS SÉRIES (saisons/épisodes)
// ============================================================================

/**
 * Récupère le nombre de saisons et d'épisodes pour une série TV
 * L'API imdbapi.dev limite à 20 épisodes par requête, donc on itère par saison
 * @param {string} titleId - ID IMDB de la série
 * @returns {Promise<object|null>} - {totalSeasons, totalEpisodes} ou null si erreur
 */
async function fetchSeriesInfo(titleId) {
  try {
    let totalEpisodes = 0;
    let currentSeason = 1;
    let maxEmptySeasons = 2; // Arrêter après 2 saisons vides consécutives
    let emptySeasons = 0;
    
    // Itérer sur les saisons jusqu'à ne plus trouver d'épisodes
    while (emptySeasons < maxEmptySeasons && currentSeason <= 50) { // Max 50 saisons par sécurité
      const url = `${IMDB_BASE_URL}/titles/${titleId}/episodes?season=${currentSeason}`;
      
      const response = await fetchWithRetry(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        emptySeasons++;
        currentSeason++;
        continue;
      }
      
      const data = await response.json();
      const episodes = data.episodes || [];
      
      // Filtrer pour ne garder que les épisodes de cette saison
      const seasonEpisodes = episodes.filter(ep => parseInt(ep.season) === currentSeason);
      
      if (seasonEpisodes.length === 0) {
        emptySeasons++;
      } else {
        emptySeasons = 0; // Reset si on trouve des épisodes
        totalEpisodes += seasonEpisodes.length;
      }
      
      currentSeason++;
    }
    
    const totalSeasons = currentSeason - 1 - emptySeasons;
    
    if (totalSeasons === 0) {
      return null;
    }
    
    log.debug(`Série ${titleId}: ${totalSeasons} saisons, ${totalEpisodes} épisodes`);
    
    return {
      totalSeasons,
      totalEpisodes
    };
    
  } catch (err) {
    log.debug(`Erreur récupération épisodes ${titleId}: ${err.message}`);
    return null;
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
    
    const response = await fetchWithRetry(url, {
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
    
    // Pour les séries TV, récupérer les infos de saisons/épisodes
    let seriesInfo = null;
    const isSeries = title.type === 'tvSeries' || title.type === 'tvMiniSeries';
    
    if (isSeries) {
      seriesInfo = await fetchSeriesInfo(titleId);
    }
    
    const result = {
      id: title.id,
      type: title.type,
      // Clés harmonisées
      title: title.primaryTitle,
      originalTitle: title.originalTitle || title.primaryTitle,
      overview: plot,
      year: title.startYear,
      endYear: title.endYear || null,
      status: isSeries ? (title.endYear ? 'Ended' : 'Continuing') : null,
      poster: title.primaryImage?.url || null,
      rating: title.rating ? { average: title.rating.aggregateRating, votes: title.rating.voteCount } : null,
      runtimeMinutes: title.runtimeSeconds ? Math.round(title.runtimeSeconds / 60) : null,
      isAdult: title.isAdult || false,
      
      // Infos spécifiques aux séries
      ...(isSeries && seriesInfo ? {
        totalSeasons: seriesInfo.totalSeasons,
        totalEpisodes: seriesInfo.totalEpisodes
      } : {}),
      
      metacritic: title.metacritic ? {
        score: title.metacritic.score,
        reviewCount: title.metacritic.reviewCount
      } : null,
      
      // Plot traduit SEULEMENT si autoTrad=1 (alias: overview)
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
    
    const response = await fetchWithRetry(url, {
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

// ============================================================================
// FONCTIONS NORMALISÉES v3.0.0
// ============================================================================

/**
 * Recherche IMDB avec résultats normalisés (films uniquement)
 * @param {string} query - Terme de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function searchImdbMovieNormalized(query, options = {}) {
  const result = await searchImdb(query, options);
  return normalizeImdbMovieSearch(result);
}

/**
 * Recherche IMDB avec résultats normalisés (séries uniquement)
 * @param {string} query - Terme de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function searchImdbSeriesNormalized(query, options = {}) {
  const result = await searchImdb(query, options);
  return normalizeImdbSeriesSearch(result);
}

/**
 * Détails titre IMDB normalisés (film)
 * @param {string} titleId - ID IMDB
 * @param {object} options - Options
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getImdbMovieByIdNormalized(titleId, options = {}) {
  const result = await getImdbTitleById(titleId, options);
  if (result.type !== 'movie') {
    throw new Error(`Le titre ${titleId} n'est pas un film (type: ${result.type})`);
  }
  return normalizeImdbMovieDetail(result);
}

/**
 * Détails titre IMDB normalisés (série)
 * @param {string} titleId - ID IMDB
 * @param {object} options - Options
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getImdbSeriesByIdNormalized(titleId, options = {}) {
  const result = await getImdbTitleById(titleId, options);
  if (!['tvSeries', 'tvMiniSeries'].includes(result.type)) {
    throw new Error(`Le titre ${titleId} n'est pas une série (type: ${result.type})`);
  }
  return normalizeImdbSeriesDetail(result);
}
