/**
 * lib/normalizers/series.js - Normalisation des séries TV
 * 
 * Fonctions de normalisation pour les résultats des providers series:
 * - TMDB (The Movie Database)
 * - IMDB (via imdbapi.dev)
 * - TVDB (TheTVDB)
 * 
 * @module normalizers/series
 * @version 3.0.0
 */

// Import des utilitaires partagés depuis movie.js
import { extractRemoteId, buildExternalIds, extractImages } from './movie.js';

// Re-export pour usage externe
export { extractRemoteId, buildExternalIds };

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Normalise le statut d'une série
 * @param {string|object} status - Statut brut
 * @param {string} provider - Provider source
 * @returns {string|null}
 */
export function normalizeSeriesStatus(status, provider) {
  if (!status) return null;
  
  const statusStr = typeof status === 'string' ? status : status.name;
  
  const statusMap = {
    // TMDB
    'Returning Series': 'continuing',
    'Ended': 'ended',
    'Canceled': 'canceled',
    'Cancelled': 'canceled',
    'In Production': 'in_production',
    'Planned': 'planned',
    'Pilot': 'pilot',
    // TVDB
    'Continuing': 'continuing',
    'Upcoming': 'upcoming'
  };
  
  return statusMap[statusStr] || statusStr?.toLowerCase().replace(/\s+/g, '_') || null;
}

/**
 * Normalise le type de série
 * @param {string} type - Type brut
 * @param {string} provider - Provider source
 * @returns {string|null}
 */
export function normalizeSeriesType(type, provider) {
  if (!type) return null;
  
  const typeMap = {
    'Scripted': 'scripted',
    'Documentary': 'documentary',
    'Reality': 'reality',
    'Animation': 'animation',
    'Talk Show': 'talk_show',
    'Game Show': 'game_show',
    'News': 'news',
    'tvSeries': 'scripted',
    'tvMiniSeries': 'miniseries'
  };
  
  return typeMap[type] || type?.toLowerCase().replace(/\s+/g, '_') || null;
}

/**
 * Calcule le statut d'une série IMDB basé sur endYear
 * @param {object} data - Données IMDB
 * @returns {string}
 */
export function calculateImdbSeriesStatus(data) {
  if (data.status) return normalizeSeriesStatus(data.status, 'imdb');
  return data.endYear ? 'ended' : 'continuing';
}

// ============================================================================
// NORMALISATION RECHERCHE
// ============================================================================

/**
 * Normalise un résultat de recherche TMDB (série)
 * @param {object} item - Résultat brut
 * @returns {object}
 */
export function normalizeTmdbSearchResult(item) {
  return {
    provider_id: String(item.id),
    imdb_id: null,
    tmdb_id: item.id,
    title: item.title || item.name,
    original_title: item.originalTitle || item.originalName,
    description: item.overview || null,
    year: item.year,
    poster_url: item.poster || null,
    rating_value: item.voteAverage || null,
    rating_count: item.voteCount || null,
    popularity: item.popularity || null,
    genres: [],
    original_language: item.originalLanguage || null,
    countries: item.originCountry || [],
    is_adult: item.adult || false,
    source_url: item.url,
    source: 'tmdb'
  };
}

/**
 * Normalise un résultat de recherche IMDB (série)
 * @param {object} item - Résultat brut
 * @returns {object}
 */
export function normalizeImdbSearchResult(item) {
  return {
    provider_id: item.id,
    imdb_id: item.id,
    title: item.title,
    original_title: item.originalTitle,
    description: null,
    year: item.year,
    end_year: item.endYear || null,
    poster_url: item.poster || null,
    rating_value: item.rating?.average || null,
    rating_count: item.rating?.votes || null,
    popularity: null,
    genres: item.genres || [],
    original_language: null,
    is_adult: item.isAdult || false,
    source_url: item.url,
    source: 'imdb'
  };
}

/**
 * Normalise un résultat de recherche TVDB (série)
 * @param {object} item - Résultat brut
 * @returns {object}
 */
export function normalizeTvdbSearchResult(item) {
  return {
    provider_id: String(item.id),
    tvdb_id: item.id,
    title: item.name,
    original_title: item.name,
    description: item.overview || null,
    year: item.year,
    poster_url: item.thumbnail || item.image || null,
    rating_value: null,
    rating_count: null,
    popularity: null,
    genres: [],
    original_language: item.primaryLanguage || null,
    status: item.status || null,
    network: item.network || null,
    is_adult: false,
    source_url: item.url,
    source: 'tvdb'
  };
}

/**
 * Normalise une réponse de recherche TMDB complète (séries)
 * @param {object} response - Réponse brute
 * @returns {object}
 */
export function normalizeTmdbSearch(response) {
  return {
    query: response.query,
    total_results: response.totalResults || 0,
    page: response.page || 1,
    total_pages: response.totalPages || 1,
    results: (response.results || [])
      .filter(r => r.mediaType === 'tv')
      .map(normalizeTmdbSearchResult),
    source: 'tmdb'
  };
}

/**
 * Normalise une réponse de recherche IMDB complète (séries)
 * @param {object} response - Réponse brute
 * @returns {object}
 */
