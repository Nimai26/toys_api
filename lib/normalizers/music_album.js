/**
 * lib/normalizers/music_album.js - Normaliseur pour albums musicaux
 * 
 * Normalise les réponses de MusicBrainz, Discogs, Deezer, iTunes
 * vers un format unifié v3.0.0
 * 
 * @module normalizers/music_album
 */

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Formate une durée en secondes vers "mm:ss" ou "h:mm:ss"
 * @param {number} seconds - Durée en secondes
 * @returns {string|null}
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse une date vers année
 * @param {string} dateStr - Date string
 * @returns {number|null}
 */
function parseYear(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Normalise le type d'album
 * @param {string} type - Type source
 * @param {string[]} secondary - Types secondaires
 * @returns {string}
 */
function normalizeAlbumType(type, secondary = []) {
  if (!type) return 'album';
  
  const t = String(type).toLowerCase();
  
  // Types primaires
  if (t === 'ep' || t.includes('ep')) return 'ep';
  if (t === 'single' || t.includes('single')) return 'single';
  if (t === 'compilation' || t.includes('compilation')) return 'compilation';
  if (t === 'soundtrack' || t.includes('soundtrack')) return 'soundtrack';
  if (t === 'live' || t.includes('live')) return 'live';
  if (t === 'remix' || t.includes('remix')) return 'remix';
  
  // Vérifier les types secondaires
  if (secondary && secondary.length > 0) {
    const secondStr = secondary.join(' ').toLowerCase();
    if (secondStr.includes('compilation')) return 'compilation';
    if (secondStr.includes('soundtrack')) return 'soundtrack';
    if (secondStr.includes('live')) return 'live';
    if (secondStr.includes('remix')) return 'remix';
  }
  
  // Par défaut
  if (t === 'album' || t === 'lp') return 'album';
  
  return 'album';
}

/**
 * Normalise les sous-types d'album
 * @param {string[]} types - Types secondaires
 * @returns {string[]}
 */
function normalizeAlbumSubtypes(types) {
  if (!types || !Array.isArray(types)) return [];
  
  return types.map(t => String(t).toLowerCase()).filter(t => 
    ['live', 'compilation', 'remix', 'deluxe', 'remaster', 'demo', 'mixtape', 'dj-mix'].includes(t)
  );
}

/**
 * Normalise le rôle d'un artiste
 * @param {string} role - Rôle source
 * @returns {string}
 */
function normalizeArtistRole(role) {
  if (!role) return 'main';
  
  const r = String(role).toLowerCase();
  
  if (r === 'main' || r === 'primary') return 'main';
  if (r.includes('feat') || r.includes('guest')) return 'featured';
  if (r.includes('producer') || r.includes('prod')) return 'producer';
  if (r.includes('compos') || r.includes('writer')) return 'composer';
  
  return 'other';
}

/**
 * Parse une position de track (A1, B2, 1, 2, etc.)
 * @param {string|number} position - Position source
 * @returns {number|string}
 */
function parseTrackPosition(position) {
  if (typeof position === 'number') return position;
  if (!position) return 1;
  
  // Si c'est juste un nombre
  const numMatch = String(position).match(/^(\d+)$/);
  if (numMatch) return parseInt(numMatch[1], 10);
  
  // Garder les positions vinyle telles quelles (A1, B2)
  return position;
}

// ============================================================================
// MUSICBRAINZ NORMALIZERS
// ============================================================================

/**
 * Normalise un item de recherche MusicBrainz
 * @param {Object} item - Item brut
 * @returns {Object} Item normalisé
 */
export function normalizeMusicBrainzSearchItem(item) {
  const albumType = normalizeAlbumType(item.primaryType, item.secondaryTypes);
  
  return {
    id: `musicbrainz_${item.id}`,
    provider: 'musicbrainz',
    provider_id: item.id,
    type: 'album',
    album_type: albumType,
    title: item.title || '',
    artist: item.artist || null,
    artist_id: item.artistId || null,
    year: parseYear(item.releaseDate) || parseYear(item.year),
    release_date: item.releaseDate || null,
    genres: (item.tags || []).slice(0, 5).map(t => t.name || t),
    track_count: item.trackCount || null,
    explicit: false,
    images: {
      thumbnail: item.coverUrl || null,
      cover: item.coverUrl || null,
      cover_large: item.coverUrlLarge || null
    },
    external_ids: {
      musicbrainz_id: item.id,
      discogs_id: null,
      discogs_master_id: null,
      deezer_id: null,
      itunes_id: null,
      barcode: null
    },
    url: item.mbUrl || null,
    score: item.score || null
  };
}

/**
 * Normalise une réponse de recherche MusicBrainz
 * @param {Object} response - Réponse brute
 * @returns {Object} Réponse normalisée
 */
export function normalizeMusicBrainzSearch(response) {
  if (!response) return { query: '', provider: 'musicbrainz', total_results: 0, results: [] };
  
  return {
    query: response.query || '',
    provider: 'musicbrainz',
    total_results: response.totalResults || response.count || 0,
    page: 1,
    per_page: response.count || 0,
    results: (response.results || []).map(normalizeMusicBrainzSearchItem)
  };
}

/**
 * Normalise un détail d'album MusicBrainz
 * @param {Object} data - Données brutes
 * @returns {Object} Détail normalisé
 */
export function normalizeMusicBrainzAlbumDetail(data) {
  if (!data) return null;
  
  const albumType = normalizeAlbumType(data.primaryType, data.secondaryTypes);
  const albumSubtypes = normalizeAlbumSubtypes(data.secondaryTypes);
  
  // Calculer le nombre de disques
  const discNumbers = (data.tracks || []).map(t => t.disc || 1);
  const discCount = discNumbers.length > 0 ? Math.max(...discNumbers) : 1;
  
  // Calculer la durée totale
  const totalDuration = (data.tracks || []).reduce((sum, t) => sum + (t.duration || 0), 0);
  
  return {
    id: `musicbrainz_${data.id}`,
    provider: 'musicbrainz',
    provider_id: data.id,
    type: 'album',
    album_type: albumType,
    album_subtypes: albumSubtypes,
    title: data.title || '',
    
    artists: (data.artists || []).map(a => ({
      id: a.id || null,
      name: a.name || '',
      role: 'main',
      join_phrase: a.joinPhrase || null
    })),
    artist: data.artist || null,
    
    year: parseYear(data.releaseDate) || parseYear(data.year),
    release_date: data.releaseDate || null,
    original_release_date: data.releaseDate || null,
    country: data.releases?.[0]?.country || null,
    
    genres: (data.tags || []).slice(0, 10).map(t => t.name || t),
    styles: [],
    tags: (data.tags || []).map(t => ({
      name: t.name || t,
      count: t.count || null
    })),
    
    label: data.releases?.[0]?.label || null,
    labels: [],
    
    tracks: (data.tracks || []).map((t, idx) => ({
      position: t.position || idx + 1,
      disc: t.disc || 1,
      id: null,
      title: t.title || '',
      duration_seconds: t.duration || null,
      duration_formatted: t.durationFormatted || formatDuration(t.duration),
      explicit: false,
      preview_url: null,
      artists: []
    })),
    track_count: data.trackCount || data.tracks?.length || 0,
    disc_count: discCount,
    
    duration_seconds: totalDuration > 0 ? totalDuration : null,
    duration_formatted: totalDuration > 0 ? formatDuration(totalDuration) : null,
    
    formats: [],
    
    rating: data.rating ? {
      value: data.rating.value,
      max: 5,
      votes: data.rating.votes,
      source: 'musicbrainz'
    } : null,
    
    community: null,
    pricing: null,
    explicit: false,
    
    images: {
      thumbnail: data.coverUrl || null,
      cover: data.coverUrl || null,
      cover_large: data.coverUrlLarge || null,
      all: []
    },
    
    external_ids: {
      musicbrainz_id: data.id,
      musicbrainz_release_id: data.releases?.[0]?.id || null,
      discogs_id: null,
      discogs_master_id: null,
      deezer_id: null,
      itunes_id: null,
      barcode: data.releases?.[0]?.barcode || null,
      upc: null
    },
    
    releases: (data.releases || []).map(r => ({
      id: r.id,
      title: r.title || data.title,
      status: r.status || null,
      date: r.date || null,
      country: r.country || null,
      barcode: r.barcode || null
    })),
    
    notes: null,
    url: data.mbUrl || null
  };
}

// ============================================================================
// DISCOGS NORMALIZERS
// ============================================================================

/**
 * Normalise un item de recherche Discogs
 * @param {Object} item - Item brut
 * @returns {Object} Item normalisé
 */
export function normalizeDiscogsSearchItem(item) {
  const format = item.format || [];
  const albumType = normalizeAlbumType(format[0], format.slice(1));
  
  return {
    id: `discogs_${item.id}`,
    provider: 'discogs',
    provider_id: item.id,
    type: 'album',
    album_type: albumType,
    title: item.albumTitle || item.title?.split(' - ')?.[1] || item.title || '',
    artist: item.artist || item.title?.split(' - ')?.[0] || null,
    artist_id: null,
    year: item.year || null,
    release_date: null,
    genres: item.genre || [],
    track_count: null,
    explicit: false,
    images: {
      thumbnail: item.coverUrl || null,
      cover: item.coverUrl || null,
      cover_large: null
    },
    external_ids: {
      musicbrainz_id: null,
      discogs_id: item.id,
      discogs_master_id: item.masterId || null,
      deezer_id: null,
      itunes_id: null,
      barcode: null
    },
    url: item.discogsUrl || null,
    score: null
  };
}

/**
 * Normalise une réponse de recherche Discogs
 * @param {Object} response - Réponse brute
 * @returns {Object} Réponse normalisée
 */
export function normalizeDiscogsSearch(response) {
  if (!response) return { query: '', provider: 'discogs', total_results: 0, results: [] };
  
  return {
    query: response.query || '',
    provider: 'discogs',
    total_results: response.totalResults || 0,
    page: response.page || 1,
    per_page: response.count || 0,
    results: (response.results || []).map(normalizeDiscogsSearchItem)
  };
}

/**
 * Normalise un détail de release Discogs
 * @param {Object} data - Données brutes
 * @returns {Object} Détail normalisé
 */
export function normalizeDiscogsReleaseDetail(data) {
  if (!data) return null;
  
  const formats = data.formats || [];
  const primaryFormat = formats[0]?.name || '';
  const formatDescs = formats.flatMap(f => f.descriptions || []);
  const albumType = normalizeAlbumType(primaryFormat, formatDescs);
  const albumSubtypes = normalizeAlbumSubtypes(formatDescs);
  
  // Calculer le nombre de disques
  const discQty = formats.reduce((sum, f) => sum + (parseInt(f.qty) || 1), 0);
  
  // Parser les durées des tracks
  const tracks = (data.tracklist || []).map((t, idx) => {
    let durationSeconds = null;
    if (t.duration) {
      const parts = t.duration.split(':');
      if (parts.length === 2) {
        durationSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      } else if (parts.length === 3) {
        durationSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
      }
    }
    
    return {
      position: parseTrackPosition(t.position) || idx + 1,
      disc: null, // Discogs ne sépare pas clairement par disque
      id: null,
      title: t.title || '',
      duration_seconds: durationSeconds,
      duration_formatted: t.duration || null,
      explicit: false,
      preview_url: null,
      artists: t.artists?.map(a => a.name || a) || []
    };
  });
  
  // Calculer durée totale
  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration_seconds || 0), 0);
  
  return {
    id: `discogs_${data.id}`,
    provider: 'discogs',
    provider_id: data.id,
    type: 'album',
    album_type: albumType,
    album_subtypes: albumSubtypes,
    title: data.title || '',
    
    artists: (data.artists || []).map(a => ({
      id: a.id || null,
      name: a.name || '',
      role: normalizeArtistRole(a.role),
      join_phrase: null
    })),
    artist: data.artist || null,
    
    year: data.year || null,
    release_date: data.releaseDate || null,
    original_release_date: data.releaseDate || null,
    country: data.country || null,
    
    genres: data.genres || [],
    styles: data.styles || [],
    tags: [],
    
    label: data.labels?.[0]?.name || null,
    labels: (data.labels || []).map(l => ({
      id: l.id || null,
      name: l.name || '',
      catalog_number: l.catno || null
    })),
    
    tracks,
    track_count: data.trackCount || tracks.length,
    disc_count: discQty || 1,
    
    duration_seconds: totalDuration > 0 ? totalDuration : null,
    duration_formatted: totalDuration > 0 ? formatDuration(totalDuration) : null,
    
    formats: formats.map(f => ({
      name: f.name || '',
      quantity: parseInt(f.qty) || 1,
      descriptions: f.descriptions || []
    })),
    
    rating: data.community?.rating ? {
      value: data.community.rating,
      max: 5,
      votes: data.community.ratingCount || null,
      source: 'discogs'
    } : null,
    
    community: data.community ? {
      fans: null,
      have: data.community.have || null,
      want: data.community.want || null
    } : null,
    
    pricing: {
      price: null,
      currency: null,
      lowest_marketplace: data.lowestPrice || null,
      for_sale_count: data.numForSale || null
    },
    
    explicit: false,
    
    images: {
      thumbnail: data.coverUrl || null,
      cover: data.coverUrl || null,
      cover_large: data.coverUrlLarge || null,
      all: (data.images || []).map(img => ({
        url: img.uri || img.url,
        type: img.type || 'other',
        width: img.width || null,
        height: img.height || null
      }))
    },
    
    external_ids: {
      musicbrainz_id: null,
      musicbrainz_release_id: null,
      discogs_id: data.id,
      discogs_master_id: data.masterId || null,
      deezer_id: null,
      itunes_id: null,
      barcode: null,
      upc: null
    },
    
    releases: [],
    
    notes: data.notes || null,
    url: data.discogsUrl || null
  };
}

