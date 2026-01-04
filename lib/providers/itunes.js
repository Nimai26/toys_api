/**
 * lib/providers/itunes.js - Provider iTunes
 * 
 * API iTunes Search pour recherche d'albums/artistes/tracks
 * Gratuit, sans clé API
 * 
 * @module providers/itunes
 */

import { createLogger } from '../utils/logger.js';
import {
  ITUNES_BASE_URL,
  MUSIC_DEFAULT_MAX,
  USER_AGENT
} from '../config.js';

import {
  normalizeItunesSearch
} from '../normalizers/music_album.js';

import { fetchViaProxy } from '../utils/fetch-proxy.js';

const log = createLogger('iTunes');

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Formate une durée en ms vers "mm:ss"
 */
function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur iTunes
 * @param {string} query - Recherche
 * @param {object} options - Options (limit, entity, country)
 * @returns {Promise<object>} - Résultats
 */
export async function searchItunes(query, options = {}) {
  const { limit = MUSIC_DEFAULT_MAX, entity = 'album', country = 'FR' } = options;
  
  const url = `${ITUNES_BASE_URL}/search?term=${encodeURIComponent(query)}&entity=${entity}&country=${country}&limit=${limit}`;
  
  log.debug(`Search: ${url}`);
  
  const response = await fetchViaProxy(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT
    }
  });
  
  if (!response.ok) {
    throw new Error(`Erreur iTunes: ${response.status}`);
  }
  
  const data = await response.json();
  
  const results = (data.results || []).map(item => {
    if (entity === 'album') {
      return {
        id: item.collectionId,
        type: 'album',
        title: item.collectionName,
        artist: item.artistName,
        artistId: item.artistId,
        coverUrl: item.artworkUrl100,
        coverUrlLarge: item.artworkUrl100?.replace('100x100', '600x600'),
        releaseDate: item.releaseDate,
        year: item.releaseDate?.substring(0, 4),
        trackCount: item.trackCount,
        genre: item.primaryGenreName,
        price: item.collectionPrice,
        currency: item.currency,
        explicit: item.collectionExplicitness === 'explicit',
        itunesUrl: item.collectionViewUrl,
        source: 'itunes'
      };
    } else if (entity === 'musicArtist') {
      return {
        id: item.artistId,
        type: 'artist',
        name: item.artistName,
        genre: item.primaryGenreName,
        itunesUrl: item.artistLinkUrl,
        source: 'itunes'
      };
    } else {
      return {
        id: item.trackId,
        type: 'track',
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName,
        albumId: item.collectionId,
        duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : null,
        durationFormatted: item.trackTimeMillis ? formatDuration(item.trackTimeMillis) : null,
        preview: item.previewUrl,
        coverUrl: item.artworkUrl100,
        explicit: item.trackExplicitness === 'explicit',
        price: item.trackPrice,
        itunesUrl: item.trackViewUrl,
        source: 'itunes'
      };
    }
  });
  
  return {
    query,
    entity,
    country,
    totalResults: data.resultCount || results.length,
    count: results.length,
    results,
    source: 'itunes'
  };
}

// ============================================================================
// FONCTIONS NORMALISÉES (v3.0.0)
// ============================================================================

/**
 * Recherche iTunes avec résultat normalisé v3.0.0
 * @param {string} query - Terme de recherche
 * @param {Object} options - Options de recherche (limit, country)
 * @returns {Promise<Object>} Résultat normalisé
 */
export async function searchItunesNormalized(query, options = {}) {
  const rawResult = await searchItunes(query, { ...options, entity: 'album' });
  return normalizeItunesSearch(rawResult);
}
