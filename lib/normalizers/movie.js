/**
 * lib/normalizers/movie.js - Normalisation des films
 * 
 * Fonctions de normalisation pour les résultats des providers movie:
 * - TMDB (The Movie Database)
 * - IMDB (via imdbapi.dev)
 * - TVDB (TheTVDB)
 * 
 * @module normalizers/movie
 * @version 3.0.0
 */

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Normalise le statut d'un film
 * @param {string|object} status - Statut brut
 * @param {string} provider - Provider source
 * @returns {string|null}
 */
export function normalizeMovieStatus(status, provider) {
  if (!status) return null;
  
  const statusStr = typeof status === 'string' ? status : status.name;
  
  const statusMap = {
    'Released': 'released',
    'Post Production': 'post_production',
    'In Production': 'in_production',
    'Planned': 'planned',
    'Rumored': 'rumored',
    'Canceled': 'canceled',
    'Cancelled': 'canceled'
  };
  
  return statusMap[statusStr] || statusStr?.toLowerCase().replace(/\s+/g, '_') || null;
}

/**
 * Extrait un ID distant depuis un tableau remoteIds TVDB
 * @param {Array} remoteIds - Tableau des IDs distants
 * @param {string} sourceName - Nom de la source (IMDB, TMDB, etc.)
 * @returns {string|null}
 */
export function extractRemoteId(remoteIds, sourceName) {
  if (!Array.isArray(remoteIds)) return null;
  const remote = remoteIds.find(r => 
    r.sourceName?.toLowerCase() === sourceName.toLowerCase()
  );
  return remote?.id || null;
}

/**
 * Construit un objet d'IDs externes depuis remoteIds TVDB
 * @param {Array} remoteIds - Tableau des IDs distants
 * @returns {object}
 */
export function buildExternalIds(remoteIds) {
  const ids = {};
  if (!Array.isArray(remoteIds)) return ids;
  
  for (const r of remoteIds) {
    if (r.sourceName && r.id) {
      ids[r.sourceName.toLowerCase()] = r.id;
    }
  }
  return ids;
}

/**
 * Extrait les images d'un objet de données
 * @param {object} data - Données du provider
 * @returns {Array}
 */
export function extractImages(data) {
  const images = [];
  
  // TMDB: posters et backdrops additionnels
  if (data.posterOriginal && data.posterOriginal !== data.poster) {
    images.push({ type: 'poster_original', url: data.posterOriginal });
  }
  if (data.backdropOriginal && data.backdropOriginal !== data.backdrop) {
    images.push({ type: 'backdrop_original', url: data.backdropOriginal });
  }
  
  // TVDB: artworks
  if (Array.isArray(data.artworks)) {
    for (const a of data.artworks.slice(0, 10)) {
      images.push({ type: String(a.type), url: a.image });
    }
  }
  
  return images;
}

// ============================================================================
// NORMALISATION RECHERCHE
// ============================================================================

/**
 * Normalise un résultat de recherche TMDB (film)
 * @param {object} item - Résultat brut
 * @returns {object}
 */
export function normalizeTmdbSearchResult(item) {
  return {
    provider_id: String(item.id),
    imdb_id: null, // Non disponible en recherche
    tmdb_id: item.id,
    title: item.title,
    original_title: item.originalTitle,
    description: item.overview || null,
    year: item.year,
    release_date: item.releaseDate || null,
    poster_url: item.poster || null,
    rating_value: item.voteAverage || null,
    rating_count: item.voteCount || null,
    popularity: item.popularity || null,
    genres: [], // IDs seulement en recherche
    original_language: item.originalLanguage || null,
    is_adult: item.adult || false,
    source_url: item.url,
    source: 'tmdb'
  };
}

/**
 * Normalise un résultat de recherche IMDB (film)
 * @param {object} item - Résultat brut
 * @returns {object}
 */