// ============================================================================
// DEEZER NORMALIZERS
// ============================================================================

/**
 * Normalise un item de recherche Deezer
 * @param {Object} item - Item brut
 * @returns {Object} Item normalisé
 */
export function normalizeDeezerSearchItem(item) {
  return {
    id: `deezer_${item.id}`,
    provider: 'deezer',
    provider_id: item.id,
    type: 'album',
    album_type: 'album', // Deezer ne fournit pas le type en recherche
    title: item.title || '',
    artist: item.artist || null,
    artist_id: item.artistId || null,
    year: parseYear(item.releaseDate),
    release_date: item.releaseDate || null,
    genres: [],
    track_count: item.trackCount || null,
    explicit: item.explicit || false,
    images: {
      thumbnail: item.coverUrl || null,
      cover: item.coverUrl || null,
      cover_large: item.coverUrlLarge || null
    },
    external_ids: {
      musicbrainz_id: null,
      discogs_id: null,
      discogs_master_id: null,
      deezer_id: item.id,
      itunes_id: null,
      barcode: null
    },
    url: item.deezerUrl || null,
    score: null
  };
}

/**
 * Normalise une réponse de recherche Deezer
 * @param {Object} response - Réponse brute
 * @returns {Object} Réponse normalisée
 */
export function normalizeDeezerSearch(response) {
  if (!response) return { query: '', provider: 'deezer', total_results: 0, results: [] };
  
  return {
    query: response.query || '',
    provider: 'deezer',
    total_results: response.totalResults || 0,
    page: 1,
    per_page: response.count || 0,
    results: (response.results || []).map(normalizeDeezerSearchItem)
  };
}

