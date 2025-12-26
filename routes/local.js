// routes/local.js - Endpoints pour la base de données locale (toys_api v4.0.0)
import { Router } from 'express';
import { asyncHandler, addCacheHeaders } from '../lib/utils/index.js';
import { 
  DB_ENABLED, 
  CACHE_MODE, 
  isDatabaseConnected,
  getStats,
  getPopularItems,
  getItemsToRefresh,
  searchLocal,
  query
} from '../lib/database/index.js';

const localRouter = Router();

/**
 * GET /local/status
 * Statut de la base de données locale
 */
localRouter.get('/status', asyncHandler(async (req, res) => {
  const connected = isDatabaseConnected();
  
  let dbInfo = null;
  if (connected) {
    try {
      const result = await query('SELECT version() as version, current_database() as database, NOW() as server_time');
      dbInfo = result.rows[0];
    } catch (err) {
      dbInfo = { error: err.message };
    }
  }
  
  res.json({
    enabled: DB_ENABLED,
    mode: CACHE_MODE,
    connected,
    database: dbInfo
  });
}));

/**
 * GET /local/stats
 * Statistiques globales du cache
 */
localRouter.get('/stats', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const stats = await getStats();
  addCacheHeaders(res, 60);
  res.json(stats);
}));

/**
 * GET /local/stats/sources
 * Statistiques par source (provider)
 */
localRouter.get('/stats/sources', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const result = await query(`
    SELECT 
      source,
      COUNT(*) as total_items,
      COUNT(DISTINCT type) as types,
      MIN(created_at) as first_item,
      MAX(updated_at) as last_update,
      SUM(hit_count) as total_hits,
      AVG(hit_count) as avg_hits
    FROM items
    GROUP BY source
    ORDER BY total_items DESC
  `);
  
  addCacheHeaders(res, 60);
  res.json({
    sources: result.rows,
    total_sources: result.rows.length
  });
}));

/**
 * GET /local/stats/types
 * Statistiques par type de données
 */
localRouter.get('/stats/types', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const result = await query(`
    SELECT 
      type,
      COUNT(*) as total_items,
      COUNT(DISTINCT source) as sources,
      MIN(year) as min_year,
      MAX(year) as max_year,
      SUM(hit_count) as total_hits
    FROM items
    GROUP BY type
    ORDER BY total_items DESC
  `);
  
  addCacheHeaders(res, 60);
  res.json({
    types: result.rows,
    total_types: result.rows.length
  });
}));

/**
 * GET /local/popular
 * Items les plus consultés
 */
localRouter.get('/popular', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
  const source = req.query.source || null;
  const type = req.query.type || null;
  
  const items = await getPopularItems({ limit, source, type });
  
  addCacheHeaders(res, 120);
  res.json({
    items,
    total: items.length,
    filters: { source, type, limit }
  });
}));

/**
 * GET /local/search
 * Recherche dans la base locale
 */
localRouter.get('/search', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const q = req.query.q || req.query.query || '';
  const source = req.query.source || null;
  const type = req.query.type || null;
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  
  if (!q && !source && !type) {
    return res.status(400).json({ 
      error: 'Au moins un critère de recherche requis',
      hint: 'Utilisez q, source, ou type'
    });
  }
  
  // searchLocal attend (query, options)
  const results = await searchLocal(q, { source, type, limit, offset });
  
  addCacheHeaders(res, 60);
  res.json({
    results,
    total: results.length,
    query: q,
    filters: { source, type },
    pagination: { limit, offset }
  });
}));

/**
 * GET /local/item/:source/:id
 * Récupère un item spécifique par source et ID
 */
localRouter.get('/item/:source/:id', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const { source, id } = req.params;
  
  const result = await query(
    'SELECT * FROM items WHERE source = $1 AND external_id = $2',
    [source, id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Item non trouvé', source, id });
  }
  
  // Incrémenter le hit_count
  await query(
    'UPDATE items SET hit_count = hit_count + 1, last_accessed = NOW() WHERE source = $1 AND external_id = $2',
    [source, id]
  );
  
  const item = result.rows[0];
  addCacheHeaders(res, 300);
  res.json({
    ...item.data,
    _cache: {
      source: item.source,
      external_id: item.external_id,
      type: item.type,
      created_at: item.created_at,
      updated_at: item.updated_at,
      hit_count: item.hit_count + 1,
      last_accessed: new Date()
    }
  });
}));

/**
 * GET /local/refresh
 * Liste des items à rafraîchir (TTL expiré)
 */
