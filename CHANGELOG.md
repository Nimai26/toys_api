# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [4.0.0] - 2025-01-27

### ✨ Ajouté

#### Cache PostgreSQL persistant
- **Base de données locale** pour stocker les résultats d'API progressivement
- **PostgreSQL 16 Alpine** : Nouveau container pour le cache persistant
- **Modes de cache** : `hybrid` (défaut), `db_only`, `api_only`
- **TTL configurables** par provider (90j LEGO/BD, 30j livres, 7j films/jeux, 1j IMDB)

#### Infrastructure base de données
- `lib/database/connection.js` : Pool PostgreSQL avec auto-reconnexion
- `lib/database/migrations.js` : Création automatique des tables au démarrage
- `lib/database/repository.js` : Opérations CRUD avec logique de cache intelligente

#### Schéma de la base
- **Table `items`** : Stockage des fiches avec JSONB et champs dénormalisés
- **Table `searches`** : Historique des recherches pour statistiques
- **Table `series`** : Relations entre items d'une même série
- **Table `stats`** : Statistiques globales (hits, misses, etc.)
- **Index performants** : B-tree sur clés, GIN sur JSONB et full-text
- **Recherche full-text** : Support pg_trgm et unaccent pour le français

#### Endpoint `/health` amélioré
- Affichage du statut de la base de données
- Statistiques du pool de connexions
- Mode de cache actif

### 🔄 Modifié
- **docker-compose.yml** : Ajout du service `toys_api_postgres` avec healthcheck
- **index.js** : Initialisation de la base au démarrage, graceful shutdown
- **.env.example** : Nouvelles variables `TOY_API_DB_*` et `TOY_API_CACHE_MODE`
- **package.json** : Dépendance `pg` ^8.13.1

### 📝 Configuration

Nouvelles variables d'environnement :
```env
TOY_API_DB_ENABLED=true
TOY_API_DB_HOST=toys_api_postgres
TOY_API_DB_PORT=5432
TOY_API_DB_NAME=toys_api_cache
TOY_API_DB_USER=toys_api
TOY_API_DB_PASSWORD=<strong_password>
TOY_API_CACHE_MODE=hybrid  # hybrid, db_only, api_only
```

### 🚀 Migration depuis v3.x

1. Mettre à jour le docker-compose avec le nouveau service PostgreSQL
2. Ajouter les variables d'environnement `TOY_API_DB_*`
3. Les tables sont créées automatiquement au premier démarrage
4. Le mode `hybrid` permet de fonctionner même si la DB est indisponible

---

## [3.0.0] - 2025-01-21

### ✨ Ajouté

#### Système de normalisation complet
- **12 types de données normalisés** avec schémas JSON unifiés
- **Fonctions `*Normalized()`** pour chaque provider, retournant des données au format standardisé
- **Module centralisant** `lib/normalizers/index.js` exportant toutes les fonctions de normalisation
- **Schémas JSON de référence** dans `test/models/` pour chaque type

#### Types normalisés

| Type | Providers | Normalizer |
|------|-----------|------------|
| `construct_toy` | LEGO, Playmobil, Klickypedia, Mega, Rebrickable | ✅ |
| `book` | OpenLibrary, Google Books, Bedetheque, ComicVine | ✅ |
| `movie` | TMDB, IMDB, TVDB | ✅ |
| `series` | TMDB, IMDB, TVDB | ✅ |
| `anime` | Jikan (MyAnimeList) | ✅ |
| `manga` | Jikan (MyAnimeList) | ✅ |
| `videogame` | RAWG, IGDB, JVC | ✅ |
| `music_album` | MusicBrainz, Discogs, Deezer, iTunes | ✅ |
| `collectible` | Coleka, LuluBerlu, Transformerland | ✅ |
| `stickers` | Paninimania | ✅ |
| `console` | ConsoleVariations | ✅ |
| `amazon` | Amazon (8 marketplaces) | ✅ |

#### Nouveaux providers
- **Playmobil** : Recherche et détails des sets Playmobil officiels
- **Klickypedia** : Base de données communautaire Playmobil
- **Bedetheque** : BD franco-belge avec séries et albums
- **ComicVine** : Comics américains (Marvel, DC, etc.)
- **JVC** : Jeux vidéo avec fiches techniques françaises

#### Documentation technique
- `test/*-providers.txt` : Documentation des champs retournés par chaque provider
- `test/*-HARMONIZED.md` : Schémas harmonisés et mapping des champs
- `test/models/*.json` : Schémas JSON formels pour validation
- `test/PROCESS.md` : Suivi du processus de normalisation

### 🔄 Modifié
- **Tous les providers** : Ajout de fonctions `*Normalized()` wrapper
- **index.js** : Export des nouvelles fonctions normalisées
- **README.md** : Mise à jour v3.0.0 avec documentation normalisation
- **README-dockerhub.md** : Changelog et table des sources mise à jour

### 📝 Migration depuis v2.x

Les anciennes fonctions restent disponibles et inchangées. Pour utiliser les données normalisées :

```javascript
// Avant (v2.x) - Données brutes du provider
const result = await searchLego('Star Wars');

// Après (v3.0) - Données normalisées
const result = await searchLegoNormalized('Star Wars');
// Retourne { items: [...], metadata: {...} } avec schéma unifié
```

---

## [2.4.0] - 2025-01-15

### ✨ Ajouté
- **Playmobil provider** : Recherche sur le site officiel
- **Klickypedia provider** : Base communautaire Playmobil

### 🔄 Modifié
- Amélioration du système de cache

---

## [2.2.0] - 2025-01-10

### ✨ Ajouté
- **Puppeteer Stealth** : Remplacement de FlareSolverr pour Amazon
- **Proxy VPN intégré** : Tout le trafic Amazon passe par VPN
- **VPN Monitor** : Auto-restart et rotation IP automatique
- **Traduction IMDB** : Plot traduit via `autoTrad=1`

### 🗑️ Supprimé
- Dépendance à FlareSolverr pour Amazon (remplacé par Puppeteer Stealth)

---

## [2.1.0] - 2025-01-05

### ✨ Ajouté
- **Paramètre `noCache/fresh`** : Ignorer le cache sur n'importe quelle requête
- **Circuit breaker Amazon** : Protection contre les surcharges
- **Retry automatique** : Rotation IP si détection robot

---

## [2.0.0] - 2024-12-20

### ✨ Ajouté
- **Architecture modulaire** : Réorganisation en `lib/providers`, `lib/utils`, `routes/`
- **Middlewares de validation** : `requireParam`, `requireApiKey`
- **Cache unifié** : Système de cache global pour tous les providers
- **Gestion d'erreurs centralisée** : `asyncHandler` wrapper

### 🔄 Modifié
- Migration du cache Amazon vers le système global
- Refactoring complet de la structure du projet

---

## [1.x.x] - Versions antérieures

Versions initiales avec providers de base :
- LEGO (BrickSet, Rebrickable)
- TMDB, IMDB, TVDB
- Amazon (multi-pays)
- Jikan, RAWG, IGDB
- MusicBrainz, Discogs, Deezer, iTunes
- Coleka, LuluBerlu
- Et autres...
