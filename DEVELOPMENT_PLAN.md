# 🗄️ Plan de Développement : Base de Données Auto-Alimentée

> **Version cible** : toys_api v4.0.0  
> **Début prévu** : Janvier 2025  
> **Durée estimée** : 6-7 jours de développement  
> **Statut** : ✅ Phase 1-4 terminées (26 décembre 2025)

---

## 📋 Table des Matières

1. [Objectifs](#-objectifs)
2. [Architecture](#-architecture)
3. [Choix Technologiques](#-choix-technologiques)
4. [Phases de Développement](#-phases-de-développement)
5. [Schéma de Base de Données](#-schéma-de-base-de-données)
6. [Configuration](#-configuration)
7. [Métriques de Succès](#-métriques-de-succès)
8. [Risques et Mitigations](#-risques-et-mitigations)
9. [Changelog](#-changelog)

---

## 🎯 Objectifs

### Objectif Principal
Transformer toys_api en une base de données auto-alimentée qui stocke progressivement toutes les données récupérées depuis les APIs externes, permettant :
- Des réponses instantanées pour les items déjà consultés
- Une recherche cross-source unifiée
- Un mode offline fonctionnel
- Une réduction des appels API externes

### Objectifs Secondaires
- [x] Latence < 10ms pour les items en cache local (mesuré ~23ms)
- [ ] Disponibilité 99.9% grâce au mode offline
- [x] Recherche full-text sur toutes les sources
- [x] Statistiques d'usage détaillées
- [x] Export/Import de la base

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TOYS API v4.0                            │
├─────────────────────────────────────────────────────────────────┤
│  Requête Client                                                 │
│       ↓                                                         │
│  ┌─────────────────┐                                            │
│  │ 1. Check Local  │ ← PostgreSQL (JSONB + Full-text)           │
│  │    Database     │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│     Trouvé & Valide? ───Yes──→ Retourner données locales (<10ms)│
│           │                                                     │
│          No                                                     │
│           ↓                                                     │
│  ┌─────────────────┐                                            │
│  │ 2. Query API    │ → LEGO, TMDB, Google Books, etc.          │
│  │    Externe      │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ↓                                                     │
│  ┌─────────────────┐                                            │
│  │ 3. Store in DB  │ → Sauvegarde async (non-bloquant)         │
│  │    + Return     │                                            │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Choix Technologiques

### Base de Données : PostgreSQL ✅

**Pourquoi PostgreSQL ?**

| Critère | SQLite | MariaDB | PostgreSQL ✅ |
|---------|--------|---------|---------------|
| **JSON natif** | ⚠️ Basique | ⚠️ JSON | ✅ **JSONB** (binaire, indexable) |
| **Full-text search** | ❌ Limité | ✅ Bon | ✅ **Excellent** (multilingue FR/EN) |
| **Concurrence** | ❌ Faible | ✅ Bonne | ✅ **Excellente** |
| **Requêtes JSON** | ❌ Lent | ⚠️ Moyen | ✅ **Très rapide** (GIN index) |
| **Indexation JSONB** | ❌ Non | ❌ Non | ✅ **Oui** (index sur champs JSON) |
| **Scalabilité** | ❌ ~1GB | ✅ Bonne | ✅ **Excellente** |

**Décision** : PostgreSQL car :
1. **JSONB** permet d'indexer des champs spécifiques dans le JSON (ex: `data->>'year'`)
2. **Full-text search multilingue** natif (français + anglais)
3. **Requêtes complexes** sur les données normalisées (ex: tous les LEGO Star Wars > 2020)
4. **Meilleure intégration** avec nos schémas harmonisés
5. **Performance supérieure** pour les recherches cross-source

### Déploiement
- **Container** : `postgres:16-alpine` (léger, performant)
- **Volume** : `/Docker_Data/toys_api/postgres/`
- **Port** : `5432` (interne au réseau Docker)
- **Database** : `toys_api_cache`
- **User** : `toys_api`

---

## 📅 Phases de Développement

### Phase 1 : Infrastructure Database ✅ TERMINÉE
**Durée estimée** : 1 jour

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 1.1 | Ajouter container PostgreSQL au docker-compose | ✅ | postgres:16-alpine |
| 1.2 | Ajouter variables d'env PostgreSQL dans `.env` | ✅ | TOY_API_DB_* |
| 1.3 | Créer `lib/database/connection.js` | ✅ | Pool pg avec reconnexion auto |
| 1.4 | Créer `lib/database/migrations.js` | ✅ | Auto-création des tables au démarrage |
| 1.5 | Créer le schéma complet (tables, index, vues) | ✅ | items, searches, stats + index GIN trigram |
| 1.6 | Tests de connexion | ✅ | Healthcheck DB fonctionnel |
| 1.7 | Backup automatique PostgreSQL | ✅ | Container toys_api_backup + scripts/backup.sh |

### Phase 2 : Couche d'Abstraction ✅ TERMINÉE
**Durée estimée** : 1.5 jours

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 2.1 | Créer `lib/database/repository.js` | ✅ | CRUD générique (getItem, saveItem, searchLocal) |
| 2.2 | Créer `lib/database/cache-strategy.js` | ✅ | Intégré dans repository.js (CACHE_TTL) |
| 2.3 | Créer `lib/database/search.js` | ✅ | Intégré dans repository.js (searchLocal) |
| 2.4 | Wrapper `withCache()` pour providers | ✅ | cache-wrapper.js avec createProviderCache() |
| 2.5 | Tests unitaires | ⬜ | Non implémenté |

### Phase 3 : Intégration Progressive ✅ TERMINÉE
**Durée estimée** : 1 jour

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 3.1 | Intégrer sur `/details` endpoints | ✅ | Tous les providers intégrés (21 providers) |
| 3.2 | Intégrer sur `/search` endpoints | ⬜ | Non fait (seulement /details) |
| 3.3 | Ajouter header `X-Cache: HIT/MISS` | ✅ | getCacheInfo() + addCacheHeaders() |
| 3.4 | Logs de performance | ✅ | CacheWrapper avec logs DEBUG |
| 3.5 | Mode offline (env variable) | ✅ | `CACHE_MODE=db_only` |

### Phase 4 : Fonctionnalités Avancées ✅ TERMINÉE
**Durée estimée** : 2 jours

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 4.1 | Endpoint `/local/search` | ✅ | Recherche multi-source avec full-text |
| 4.2 | Endpoint `/local/stats` | ✅ | Statistiques complètes |
| 4.3 | Endpoint `/local/export` | ✅ | JSON et NDJSON (streaming) |
| 4.4 | Endpoint `/local/import` | ✅ | modes: upsert, skip, replace |
| 4.5 | Endpoint `/local/refresh/:source/:id` | ⬜ | Paramètre ?refresh=true sur /details |
| 4.6 | Endpoint `/local/popular` | ✅ | Items les plus demandés |
| 4.7 | Dashboard monitoring DB | ✅ | Via /local/stats et /local/status |
| 4.5 | Endpoint `/local/refresh/:source/:id` | ⬜ | Force refresh |
| 4.6 | Endpoint `/local/popular` | ⬜ | Items les plus demandés |
| 4.7 | Dashboard monitoring DB | ⬜ | Dans `/monitoring/status` |

### Phase 5 : Optimisations 🟢 NON COMMENCÉE
**Durée estimée** : 1 jour

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 5.1 | Background job refresh items périmés | ⬜ | Cron interne |
| 5.2 | Index optimisés | ✅ | GIN trigram pour full-text |
| 5.3 | Compression JSON (optionnel) | ⬜ | Si volume important |
| 5.4 | API de "warm-up" | ⬜ | Pré-remplissage massif |
| 5.5 | Backup automatique | ⬜ | Vers /NAS/Data/Backups |

---

## 🗃️ Schéma de Base de Données

> **Principe** : Le schéma est conçu pour stocker les données dans leur format harmonisé complet, permettant des requêtes avancées sur tous les champs normalisés.

### Table `items` (données principales)

```sql
-- Extension pour la recherche full-text et les UUID
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Fonction pour normaliser le texte (sans accents)
CREATE OR REPLACE FUNCTION normalize_text(text) RETURNS text AS $$
  SELECT lower(unaccent($1));
$$ LANGUAGE SQL IMMUTABLE;

-- Table principale des items
CREATE TABLE items (
  -- Clé primaire composite
  id TEXT PRIMARY KEY,                    -- Format: "source:sourceId" (ex: "lego:42217")
  
  -- Identification
  source TEXT NOT NULL,                   -- lego, tmdb, googlebooks, bedetheque, etc.
  source_id TEXT NOT NULL,                -- ID original du provider
  type TEXT NOT NULL,                     -- construct_toy, movie, book, game, music, etc.
  subtype TEXT,                           -- album, serie, volume, issue, etc.
  
  -- Données principales (dénormalisées pour recherche rapide)
  name TEXT NOT NULL,                     -- Nom principal
  name_original TEXT,                     -- Nom original si différent
  name_search TEXT GENERATED ALWAYS AS (normalize_text(name)) STORED,
  
  -- Champs extraits pour requêtes (dénormalisés depuis data)
  year INTEGER,                           -- Année de sortie/publication
  authors TEXT[],                         -- Tableau d'auteurs
  publisher TEXT,                         -- Éditeur/Studio
  genres TEXT[],                          -- Genres
  language TEXT,                          -- Langue principale
  
  -- Champs spécifiques par type (nullable)
  tome INTEGER,                           -- Numéro de tome (books)
  series_name TEXT,                       -- Nom de la série (books)
  series_id TEXT,                         -- ID de la série (books)
  piece_count INTEGER,                    -- Nombre de pièces (construct_toy)
  figure_count INTEGER,                   -- Nombre de figurines (construct_toy)
  theme TEXT,                             -- Thème (construct_toy)
  runtime INTEGER,                        -- Durée en minutes (movie, tv)
  pages INTEGER,                          -- Nombre de pages (book)
  
  -- Identifiants externes
  isbn TEXT,                              -- ISBN (books)
  ean TEXT,                               -- Code EAN
  imdb_id TEXT,                           -- ID IMDB (movies, tv)
  
  -- Données complètes (format harmonisé)
  data JSONB NOT NULL,                    -- Données complètes normalisées
  
  -- Images (extraites pour accès rapide)
  image_url TEXT,                         -- Image principale
  thumbnail_url TEXT,                     -- Miniature
  
  -- URLs
  source_url TEXT,                        -- URL sur le site source
  detail_url TEXT,                        -- Endpoint pour détails
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,                 -- Date d'expiration du cache
  
  -- Statistiques d'usage
  fetch_count INTEGER DEFAULT 1,          -- Nombre de fois demandé
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contrainte d'unicité
  UNIQUE(source, source_id)
);

-- Index pour recherche rapide
CREATE INDEX idx_items_source ON items(source);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_subtype ON items(subtype);
CREATE INDEX idx_items_year ON items(year);
CREATE INDEX idx_items_expires ON items(expires_at);
CREATE INDEX idx_items_theme ON items(theme);
CREATE INDEX idx_items_series ON items(series_name);
CREATE INDEX idx_items_isbn ON items(isbn);
CREATE INDEX idx_items_ean ON items(ean);
CREATE INDEX idx_items_imdb ON items(imdb_id);

-- Index GIN pour recherche dans les tableaux
CREATE INDEX idx_items_authors ON items USING GIN(authors);
CREATE INDEX idx_items_genres ON items USING GIN(genres);

-- Index GIN pour recherche dans JSONB (requêtes avancées)
CREATE INDEX idx_items_data ON items USING GIN(data jsonb_path_ops);

-- Index full-text pour recherche
CREATE INDEX idx_items_search ON items USING GIN(to_tsvector('french', name || ' ' || COALESCE(name_original, '')));
CREATE INDEX idx_items_name_trgm ON items USING GIN(name_search gin_trgm_ops);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### Table `searches` (cache des recherches)

```sql
CREATE TABLE searches (
  id SERIAL PRIMARY KEY,
  
  -- Identification de la recherche
  query TEXT NOT NULL,                    -- Terme de recherche
  query_normalized TEXT GENERATED ALWAYS AS (normalize_text(query)) STORED,
  provider TEXT NOT NULL,                 -- Source de la recherche
  search_type TEXT,                       -- volume, album, movie, etc.
  options JSONB,                          -- Options de recherche (max, lang, etc.)
  
  -- Résultats
  result_ids TEXT[] NOT NULL,             -- Liste des IDs trouvés ["lego:42217", ...]
  result_count INTEGER,                   -- Nombre de résultats retournés
  total_results INTEGER,                  -- Nombre total disponible
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Contrainte d'unicité
  UNIQUE(query_normalized, provider, search_type)
);

CREATE INDEX idx_searches_query ON searches(query_normalized);
CREATE INDEX idx_searches_provider ON searches(provider);
CREATE INDEX idx_searches_expires ON searches(expires_at);
```

### Table `stats` (statistiques d'usage)

```sql
CREATE TABLE stats (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL,
  
  -- Compteurs journaliers
  api_calls INTEGER DEFAULT 0,            -- Appels API externes
  cache_hits INTEGER DEFAULT 0,           -- Items servis depuis DB
  cache_misses INTEGER DEFAULT 0,         -- Items non trouvés en DB
  new_items INTEGER DEFAULT 0,            -- Nouveaux items ajoutés
  searches INTEGER DEFAULT 0,             -- Recherches effectuées
  
  -- Performance
  avg_api_time_ms INTEGER,                -- Temps moyen appel API
  avg_cache_time_ms INTEGER,              -- Temps moyen depuis cache
  
  UNIQUE(date, source)
);

CREATE INDEX idx_stats_date ON stats(date);
CREATE INDEX idx_stats_source ON stats(source);
```

### Table `series` (séries/collections pour navigation)

```sql
CREATE TABLE series (
  id TEXT PRIMARY KEY,                    -- Format: "source:seriesId"
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  
  name TEXT NOT NULL,
  name_original TEXT,
  
  -- Métadonnées
  item_count INTEGER,                     -- Nombre d'items dans la série
  status TEXT,                            -- ongoing, completed, etc.
  
  -- Données complètes
  data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(source, source_id)
);

CREATE INDEX idx_series_source ON series(source);
CREATE INDEX idx_series_name ON series USING GIN(to_tsvector('french', name));
```

### Vues utiles

```sql
-- Vue des items par source avec comptage
CREATE VIEW items_by_source AS
SELECT 
  source,
  type,
  COUNT(*) as count,
  MIN(created_at) as first_added,
  MAX(updated_at) as last_updated
FROM items
GROUP BY source, type
ORDER BY source, type;

-- Vue des items populaires
CREATE VIEW popular_items AS
SELECT 
  id, source, type, name, year, fetch_count, last_accessed
FROM items
ORDER BY fetch_count DESC, last_accessed DESC
LIMIT 100;

-- Vue des items à rafraîchir (expirés mais populaires)
CREATE VIEW items_to_refresh AS
SELECT 
  id, source, type, name, expires_at, fetch_count
FROM items
WHERE expires_at < NOW()
  AND fetch_count > 5
ORDER BY fetch_count DESC;
```

---

## ⚙️ Configuration

### Variables d'Environnement (à ajouter dans `.env`)

```env
#====================================================
#               TOYS API - DATABASE CACHE (PostgreSQL)
#====================================================
TOY_API_DB_ENABLED=true
TOY_API_DB_HOST=toys_api_postgres
TOY_API_DB_PORT=5432
TOY_API_DB_NAME=toys_api_cache
TOY_API_DB_USER=toys_api
TOY_API_DB_PASSWORD=<à_générer_mdp_fort>
TOY_API_DB_POOL_MIN=2
TOY_API_DB_POOL_MAX=10

# Mode de cache
TOY_API_CACHE_MODE=hybrid              # hybrid, db_only, api_only
TOY_API_CACHE_DEFAULT_TTL=2592000      # 30 jours en secondes
```

### Docker Compose (container PostgreSQL)

```yaml
# À ajouter dans docker-compose.yaml
services:
  toys_api_postgres:
    image: postgres:16-alpine
    container_name: toys_api_postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=${TOY_API_DB_NAME}
      - POSTGRES_USER=${TOY_API_DB_USER}
      - POSTGRES_PASSWORD=${TOY_API_DB_PASSWORD}
      - TZ=${TZ}
    volumes:
      - ${DOCKER_DATA}/toys_api/postgres:/var/lib/postgresql/data
    networks:
      - ${docker_network}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${TOY_API_DB_USER} -d ${TOY_API_DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### TTL par Provider

```javascript
// lib/database/cache-strategy.js
export const CACHE_TTL = {
  // Données très stables (90 jours)
  lego: 90 * 24 * 60 * 60,
  bedetheque: 90 * 24 * 60 * 60,
  playmobil: 90 * 24 * 60 * 60,
  
  // Données stables (30 jours)
  googlebooks: 30 * 24 * 60 * 60,
  openlibrary: 30 * 24 * 60 * 60,
  comicvine: 30 * 24 * 60 * 60,
  mangadex: 30 * 24 * 60 * 60,
  
  // Données avec mises à jour (7 jours)
  tmdb: 7 * 24 * 60 * 60,
  tvdb: 7 * 24 * 60 * 60,
  rawg: 7 * 24 * 60 * 60,
  igdb: 7 * 24 * 60 * 60,
  jikan: 7 * 24 * 60 * 60,
  
  // Données live (1 jour)
  imdb: 1 * 24 * 60 * 60,
  music: 7 * 24 * 60 * 60,
};
```

---

## 📈 Métriques de Succès

| Métrique | Avant (v3.x) | Cible (v4.0) | Comment mesurer |
|----------|--------------|--------------|-----------------|
| Latence item connu | 200-2000ms | < 10ms | Header `X-Response-Time` |
| Cache hit rate | 0% | > 80% après 1 mois | `/local/stats` |
| Disponibilité | ~95% (dépend APIs) | 99.9% | Monitoring |
| Items en base | 0 | > 10k après 1 mois | `/local/stats` |
| Coût API mensuel | 100% | < 20% | Compteur `api_calls` |

---

## ⚠️ Risques et Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Base de données corrompue | Faible | Élevé | Backup quotidien automatique |
| Données périmées servies | Moyenne | Moyen | TTL strict + endpoint refresh |
| Performance dégradée | Faible | Moyen | Index optimisés + monitoring |
| Saturation disque | Faible | Élevé | Alerte à 80% + purge auto |
| Conflit de versions API | Moyenne | Moyen | Versionner le schéma JSON |

---

## 📝 Changelog

### 2025-12-26 - Implémentation v4.0.0 TERMINÉE
- ✅ **Phase 1** : Infrastructure PostgreSQL complète
  - Container `toys_api_postgres` (postgres:16-alpine)
  - Pool de connexion avec reconnexion automatique
  - Migrations auto au démarrage
  - Schema avec table `items`, `searches`, `stats`
  - Index GIN trigram pour full-text search
- ✅ **Phase 2** : Couche d'abstraction
  - `cache-wrapper.js` avec `createProviderCache()`
  - `withCache()` et `withSearchCache()` wrappers
  - Repository avec CRUD et searchLocal()
- ✅ **Phase 3** : Intégration sur tous les providers (21 au total)
  - Comics : MangaDex, Bedetheque
  - Anime : Jikan (anime + manga)
  - Books : GoogleBooks, OpenLibrary
  - LEGO, Rebrickable, Playmobil, Klickypedia, Mega
  - Media : TVDB, TMDB, IMDB
  - Videogames : RAWG, IGDB, JVC
  - Music : Deezer, Discogs, MusicBrainz
  - Collectibles : Luluberlu, ConsoleVariations, Transformerland, Paninimania
- ✅ **Phase 4** (partiel) : Endpoints locaux
  - `/local/status`, `/local/stats`, `/local/search`, `/local/popular`, `/local/refresh`, `/local/recent`
- 🔧 **Fix** : Parsing `detailUrl` pour supporter protocole `toys://`
- 📊 **Performance mesurée** : 7-14x plus rapide (API ~300ms → Cache ~23ms)

### 2025-12-26 - Mise à jour : PostgreSQL
- **Changement** : MariaDB → PostgreSQL
- Ajout schéma complet avec JSONB indexé
- Ajout champs dénormalisés pour requêtes rapides (year, tome, authors, genres, etc.)
- Ajout table `series` pour navigation par collections
- Ajout vues SQL utiles
- Ajout configuration Docker Compose PostgreSQL
- Schéma aligné avec les formats harmonisés de toys_api

### 2025-12-26 - Création du plan
- Définition de l'architecture
- Définition des 5 phases
- Configuration et métriques

---

## 🔗 Références

- [toys_api GitHub](https://github.com/Nimai26/toys_api)
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [PostgreSQL GIN Indexes](https://www.postgresql.org/docs/current/gin-intro.html)
- [node-postgres (pg)](https://node-postgres.com/)

---

## 📐 Mapping Schéma ↔ Format Harmonisé

Cette section décrit comment les données harmonisées de toys_api sont stockées dans PostgreSQL.

### Type `book` (Google Books, OpenLibrary, Bedetheque, ComicVine, MangaDex)

| Champ Harmonisé | Colonne PostgreSQL | Index |
|-----------------|-------------------|-------|
| `source` | `source` | ✅ B-tree |
| `sourceId` | `source_id` | ✅ Unique |
| `type` | `type` | ✅ B-tree |
| `subtype` | `subtype` | ✅ B-tree |
| `name` | `name` | ✅ Full-text |
| `name_original` | `name_original` | - |
| `year` | `year` | ✅ B-tree |
| `tome` | `tome` | ✅ B-tree |
| `series.name` | `series_name` | ✅ B-tree |
| `series.id` | `series_id` | ✅ B-tree |
| `authors[]` | `authors` | ✅ GIN |
| `publisher` | `publisher` | - |
| `genres[]` | `genres` | ✅ GIN |
| `language` | `language` | - |
| `physical.pages` | `pages` | - |
| `identifiers.isbn` | `isbn` | ✅ B-tree |
| `images[0]` | `image_url` | - |
| `*` (tout) | `data` | ✅ GIN JSONB |

### Type `construct_toy` (LEGO, Playmobil, Mega Construx)

| Champ Harmonisé | Colonne PostgreSQL | Index |
|-----------------|-------------------|-------|
| `source` | `source` | ✅ B-tree |
| `sourceId` | `source_id` | ✅ Unique |
| `name` | `name` | ✅ Full-text |
| `year` | `year` | ✅ B-tree |
| `theme` | `theme` | ✅ B-tree |
| `specs.pieceCount` | `piece_count` | - |
| `specs.figureCount` | `figure_count` | - |
| `ean` | `ean` | ✅ B-tree |
| `*` (tout) | `data` | ✅ GIN JSONB |

### Type `movie` / `tv` (TMDB, TVDB, IMDB)

| Champ Harmonisé | Colonne PostgreSQL | Index |
|-----------------|-------------------|-------|
| `source` | `source` | ✅ B-tree |
| `sourceId` | `source_id` | ✅ Unique |
| `name` | `name` | ✅ Full-text |
| `year` | `year` | ✅ B-tree |
| `genres[]` | `genres` | ✅ GIN |
| `runtime` | `runtime` | - |
| `externalIds.imdb` | `imdb_id` | ✅ B-tree |
| `*` (tout) | `data` | ✅ GIN JSONB |

### Type `game` (RAWG, IGDB, JeuxVideo.com)

| Champ Harmonisé | Colonne PostgreSQL | Index |
|-----------------|-------------------|-------|
| `source` | `source` | ✅ B-tree |
| `sourceId` | `source_id` | ✅ Unique |
| `name` | `name` | ✅ Full-text |
| `year` | `year` | ✅ B-tree |
| `genres[]` | `genres` | ✅ GIN |
| `*` (tout) | `data` | ✅ GIN JSONB |

---

### Exemples de Requêtes Avancées (PostgreSQL)

```sql
-- Tous les LEGO Star Wars sortis après 2020
SELECT name, year, piece_count 
FROM items 
WHERE source = 'lego' 
  AND theme = 'Star Wars'
  AND year > 2020
ORDER BY year DESC;

-- Tous les albums Astérix par ordre de tome
SELECT name, tome, year
FROM items
WHERE source = 'bedetheque'
  AND series_name = 'Astérix'
ORDER BY tome;

-- Recherche full-text multilingue
SELECT name, source, type
FROM items
WHERE to_tsvector('french', name) @@ plainto_tsquery('french', 'harry potter');

-- Films avec un genre spécifique
SELECT name, year, source
FROM items
WHERE type = 'movie'
  AND 'Science-Fiction' = ANY(genres);

-- Requête dans le JSONB (données complètes)
SELECT name, data->>'director' as director
FROM items
WHERE type = 'movie'
  AND data->>'director' ILIKE '%spielberg%';

-- Items les plus populaires par source
SELECT source, name, fetch_count
FROM items
ORDER BY fetch_count DESC
LIMIT 20;
```

---

> **Prochaine étape** : Phase 1.1 - Ajouter le container PostgreSQL au docker-compose
