/**
 * lib/database/repository.js - Repository Pattern pour PostgreSQL
 * 
 * CRUD générique pour les items avec cache intelligent
 * toys_api v4.0.0
 */

import { query, queryOne, queryAll, isCacheEnabled, CACHE_MODE } from './connection.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Repository');

// TTL par provider (en secondes)
export const CACHE_TTL = {
  // Données très stables (90 jours)
  lego: 90 * 24 * 60 * 60,
  bedetheque: 90 * 24 * 60 * 60,
  playmobil: 90 * 24 * 60 * 60,
  mega: 90 * 24 * 60 * 60,
  klickypedia: 90 * 24 * 60 * 60,
  
  // Données stables (30 jours)
  googlebooks: 30 * 24 * 60 * 60,
  openlibrary: 30 * 24 * 60 * 60,
  comicvine: 30 * 24 * 60 * 60,
  mangadex: 30 * 24 * 60 * 60,
  coleka: 30 * 24 * 60 * 60,
  luluberlu: 30 * 24 * 60 * 60,
  transformerland: 30 * 24 * 60 * 60,
  paninimania: 30 * 24 * 60 * 60,
  consolevariations: 30 * 24 * 60 * 60,
  
  // Données avec mises à jour (7 jours)
  tmdb: 7 * 24 * 60 * 60,
  tvdb: 7 * 24 * 60 * 60,
  rawg: 7 * 24 * 60 * 60,
  igdb: 7 * 24 * 60 * 60,
  jikan: 7 * 24 * 60 * 60,
  jeuxvideo: 7 * 24 * 60 * 60,
  music: 7 * 24 * 60 * 60,
  
  // Données live (1 jour)
  imdb: 1 * 24 * 60 * 60,
  
  // Défaut
  default: 30 * 24 * 60 * 60
};

/**
 * Génère l'ID composite pour un item
 */
export function generateItemId(source, sourceId) {
  return `${source}:${sourceId}`;
}

/**
 * Extrait les champs dénormalisés depuis les données harmonisées
 */
function extractDenormalizedFields(data, type) {
  const fields = {
    year: null,
    authors: null,
    publisher: null,
    genres: null,
    language: null,
    tome: null,
    series_name: null,
    series_id: null,
    piece_count: null,
    figure_count: null,
    theme: null,
    runtime: null,
    pages: null,
    isbn: null,
    ean: null,
    imdb_id: null,
    image_url: null,
    thumbnail_url: null,
    source_url: null
  };

  // Champs communs
  fields.year = data.year || data.releaseYear || (data.releaseDate ? parseInt(data.releaseDate.substring(0, 4), 10) : null);
  fields.genres = data.genres?.length > 0 ? data.genres : null;
  fields.language = data.language || null;

  // Type: book
  if (type === 'book') {
    fields.authors = data.authors?.length > 0 ? data.authors : null;
    fields.publisher = data.publisher || null;
    fields.tome = data.tome ?? data.series?.position ?? null;
    fields.series_name = data.series?.name || null;
    fields.series_id = data.series?.id ? String(data.series.id) : null;
    fields.pages = data.physical?.pages || data.pages || null;
    fields.isbn = data.identifiers?.isbn13 || data.identifiers?.isbn10 || data.identifiers?.isbn || data.isbn || null;
    fields.image_url = Array.isArray(data.images) ? data.images[0] : data.image || null;
  }

  // Type: construct_toy (LEGO, Playmobil, Mega)
  if (type === 'construct_toy') {
    fields.theme = data.theme || null;
    fields.piece_count = data.specs?.pieceCount || data.pieceCount || null;
    fields.figure_count = data.specs?.figureCount || data.figureCount || data.minifiguresCount || null;
    fields.ean = data.ean || null;
    fields.image_url = data.images?.cover || data.image || (Array.isArray(data.images?.gallery) ? data.images.gallery[0] : null);
    fields.thumbnail_url = data.images?.thumbnail || null;
    fields.source_url = data.urls?.official || data.urls?.source || null;
  }

  // Type: movie, tv
  if (type === 'movie' || type === 'tv') {
    fields.runtime = data.production?.runtime || data.runtime || null;
    fields.imdb_id = data.externalIds?.imdb || data.imdbId || null;
    fields.image_url = data.images?.cover || data.poster || null;
  }

  // Type: game
  if (type === 'game') {
    fields.image_url = data.images?.cover || data.image || null;
  }

  // Fallback image
  if (!fields.image_url) {
    fields.image_url = data.image || data.thumbnail || null;
  }

  return fields;
}

