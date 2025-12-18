# Toys API 🧸

> **v3.0.0** - Normalisation complète des données + Puppeteer Stealth + Protection VPN

API REST Docker pour rechercher et obtenir des informations produits depuis de multiples sources.

## 📦 Sources supportées

| Catégorie | Sources | Normalizer |
|-----------|---------|------------|
| **🧱 Jouets** | LEGO, Playmobil, Klickypedia, Mega Construx, Rebrickable | ✅ `construct_toy` |
| **🛒 Marketplace** | Amazon (FR, US, UK, DE, ES, IT, JP, CA) | ✅ `amazon` |
| **📚 Livres** | Google Books, OpenLibrary, Bedetheque, ComicVine | ✅ `book` |
| **🎮 Jeux vidéo** | RAWG, IGDB, JeuxVideo.com | ✅ `videogame` |
| **📺 Films** | TVDB, TMDB, IMDB | ✅ `movie` |
| **📺 Séries** | TVDB, TMDB, IMDB | ✅ `series` |
| **🎌 Anime** | Jikan | ✅ `anime` |
| **📖 Manga** | Jikan, MangaDex | ✅ `manga` |
| **🎵 Musique** | MusicBrainz, Deezer, iTunes, Discogs | ✅ `music_album` |
| **🎯 Collectibles** | Coleka, Lulu-Berlu, Transformerland | ✅ `collectible` |
| **🖼️ Stickers** | Paninimania | ✅ `stickers` |
| **🎮 Consoles** | ConsoleVariations | ✅ `console` |
| **🏷️ Barcode** | UPC, EAN, ISBN (auto-détection) | - |

## ✨ Fonctionnalités

- 🔍 Recherche multi-sources avec cache intelligent
- 🛡️ Contournement Cloudflare via FlareSolverr
- 🔐 Support clés API chiffrées (AES-256-GCM)
- 🛒 **Amazon** : Puppeteer Stealth avec protection VPN
- 🔒 **VPN intégré** : Gluetun + Kill switch + Rotation IP
- 🌍 **Traduction auto** : Plot + genres traduits (`autoTrad=1`)
- 🏷️ **Barcode** : Identification automatique UPC/EAN/ISBN
- 🌍 Multi-langues (fr-FR, en-US, de-DE, etc.)
- 📊 Métriques et monitoring intégrés
- 🔄 **Données normalisées** : Schémas unifiés par type (`*Normalized()`) 🆕

## 🚀 Démarrage Rapide

### Méthode simple (sans VPN)

```bash
docker pull nimai24/toys_api:latest

docker run -d \
  --name toys_api \
  -p 3000:3000 \
  -e FSR_URL=http://flaresolverr:8191/v1 \
  -e DEFAULT_LOCALE=fr-FR \
  nimai24/toys_api:latest
```

### Méthode recommandée (avec VPN) 🔒

Utiliser `docker-compose.portainer.yml` pour un déploiement complet avec protection VPN :

```
toys_api
  ├── Amazon → Puppeteer Stealth → Proxy VPN (gluetun:8888) → Internet
  └── Autres → FlareSolverr → VPN (gluetun:8191) → Internet
```

**Votre IP réelle n'est JAMAIS exposée** aux sites scrapés.

