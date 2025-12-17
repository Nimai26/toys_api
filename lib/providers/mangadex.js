/**
 * lib/providers/mangadex.js - Provider MangaDex
 * 
 * API MangaDex pour manga
 * Gratuit, sans clé API
 * 
 * @module providers/mangadex
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import {
  MANGADEX_BASE_URL,
  MANGADEX_COVERS_URL,
  MANGADEX_DEFAULT_MAX,
  MANGADEX_MAX_LIMIT,
  USER_AGENT
} from '../config.js';

const log = createLogger('MangaDex');

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche de manga sur MangaDex
 * @param {string} query - Terme de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchMangaDex(query, options = {}) {
  metrics.sources.mangadex.requests++;
  const max = Math.min(options.max || MANGADEX_DEFAULT_MAX, MANGADEX_MAX_LIMIT);
  const lang = options.lang || null; // Filtrer par langue disponible
  
  const cacheKey = `mangadex_search_${query}_${max}_${lang || 'all'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }

  try {
    const params = new URLSearchParams({
      title: query,
      limit: max.toString(),
      'includes[]': 'author',
      'order[relevance]': 'desc'
    });

    // Ajouter le filtre de langue si spécifié
    if (lang) {
      params.append('availableTranslatedLanguage[]', lang);
    }
    // Ajouter les includes pour cover_art et artist
    params.append('includes[]', 'artist');
    params.append('includes[]', 'cover_art');

    const url = `${MANGADEX_BASE_URL}/manga?${params.toString()}`;
    log.debug(`Recherche: ${query} (max: ${max}, lang: ${lang || 'all'})`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`MangaDex API error: ${response.status}`);
    }

    const data = await response.json();
    
    const results = (data.data || []).map(item => {
      const attrs = item.attributes;
      
      // Extraire les relations
      const authors = item.relationships?.filter(r => r.type === 'author') || [];
      const coverArt = item.relationships?.find(r => r.type === 'cover_art');
      
      // Construire l'URL de la couverture
      let coverUrl = null;
      if (coverArt?.attributes?.fileName) {
        coverUrl = `${MANGADEX_COVERS_URL}/${item.id}/${coverArt.attributes.fileName}`;
      }

      // Extraire le titre dans la langue préférée
      const titleObj = attrs.title || {};
      const title = titleObj.en || titleObj.ja || titleObj['ja-ro'] || Object.values(titleObj)[0] || 'Unknown';

      // Extraire la description dans la langue préférée
      const descObj = attrs.description || {};
      const description = descObj.fr || descObj.en || Object.values(descObj)[0] || null;

      // Extraire les tags
      const tags = (attrs.tags || []).map(tag => ({
        id: tag.id,
        name: tag.attributes?.name?.en || Object.values(tag.attributes?.name || {})[0] || 'Unknown',
        group: tag.attributes?.group
      }));

      // Extraire les noms de genre à partir des tags
      const genreNames = tags.filter(t => t.group === 'genre').map(t => t.name);

      return {
        id: item.id,
        type: 'manga',
        title: title,
        originalTitle: titleObj.ja || titleObj['ja-ro'] || null,
        authors: authors.map(a => a.attributes?.name || 'Unknown'),
        editors: [],
        releaseDate: attrs.year ? `${attrs.year}` : null,
        genres: genreNames,
        pages: null,
        serie: null,
        synopsis: description,
        language: attrs.originalLanguage || 'ja',
        tome: attrs.lastVolume || null,
        image: coverUrl ? [coverUrl, `${coverUrl}.512.jpg`, `${coverUrl}.256.jpg`].filter(Boolean) : [],
        isbn: null,
        price: null,
        status: attrs.status,
        contentRating: attrs.contentRating,
        url: `https://mangadex.org/title/${item.id}`,
        source: 'mangadex'
      };
    });

    const result = {
      query,
      language: lang || 'all',
      totalResults: data.total,
      resultsCount: results.length,
      results,
      source: 'mangadex'
    };

    log.debug(`✅ ${results.length} résultats trouvés`);
    setCache(cacheKey, result);
    return result;

  } catch (err) {
    metrics.sources.mangadex.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS
// ============================================================================

/**
 * Récupère les détails d'un manga MangaDex par ID
 * @param {string} mangaId - ID UUID du manga
 * @returns {Promise<object>} - Détails du manga
 */
export async function getMangaDexById(mangaId) {
  metrics.sources.mangadex.requests++;
  
  const cacheKey = `mangadex_manga_${mangaId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }

  try {
    const params = new URLSearchParams();
    params.append('includes[]', 'author');
    params.append('includes[]', 'artist');
    params.append('includes[]', 'cover_art');

    const url = `${MANGADEX_BASE_URL}/manga/${mangaId}?${params.toString()}`;
    log.debug(`Récupération manga ID: ${mangaId}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`MangaDex API error: ${response.status}`);
    }

    const data = await response.json();
    const item = data.data;
    
    if (!item) {
      return null;
    }

    const attrs = item.attributes;
    
    // Extraire les relations
    const authors = item.relationships?.filter(r => r.type === 'author') || [];
    const coverArt = item.relationships?.find(r => r.type === 'cover_art');
    
    // Construire l'URL de la couverture
    let coverUrl = null;
    if (coverArt?.attributes?.fileName) {
      coverUrl = `${MANGADEX_COVERS_URL}/${item.id}/${coverArt.attributes.fileName}`;
    }

    // Extraire le titre
    const titleObj = attrs.title || {};
    const title = titleObj.en || titleObj.ja || titleObj['ja-ro'] || Object.values(titleObj)[0] || 'Unknown';

    // Extraire toutes les descriptions
    const descriptions = attrs.description || {};

    // Extraire les tags
    const tags = (attrs.tags || []).map(tag => ({
      id: tag.id,
      name: tag.attributes?.name?.en || Object.values(tag.attributes?.name || {})[0] || 'Unknown',
      group: tag.attributes?.group
    }));

    // Extraire les noms de genre à partir des tags
    const genreNames = tags.filter(t => t.group === 'genre').map(t => t.name);
    
    // Extraire les noms des auteurs
    const authorNames = authors.map(a => a.attributes?.name || 'Unknown');

    const result = {
      id: item.id,
      type: 'manga',
      title: title,
      originalTitle: titleObj.ja || titleObj['ja-ro'] || null,
      authors: authorNames,
      editors: [],
      releaseDate: attrs.year ? `${attrs.year}` : null,
      genres: genreNames,
      pages: null,
      serie: null,
      synopsis: descriptions.en || descriptions.fr || Object.values(descriptions)[0] || null,
      language: attrs.originalLanguage || 'ja',
      tome: attrs.lastVolume || null,
      // Champs harmonisés
      totalVolumes: attrs.lastVolume ? parseInt(attrs.lastVolume) || null : null,
      totalChapters: attrs.lastChapter ? parseInt(attrs.lastChapter) || null : null,
      image: coverUrl,
      isbn: null,
      price: null,
      status: attrs.status,
      contentRating: attrs.contentRating,
      url: `https://mangadex.org/title/${item.id}`,
      source: 'mangadex'
    };

    log.debug(`✅ Manga récupéré: ${result.title}`);
    setCache(cacheKey, result);
    return result;

  } catch (err) {
    metrics.sources.mangadex.errors++;
    throw err;
  }
}
