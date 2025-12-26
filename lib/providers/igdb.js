/**
 * lib/providers/igdb.js - Provider IGDB/Twitch API
 * 
 * Recherche et détails de jeux vidéo via IGDB (Twitch) API
 * Nécessite clientId:clientSecret pour l'authentification OAuth2
 * 
 * @module providers/igdb
 */

import {
  getCached,
  setCache,
  metrics
} from '../utils/state.js';

import { createLogger } from '../utils/logger.js';
import { translateText, translateGenres, extractLangCode } from '../utils/translator.js';

import {
  IGDB_BASE_URL,
  IGDB_AUTH_URL,
  IGDB_DEFAULT_MAX,
  IGDB_MAX_LIMIT
} from '../config.js';

import {
  normalizeIgdbSearch,
  normalizeIgdbGameDetail
} from '../normalizers/videogame.js';

const log = createLogger('IGDB');

// ============================================================================
// CACHE GLOBAL POUR TOKENS IGDB
// ============================================================================

const igdbTokenCache = {
  token: null,
  expiresAt: 0
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Parse les credentials IGDB depuis la clé API
 * Format attendu: "clientId:clientSecret"
 * @param {string} apiKey - Clé au format clientId:clientSecret
 * @returns {{clientId: string, clientSecret: string}}
 */
export function parseIgdbCredentials(apiKey) {
  const parts = apiKey.split(':');
  if (parts.length !== 2) {
    throw new Error("Format de clé IGDB invalide. Attendu: 'clientId:clientSecret'");
  }
  return {
    clientId: parts[0].trim(),
    clientSecret: parts[1].trim()
  };
}

/**
 * Convertit le code de catégorie de site web IGDB en nom lisible
 * @param {number} category - Code de catégorie IGDB
 * @returns {string} - Nom de la catégorie
 */
export function getIgdbWebsiteCategory(category) {
  const categories = {
    1: 'official', 2: 'wikia', 3: 'wikipedia', 4: 'facebook',
    5: 'twitter', 6: 'twitch', 8: 'instagram', 9: 'youtube',
    10: 'iphone', 11: 'ipad', 12: 'android', 13: 'steam',
    14: 'reddit', 15: 'itch', 16: 'epicgames', 17: 'gog', 18: 'discord'
  };
  return categories[category] || 'other';
}

/**
 * Convertit les codes IGDB age_rating en valeurs lisibles
 * @param {number} organization - 1=ESRB, 2=PEGI, 3=CERO, 4=USK, 5=GRAC, 6=CLASS_IND, 7=ACB
 * @param {number} ratingCategory - Code du rating (varie selon organization)
 * @returns {{system: string, rating: string, minAge: number|null}}
 */
export function parseIgdbAgeRating(organization, ratingCategory) {
  const systems = {
    1: 'ESRB',
    2: 'PEGI',
    3: 'CERO',
    4: 'USK',
    5: 'GRAC',
    6: 'CLASS_IND',
    7: 'ACB'
  };
  
  const pegiRatings = {
    1: { rating: 'PEGI 3', minAge: 3 },
    2: { rating: 'PEGI 7', minAge: 7 },
    3: { rating: 'PEGI 12', minAge: 12 },
    4: { rating: 'PEGI 16', minAge: 16 },
    5: { rating: 'PEGI 18', minAge: 18 },
    8: { rating: 'PEGI 3', minAge: 3 },
    9: { rating: 'PEGI 7', minAge: 7 },
    10: { rating: 'PEGI 12', minAge: 12 },
    11: { rating: 'PEGI 16', minAge: 16 },
    12: { rating: 'PEGI 18', minAge: 18 }
  };
  
  const esrbRatings = {
    1: { rating: 'RP', minAge: null },
    2: { rating: 'EC', minAge: 3 },
    3: { rating: 'E', minAge: 6 },
    4: { rating: 'E10+', minAge: 10 },
    5: { rating: 'T', minAge: 13 },
    6: { rating: 'M', minAge: 17 },
    7: { rating: 'AO', minAge: 18 }
  };
  
  const ceroRatings = {
    1: { rating: 'CERO A', minAge: 0 },
    2: { rating: 'CERO B', minAge: 12 },
    3: { rating: 'CERO C', minAge: 15 },
    4: { rating: 'CERO D', minAge: 17 },
    5: { rating: 'CERO Z', minAge: 18 },
    13: { rating: 'CERO A', minAge: 0 },
    14: { rating: 'CERO B', minAge: 12 },
    15: { rating: 'CERO C', minAge: 15 },
    16: { rating: 'CERO D', minAge: 17 },
    17: { rating: 'CERO Z', minAge: 18 }
  };
  
  const uskRatings = {
    1: { rating: 'USK 0', minAge: 0 },
    2: { rating: 'USK 6', minAge: 6 },
    3: { rating: 'USK 12', minAge: 12 },
    4: { rating: 'USK 16', minAge: 16 },
    5: { rating: 'USK 18', minAge: 18 },
    18: { rating: 'USK 0', minAge: 0 },
    19: { rating: 'USK 6', minAge: 6 },
    20: { rating: 'USK 12', minAge: 12 },
    21: { rating: 'USK 16', minAge: 16 },
    22: { rating: 'USK 18', minAge: 18 }
  };
  
  const acbRatings = {
    1: { rating: 'G', minAge: 0 },
    2: { rating: 'PG', minAge: 0 },
    3: { rating: 'M', minAge: 15 },
    4: { rating: 'MA 15+', minAge: 15 },
    5: { rating: 'R 18+', minAge: 18 },
    6: { rating: 'RC', minAge: null }
  };
  
  const system = systems[organization] || `Unknown (${organization})`;
  let ratingInfo = { rating: `Unknown (${ratingCategory})`, minAge: null };
  
  switch (organization) {
    case 1: ratingInfo = esrbRatings[ratingCategory] || ratingInfo; break;
    case 2: ratingInfo = pegiRatings[ratingCategory] || ratingInfo; break;
    case 3: ratingInfo = ceroRatings[ratingCategory] || ratingInfo; break;
    case 4: ratingInfo = uskRatings[ratingCategory] || ratingInfo; break;
    case 7: ratingInfo = acbRatings[ratingCategory] || ratingInfo; break;
    default: break;
  }
  
  return {
    system,
    rating: ratingInfo.rating,
    minAge: ratingInfo.minAge
  };
}

/**
 * Détermine si un jeu est multijoueur à partir des modes de jeu
 * @param {string[]} gameModes - Liste des modes
 * @returns {{isMultiplayer: boolean, modes: string[]}}
 */
export function detectMultiplayer(gameModes) {
  const multiModes = ['Multiplayer', 'Co-operative', 'Split screen', 'Massively Multiplayer Online (MMO)', 'Battle Royale'];
  const hasMulti = gameModes.some(mode => multiModes.includes(mode));
  return {
    isMultiplayer: hasMulti,
    modes: gameModes
  };
}

/**
 * Harmonise les détails d'un jeu IGDB vers un format standard
 * @param {object} rawData - Données brutes IGDB
 * @returns {object} - Données harmonisées
 */
function harmonizeIgdbGame(rawData) {
  const extractNames = (arr) => {
    if (!arr) return [];
    if (typeof arr === 'string') return [arr];
    return arr.map(item => typeof item === 'object' ? (item.name || item) : item).filter(Boolean);
  };

  const extractGenres = (arr) => {
    if (!arr) return [];
    return arr.map(item => typeof item === 'object' ? (item.name || item) : item).filter(Boolean);
  };

  const extractPlatforms = (arr) => {
    if (!arr) return [];
    return arr.map(item => typeof item === 'object' ? (item.name || item) : item).filter(Boolean);
  };

  const harmonized = {
    source: 'igdb',
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
    rating: rawData.totalRating ? Math.round(rawData.totalRating) : null,
    url: rawData.url
  };

  harmonized._raw = {
    storyline: rawData.storyline,
    aggregatedRating: rawData.aggregatedRating,
    ratingCount: rawData.ratingCount,
    cover: rawData.cover,
    artworks: rawData.artworks,
    screenshots: rawData.screenshots,
    gameModes: rawData.gameModes,
    themes: rawData.themes,
    playerPerspectives: rawData.playerPerspectives,
    keywords: rawData.keywords,
    franchises: rawData.franchises,
    collection: rawData.collection,
    ageRatings: rawData.ageRatings,
    videos: rawData.videos,
    websites: rawData.websites,
    similarGames: rawData.similarGames,
    dlcs: rawData.dlcs,
    expansions: rawData.expansions,
    parentGame: rawData.parentGame
  };

  return harmonized;
}

// ============================================================================
// IGDB API (Twitch)
// ============================================================================

/**
 * Obtient un token d'accès IGDB via OAuth2
 * @param {string} clientId - Client ID Twitch
 * @param {string} clientSecret - Client Secret Twitch
 * @returns {Promise<string>} - Token d'accès
 */
export async function getIgdbToken(clientId, clientSecret) {
  if (igdbTokenCache.token && Date.now() < igdbTokenCache.expiresAt) {
    log.debug(` Utilisation du token en cache`);
    return igdbTokenCache.token;
  }
  
  log.debug(` Obtention d'un nouveau token OAuth2...`);
  
  try {
    const url = `${IGDB_AUTH_URL}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur OAuth2 IGDB ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    igdbTokenCache.token = data.access_token;
    igdbTokenCache.expiresAt = Date.now() + ((data.expires_in - 3600) * 1000);
    
    log.debug(` ✅ Token obtenu, expire dans ${Math.floor(data.expires_in / 3600)}h`);
    return data.access_token;
    
  } catch (err) {
    log.error(` Erreur OAuth2:`, err.message);
    throw err;
  }
}

/**
 * Recherche des jeux sur IGDB
 * @param {string} query - Terme de recherche
 * @param {string} clientId - Client ID Twitch
 * @param {string} accessToken - Token OAuth2
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchIgdb(query, clientId, accessToken, options = {}) {
  const { max = IGDB_DEFAULT_MAX, platforms = null, genres = null } = options;
  
  const cacheKey = `igdb_search_${query}_${max}_${platforms}_${genres}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(` Cache hit: ${query}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(` Recherche: "${query}" (max ${max})`);
  metrics.sources.igdb = metrics.sources.igdb || { requests: 0, errors: 0 };
  metrics.sources.igdb.requests++;
  
  try {
    let body = `search "${query}";`;
    body += `fields id,name,slug,summary,rating,aggregated_rating,total_rating,first_release_date,`;
    body += `cover.image_id,genres.name,platforms.name,platforms.abbreviation,`;
    body += `involved_companies.company.name,involved_companies.developer,involved_companies.publisher,`;
    body += `screenshots.image_id,videos.video_id,game_modes.name,themes.name;`;
    body += `limit ${Math.min(max, IGDB_MAX_LIMIT)};`;
    
    let filters = [];
    if (platforms) filters.push(`platforms = (${platforms})`);
    if (genres) filters.push(`genres = (${genres})`);
    if (filters.length > 0) body += `where ${filters.join(' & ')};`;
    
    const response = await fetch(`${IGDB_BASE_URL}/games`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Client-ID': clientId,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/plain'
      },
      body: body
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur IGDB API ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    const result = {
      source: "igdb",
      query: query,
      count: data.length,
      games: data.map(game => {
        const developers = game.involved_companies?.filter(ic => ic.developer)?.map(ic => ic.company?.name) || [];
        const publishers = game.involved_companies?.filter(ic => ic.publisher)?.map(ic => ic.company?.name) || [];
        
        return {
          id: game.id,
          slug: game.slug,
          name: game.name,
          image: game.cover ? [`https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`] : [],
          summary: game.summary || null,
          thumb: game.cover ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg` : null,
          rating: game.rating ? Math.round(game.rating * 10) / 10 : null,
          aggregatedRating: game.aggregated_rating ? Math.round(game.aggregated_rating * 10) / 10 : null,
          totalRating: game.total_rating ? Math.round(game.total_rating * 10) / 10 : null,
          releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : null,
          cover: game.cover ? {
            imageId: game.cover.image_id,
            thumbnail: `https://images.igdb.com/igdb/image/upload/t_thumb/${game.cover.image_id}.jpg`,
            coverSmall: `https://images.igdb.com/igdb/image/upload/t_cover_small/${game.cover.image_id}.jpg`,
            coverBig: `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`,
            hd: `https://images.igdb.com/igdb/image/upload/t_720p/${game.cover.image_id}.jpg`
          } : null,
          genres: game.genres?.map(g => g.name) || [],
          platforms: game.platforms?.map(p => ({ name: p.name, abbreviation: p.abbreviation })) || [],
          developers: developers,
          publishers: publishers,
          gameModes: game.game_modes?.map(m => m.name) || [],
          themes: game.themes?.map(t => t.name) || [],
          screenshots: game.screenshots?.slice(0, 5).map(s => ({
            imageId: s.image_id,
            thumbnail: `https://images.igdb.com/igdb/image/upload/t_thumb/${s.image_id}.jpg`,
            full: `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`
          })) || [],
          videos: game.videos?.map(v => ({
            videoId: v.video_id,
            youtubeUrl: `https://www.youtube.com/watch?v=${v.video_id}`
          })) || [],
          url: `https://www.igdb.com/games/${game.slug}`
        };
      })
    };
    
    log.debug(` ✅ ${result.count} jeux trouvés`);
    setCache(cacheKey, result);
    return result;
    
  } catch (err) {
    metrics.sources.igdb.errors++;
    throw err;
  }
}