export function normalizeImdbSearch(response) {
  return {
    query: response.query,
    total_results: response.resultsCount || 0,
    results: (response.results || [])
      .filter(r => ['tvSeries', 'tvMiniSeries'].includes(r.type))
      .map(normalizeImdbSearchResult),
    source: 'imdb'
  };
}

/**
 * Normalise une réponse de recherche TVDB complète (séries)
 * @param {object} response - Réponse brute
 * @returns {object}
 */
export function normalizeTvdbSearch(response) {
  return {
    query: response.query,
    total_results: response.total || 0,
    results: (response.results || [])
      .filter(r => r.type === 'series')
      .map(normalizeTvdbSearchResult),
    source: 'tvdb'
  };
}

// ============================================================================
// NORMALISATION DÉTAILS
// ============================================================================

/**
 * Normalise les détails d'une série TMDB
 * @param {object} data - Données brutes TMDB
 * @returns {object}
 */
export function normalizeTmdbSeriesDetail(data) {
  return {
    provider_id: String(data.id),
    imdb_id: data.externalIds?.imdb || null,
    tmdb_id: data.id,
    tvdb_id: data.externalIds?.tvdb || null,
    title: data.title || data.name,
    original_title: data.originalTitle || data.originalName,
    tagline: data.tagline || null,
    description: data.overview || null,
    description_original: data.overviewOriginal || null,
    description_translated: data.overviewTranslated || null,
    year: data.year,
    end_year: data.endYear || null,
    first_air_date: data.firstAirDate || null,
    last_air_date: data.lastAirDate || null,
    status: normalizeSeriesStatus(data.status, 'tmdb'),
    series_type: normalizeSeriesType(data.tvType, 'tmdb'),
    in_production: data.inProduction || false,
    is_adult: data.adult || false,
    total_seasons: data.totalSeasons || data.numberOfSeasons || null,
    total_episodes: data.totalEpisodes || data.numberOfEpisodes || null,
    episode_runtime: data.runtimeMinutes || data.episodeRunTime?.[0] || null,
    seasons: (data.seasons || []).map(s => ({
      season_number: s.seasonNumber,
      name: s.name || null,
      episode_count: s.episodeCount || 0,
      air_date: s.airDate || null,
      poster_url: s.poster || null
    })),
    poster_url: data.poster || null,
    backdrop_url: data.backdrop || null,
    images: extractImages(data),
    trailers: (data.videos || []).map(v => v.url).filter(Boolean),
    rating_value: data.voteAverage || data.rating?.average || null,
    rating_count: data.voteCount || data.rating?.votes || null,
    popularity: data.popularity || null,
    metacritic_score: null,
    genres: data.genresTranslated || data.genres || data.genresOriginal || [],
    genres_original: data.genresOriginal || data.genres || [],
    genres_translated: data.genresTranslated || null,
    keywords: data.keywords || [],
    content_ratings: (data.contentRatings || []).map(c => ({
      country: c.country,
      rating: c.rating
    })),
    original_language: data.originalLanguage || null,
    languages: data.languages || (data.spokenLanguages || []).map(l => l.code),
    countries: data.originCountry || (data.productionCountries || []).map(c => c.code),
    networks: (data.networks || []).map(n => n.name),
    studios: (data.productionCompanies || []).map(c => c.name),
    creators: (data.createdBy || []).map(c => c.name),
    cast: (data.cast || []).slice(0, 10).map(c => ({
      name: c.name,
      character: c.character || null,
      image_url: c.profile || null,
      order: c.order ?? null
    })),
    external_ids: {
      imdb: data.externalIds?.imdb || null,
      tvdb: data.externalIds?.tvdb || null,
      facebook: data.externalIds?.facebook || null,
      instagram: data.externalIds?.instagram || null,
      twitter: data.externalIds?.twitter || null,
      wikidata: data.externalIds?.wikidata || null
    },
    recommendations: (data.recommendations || []).slice(0, 5).map(r => ({
      id: String(r.id),
      title: r.name || r.title,
      poster_url: r.poster || null
    })),
    similar: (data.similar || []).slice(0, 5).map(s => ({
      id: String(s.id),
      title: s.name || s.title,
      poster_url: s.poster || null
    })),
    source_url: data.url || `https://www.themoviedb.org/tv/${data.id}`,
    source: 'tmdb'
  };
}

/**
 * Normalise les détails d'une série IMDB
 * @param {object} data - Données brutes IMDB
 * @returns {object}
 */
