/**
 * lib/providers/jvc.js - Provider JeuxVideo.com
 * 
 * Recherche et détails de jeux vidéo via JeuxVideo.com (scraping via FlareSolverr)
 * 
 * @module providers/jvc
 */

import {
  metrics
} from '../utils/state.js';

import { createLogger } from '../utils/logger.js';
import { decodeHtmlEntities } from '../utils/helpers.js';
import { fetchViaProxy } from '../utils/fetch-proxy.js';

import {
  JVC_BASE_URL,
  JVC_DEFAULT_MAX,
  FSR_BASE
} from '../config.js';

import {
  getFsrSessionId
} from '../utils/flaresolverr.js';

import {
  normalizeJvcSearch,
  normalizeJvcGameDetail
} from '../normalizers/videogame.js';

const log = createLogger('JVC');

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Harmonise les détails d'un jeu JVC vers un format standard
 * @param {object} rawData - Données brutes JVC
 * @returns {object} - Données harmonisées
 */
export function harmonizeJvcGame(rawData) {
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

  const normalizeRating = (rating) => {
    if (rating == null) return null;
    return Math.round(rating * 5);
  };

  const harmonized = {
    source: 'jvc',
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
    media: rawData.media || null,
    rating: normalizeRating(rawData.ratings?.test),
    url: rawData.url
  };

  harmonized._raw = {
    cover: rawData.cover,
    nbPlayers: rawData.nbPlayers,
    ratings: rawData.ratings,
    testUrl: rawData.testUrl
  };

  return harmonized;
}

// ============================================================================
// JVC (JeuxVideo.com) - Scraping via FlareSolverr
// ============================================================================

/**
 * Recherche de jeux sur JeuxVideo.com
 * @param {string} query - Terme de recherche
 * @param {object} options - Options { max }
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchJVC(query, options = {}) {
  metrics.sources.jvc = metrics.sources.jvc || { requests: 0, errors: 0 };
  metrics.sources.jvc.requests++;
  const max = Math.min(options.max || JVC_DEFAULT_MAX, 50);
  
  const cacheKey = `jvc_search_${query}_${max}`;

  try {
    log.debug(`Recherche: ${query} (max: ${max})`);
    
    // URL de recherche JVC avec m=9 pour filtrer uniquement les jeux
    const searchUrl = `${JVC_BASE_URL}/rechercher.php?m=9&q=${encodeURIComponent(query)}`;
    const fsrSessionId = getFsrSessionId();
    
    const response = await fetchViaProxy(FSR_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get",
        url: searchUrl,
        maxTimeout: 30000,
        session: fsrSessionId
      })
    });

    const data = await response.json();
    
    if (data.status !== "ok") {
      throw new Error(`FlareSolverr error: ${data.message || 'Unknown error'}`);
    }

    const html = data.solution?.response || "";
    
    // Parser les résultats de recherche (nouvelle structure 2024)
    const results = [];
    const seenIds = new Set();
    
    // Regex pour extraire les blocs de jeux complets
    // On capture : ID, titre, plateforme, image
    const cardRegex = /<div class="card card--small[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/gi;
    
    // Regex individuels pour chaque élément
    const idTitleRegex = /href="\/jeux\/jeu-(\d+)\/"[^>]*class="[^"]*stretched-link[^"]*"[^>]*>\s*([^<]+)\s*<\/a>/i;
    const platformRegex = /card__contentType">([^<]+)</i;
    const imgRegex = /<img[^>]*src="(https:\/\/image\.jeuxvideo\.com[^"]+)"/i;
    
    let cardMatch;
    while ((cardMatch = cardRegex.exec(html)) !== null) {
      const cardHtml = cardMatch[1];
      
      const idTitleMatch = idTitleRegex.exec(cardHtml);
      if (idTitleMatch) {
        const id = idTitleMatch[1];
        const title = decodeHtmlEntities(idTitleMatch[2].trim());
        
        if (!seenIds.has(id)) {
          seenIds.add(id);
          
          const platformMatch = platformRegex.exec(cardHtml);
          const imgMatch = imgRegex.exec(cardHtml);
          
          const coverUrl = imgMatch ? imgMatch[1].replace('-xs/', '-md/') : null; // Utiliser taille moyenne
          
          results.push({
            id: parseInt(id),
            type: 'game',
            title,
            description: null,
            releaseDate: null,
            platform: platformMatch ? platformMatch[1].trim() : null,
            image: coverUrl ? [coverUrl] : [],
            thumb: coverUrl,
            cover: coverUrl,
            url: `${JVC_BASE_URL}/jeux/jeu-${id}/`,
            source: 'jvc'
          });
          
          if (results.length >= max) break;
        }
      }
    }

    const result = {
      query,
      resultsCount: results.length,
      results,
      source: 'jvc',
      note: 'Résultats en français depuis JeuxVideo.com'
    };

    log.info(`✅ ${results.length} jeux trouvés pour "${query}"`);
    return result;

  } catch (err) {
    metrics.sources.jvc.errors++;
    log.error(`Erreur recherche JVC: ${err.message}`);
    throw err;
  }
}

/**
 * Récupère les détails d'un jeu sur JeuxVideo.com par ID
 * @param {string|number} gameId - ID du jeu
 * @returns {Promise<object>} - Détails du jeu harmonisés
 */
