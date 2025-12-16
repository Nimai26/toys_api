# Toys API 🧸

> **v2.1.0** - Cache bypass & retry automatique Amazon

API REST Docker pour rechercher et obtenir des informations produits depuis de multiples sources.

## 📦 Sources supportées

| Catégorie | Sources |
|-----------|---------|
| **🧱 Jouets** | LEGO, Mega Construx, Rebrickable |
| **🛒 Marketplace** | Amazon (FR, US, UK, DE, ES, IT, JP, CA) 🆕 |
| **📚 Livres** | Google Books, OpenLibrary |
| **🎮 Jeux vidéo** | RAWG, IGDB, JeuxVideo.com |
| **📺 Films/Séries** | TVDB, TMDB, IMDB |
| **🎌 Anime/Manga** | Jikan, MangaDex |
| **📖 BD/Comics** | Comic Vine, Bedetheque |
| **🎵 Musique** | MusicBrainz, Deezer, iTunes, Discogs |
| **🎯 Collectibles** | Coleka, Lulu-Berlu, Transformerland, ConsoleVariations |
| **🏷️ Barcode** | UPC, EAN, ISBN (auto-détection) |

## ✨ Fonctionnalités

- 🔍 Recherche multi-sources avec cache intelligent
- 🛡️ Contournement Cloudflare via FlareSolverr
- 🔐 Support clés API chiffrées (AES-256-GCM)
- 🛒 **Amazon** : Scraping multi-pays avec protection VPN
- 🏷️ **Barcode** : Identification automatique UPC/EAN/ISBN
- 🌍 Multi-langues (fr-FR, en-US, de-DE, etc.)
- 📊 Métriques et monitoring intégrés

## 🚀 Démarrage Rapide

```bash
docker pull nimai24/toys_api:latest

docker run -d \
  --name toys_api \
  -p 3000:3000 \
  -e FSR_URL=http://flaresolverr:8191/v1 \
  -e DEFAULT_LOCALE=fr-FR \
  nimai24/toys_api:latest
```

## ⚙️ Variables d'Environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3000` | Port d'écoute |
| `FSR_URL` | - | URL FlareSolverr (requis) |
| `DEFAULT_LOCALE` | `fr-FR` | Langue par défaut |
| `CACHE_TTL` | `300000` | Durée cache (ms) |
| `API_ENCRYPTION_KEY` | - | Clé chiffrement AES |
| `FSR_AMAZON_URL` | - | FlareSolverr dédié Amazon (VPN) |
| `GLUETUN_CONTROL_URL` | - | Control gluetun (VPN) |

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

### Changelog v2.1.0
- 🔄 **noCache/fresh** : Ignorer le cache sur n'importe quelle requête
- 🤖 **Amazon** : Retry automatique avec rotation IP si robot détecté

### Changelog v2.0.0
- 🏗️ Architecture modulaire (`lib/providers`, `lib/utils`, `routes/`)
- ✨ Middlewares de validation (`requireParam`, `requireApiKey`)
- 🔄 Cache unifié (Amazon migré vers cache global)
- 🛡️ Gestion d'erreurs centralisée (`asyncHandler`)

## 🔗 Liens

- **Documentation complète** : Voir README.md dans le repo
- **FlareSolverr** : [github.com/FlareSolverr/FlareSolverr](https://github.com/FlareSolverr/FlareSolverr)