/**
 * Normalise un détail d'album Deezer
 * @param {Object} data - Données brutes
 * @returns {Object} Détail normalisé
 */
export function normalizeDeezerAlbumDetail(data) {
  if (!data) return null;
  
  // Calculer le nombre de disques (pas fourni par Deezer, donc 1)
  const discCount = 1;
  
  return {
    id: `deezer_${data.id}`,
    provider: 'deezer',
    provider_id: data.id,
    type: 'album',
    album_type: 'album',
    album_subtypes: [],
    title: data.title || '',
    
    artists: (data.contributors || []).map(c => ({
      id: c.id || null,
      name: c.name || '',
      role: normalizeArtistRole(c.role),
      join_phrase: null
    })),
    artist: data.artist || null,
    
    year: parseYear(data.releaseDate) || parseYear(data.year),
    release_date: data.releaseDate || null,
    original_release_date: data.releaseDate || null,
    country: null,
    
    genres: data.genres || [],
    styles: [],
    tags: [],
    
    label: data.label || null,
    labels: data.label ? [{ id: null, name: data.label, catalog_number: null }] : [],
    
    tracks: (data.tracks || []).map((t, idx) => ({
      position: t.position || idx + 1,
      disc: 1,
      id: t.id || null,
      title: t.title || '',
      duration_seconds: t.duration || null,
      duration_formatted: t.durationFormatted || formatDuration(t.duration),
      explicit: t.explicit || false,
      preview_url: t.preview || null,
      artists: []
    })),
    track_count: data.trackCount || data.tracks?.length || 0,
    disc_count: discCount,
    
    duration_seconds: data.duration || null,
    duration_formatted: data.durationFormatted || formatDuration(data.duration),
    
    formats: [],
    
    rating: null,
    
    community: {
      fans: data.fans || null,
      have: null,
      want: null
    },
    
    pricing: null,
    
    explicit: data.explicit || false,
    
    images: {
      thumbnail: data.coverUrl || null,
      cover: data.coverUrl || null,
      cover_large: data.coverUrlLarge || null,
      all: []
    },
    
    external_ids: {
      musicbrainz_id: null,
      musicbrainz_release_id: null,
      discogs_id: null,
      discogs_master_id: null,
      deezer_id: data.id,
      itunes_id: null,
      barcode: data.upc || null,
      upc: data.upc || null
    },
    
    releases: [],
    
    notes: null,
    url: data.deezerUrl || null
  };
}