localRouter.get('/refresh', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 200);
  
  const items = await getItemsToRefresh(limit);
  
  res.json({
    items,
    total: items.length,
    hint: 'Ces items ont dépassé leur TTL et devraient être rafraîchis'
  });
}));

/**
 * GET /local/recent
 * Items récemment ajoutés ou mis à jour
 */
localRouter.get('/recent', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
  const hours = Math.min(Math.max(1, parseInt(req.query.hours, 10) || 24), 168); // Max 7 jours
  
  const result = await query(`
    SELECT 
      source,
      external_id,
      type,
      name,
      year,
      created_at,
      updated_at
    FROM items
    WHERE updated_at > NOW() - INTERVAL '${hours} hours'
    ORDER BY updated_at DESC
    LIMIT $1
  `, [limit]);
  
  addCacheHeaders(res, 60);
  res.json({
    items: result.rows,
    total: result.rows.length,
    period: `${hours}h`
  });
}));

/**
 * GET /local/export
 * Export complet de la base de données en JSON
 * 
 * @query {string} source - Filtrer par source (optionnel)
 * @query {string} type - Filtrer par type (optionnel)
 * @query {string} format - Format: 'json' (défaut) ou 'ndjson' (streaming)
 */
localRouter.get('/export', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const source = req.query.source || null;
  const type = req.query.type || null;
  const format = req.query.format || 'json';
  
  // Construire la requête avec filtres optionnels
  let sql = 'SELECT source, source_id, type, subtype, name, name_original, year, authors, publisher, genres, language, tome, series_name, series_id, piece_count, figure_count, theme, runtime, pages, isbn, ean, imdb_id, data, image_url, thumbnail_url, source_url, detail_url, created_at, updated_at, expires_at, fetch_count, last_accessed FROM items';
  const params = [];
  const conditions = [];
  
  if (source) {
    params.push(source);
    conditions.push(`source = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`type = $${params.length}`);
  }
  
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY source, source_id';
  
  const result = await query(sql, params);
  
  // Métadonnées de l'export
  const exportMeta = {
    version: '4.0.0',
    exported_at: new Date().toISOString(),
    total_items: result.rows.length,
    filters: { source, type }
  };
  
  if (format === 'ndjson') {
    // Streaming NDJSON pour gros exports
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Content-Disposition', `attachment; filename="toys_api_export_${Date.now()}.ndjson"`);
    
    // Écrire les métadonnées en premier
    res.write(JSON.stringify({ _meta: exportMeta }) + '\n');
    
    // Streamer chaque item
    for (const row of result.rows) {
      res.write(JSON.stringify(row) + '\n');
    }
    res.end();
  } else {
    // JSON standard
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="toys_api_export_${Date.now()}.json"`);
    
    res.json({
      _meta: exportMeta,
      items: result.rows
    });
  }
}));

/**
 * POST /local/import
 * Import de données depuis un export JSON
 * 
 * @body {object} _meta - Métadonnées (optionnel, pour validation)
 * @body {array} items - Tableau d'items à importer
 * @query {string} mode - 'upsert' (défaut), 'skip' (ignorer existants), 'replace' (écraser tout)
 */
