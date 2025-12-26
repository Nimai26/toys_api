/**
 * lib/database/migrations.js - Migrations PostgreSQL
 * 
 * Auto-création des tables au démarrage
 * toys_api v4.0.0
 */

import { query, getClient, isDatabaseConnected } from './connection.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Migrations');

// Version actuelle du schéma (exportée)
export const SCHEMA_VERSION = 2;

/**
 * Exécute toutes les migrations nécessaires
 */
export async function runMigrations() {
  if (!isDatabaseConnected()) {
    log.warn('⚠️ Base de données non connectée - migrations ignorées');
    return false;
  }

  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    // Créer la table de versioning si elle n'existe pas
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW(),
        description TEXT
      )
    `);

    // Récupérer la version actuelle
    const result = await client.query('SELECT MAX(version) as current_version FROM schema_migrations');
    const currentVersion = result.rows[0].current_version || 0;

    log.info(`📊 Version schéma actuelle: ${currentVersion}, cible: ${SCHEMA_VERSION}`);

    // Appliquer les migrations manquantes
    for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
      log.info(`🔄 Application migration v${v}...`);
      await applyMigration(client, v);
      await client.query(
        'INSERT INTO schema_migrations (version, description) VALUES ($1, $2)',
        [v, MIGRATIONS[v]?.description || `Migration v${v}`]
      );
      log.info(`✅ Migration v${v} appliquée`);
    }

    await client.query('COMMIT');
    log.info('✅ Migrations terminées avec succès');
    return true;

  } catch (err) {
    await client.query('ROLLBACK');
    log.error(`❌ Erreur migration: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Définition des migrations
 */
