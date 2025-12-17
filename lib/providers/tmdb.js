/**
 * lib/providers/tmdb.js - Provider TMDB
 * 
 * API TMDB (The Movie Database) pour films et séries TV
 * Nécessite une clé API TMDB
 * 
 * @module providers/tmdb
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { translateText, translateGenres, extractLangCode } from '../utils/translator.js';
import {
  TMDB_BASE_URL,
  TMDB_IMAGE_BASE_URL,
  TMDB_DEFAULT_MAX,
  TMDB_MAX_LIMIT
} from '../config.js';

const log = createLogger('TMDB');

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche multi sur TMDB (films, séries, personnes)
 * @param {string} query - Terme de recherche
 * @param {string} apiKey - Clé API TMDB
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchTmdb(query, apiKey, options = {}) {
  const {
    max = TMDB_DEFAULT_MAX,
    type = null,      // movie, tv, person, multi (défaut)
    lang = 'fr-FR',   // Code langue ISO 639-1 + pays
    page = 1,
    year = null,
    includeAdult = false
  } = options;
  
  const searchType = type || 'multi';
  const cacheKey = `tmdb_search_${query}_${searchType}_${max}_${lang}_${page}_${year}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: ${query}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Recherche: "${query}" (type: ${searchType}, lang: ${lang}, page: ${page})`);
  metrics.sources.tmdb.requests++;
  
  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      query: query,
      language: lang,
      page: page,
      include_adult: includeAdult
    });
    
    if (year) {
      if (searchType === 'movie') {
        params.append('primary_release_year', year);
      } else if (searchType === 'tv') {
        params.append('first_air_date_year', year);
      } else if (searchType === 'multi') {
        params.append('year', year);
      }
    }
    
    const url = `${TMDB_BASE_URL}/search/${searchType}?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur TMDB ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    const results = (data.results || []).slice(0, max).map(item => {
      const mediaType = item.media_type || searchType;
      const isMovie = mediaType === 'movie';
      const isTv = mediaType === 'tv';
      const isPerson = mediaType === 'person';
      
      return {
        id: item.id,
        mediaType: mediaType,
        title: item.title || item.name,
        originalTitle: item.original_title || item.original_name,
        overview: item.overview || null,
        releaseDate: item.release_date || item.first_air_date || null,
        year: (item.release_date || item.first_air_date) 
          ? new Date(item.release_date || item.first_air_date).getFullYear() 
          : null,
        popularity: item.popularity,
        voteAverage: item.vote_average,
        voteCount: item.vote_count,
        originalLanguage: item.original_language,
        genreIds: item.genre_ids || [],
        adult: item.adult || false,
        
        poster: item.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${item.poster_path}` : null,
        posterSmall: item.poster_path ? `${TMDB_IMAGE_BASE_URL}/w185${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/w1280${item.backdrop_path}` : null,
        
        profilePath: isPerson && item.profile_path ? `${TMDB_IMAGE_BASE_URL}/w185${item.profile_path}` : null,
        knownFor: isPerson ? (item.known_for || []).map(k => ({
          id: k.id,
          mediaType: k.media_type,
          title: k.title || k.name,
          poster: k.poster_path ? `${TMDB_IMAGE_BASE_URL}/w185${k.poster_path}` : null
        })) : null,
        knownForDepartment: item.known_for_department || null,
        
        originCountry: isTv ? item.origin_country : null,
        
        url: isMovie 
          ? `https://www.themoviedb.org/movie/${item.id}`
          : isTv 
          ? `https://www.themoviedb.org/tv/${item.id}`
          : `https://www.themoviedb.org/person/${item.id}`,
        source: "tmdb"
      };
    });
    
    const result = {
      query,
      searchType,
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      resultsOnPage: results.length,
      results,
      source: "tmdb"
    };
    
    log.debug(`✅ ${results.length} résultat(s) sur ${data.total_results} total`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.tmdb.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS FILM
// ============================================================================

/**
 * Récupère les détails d'un film TMDB par ID
 * @param {string|number} id - ID du film
 * @param {string} apiKey - Clé API TMDB
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails du film
 */
