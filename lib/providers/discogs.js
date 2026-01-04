/**
 * lib/providers/discogs.js - Provider Discogs
 * 
 * API Discogs pour recherche et détails de releases musicaux
 * Token optionnel (limite 25 req/min sans, 60 req/min avec)
 * 
 * @module providers/discogs
 */

import { createLogger } from '../utils/logger.js';
import {
  DISCOGS_BASE_URL,
  MUSIC_DEFAULT_MAX
} from '../config.js';

import {
  normalizeDiscogsSearch,
  normalizeDiscogsReleaseDetail
} from '../normalizers/music_album.js';

import { fetchViaProxy } from '../utils/fetch-proxy.js';

const log = createLogger('Discogs');

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur Discogs
 * @param {string} query - Recherche
 * @param {object} options - Options (limit, type, token)
 * @returns {Promise<object>} - Résultats
 */
export async function searchDiscogs(query, options = {}) {
  const { limit = MUSIC_DEFAULT_MAX, type = 'release', token = null } = options;
  
  let url = `${DISCOGS_BASE_URL}/database/search?q=${encodeURIComponent(query)}&type=${type}&per_page=${limit}`;
  
  if (token) {
    url += `&token=${token}`;
  }
  
  log.debug(`Search: ${url.replace(/token=[^&]+/, 'token=***')}`);
  
  const response = await fetchViaProxy(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ToysAPI/1.0'
    }
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Limite Discogs atteinte (60 req/min avec token, 25 sans)');
    }
    throw new Error(`Erreur Discogs: ${response.status}`);
  }
  
  const data = await response.json();
  
  const results = (data.results || []).map(item => ({
    id: item.id,
    type: item.type,
    title: item.title,
    artist: item.title?.split(' - ')[0] || null,
    albumTitle: item.title?.split(' - ')[1] || item.title,
    year: item.year || null,
    country: item.country || null,
    format: item.format || [],
    label: item.label || [],
    genre: item.genre || [],
    style: item.style || [],
    coverUrl: item.cover_image || item.thumb,
    masterId: item.master_id || null,
    resourceUrl: item.resource_url,
    discogsUrl: item.uri ? `https://www.discogs.com${item.uri}` : null,
    source: 'discogs'
  }));
  
  return {
    query,
    type,
    totalResults: data.pagination?.items || results.length,
    count: results.length,
    page: data.pagination?.page || 1,
    totalPages: data.pagination?.pages || 1,
    results,
    source: 'discogs'
  };
}

// ============================================================================
// DÉTAILS RELEASE
// ============================================================================

/**
 * Récupère les détails d'un release Discogs
 * @param {number|string} releaseId - ID release Discogs
 * @param {string} token - Token Discogs (optionnel)
 * @returns {Promise<object>} - Détails release
 */
export async function getDiscogsRelease(releaseId, token = null) {
  let url = `${DISCOGS_BASE_URL}/releases/${releaseId}`;
  if (token) {
    url += `?token=${token}`;
  }
  
  log.debug(`Release: ${url.replace(/token=[^&]+/, 'token=***')}`);
  
  const response = await fetchViaProxy(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ToysAPI/1.0'
    }
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Release non trouvée: ${releaseId}`);
    }
    throw new Error(`Erreur Discogs: ${response.status}`);
  }
  
  const release = await response.json();
  
  return {
    id: release.id,
    type: 'release',
    title: release.title,
    artists: (release.artists || []).map(a => ({
      id: a.id,
      name: a.name,
      role: a.role
    })),
    artist: (release.artists || []).map(a => a.name).join(', '),
    year: release.year || null,
    releaseDate: release.released || null,
    country: release.country || null,
    genres: release.genres || [],
    styles: release.styles || [],
    formats: (release.formats || []).map(f => ({
      name: f.name,
      qty: f.qty,
      descriptions: f.descriptions
    })),
    labels: (release.labels || []).map(l => ({
      id: l.id,
      name: l.name,
      catno: l.catno
    })),
    tracklist: (release.tracklist || []).map(t => ({
      position: t.position,
      title: t.title,
      duration: t.duration,
      artists: t.artists?.map(a => a.name)
    })),
    trackCount: release.tracklist?.length || 0,
    notes: release.notes || null,
    images: (release.images || []).map(img => ({
      type: img.type,
      uri: img.uri,
      uri150: img.uri150
    })),
    coverUrl: release.images?.[0]?.uri150 || release.thumb,
    coverUrlLarge: release.images?.[0]?.uri || null,
    masterId: release.master_id || null,
    masterUrl: release.master_url || null,
    lowestPrice: release.lowest_price || null,
    numForSale: release.num_for_sale || 0,
    community: release.community ? {
      have: release.community.have,
      want: release.community.want,
      rating: release.community.rating?.average,
      ratingCount: release.community.rating?.count
    } : null,
    discogsUrl: release.uri,
    source: 'discogs'
  };
}

// ============================================================================
// RECHERCHE PAR CODE-BARRES
// ============================================================================

/**
 * Recherche par code-barres sur Discogs
 * @param {string} barcode - Code-barres
 * @param {string} token - Token Discogs (optionnel)
 * @returns {Promise<object>} - Release trouvée
 */
export async function searchDiscogsByBarcode(barcode, token = null) {
  let url = `${DISCOGS_BASE_URL}/database/search?barcode=${encodeURIComponent(barcode)}&type=release`;
  if (token) {
    url += `&token=${token}`;
  }
  
  log.debug(`Barcode: ${url.replace(/token=[^&]+/, 'token=***')}`);
  
  const response = await fetchViaProxy(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ToysAPI/1.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Erreur Discogs: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.results || data.results.length === 0) {
    return { found: false, barcode, source: 'discogs' };
  }
  
  const item = data.results[0];
  
  return {
    found: true,
    barcode,
    id: item.id,
    title: item.title,
    artist: item.title?.split(' - ')[0] || null,
    albumTitle: item.title?.split(' - ')[1] || item.title,
    year: item.year,
    country: item.country,
    format: item.format,
    label: item.label,
    genre: item.genre,
    coverUrl: item.cover_image || item.thumb,
    discogsUrl: item.uri ? `https://www.discogs.com${item.uri}` : null,
    source: 'discogs'
  };
}

// ============================================================================
// FONCTIONS NORMALISÉES (v3.0.0)
// ============================================================================

/**
 * Recherche Discogs avec résultat normalisé v3.0.0
 * @param {string} query - Terme de recherche
 * @param {Object} options - Options de recherche (limit, type, token)
 * @returns {Promise<Object>} Résultat normalisé
 */
export async function searchDiscogsNormalized(query, options = {}) {
  const rawResult = await searchDiscogs(query, options);
  return normalizeDiscogsSearch(rawResult);
}

/**
 * Détails d'une release Discogs avec résultat normalisé v3.0.0
 * @param {number|string} releaseId - ID release Discogs
 * @param {string} token - Token Discogs (optionnel)
 * @returns {Promise<Object>} Détail normalisé
 */
export async function getDiscogsReleaseNormalized(releaseId, token = null) {
  const rawResult = await getDiscogsRelease(releaseId, token);
  return normalizeDiscogsReleaseDetail(rawResult);
}
