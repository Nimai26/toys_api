/**
 * Anime Normalizer
 * Normalizes anime data from Jikan (MyAnimeList) provider to unified format
 * 
 * @module normalizers/anime
 */

// ============================================================================
// STATUS NORMALIZATION
// ============================================================================

/**
 * Normalize anime airing status to standard values
 * @param {string} status - Raw status from Jikan
 * @returns {string|null} - Normalized status (Airing, Ended, Upcoming)
 */
export function normalizeAnimeStatus(status) {
    if (!status) return null;
    
    const statusLower = status.toLowerCase();
    
    // Airing status
    if (statusLower.includes('airing') && !statusLower.includes('finished')) {
        return 'Airing';
    }
    
    // Ended/Finished status
    if (statusLower.includes('finished') || statusLower.includes('ended') || statusLower.includes('complete')) {
        return 'Ended';
    }
    
    // Upcoming/Not yet aired
    if (statusLower.includes('not yet') || statusLower.includes('upcoming') || statusLower.includes('to be')) {
        return 'Upcoming';
    }
    
    return status;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse duration string to minutes
 * @param {string|number} duration - Duration (e.g., "23 min per ep", "1 hr 30 min", 23)
 * @returns {number|null} - Duration in minutes
 */
export function parseDuration(duration) {
    if (!duration) return null;
    
    // Already a number
    if (typeof duration === 'number') return duration;
    
    const str = String(duration).toLowerCase();
    let totalMinutes = 0;
    
    // Extract hours
    const hourMatch = str.match(/(\d+)\s*h(?:r|our)?s?/);
    if (hourMatch) {
        totalMinutes += parseInt(hourMatch[1], 10) * 60;
    }
    
    // Extract minutes
    const minMatch = str.match(/(\d+)\s*min/);
    if (minMatch) {
        totalMinutes += parseInt(minMatch[1], 10);
    }
    
    return totalMinutes > 0 ? totalMinutes : null;
}

/**
 * Extract date part from ISO datetime string
 * @param {string} dateTime - ISO datetime string
 * @returns {string|null} - Date in YYYY-MM-DD format
 */
export function extractDate(dateTime) {
    if (!dateTime) return null;
    
    try {
        const date = new Date(dateTime);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    } catch (e) {
        return null;
    }
}

/**
 * Extract year from date string or object
 * @param {string|object} dateInfo - Date string or aired object
 * @returns {number|null} - Year
 */
export function extractYear(dateInfo) {
    if (!dateInfo) return null;
    
    // If it's already a number
    if (typeof dateInfo === 'number') return dateInfo;
    
    // If it's an object with 'from' property (aired object)
    if (typeof dateInfo === 'object' && dateInfo.from) {
        const date = new Date(dateInfo.from);
        return isNaN(date.getTime()) ? null : date.getFullYear();
    }
    
    // If it's a string
    if (typeof dateInfo === 'string') {
        const date = new Date(dateInfo);
        return isNaN(date.getTime()) ? null : date.getFullYear();
    }
    
    return null;
}

/**
 * Extract names from array of objects with name property
 * @param {Array} items - Array of objects like [{id: 1, name: "Action"}]
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
 * Collect all alternative titles
 * @param {object} data - Anime data with various title fields
 * @returns {Array} - Unique alternative titles
 */
export function collectAlternativeTitles(data) {
    const titles = new Set();
    
    // From titles array
    if (Array.isArray(data.titles)) {
        data.titles.forEach(t => {
            if (t?.title) titles.add(t.title);
        });
    }
    
    // Individual title fields
    if (data.title) titles.add(data.title);
    if (data.titleEnglish || data.title_english) titles.add(data.titleEnglish || data.title_english);
    if (data.titleJapanese || data.title_japanese) titles.add(data.titleJapanese || data.title_japanese);
    if (data.originalTitle) titles.add(data.originalTitle);
    
    // Remove nulls and empty strings
    titles.delete(null);
    titles.delete(undefined);
    titles.delete('');
    
    return Array.from(titles);
}

/**
 * Build images object
 * @param {object} data - Anime data
 * @returns {object} - Normalized images object
 */
export function buildImages(data) {
    return {
        poster: data.poster || data.image || data.images?.jpg?.large_image_url || null,
        poster_small: data.posterSmall || data.images?.jpg?.image_url || null
    };
}

/**
 * Build trailer object
 * @param {object} data - Anime data with trailer info
 * @returns {object|null} - Normalized trailer object
 */
export function buildTrailer(data) {
    // Handle trailer as string (URL)
    if (typeof data.trailer === 'string') {
        const youtubeMatch = data.trailer.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        return {
            url: data.trailer,
            youtube_id: youtubeMatch ? youtubeMatch[1] : null,
            thumbnail: youtubeMatch ? `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg` : null
        };
    }
    
    // Handle trailer as object
    if (data.trailer && typeof data.trailer === 'object') {
        return {
            url: data.trailer.url || null,
            youtube_id: data.trailer.youtubeId || data.trailer.youtube_id || null,
            thumbnail: data.trailer.thumbnail || data.trailer.images?.maximum_image_url || null
        };
    }
    
    return null;
}

/**
 * Build broadcast object
 * @param {object} data - Anime data
 * @returns {object|null} - Normalized broadcast object
 */
export function buildBroadcast(data) {
    if (!data.broadcast) return null;
    
    if (typeof data.broadcast === 'object') {
        return {
            day: data.broadcast.day || null,
            time: data.broadcast.time || null,
            timezone: data.broadcast.timezone || null
        };
    }
    
    return null;
}

/**
 * Build related entries array
 * @param {Array} relations - Relations array from Jikan
 * @returns {Array} - Normalized related entries
 */
export function buildRelated(relations) {
    if (!Array.isArray(relations)) return [];
    
    const related = [];
    
    relations.forEach(rel => {
        if (Array.isArray(rel.entries) || Array.isArray(rel.entry)) {
            const entries = rel.entries || rel.entry || [];
            entries.forEach(entry => {
                related.push({
                    relation: rel.relation || 'Related',
                    mal_id: entry.mal_id || entry.id,
                    type: entry.type || 'anime',
                    title: entry.name || entry.title || ''
                });
            });
        }
    });
    
    return related;
}

/**
 * Build rating object
 * @param {object} data - Anime data
 * @returns {object} - Normalized rating object
 */
export function buildRating(data) {
    // Check for pre-structured rating object
    if (data.rating && typeof data.rating === 'object' && 'average' in data.rating) {
        return {
            value: data.rating.average || null,
            count: data.rating.votes || data.scoredBy || data.scored_by || null,
            source: 'myanimelist'
        };
    }
    
    return {
        value: data.score || null,
        count: data.scoredBy || data.scored_by || null,
        source: 'myanimelist'
    };
}

// ============================================================================
// JIKAN SEARCH NORMALIZER
// ============================================================================

/**
 * Normalize a single Jikan anime search result
 * @param {object} item - Raw search result item
 * @returns {object} - Normalized anime object
 */
export function normalizeJikanSearchItem(item) {
    const id = item.mal_id || item.id;
    
    return {
        type: 'anime',
        provider: 'jikan',
        provider_id: String(id),
        mal_id: id,
        
        title: item.title || '',
        original_title: item.titleJapanese || item.title_japanese || null,
        title_english: item.titleEnglish || item.title_english || null,
        alternative_titles: collectAlternativeTitles(item),
        
        description: item.synopsis || item.overview || null,
        anime_type: item.type || null,
        
        year: item.year || extractYear(item.aired),
        end_year: item.endYear || extractYear(item.aired?.to),
        first_air_date: extractDate(item.aired?.from),
        last_air_date: extractDate(item.aired?.to),
        
        status: normalizeAnimeStatus(item.status),
        is_airing: item.airing ?? null,
        
        total_episodes: item.episodes || item.totalEpisodes || null,
        episode_runtime: parseDuration(item.duration || item.runtimeMinutes),
        season: item.season || null,
        
        genres: extractNames(item.genres),
        themes: extractNames(item.themes),
        demographics: extractNames(item.demographics),
        
        studios: extractNames(item.studios),
        producers: extractNames(item.producers),
        licensors: extractNames(item.licensors),
        source_material: item.source || null,
        
        content_rating: item.rating || item.contentRating || null,
        
        rating: buildRating(item),
        
        rank: item.rank || null,
        popularity: item.popularity || null,
        members_count: item.members || null,
        favorites_count: item.favorites || null,
        
        images: buildImages(item),
        
        trailer: buildTrailer(item),
        
        external_ids: {
            mal_id: id,
            source_url: item.url || `https://myanimelist.net/anime/${id}`
        },
        
        source_url: item.url || `https://myanimelist.net/anime/${id}`,
        data_source: 'jikan_anime'
    };
}

/**
 * Normalize Jikan anime search response
 * @param {object} response - Raw Jikan search response
 * @returns {object} - Normalized search response
 */
export function normalizeJikanSearch(response) {
    const results = response.results || response.data || [];
    
    return {
        query: response.query || '',
        pagination: response.pagination || {
            currentPage: 1,
            hasNextPage: false,
            totalResults: results.length
        },
        results_count: results.length,
        results: results.map(normalizeJikanSearchItem),
        data_source: 'jikan_anime'
    };
}

// ============================================================================
// JIKAN DETAIL NORMALIZER
// ============================================================================

/**
 * Normalize Jikan anime detail response
 * @param {object} data - Raw anime detail from Jikan
 * @returns {object} - Normalized anime object
 */
export function normalizeJikanAnimeDetail(data) {
    // Handle wrapped response
    const anime = data.data || data;
    const id = anime.mal_id || anime.id;
    
    // Handle genres - could be array of strings or objects
    let genres = [];
    if (Array.isArray(anime.genres)) {
        genres = extractNames(anime.genres);
    }
    if (Array.isArray(anime.genresFull)) {
        genres = extractNames(anime.genresFull);
    }
    
    return {
        type: 'anime',
        provider: 'jikan',
        provider_id: String(id),
        mal_id: id,
        
        title: anime.title || '',
        original_title: anime.originalTitle || anime.titleJapanese || anime.title_japanese || null,
        title_english: anime.titleEnglish || anime.title_english || null,
        alternative_titles: collectAlternativeTitles(anime),
        
        description: anime.overview || anime.synopsis || null,
        anime_type: anime.type || null,
        
        year: anime.year || extractYear(anime.aired),
        end_year: anime.endYear || extractYear(anime.aired?.to),
        first_air_date: extractDate(anime.aired?.from),
        last_air_date: extractDate(anime.aired?.to),
        
        status: normalizeAnimeStatus(anime.status),
        is_airing: anime.airing ?? null,
        
        total_episodes: anime.totalEpisodes || anime.episodes || null,
        episode_runtime: anime.runtimeMinutes || parseDuration(anime.duration),
        season: anime.season || null,
        
        genres: genres.length > 0 ? genres : extractNames(anime.genres),
        themes: extractNames(anime.themes),
        demographics: extractNames(anime.demographics),
        
        studios: extractNames(anime.studios),
        producers: extractNames(anime.producers),
        licensors: extractNames(anime.licensors),
        source_material: anime.source || null,
        
        content_rating: anime.contentRating || anime.rating || null,
        
        rating: buildRating(anime),
        
        rank: anime.rank || null,
        popularity: anime.popularity || null,
        members_count: anime.members || anime.members_count || null,
        favorites_count: anime.favorites || anime.favorites_count || null,
        
        images: buildImages(anime),
        
        trailer: buildTrailer(anime),
        
        broadcast: buildBroadcast(anime),
        
        related: buildRelated(anime.relations),
        
        streaming_platforms: Array.isArray(anime.streaming) ? anime.streaming : [],
        
        external_ids: {
            mal_id: id,
            source_url: anime.url || `https://myanimelist.net/anime/${id}`
        },
        
        source_url: anime.url || `https://myanimelist.net/anime/${id}`,
        data_source: 'jikan_anime'
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    // Status normalization
    normalizeAnimeStatus,
    
    // Helpers
    parseDuration,
    extractDate,
    extractYear,
    extractNames,
    collectAlternativeTitles,
    buildImages,
    buildTrailer,
    buildBroadcast,
    buildRelated,
    buildRating,
    
    // Jikan normalizers
    normalizeJikanSearchItem,
    normalizeJikanSearch,
    normalizeJikanAnimeDetail
};