📥 **[docker-compose.portainer.yml](https://github.com/nimai24/toys_api)**

## ⚙️ Variables d'Environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3000` | Port d'écoute |
| `FSR_URL` | - | URL FlareSolverr (requis) |
| `DEFAULT_LOCALE` | `fr-FR` | Langue par défaut |
| `CACHE_TTL` | `300000` | Durée cache (ms) |
| `API_ENCRYPTION_KEY` | - | Clé chiffrement AES |
| `VPN_PROXY_URL` | - | Proxy HTTP gluetun pour Puppeteer (Amazon) |
| `PUPPETEER_USE_VPN` | `true` | Activer proxy VPN pour Puppeteer |
| `GLUETUN_CONTROL_URL` | - | Control gluetun (rotation IP) |
| `AUTO_TRAD_URL` | - | URL service auto_trad (traduction IMDB) |

## 🔌 Endpoints Principaux

### Sans clé API (gratuit)

| Service | Endpoints |
|---------|-----------|
| LEGO | `/lego/search`, `/lego/product/:id` |
| Amazon | `/amazon/search`, `/amazon/product/:asin`, `/amazon/barcode/:code`, `/amazon/compare/:asin` |
| Coleka | `/coleka/search`, `/coleka/item` |
| IMDB | `/imdb/search`, `/imdb/title/:id` |
| Jikan | `/jikan/anime/search`, `/jikan/manga/search` |
| MangaDex | `/mangadex/search`, `/mangadex/manga/:id` |
| Barcode | `/barcode/lookup/:code` |
| Deezer | `/deezer/search`, `/deezer/album/:id` |

### Avec clé API

| Service | Header | Obtenir la clé |
|---------|--------|----------------|
| RAWG | `X-RAWG-Key` | [rawg.io/apidocs](https://rawg.io/apidocs) |
| IGDB | `X-IGDB-Key` | [dev.twitch.tv](https://dev.twitch.tv/console/apps) |
| Rebrickable | `X-Rebrickable-Key` | [rebrickable.com/api](https://rebrickable.com/api/) |
| Google Books | `X-Google-Key` | [console.cloud.google.com](https://console.cloud.google.com) |
| TVDB | `X-TVDB-Key` | [thetvdb.com](https://thetvdb.com/api-information) |
| TMDB | `X-TMDB-Key` | [themoviedb.org](https://www.themoviedb.org/settings/api) |

## 📋 Exemples

### Recherche LEGO
```bash
curl "http://localhost:3000/lego/search?q=star+wars&lang=fr-FR&limit=5"
```

### Recherche Amazon
```bash
# Recherche simple
curl "http://localhost:3000/amazon/search?q=lego+star+wars&country=fr&max=10"

# Détails d'un produit par ASIN
curl "http://localhost:3000/amazon/product/B0DWDQ4YGR?country=fr"

# Recherche par code-barres
curl "http://localhost:3000/amazon/barcode/5702017421384?country=fr"

# Comparaison de prix multi-pays
curl "http://localhost:3000/amazon/compare/B07VGRJDFY?countries=fr,us,uk,de"

# Recherche multi-pays simultanée
curl "http://localhost:3000/amazon/multi-search?q=nintendo+switch&countries=fr,us,uk"
```

### Lookup Barcode
```bash
curl "http://localhost:3000/barcode/lookup/5702017421384"
```

### Recherche IMDB (avec traduction)
```bash
# Sans traduction (par défaut)
curl "http://localhost:3000/imdb/title/tt0076759?lang=fr-FR"

# Avec traduction automatique du plot + genres
curl "http://localhost:3000/imdb/title/tt0076759?lang=fr-FR&autoTrad=1"
# Réponse: genres: ["Action", "Aventure", "Fantastique", "Science-Fiction"]
```

### Recherche Jeux Vidéo
```bash
curl "http://localhost:3000/rawg/search?q=zelda" \
  -H "X-RAWG-Key: votre-clé"
```

## 🛡️ Protection VPN Amazon

Pour éviter les bans IP Amazon, utilisez un VPN dédié (gluetun) :

```
toys_api ──► gluetun (VPN) ──► Amazon
                  │
            Kill Switch
            IP Rotation (30 min)
```

| Endpoint | Description |
|----------|-------------|
| `GET /amazon/vpn/status` | Statut VPN et IP |
| `POST /amazon/vpn/rotate` | Forcer rotation IP |

## 📊 Monitoring

| Endpoint | Description |
|----------|-------------|
| `GET /health` | État de l'API |
| `GET /metrics` | Statistiques détaillées |
| `GET /cache/stats` | Stats du cache |

## 🔐 Chiffrement des Clés API

```bash
# Chiffrer une clé
curl -X POST http://localhost:3000/crypto/encrypt \
  -H "Content-Type: application/json" \
  -d '{"key": "votre-clé-api"}'

# Utiliser la clé chiffrée
curl "http://localhost:3000/rawg/search?q=zelda" \
  -H "X-Encrypted-Key: iv:authTag:data"
```

## 📝 Licence

MIT

---

### Changelog

#### v3.0.0 🆕
- 🔄 **Normalisation complète** : Schémas unifiés pour tous les types de données
  - 12 types normalisés : `construct_toy`, `book`, `movie`, `series`, `anime`, `manga`, `videogame`, `music_album`, `collectible`, `stickers`, `console`, `amazon`
  - Fonctions `*Normalized()` pour chaque provider
  - JSON schemas de référence dans `test/models/`
- 🧱 **Playmobil & Klickypedia** : Nouveaux providers jouets de construction
- 📖 **Bedetheque & ComicVine** : BD franco-belge et comics intégrés au type `book`
- 🎮 **JVC** : Provider jeux vidéo français avec normalisation
- 📊 Documentation technique complète dans `test/`

#### v2.4.0
- 🧱 Ajout providers Playmobil et Klickypedia
- 🔄 Amélioration du cache

#### v2.2.0
- 🥷 **Puppeteer Stealth** : Remplace FlareSolverr pour Amazon (anti-détection)
- 🔒 **Proxy VPN intégré** : Tout le trafic Amazon passe par le VPN
- 🛡️ **VPN Monitor** : Auto-restart + rotation IP automatique
- 🌍 **Traduction IMDB** : Plot traduit automatiquement via `autoTrad=1`
- 📦 **docker-compose.portainer.yml** : Stack complète avec VPN
- ✂️ Simplification : Plus besoin de FlareSolverr dédié Amazon

#### v2.1.0
- 🔄 **noCache/fresh** : Ignorer le cache sur n'importe quelle requête
- 🔌 Circuit breaker Amazon
- 🔁 Retry automatique avec rotation IP
- 🤖 **Amazon** : Retry automatique avec rotation IP si robot détecté

### Changelog v2.0.0
- 🏗️ Architecture modulaire (`lib/providers`, `lib/utils`, `routes/`)
- ✨ Middlewares de validation (`requireParam`, `requireApiKey`)
- 🔄 Cache unifié (Amazon migré vers cache global)
- 🛡️ Gestion d'erreurs centralisée (`asyncHandler`)

## 🔗 Liens

- **Documentation complète** : Voir README.md dans le repo
- **FlareSolverr** : [github.com/FlareSolverr/FlareSolverr](https://github.com/FlareSolverr/FlareSolverr)