// ============================================================================
// OPÉRATIONS CRUD
// ============================================================================

/**
 * Récupère un item depuis la base de données
 * @param {string} source - Source (lego, tmdb, etc.)
 * @param {string} sourceId - ID original
 * @returns {Promise<object|null>}
 */
export async function getItem(source, sourceId) {
  if (!isCacheEnabled()) return null;

  try {
    const id = generateItemId(source, sourceId);
    const item = await queryOne(
      `SELECT * FROM items 
       WHERE id = $1 
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [id]
    );

    if (item) {
      // Mettre à jour les stats d'accès (async, non-bloquant)
      query(
        `UPDATE items SET fetch_count = fetch_count + 1, last_accessed = NOW() WHERE id = $1`,
        [id]
      ).catch(() => {});

      // Incrémenter le compteur de cache hits
      incrementStats(source, 'cache_hits');

      log.debug(`Cache HIT: ${id}`);
      return item.data;
    }

    log.debug(`Cache MISS: ${id}`);
    return null;
  } catch (err) {
    log.error(`Erreur getItem: ${err.message}`);
    return null;
  }
}

/**
 * Sauvegarde un item dans la base de données
 * @param {string} source - Source (lego, tmdb, etc.)
 * @param {string} sourceId - ID original
 * @param {string} type - Type (book, movie, construct_toy, etc.)
 * @param {string} name - Nom de l'item
 * @param {object} data - Données complètes harmonisées
 * @param {object} options - Options supplémentaires
 * @returns {Promise<boolean>}
 */
export async function saveItem(source, sourceId, type, name, data, options = {}) {
  if (!isCacheEnabled()) return false;

  try {
    const id = generateItemId(source, sourceId);
    const ttl = options.ttl || CACHE_TTL[source] || CACHE_TTL.default;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    
    const subtype = data.subtype || options.subtype || null;
    const nameOriginal = data.name_original || data.originalName || null;
    
    // Extraire les champs dénormalisés
    const fields = extractDenormalizedFields(data, type);

    await query(
      `INSERT INTO items (
        id, source, source_id, type, subtype,
        name, name_original,
        year, authors, publisher, genres, language,
        tome, series_name, series_id,
        piece_count, figure_count, theme,
        runtime, pages, isbn, ean, imdb_id,
        image_url, thumbnail_url, source_url, detail_url,
        data, expires_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21, $22, $23,
        $24, $25, $26, $27,
        $28, $29
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        name_original = EXCLUDED.name_original,
        year = EXCLUDED.year,
        authors = EXCLUDED.authors,
        publisher = EXCLUDED.publisher,
        genres = EXCLUDED.genres,
        language = EXCLUDED.language,
        tome = EXCLUDED.tome,
        series_name = EXCLUDED.series_name,
        series_id = EXCLUDED.series_id,
        piece_count = EXCLUDED.piece_count,
        figure_count = EXCLUDED.figure_count,
        theme = EXCLUDED.theme,
        runtime = EXCLUDED.runtime,
        pages = EXCLUDED.pages,
        isbn = EXCLUDED.isbn,
        ean = EXCLUDED.ean,
        imdb_id = EXCLUDED.imdb_id,
        image_url = EXCLUDED.image_url,
        thumbnail_url = EXCLUDED.thumbnail_url,
        source_url = EXCLUDED.source_url,
        data = EXCLUDED.data,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()`,
      [
        id, source, sourceId, type, subtype,
        name, nameOriginal,
        fields.year, fields.authors, fields.publisher, fields.genres, fields.language,
        fields.tome, fields.series_name, fields.series_id,
        fields.piece_count, fields.figure_count, fields.theme,
        fields.runtime, fields.pages, fields.isbn, fields.ean, fields.imdb_id,
        fields.image_url, fields.thumbnail_url, fields.source_url, data.detailUrl || null,
        JSON.stringify(data), expiresAt
      ]
    );

    // Incrémenter le compteur de nouveaux items
    incrementStats(source, 'new_items');
    
    log.debug(`Saved: ${id} (TTL: ${Math.round(ttl / 86400)}j)`);
    return true;
  } catch (err) {
    log.error(`Erreur saveItem: ${err.message}`);
    return false;
  }
}

/**
 * Wrapper pour récupérer un item avec fallback API
 * @param {string} source - Source
 * @param {string} sourceId - ID
 * @param {string} type - Type
 * @param {Function} fetchFn - Fonction pour récupérer depuis l'API
 * @returns {Promise<{data: object, fromCache: boolean}>}
 */
export async function getItemWithCache(source, sourceId, type, fetchFn) {
  // Mode API only - pas de cache
  if (CACHE_MODE === 'api_only') {
    const data = await fetchFn();
    return { data, fromCache: false };
  }

  // Essayer le cache d'abord
  const cached = await getItem(source, sourceId);
  if (cached) {
    return { data: cached, fromCache: true };
  }

  // Mode DB only - pas d'appel API
  if (CACHE_MODE === 'db_only') {
    return { data: null, fromCache: false };
  }

  // Appeler l'API
  const start = Date.now();
  const data = await fetchFn();
  const apiTime = Date.now() - start;

  if (data) {
    // Sauvegarder en cache (async, non-bloquant)
    const name = data.name || data.title || 'Unknown';
    saveItem(source, sourceId, type, name, data).catch(() => {});
    
    // Enregistrer le temps API
    incrementStats(source, 'api_calls');
    updateApiTime(source, apiTime);
  } else {
    incrementStats(source, 'cache_misses');
  }

  return { data, fromCache: false };
}

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche locale dans la base de données
 * @param {string} searchQuery - Terme de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<object[]>}
 */
export async function searchLocal(searchQuery, options = {}) {
  if (!isCacheEnabled()) return [];

  const {
    source = null,
    type = null,
    limit = 20,
    offset = 0
  } = options;

  try {
    let sql = `
      SELECT id, source, type, subtype, name, name_original, year, 
             image_url, thumbnail_url, source_url, detail_url,
             genres, authors, theme, tome, series_name
      FROM items
      WHERE name_search LIKE '%' || normalize_text($1) || '%'
    `;
    const params = [searchQuery];
    let paramIndex = 2;

    if (source) {
      sql += ` AND source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    if (type) {
      sql += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    sql += ` ORDER BY 
      CASE WHEN name_search = normalize_text($1) THEN 0 ELSE 1 END,
      fetch_count DESC,
      year DESC NULLS LAST
    `;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const results = await queryAll(sql, params);
    return results;
  } catch (err) {
    log.error(`Erreur searchLocal: ${err.message}`);
    return [];
  }
}

/**
 * Sauvegarde les résultats d'une recherche
 */
export async function saveSearchResults(searchQuery, provider, searchType, resultIds, totalResults) {
  if (!isCacheEnabled()) return;

  try {
    const ttl = CACHE_TTL[provider] || CACHE_TTL.default;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    await query(
      `INSERT INTO searches (query, provider, search_type, result_ids, result_count, total_results, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (query, provider, search_type) DO UPDATE SET
         result_ids = EXCLUDED.result_ids,
         result_count = EXCLUDED.result_count,
         total_results = EXCLUDED.total_results,
         expires_at = EXCLUDED.expires_at`,
      [searchQuery, provider, searchType, resultIds, resultIds.length, totalResults, expiresAt]
    );

    incrementStats(provider, 'searches');
  } catch (err) {
    log.error(`Erreur saveSearchResults: ${err.message}`);
  }
}

/**
 * Récupère les résultats d'une recherche depuis le cache
 */
export async function getCachedSearch(searchQuery, provider, searchType) {
  if (!isCacheEnabled()) return null;

  try {
    const result = await queryOne(
      `SELECT result_ids, total_results FROM searches
       WHERE query = $1 AND provider = $2 AND search_type = $3
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [searchQuery, provider, searchType]
    );

    return result;
  } catch (err) {
    log.error(`Erreur getCachedSearch: ${err.message}`);
    return null;
  }
}

// ============================================================================
// STATISTIQUES
// ============================================================================

/**
 * Incrémente un compteur de statistiques
 */
async function incrementStats(source, field) {
  if (!isCacheEnabled()) return;

  try {
    await query(
      `INSERT INTO stats (date, source, ${field})
       VALUES (CURRENT_DATE, $1, 1)
       ON CONFLICT (date, source) DO UPDATE SET
         ${field} = stats.${field} + 1`,
      [source]
    );
  } catch (err) {
    // Ignorer les erreurs de stats
  }
}

/**
 * Met à jour le temps moyen des appels API
 */
async function updateApiTime(source, timeMs) {
  if (!isCacheEnabled()) return;

  try {
    await query(
      `INSERT INTO stats (date, source, api_calls, avg_api_time_ms)
       VALUES (CURRENT_DATE, $1, 1, $2)
       ON CONFLICT (date, source) DO UPDATE SET
         avg_api_time_ms = COALESCE(
           (stats.avg_api_time_ms * stats.api_calls + $2) / (stats.api_calls + 1),
           $2
         )`,
      [source, timeMs]
    );
  } catch (err) {
    // Ignorer les erreurs de stats
  }
}

/**
 * Récupère les statistiques globales
 */
export async function getStats() {
  if (!isCacheEnabled()) {
    return { enabled: false };
  }

  try {
    const itemsCount = await queryOne('SELECT COUNT(*) as count FROM items');
    const bySource = await queryAll('SELECT * FROM items_by_source');
    const todayStats = await queryAll(
      'SELECT * FROM stats WHERE date = CURRENT_DATE ORDER BY source'
    );

    return {
      enabled: true,
      totalItems: parseInt(itemsCount.count, 10),
      bySource,
      today: todayStats
    };
  } catch (err) {
    log.error(`Erreur getStats: ${err.message}`);
    return { enabled: true, error: err.message };
  }
}

/**
 * Récupère les items populaires
 */
export async function getPopularItems(limit = 20) {
  if (!isCacheEnabled()) return [];

  try {
    return await queryAll(
      'SELECT * FROM popular_items LIMIT $1',
      [limit]
    );
  } catch (err) {
    log.error(`Erreur getPopularItems: ${err.message}`);
    return [];
  }
}

/**
 * Récupère les items à rafraîchir
 */
export async function getItemsToRefresh(limit = 50) {
  if (!isCacheEnabled()) return [];

  try {
    return await queryAll(
      'SELECT * FROM items_to_refresh LIMIT $1',
      [limit]
    );
  } catch (err) {
    log.error(`Erreur getItemsToRefresh: ${err.message}`);
    return [];
  }
}

export default {
  generateItemId,
  getItem,
  saveItem,
  getItemWithCache,
  searchLocal,
  saveSearchResults,
  getCachedSearch,
  getStats,
  getPopularItems,
  getItemsToRefresh,
  CACHE_TTL
};
