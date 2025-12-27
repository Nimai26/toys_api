/**
 * lib/providers/rawg.js - Provider RAWG API
 * 
 * Recherche et détails de jeux vidéo via RAWG.io API
 * 
 * @module providers/rawg
 */

import {
  getCached,
  setCache,
  metrics
} from '../utils/state.js';

import { createLogger } from '../utils/logger.js';
import { translateText, translateGenres, extractLangCode } from '../utils/translator.js';

import {
  RAWG_BASE_URL,
  RAWG_DEFAULT_MAX,
  RAWG_MAX_LIMIT,
  USER_AGENT
} from '../config.js';

// Import des normalizers videogame
import {
  normalizeRawgSearch,
  normalizeRawgGameDetail
} from '../normalizers/videogame.js';

const log = createLogger('RAWG');

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Harmonise les détails d'un jeu RAWG vers un format standard
 * @param {object} rawData - Données brutes RAWG
 * @returns {object} - Données harmonisées
 */
export function harmonizeRawgGame(rawData) {
  const extractNames = (arr) => {
    if (!arr) return [];
    if (typeof arr === 'string') return [arr];
    if (!Array.isArray(arr)) return [];
    return arr.map(item => typeof item === 'object' ? (item.name || item) : item).filter(Boolean);
  };

  const extractGenres = (arr) => {
    if (!arr || !Array.isArray(arr)) return [];
    return arr.map(item => typeof item === 'object' ? (item.name || item) : item).filter(Boolean);
  };

  const extractPlatforms = (arr) => {
    if (!arr || !Array.isArray(arr)) return [];
    return arr.map(item => typeof item === 'object' ? (item.name || item) : item).filter(Boolean);
  };

  const normalizeRating = (rating) => {
    if (rating == null) return null;
    return Math.round(rating * 20);
  };

  const harmonized = {
    source: 'rawg',
    id: rawData.id,
    slug: rawData.slug || null,
    title: rawData.title || rawData.name,
    image: rawData.image || [],
    synopsis: rawData.synopsis || rawData.summary || rawData.description || null,
    releaseDate: rawData.releaseDate || rawData.released || null,
    platforms: extractPlatforms(rawData.platforms),
    genres: extractGenres(rawData.genres),
    developers: extractNames(rawData.developers || (rawData.developer ? [rawData.developer] : [])),
    publishers: extractNames(rawData.publishers || (rawData.publisher ? [rawData.publisher] : [])),
    pegi: rawData.pegi || null,
    minAge: rawData.minAge || null,
    isMultiplayer: rawData.isMultiplayer || false,
    rating: normalizeRating(rawData.rating),
    url: rawData.url
  };

  harmonized._raw = {
    nameOriginal: rawData.nameOriginal,
    metacritic: rawData.metacritic,
    metacriticPlatforms: rawData.metacriticPlatforms,
    playtime: rawData.playtime,
    achievementsCount: rawData.achievementsCount,
    ratingsCount: rawData.ratingsCount,
    reviewsCount: rawData.reviewsCount,
    ratings: rawData.ratings,
    stores: rawData.stores,
    tags: rawData.tags,
    esrbRating: rawData.esrbRating,
    clip: rawData.clip,
    website: rawData.website,
    backgroundImage: rawData.backgroundImage,
    backgroundImageAdditional: rawData.backgroundImageAdditional,
    tba: rawData.tba,
    updated: rawData.updated
  };

  return harmonized;
}

// ============================================================================
// RAWG API
// ============================================================================

