/**
 * Anime Normalizer
 * Normalizes anime data from Jikan (MyAnimeList) provider to unified format
 * 
 * @module normalizers/anime
 */

// ============================================================================
// CONTENT RATING MAPPING JP → FR
// ============================================================================

/**
 * Mapping des ratings japonais (MyAnimeList) vers les ratings français
 * Les ratings MAL sont: G, PG, PG-13, R - 17+, R+, Rx
 */
const jpToFrRating = {
    'G - All Ages': 'Tous publics',
    'PG - Children': 'Tous publics',
    'PG-13 - Teens 13 or older': '12',
    'R - 17+ (violence & profanity)': '16',
    'R+ - Mild Nudity': '16',
    'Rx - Hentai': '18',
    // Versions courtes
    'G': 'Tous publics',
    'PG': 'Tous publics',
    'PG-13': '12',
    'R': '16',
    'R+': '16',
    'Rx': '18',
    'R17+': '16'
};

/**
 * Convertit un rating japonais en rating français
 * @param {string} jpRating - Rating japonais (ex: "R+ - Mild Nudity")
 * @returns {object|null} - { country: 'FR', rating: '16' } ou null
 */
export function convertJpToFrRating(jpRating) {
    if (!jpRating) return null;
    
    // Chercher une correspondance exacte d'abord
    if (jpToFrRating[jpRating]) {
        return { country: 'FR', rating: jpToFrRating[jpRating] };
    }
    
    // Chercher par préfixe (pour gérer les variations)
    for (const [key, value] of Object.entries(jpToFrRating)) {
        if (jpRating.startsWith(key) || jpRating.includes(key)) {
            return { country: 'FR', rating: value };
        }
    }
    
    return null;
}

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
 * Build images array (TMDB-like format)
 * @param {object} data - Anime data
 * @returns {Array} - Array of image objects
 */
