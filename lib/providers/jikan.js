/**
 * lib/providers/jikan.js - Provider Jikan (MyAnimeList)
 * 
 * API gratuite pour anime et manga via MyAnimeList
 * Pas de clé API requise
 * 
 * @module providers/jikan
 */

import { metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { translateText, translateGenres, extractLangCode } from '../utils/translator.js';
import {
  JIKAN_BASE_URL,
  JIKAN_DEFAULT_MAX,
  JIKAN_MAX_LIMIT
} from '../config.js';
import { fetchViaProxy } from '../utils/fetch-proxy.js';

// Import des normalizers anime
import {
  normalizeJikanSearch,
  normalizeJikanAnimeDetail
} from '../normalizers/anime.js';

// Import des normalizers manga
import {
  normalizeJikanMangaSearch,
  normalizeJikanMangaDetail
} from '../normalizers/manga.js';

const log = createLogger('Jikan');

// ============================================================================
// ANIME
// ============================================================================

/**
 * Recherche d'anime sur Jikan (MyAnimeList)
 * @param {string} query - Terme de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchJikanAnime(query, options = {}) {
  const {
    max = JIKAN_DEFAULT_MAX,
    page = 1,
    type = null,        // tv, movie, ova, special, ona, music
    status = null,      // airing, complete, upcoming
    rating = null,      // g, pg, pg13, r17, r, rx
    orderBy = null,     // mal_id, title, start_date, end_date, episodes, score, scored_by, rank, popularity, members, favorites
    sort = null         // asc, desc
  } = options;
  
  const limit = Math.min(max, JIKAN_MAX_LIMIT);
  
  const cacheKey = `jikan_anime_${query}_${limit}_${page}_${type}_${status}_${rating}_${orderBy}_${sort}`;
  
  log.debug(`Recherche anime: "${query}" (limit: ${limit}, page: ${page})`);
  metrics.sources.jikan.requests++;
  
  try {
    const params = new URLSearchParams({
      q: query,
      limit: limit,
      page: page
    });
    
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    if (rating) params.append('rating', rating);
    if (orderBy) params.append('order_by', orderBy);
    if (sort) params.append('sort', sort);
    
    const url = `${JIKAN_BASE_URL}/anime?${params.toString()}`;
    
    const response = await fetchViaProxy(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur Jikan ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    const results = (data.data || []).map(item => ({
      id: item.mal_id,
      type: item.type,
      title: item.title,
      titleEnglish: item.title_english || null,
      titleJapanese: item.title_japanese || null,
      titles: (item.titles || []).map(t => ({ type: t.type, title: t.title })),
      episodes: item.episodes,
      status: item.status,
      airing: item.airing,
      aired: item.aired ? {
        from: item.aired.from,
        to: item.aired.to,
        string: item.aired.string
      } : null,
      duration: item.duration,
      rating: item.rating,
      score: item.score,
      scoredBy: item.scored_by,
      rank: item.rank,
      popularity: item.popularity,
      members: item.members,
      favorites: item.favorites,
      synopsis: item.synopsis,
      background: item.background,
      season: item.season,
      year: item.year,
      studios: (item.studios || []).map(s => ({ id: s.mal_id, name: s.name })),
      genres: (item.genres || []).map(g => ({ id: g.mal_id, name: g.name })),
      themes: (item.themes || []).map(t => ({ id: t.mal_id, name: t.name })),
      demographics: (item.demographics || []).map(d => ({ id: d.mal_id, name: d.name })),
      image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || null,
      poster: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || null,
      posterSmall: item.images?.jpg?.small_image_url || null,
      trailer: item.trailer?.url || null,
      url: item.url,
      source: "jikan_anime"
    }));
    
    const result = {
      query,
      pagination: {
        currentPage: data.pagination?.current_page || page,
        lastPage: data.pagination?.last_visible_page || 1,
        hasNextPage: data.pagination?.has_next_page || false,
        totalResults: data.pagination?.items?.total || results.length
      },
      resultsCount: results.length,
      results,
      source: "jikan_anime"
    };
    
    log.debug(`✅ ${results.length} anime(s) trouvé(s)`);
    return result;
    
  } catch (err) {
    metrics.sources.jikan.errors++;
    throw err;
  }
}

/**
 * Récupère les données additionnelles d'un anime (characters, staff, recommendations)
 * @param {number} animeId - ID MyAnimeList
 * @returns {Promise<object>} - Données additionnelles
 */
async function fetchAnimeAdditionalData(animeId) {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  const results = {
    characters: [],
    staff: [],
    recommendations: []
  };
  
  try {
    // Characters (avec délai pour rate limiting Jikan)
    const charsResponse = await fetchViaProxy(`${JIKAN_BASE_URL}/anime/${animeId}/characters`, {
      headers: { 'Accept': 'application/json' }
    });
    if (charsResponse.ok) {
      const charsData = await charsResponse.json();
      results.characters = (charsData.data || []).slice(0, 10).map((c, idx) => ({
        name: c.character?.name?.split(', ').reverse().join(' ') || c.character?.name,
        character: c.role || 'Unknown',
        image_url: c.character?.images?.jpg?.image_url || null,
        order: idx,
        voice_actors: (c.voice_actors || []).slice(0, 2).map(va => ({
          name: va.person?.name?.split(', ').reverse().join(' ') || va.person?.name,
          language: va.language,
          image_url: va.person?.images?.jpg?.image_url || null
        }))
      }));
    }
    
    await delay(350); // Rate limit Jikan: 3 req/sec
    
    // Staff
    const staffResponse = await fetchViaProxy(`${JIKAN_BASE_URL}/anime/${animeId}/staff`, {
      headers: { 'Accept': 'application/json' }
    });
    if (staffResponse.ok) {
      const staffData = await staffResponse.json();
      results.staff = (staffData.data || []).map(s => ({
        name: s.person?.name?.split(', ').reverse().join(' ') || s.person?.name,
        positions: s.positions || [],
        image_url: s.person?.images?.jpg?.image_url || null
      }));
    }
    
    await delay(350);
    
    // Recommendations
    const recsResponse = await fetchViaProxy(`${JIKAN_BASE_URL}/anime/${animeId}/recommendations`, {
      headers: { 'Accept': 'application/json' }
    });
    if (recsResponse.ok) {
      const recsData = await recsResponse.json();
      results.recommendations = (recsData.data || []).slice(0, 5).map(r => ({
        id: String(r.entry?.mal_id),
        title: r.entry?.title,
        poster_url: r.entry?.images?.jpg?.large_image_url || r.entry?.images?.jpg?.image_url || null
      }));
    }
    
  } catch (err) {
    log.warn(`Erreur récupération données additionnelles anime ${animeId}: ${err.message}`);
  }
  
  return results;
}

/**
 * Récupère les détails d'un anime par ID MyAnimeList
 * @param {number} animeId - ID MyAnimeList de l'anime
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails de l'anime
 */
export async function getJikanAnimeById(animeId, options = {}) {
  const { lang = null, autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `jikan_anime_detail_${animeId}_${shouldTranslate ? 'trad_' + destLang : 'notrad'}`;
  
  log.debug(`Récupération anime: ${animeId}`);
  metrics.sources.jikan.requests++;
  
  try {
    const url = `${JIKAN_BASE_URL}/anime/${animeId}/full`;
    
    const response = await fetchViaProxy(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Anime ${animeId} non trouvé sur MyAnimeList`);
      }
      const errorText = await response.text();
      throw new Error(`Erreur Jikan ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const item = data.data;
    
    // Récupère les données additionnelles (characters, staff, recommendations)
    const additionalData = await fetchAnimeAdditionalData(animeId);
    
    // Prépare les genres
    const genresList = (item.genres || []).map(g => g.name);
    
    // Applique la traduction si demandée
    let finalSynopsis = item.synopsis;
    let synopsisOriginal = item.synopsis;
    let synopsisTranslated = null;
    let genresTranslated = null;
    
    if (shouldTranslate && destLang) {
      // Traduit le synopsis
      if (item.synopsis) {
        const result = await translateText(item.synopsis, destLang, { enabled: true });
        if (result.translated) {
          finalSynopsis = result.text;
          synopsisTranslated = result.text;
        }
      }
      
      // Traduit les genres
      if (genresList.length > 0) {
        genresTranslated = await translateGenres(genresList, destLang, 'media');
      }
    }
    
    // Extrait les directors du staff
    const directors = additionalData.staff
      .filter(s => s.positions?.some(p => p.toLowerCase().includes('director')))
      .map(s => s.name);
    
    // Extrait les writers/creators
    const writers = additionalData.staff
      .filter(s => s.positions?.some(p => 
        p.toLowerCase().includes('script') || 
        p.toLowerCase().includes('original creator') ||
        p.toLowerCase().includes('story')
      ))
      .map(s => s.name);
    
    const result = {
      id: item.mal_id,
      type: item.type,
      // Clés harmonisées (prioritaires)
      title: item.title,
      originalTitle: item.title_japanese || item.title,
      overview: finalSynopsis,
      overviewOriginal: synopsisOriginal,
      overviewTranslated: synopsisTranslated,
      year: item.year || (item.aired?.from ? new Date(item.aired.from).getFullYear() : null),
      endYear: item.aired?.to ? new Date(item.aired.to).getFullYear() : null,
      status: item.status,
      poster: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || null,
      posterSmall: item.images?.jpg?.small_image_url || null,
      rating: item.score ? { average: item.score, votes: item.scored_by } : null,
      runtimeMinutes: item.duration ? parseInt(item.duration) || null : null,
      totalEpisodes: item.episodes,
      genres: genresTranslated || genresList,
      genresOriginal: genresList,
      genresTranslated: genresTranslated,
      // Données additionnelles (format TMDB-like)
      cast: additionalData.characters,
      directors: directors,
      writers: writers,
      staff: additionalData.staff,
      recommendations: additionalData.recommendations,
      // Clés spécifiques Jikan (rétro-compatibilité)
      titleEnglish: item.title_english || null,
      titleJapanese: item.title_japanese || null,
      titles: (item.titles || []).map(t => ({ type: t.type, title: t.title })),
      episodes: item.episodes,
      airing: item.airing,
      aired: item.aired ? {
        from: item.aired.from,
        to: item.aired.to,
        string: item.aired.string
      } : null,
      duration: item.duration,
      contentRating: item.rating,
      score: item.score,
      scoredBy: item.scored_by,
      rank: item.rank,
      popularity: item.popularity,
      members: item.members,
      favorites: item.favorites,
      synopsis: item.synopsis,
      background: item.background,
      season: item.season,
      broadcast: item.broadcast ? {
        day: item.broadcast.day,
        time: item.broadcast.time,
        timezone: item.broadcast.timezone,
        string: item.broadcast.string
      } : null,
      producers: (item.producers || []).map(p => ({ id: p.mal_id, name: p.name, type: p.type })),
      licensors: (item.licensors || []).map(l => ({ id: l.mal_id, name: l.name })),
      studios: (item.studios || []).map(s => ({ id: s.mal_id, name: s.name })),
      source: item.source,
      genresFull: (item.genres || []).map(g => ({ id: g.mal_id, name: g.name })),
      themes: (item.themes || []).map(t => ({ id: t.mal_id, name: t.name })),
      demographics: (item.demographics || []).map(d => ({ id: d.mal_id, name: d.name })),
      relations: (item.relations || []).map(r => ({
        relation: r.relation,
        entries: (r.entry || []).map(e => ({ id: e.mal_id, type: e.type, name: e.name, url: e.url }))
      })),
      streaming: (item.streaming || []).map(s => ({ name: s.name, url: s.url })),
      external: (item.external || []).map(e => ({ name: e.name, url: e.url })),
      trailer: item.trailer ? {
        youtubeId: item.trailer.youtube_id,
        url: item.trailer.url,
        embedUrl: item.trailer.embed_url,
        thumbnail: item.trailer.images?.maximum_image_url || item.trailer.images?.large_image_url || null
      } : null,
      url: item.url,
      dataSource: "jikan_anime"
    };
    
    log.debug(`✅ Anime récupéré: ${result.title}`);
    return result;
    
  } catch (err) {
    metrics.sources.jikan.errors++;
    throw err;
  }
}

// ============================================================================
// ANIME - NORMALIZED FUNCTIONS (v3.0.0)
// ============================================================================

/**
 * Recherche d'anime avec normalisation v3.0.0
 * @param {string} query - Terme de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function searchJikanAnimeNormalized(query, options = {}) {
  const rawResult = await searchJikanAnime(query, options);
  return normalizeJikanSearch(rawResult);
}

/**
 * Récupère les détails d'un anime par ID avec normalisation v3.0.0
 * @param {number} animeId - ID MyAnimeList de l'anime
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getJikanAnimeByIdNormalized(animeId, options = {}) {
  const rawResult = await getJikanAnimeById(animeId, options);
  return normalizeJikanAnimeDetail(rawResult);
}

// ============================================================================
// MANGA
// ============================================================================

/**
 * Recherche de manga sur Jikan (MyAnimeList)
 * @param {string} query - Terme de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchJikanManga(query, options = {}) {
  const {
    max = JIKAN_DEFAULT_MAX,
    page = 1,
    type = null,        // manga, novel, lightnovel, oneshot, doujin, manhwa, manhua
    status = null,      // publishing, complete, hiatus, discontinued, upcoming
    orderBy = null,     // mal_id, title, start_date, end_date, chapters, volumes, score, scored_by, rank, popularity, members, favorites
    sort = null         // asc, desc
  } = options;
  
  const limit = Math.min(max, JIKAN_MAX_LIMIT);
  
  const cacheKey = `jikan_manga_${query}_${limit}_${page}_${type}_${status}_${orderBy}_${sort}`;
  
  log.debug(`Recherche manga: "${query}" (limit: ${limit}, page: ${page})`);
  metrics.sources.jikan.requests++;
  
  try {
    const params = new URLSearchParams({
      q: query,
      limit: limit,
      page: page
    });
    
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    if (orderBy) params.append('order_by', orderBy);
    if (sort) params.append('sort', sort);
    
    const url = `${JIKAN_BASE_URL}/manga?${params.toString()}`;
    
    const response = await fetchViaProxy(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur Jikan ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    const results = (data.data || []).map(item => ({
      id: item.mal_id,
      type: item.type,
      title: item.title,
      originalTitle: item.title_japanese || null,
      authors: (item.authors || []).map(a => a.name),
      editors: (item.serializations || []).map(s => s.name),
      releaseDate: item.published?.from || null,
      genres: (item.genres || []).map(g => g.name),
      pages: null,
      serie: null,
      synopsis: item.synopsis,
      language: 'ja',
      tome: item.volumes || null,
      volumes: item.volumes || null,
      chapters: item.chapters || null,
      image: [item.images?.jpg?.large_image_url, item.images?.jpg?.image_url, item.images?.jpg?.small_image_url].filter(Boolean),
      isbn: null,
      price: null,
      score: item.score,
      status: item.status,
      url: item.url,
      source: "jikan_manga"
    }));
    
    const result = {
      query,
      pagination: {
        currentPage: data.pagination?.current_page || page,
        lastPage: data.pagination?.last_visible_page || 1,
        hasNextPage: data.pagination?.has_next_page || false,
        totalResults: data.pagination?.items?.total || results.length
      },
      resultsCount: results.length,
      results,
      source: "jikan_manga"
    };
    
    log.debug(`✅ ${results.length} manga(s) trouvé(s)`);
    return result;
    
  } catch (err) {
    metrics.sources.jikan.errors++;
    throw err;
  }
}

/**
 * Récupère les données additionnelles d'un manga (characters, recommendations)
 * @param {number} mangaId - ID MyAnimeList
 * @returns {Promise<object>} - Données additionnelles
 */
async function fetchMangaAdditionalData(mangaId) {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  const results = {
    characters: [],
    recommendations: []
  };
  
  try {
    // Characters
    const charsResponse = await fetchViaProxy(`${JIKAN_BASE_URL}/manga/${mangaId}/characters`, {
      headers: { 'Accept': 'application/json' }
    });
    if (charsResponse.ok) {
      const charsData = await charsResponse.json();
      results.characters = (charsData.data || []).slice(0, 10).map((c, idx) => ({
        name: c.character?.name?.split(', ').reverse().join(' ') || c.character?.name,
        character: c.role || 'Unknown',
        image_url: c.character?.images?.jpg?.image_url || null,
        order: idx
      }));
    }
    
    await delay(350); // Rate limit Jikan
    
    // Recommendations
    const recsResponse = await fetchViaProxy(`${JIKAN_BASE_URL}/manga/${mangaId}/recommendations`, {
      headers: { 'Accept': 'application/json' }
    });
    if (recsResponse.ok) {
      const recsData = await recsResponse.json();
      results.recommendations = (recsData.data || []).slice(0, 5).map(r => ({
        id: String(r.entry?.mal_id),
        title: r.entry?.title,
        poster_url: r.entry?.images?.jpg?.large_image_url || r.entry?.images?.jpg?.image_url || null
      }));
    }
    
  } catch (err) {
    log.warn(`Erreur récupération données additionnelles manga ${mangaId}: ${err.message}`);
  }
  
  return results;
}

/**
 * Récupère les détails d'un manga par ID MyAnimeList
 * @param {number} mangaId - ID MyAnimeList du manga
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails du manga
 */
export async function getJikanMangaById(mangaId, options = {}) {
  const { lang = null, autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `jikan_manga_detail_${mangaId}_${shouldTranslate ? 'trad_' + destLang : 'notrad'}`;
  
  log.debug(`Récupération manga: ${mangaId}`);
  metrics.sources.jikan.requests++;
  
  try {
    const url = `${JIKAN_BASE_URL}/manga/${mangaId}/full`;
    
    const response = await fetchViaProxy(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Manga ${mangaId} non trouvé sur MyAnimeList`);
      }
      const errorText = await response.text();
      throw new Error(`Erreur Jikan ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const item = data.data;
    
    // Récupère les données additionnelles
    const additionalData = await fetchMangaAdditionalData(mangaId);
    
    const authorNames = (item.authors || []).map(a => a.name);
    const genreNames = (item.genres || []).map(g => g.name);
    const editorNames = (item.serializations || []).map(s => s.name);
    const imageArray = [item.images?.jpg?.large_image_url, item.images?.jpg?.image_url, item.images?.jpg?.small_image_url].filter(Boolean);
    
    // Applique la traduction si demandée
    let finalSynopsis = item.synopsis;
    let synopsisOriginal = item.synopsis;
    let synopsisTranslated = null;
    let genresTranslated = null;
    
    if (shouldTranslate && destLang) {
      // Traduit le synopsis
      if (item.synopsis) {
        const result = await translateText(item.synopsis, destLang, { enabled: true });
        if (result.translated) {
          finalSynopsis = result.text;
          synopsisTranslated = result.text;
        }
      }
      
      // Traduit les genres
      if (genreNames.length > 0) {
        genresTranslated = await translateGenres(genreNames, destLang, 'media');
      }
    }
    
    const result = {
      id: item.mal_id,
      type: item.type,
      title: item.title,
      originalTitle: item.title_japanese || null,
      // Clés harmonisées
      overview: finalSynopsis,
      overviewOriginal: synopsisOriginal,
      overviewTranslated: synopsisTranslated,
      year: item.published?.from ? new Date(item.published.from).getFullYear() : null,
      poster: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || null,
      posterSmall: item.images?.jpg?.small_image_url || null,
      rating: item.score ? { average: item.score, votes: item.scored_by } : null,
      // Données additionnelles
      cast: additionalData.characters,
      recommendations: additionalData.recommendations,
      // Autres champs
      authors: authorNames,
      editors: editorNames,
      releaseDate: item.published?.from || null,
      genres: genresTranslated || genreNames,
      genresOriginal: genreNames,
      genresTranslated: genresTranslated,
      themes: (item.themes || []).map(t => t.name),
      demographics: (item.demographics || []).map(d => d.name),
      synopsis: finalSynopsis,
      synopsisOriginal: synopsisOriginal,
      synopsisTranslated: synopsisTranslated,
      language: 'ja',
      totalVolumes: item.volumes || null,
      totalChapters: item.chapters || null,
      image: imageArray,
      chapters: item.chapters,
      status: item.status,
      score: item.score,
      scoredBy: item.scored_by,
      rank: item.rank,
      popularity: item.popularity,
      members: item.members,
      favorites: item.favorites,
      relations: (item.relations || []).map(r => ({
        relation: r.relation,
        entries: (r.entry || []).map(e => ({ id: e.mal_id, type: e.type, name: e.name, url: e.url }))
      })),
      url: item.url,
      dataSource: "jikan_manga"
    };
    
    log.debug(`✅ Manga récupéré: ${result.title}`);
    return result;
    
  } catch (err) {
    metrics.sources.jikan.errors++;
    throw err;
  }
}

// ============================================================================
// MANGA - NORMALIZED FUNCTIONS (v3.0.0)
// ============================================================================

/**
 * Recherche de manga avec normalisation v3.0.0
 * @param {string} query - Terme de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function searchJikanMangaNormalized(query, options = {}) {
  const rawResult = await searchJikanManga(query, options);
  return normalizeJikanMangaSearch(rawResult);
}

/**
 * Récupère les détails d'un manga par ID avec normalisation v3.0.0
 * @param {number} mangaId - ID MyAnimeList du manga
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getJikanMangaByIdNormalized(mangaId, options = {}) {
  const rawResult = await getJikanMangaById(mangaId, options);
  return normalizeJikanMangaDetail(rawResult);
}