/**
 * Recherche des jeux sur RAWG
 * @param {string} query - Terme de recherche
 * @param {string} apiKey - Clé API RAWG
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchRawg(query, apiKey, options = {}) {
  const {
    max = RAWG_DEFAULT_MAX,
    page = 1,
    platforms = null,
    genres = null,
    ordering = null,
    dates = null,
    metacritic = null
  } = options;
  
  const cacheKey = `rawg_search_${query}_${max}_${page}_${platforms}_${ordering}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(` Cache hit: ${query}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(` Recherche: "${query}" (page ${page}, max ${max})`);
  metrics.sources.rawg = metrics.sources.rawg || { requests: 0, errors: 0 };
  metrics.sources.rawg.requests++;
  
  try {
    const params = new URLSearchParams({
      key: apiKey,
      search: query,
      page_size: Math.min(max, RAWG_MAX_LIMIT),
      page: page
    });
    
    if (platforms) params.append('platforms', platforms);
    if (genres) params.append('genres', genres);
    if (ordering) params.append('ordering', ordering);
    if (dates) params.append('dates', dates);
    if (metacritic) params.append('metacritic', metacritic);
    
    const url = `${RAWG_BASE_URL}/games?${params.toString()}`;
    log.debug(` URL: ${url.replace(apiKey, '***')}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur RAWG API ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    const result = {
      source: "rawg",
      query: query,
      page: page,
      pageSize: Math.min(max, RAWG_MAX_LIMIT),
      totalResults: data.count || 0,
      totalPages: Math.ceil((data.count || 0) / Math.min(max, RAWG_MAX_LIMIT)),
      hasNext: !!data.next,
      hasPrevious: !!data.previous,
      count: data.results?.length || 0,
      games: (data.results || []).map(game => ({
        id: game.id,
        slug: game.slug,
        name: game.name,
        image: game.background_image ? [game.background_image] : [],
        released: game.released,
        thumb: game.background_image,
        backgroundImage: game.background_image,
        rating: game.rating,
        ratingTop: game.rating_top,
        ratingsCount: game.ratings_count,
        metacritic: game.metacritic,
        playtime: game.playtime,
        platforms: game.platforms?.map(p => ({
          id: p.platform?.id,
          name: p.platform?.name,
          slug: p.platform?.slug
        })) || [],
        genres: game.genres?.map(g => ({
          id: g.id,
          name: g.name,
          slug: g.slug
        })) || [],
        esrbRating: game.esrb_rating ? {
          id: game.esrb_rating.id,
          name: game.esrb_rating.name,
          slug: game.esrb_rating.slug
        } : null,
        shortScreenshots: game.short_screenshots?.map(s => s.image) || [],
        url: `https://rawg.io/games/${game.slug}`
      }))
    };
    
    log.debug(` ✅ ${result.count} jeux trouvés sur ${result.totalResults} total`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.rawg.errors++;
    throw err;
  }
}

/**
 * Récupère les détails d'un jeu sur RAWG
 * @param {string|number} gameId - ID ou slug du jeu
 * @param {string} apiKey - Clé API RAWG
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails du jeu harmonisés
 */