export function buildImages(data) {
    const images = [];
    
    const poster = data.poster || data.image || data.images?.jpg?.large_image_url;
    if (poster) {
        images.push({ url: poster, type: 'poster_original' });
    }
    
    const posterSmall = data.posterSmall || data.images?.jpg?.small_image_url;
    if (posterSmall) {
        images.push({ url: posterSmall, type: 'poster_small' });
    }
    
    return images;
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
        provider: 'jikan_anime',
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
 * Normalize Jikan anime detail response (TMDB-like format)
 * @param {object} data - Raw anime detail from Jikan
 * @returns {object} - Normalized anime object
 */
export function normalizeJikanAnimeDetail(data) {
    // Handle wrapped response
    const anime = data.data || data;
    const id = anime.mal_id || anime.id;
    
    // Handle genres - genresTranslated peut être un objet { genres: [...], genresTranslated: true }
    let genres = [];
    let genresOriginal = [];
    let hasTranslatedGenres = false;
    
    // Extraire les genres originaux
    if (Array.isArray(anime.genresOriginal)) {
        genresOriginal = anime.genresOriginal;
    } else if (Array.isArray(anime.genres)) {
        genresOriginal = typeof anime.genres[0] === 'string' ? anime.genres : extractNames(anime.genres);
    } else if (Array.isArray(anime.genresFull)) {
        genresOriginal = extractNames(anime.genresFull);
    }
    
    // Extraire les genres traduits
    if (anime.genresTranslated && typeof anime.genresTranslated === 'object' && anime.genresTranslated.genres) {
        genres = anime.genresTranslated.genres;
        hasTranslatedGenres = anime.genresTranslated.genresTranslated === true;
    } else if (Array.isArray(anime.genresTranslated)) {
        genres = anime.genresTranslated;
        hasTranslatedGenres = true;
    } else {
        genres = genresOriginal;
    }
    
    // Build trailers array (TMDB-like)
    const trailers = [];
    if (anime.trailer?.url) {
        trailers.push(anime.trailer.url);
    }
    
    // Extract studios names
    const studios = extractNames(anime.studios);
    
    // Build related as similar (TMDB-like)
    const similar = buildRelated(anime.relations)
        .filter(r => r.type === 'anime')
        .slice(0, 5)
        .map(r => ({
            id: String(r.mal_id),
            title: r.title,
            poster_url: null
        }));
    
    return {
        // === TMDB-like fields ===
        provider_id: String(id),
        mal_id: id,
        tmdb_id: null,
        imdb_id: null,
        
        title: anime.title || '',
        original_title: anime.originalTitle || anime.titleJapanese || anime.title_japanese || null,
        tagline: null,
        
        description: anime.overview || anime.synopsis || null,
        description_original: anime.overviewOriginal || anime.synopsis || null,
        description_translated: anime.overviewTranslated || null,
        
        year: anime.year || extractYear(anime.aired),
        release_date: extractDate(anime.aired?.from),
        runtime_minutes: anime.runtimeMinutes || parseDuration(anime.duration),
        
        status: normalizeAnimeStatus(anime.status),
        is_adult: anime.contentRating?.includes('R+') || anime.contentRating?.includes('Rx') || false,
        
        poster_url: anime.poster || anime.images?.jpg?.large_image_url || null,
        backdrop_url: null,
        images: buildImages(anime),
        trailers: trailers,
        
        rating_value: anime.rating?.average || anime.score || null,
        rating_count: anime.rating?.votes || anime.scoredBy || anime.scored_by || null,
        popularity: anime.popularity || null,
        
        genres: genres,
        genres_original: genresOriginal,
        genres_translated: hasTranslatedGenres ? genres : null,
        
        keywords: extractNames(anime.themes).concat(extractNames(anime.demographics)),
        
        certifications: (() => {
            const certs = [];
            const jpRating = anime.contentRating || anime.rating;
            if (jpRating && typeof jpRating === 'string') {
                certs.push({ country: 'JP', rating: jpRating });
                // Ajouter certification FR basée sur JP
                const frCert = convertJpToFrRating(jpRating);
                if (frCert) {
                    certs.push(frCert);
                }
            }
            return certs;
        })(),
        
        original_language: 'ja',
        languages: ['ja'],
        countries: ['JP'],
        
        studios: studios,
        budget: null,
        revenue: null,
        box_office: null,
        
        directors: anime.directors || [],
        writers: anime.writers || [],
        
        cast: anime.cast || [],
        
        collection: null,
        
        external_ids: {
            mal: id,
            imdb: null,
            tmdb: null,
            facebook: null,
            instagram: null,
            twitter: null,
            wikidata: null
        },
        
        recommendations: anime.recommendations || [],
        similar: similar,
        
        source_url: anime.url || `https://myanimelist.net/anime/${id}`,
        source: 'jikan_anime',
        
        // === Anime-specific fields ===
        type: 'anime',
        provider: 'jikan_anime',
        anime_type: anime.type || null,
        
        end_year: anime.endYear || extractYear(anime.aired?.to),
        first_air_date: extractDate(anime.aired?.from),
        last_air_date: extractDate(anime.aired?.to),
        
        is_airing: anime.airing ?? null,
        total_episodes: anime.totalEpisodes || anime.episodes || null,
        episode_runtime: anime.runtimeMinutes || parseDuration(anime.duration),
        season: anime.season || null,
        
        themes: extractNames(anime.themes),
        demographics: extractNames(anime.demographics),
        
        producers: extractNames(anime.producers),
        licensors: extractNames(anime.licensors),
        source_material: anime.source || null,
        
        content_rating: anime.contentRating || anime.rating || null,
        
        rank: anime.rank || null,
        members_count: anime.members || anime.members_count || null,
        favorites_count: anime.favorites || anime.favorites_count || null,
        
        trailer: buildTrailer(anime),
        broadcast: buildBroadcast(anime),
        related: buildRelated(anime.relations),
        streaming_platforms: Array.isArray(anime.streaming) ? anime.streaming : [],
        
        // Alternative titles
        title_english: anime.titleEnglish || anime.title_english || null,
        alternative_titles: collectAlternativeTitles(anime)
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
