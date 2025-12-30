/**
 * Videogame Normalizer
 * Normalizes videogame data from RAWG, IGDB, and JVC providers to unified format
 * 
 * @module normalizers/videogame
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const MULTIPLAYER_MODES = [
    'Multiplayer', 'Co-operative', 'Split screen', 
    'Massively Multiplayer Online (MMO)', 'Battle Royale',
    'Online Co-Op', 'Local Co-Op', 'Online Multiplayer', 'Local Multiplayer'
];

const MULTIPLAYER_TAGS = [
    'multiplayer', 'co-op', 'online-co-op', 'local-co-op', 
    'split-screen', 'mmo', 'massively-multiplayer', 
    'online-multiplayer', 'local-multiplayer', 'pvp', 'battle-royale'
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract names from array of objects or strings
 * @param {Array} items - Array of objects with name property or strings
 * @returns {Array} - Array of name strings
 */
export function extractNames(items) {
    if (!Array.isArray(items)) return [];
    
    return items
        .map(item => {
            if (typeof item === 'string') return item;
            return item?.name || null;
        })
        .filter(Boolean);
}

/**
 * Extract year from date string
 * @param {string} dateStr - Date string (ISO or other format)
 * @returns {number|null} - Year
 */
export function extractYear(dateStr) {
    if (!dateStr) return null;
    
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date.getFullYear();
}

/**
 * Parse ESRB rating to minimum age
 * @param {string} esrbSlug - ESRB slug (everyone, teen, mature, etc.)
 * @returns {number|null} - Minimum age
 */
export function esrbToMinAge(esrbSlug) {
    if (!esrbSlug) return null;
    
    const slug = String(esrbSlug).toLowerCase();
    
    const mapping = {
        'ec': 3, 'early-childhood': 3,
        'e': 6, 'everyone': 6,
        'e10': 10, 'e10+': 10, 'everyone-10-plus': 10,
        't': 13, 'teen': 13,
        'm': 17, 'mature': 17,
        'ao': 18, 'adults-only': 18
    };
    
    return mapping[slug] || null;
}

/**
 * Parse PEGI rating to minimum age
 * @param {string} pegiRating - PEGI rating string
 * @returns {number|null} - Minimum age
 */
