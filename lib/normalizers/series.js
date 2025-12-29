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
import { extractRemoteId, buildExternalIds, extractImages, extractGenres } from './movie.js';

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
  // Extraire genres avec la fonction utilitaire
  const { genres, genres_original, genres_translated } = extractGenres(data);
  
  return {
    // === IDs (même ordre que movies) ===
    provider_id: String(data.id),
    imdb_id: data.externalIds?.imdb || null,
    tmdb_id: data.id,
    tvdb_id: data.externalIds?.tvdb || null,
    
    // === Titres ===
    title: data.title || data.name,
    original_title: data.originalTitle || data.originalName,
    tagline: data.tagline || null,
    
    // === Description ===
    description: data.overview || null,
    description_original: data.overviewOriginal || null,
    description_translated: data.overviewTranslated || null,
    
    // === Dates ===
    year: data.year,
    release_date: data.firstAirDate || null,
    runtime_minutes: data.runtimeMinutes || data.episodeRunTime?.[0] || null,
    
    // === Statut ===
    status: normalizeSeriesStatus(data.status, 'tmdb'),
    is_adult: data.adult || false,
    
    // === Images ===
    poster_url: data.poster || null,
    backdrop_url: data.backdrop || null,
    images: extractImages(data),
    trailers: (data.videos || []).map(v => v.url).filter(Boolean),
    
    // === Ratings ===
    rating_value: data.voteAverage || data.rating?.average || null,
    rating_count: data.voteCount || data.rating?.votes || null,
    popularity: data.popularity || null,
    metacritic_score: null,
    
    // === Genres & Keywords ===
    genres,
    genres_original,
    genres_translated,
    keywords: data.keywords || [],
    certifications: (data.contentRatings || []).map(c => ({
      country: c.country,
      rating: c.rating
    })),
    
    // === Langues & Pays ===
    original_language: data.originalLanguage || null,
    languages: data.languages || (data.spokenLanguages || []).map(l => l.code),
    countries: data.originCountry || (data.productionCountries || []).map(c => c.code),
    studios: (data.productionCompanies || []).map(c => c.name),
    
    // === Budget (non applicable aux séries) ===
    budget: null,
    revenue: null,
    box_office: null,
    
    // === Équipe ===
    directors: (data.createdBy || []).map(c => c.name),
    writers: [],
    cast: (data.cast || []).slice(0, 10).map(c => ({
      name: c.name,
      character: c.character || null,
      image_url: c.profile || null,
      order: c.order ?? null
    })),
    
    // === Collection (non applicable aux séries) ===
    collection: null,
    
    // === IDs externes ===
    external_ids: {
      imdb: data.externalIds?.imdb || null,
      tvdb: data.externalIds?.tvdb || null,
      facebook: data.externalIds?.facebook || null,
      instagram: data.externalIds?.instagram || null,
      twitter: data.externalIds?.twitter || null,
      wikidata: data.externalIds?.wikidata || null
    },
    
    // === Recommandations ===
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
    
    // === Source ===
    source_url: data.url || `https://www.themoviedb.org/tv/${data.id}`,
    source: 'tmdb',
    
    // === Champs spécifiques aux séries ===
    total_seasons: data.totalSeasons || data.numberOfSeasons || null,
    total_episodes: data.totalEpisodes || data.numberOfEpisodes || null,
    end_year: data.endYear || null,
    in_production: data.inProduction || false,
    networks: (data.networks || []).map(n => n.name)
  };
}

/**
 * Normalise les détails d'une série IMDB
 * @param {object} data - Données brutes IMDB
 * @returns {object}
 */
