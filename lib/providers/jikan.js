/**
 * lib/providers/jikan.js - Provider Jikan (MyAnimeList)
 * 
 * API gratuite pour anime et manga via MyAnimeList
 * Pas de clé API requise
 * 
 * @module providers/jikan
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import {
  JIKAN_BASE_URL,
  JIKAN_DEFAULT_MAX,
  JIKAN_MAX_LIMIT
} from '../config.js';

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
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: anime ${query}`);
    metrics.requests.cached++;
    return cached;
  }
  
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
    
    const response = await fetch(url, {
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
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.jikan.errors++;
    throw err;
  }
}

/**
 * Récupère les détails d'un anime par ID MyAnimeList
 * @param {number} animeId - ID MyAnimeList de l'anime
 * @returns {Promise<object>} - Détails de l'anime
 */
export async function getJikanAnimeById(animeId) {
  const cacheKey = `jikan_anime_detail_${animeId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: anime detail ${animeId}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Récupération anime: ${animeId}`);
  metrics.sources.jikan.requests++;
  
  try {
    const url = `${JIKAN_BASE_URL}/anime/${animeId}/full`;
    
    const response = await fetch(url, {
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
    
    const result = {
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
      genres: (item.genres || []).map(g => ({ id: g.mal_id, name: g.name })),
      themes: (item.themes || []).map(t => ({ id: t.mal_id, name: t.name })),
      demographics: (item.demographics || []).map(d => ({ id: d.mal_id, name: d.name })),
      relations: (item.relations || []).map(r => ({
        relation: r.relation,
        entries: (r.entry || []).map(e => ({ id: e.mal_id, type: e.type, name: e.name, url: e.url }))
      })),
      streaming: (item.streaming || []).map(s => ({ name: s.name, url: s.url })),
      external: (item.external || []).map(e => ({ name: e.name, url: e.url })),
      poster: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || null,
      posterSmall: item.images?.jpg?.small_image_url || null,
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
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.jikan.errors++;
    throw err;
  }
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
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: manga ${query}`);
    metrics.requests.cached++;
    return cached;
  }
  
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
    
    const response = await fetch(url, {
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
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.jikan.errors++;
    throw err;
  }
}

/**
 * Récupère les détails d'un manga par ID MyAnimeList
 * @param {number} mangaId - ID MyAnimeList du manga
 * @returns {Promise<object>} - Détails du manga
 */
export async function getJikanMangaById(mangaId) {
  const cacheKey = `jikan_manga_detail_${mangaId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(`Cache hit: manga detail ${mangaId}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(`Récupération manga: ${mangaId}`);
  metrics.sources.jikan.requests++;
  
  try {
    const url = `${JIKAN_BASE_URL}/manga/${mangaId}/full`;
    
    const response = await fetch(url, {
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
    
    const authorNames = (item.authors || []).map(a => a.name);
    const genreNames = (item.genres || []).map(g => g.name);
    const editorNames = (item.serializations || []).map(s => s.name);
    const imageArray = [item.images?.jpg?.large_image_url, item.images?.jpg?.image_url, item.images?.jpg?.small_image_url].filter(Boolean);
    
    const result = {
      id: item.mal_id,
      type: item.type,
      title: item.title,
      originalTitle: item.title_japanese || null,
      authors: authorNames,
      editors: editorNames,
      releaseDate: item.published?.from || null,
      genres: genreNames,
      pages: null,
      serie: null,
      synopsis: item.synopsis,
      language: 'ja',
      tome: item.volumes || null,
      image: imageArray,
      isbn: null,
      price: null,
      chapters: item.chapters,
      status: item.status,
      score: item.score,
      rank: item.rank,
      popularity: item.popularity,
      url: item.url,
      source: "jikan_manga"
    };
    
    log.debug(`✅ Manga récupéré: ${result.title}`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.jikan.errors++;
    throw err;
  }
}