export function pegiToMinAge(pegiRating) {
    if (!pegiRating) return null;
    
    const match = String(pegiRating).match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Detect if game is multiplayer from game modes or tags
 * @param {Array} gameModes - Game modes array
 * @param {Array} tags - Tags array (strings or objects with slug)
 * @returns {boolean} - Is multiplayer
 */
export function detectMultiplayer(gameModes = [], tags = []) {
    // Check game modes
    if (gameModes.some(mode => MULTIPLAYER_MODES.includes(mode))) {
        return true;
    }
    
    // Check tags
    const tagSlugs = tags.map(t => typeof t === 'string' ? t : t?.slug || '').filter(Boolean);
    return tagSlugs.some(slug => MULTIPLAYER_TAGS.includes(slug.toLowerCase()));
}

/**
 * Parse player count from string like "1-4" or "1-8 joueurs"
 * @param {string|number} players - Player count string or number
 * @returns {number|null} - Maximum players
 */
export function parseMaxPlayers(players) {
    if (!players) return null;
    if (typeof players === 'number') return players;
    
    const match = String(players).match(/(\d+)(?:\s*-\s*(\d+))?/);
    if (match) {
        return parseInt(match[2] || match[1], 10);
    }
    return null;
}

/**
 * Normalize videogame images to array format [{url, type}]
 * @param {object} images - Images object with cover, screenshots, artworks etc.
 * @returns {Array<{url: string, type?: string}>} - Normalized images array
 */
export function normalizeVideogameImages(images) {
    if (!images) return [];
    
    const result = [];
    const seenUrls = new Set();
    
    const addImage = (url, type = null) => {
        if (url && typeof url === 'string' && !seenUrls.has(url)) {
            seenUrls.add(url);
            const img = { url };
            if (type) img.type = type;
            result.push(img);
        }
    };
    
    // Cover principale
    if (images.cover) addImage(images.cover, 'cover');
    if (images.cover_small && images.cover_small !== images.cover) addImage(images.cover_small, 'cover_small');
    
    // Background
    if (images.background && images.background !== images.cover) addImage(images.background, 'background');
    
    // Screenshots
    if (Array.isArray(images.screenshots)) {
        images.screenshots.forEach((s, i) => {
            const url = typeof s === 'string' ? s : s?.full || s?.big || s?.url;
            addImage(url, `screenshot_${i + 1}`);
        });
    }
    
    // Artworks
    if (Array.isArray(images.artworks)) {
        images.artworks.forEach((a, i) => {
            const url = typeof a === 'string' ? a : a?.hd || a?.url;
            addImage(url, `artwork_${i + 1}`);
        });
    }
    
    return result;
}

/**
 * Build IGDB image URL
 * @param {string} imageId - IGDB image ID
 * @param {string} size - Size (t_thumb, t_cover_small, t_cover_big, t_720p, t_1080p)
 * @returns {string|null} - Full URL
 */
export function buildIgdbImageUrl(imageId, size = 't_cover_big') {
    if (!imageId) return null;
    return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
}

// ============================================================================
// RAWG NORMALIZERS
// ============================================================================

/**
 * Normalize a single RAWG game search result
 * @param {object} game - Raw RAWG game from search
 * @returns {object} - Normalized videogame object
 */
export function normalizeRawgSearchItem(game) {
    const isMulti = detectMultiplayer([], game.tags || []);
    
    return {
        type: 'videogame',
        provider: 'rawg',
        provider_id: String(game.id),
        
        title: game.name || '',
        original_title: game.nameOriginal || null,
        alternative_titles: [],
        
        description: game.summary || null,
        storyline: null,
        
        release_date: game.released || null,
        year: extractYear(game.released),
        tba: game.tba || false,
        
        platforms: (game.platforms || []).map(p => ({
            id: p.platform?.id || p.id || null,
            name: p.platform?.name || p.name || '',
            abbreviation: p.platform?.slug || p.slug || null
        })),
        
        genres: extractNames(game.genres),
        themes: [],
        game_modes: [],
        player_perspectives: [],
        keywords: extractNames(game.tags),
        
        developers: [],
        publishers: [],
        
        franchise: null,
        collection: null,
        
        age_rating: game.esrbRating ? {
            pegi: null,
            esrb: game.esrbRating.name || null,
            min_age: esrbToMinAge(game.esrbRating.slug),
            content_descriptors: []
        } : null,
        
        is_multiplayer: isMulti,
        multiplayer_modes: [],
        max_players: null,
        
        rating: {
            value: game.rating ? Math.round(game.rating * 20) : null,
            count: game.ratingsCount || null,
            source: 'rawg'
        },
        metacritic: game.metacritic ? {
            score: game.metacritic,
            url: null
        } : null,
        
        playtime: game.playtime || null,
        
        images: normalizeVideogameImages({
            cover: game.backgroundImage || (game.image && game.image[0]) || null,
            cover_small: null,
            background: game.backgroundImage || null,
            screenshots: game.shortScreenshots || [],
            artworks: []
        }),
        
        videos: [],
        stores: [],
        websites: [],
        related: null,
        
        external_ids: {
            rawg_id: game.id,
            rawg_slug: game.slug,
            igdb_id: null,
            igdb_slug: null,
            jvc_id: null
        },
        
        source_url: game.url || `https://rawg.io/games/${game.slug}`,
        data_source: 'rawg'
    };
}

/**
 * Normalize RAWG search response
 * @param {object} response - Raw RAWG search response
 * @returns {object} - Normalized search response
 */
export function normalizeRawgSearch(response) {
    const games = response.games || [];
    
    return {
        query: response.query || '',
        pagination: {
            currentPage: response.page || 1,
            totalPages: response.totalPages || 1,
            totalResults: response.totalResults || games.length,
            hasNextPage: response.hasNext || false
        },
        results_count: games.length,
        results: games.map(normalizeRawgSearchItem),
        data_source: 'rawg'
    };
}

/**
 * Normalize RAWG game detail (already harmonized by provider)
 * @param {object} data - Harmonized RAWG game detail
 * @returns {object} - Normalized videogame object
 */
export function normalizeRawgGameDetail(data) {
    const raw = data._raw || {};
    const isMulti = data.isMultiplayer || detectMultiplayer([], raw.tags || []);
    
    return {
        type: 'videogame',
        provider: 'rawg',
        provider_id: String(data.id),
        
        title: data.title || data.name || '',
        original_title: raw.nameOriginal || null,
        alternative_titles: [],
        
        description: data.synopsis || data.description || null,
        description_original: data.descriptionOriginal || null,
        description_translated: data.descriptionTranslated || null,
        storyline: null,
        
        release_date: data.releaseDate || null,
        year: extractYear(data.releaseDate),
        tba: raw.tba || false,
        
        platforms: (data.platforms || []).map(p => ({
            id: null,
            name: typeof p === 'string' ? p : (p.name || ''),
            abbreviation: null
        })),
        
        genres: data.genresTranslated || data.genres || [],
        genres_original: data.genresOriginal || data.genres || [],
        genres_translated: data.genresTranslated || null,
        themes: [],
        game_modes: [],
        player_perspectives: [],
        keywords: extractNames(raw.tags),
        
        developers: data.developers || [],
        publishers: data.publishers || [],
        
        franchise: null,
        collection: null,
        
        age_rating: data.pegi || data.minAge ? {
            pegi: null,
            esrb: data.pegi || null,
            min_age: data.minAge || null,
            content_descriptors: []
        } : null,
        
        is_multiplayer: isMulti,
        multiplayer_modes: [],
        max_players: null,
        
        media: null,
        
        rating: {
            value: data.rating || null,
            count: raw.ratingsCount || null,
            source: 'rawg'
        },
        metacritic: raw.metacritic ? {
            score: raw.metacritic,
            url: raw.metacriticPlatforms?.[0]?.url || null
        } : null,
        
        playtime: raw.playtime || null,
        
        images: normalizeVideogameImages({
            cover: (data.image && data.image[0]) || raw.backgroundImage || null,
            cover_small: null,
            background: raw.backgroundImage || null,
            screenshots: data.image?.slice(1) || [],
            artworks: []
        }),
        
        videos: raw.clip ? [{
            name: 'Clip',
            type: 'gameplay',
            url: raw.clip.video || raw.clip,
            thumbnail: raw.clip.preview || null
        }] : [],
        
        stores: (raw.stores || []).map(s => ({
            name: s.name || '',
            url: s.url || ''
        })),
        
        websites: raw.website ? [{
            type: 'official',
            url: raw.website
        }] : [],
        
        related: null,
        
        external_ids: {
            rawg_id: data.id,
            rawg_slug: data.slug,
            igdb_id: null,
            igdb_slug: null,
            jvc_id: null
        },
        
        source_url: data.url || `https://rawg.io/games/${data.slug}`,
        data_source: 'rawg'
    };
}

// ============================================================================
// IGDB NORMALIZERS
// ============================================================================

/**
 * Normalize a single IGDB game search result
 * @param {object} game - Raw IGDB game from search
 * @returns {object} - Normalized videogame object
 */
export function normalizeIgdbSearchItem(game) {
    const isMulti = detectMultiplayer(game.gameModes || [], []);
    
    return {
        type: 'videogame',
        provider: 'igdb',
        provider_id: String(game.id),
        
        title: game.name || '',
        original_title: null,
        alternative_titles: [],
        
        description: game.summary || null,
        storyline: null,
        
        release_date: game.releaseDate || null,
        year: extractYear(game.releaseDate),
        tba: false,
        
        platforms: (game.platforms || []).map(p => ({
            id: null,
            name: p.name || '',
            abbreviation: p.abbreviation || null
        })),
        
        genres: game.genres || [],
        themes: game.themes || [],
        game_modes: game.gameModes || [],
        player_perspectives: [],
        keywords: [],
        
        developers: game.developers || [],
        publishers: game.publishers || [],
        
        franchise: null,
        collection: null,
        
        age_rating: null,
        
        is_multiplayer: isMulti,
        multiplayer_modes: isMulti ? game.gameModes?.filter(m => MULTIPLAYER_MODES.includes(m)) || [] : [],
        max_players: null,
        
        rating: {
            value: game.totalRating || game.rating || null,
            count: null,
            source: 'igdb'
        },
        metacritic: null,
        
        playtime: null,
        
        images: normalizeVideogameImages({
            cover: game.cover?.coverBig || (game.image && game.image[0]) || null,
            cover_small: game.cover?.coverSmall || null,
            background: null,
            screenshots: (game.screenshots || []).map(s => s.full || s),
            artworks: []
        }),
        
        videos: (game.videos || []).map(v => ({
            name: null,
            type: 'trailer',
            url: v.youtubeUrl || v.url,
            thumbnail: null
        })),
        
        stores: [],
        websites: [],
        related: null,
        
        external_ids: {
            rawg_id: null,
            rawg_slug: null,
            igdb_id: game.id,
            igdb_slug: game.slug,
            jvc_id: null
        },
        
        source_url: game.url || `https://www.igdb.com/games/${game.slug}`,
        data_source: 'igdb'
    };
}

/**
 * Normalize IGDB search response
 * @param {object} response - Raw IGDB search response
 * @returns {object} - Normalized search response
 */
export function normalizeIgdbSearch(response) {
    const games = response.games || [];
    
    return {
        query: response.query || '',
        pagination: {
            currentPage: 1,
            totalPages: 1,
            totalResults: games.length,
            hasNextPage: false
        },
        results_count: games.length,
        results: games.map(normalizeIgdbSearchItem),
        data_source: 'igdb'
    };
}

/**
 * Normalize IGDB game detail (already harmonized by provider)
 * @param {object} data - Harmonized IGDB game detail
 * @returns {object} - Normalized videogame object
 */
export function normalizeIgdbGameDetail(data) {
    const raw = data._raw || {};
    const isMulti = data.isMultiplayer || detectMultiplayer(raw.gameModes || [], []);
    
    // Extract age ratings
    let ageRating = null;
    if (data.pegi || data.minAge || (raw.ageRatings && raw.ageRatings.length > 0)) {
        const pegiRating = raw.ageRatings?.find(r => r.system === 'PEGI');
        const esrbRating = raw.ageRatings?.find(r => r.system === 'ESRB');
        
        ageRating = {
            pegi: pegiRating?.rating || data.pegi || null,
            esrb: esrbRating?.rating || null,
            min_age: data.minAge || pegiRating?.minAge || esrbRating?.minAge || null,
            content_descriptors: []
        };
    }
    
    return {
        type: 'videogame',
        provider: 'igdb',
        provider_id: String(data.id),
        
        title: data.title || data.name || '',
        original_title: null,
        alternative_titles: [],
        
        description: data.synopsis || data.summary || null,
        description_original: data.summaryOriginal || null,
        description_translated: data.summaryTranslated || null,
        storyline: data.storyline || raw.storyline || null,
        storyline_original: data.storylineOriginal || null,
        storyline_translated: data.storylineTranslated || null,
        
        release_date: data.releaseDate || null,
        year: extractYear(data.releaseDate),
        tba: false,
        
        platforms: (data.platforms || []).map(p => ({
            id: null,
            name: typeof p === 'string' ? p : (p.name || ''),
            abbreviation: typeof p === 'object' ? p.abbreviation : null
        })),
        
        genres: data.genresTranslated || data.genres || [],
        genres_original: data.genresOriginal || data.genres || [],
        genres_translated: data.genresTranslated || null,
        themes: raw.themes || [],
        game_modes: raw.gameModes || [],
        player_perspectives: raw.playerPerspectives || [],
        keywords: raw.keywords || [],
        
        developers: data.developers || [],
        publishers: data.publishers || [],
        
        franchise: raw.franchises?.[0] || null,
        collection: raw.collection || null,
        
        age_rating: ageRating,
        
        is_multiplayer: isMulti,
        multiplayer_modes: isMulti ? raw.gameModes?.filter(m => MULTIPLAYER_MODES.includes(m)) || [] : [],
        max_players: null,
        
        media: null,
        
        rating: {
            value: data.rating || null,
            count: raw.ratingCount || null,
            source: 'igdb'
        },
        metacritic: null,
        
        playtime: null,
        
        images: normalizeVideogameImages({
            cover: (data.image && data.image[0]) || null,
            cover_small: raw.cover?.coverSmall || null,
            background: null,
            screenshots: raw.screenshots?.map(s => s.big || s) || [],
            artworks: raw.artworks?.map(a => a.hd || a) || []
        }),
        
        videos: (raw.videos || []).map(v => ({
            name: v.name || null,
            type: 'trailer',
            url: v.youtubeUrl || `https://www.youtube.com/watch?v=${v.videoId}`,
            thumbnail: v.videoId ? `https://img.youtube.com/vi/${v.videoId}/maxresdefault.jpg` : null
        })),
        
        stores: [],
        
        websites: (raw.websites || []).map(w => ({
            type: w.category || 'other',
            url: w.url
        })),
        
        related: {
            dlcs: raw.dlcs || [],
            expansions: raw.expansions || [],
            parent_game: raw.parentGame || null,
            similar_games: (raw.similarGames || []).map(sg => ({
                name: sg.name,
                slug: sg.slug,
                cover: sg.cover
            }))
        },
        
        external_ids: {
            rawg_id: null,
            rawg_slug: null,
            igdb_id: data.id,
            igdb_slug: data.slug,
            jvc_id: null
        },
        
        source_url: data.url || `https://www.igdb.com/games/${data.slug}`,
        data_source: 'igdb'
    };
}

// ============================================================================
// JVC NORMALIZERS
// ============================================================================

/**
 * Normalize a single JVC game search result
 * @param {object} game - Raw JVC game from search
 * @returns {object} - Normalized videogame object
 */
export function normalizeJvcSearchItem(game) {
    return {
        type: 'videogame',
        provider: 'jvc',
        provider_id: String(game.id),
        
        title: game.title || '',
        original_title: null,
        alternative_titles: [],
        
        description: game.description || null,
        storyline: null,
        
        release_date: game.releaseDate || null,
        year: extractYear(game.releaseDate),
        tba: false,
        
        platforms: [],
        genres: [],
        themes: [],
        game_modes: [],
        player_perspectives: [],
        keywords: [],
        
        developers: [],
        publishers: [],
        
        franchise: null,
        collection: null,
        
        age_rating: null,
        
        is_multiplayer: null,
        multiplayer_modes: [],
        max_players: null,
        
        rating: null,
        metacritic: null,
        
        playtime: null,
        
        images: normalizeVideogameImages({
            cover: (game.image && game.image[0]) || game.cover || null,
            cover_small: game.thumb || null,
            background: null,
            screenshots: [],
            artworks: []
        }),
        
        videos: [],
        stores: [],
        websites: [],
        related: null,
        
        external_ids: {
            rawg_id: null,
            rawg_slug: null,
            igdb_id: null,
            igdb_slug: null,
            jvc_id: game.id
        },
        
        source_url: game.url || `https://www.jeuxvideo.com/jeux/jeu-${game.id}/`,
        data_source: 'jvc'
    };
}

/**
 * Normalize JVC search response
 * @param {object} response - Raw JVC search response
 * @returns {object} - Normalized search response
 */
export function normalizeJvcSearch(response) {
    const results = response.results || [];
    
    return {
        query: response.query || '',
        pagination: {
            currentPage: 1,
            totalPages: 1,
            totalResults: response.resultsCount || results.length,
            hasNextPage: false
        },
        results_count: results.length,
        results: results.map(normalizeJvcSearchItem),
        data_source: 'jvc'
    };
}

/**
 * Normalize JVC game detail (already harmonized by provider)
 * @param {object} data - Harmonized JVC game detail
 * @returns {object} - Normalized videogame object
 */
export function normalizeJvcGameDetail(data) {
    const raw = data._raw || {};
    
    return {
        type: 'videogame',
        provider: 'jvc',
        provider_id: String(data.id),
        
        title: data.title || data.name || '',
        original_title: null,
        alternative_titles: [],
        
        description: data.synopsis || null,
        storyline: null,
        
        release_date: data.releaseDate || null,
        year: extractYear(data.releaseDate),
        tba: false,
        
        platforms: (data.platforms || []).map(p => ({
            id: null,
            name: typeof p === 'string' ? p : (p.name || ''),
            abbreviation: null
        })),
        
        genres: data.genres || [],
        themes: [],
        game_modes: [],
        player_perspectives: [],
        keywords: [],
        
        developers: data.developers || [],
        publishers: data.publishers || [],
        
        franchise: null,
        collection: null,
        
        age_rating: data.pegi || data.minAge ? {
            pegi: data.pegi || null,
            esrb: null,
            min_age: data.minAge || pegiToMinAge(data.pegi) || null,
            content_descriptors: []
        } : null,
        
        is_multiplayer: data.isMultiplayer || false,
        multiplayer_modes: [],
        max_players: parseMaxPlayers(raw.nbPlayers),
        
        media: data.media || null,
        
        rating: data.rating ? {
            value: data.rating,
            count: null,
            source: 'jvc'
        } : null,
        metacritic: null,
        
        playtime: null,
        
        images: normalizeVideogameImages({
            cover: (data.image && data.image[0]) || raw.cover || null,
            cover_small: null,
            background: null,
            screenshots: [],
            artworks: []
        }),
        
        videos: [],
        stores: [],
        
        websites: raw.testUrl ? [{
            type: 'review',
            url: raw.testUrl
        }] : [],
        
        related: null,
        
        external_ids: {
            rawg_id: null,
            rawg_slug: null,
            igdb_id: null,
            igdb_slug: null,
            jvc_id: data.id
        },
        
        source_url: data.url || `https://www.jeuxvideo.com/jeux/jeu-${data.id}/`,
        data_source: 'jvc'
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    // Helpers
    extractNames,
    extractYear,
    esrbToMinAge,
    pegiToMinAge,
    detectMultiplayer,
    parseMaxPlayers,
    buildIgdbImageUrl,
    
    // RAWG normalizers
    normalizeRawgSearchItem,
    normalizeRawgSearch,
    normalizeRawgGameDetail,
    
    // IGDB normalizers
    normalizeIgdbSearchItem,
    normalizeIgdbSearch,
    normalizeIgdbGameDetail,
    
    // JVC normalizers
    normalizeJvcSearchItem,
    normalizeJvcSearch,
    normalizeJvcGameDetail
};