export async function getRawgGameDetails(gameId, apiKey, options = {}) {
  const { lang = null, autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `rawg_game_${gameId}_${shouldTranslate ? 'trad_' + destLang : 'notrad'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(` Cache hit: ${gameId}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(` Récupération détails: ${gameId}`);
  metrics.sources.rawg = metrics.sources.rawg || { requests: 0, errors: 0 };
  metrics.sources.rawg.requests++;
  
  try {
    const url = `${RAWG_BASE_URL}/games/${gameId}?key=${apiKey}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Jeu ${gameId} non trouvé sur RAWG`);
      }
      throw new Error(`Erreur RAWG API: ${response.status}`);
    }
    
    const game = await response.json();
    
    // Détecter le multijoueur à partir des tags
    const multiTags = ['multiplayer', 'co-op', 'online-co-op', 'local-co-op', 'split-screen', 'mmo', 'massively-multiplayer', 'online-multiplayer', 'local-multiplayer', 'pvp', 'battle-royale'];
    const tags = game.tags?.map(t => t.slug) || [];
    const isMultiplayer = tags.some(tag => multiTags.includes(tag));
    
    // Convertir ESRB en âge minimum
    const esrbToMinAge = {
      'everyone': 6,
      'everyone-10-plus': 10,
      'teen': 13,
      'mature': 17,
      'adults-only': 18,
      'rating-pending': null,
      'early-childhood': 3
    };
    const minAge = game.esrb_rating ? (esrbToMinAge[game.esrb_rating.slug] || null) : null;
    
    const imageList = [game.background_image, game.background_image_additional].filter(Boolean);
    
    // Description et genres originaux
    const descriptionOriginal = game.description_raw || game.description || null;
    const genresList = game.genres?.map(g => g.name) || [];
    
    // Applique la traduction si demandée
    let finalDescription = descriptionOriginal;
    let descriptionTranslated = null;
    let genresTranslated = null;
    
    if (shouldTranslate && destLang) {
      // Traduit la description
      if (descriptionOriginal) {
        const result = await translateText(descriptionOriginal, destLang, { enabled: true });
        if (result.translated) {
          finalDescription = result.text;
          descriptionTranslated = result.text;
        }
      }
      
      // Traduit les genres
      if (genresList.length > 0) {
        genresTranslated = await translateGenres(genresList, destLang, 'videogame');
      }
    }
    
    const result = {
      source: "rawg",
      id: game.id,
      slug: game.slug,
      name: game.name,
      image: imageList,
      nameOriginal: game.name_original,
      description: finalDescription,
      descriptionOriginal: descriptionOriginal,
      descriptionTranslated: descriptionTranslated,
      released: game.released,
      tba: game.tba,
      backgroundImage: game.background_image,
      backgroundImageAdditional: game.background_image_additional,
      website: game.website,
      rating: game.rating,
      ratingTop: game.rating_top,
      ratings: game.ratings?.map(r => ({
        id: r.id,
        title: r.title,
        count: r.count,
        percent: r.percent
      })) || [],
      ratingsCount: game.ratings_count,
      reviewsCount: game.reviews_count,
      metacritic: game.metacritic,
      metacriticPlatforms: game.metacritic_platforms?.map(m => ({
        platform: m.platform?.name,
        score: m.metascore,
        url: m.url
      })) || [],
      playtime: game.playtime,
      achievementsCount: game.achievements_count,
      platforms: game.platforms?.map(p => ({
        id: p.platform?.id,
        name: p.platform?.name,
        slug: p.platform?.slug,
        requirements: p.requirements || null,
        releasedAt: p.released_at
      })) || [],
      genres: genresTranslated || genresList,
      genresOriginal: genresList,
      genresTranslated: genresTranslated,
      genresFull: game.genres?.map(g => ({
        id: g.id,
        name: g.name,
        slug: g.slug
      })) || [],
      stores: game.stores?.map(s => ({
        id: s.store?.id,
        name: s.store?.name,
        slug: s.store?.slug,
        url: s.url
      })) || [],
      developers: game.developers?.map(d => ({
        id: d.id,
        name: d.name,
        slug: d.slug
      })) || [],
      publishers: game.publishers?.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug
      })) || [],
      tags: game.tags?.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        language: t.language
      })) || [],
      isMultiplayer: isMultiplayer,
      esrbRating: game.esrb_rating ? {
        id: game.esrb_rating.id,
        name: game.esrb_rating.name,
        slug: game.esrb_rating.slug
      } : null,
      pegi: game.esrb_rating ? game.esrb_rating.name : null,
      minAge: minAge,
      clip: game.clip ? {
        video: game.clip.clip,
        preview: game.clip.preview
      } : null,
      updated: game.updated,
      url: `https://rawg.io/games/${game.slug}`
    };
    
    const harmonized = harmonizeRawgGame(result);
    
    log.debug(` ✅ Jeu récupéré: ${result.name}`);
    setCache(cacheKey, harmonized);
    return harmonized;
    
  } catch (err) {
    metrics.sources.rawg.errors++;
    throw err;
  }
}

// ============================================================================
// FONCTIONS NORMALISÉES (v3.0.0)
// ============================================================================

/**
 * Recherche RAWG avec résultat normalisé v3.0.0
 * @param {string} query - Terme de recherche
 * @param {string} apiKey - Clé API RAWG
 * @param {Object} options - Options de recherche
 * @returns {Promise<Object>} Résultat normalisé
 */
export async function searchRawgNormalized(query, apiKey, options = {}) {
  const rawResult = await searchRawg(query, apiKey, options);
  return normalizeRawgSearch(rawResult);
}

/**
 * Détails d'un jeu RAWG avec résultat normalisé v3.0.0
 * @param {string|number} gameId - ID ou slug du jeu
 * @param {string} apiKey - Clé API RAWG
 * @param {Object} options - Options (lang, autoTrad)
 * @returns {Promise<Object>} Détail normalisé
 */
export async function getRawgGameDetailsNormalized(gameId, apiKey, options = {}) {
  const rawResult = await getRawgGameDetails(gameId, apiKey, options);
  return normalizeRawgGameDetail(rawResult);
}