export function normalizeImdbSearchResult(item) {
  return {
    provider_id: item.id,
    imdb_id: item.id,
    title: item.title,
    original_title: item.originalTitle,
    description: null, // Non disponible en recherche
    year: item.year,
    release_date: null,
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
 * Normalise un résultat de recherche TVDB (film)
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
    release_date: null,
    poster_url: item.thumbnail || item.image || null,
    rating_value: null, // Non disponible en recherche
    rating_count: null,
    popularity: null,
    genres: [],
    original_language: item.primaryLanguage || null,
    is_adult: false,
    source_url: item.url,
    source: 'tvdb'
  };
}

/**
 * Normalise une réponse de recherche TMDB complète
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
      .filter(r => r.mediaType === 'movie')
      .map(normalizeTmdbSearchResult),
    source: 'tmdb'
  };
}

/**
 * Normalise une réponse de recherche IMDB complète
 * @param {object} response - Réponse brute
 * @returns {object}
 */
export function normalizeImdbSearch(response) {
  return {
    query: response.query,
    total_results: response.resultsCount || 0,
    results: (response.results || [])
      .filter(r => r.type === 'movie')
      .map(normalizeImdbSearchResult),
    source: 'imdb'
  };
}

/**
 * Normalise une réponse de recherche TVDB complète
 * @param {object} response - Réponse brute
 * @returns {object}
 */
export function normalizeTvdbSearch(response) {
  return {
    query: response.query,
    total_results: response.total || 0,
    results: (response.results || [])
      .filter(r => r.type === 'movie')
      .map(normalizeTvdbSearchResult),
    source: 'tvdb'
  };
}

// ============================================================================
// NORMALISATION DÉTAILS
// ============================================================================

/**
 * Normalise les détails d'un film TMDB
 * @param {object} data - Données brutes TMDB
 * @returns {object}
 */
export function normalizeTmdbMovieDetail(data) {
  return {
    provider_id: String(data.id),
    imdb_id: data.imdbId || data.externalIds?.imdb || null,
    tmdb_id: data.id,
    tvdb_id: null,
    title: data.title,
    original_title: data.originalTitle,
    tagline: data.tagline || null,
    description: data.overview || null,
    year: data.year,
    release_date: data.releaseDate || null,
    runtime_minutes: data.runtimeMinutes || data.runtime || null,
    status: normalizeMovieStatus(data.status, 'tmdb'),
    is_adult: data.adult || false,
    poster_url: data.poster || null,
    backdrop_url: data.backdrop || null,
    images: extractImages(data),
    trailers: (data.videos || []).map(v => v.url).filter(Boolean),
    rating_value: data.voteAverage || data.rating?.average || null,
    rating_count: data.voteCount || data.rating?.votes || null,
    popularity: data.popularity || null,
    metacritic_score: null,
    genres: data.genres || data.genresOriginal || [],
    keywords: data.keywords || [],
    certifications: (data.certifications || []).map(c => ({
      country: c.country,
      rating: c.certification || c.rating
    })),
    original_language: data.originalLanguage || null,
    languages: (data.spokenLanguages || []).map(l => l.code),
    countries: (data.productionCountries || []).map(c => c.code),
    studios: (data.productionCompanies || []).map(c => c.name),
    budget: data.budget || null,
    revenue: data.revenue || null,
    box_office: null,
    directors: (data.crew || [])
      .filter(c => c.job === 'Director')
      .map(c => c.name),
    writers: (data.crew || [])
      .filter(c => ['Writer', 'Screenplay', 'Story'].includes(c.job))
      .map(c => c.name),
    cast: (data.cast || []).slice(0, 10).map(c => ({
      name: c.name,
      character: c.character || null,
      image_url: c.profile || null,
      order: c.order ?? null
    })),
    collection: data.belongsToCollection ? {
      id: data.belongsToCollection.id,
      name: data.belongsToCollection.name,
      poster_url: data.belongsToCollection.poster || null
    } : null,
    external_ids: {
      imdb: data.imdbId || data.externalIds?.imdb || null,
      facebook: data.externalIds?.facebook || null,
      instagram: data.externalIds?.instagram || null,
      twitter: data.externalIds?.twitter || null,
      wikidata: data.externalIds?.wikidata || null
    },
    recommendations: (data.recommendations || []).slice(0, 5).map(r => ({
      id: String(r.id),
      title: r.title,
      poster_url: r.poster || null
    })),
    similar: (data.similar || []).slice(0, 5).map(s => ({
      id: String(s.id),
      title: s.title,
      poster_url: s.poster || null
    })),
    source_url: data.url || `https://www.themoviedb.org/movie/${data.id}`,
    source: 'tmdb'
  };
}