const MIGRATIONS = {
  1: {
    description: 'Schéma initial - tables items, searches, stats, series',
    up: async (client) => {
      // Extensions PostgreSQL
      await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      await client.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);

      // Fonction de normalisation du texte
      await client.query(`
        CREATE OR REPLACE FUNCTION normalize_text(text) RETURNS text AS $$
          SELECT lower(unaccent(COALESCE($1, '')));
        $$ LANGUAGE SQL IMMUTABLE
      `);

      // ========================================
      // TABLE: items (données principales)
      // ========================================
      await client.query(`
        CREATE TABLE IF NOT EXISTS items (
          -- Clé primaire
          id TEXT PRIMARY KEY,
          
          -- Identification
          source TEXT NOT NULL,
          source_id TEXT NOT NULL,
          type TEXT NOT NULL,
          subtype TEXT,
          
          -- Données principales
          name TEXT NOT NULL,
          name_original TEXT,
          name_search TEXT GENERATED ALWAYS AS (normalize_text(name)) STORED,
          
          -- Champs dénormalisés pour requêtes rapides
          year INTEGER,
          authors TEXT[],
          publisher TEXT,
          genres TEXT[],
          language TEXT,
          
          -- Champs spécifiques par type
          tome INTEGER,
          series_name TEXT,
          series_id TEXT,
          piece_count INTEGER,
          figure_count INTEGER,
          theme TEXT,
          runtime INTEGER,
          pages INTEGER,
          
          -- Identifiants externes
          isbn TEXT,
          ean TEXT,
          imdb_id TEXT,
          
          -- Données complètes (JSONB)
          data JSONB NOT NULL,
          
          -- Images
          image_url TEXT,
          thumbnail_url TEXT,
          
          -- URLs
          source_url TEXT,
          detail_url TEXT,
          
          -- Métadonnées
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ,
          
          -- Statistiques
          fetch_count INTEGER DEFAULT 1,
          last_accessed TIMESTAMPTZ DEFAULT NOW(),
          
          -- Contraintes
          CONSTRAINT items_source_id_unique UNIQUE(source, source_id)
        )
      `);

      // Index pour items
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_source ON items(source)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_subtype ON items(subtype)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_year ON items(year)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_expires ON items(expires_at)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_theme ON items(theme)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_series ON items(series_name)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_isbn ON items(isbn)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_ean ON items(ean)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_imdb ON items(imdb_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_authors ON items USING GIN(authors)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_genres ON items USING GIN(genres)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_data ON items USING GIN(data jsonb_path_ops)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_items_name_trgm ON items USING GIN(name_search gin_trgm_ops)`);

      // Trigger updated_at
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS items_updated_at ON items;
        CREATE TRIGGER items_updated_at
          BEFORE UPDATE ON items
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at()
      `);

      // ========================================
      // TABLE: searches (cache des recherches)
      // ========================================
      await client.query(`
        CREATE TABLE IF NOT EXISTS searches (
          id SERIAL PRIMARY KEY,
          
          query TEXT NOT NULL,
          query_normalized TEXT GENERATED ALWAYS AS (normalize_text(query)) STORED,
          provider TEXT NOT NULL,
          search_type TEXT,
          options JSONB,
          
          result_ids TEXT[] NOT NULL,
          result_count INTEGER,
          total_results INTEGER,
          
          created_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ,
          
          CONSTRAINT searches_unique UNIQUE(query, provider, search_type)
        )
      `);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_searches_query ON searches(query_normalized)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_searches_provider ON searches(provider)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_searches_expires ON searches(expires_at)`);

      // ========================================
      // TABLE: stats (statistiques d'usage)
      // ========================================
      await client.query(`
        CREATE TABLE IF NOT EXISTS stats (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL DEFAULT CURRENT_DATE,
          source TEXT NOT NULL,
          
          api_calls INTEGER DEFAULT 0,
          cache_hits INTEGER DEFAULT 0,
          cache_misses INTEGER DEFAULT 0,
          new_items INTEGER DEFAULT 0,
          searches INTEGER DEFAULT 0,
          
          avg_api_time_ms INTEGER,
          avg_cache_time_ms INTEGER,
          
          CONSTRAINT stats_unique UNIQUE(date, source)
        )
      `);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_stats_date ON stats(date)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_stats_source ON stats(source)`);

      // ========================================
      // TABLE: series (séries/collections)
      // ========================================
      await client.query(`
        CREATE TABLE IF NOT EXISTS series (
          id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          source_id TEXT NOT NULL,
          
          name TEXT NOT NULL,
          name_original TEXT,
          
          item_count INTEGER,
          status TEXT,
          
          data JSONB,
          
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          
          CONSTRAINT series_source_id_unique UNIQUE(source, source_id)
        )
      `);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_series_source ON series(source)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_series_name ON series USING GIN(to_tsvector('french', name))`);

      // Trigger updated_at pour series
      await client.query(`
        DROP TRIGGER IF EXISTS series_updated_at ON series;
        CREATE TRIGGER series_updated_at
          BEFORE UPDATE ON series
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at()
      `);

      // ========================================
      // VUES UTILES
      // ========================================
      
      // Vue des items par source
      await client.query(`
        CREATE OR REPLACE VIEW items_by_source AS
        SELECT 
          source,
          type,
          COUNT(*) as count,
          MIN(created_at) as first_added,
          MAX(updated_at) as last_updated
        FROM items
        GROUP BY source, type
        ORDER BY source, type
      `);

      // Vue des items populaires
      await client.query(`
        CREATE OR REPLACE VIEW popular_items AS
        SELECT 
          id, source, type, name, year, fetch_count, last_accessed
        FROM items
        ORDER BY fetch_count DESC, last_accessed DESC
        LIMIT 100
      `);

      // Vue des items à rafraîchir
      await client.query(`
        CREATE OR REPLACE VIEW items_to_refresh AS
        SELECT 
          id, source, type, name, expires_at, fetch_count
        FROM items
        WHERE expires_at < NOW()
          AND fetch_count > 5
        ORDER BY fetch_count DESC
      `);

      log.info('📊 Tables items, searches, stats, series créées');
      log.info('📊 Index et vues créés');
    }
  },
  
  2: {
    description: 'Ajout cached_results pour stocker les résultats de recherche complets',
    up: async (client) => {
      // Ajouter la colonne cached_results pour stocker les résultats JSON complets
      await client.query(`
        ALTER TABLE searches 
        ADD COLUMN IF NOT EXISTS cached_results JSONB
      `);
      
      // Index pour recherches rapides par provider et type
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_searches_provider_type 
        ON searches(provider, search_type)
      `);
      
      log.info('📊 Colonne cached_results ajoutée à la table searches');
    }
  }
};

/**
 * Applique une migration spécifique
 */
async function applyMigration(client, version) {
  const migration = MIGRATIONS[version];
  if (!migration) {
    throw new Error(`Migration v${version} non trouvée`);
  }
  await migration.up(client);
}

/**
 * Vérifie la santé de la base de données
 */
export async function checkDatabaseHealth() {
  if (!isDatabaseConnected()) {
    return { healthy: false, error: 'Non connecté' };
  }

  try {
    const result = await query(`
      SELECT 
        (SELECT COUNT(*) FROM items) as items_count,
        (SELECT COUNT(*) FROM searches) as searches_count,
        (SELECT COUNT(*) FROM series) as series_count,
        (SELECT MAX(version) FROM schema_migrations) as schema_version
    `);
    
    return {
      healthy: true,
      stats: result.rows[0],
      schemaVersion: result.rows[0].schema_version
    };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}

export default {
  runMigrations,
  checkDatabaseHealth,
  SCHEMA_VERSION
};