export function normalizeImdbSeriesDetail(data) {
  return {
    provider_id: data.id,
    imdb_id: data.id,
    tmdb_id: null,
    tvdb_id: null,
    title: data.title,
    original_title: data.originalTitle || data.title,
    tagline: null,
    description: data.overview || data.plot || null,
    year: data.year,
    end_year: data.endYear || null,
    first_air_date: null,
    last_air_date: null,
    status: calculateImdbSeriesStatus(data),
    series_type: normalizeSeriesType(data.type, 'imdb'),
    in_production: !data.endYear,
    is_adult: data.isAdult || false,
    total_seasons: data.totalSeasons || null,
    total_episodes: data.totalEpisodes || null,
    episode_runtime: data.runtimeMinutes || null,
    seasons: [],
    poster_url: data.poster || null,
    backdrop_url: null,
    images: [],
    trailers: [],
    rating_value: data.rating?.average || null,
    rating_count: data.rating?.votes || null,
    popularity: null,
    metacritic_score: data.metacritic?.score || null,
    genres: data.genres || [],
    keywords: (data.interests || [])
      .filter(i => !i.isSubgenre)
      .map(i => i.name),
    content_ratings: [],
    original_language: null,
    languages: (data.spokenLanguages || []).map(l => l.code),
    countries: (data.originCountries || []).map(c => c.code),
    networks: [],
    studios: [],
    creators: (data.writers || []).map(w => w.name),
    cast: (data.stars || []).slice(0, 10).map((s, i) => ({
      name: s.name,
      character: null,
      image_url: s.image || null,
      order: i
    })),
    external_ids: { imdb: data.id },
    recommendations: [],
    similar: [],
    source_url: data.url || `https://www.imdb.com/title/${data.id}/`,
    source: 'imdb'
  };
}

/**
 * Normalise les détails d'une série TVDB
 * @param {object} data - Données brutes TVDB
 * @returns {object}
 */
export function normalizeTvdbSeriesDetail(data) {
  const imdbId = extractRemoteId(data.remoteIds, 'IMDB');
  const tmdbId = extractRemoteId(data.remoteIds, 'TheMovieDB.com') || 
                 extractRemoteId(data.remoteIds, 'themoviedb.com');
  
  return {
    provider_id: String(data.id),
    imdb_id: imdbId,
    tmdb_id: tmdbId ? parseInt(tmdbId, 10) : null,
    tvdb_id: data.id,
    title: data.title || data.name,
    original_title: data.originalTitle || data.originalName || data.name,
    tagline: null,
    description: data.overview || data.overviewTranslated || data.overviewOriginal || null,
    description_original: data.overviewOriginal || null,
    description_translated: data.overviewTranslated || null,
    year: data.year ? parseInt(data.year, 10) : null,
    end_year: data.endYear ? parseInt(data.endYear, 10) : null,
    first_air_date: data.firstAired || null,
    last_air_date: data.lastAired || null,
    status: normalizeSeriesStatus(data.status, 'tvdb'),
    series_type: null,
    in_production: data.status?.name === 'Continuing' || data.status === 'Continuing',
    is_adult: false,
    total_seasons: data.totalSeasons || null,
    total_episodes: data.totalEpisodes || null,
    episode_runtime: data.averageRuntime || data.runtimeMinutes || null,
    seasons: [],
    poster_url: data.poster || data.image || null,
    backdrop_url: (data.artworks || []).find(a => a.type === 15 || a.type === '15')?.image || null,
    images: (data.artworks || []).slice(0, 10).map(a => ({
      type: String(a.type),
      url: a.image
    })),
    trailers: (data.trailers || []).map(t => t.url).filter(Boolean),
    rating_value: data.rating?.average || data.score || null,
    rating_count: data.rating?.votes || null,
    popularity: null,
    metacritic_score: null,
    genres: data.genresTranslated || data.genres || data.genresOriginal || [],
    genres_original: data.genresOriginal || data.genres || [],
    genres_translated: data.genresTranslated || null,
    keywords: [],
    content_ratings: (data.contentRatings || []).map(c => ({
      country: c.country,
      rating: c.contentRating?.name || c.rating
    })),
    original_language: data.originalLanguage || null,
    languages: [],
    countries: data.originalCountry ? [data.originalCountry] : [],
    networks: (data.companies || [])
      .filter(c => c.companyType === 'Network')
      .map(c => c.name),
    studios: (data.companies || [])
      .filter(c => c.companyType === 'Production' || c.companyType === 'Studio')
      .map(c => c.name),
    // Creators comme TMDB: tableau de strings
    creators: (data.creators || []).map(c => c.personName || c.name),
    // Cast avec le même format que TMDB
    cast: (data.cast || data.characters || [])
      .filter(c => c.peopleType === 'Actor' || c.type === 3 || (!c.peopleType && c.personName))
      .slice(0, 10)
      .map((c, i) => ({
        name: c.personName || c.name,
        character: c.name || c.character,
        image_url: c.image || null,
        order: c.sort ?? i
      })),
    external_ids: buildExternalIds(data.remoteIds),
    recommendations: [],
    similar: [],
    source_url: data.url || `https://thetvdb.com/series/${data.slug}`,
    source: 'tvdb'
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Utilitaires
  normalizeSeriesStatus,
  normalizeSeriesType,
  calculateImdbSeriesStatus,
  extractRemoteId,
  buildExternalIds,
  // Recherche
  normalizeTmdbSearchResult,
  normalizeImdbSearchResult,
  normalizeTvdbSearchResult,
  normalizeTmdbSearch,
  normalizeImdbSearch,
  normalizeTvdbSearch,
  // Détails
  normalizeTmdbSeriesDetail,
  normalizeImdbSeriesDetail,
  normalizeTvdbSeriesDetail
};
