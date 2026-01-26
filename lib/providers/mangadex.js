/**
 * lib/providers/mangadex.js - Provider MangaDex
 * 
 * API MangaDex pour manga
 * Gratuit, sans clé API
 * 
 * @module providers/mangadex
 */

import { metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { fetchViaProxy } from '../utils/fetch-proxy.js';
import { translateText, translateGenres, extractLangCode } from '../utils/translator.js';
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
 * Recherche de manga par auteur sur MangaDex
 * Nécessite 2 requêtes: 1) Rechercher l'auteur par nom, 2) Rechercher les mangas de l'auteur
 * @param {string} author - Nom de l'auteur
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchMangaDexByAuthor(author, options = {}) {
  metrics.sources.mangadex.requests++;
  const max = Math.min(options.max || MANGADEX_DEFAULT_MAX, MANGADEX_MAX_LIMIT);
  const lang = options.lang || null;
  
  try {
    log.debug(`Recherche auteur: ${author}`);
    
    // Étape 1: Rechercher l'auteur par nom
    const authorParams = new URLSearchParams({
      name: author,
      limit: '10'
    });
    
    const authorUrl = `${MANGADEX_BASE_URL}/author?${authorParams.toString()}`;
    
    const authorResponse = await fetchViaProxy(authorUrl, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });
    
    if (!authorResponse.ok) {
      throw new Error(`MangaDex API error: ${authorResponse.status}`);
    }
    
    const authorData = await authorResponse.json();
    
    if (!authorData.data || authorData.data.length === 0) {
      log.debug(`Aucun auteur trouvé pour: ${author}`);
      return {
        query: author,
        type: 'author',
        totalResults: 0,
        resultsCount: 0,
        manga: [],
        source: 'mangadex'
      };
    }
    
    // Prendre le premier auteur (meilleure correspondance)
    const authorInfo = authorData.data[0];
    const authorId = authorInfo.id;
    const authorName = authorInfo.attributes?.name || author;
    
    log.debug(`Auteur trouvé: ${authorName} (ID: ${authorId})`);
    
    // Étape 2: Rechercher les mangas de cet auteur
    const mangaParams = new URLSearchParams({
      limit: max.toString(),
      'authors[]': authorId,
      'order[relevance]': 'desc'
    });
    
    mangaParams.append('includes[]', 'author');
    mangaParams.append('includes[]', 'artist');
    mangaParams.append('includes[]', 'cover_art');
    
    const mangaUrl = `${MANGADEX_BASE_URL}/manga?${mangaParams.toString()}`;
    log.debug(`Recherche mangas de ${authorName}`);
    
    const mangaResponse = await fetchViaProxy(mangaUrl, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });
    
    if (!mangaResponse.ok) {
      throw new Error(`MangaDex API error: ${mangaResponse.status}`);
    }
    
    const mangaData = await mangaResponse.json();
    
    const results = (mangaData.data || []).map(item => {
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
      query: author,
      type: 'author',
      author: authorName,
      language: lang || 'all',
      totalResults: mangaData.total || 0,
      total: mangaData.total || 0,
      resultsCount: results.length,
      manga: results,
      source: 'mangadex'
    };

    log.debug(`✅ ${results.length} mangas trouvés pour ${authorName}`);
    return result;

  } catch (err) {
    metrics.sources.mangadex.errors++;
    throw err;
  }
}

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

  try {
    const params = new URLSearchParams({
      title: query,
      limit: max.toString(),
      'includes[]': 'author',
      'order[relevance]': 'desc'
    });

    // Ajouter le filtre de langue si spécifié
    // if (lang) {
    //   params.append('availableTranslatedLanguage[]', lang);
    // }
    // Ajouter les includes pour cover_art et artist
    params.append('includes[]', 'artist');
    params.append('includes[]', 'cover_art');

    const url = `${MANGADEX_BASE_URL}/manga?${params.toString()}`;
    log.debug(`Recherche: ${query} (max: ${max}, lang: ${lang || 'all'})`);

    const response = await fetchViaProxy(url, {
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
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails du manga
 */
export async function getMangaDexById(mangaId, options = {}) {
  metrics.sources.mangadex.requests++;
  
  const { lang = null, autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `mangadex_manga_${mangaId}_${shouldTranslate ? 'trad_' + destLang : 'notrad'}`;

  try {
    const params = new URLSearchParams();
    params.append('includes[]', 'author');
    params.append('includes[]', 'artist');
    params.append('includes[]', 'cover_art');

    const url = `${MANGADEX_BASE_URL}/manga/${mangaId}?${params.toString()}`;
    log.debug(`Récupération manga ID: ${mangaId}`);

    const response = await fetchViaProxy(url, {
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
    
    // Synopsis original
    const synopsisOriginal = descriptions.en || descriptions.fr || Object.values(descriptions)[0] || null;
    
    // Applique la traduction si demandée
    let finalSynopsis = synopsisOriginal;
    let synopsisTranslated = null;
    let genresTranslated = null;
    
    if (shouldTranslate && destLang) {
      // Traduit le synopsis
      if (synopsisOriginal) {
        const result = await translateText(synopsisOriginal, destLang, { enabled: true });
        if (result.translated) {
          finalSynopsis = result.text;
          synopsisTranslated = result.text;
        }
      }
      
      // Traduit les genres
      if (genreNames.length > 0) {
        genresTranslated = await translateGenres(genreNames, destLang, 'media');
      }
    }

    const result = {
      id: item.id,
      type: 'manga',
      title: title,
      originalTitle: titleObj.ja || titleObj['ja-ro'] || null,
      authors: authorNames,
      editors: [],
      releaseDate: attrs.year ? `${attrs.year}` : null,
      genres: genresTranslated || genreNames,
      genresOriginal: genreNames,
      genresTranslated: genresTranslated,
      pages: null,
      serie: null,
      synopsis: finalSynopsis,
      synopsisOriginal: synopsisOriginal,
      synopsisTranslated: synopsisTranslated,
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
    return result;

  } catch (err) {
    metrics.sources.mangadex.errors++;
    throw err;
  }
}

// ============================================================================
// AGGREGATE - VOLUMES & CHAPITRES
// ============================================================================

/**
 * Récupère l'agrégation volumes/chapitres d'un manga MangaDex
 * @param {string} mangaId - ID UUID du manga
 * @param {object} options - Options
 * @returns {Promise<object>} - Structure volumes/issues harmonisée
 */
export async function getMangaDexAggregate(mangaId, options = {}) {
  metrics.sources.mangadex.requests++;
  
  const cacheKey = `mangadex_aggregate_${mangaId}`;

  try {
    const url = `${MANGADEX_BASE_URL}/manga/${mangaId}/aggregate`;
    log.debug(`Récupération aggregate manga ID: ${mangaId}`);

    const response = await fetchViaProxy(url, {
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
    
    if (!data.volumes) {
      return {
        mangaId,
        volumes: [],
        totalVolumes: 0,
        totalIssues: 0
      };
    }

    // Transformer la structure en format harmonisé
    const volumes = Object.entries(data.volumes).map(([volumeNumber, volumeData]) => {
      const issues = Object.entries(volumeData.chapters || {}).map(([chapterNumber, chapterData]) => ({
        id: chapterData.id,
        number: chapterNumber,
        title: chapterData.title || null,
        isUnavailable: chapterData.isUnavailable || false
      }));

      return {
        volume: volumeNumber,
        count: volumeData.count || issues.length,
        issues: issues.sort((a, b) => {
          const aNum = parseFloat(a.number) || 0;
          const bNum = parseFloat(b.number) || 0;
          return aNum - bNum;
        })
      };
    }).sort((a, b) => {
      const aNum = parseFloat(a.volume) || 0;
      const bNum = parseFloat(b.volume) || 0;
      return aNum - bNum;
    });

    const totalIssues = volumes.reduce((sum, vol) => sum + vol.count, 0);

    const result = {
      mangaId,
      volumes,
      totalVolumes: volumes.length,
      totalIssues,
      source: 'mangadex'
    };

    log.debug(`✅ Aggregate récupéré: ${volumes.length} volumes, ${totalIssues} chapitres`);
    return result;

  } catch (err) {
    metrics.sources.mangadex.errors++;
    throw err;
  }
}

// ============================================================================
// FONCTIONS NORMALISÉES
// ============================================================================

/**
 * Récupère les détails d'un manga au format normalisé
 * @param {string} mangaId - ID du manga
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Manga au format MANGA_SCHEMA normalisé
 */
export async function getMangaDexByIdNormalized(mangaId, options = {}) {
  const raw = await getMangaDexById(mangaId, options);
  if (!raw) return null;
  
  return {
    type: 'manga',
    source: 'mangadex',
    sourceId: raw.id,
    
    // Noms
    name: raw.title,
    name_original: raw.originalTitle,
    description: raw.synopsis,
    description_original: raw.synopsisOriginal,
    slug: raw.id,
    
    // Identifiants externes
    externalIds: {
      mal: null,
      anilist: null,
      mangadex: raw.id
    },
    
    // Titres
    titles: {
      romaji: raw.originalTitle,
      english: raw.title,
      japanese: raw.originalTitle,
      synonyms: []
    },
    
    // Format
    format: {
      type: 'manga',
      status: raw.status,
      chapters: raw.totalChapters,
      volumes: raw.totalVolumes
    },
    
    // Publication
    publication: {
      startDate: raw.releaseDate,
      endDate: null,
      magazine: null,
      publisher: null
    },
    
    // Auteurs
    authors: raw.authors || [],
    artists: [],
    
    // Classification
    genres: raw.genres || [],
    themes: [],
    demographics: [],
    
    // Évaluations
    ratings: {
      score: null,
      scoredBy: null,
      rank: null,
      popularity: null
    },
    
    // Images
    images: {
      thumbnail: raw.image,
      cover: raw.image,
      gallery: []
    },
    
    // URLs
    urls: {
      official: null,
      source: raw.url
    },
    
    // Métadonnées
    meta: {
      createdAt: null,
      updatedAt: null,
      lang: raw.language
    },
    
    // Champs additionnels
    contentRating: raw.contentRating
  };
}
