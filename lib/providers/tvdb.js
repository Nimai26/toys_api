/**
 * lib/providers/tvdb.js - Provider TVDB
 * 
 * API TVDB pour recherche et détails de séries/films
 * Nécessite une clé API TVDB
 * 
 * @module providers/tvdb
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import {
  TVDB_BASE_URL,
  TVDB_DEFAULT_MAX,
  TVDB_MAX_LIMIT
} from '../config.js';

const log = createLogger('TVDB');

// ============================================================================
// CACHE GLOBAL POUR TOKENS TVDB
// ============================================================================

const tvdbTokenCache = {
  token: null,
  expiresAt: 0
};

// ============================================================================
// AUTHENTIFICATION
// ============================================================================

/**
 * Obtient un token d'accès TVDB
 * Token valide ~1 mois
 * @param {string} apiKey - Clé API TVDB
 * @returns {Promise<string>} - Token d'accès
 */
export async function getTvdbToken(apiKey) {
  if (tvdbTokenCache.token && Date.now() < tvdbTokenCache.expiresAt) {
    log.debug(`Utilisation du token en cache`);
    return tvdbTokenCache.token;
  }
  
  log.debug(`Obtention d'un nouveau token...`);
  
  try {
    const response = await fetch(`${TVDB_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ apikey: apiKey })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur login TVDB ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Le token TVDB est valide ~1 mois, on le cache pour 25 jours
    tvdbTokenCache.token = data.data.token;
    tvdbTokenCache.expiresAt = Date.now() + (25 * 24 * 60 * 60 * 1000);
    
    log.debug(`✅ Token obtenu, expire dans 25 jours`);
    return data.data.token;
    
  } catch (err) {
    log.error(`Erreur login:`, err.message);
    throw err;
  }
}

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur TVDB (séries, films, personnes, compagnies)
 * @param {string} query - Terme de recherche
 * @param {string} apiKey - Clé API TVDB
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchTvdb(query, apiKey, options = {}) {
  const {
    max = TVDB_DEFAULT_MAX,
    type = null,      // series, movie, person, company
    lang = null,      // Code langue (fra, eng, etc.)
    year = null       // Année de sortie
  } = options;
  
  const cacheKey = `tvdb_search_${query}_${max}_${type}_${lang}_${year}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: ${query}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Recherche: "${query}" (type: ${type || 'all'}, lang: ${lang || 'default'}, max: ${max})`);
  metrics.sources.tvdb.requests++;
  
  try {
    const token = await getTvdbToken(apiKey);
    
    const params = new URLSearchParams({ query });
    if (type) params.append('type', type);
    if (lang) params.append('language', lang);
    if (year) params.append('year', year);
    params.append('limit', Math.min(max, TVDB_MAX_LIMIT));
    
    const url = `${TVDB_BASE_URL}/search?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur TVDB ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    const results = (data.data || []).slice(0, max).map(item => ({
      id: item.tvdb_id || item.id,
      type: item.type || null,
      name: item.name || item.title,
      slug: item.slug,
      year: item.year || (item.first_air_time ? new Date(item.first_air_time).getFullYear() : null),
      overview: item.overview || null,
      overviews: item.overviews || null,
      primaryLanguage: item.primary_language || null,
      status: item.status || null,
      network: item.network || null,
      country: item.country || null,
      thumbnail: item.thumbnail || item.image_url || null,
      image: item.image || item.image_url || null,
      aliases: item.aliases || [],
      objectID: item.objectID,
      url: item.type === 'series' 
        ? `https://thetvdb.com/series/${item.slug}`
        : item.type === 'movie'
        ? `https://thetvdb.com/movies/${item.slug}`
        : `https://thetvdb.com/search?query=${encodeURIComponent(item.name || query)}`,
      source: "tvdb"
    }));
    
    const result = {
      query,
      type: type || 'all',
      total: results.length,
      results,
      source: "tvdb"
    };
    
    log.debug(`✅ ${results.length} résultat(s) trouvé(s)`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.tvdb.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS SÉRIE
// ============================================================================

/**
 * Récupère les détails d'une série TVDB par ID
 * @param {string|number} id - ID de la série
 * @param {string} apiKey - Clé API TVDB
 * @param {string} lang - Code langue (fra, eng, etc.)
 * @returns {Promise<object>} - Détails de la série
 */
export async function getTvdbSeriesById(id, apiKey, lang = null) {
  const cacheKey = `tvdb_series_${id}_${lang}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: series ${id}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Récupération série: ${id}`);
  metrics.sources.tvdb.requests++;
  
  try {
    const token = await getTvdbToken(apiKey);
    
    const url = `${TVDB_BASE_URL}/series/${id}/extended`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Série TVDB ${id} non trouvée`);
      }
      const errorText = await response.text();
      throw new Error(`Erreur TVDB ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const series = data.data;
    
    // Récupère les traductions si langue spécifiée
    let translations = null;
    if (lang) {
      try {
        const transResponse = await fetch(`${TVDB_BASE_URL}/series/${id}/translations/${lang}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (transResponse.ok) {
          const transData = await transResponse.json();
          translations = transData.data;
        }
      } catch (e) {
        log.debug(`Pas de traduction ${lang} pour série ${id}`);
      }
    }
    
    const result = {
      id: series.id,
      type: 'series',
      // Clés harmonisées (prioritaires)
      title: translations?.name || series.name,
      originalTitle: series.name,
      overview: translations?.overview || series.overview,
      year: series.year,
      endYear: series.lastAired ? new Date(series.lastAired).getFullYear() : null,
      status: series.status?.name || null,
      poster: series.image,
      rating: series.score ? { average: series.score, votes: null } : null,
      runtimeMinutes: series.averageRuntime || null,
      // Clés spécifiques TVDB (rétro-compatibilité)
      name: translations?.name || series.name,
      originalName: series.name,
      slug: series.slug,
      firstAired: series.firstAired,
      lastAired: series.lastAired,
      nextAired: series.nextAired,
      averageRuntime: series.averageRuntime,
      score: series.score,
      originalCountry: series.originalCountry,
      originalLanguage: series.originalLanguage,
      defaultSeasonType: series.defaultSeasonType,
      isOrderRandomized: series.isOrderRandomized,
      lastUpdated: series.lastUpdated,
      
      image: series.image,
      artworks: series.artworks?.slice(0, 20).map(a => ({
        id: a.id,
        type: a.type,
        image: a.image,
        thumbnail: a.thumbnail,
        language: a.language,
        score: a.score
      })) || [],
      
      genres: series.genres?.map(g => ({
        id: g.id,
        name: g.name,
        slug: g.slug
      })) || [],
      
      characters: series.characters?.slice(0, 30).map(c => ({
        id: c.id,
        name: c.name,
        peopleId: c.peopleId,
        personName: c.personName,
        image: c.image,
        type: c.type,
        sort: c.sort
      })) || [],
      
      // Infos saisons harmonisées avec IMDB
      totalSeasons: series.seasons?.filter(s => s.type?.name === 'Aired Order' || s.type?.id === 1).length || series.seasons?.length || 0,
      totalEpisodes: series.episodes?.length || null,
      
      companies: series.companies?.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        country: c.country,
        activeDate: c.activeDate,
        companyType: c.companyType?.name
      })) || [],
      
      remoteIds: series.remoteIds || [],
      trailers: series.trailers?.map(t => ({
        id: t.id,
        name: t.name,
        url: t.url,
        runtime: t.runtime,
        language: t.language
      })) || [],
      
      lists: series.lists?.slice(0, 10).map(l => ({
        id: l.id,
        name: l.name,
        overview: l.overview,
        url: l.url
      })) || [],
      
      contentRatings: series.contentRatings || [],
      
      url: `https://thetvdb.com/series/${series.slug}`,
      source: "tvdb"
    };
    
    log.debug(`✅ Série récupérée: ${result.name}`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.tvdb.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS FILM
// ============================================================================

/**
 * Récupère les détails d'un film TVDB par ID
 * @param {string|number} id - ID du film
 * @param {string} apiKey - Clé API TVDB
 * @param {string} lang - Code langue (fra, eng, etc.)
 * @returns {Promise<object>} - Détails du film
 */
export async function getTvdbMovieById(id, apiKey, lang = null) {
  const cacheKey = `tvdb_movie_${id}_${lang}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: movie ${id}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Récupération film: ${id}`);
  metrics.sources.tvdb.requests++;
  
  try {
    const token = await getTvdbToken(apiKey);
    
    const url = `${TVDB_BASE_URL}/movies/${id}/extended`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Film TVDB ${id} non trouvé`);
      }
      const errorText = await response.text();
      throw new Error(`Erreur TVDB ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const movie = data.data;
    
    // Récupère les traductions si langue spécifiée
    let translations = null;
    if (lang) {
      try {
        const transResponse = await fetch(`${TVDB_BASE_URL}/movies/${id}/translations/${lang}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (transResponse.ok) {
          const transData = await transResponse.json();
          translations = transData.data;
        }
      } catch (e) {
        log.debug(`Pas de traduction ${lang} pour film ${id}`);
      }
    }
    
    const result = {
      id: movie.id,
      type: 'movie',
      name: translations?.name || movie.name,
      originalName: movie.name,
      slug: movie.slug,
      overview: translations?.overview || movie.overview,
      year: movie.year,
      runtime: movie.runtime,
      score: movie.score,
      status: movie.status?.name || null,
      originalCountry: movie.originalCountry,
      originalLanguage: movie.originalLanguage,
      lastUpdated: movie.lastUpdated,
      
      releases: movie.releases?.map(r => ({
        country: r.country,
        date: r.date,
        detail: r.detail
      })) || [],
      
      image: movie.image,
      artworks: movie.artworks?.slice(0, 20).map(a => ({
        id: a.id,
        type: a.type,
        image: a.image,
        thumbnail: a.thumbnail,
        language: a.language,
        score: a.score
      })) || [],
      
      genres: movie.genres?.map(g => ({
        id: g.id,
        name: g.name,
        slug: g.slug
      })) || [],
      
      characters: movie.characters?.slice(0, 30).map(c => ({
        id: c.id,
        name: c.name,
        peopleId: c.peopleId,
        personName: c.personName,
        image: c.image,
        type: c.type
      })) || [],
      
      companies: movie.companies?.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        country: c.country,
        companyType: c.companyType?.name
      })) || [],
      
      boxOffice: movie.boxOffice,
      boxOfficeUS: movie.boxOfficeUS,
      budget: movie.budget,
      
      trailers: movie.trailers?.map(t => ({
        id: t.id,
        name: t.name,
        url: t.url,
        runtime: t.runtime,
        language: t.language
      })) || [],
      
      remoteIds: movie.remoteIds || [],
      contentRatings: movie.contentRatings || [],
      
      url: `https://thetvdb.com/movies/${movie.slug}`,
      source: "tvdb"
    };
    
    log.debug(`✅ Film récupéré: ${result.name}`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.tvdb.errors++;
    throw err;
  }
}