/**
 * Normalise les détails d'un film IMDB
 * @param {object} data - Données brutes IMDB
 * @returns {object}
 */
export function normalizeImdbMovieDetail(data) {
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
    release_date: null,
    runtime_minutes: data.runtimeMinutes || null,
    status: null,
    is_adult: data.isAdult || false,
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
    certifications: [],
    original_language: null,
    languages: (data.spokenLanguages || []).map(l => l.code),
    countries: (data.originCountries || []).map(c => c.code),
    studios: [],
    budget: null,
    revenue: null,
    box_office: null,
    directors: (data.directors || []).map(d => d.name),
    writers: (data.writers || []).map(w => w.name),
    cast: (data.stars || []).slice(0, 10).map((s, i) => ({
      name: s.name,
      character: null,
      image_url: s.image || null,
      order: i
    })),
    collection: null,
    external_ids: { imdb: data.id },
    recommendations: [],
    similar: [],
    source_url: data.url || `https://www.imdb.com/title/${data.id}/`,
    source: 'imdb'
  };
}

/**
 * Normalise les détails d'un film TVDB
 * @param {object} data - Données brutes TVDB
 * @returns {object}
 */
export function normalizeTvdbMovieDetail(data) {
  const imdbId = extractRemoteId(data.remoteIds, 'IMDB');
  
  return {
    provider_id: String(data.id),
    imdb_id: imdbId,
    tmdb_id: null,
    tvdb_id: data.id,
    title: data.title || data.name,
    original_title: data.originalTitle || data.originalName || data.name,
    tagline: null,
    description: data.overview || null,
    year: data.year,
    release_date: data.releases?.[0]?.date || null,
    runtime_minutes: data.runtimeMinutes || data.runtime || null,
    status: normalizeMovieStatus(data.status, 'tvdb'),
    is_adult: false,
    poster_url: data.poster || data.image || null,
    backdrop_url: null,
    images: (data.artworks || []).slice(0, 10).map(a => ({
      type: String(a.type),
      url: a.image
    })),
    trailers: (data.trailers || []).map(t => t.url).filter(Boolean),
    rating_value: data.rating?.average || data.score || null,
    rating_count: data.rating?.votes || null,
    popularity: null,
    metacritic_score: null,
    genres: data.genres || [],
    keywords: [],
    certifications: (data.contentRatings || []).map(c => ({
      country: c.country,
      rating: c.contentRating?.name || c.rating
    })),
    original_language: data.originalLanguage || null,
    languages: [],
    countries: data.originalCountry ? [data.originalCountry] : [],
    studios: (data.companies || [])
      .filter(c => c.companyType === 'Production')
      .map(c => c.name),
    budget: data.budget || null,
    revenue: data.boxOffice || null,
    box_office: data.boxOffice || data.boxOfficeUS || null,
    directors: [],
    writers: [],
    cast: (data.characters || [])
      .filter(c => c.type === 3)
      .slice(0, 10)
      .map((c, i) => ({
        name: c.personName,
        character: c.name,
        image_url: c.image || null,
        order: c.sort ?? i
      })),
    collection: null,
    external_ids: buildExternalIds(data.remoteIds),
    recommendations: [],
    similar: [],
    source_url: data.url || `https://thetvdb.com/movies/${data.slug}`,
    source: 'tvdb'
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Utilitaires
  normalizeMovieStatus,
  extractRemoteId,
  buildExternalIds,
  extractImages,
  // Recherche
  normalizeTmdbSearchResult,
  normalizeImdbSearchResult,
  normalizeTvdbSearchResult,
  normalizeTmdbSearch,
  normalizeImdbSearch,
  normalizeTvdbSearch,
  // Détails
  normalizeTmdbMovieDetail,
  normalizeImdbMovieDetail,
  normalizeTvdbMovieDetail
};