// ============================================================================
// ITUNES NORMALIZERS
// ============================================================================

/**
 * Normalise un item de recherche iTunes
 * @param {Object} item - Item brut
 * @returns {Object} Item normalisé
 */
export function normalizeItunesSearchItem(item) {
  return {
    id: `itunes_${item.id}`,
    provider: 'itunes',
    provider_id: item.id,
    type: 'album',
    album_type: 'album',
    title: item.title || '',
    artist: item.artist || null,
    artist_id: item.artistId || null,
    year: parseYear(item.releaseDate) || parseYear(item.year),
    release_date: item.releaseDate || null,
    genres: item.genre ? [item.genre] : [],
    track_count: item.trackCount || null,
    explicit: item.explicit || false,
    images: {
      thumbnail: item.coverUrl || null,
      cover: item.coverUrl || null,
      cover_large: item.coverUrlLarge || null
    },
    external_ids: {
      musicbrainz_id: null,
      discogs_id: null,
      discogs_master_id: null,
      deezer_id: null,
      itunes_id: item.id,
      barcode: null
    },
    url: item.itunesUrl || null,
    score: null
  };
}

/**
 * Normalise une réponse de recherche iTunes
 * @param {Object} response - Réponse brute
 * @returns {Object} Réponse normalisée
 */
