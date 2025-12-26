/**
 * Manga Normalizer
 * Normalizes manga data from Jikan (MyAnimeList) provider to unified format
 * 
 * @module normalizers/manga
 */

// ============================================================================
// STATUS NORMALIZATION
// ============================================================================

/**
 * Normalize manga publication status to standard values
 * @param {string} status - Raw status from Jikan
 * @returns {string|null} - Normalized status
 */
export function normalizeMangaStatus(status) {
    if (!status) return null;
    
    const statusLower = status.toLowerCase();
    
    // Publishing status
    if (statusLower.includes('publishing')) {
        return 'Publishing';
    }
    
    // Finished status
    if (statusLower.includes('finished') || statusLower.includes('complete')) {
        return 'Finished';
    }
    
    // Hiatus status
    if (statusLower.includes('hiatus')) {
        return 'Hiatus';
    }
    
    // Discontinued status
    if (statusLower.includes('discontinued')) {
        return 'Discontinued';
    }
    
    // Upcoming/Not yet published
    if (statusLower.includes('not yet') || statusLower.includes('upcoming')) {
        return 'Upcoming';
    }
    
    return status;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
 * @param {string|object} dateInfo - Date string or published object
 * @returns {number|null} - Year
 */
export function extractYear(dateInfo) {
    if (!dateInfo) return null;
    
    // If it's already a number
    if (typeof dateInfo === 'number') return dateInfo;
    
    // If it's an object with 'from' property
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
 * Parse authors from various formats
 * @param {Array} authors - Authors array (strings or objects)
 * @returns {Array} - Normalized author objects
 */
export function parseAuthors(authors) {
    if (!Array.isArray(authors)) return [];
    
    return authors.map(author => {
        if (typeof author === 'string') {
            return { name: author, role: null };
        }
        if (typeof author === 'object') {
            return {
                name: author.name || author,
                role: author.role || author.type || null
            };
        }
        return null;
    }).filter(Boolean);
}

/**
 * Collect all alternative titles
 * @param {object} data - Manga data with various title fields
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
 * Build images object from various formats
 * @param {object} data - Manga data
 * @returns {object} - Normalized images object
 */
export function buildImages(data) {
    // Handle image as array
    if (Array.isArray(data.image)) {
        return {
            poster: data.image[0] || null,
            poster_small: data.image[2] || data.image[1] || null
        };
    }
    
    // Handle images object from raw API
    if (data.images?.jpg) {
        return {
            poster: data.images.jpg.large_image_url || data.images.jpg.image_url || null,
            poster_small: data.images.jpg.small_image_url || null
        };
    }
    
    return {
        poster: data.poster || data.image || null,
        poster_small: data.posterSmall || null
    };
}

/**
 * Build rating object
 * @param {object} data - Manga data
 * @returns {object} - Normalized rating object
 */
export function buildRating(data) {
    return {
        value: data.score || null,
        count: data.scoredBy || data.scored_by || null,
        source: 'myanimelist'
    };
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
        const entries = rel.entries || rel.entry || [];
        if (Array.isArray(entries)) {
            entries.forEach(entry => {
                related.push({
                    relation: rel.relation || 'Related',
                    mal_id: entry.mal_id || entry.id,
                    type: entry.type || 'manga',
                    title: entry.name || entry.title || ''
                });
            });
        }
    });
    
    return related;
}

// ============================================================================
// JIKAN SEARCH NORMALIZER
// ============================================================================

/**
 * Normalize a single Jikan manga search result
 * @param {object} item - Raw search result item
 * @returns {object} - Normalized manga object
 */
export function normalizeJikanMangaSearchItem(item) {
    const id = item.mal_id || item.id;
    const releaseDate = item.releaseDate || item.published?.from;
    
    return {
        type: 'manga',
        provider: 'jikan',
        provider_id: String(id),
        mal_id: id,
        
        title: item.title || '',
        original_title: item.originalTitle || item.title_japanese || null,
        title_english: item.titleEnglish || item.title_english || null,
        alternative_titles: collectAlternativeTitles(item),
        
        description: item.synopsis || item.description || null,
        manga_type: item.type || null,
        
        year: extractYear(releaseDate),
        end_year: extractYear(item.published?.to),
        start_date: extractDate(releaseDate),
        end_date: extractDate(item.published?.to),
        
        status: normalizeMangaStatus(item.status),
        is_publishing: item.status?.toLowerCase().includes('publishing') ?? null,
        
        total_volumes: item.volumes || item.tome || item.totalVolumes || null,
        total_chapters: item.chapters || item.totalChapters || null,
        
        authors: parseAuthors(item.authors),
        serializations: extractNames(item.serializations) || item.editors || [],
        
        genres: Array.isArray(item.genres) 
            ? (typeof item.genres[0] === 'string' ? item.genres : extractNames(item.genres))
            : [],
        themes: extractNames(item.themes),
        demographics: extractNames(item.demographics),
        
        rating: buildRating(item),
        
        rank: item.rank || null,
        popularity: item.popularity || null,
        members_count: item.members || null,
        favorites_count: item.favorites || null,
        
        images: buildImages(item),
        
        external_ids: {
            mal_id: id,
            source_url: item.url || `https://myanimelist.net/manga/${id}`
        },
        
        source_url: item.url || `https://myanimelist.net/manga/${id}`,
        data_source: 'jikan_manga'
    };
}

