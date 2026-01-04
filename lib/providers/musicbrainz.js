/**
 * lib/providers/musicbrainz.js - Provider MusicBrainz
 * 
 * API MusicBrainz pour recherche et détails d'albums/artistes
 * Gratuit, sans clé API (mais User-Agent identifiable requis)
 * 
 * @module providers/musicbrainz
 */

import { createLogger } from '../utils/logger.js';
import {
  MUSICBRAINZ_BASE_URL,
  MUSICBRAINZ_COVER_URL,
  MUSIC_DEFAULT_MAX
} from '../config.js';

import {
  normalizeMusicBrainzSearch,
  normalizeMusicBrainzAlbumDetail
} from '../normalizers/music_album.js';

import { fetchViaProxy } from '../utils/fetch-proxy.js';

const log = createLogger('MusicBrainz');

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Formate une durée en ms vers "mm:ss"
 */
export function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur MusicBrainz (release-group = album)
 * @param {string} query - Recherche
 * @param {object} options - Options (limit, artist, type)
 * @returns {Promise<object>} - Résultats
 */
export async function searchMusicBrainz(query, options = {}) {
  const { limit = MUSIC_DEFAULT_MAX, artist = null, type = 'release-group' } = options;
  
  // Construire la requête Lucene
  let luceneQuery = query;
  if (artist) {
    luceneQuery = `"${query}" AND artist:"${artist}"`;
  }
  
  const url = `${MUSICBRAINZ_BASE_URL}/${type}?query=${encodeURIComponent(luceneQuery)}&limit=${limit}&fmt=json`;
  
  log.debug(`Search: ${url}`);
  
  const response = await fetchViaProxy(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ToysAPI/1.0 (contact@example.com)' // MusicBrainz exige un User-Agent identifiable
    }
  });
  
  if (!response.ok) {
    throw new Error(`Erreur MusicBrainz: ${response.status}`);
  }
  
  const data = await response.json();
  const groups = data['release-groups'] || [];
  
  const results = groups.map(rg => ({
    id: rg.id,
    type: 'album',
    title: rg.title,
    artist: rg['artist-credit']?.map(ac => ac.name || ac.artist?.name).join(', ') || null,
    artistId: rg['artist-credit']?.[0]?.artist?.id || null,
    releaseDate: rg['first-release-date'] || null,
    year: rg['first-release-date']?.substring(0, 4) || null,
    primaryType: rg['primary-type'] || null,
    secondaryTypes: rg['secondary-types'] || [],
    score: rg.score || null,
    coverUrl: `${MUSICBRAINZ_COVER_URL}/release-group/${rg.id}/front-250`,
    coverUrlLarge: `${MUSICBRAINZ_COVER_URL}/release-group/${rg.id}/front-500`,
    mbUrl: `https://musicbrainz.org/release-group/${rg.id}`,
    source: 'musicbrainz'
  }));
  
  return {
    query,
    totalResults: data.count || results.length,
    count: results.length,
    results,
    source: 'musicbrainz'
  };
}

// ============================================================================
// DÉTAILS ALBUM
// ============================================================================

/**
 * Récupère les détails d'un album MusicBrainz
 * @param {string} mbid - MusicBrainz ID (release-group)
 * @returns {Promise<object>} - Détails album
 */