export function normalizeItunesSearch(response) {
  if (!response) return { query: '', provider: 'itunes', total_results: 0, results: [] };
  
  return {
    query: response.query || '',
    provider: 'itunes',
    total_results: response.totalResults || 0,
    page: 1,
    per_page: response.count || 0,
    results: (response.results || []).map(normalizeItunesSearchItem)
  };
}

/**
 * Normalise un item iTunes en format détail (pas d'API détails dédiée)
 * @param {Object} item - Item de recherche
 * @returns {Object} Détail normalisé
 */
export function normalizeItunesAlbumDetail(item) {
  if (!item) return null;
  
  // iTunes n'a pas d'API détails, on construit depuis les données de recherche
  const normalized = normalizeItunesSearchItem(item);
  
  return {
    ...normalized,
    album_subtypes: [],
    
    artists: item.artist ? [{
      id: item.artistId || null,
      name: item.artist,
      role: 'main',
      join_phrase: null
    }] : [],
    
    original_release_date: item.releaseDate || null,
    country: item.country || null,
    
    styles: [],
    tags: [],
    
    label: null,
    labels: [],
    
    tracks: [],
    disc_count: 1,
    
    duration_seconds: null,
    duration_formatted: null,
    
    formats: [],
    
    rating: null,
    community: null,
    
    pricing: {
      price: item.price || null,
      currency: item.currency || null,
      lowest_marketplace: null,
      for_sale_count: null
    },
    
    images: {
      ...normalized.images,
      all: []
    },
    
    external_ids: {
      ...normalized.external_ids
    },
    
    releases: [],
    notes: null
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Helpers
  formatDuration,
  
  // MusicBrainz
  normalizeMusicBrainzSearch,
  normalizeMusicBrainzSearchItem,
  normalizeMusicBrainzAlbumDetail,
  
  // Discogs
  normalizeDiscogsSearch,
  normalizeDiscogsSearchItem,
  normalizeDiscogsReleaseDetail,
  
  // Deezer
  normalizeDeezerSearch,
  normalizeDeezerSearchItem,
  normalizeDeezerAlbumDetail,
  
  // iTunes
  normalizeItunesSearch,
  normalizeItunesSearchItem,
  normalizeItunesAlbumDetail
};