localRouter.post('/import', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const { items, _meta } = req.body;
  const mode = req.query.mode || 'upsert';
  
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ 
      error: 'Format invalide',
      hint: 'Le body doit contenir un tableau "items"'
    });
  }
  
  if (!['upsert', 'skip', 'replace'].includes(mode)) {
    return res.status(400).json({ 
      error: 'Mode invalide',
      validModes: ['upsert', 'skip', 'replace']
    });
  }
  
  const stats = {
    total: items.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };
  
  // Si mode replace, vider la table d'abord
  if (mode === 'replace') {
    await query('TRUNCATE TABLE items RESTART IDENTITY');
  }
  
  for (const item of items) {
    try {
      // Accepter source_id ou external_id pour rétrocompatibilité
      const sourceId = item.source_id || item.external_id;
      if (!item.source || !sourceId) {
        stats.errors++;
        continue;
      }
      
      // Générer l'ID composite
      const id = `${item.source}:${sourceId}`;
      
      // Vérifier si l'item existe déjà
      const existing = await query(
        'SELECT id FROM items WHERE id = $1',
        [id]
      );
      
      if (existing.rows.length > 0) {
        if (mode === 'skip') {
          stats.skipped++;
          continue;
        }
        
        // Mode upsert: mettre à jour
        await query(`
          UPDATE items SET
            type = COALESCE($2, type),
            subtype = COALESCE($3, subtype),
            name = COALESCE($4, name),
            name_original = COALESCE($5, name_original),
            year = COALESCE($6, year),
            authors = COALESCE($7, authors),
            publisher = COALESCE($8, publisher),
            genres = COALESCE($9, genres),
            language = COALESCE($10, language),
            tome = COALESCE($11, tome),
            series_name = COALESCE($12, series_name),
            series_id = COALESCE($13, series_id),
            piece_count = COALESCE($14, piece_count),
            figure_count = COALESCE($15, figure_count),
            theme = COALESCE($16, theme),
            runtime = COALESCE($17, runtime),
            pages = COALESCE($18, pages),
            isbn = COALESCE($19, isbn),
            ean = COALESCE($20, ean),
            imdb_id = COALESCE($21, imdb_id),
            data = COALESCE($22, data),
            image_url = COALESCE($23, image_url),
            thumbnail_url = COALESCE($24, thumbnail_url),
            source_url = COALESCE($25, source_url),
            detail_url = COALESCE($26, detail_url),
            updated_at = NOW(),
            fetch_count = COALESCE($27, fetch_count)
          WHERE id = $1
        `, [
          id,
          item.type, item.subtype,
          item.name || item.data?.name, item.name_original,
          item.year || item.data?.year,
          item.authors, item.publisher, item.genres, item.language,
          item.tome, item.series_name, item.series_id,
          item.piece_count, item.figure_count, item.theme,
          item.runtime, item.pages, item.isbn, item.ean, item.imdb_id,
          item.data || {},
          item.image_url || item.image, item.thumbnail_url,
          item.source_url, item.detail_url,
          item.fetch_count || item.hit_count || 0
        ]);
        stats.updated++;
      } else {
        // Insérer le nouvel item
        await query(`
          INSERT INTO items (id, source, source_id, type, subtype, name, name_original, year, authors, publisher, genres, language, tome, series_name, series_id, piece_count, figure_count, theme, runtime, pages, isbn, ean, imdb_id, data, image_url, thumbnail_url, source_url, detail_url, created_at, updated_at, fetch_count)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, COALESCE($29::timestamp, NOW()), NOW(), $30)
        `, [
          id,
          item.source, sourceId,
          item.type || 'unknown', item.subtype,
          item.name || item.data?.name || 'Unknown', item.name_original,
          item.year || item.data?.year,
          item.authors, item.publisher, item.genres, item.language,
          item.tome, item.series_name, item.series_id,
          item.piece_count, item.figure_count, item.theme,
          item.runtime, item.pages, item.isbn, item.ean, item.imdb_id,
          item.data || {},
          item.image_url || item.image, item.thumbnail_url,
          item.source_url, item.detail_url,
          item.created_at,
          item.fetch_count || item.hit_count || 0
        ]);
        stats.inserted++;
      }
    } catch (err) {
      console.error(`Erreur import item ${item.source}/${item.source_id || item.external_id}:`, err.message);
      stats.errors++;
    }
  }
  
  res.json({
    success: true,
    mode,
    import_meta: _meta || null,
    stats
  });
}));

/**
 * DELETE /local/purge
 * Purge des items anciens ou jamais consultés
 * 
 * @query {number} days - Items non consultés depuis X jours (défaut: 90)
 * @query {boolean} dry - Mode simulation (défaut: true)
 */
localRouter.delete('/purge', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const days = Math.max(7, parseInt(req.query.days, 10) || 90);
  const dry = req.query.dry !== 'false';
  
  // Compter d'abord les items à purger
  const countResult = await query(`
    SELECT COUNT(*) as count, source, type
    FROM items
    WHERE last_accessed < NOW() - INTERVAL '${days} days'
       OR (last_accessed IS NULL AND created_at < NOW() - INTERVAL '${days} days')
    GROUP BY source, type
    ORDER BY count DESC
  `);
  
  const totalToPurge = countResult.rows.reduce((acc, row) => acc + parseInt(row.count, 10), 0);
  
  if (dry) {
    return res.json({
      dry_run: true,
      days_threshold: days,
      items_to_purge: totalToPurge,
      breakdown: countResult.rows,
      hint: 'Ajoutez ?dry=false pour exécuter la purge'
    });
  }
  
  // Exécuter la purge
  const deleteResult = await query(`
    DELETE FROM items
    WHERE last_accessed < NOW() - INTERVAL '${days} days'
       OR (last_accessed IS NULL AND created_at < NOW() - INTERVAL '${days} days')
  `);
  
  res.json({
    success: true,
    days_threshold: days,
    items_purged: deleteResult.rowCount,
    breakdown: countResult.rows
  });
}));

