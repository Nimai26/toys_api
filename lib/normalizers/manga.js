/**
 * Manga Normalizer
 * Normalizes manga data from Jikan (MyAnimeList) provider to unified format
 * 
 * @module normalizers/manga
 */

// Import de la fonction de conversion JP → FR depuis anime
import { convertJpToFrRating } from './anime.js';

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
 * Build images array (TMDB-like format)
 * @param {object} data - Manga data
 * @returns {Array} - Array of image objects
 */
export function buildImages(data) {
    const images = [];
    
    // Handle image as array
    if (Array.isArray(data.image)) {
        if (data.image[0]) {
            images.push({ url: data.image[0], type: 'poster_original' });
        }
        if (data.image[2] || data.image[1]) {
            images.push({ url: data.image[2] || data.image[1], type: 'poster_small' });
        }
        return images;
    }
    
    // Handle images object from raw API
    if (data.images?.jpg) {
        const poster = data.images.jpg.large_image_url || data.images.jpg.image_url;
        if (poster) {
            images.push({ url: poster, type: 'poster_original' });
        }
        if (data.images.jpg.small_image_url) {
            images.push({ url: data.images.jpg.small_image_url, type: 'poster_small' });
        }
        return images;
    }
    
    const poster = data.poster || data.image;
    if (poster) {
        images.push({ url: poster, type: 'poster_original' });
    }
    if (data.posterSmall) {
        images.push({ url: data.posterSmall, type: 'poster_small' });
    }
    
    return images;
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
        provider: 'jikan_manga',
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
 * Normalize Jikan manga detail response (TMDB-like format)
 * @param {object} data - Raw manga detail from Jikan
 * @returns {object} - Normalized manga object
 */
export function normalizeJikanMangaDetail(data) {
    // Handle wrapped response
    const manga = data.data || data;
    const id = manga.mal_id || manga.id;
    const releaseDate = manga.releaseDate || manga.published?.from;
    
    // Handle genres - genresTranslated peut être un objet { genres: [...], genresTranslated: true }
    let genres = [];
    let genresOriginal = [];
    let hasTranslatedGenres = false;
    
    // Extraire les genres originaux
    if (Array.isArray(manga.genresOriginal)) {
        genresOriginal = manga.genresOriginal;
    } else if (Array.isArray(manga.genres)) {
        genresOriginal = typeof manga.genres[0] === 'string' ? manga.genres : extractNames(manga.genres);
    }
    
    // Extraire les genres traduits
    if (manga.genresTranslated && typeof manga.genresTranslated === 'object' && manga.genresTranslated.genres) {
        genres = manga.genresTranslated.genres;
        hasTranslatedGenres = manga.genresTranslated.genresTranslated === true;
    } else if (Array.isArray(manga.genresTranslated)) {
        genres = manga.genresTranslated;
        hasTranslatedGenres = true;
    } else {
        genres = genresOriginal;
    }
    
    // Build related as similar (TMDB-like)
    const similar = buildRelated(manga.relations)
        .filter(r => r.type === 'manga')
        .slice(0, 5)
        .map(r => ({
            id: String(r.mal_id),
            title: r.title,
            poster_url: null
        }));
    
    // Extract poster URL
    const posterUrl = manga.poster || 
        (Array.isArray(manga.image) ? manga.image[0] : manga.image) ||
        manga.images?.jpg?.large_image_url || null;
    
    return {
        // === TMDB-like fields ===
        provider_id: String(id),
        mal_id: id,
        tmdb_id: null,
        imdb_id: null,
        
        title: manga.title || '',
        original_title: manga.originalTitle || manga.title_japanese || null,
        tagline: null,
        
        description: manga.overviewTranslated || manga.synopsisTranslated || manga.overview || manga.synopsis || null,
        description_original: manga.overviewOriginal || manga.synopsisOriginal || manga.synopsis || null,
        description_translated: manga.overviewTranslated || manga.synopsisTranslated || null,
        
        year: extractYear(releaseDate),
        release_date: extractDate(releaseDate),
        runtime_minutes: null,
        
        status: normalizeMangaStatus(manga.status),
        is_adult: false,
        
        poster_url: posterUrl,
        backdrop_url: null,
        images: buildImages(manga),
        trailers: [],
        
        rating_value: manga.rating?.average || manga.score || null,
        rating_count: manga.rating?.votes || manga.scoredBy || manga.scored_by || null,
        popularity: manga.popularity || null,
        
        genres: {
            genres: genres,
            genresTranslated: hasTranslatedGenres
        },
        genres_original: genresOriginal,
        genres_translated: hasTranslatedGenres ? {
            genres: genres,
            genresTranslated: true
        } : null,
        
        keywords: extractNames(manga.themes).concat(extractNames(manga.demographics)),
        
        certifications: (() => {
            // Les manga n'ont pas de rating explicite dans MAL,
            // mais on peut déduire une classification depuis les demographics
            const certs = [];
            const demographics = extractNames(manga.demographics);
            
            // Mapping demographics → rating approximatif
            if (demographics.includes('Seinen') || demographics.includes('Josei')) {
                certs.push({ country: 'JP', rating: 'Seinen/Josei (Adultes)' });
                certs.push({ country: 'FR', rating: '16' });
            } else if (demographics.includes('Shounen') || demographics.includes('Shoujo')) {
                certs.push({ country: 'JP', rating: 'Shounen/Shoujo (Ados)' });
                certs.push({ country: 'FR', rating: '12' });
            } else if (demographics.includes('Kids')) {
                certs.push({ country: 'JP', rating: 'Kids (Enfants)' });
                certs.push({ country: 'FR', rating: 'Tous publics' });
            }
            
            return certs;
        })(),
        
        original_language: 'ja',
        languages: ['ja'],
        countries: ['JP'],
        
        studios: manga.editors || extractNames(manga.serializations) || [],
        budget: null,
        revenue: null,
        box_office: null,
        
        directors: [],
        writers: parseAuthors(manga.authors).map(a => a.name),
        
        cast: manga.cast || [],
        
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
        
        recommendations: manga.recommendations || [],
        similar: similar,
        
        source_url: manga.url || `https://myanimelist.net/manga/${id}`,
        source: 'jikan_manga',
        
        // === Manga-specific fields ===
        type: 'manga',
        provider: 'jikan_manga',
        manga_type: manga.type || null,
        
        end_year: extractYear(manga.published?.to),
        start_date: extractDate(releaseDate),
        end_date: extractDate(manga.published?.to),
        
        is_publishing: manga.status?.toLowerCase().includes('publishing') ?? null,
        total_volumes: manga.totalVolumes || manga.volumes || null,
        total_chapters: manga.totalChapters || manga.chapters || null,
        
        authors: parseAuthors(manga.authors),
        serializations: manga.editors || extractNames(manga.serializations) || [],
        
        themes: extractNames(manga.themes),
        demographics: extractNames(manga.demographics),
        
        rank: manga.rank || null,
        members_count: manga.members || null,
        favorites_count: manga.favorites || null,
        
        related: buildRelated(manga.relations),
        
        // Alternative titles
        title_english: manga.titleEnglish || manga.title_english || null,
        alternative_titles: collectAlternativeTitles(manga)
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