export async function getMusicBrainzAlbum(mbid) {
  const url = `${MUSICBRAINZ_BASE_URL}/release-group/${mbid}?inc=artists+releases+tags+ratings&fmt=json`;
  
  log.debug(`Album: ${url}`);
  
  const response = await fetchViaProxy(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ToysAPI/1.0 (contact@example.com)'
    }
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Album non trouvé: ${mbid}`);
    }
    throw new Error(`Erreur MusicBrainz: ${response.status}`);
  }
  
  const rg = await response.json();
  
  // Récupérer la liste des pistes du premier release
  let tracks = [];
  if (rg.releases && rg.releases.length > 0) {
    try {
      const releaseId = rg.releases[0].id;
      const releaseUrl = `${MUSICBRAINZ_BASE_URL}/release/${releaseId}?inc=recordings&fmt=json`;
      const releaseResp = await fetchViaProxy(releaseUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ToysAPI/1.0 (contact@example.com)'
        }
      });
      if (releaseResp.ok) {
        const releaseData = await releaseResp.json();
        if (releaseData.media) {
          tracks = releaseData.media.flatMap((medium, mediumIdx) =>
            (medium.tracks || []).map((track, trackIdx) => ({
              position: track.position || trackIdx + 1,
              disc: mediumIdx + 1,
              title: track.title,
              duration: track.length ? Math.round(track.length / 1000) : null,
              durationFormatted: track.length ? formatDuration(track.length) : null
            }))
          );
        }
      }
    } catch (err) {
      log.error('Error fetching tracks', { error: err.message });
    }
  }
  
  return {
    id: rg.id,
    type: 'album',
    title: rg.title,
    artist: rg['artist-credit']?.map(ac => ac.name || ac.artist?.name).join(', ') || null,
    artists: rg['artist-credit']?.map(ac => ({
      id: ac.artist?.id,
      name: ac.name || ac.artist?.name,
      joinPhrase: ac.joinphrase
    })) || [],
    releaseDate: rg['first-release-date'] || null,
    year: rg['first-release-date']?.substring(0, 4) || null,
    primaryType: rg['primary-type'] || null,
    secondaryTypes: rg['secondary-types'] || [],
    tags: (rg.tags || []).map(t => ({ name: t.name, count: t.count })).sort((a, b) => b.count - a.count),
    rating: rg.rating ? { value: rg.rating.value, votes: rg.rating['votes-count'] } : null,
    releases: (rg.releases || []).slice(0, 10).map(r => ({
      id: r.id,
      title: r.title,
      status: r.status,
      date: r.date,
      country: r.country,
      barcode: r.barcode
    })),
    tracks,
    trackCount: tracks.length,
    coverUrl: `${MUSICBRAINZ_COVER_URL}/release-group/${rg.id}/front-250`,
    coverUrlLarge: `${MUSICBRAINZ_COVER_URL}/release-group/${rg.id}/front-500`,
    mbUrl: `https://musicbrainz.org/release-group/${rg.id}`,
    source: 'musicbrainz'
  };
}

// ============================================================================
// RECHERCHE PAR CODE-BARRES
// ============================================================================

/**
 * Recherche un album par code-barres sur MusicBrainz
 * @param {string} barcode - Code-barres (UPC/EAN)
 * @returns {Promise<object>} - Album trouvé
 */
export async function searchMusicBrainzByBarcode(barcode) {
  const url = `${MUSICBRAINZ_BASE_URL}/release?query=barcode:${encodeURIComponent(barcode)}&fmt=json`;
  
  log.debug(`Barcode: ${url}`);
  
  const response = await fetchViaProxy(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ToysAPI/1.0 (contact@example.com)'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Erreur MusicBrainz: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.releases || data.releases.length === 0) {
    return { found: false, barcode, source: 'musicbrainz' };
  }
  
  const release = data.releases[0];
  
  return {
    found: true,
    barcode,
    id: release.id,
    releaseGroupId: release['release-group']?.id,
    title: release.title,
    artist: release['artist-credit']?.map(ac => ac.name || ac.artist?.name).join(', ') || null,
    date: release.date,
    country: release.country,
    status: release.status,
    label: release['label-info']?.[0]?.label?.name || null,
    catalogNumber: release['label-info']?.[0]?.['catalog-number'] || null,
    coverUrl: release['release-group']?.id 
      ? `${MUSICBRAINZ_COVER_URL}/release-group/${release['release-group'].id}/front-250` 
      : null,
    mbUrl: `https://musicbrainz.org/release/${release.id}`,
    source: 'musicbrainz'
  };
}

// ============================================================================
// FONCTIONS NORMALISÉES (v3.0.0)
// ============================================================================

/**
 * Recherche MusicBrainz avec résultat normalisé v3.0.0
 * @param {string} query - Terme de recherche
 * @param {Object} options - Options de recherche
 * @returns {Promise<Object>} Résultat normalisé
 */
export async function searchMusicBrainzNormalized(query, options = {}) {
  const rawResult = await searchMusicBrainz(query, options);
  return normalizeMusicBrainzSearch(rawResult);
}

/**
 * Détails d'un album MusicBrainz avec résultat normalisé v3.0.0
 * @param {string} mbid - MusicBrainz ID (release-group)
 * @returns {Promise<Object>} Détail normalisé
 */
export async function getMusicBrainzAlbumNormalized(mbid) {
  const rawResult = await getMusicBrainzAlbum(mbid);
  return normalizeMusicBrainzAlbumDetail(rawResult);
}
