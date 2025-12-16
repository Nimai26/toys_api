/**
 * lib/providers/deezer.js - Provider Deezer
 * 
 * API Deezer pour recherche et détails d'albums/artistes/tracks
 * Gratuit, sans clé API
 * 
 * @module providers/deezer
 */

import { createLogger } from '../utils/logger.js';
import {
  DEEZER_BASE_URL,
  MUSIC_DEFAULT_MAX,
  USER_AGENT
} from '../config.js';

const log = createLogger('Deezer');

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Formate une durée en secondes vers "mm:ss"
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
 * Recherche sur Deezer
 * @param {string} query - Recherche
 * @param {object} options - Options (limit, type: album|artist|track)
 * @returns {Promise<object>} - Résultats
 */
export async function searchDeezer(query, options = {}) {
  const { limit = MUSIC_DEFAULT_MAX, type = 'album' } = options;
  
  const url = `${DEEZER_BASE_URL}/search/${type}?q=${encodeURIComponent(query)}&limit=${limit}`;
  
  log.debug(`Search: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT
    }
  });
  
  if (!response.ok) {
    throw new Error(`Erreur Deezer: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Deezer: ${data.error.message}`);
  }
  
  const results = (data.data || []).map(item => {
    if (type === 'album') {
      return {
        id: item.id,
        type: 'album',
        title: item.title,
        artist: item.artist?.name || null,
        artistId: item.artist?.id || null,
        coverUrl: item.cover_medium || item.cover,
        coverUrlLarge: item.cover_xl || item.cover_big,
        releaseDate: null,
        trackCount: item.nb_tracks || null,
        explicit: item.explicit_lyrics || false,
        genre: item.genre_id || null,
        deezerUrl: item.link,
        source: 'deezer'
      };
    } else if (type === 'artist') {
      return {
        id: item.id,
        type: 'artist',
        name: item.name,
        picture: item.picture_medium,
        pictureXl: item.picture_xl,
        nbAlbums: item.nb_album,
        nbFans: item.nb_fan,
        deezerUrl: item.link,
        source: 'deezer'
      };
    } else {
      return {
        id: item.id,
        type: 'track',
        title: item.title,
        artist: item.artist?.name,
        album: item.album?.title,
        albumId: item.album?.id,
        duration: item.duration,
        durationFormatted: formatDuration(item.duration * 1000),
        preview: item.preview,
        explicit: item.explicit_lyrics,
        deezerUrl: item.link,
        source: 'deezer'
      };
    }
  });
  
  return {
    query,
    type,
    totalResults: data.total || results.length,
    count: results.length,
    results,
    source: 'deezer'
  };
}

// ============================================================================
// DÉTAILS ALBUM
// ============================================================================

/**
 * Récupère les détails d'un album Deezer
 * @param {number|string} albumId - ID album Deezer
 * @returns {Promise<object>} - Détails album
 */
export async function getDeezerAlbum(albumId) {
  const cleanId = String(albumId).replace(/^music_/i, '');
  const url = `${DEEZER_BASE_URL}/album/${cleanId}`;
  
  log.debug(`Album: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT
    }
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Album non trouvé: ${albumId}`);
    }
    throw new Error(`Erreur Deezer: ${response.status}`);
  }
  
  const album = await response.json();
  
  if (album.error) {
    throw new Error(`Deezer: ${album.error.message || album.error.type || 'no data'}`);
  }
  
  if (!album.id) {
    throw new Error(`Deezer: Album non trouvé (ID: ${cleanId})`);
  }
  
  return {
    id: album.id,
    type: 'album',
    title: album.title,
    upc: album.upc || null,
    artist: album.artist?.name || null,
    artistId: album.artist?.id || null,
    artistPicture: album.artist?.picture_medium || null,
    coverUrl: album.cover_medium || album.cover,
    coverUrlLarge: album.cover_xl || album.cover_big,
    releaseDate: album.release_date || null,
    year: album.release_date?.substring(0, 4) || null,
    duration: album.duration || null,
    durationFormatted: album.duration ? formatDuration(album.duration * 1000) : null,
    trackCount: album.nb_tracks || 0,
    fans: album.fans || 0,
    explicit: album.explicit_lyrics || false,
    genres: (album.genres?.data || []).map(g => g.name),
    label: album.label || null,
    tracks: (album.tracks?.data || []).map((t, idx) => ({
      position: idx + 1,
      id: t.id,
      title: t.title,
      duration: t.duration,
      durationFormatted: formatDuration(t.duration * 1000),
      preview: t.preview,
      explicit: t.explicit_lyrics
    })),
    contributors: (album.contributors || []).map(c => ({
      id: c.id,
      name: c.name,
      role: c.role,
      picture: c.picture_medium
    })),
    deezerUrl: album.link,
    source: 'deezer'
  };
}

// ============================================================================
// DÉTAILS ARTISTE
// ============================================================================

/**
 * Récupère les détails d'un artiste Deezer
 * @param {number|string} artistId - ID artiste Deezer
 * @returns {Promise<object>} - Détails artiste
 */
export async function getDeezerArtist(artistId) {
  const cleanId = String(artistId).replace(/^music_/i, '');
  
  const [artistResp, topResp, albumsResp] = await Promise.all([
    fetch(`${DEEZER_BASE_URL}/artist/${cleanId}`),
    fetch(`${DEEZER_BASE_URL}/artist/${cleanId}/top?limit=10`),
    fetch(`${DEEZER_BASE_URL}/artist/${cleanId}/albums?limit=50`)
  ]);
  
  if (!artistResp.ok) {
    if (artistResp.status === 404) {
      throw new Error(`Artiste non trouvé: ${artistId}`);
    }
    throw new Error(`Erreur Deezer: ${artistResp.status}`);
  }
  
  const artist = await artistResp.json();
  const topTracks = topResp.ok ? await topResp.json() : { data: [] };
  const albums = albumsResp.ok ? await albumsResp.json() : { data: [] };
  
  return {
    id: artist.id,
    type: 'artist',
    name: artist.name,
    picture: artist.picture_medium,
    pictureXl: artist.picture_xl,
    nbAlbums: artist.nb_album,
    nbFans: artist.nb_fan,
    topTracks: (topTracks.data || []).map(t => ({
      id: t.id,
      title: t.title,
      duration: t.duration,
      durationFormatted: formatDuration(t.duration * 1000),
      album: t.album?.title,
      albumCover: t.album?.cover_medium,
      preview: t.preview,
      rank: t.rank
    })),
    albums: (albums.data || []).map(a => ({
      id: a.id,
      title: a.title,
      coverUrl: a.cover_medium,
      releaseDate: a.release_date,
      type: a.record_type
    })),
    deezerUrl: artist.link,
    source: 'deezer'
  };
}