export async function getJVCGameById(gameId) {
  metrics.sources.jvc = metrics.sources.jvc || { requests: 0, errors: 0 };
  metrics.sources.jvc.requests++;
  
  const cacheKey = `jvc_game_${gameId}`;

  try {
    log.debug(` Récupération jeu: ${gameId}`);
    
    const gameUrl = `${JVC_BASE_URL}/jeux/jeu-${gameId}/`;
    const fsrSessionId = getFsrSessionId();
    
    const response = await fetchViaProxy(FSR_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get",
        url: gameUrl,
        maxTimeout: 30000,
        session: fsrSessionId
      })
    });

    const data = await response.json();
    
    if (data.status !== "ok") {
      throw new Error(`FlareSolverr error: ${data.message || 'Unknown error'}`);
    }

    const html = data.solution?.response || "";
    
    // Extraire le titre
    const titleMatch = html.match(/gameHeaderBanner__title[^>]*>([^<]+)/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;
    
    if (!title) {
      throw new Error(`Jeu non trouvé: ${gameId}`);
    }
    
    // Extraire les données structurées
    let genres = [];
    let publisher = null;
    let developer = null;
    let releaseDate = null;
    let pegi = null;
    let platforms = [];
    let nbPlayers = null;
    let isMultiplayer = false;
    
    // Parser analyticsMetadata
    const analyticsMatch = html.match(/window\.jvc\.analyticsMetadata\s*=\s*(\{[^}]+\})/i);
    if (analyticsMatch) {
      try {
        const analytics = JSON.parse(analyticsMatch[1]);
        if (analytics.genre_tags_name) {
          genres = analytics.genre_tags_name.split('|').map(g => g.trim()).filter(g => g);
        }
        if (analytics.publisher_tags_name) {
          publisher = analytics.publisher_tags_name;
        }
        if (analytics.developer_tags_name) {
          developer = analytics.developer_tags_name;
        }
        if (analytics.masterfiche_game_release_date) {
          releaseDate = analytics.masterfiche_game_release_date;
        }
        if (analytics.pegi_tags_name) {
          pegi = analytics.pegi_tags_name;
        }
      } catch (e) {
        log.debug(` Erreur parsing analyticsMetadata: ${e.message}`);
      }
    }
    
    // Parser dataLayer pour les plateformes
    const dataLayerMatch = html.match(/dataLayer\s*=\s*\[(\{[^}]+\})\]/i);
    if (dataLayerMatch) {
      try {
        const dataLayer = JSON.parse(dataLayerMatch[1]);
        if (dataLayer.platform && Array.isArray(dataLayer.platform)) {
          const platformMap = {
            'switch': 'Nintendo Switch',
            'switch-2': 'Nintendo Switch 2',
            'wiiu': 'Wii U',
            'ps5': 'PlayStation 5',
            'ps4': 'PlayStation 4',
            'ps3': 'PlayStation 3',
            'xboxone': 'Xbox One',
            'xboxseries': 'Xbox Series X|S',
            'pc': 'PC',
            '3ds': 'Nintendo 3DS',
            'vita': 'PS Vita',
            'android': 'Android',
            'ios': 'iOS',
            'stadia': 'Stadia',
            'luna': 'Amazon Luna'
          };
          platforms = dataLayer.platform.map(p => platformMap[p.toLowerCase()] || p.toUpperCase());
        }
        if (!developer && dataLayer.game_developer && Array.isArray(dataLayer.game_developer)) {
          developer = dataLayer.game_developer[0];
        }
      } catch (e) {
        log.debug(` Erreur parsing dataLayer: ${e.message}`);
      }
    }
    
    // Fallback: extraire le développeur depuis le HTML
    if (!developer) {
      const devMatch = html.match(/Développeur[^:]*:\s*<[^>]+>([^<]+)</i) ||
                       html.match(/developer[^"]*"[^>]*>([^<]+)</i);
      if (devMatch) {
        developer = decodeHtmlEntities(devMatch[1].trim());
      }
    }
    
    // Extraire le nombre de joueurs
    const playersMatch = html.match(/Nombre de joueurs[^:]*:\s*<[^>]*>([^<]+)</i) ||
                         html.match(/Nombre de joueurs[^:]*:\s*([0-9][^<]*)</i) ||
                         html.match(/"nb_players"\s*:\s*"([^"]+)"/i);
    if (playersMatch) {
      const rawPlayers = playersMatch[1].trim();
      if (/\d/.test(rawPlayers) && rawPlayers.length < 50) {
        nbPlayers = rawPlayers;
        const numMatch = nbPlayers.match(/(\d+)\s*(?:à|-)?\s*(\d+)?/);
        if (numMatch) {
          const maxPlayers = parseInt(numMatch[2] || numMatch[1]);
          isMultiplayer = maxPlayers > 1;
        }
        if (/multijoueur|multi|en ligne|online|coop|co-op/i.test(nbPlayers)) {
          isMultiplayer = true;
        }
      }
    }
    
    // Détecter multijoueur depuis les genres ou le HTML
    if (!isMultiplayer) {
      const multiMatch = html.match(/multijoueur|multiplayer|en ligne|online|co-op|coop/i);
      if (multiMatch) {
        isMultiplayer = true;
      }
    }
    
    // Fallback: extraire les plateformes depuis le header
    if (platforms.length === 0) {
      const platformRegex = /gameHeaderBanner__platformLink[^>]*>([^<]+)</gi;
      let platformMatch;
      while ((platformMatch = platformRegex.exec(html)) !== null) {
        const platformName = platformMatch[1].trim();
        if (platformName && !platforms.includes(platformName)) {
          platforms.push(platformName);
        }
      }
    }
    
    // Extraire la description depuis les meta tags
    const descMatch = html.match(/name="description"[^>]*content="([^"]+)"/i) ||
                      html.match(/property="og:description"[^>]*content="([^"]+)"/i);
    let description = descMatch ? decodeHtmlEntities(descMatch[1].trim()) : null;
    
    if (description) {
      const cleanDesc = description.replace(/^[^:]+:\s*retrouvez toutes les informations et actualités du jeu sur tous ses supports\.\s*/i, '');
      description = cleanDesc || description;
    }
    
    // Extraire l'image OG
    const ogImageMatch = html.match(/property="og:image"[^>]*content="([^"]+)"/i);
    const cover = ogImageMatch ? ogImageMatch[1] : null;
    
    // Extraire le lien vers le test
    const testMatch = html.match(/href="(\/test\/[^"]+\.htm)"/i);
    const testUrl = testMatch ? `${JVC_BASE_URL}${testMatch[1]}` : null;
    
    // Extraire les notes
    let testRating = null;
    const ratingMatch = html.match(/"game_tester_rating"\s*:\s*"(\d+(?:\.\d+)?)"/i);
    if (ratingMatch) {
      testRating = parseFloat(ratingMatch[1]);
    }
    
    let userRating = null;
    const userRatingMatch = html.match(/"game_usr_rating"\s*:\s*"(\d+(?:\.\d+)?)"/i);
    if (userRatingMatch) {
      userRating = parseFloat(userRatingMatch[1]);
    }
    
    // Extraire l'âge minimum depuis le PEGI
    let minAge = null;
    if (pegi) {
      const ageMatch = pegi.match(/\+?(\d+)/);
      if (ageMatch) {
        minAge = parseInt(ageMatch[1]);
      }
    }
    
    // Extraire les supports (Cartouche, CD, DVD, eShop, etc.)
    let media = [];
    const supportSectionMatch = html.match(/Support\(s\)<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    if (supportSectionMatch) {
      const supportHtml = supportSectionMatch[1];
      const supportRegex = /gameCharacteristicsDetailed__characValue[^>]*>\s*([^<]+)/gi;
      let supportMatch;
      while ((supportMatch = supportRegex.exec(supportHtml)) !== null) {
        const support = supportMatch[1].trim();
        if (support && !media.includes(support)) {
          media.push(support);
        }
      }
    }
    
    const result = {
      id: parseInt(gameId),
      type: 'game',
      title: title,
      image: cover ? [cover] : [],
      description: description,
      cover: cover,
      releaseDate: releaseDate,
      platforms: platforms.length > 0 ? platforms : null,
      genres: genres.length > 0 ? genres : null,
      publisher: publisher,
      developer: developer,
      pegi: pegi,
      minAge: minAge,
      nbPlayers: nbPlayers,
      isMultiplayer: isMultiplayer,
      media: media.length > 0 ? media : null,
      ratings: {
        test: testRating,
        users: userRating
      },
      testUrl: testUrl,
      url: gameUrl,
      source: 'jvc'
    };

    const harmonized = harmonizeJvcGame(result);
    
    log.debug(` ✅ Jeu récupéré: ${result.title}`);
    return harmonized;

  } catch (err) {
    metrics.sources.jvc.errors++;
    throw err;
  }
}

// ============================================================================
// FONCTIONS NORMALISÉES (v3.0.0)
// ============================================================================

/**
 * Recherche JVC avec résultat normalisé v3.0.0
 * @param {string} query - Terme de recherche
 * @param {Object} options - Options de recherche
 * @returns {Promise<Object>} Résultat normalisé
 */
export async function searchJvcNormalized(query, options = {}) {
  const rawResult = await searchJvc(query, options);
  return normalizeJvcSearch(rawResult);
}

/**
 * Détails d'un jeu JVC avec résultat normalisé v3.0.0
 * @param {string|number} gameId - ID du jeu
 * @returns {Promise<Object>} Détail normalisé
 */
export async function getJvcGameByIdNormalized(gameId) {
  const rawResult = await getJVCGameById(gameId);
  return normalizeJvcGameDetail(rawResult);
}