export function normalizeImdbSeriesDetail(data) {
  // Extraire genres avec la fonction utilitaire
  const { genres, genres_original, genres_translated } = extractGenres(data);
  
  // Extraire description avec support traduction
  const description = data.overview || data.plot || null;
  const descriptionOriginal = data.plotOriginal || null;
  const descriptionTranslated = data.plotTranslated === true ? description : null;
  
  // Extraire images
  const images = [];
  if (data.poster) {
    images.push({ type: 'poster', url: data.poster });
  }
  
  return {
    // === IDs (même ordre que movies) ===
    provider_id: data.id,
    imdb_id: data.id,
    tmdb_id: null,
    tvdb_id: null,
    
    // === Titres ===
    title: data.title,
    original_title: data.originalTitle || data.title,
    tagline: null,
    
    // === Description ===
    description,
    description_original: descriptionOriginal,
    description_translated: descriptionTranslated,
    
    // === Dates ===
    year: data.year,
    release_date: null,
    runtime_minutes: data.runtimeMinutes || null,
    
    // === Statut ===
    status: calculateImdbSeriesStatus(data),
    is_adult: data.isAdult || false,
    
    // === Images ===
    poster_url: data.poster || null,
    backdrop_url: null,
    images,
    trailers: [],
    
    // === Ratings ===
    rating_value: data.rating?.average || null,
    rating_count: data.rating?.votes || null,
    popularity: null,
    metacritic_score: data.metacritic?.score || null,
    
    // === Genres & Keywords ===
    genres,
    genres_original,
    genres_translated,
    keywords: (data.interests || [])
      .filter(i => !i.isSubgenre)
      .map(i => i.name),
    certifications: [],
    
    // === Langues & Pays ===
    original_language: null,
    languages: (data.spokenLanguages || []).map(l => l.code),
    countries: (data.originCountries || []).map(c => c.code),
    studios: [],
    
    // === Budget (non applicable aux séries) ===
    budget: null,
    revenue: null,
    box_office: null,
    
    // === Équipe ===
    directors: (data.directors || []).map(d => d.name),
    writers: (data.writers || []).map(w => w.name),
    cast: (data.stars || []).slice(0, 10).map((s, i) => ({
      name: s.name,
      character: null,
      image_url: s.image || null,
      order: i
    })),
    
    // === Collection (non applicable aux séries) ===
    collection: null,
    
    // === IDs externes ===
    external_ids: { imdb: data.id },
    
    // === Recommandations ===
    recommendations: [],
    similar: [],
    
    // === Source ===
    source_url: data.url || `https://www.imdb.com/title/${data.id}/`,
    source: 'imdb',
    
    // === Champs spécifiques aux séries ===
    total_seasons: data.totalSeasons || null,
    total_episodes: data.totalEpisodes || null,
    end_year: data.endYear || null,
    in_production: !data.endYear,
    networks: []
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
  
  // Extraire genres avec la fonction utilitaire
  const { genres, genres_original, genres_translated } = extractGenres(data);
  
  return {
    // === IDs (même ordre que movies) ===
    provider_id: String(data.id),
    imdb_id: imdbId,
    tmdb_id: tmdbId ? parseInt(tmdbId, 10) : null,
    tvdb_id: data.id,
    
    // === Titres ===
    title: data.title || data.name,
    original_title: data.originalTitle || data.originalName || data.name,
    tagline: null,
    
    // === Description ===
    description: data.overview || data.overviewTranslated || data.overviewOriginal || null,
    description_original: data.overviewOriginal || null,
    description_translated: data.overviewTranslated || null,
    
    // === Dates ===
    year: data.year ? parseInt(data.year, 10) : null,
    release_date: data.firstAired || null,
    runtime_minutes: data.averageRuntime || data.runtimeMinutes || null,
    
    // === Statut ===
    status: normalizeSeriesStatus(data.status, 'tvdb'),
    is_adult: false,
    
    // === Images ===
    poster_url: data.poster || data.image || null,
    backdrop_url: (data.artworks || []).find(a => a.type === 15 || a.type === '15')?.image || null,
    images: (data.artworks || []).slice(0, 10).map(a => ({
      type: String(a.type),
      url: a.image
    })),
    trailers: (data.trailers || []).map(t => t.url).filter(Boolean),
    
    // === Ratings ===
    rating_value: data.rating?.average || data.score || null,
    rating_count: data.rating?.votes || null,
    popularity: null,
    metacritic_score: null,
    
    // === Genres & Keywords ===
    genres,
    genres_original,
    genres_translated,
    keywords: [],
    certifications: (data.contentRatings || []).map(c => ({
      country: c.country,
      rating: c.contentRating?.name || c.rating
    })),
    
    // === Langues & Pays ===
    original_language: data.originalLanguage || null,
    languages: [],
    countries: data.originalCountry ? [data.originalCountry] : [],
    studios: (data.companies || [])
      .filter(c => c.companyType === 'Production' || c.companyType === 'Studio')
      .map(c => c.name),
    
    // === Budget (non applicable aux séries) ===
    budget: null,
    revenue: null,
    box_office: null,
    
    // === Équipe ===
    directors: (data.creators || []).map(c => c.personName || c.name),
    writers: [],
    cast: (data.cast || data.characters || [])
      .filter(c => c.peopleType === 'Actor' || c.type === 3 || (!c.peopleType && c.personName))
      .slice(0, 10)
      .map((c, i) => ({
        name: c.personName || c.name,
        character: c.name || c.character,
        image_url: c.image || null,
        order: c.sort ?? i
      })),
    
    // === Collection (non applicable aux séries) ===
    collection: null,
    
    // === IDs externes ===
    external_ids: buildExternalIds(data.remoteIds),
    
    // === Recommandations ===
    recommendations: [],
    similar: [],
    
    // === Source ===
    source_url: data.url || `https://thetvdb.com/series/${data.slug}`,
    source: 'tvdb',
    
    // === Champs spécifiques aux séries ===
    total_seasons: data.totalSeasons || null,
    total_episodes: data.totalEpisodes || null,
    end_year: data.endYear ? parseInt(data.endYear, 10) : null,
    in_production: data.status?.name === 'Continuing' || data.status === 'Continuing',
    networks: (() => {
      // Extraire les networks depuis plusieurs sources possibles
      const networks = [];
      
      // 1. originalNetwork et latestNetwork (prioritaires)
      if (data.originalNetwork?.name) {
        networks.push(data.originalNetwork.name);
      }
      if (data.latestNetwork?.name && data.latestNetwork.name !== data.originalNetwork?.name) {
        networks.push(data.latestNetwork.name);
      }
      
      // 2. Fallback sur companies avec companyType === 'Network'
      if (networks.length === 0 && data.companies?.length > 0) {
        const networkCompanies = data.companies
          .filter(c => c.companyType === 'Network')
          .map(c => c.name);
        networks.push(...networkCompanies);
      }
      
      return networks;
    })()
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