/**
 * Récupère les détails d'un jeu sur IGDB
 * @param {string|number} gameId - ID ou slug du jeu
 * @param {string} clientId - Client ID Twitch
 * @param {string} accessToken - Token OAuth2
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails du jeu harmonisés
 */
export async function getIgdbGameDetails(gameId, clientId, accessToken, options = {}) {
  const { lang = null, autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `igdb_game_${gameId}_${shouldTranslate ? 'trad_' + destLang : 'notrad'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    log.debug(` Cache hit: ${gameId}`);
    metrics.requests.cached++;
    return cached;
  }
  
  log.debug(` Récupération détails: ${gameId}`);
  metrics.sources.igdb = metrics.sources.igdb || { requests: 0, errors: 0 };
  metrics.sources.igdb.requests++;
  
  try {
    const isNumeric = /^\d+$/.test(String(gameId));
    let whereClause = isNumeric ? `where id = ${gameId};` : `where slug = "${gameId}";`;
    
    let body = `fields id,name,slug,summary,storyline,rating,aggregated_rating,total_rating,`;
    body += `rating_count,first_release_date,`;
    body += `cover.image_id,artworks.image_id,screenshots.image_id,`;
    body += `genres.name,platforms.name,platforms.abbreviation,`;
    body += `involved_companies.company.name,involved_companies.developer,involved_companies.publisher,`;
    body += `game_modes.name,themes.name,player_perspectives.name,keywords.name,`;
    body += `franchises.name,collection.name,age_ratings.*,`;
    body += `videos.name,videos.video_id,websites.url,websites.category,`;
    body += `similar_games.name,similar_games.slug,similar_games.cover.image_id,`;
    body += `dlcs.name,dlcs.slug,expansions.name,expansions.slug,parent_game.name,parent_game.slug;`;
    body += whereClause;
    
    const response = await fetch(`${IGDB_BASE_URL}/games`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Client-ID': clientId,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/plain'
      },
      body: body
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur IGDB API ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error(`Jeu ${gameId} non trouvé sur IGDB`);
    }
    
    const game = data[0];
    const developers = game.involved_companies?.filter(ic => ic.developer)?.map(ic => ic.company?.name) || [];
    const publishers = game.involved_companies?.filter(ic => ic.publisher)?.map(ic => ic.company?.name) || [];
    const gameModes = game.game_modes?.map(m => m.name) || [];
    const multiplayerInfo = detectMultiplayer(gameModes);
    
    // Parser les age ratings
    const ageRatings = game.age_ratings?.map(ar => parseIgdbAgeRating(ar.organization, ar.rating_category)) || [];
    
    // Extraire PEGI en priorité, sinon ESRB
    const pegiRating = ageRatings.find(r => r.system === 'PEGI');
    const esrbRating = ageRatings.find(r => r.system === 'ESRB');
    const primaryRating = pegiRating || esrbRating || ageRatings[0] || null;
    
    // Construire la liste d'images harmonisée
    const imageList = [];
    if (game.cover?.image_id) {
      imageList.push(`https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`);
    }
    game.artworks?.slice(0, 5).forEach(a => {
      if (a.image_id) imageList.push(`https://images.igdb.com/igdb/image/upload/t_720p/${a.image_id}.jpg`);
    });
    game.screenshots?.slice(0, 5).forEach(s => {
      if (s.image_id) imageList.push(`https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`);
    });
    
    // Genres originaux
    const genresList = game.genres?.map(g => g.name) || [];
    const summaryOriginal = game.summary || null;
    
    // Applique la traduction si demandée
    let finalSummary = summaryOriginal;
    let summaryTranslated = null;
    let genresTranslated = null;
    
    if (shouldTranslate && destLang) {
      // Traduit le résumé
      if (summaryOriginal) {
        const result = await translateText(summaryOriginal, destLang, { enabled: true });
        if (result.translated) {
          finalSummary = result.text;
          summaryTranslated = result.text;
        }
      }
      
      // Traduit les genres
      if (genresList.length > 0) {
        genresTranslated = await translateGenres(genresList, destLang, 'videogame');
      }
    }
    
    const result = {
      source: "igdb",
      id: game.id,
      slug: game.slug,
      name: game.name,
      image: imageList,
      summary: finalSummary,
      summaryOriginal: summaryOriginal,
      summaryTranslated: summaryTranslated,
      storyline: game.storyline || null,
      rating: game.rating ? Math.round(game.rating * 10) / 10 : null,
      aggregatedRating: game.aggregated_rating ? Math.round(game.aggregated_rating * 10) / 10 : null,
      totalRating: game.total_rating ? Math.round(game.total_rating * 10) / 10 : null,
      ratingCount: game.rating_count || 0,
      releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : null,
      cover: game.cover ? {
        imageId: game.cover.image_id,
        thumbnail: `https://images.igdb.com/igdb/image/upload/t_thumb/${game.cover.image_id}.jpg`,
        coverSmall: `https://images.igdb.com/igdb/image/upload/t_cover_small/${game.cover.image_id}.jpg`,
        coverBig: `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`,
        hd: `https://images.igdb.com/igdb/image/upload/t_720p/${game.cover.image_id}.jpg`,
        fullHd: `https://images.igdb.com/igdb/image/upload/t_1080p/${game.cover.image_id}.jpg`
      } : null,
      artworks: game.artworks?.map(a => ({
        imageId: a.image_id,
        thumbnail: `https://images.igdb.com/igdb/image/upload/t_thumb/${a.image_id}.jpg`,
        hd: `https://images.igdb.com/igdb/image/upload/t_720p/${a.image_id}.jpg`
      })) || [],
      screenshots: game.screenshots?.map(s => ({
        imageId: s.image_id,
        thumbnail: `https://images.igdb.com/igdb/image/upload/t_thumb/${s.image_id}.jpg`,
        big: `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`
      })) || [],
      genres: genresTranslated || genresList,
      genresOriginal: genresList,
      genresTranslated: genresTranslated,
      platforms: game.platforms?.map(p => ({ name: p.name, abbreviation: p.abbreviation })) || [],
      developers: developers,
      publishers: publishers,
      gameModes: gameModes,
      isMultiplayer: multiplayerInfo.isMultiplayer,
      themes: game.themes?.map(t => t.name) || [],
      playerPerspectives: game.player_perspectives?.map(p => p.name) || [],
      keywords: game.keywords?.map(k => k.name) || [],
      franchises: game.franchises?.map(f => f.name) || [],
      collection: game.collection?.name || null,
      ageRatings: ageRatings,
      pegi: primaryRating ? primaryRating.rating : null,
      minAge: primaryRating ? primaryRating.minAge : null,
      videos: game.videos?.map(v => ({
        name: v.name,
        videoId: v.video_id,
        youtubeUrl: `https://www.youtube.com/watch?v=${v.video_id}`
      })) || [],
      websites: game.websites?.map(w => ({
        url: w.url,
        category: getIgdbWebsiteCategory(w.category)
      })) || [],
      similarGames: game.similar_games?.slice(0, 10).map(sg => ({
        name: sg.name,
        slug: sg.slug,
        cover: sg.cover ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${sg.cover.image_id}.jpg` : null,
        url: `https://www.igdb.com/games/${sg.slug}`
      })) || [],
      dlcs: game.dlcs?.map(d => ({ name: d.name, slug: d.slug })) || [],
      expansions: game.expansions?.map(e => ({ name: e.name, slug: e.slug })) || [],
      parentGame: game.parent_game ? { name: game.parent_game.name, slug: game.parent_game.slug } : null,
      url: `https://www.igdb.com/games/${game.slug}`
    };
    
    const harmonized = harmonizeIgdbGame(result);
    
    log.debug(` ✅ Jeu récupéré: ${result.name}`);
    setCache(cacheKey, harmonized);
    return harmonized;
    
  } catch (err) {
    metrics.sources.igdb.errors++;
    throw err;
  }
}

// ============================================================================
// FONCTIONS NORMALISÉES (v3.0.0)
// ============================================================================

/**
 * Recherche IGDB avec résultat normalisé v3.0.0
 * @param {string} query - Terme de recherche
 * @param {string} twitchCredentials - clientId:clientSecret
 * @param {Object} options - Options de recherche
 * @returns {Promise<Object>} Résultat normalisé
 */
export async function searchIgdbNormalized(query, twitchCredentials, options = {}) {
  const rawResult = await searchIgdb(query, twitchCredentials, options);
  return normalizeIgdbSearch(rawResult);
}

/**
 * Détails d'un jeu IGDB avec résultat normalisé v3.0.0
 * @param {string} slug - Slug du jeu
 * @param {string} twitchCredentials - clientId:clientSecret
 * @returns {Promise<Object>} Détail normalisé
 */
export async function getIgdbGameDetailsNormalized(slug, twitchCredentials) {
  const rawResult = await getIgdbGameDetails(slug, twitchCredentials);
  return normalizeIgdbGameDetail(rawResult);
}