export async function getTmdbMovieById(id, apiKey, options = {}) {
  const { lang = 'fr-FR', autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `tmdb_movie_${id}_${lang}_${shouldTranslate ? 'trad' : 'notrad'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: movie ${id}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Récupération film: ${id}`);
  metrics.sources.tmdb.requests++;
  
  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      language: lang,
      append_to_response: 'credits,videos,keywords,recommendations,similar,external_ids,release_dates'
    });
    
    const url = `${TMDB_BASE_URL}/movie/${id}?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Film TMDB ${id} non trouvé`);
      }
      const errorText = await response.text();
      throw new Error(`Erreur TMDB ${response.status}: ${errorText}`);
    }
    
    const movie = await response.json();
    
    // Prépare les genres
    const genresList = movie.genres?.map(g => g.name) || [];
    
    // Applique la traduction si demandée
    let finalOverview = movie.overview;
    let overviewOriginal = movie.overview;
    let overviewTranslated = null;
    let genresTranslated = null;
    
    if (shouldTranslate && destLang) {
      // Traduit l'overview
      if (movie.overview) {
        const translatedOverview = await translateText(movie.overview, destLang);
        if (translatedOverview !== movie.overview) {
          finalOverview = translatedOverview;
          overviewTranslated = translatedOverview;
        }
      }
      
      // Traduit les genres
      if (genresList.length > 0) {
        genresTranslated = await translateGenres(genresList, destLang, 'media');
      }
    }
    
    const result = {
      id: movie.id,
      type: 'movie',
      imdbId: movie.imdb_id,
      title: movie.title,
      originalTitle: movie.original_title,
      tagline: movie.tagline,
      overview: finalOverview,
      overviewOriginal: overviewOriginal,
      overviewTranslated: overviewTranslated,
      releaseDate: movie.release_date,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      runtime: movie.runtime,
      runtimeMinutes: movie.runtime,
      status: movie.status,
      adult: movie.adult,
      video: movie.video,
      poster: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${movie.poster_path}` : null,
      rating: movie.vote_average ? { average: movie.vote_average, votes: movie.vote_count } : null,
      
      popularity: movie.popularity,
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
      
      originalLanguage: movie.original_language,
      spokenLanguages: movie.spoken_languages?.map(l => ({
        code: l.iso_639_1,
        name: l.name,
        englishName: l.english_name
      })) || [],
      productionCountries: movie.production_countries?.map(c => ({
        code: c.iso_3166_1,
        name: c.name
      })) || [],
      
      budget: movie.budget,
      revenue: movie.revenue,
      
      poster: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${movie.poster_path}` : null,
      posterOriginal: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}/original${movie.poster_path}` : null,
      backdrop: movie.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/w1280${movie.backdrop_path}` : null,
      backdropOriginal: movie.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/original${movie.backdrop_path}` : null,
      
      genres: genresTranslated || genresList,
      genresOriginal: genresList,
      genresTranslated: genresTranslated,
      genresFull: movie.genres?.map(g => ({ id: g.id, name: g.name })) || [],
      
      productionCompanies: movie.production_companies?.map(c => ({
        id: c.id,
        name: c.name,
        logo: c.logo_path ? `${TMDB_IMAGE_BASE_URL}/w185${c.logo_path}` : null,
        country: c.origin_country
      })) || [],
      
      belongsToCollection: movie.belongs_to_collection ? {
        id: movie.belongs_to_collection.id,
        name: movie.belongs_to_collection.name,
        poster: movie.belongs_to_collection.poster_path 
          ? `${TMDB_IMAGE_BASE_URL}/w500${movie.belongs_to_collection.poster_path}` : null,
        backdrop: movie.belongs_to_collection.backdrop_path
          ? `${TMDB_IMAGE_BASE_URL}/w1280${movie.belongs_to_collection.backdrop_path}` : null
      } : null,
      
      cast: movie.credits?.cast?.slice(0, 20).map(c => ({
        id: c.id,
        name: c.name,
        character: c.character,
        order: c.order,
        profile: c.profile_path ? `${TMDB_IMAGE_BASE_URL}/w185${c.profile_path}` : null
      })) || [],
      crew: movie.credits?.crew?.filter(c => 
        ['Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer', 'Original Music Composer'].includes(c.job)
      ).map(c => ({
        id: c.id,
        name: c.name,
        job: c.job,
        department: c.department,
        profile: c.profile_path ? `${TMDB_IMAGE_BASE_URL}/w185${c.profile_path}` : null
      })) || [],
      
      videos: movie.videos?.results?.filter(v => v.site === 'YouTube').map(v => ({
        id: v.id,
        key: v.key,
        name: v.name,
        type: v.type,
        official: v.official,
        url: `https://www.youtube.com/watch?v=${v.key}`
      })) || [],
      
      keywords: movie.keywords?.keywords?.map(k => k.name) || [],
      
      externalIds: {
        imdb: movie.external_ids?.imdb_id,
        facebook: movie.external_ids?.facebook_id,
        instagram: movie.external_ids?.instagram_id,
        twitter: movie.external_ids?.twitter_id,
        wikidata: movie.external_ids?.wikidata_id
      },
      
      certifications: movie.release_dates?.results?.map(r => ({
        country: r.iso_3166_1,
        certification: r.release_dates?.[0]?.certification || null,
        releaseDate: r.release_dates?.[0]?.release_date || null
      })).filter(c => c.certification) || [],
      
      recommendations: movie.recommendations?.results?.slice(0, 10).map(r => ({
        id: r.id,
        title: r.title,
        releaseDate: r.release_date,
        voteAverage: r.vote_average,
        poster: r.poster_path ? `${TMDB_IMAGE_BASE_URL}/w185${r.poster_path}` : null
      })) || [],
      
      similar: movie.similar?.results?.slice(0, 10).map(s => ({
        id: s.id,
        title: s.title,
        releaseDate: s.release_date,
        voteAverage: s.vote_average,
        poster: s.poster_path ? `${TMDB_IMAGE_BASE_URL}/w185${s.poster_path}` : null
      })) || [],
      
      homepage: movie.homepage || null,
      url: `https://www.themoviedb.org/movie/${movie.id}`,
      source: "tmdb"
    };
    
    log.debug(`✅ Film récupéré: ${result.title}`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.tmdb.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS SÉRIE TV
// ============================================================================

/**
 * Récupère les détails d'une série TV TMDB par ID
 * @param {string|number} id - ID de la série
 * @param {string} apiKey - Clé API TMDB
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails de la série
 */
export async function getTmdbTvById(id, apiKey, options = {}) {
  const { lang = 'fr-FR', autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `tmdb_tv_${id}_${lang}_${shouldTranslate ? 'trad' : 'notrad'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: tv ${id}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Récupération série: ${id}`);
  metrics.sources.tmdb.requests++;
  
  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      language: lang,
      append_to_response: 'credits,videos,keywords,recommendations,similar,external_ids,content_ratings'
    });
    
    const url = `${TMDB_BASE_URL}/tv/${id}?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Série TMDB ${id} non trouvée`);
      }
      const errorText = await response.text();
      throw new Error(`Erreur TMDB ${response.status}: ${errorText}`);
    }
    
    const tv = await response.json();
    
    // Prépare les genres
    const genresList = tv.genres?.map(g => g.name) || [];
    
    // Applique la traduction si demandée
    let finalOverview = tv.overview;
    let overviewOriginal = tv.overview;
    let overviewTranslated = null;
    let genresTranslated = null;
    
    if (shouldTranslate && destLang) {
      // Traduit l'overview
      if (tv.overview) {
        const translatedOverview = await translateText(tv.overview, destLang);
        if (translatedOverview !== tv.overview) {
          finalOverview = translatedOverview;
          overviewTranslated = translatedOverview;
        }
      }
      
      // Traduit les genres
      if (genresList.length > 0) {
        genresTranslated = await translateGenres(genresList, destLang, 'media');
      }
    }
    
    const result = {
      id: tv.id,
      type: 'tv',
      // Clés harmonisées (prioritaires)
      title: tv.name,
      originalTitle: tv.original_name,
      overview: finalOverview,
      overviewOriginal: overviewOriginal,
      overviewTranslated: overviewTranslated,
      year: tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : null,
      endYear: tv.last_air_date ? new Date(tv.last_air_date).getFullYear() : null,
      status: tv.status,
      poster: tv.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${tv.poster_path}` : null,
      rating: { average: tv.vote_average, votes: tv.vote_count },
      runtimeMinutes: tv.episode_run_time?.[0] || null,
      // Clés spécifiques TMDB (rétro-compatibilité)
      name: tv.name,
      originalName: tv.original_name,
      tagline: tv.tagline,
      firstAirDate: tv.first_air_date,
      lastAirDate: tv.last_air_date,
      tvType: tv.type,
      inProduction: tv.in_production,
      adult: tv.adult,
      
      numberOfSeasons: tv.number_of_seasons,
      numberOfEpisodes: tv.number_of_episodes,
      // Alias pour harmonisation avec IMDB
      totalSeasons: tv.number_of_seasons,
      totalEpisodes: tv.number_of_episodes,
      episodeRunTime: tv.episode_run_time || [],
      
      lastEpisodeToAir: tv.last_episode_to_air ? {
        id: tv.last_episode_to_air.id,
        name: tv.last_episode_to_air.name,
        overview: tv.last_episode_to_air.overview,
        airDate: tv.last_episode_to_air.air_date,
        seasonNumber: tv.last_episode_to_air.season_number,
        episodeNumber: tv.last_episode_to_air.episode_number,
        voteAverage: tv.last_episode_to_air.vote_average
      } : null,
      nextEpisodeToAir: tv.next_episode_to_air ? {
        id: tv.next_episode_to_air.id,
        name: tv.next_episode_to_air.name,
        overview: tv.next_episode_to_air.overview,
        airDate: tv.next_episode_to_air.air_date,
        seasonNumber: tv.next_episode_to_air.season_number,
        episodeNumber: tv.next_episode_to_air.episode_number
      } : null,
      
      popularity: tv.popularity,
      voteAverage: tv.vote_average,
      voteCount: tv.vote_count,
      
      originalLanguage: tv.original_language,
      languages: tv.languages || [],
      originCountry: tv.origin_country || [],
      spokenLanguages: tv.spoken_languages?.map(l => ({
        code: l.iso_639_1,
        name: l.name,
        englishName: l.english_name
      })) || [],
      productionCountries: tv.production_countries?.map(c => ({
        code: c.iso_3166_1,
        name: c.name
      })) || [],
      
      poster: tv.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${tv.poster_path}` : null,
      posterOriginal: tv.poster_path ? `${TMDB_IMAGE_BASE_URL}/original${tv.poster_path}` : null,
      backdrop: tv.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/w1280${tv.backdrop_path}` : null,
      backdropOriginal: tv.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/original${tv.backdrop_path}` : null,
      
      genres: genresTranslated || genresList,
      genresOriginal: genresList,
      genresTranslated: genresTranslated,
      genresFull: tv.genres?.map(g => ({ id: g.id, name: g.name })) || [],
      
      networks: tv.networks?.map(n => ({
        id: n.id,
        name: n.name,
        logo: n.logo_path ? `${TMDB_IMAGE_BASE_URL}/w185${n.logo_path}` : null,
        country: n.origin_country
      })) || [],
      
      productionCompanies: tv.production_companies?.map(c => ({
        id: c.id,
        name: c.name,
        logo: c.logo_path ? `${TMDB_IMAGE_BASE_URL}/w185${c.logo_path}` : null,
        country: c.origin_country
      })) || [],
      
      createdBy: tv.created_by?.map(c => ({
        id: c.id,
        name: c.name,
        profile: c.profile_path ? `${TMDB_IMAGE_BASE_URL}/w185${c.profile_path}` : null
      })) || [],
      
      seasons: tv.seasons?.map(s => ({
        id: s.id,
        name: s.name,
        overview: s.overview,
        seasonNumber: s.season_number,
        episodeCount: s.episode_count,
        airDate: s.air_date,
        poster: s.poster_path ? `${TMDB_IMAGE_BASE_URL}/w185${s.poster_path}` : null,
        voteAverage: s.vote_average
      })) || [],
      
      cast: tv.credits?.cast?.slice(0, 20).map(c => ({
        id: c.id,
        name: c.name,
        character: c.character,
        order: c.order,
        profile: c.profile_path ? `${TMDB_IMAGE_BASE_URL}/w185${c.profile_path}` : null
      })) || [],
      crew: tv.credits?.crew?.filter(c => 
        ['Executive Producer', 'Creator', 'Original Music Composer', 'Director of Photography'].includes(c.job)
      ).map(c => ({
        id: c.id,
        name: c.name,
        job: c.job,
        department: c.department,
        profile: c.profile_path ? `${TMDB_IMAGE_BASE_URL}/w185${c.profile_path}` : null
      })) || [],
      
      videos: tv.videos?.results?.filter(v => v.site === 'YouTube').map(v => ({
        id: v.id,
        key: v.key,
        name: v.name,
        type: v.type,
        official: v.official,
        url: `https://www.youtube.com/watch?v=${v.key}`
      })) || [],
      
      keywords: tv.keywords?.results?.map(k => k.name) || [],
      
      externalIds: {
        imdb: tv.external_ids?.imdb_id,
        tvdb: tv.external_ids?.tvdb_id,
        facebook: tv.external_ids?.facebook_id,
        instagram: tv.external_ids?.instagram_id,
        twitter: tv.external_ids?.twitter_id,
        wikidata: tv.external_ids?.wikidata_id
      },
      
      contentRatings: tv.content_ratings?.results?.map(r => ({
        country: r.iso_3166_1,
        rating: r.rating
      })) || [],
      
      recommendations: tv.recommendations?.results?.slice(0, 10).map(r => ({
        id: r.id,
        name: r.name,
        firstAirDate: r.first_air_date,
        voteAverage: r.vote_average,
        poster: r.poster_path ? `${TMDB_IMAGE_BASE_URL}/w185${r.poster_path}` : null
      })) || [],
      
      similar: tv.similar?.results?.slice(0, 10).map(s => ({
        id: s.id,
        name: s.name,
        firstAirDate: s.first_air_date,
        voteAverage: s.vote_average,
        poster: s.poster_path ? `${TMDB_IMAGE_BASE_URL}/w185${s.poster_path}` : null
      })) || [],
      
      homepage: tv.homepage || null,
      url: `https://www.themoviedb.org/tv/${tv.id}`,
      source: "tmdb"
    };
    
    log.debug(`✅ Série récupérée: ${result.name}`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.tmdb.errors++;
    throw err;
  }
}