/**
 * POST /local/warmup
 * Pré-remplissage du cache en masse
 * 
 * Body: {
 *   provider: "lego" | "googlebooks" | etc.,
 *   queries: ["star wars", "harry potter", ...],
 *   options: { max: 10, lang: "fr" }
 * }
 * 
 * Ou pour des IDs spécifiques:
 * Body: {
 *   provider: "lego",
 *   ids: ["42217", "75192", ...]
 * }
 */
localRouter.post('/warmup', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const { provider, queries, ids, options = {} } = req.body;
  
  if (!provider) {
    return res.status(400).json({ 
      error: 'Provider requis',
      example: {
        provider: 'lego',
        queries: ['star wars', 'technic'],
        options: { max: 10 }
      }
    });
  }
  
  if (!queries && !ids) {
    return res.status(400).json({ 
      error: 'queries ou ids requis',
      hint: 'Fournissez soit un tableau de queries pour la recherche, soit un tableau d\'IDs pour les détails'
    });
  }
  
  const results = {
    provider,
    mode: queries ? 'search' : 'details',
    requested: (queries || ids).length,
    success: 0,
    failed: 0,
    cached: 0,
    errors: []
  };
  
  const startTime = Date.now();
  
  // Mode recherche : effectue des recherches et cache les résultats
  if (queries && Array.isArray(queries)) {
    for (const q of queries.slice(0, 50)) { // Max 50 queries par warmup
      try {
        // Le warmup stocke juste l'intention, le vrai fetch se fera via les endpoints normaux
        // On enregistre les queries pour statistiques futures
        await query(`
          INSERT INTO searches (query, provider, search_type, result_ids, result_count, created_at, expires_at)
          VALUES ($1, $2, 'warmup', ARRAY[]::text[], 0, NOW(), NOW() + INTERVAL '1 hour')
          ON CONFLICT (query_normalized, provider, search_type) DO UPDATE SET updated_at = NOW()
        `, [q, provider]);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ query: q, error: err.message });
      }
    }
    
    results.hint = 'Les queries ont été enregistrées. Utilisez les endpoints de recherche normaux pour déclencher le cache réel.';
  }
  
  // Mode détails : prépare les IDs pour un fetch futur
  if (ids && Array.isArray(ids)) {
    const uniqueIds = [...new Set(ids)].slice(0, 100); // Max 100 IDs
    
    for (const id of uniqueIds) {
      try {
        // Vérifie si l'item existe déjà en cache
        const existing = await query(`
          SELECT id, expires_at > NOW() as valid
          FROM items 
          WHERE source = $1 AND source_id = $2
        `, [provider, id]);
        
        if (existing?.valid) {
          results.cached++;
        } else {
          // Marque l'item comme "à récupérer" (placeholder)
          results.success++;
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ id, error: err.message });
      }
    }
    
    results.hint = 'Utilisez les endpoints /details pour chaque ID afin de déclencher le fetch et la mise en cache.';
  }
  
  results.duration_ms = Date.now() - startTime;
  
  res.json(results);
}));

/**
 * GET /local/health
 * Statistiques de santé détaillées du cache
 */
localRouter.get('/health', asyncHandler(async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Base de données non connectée' });
  }
  
  const healthResult = await query(`
    SELECT 
      COUNT(*) as total_items,
      COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_items,
      COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_items,
      COUNT(*) FILTER (WHERE last_accessed > NOW() - INTERVAL '24 hours') as accessed_today,
      COUNT(*) FILTER (WHERE last_accessed > NOW() - INTERVAL '7 days') as accessed_week,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as created_today,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as created_week,
      AVG(hit_count)::int as avg_hits,
      MAX(hit_count) as max_hits,
      MIN(created_at) as oldest_item,
      MAX(updated_at) as newest_update
    FROM items
  `);
  
  const searchesResult = await query(`
    SELECT 
      COUNT(*) as total_searches,
      COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_searches,
      COUNT(DISTINCT provider) as providers_searched
    FROM searches
  `);
  
  const sizeResult = await query(`
    SELECT 
      pg_size_pretty(pg_total_relation_size('items')) as items_size,
      pg_size_pretty(pg_total_relation_size('searches')) as searches_size,
      pg_size_pretty(pg_database_size(current_database())) as total_db_size
  `);
  
  addCacheHeaders(res, 30);
  res.json({
    status: 'healthy',
    items: healthResult,
    searches: searchesResult,
    storage: sizeResult,
    timestamp: new Date().toISOString()
  });
}));

export { localRouter };