/**
 * Normalize Jikan manga search response
 * @param {object} response - Raw Jikan search response
 * @returns {object} - Normalized search response
 */
export function normalizeJikanMangaSearch(response) {
    const results = response.results || response.data || [];
    
    return {
        query: response.query || '',
        pagination: response.pagination || {
            currentPage: 1,
            hasNextPage: false,
            totalResults: results.length
        },
        results_count: results.length,
        results: results.map(normalizeJikanMangaSearchItem),
        data_source: 'jikan_manga'
    };
}

// ============================================================================
// JIKAN DETAIL NORMALIZER
// ============================================================================

/**
 * Normalize Jikan manga detail response
 * @param {object} data - Raw manga detail from Jikan
 * @returns {object} - Normalized manga object
 */
export function normalizeJikanMangaDetail(data) {
    // Handle wrapped response
    const manga = data.data || data;
    const id = manga.mal_id || manga.id;
    const releaseDate = manga.releaseDate || manga.published?.from;
    
    // Handle genres - could be array of strings or objects (prioritize translated)
    let genres = [];
    if (Array.isArray(manga.genresTranslated)) {
        genres = manga.genresTranslated;
    } else if (Array.isArray(manga.genres)) {
        genres = typeof manga.genres[0] === 'string' 
            ? manga.genres 
            : extractNames(manga.genres);
    }
    if (Array.isArray(manga.genresOriginal)) {
        genres = manga.genresOriginal;
    }
    
    return {
        type: 'manga',
        provider: 'jikan',
        provider_id: String(id),
        mal_id: id,
        
        title: manga.title || '',
        original_title: manga.originalTitle || manga.title_japanese || null,
        title_english: manga.titleEnglish || manga.title_english || null,
        alternative_titles: collectAlternativeTitles(manga),
        
        description: manga.overview || manga.synopsis || manga.description || null,
        description_original: manga.overviewOriginal || manga.synopsisOriginal || manga.synopsis || null,
        description_translated: manga.overviewTranslated || manga.synopsisTranslated || null,
        manga_type: manga.type || null,
        
        year: extractYear(releaseDate),
        end_year: extractYear(manga.published?.to),
        start_date: extractDate(releaseDate),
        end_date: extractDate(manga.published?.to),
        
        status: normalizeMangaStatus(manga.status),
        is_publishing: manga.status?.toLowerCase().includes('publishing') ?? null,
        
        total_volumes: manga.totalVolumes || manga.volumes || manga.tome || null,
        total_chapters: manga.totalChapters || manga.chapters || null,
        
        authors: parseAuthors(manga.authors),
        serializations: extractNames(manga.serializations) || manga.editors || [],
        
        genres: genres,
        themes: extractNames(manga.themes),
        demographics: extractNames(manga.demographics),
        
        rating: buildRating(manga),
        
        rank: manga.rank || null,
        popularity: manga.popularity || null,
        members_count: manga.members || null,
        favorites_count: manga.favorites || null,
        
        images: buildImages(manga),
        
        related: buildRelated(manga.relations),
        
        external_ids: {
            mal_id: id,
            source_url: manga.url || `https://myanimelist.net/manga/${id}`
        },
        
        source_url: manga.url || `https://myanimelist.net/manga/${id}`,
        data_source: 'jikan_manga'
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    // Status normalization
    normalizeMangaStatus,
    
    // Helpers
    extractDate,
    extractYear,
    extractNames,
    parseAuthors,
    collectAlternativeTitles,
    buildImages,
    buildRating,
    buildRelated,
    
    // Jikan normalizers
    normalizeJikanMangaSearchItem,
    normalizeJikanMangaSearch,
    normalizeJikanMangaDetail
};
