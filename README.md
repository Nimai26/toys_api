# Toys API 🧸

> **Version 3.1.1** - Fix sessions FlareSolverr + mapping collectibles

A Docker-based REST API to search and retrieve product information from multiple sources:
- **LEGO** - Official LEGO website (lego.com)
- **Playmobil** - Official Playmobil website (playmobil.com) 🆕
- **Klickypedia** - Playmobil encyclopedia with translations (klickypedia.com) 🆕
- **Mega Construx** - Mattel building blocks (shop.mattel.com)
- **Rebrickable** - LEGO sets database with parts & minifigs (rebrickable.com) 🔑
- **Google Books** - Books search & details (books.google.com) 🔑
- **OpenLibrary** - Open books database (openlibrary.org)
- **RAWG** - Video games database (rawg.io) 🔑
- **IGDB** - Internet Game Database powered by Twitch (igdb.com) 🔑
- **TVDB** - TV series & movies database (thetvdb.com) 🔑
- **TMDB** - Movies & TV shows database (themoviedb.org) 🔑
- **IMDB** - Movies & TV database via imdbapi.dev (imdb.com) 🆓
- **Jikan** - Anime & Manga database via MyAnimeList (myanimelist.net) 🆓
- **Comic Vine** - Comics database (comicvine.gamespot.com) 🔑
- **MangaDex** - Manga database (mangadex.org) 🆓
- **Bedetheque** - BD franco-belge (bedetheque.com) 🇫🇷
- **JeuxVideo.com** - French video game database (jeuxvideo.com) 🇫🇷
- **ConsoleVariations** - Console & accessories database (consolevariations.com) 🆕
- **Amazon** - Multi-country marketplace scraper (FR, US, UK, DE, ES, IT, JP, CA) 🆕🛒
- **Coleka** - Collectibles database (coleka.com)
- **Lulu-Berlu** - Vintage toys shop (lulu-berlu.com)
- **Transformerland** - Vintage Transformers store (transformerland.com)
- **Paninimania** - Sticker albums database (paninimania.com) 🇫🇷
- **Barcode** - Universal barcode identification (UPC, EAN, ISBN) 🆕
- **Music** - Album search (MusicBrainz, Deezer, iTunes, Discogs) 🆕

This API uses FlareSolverr to bypass Cloudflare/anti-bot protection and provides product search, details, pricing, and availability data.

### ✨ Features

- 🔍 Multi-source product search (LEGO, Playmobil, Mega Construx, Rebrickable, Google Books, OpenLibrary, RAWG, IGDB, TVDB, TMDB, IMDB, Jikan, ConsoleVariations, Coleka, Lulu-Berlu, Transformerland, Paninimania)
- 🛒 **Amazon scraper** - Multi-country search (FR, US, UK, DE, ES, IT, JP, CA), price comparison, barcode lookup
- 🧱 **Mega Construx search** multi-language (fr-FR, en-US, de-DE, etc.) with instructions
- 🎮 **ConsoleVariations** - Console variations, bundles & accessories database (11K+ collectibles)
- 📚 **Books search** via Google Books & OpenLibrary (ISBN or text)
- 🎮 **Video games search** via RAWG & IGDB (500K+ games)
- 📺 **TV series & movies search** via TVDB, TMDB & IMDB (millions of entries)
- 🎌 **Anime & Manga search** via Jikan/MyAnimeList (70K+ anime, 150K+ manga)
- 📖 **Comics & BD** via Comic Vine, MangaDex & Bedetheque
- 🏷️ **Barcode identification** - Auto-detect UPC, EAN, ISBN with product lookup
- 🎵 **Music album search** via MusicBrainz, Deezer, iTunes, Discogs
- 🆓 **IMDB, Jikan, MangaDex without API key** - Free access
- 🔗 **LEGO ↔ Rebrickable cross-enrichment** (parts, minifigs, instructions)
- 📦 Detailed product information (price, availability, images, etc.)
- 🔐 **Encrypted API key support** (AES-256-GCM) for secure API key transmission
- 🚀 **In-memory caching** with configurable TTL (default: 5 minutes)
- 🗜️ **Gzip compression** for faster responses
- 🌐 **CORS enabled** for cross-origin requests
- 📊 **Built-in metrics** and monitoring endpoints
- 🛡️ **Security headers** (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- 🔄 **Graceful shutdown** support
- 🌍 Multi-locale support (fr-FR, en-US, de-DE, etc.)
- 🔄 **Normalized API responses** (`*Normalized()` functions) for unified data format
- 🛤️ **Normalized routes** : `/search`, `/details`, `/code` for all providers 🆕

---


## 🇫🇷 Français

### Description

**Toys API** est une API Node.js légère qui permet de :
- 🔍 Rechercher des produits LEGO par nom ou mot-clé
- 📦 Obtenir les informations détaillées d'un produit (prix, disponibilité, nombre de pièces, etc.)
- 🧱 Rechercher sur Rebrickable pour les sets, pièces, minifigs, thèmes et couleurs (clé API requise)
- 🔗 **Interconnexion LEGO ↔ Rebrickable** (enrichissement croisé avec pièces, minifigs, instructions)
- 🧱 **Mega Construx** - Recherche multi-langue avec instructions de montage 🆕
- 📚 **Recherche de livres** via Google Books & OpenLibrary (ISBN ou texte)
- 🎮 **Recherche de jeux vidéo** via RAWG, IGDB & JeuxVideo.com (500 000+ jeux)
- 📺 **Recherche de séries TV & films** via TVDB, TMDB & IMDB (millions d'entrées)
- 🎌 **Recherche d'anime & manga** via Jikan/MyAnimeList (70 000+ anime, 150 000+ manga)
- 📖 **Comics & BD** via Comic Vine, MangaDex & Bedetheque
- 🎮 **ConsoleVariations** - Base de données de variations de consoles et accessoires (11 000+ collectibles) 🆕
- 🏷️ **Identification de codes-barres** - Auto-détection UPC, EAN, ISBN avec recherche produit 🆕
- 🎵 **Recherche d'albums musicaux** via MusicBrainz, Deezer, iTunes, Discogs 🆕
- 🆓 **IMDB, Jikan, MangaDex sans clé API** - Accès gratuit
- 🎯 Rechercher dans la base de données Coleka (collectibles)
- 🎮 Rechercher dans la boutique Lulu-Berlu (jouets vintage)
- 🤖 Rechercher dans la boutique Transformerland (Transformers vintage)
- 🏆 Rechercher dans la base Paninimania (albums d'autocollants)
- 🌍 Support multi-langues (fr-FR, en-US, de-DE, etc.)
- 🛡️ Contournement de la protection Cloudflare via FlareSolverr
- 🔐 **Support des clés API chiffrées** (AES-256-GCM) pour transmission sécurisée

### Prérequis

- Docker
- [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr) en cours d'exécution et accessible

### Démarrage Rapide

```bash
docker pull nimai24/toys_api:latest

docker run -d \
  --name toys_api \
  -p 3000:3000 \
  -e FSR_URL=http://votre-flaresolverr:8191/v1 \
  -e DEFAULT_LOCALE=fr-FR \
  -e API_ENCRYPTION_KEY=votre-clé-secrète \
  nimai24/toys_api:latest
```

### Variables d'Environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3000` | Port d'écoute de l'API |
| `FSR_URL` | `http://10.110.1.1:8191/v1` | URL de l'endpoint FlareSolverr |
| `DEFAULT_LOCALE` | `fr-FR` | Langue/région par défaut |
| `MAX_RETRIES` | `3` | Nombre max de tentatives en cas d'échec |
| `CACHE_TTL` | `300000` | Durée du cache en ms (5 min) |
| `CACHE_MAX_SIZE` | `100` | Nombre max d'entrées en cache |
| `USER_AGENT` | Chrome UA | User-Agent personnalisé |
| `API_ENCRYPTION_KEY` | - | Clé secrète pour chiffrement des clés API (AES-256-GCM) |
| `LOG_LEVEL` | `info` | Niveau de log (debug, info, warn, error) |
| `VPN_PROXY_URL` | - | Proxy HTTP gluetun pour Puppeteer (ex: `http://gluetun-toys:8888`) |
| `PUPPETEER_USE_VPN` | `true` | Activer le proxy VPN pour Puppeteer (Amazon) |
| `GLUETUN_CONTROL_URL` | - | URL du control server gluetun pour rotation IP |
| `AUTO_TRAD_URL` | - | URL du service auto_trad pour traduction (ex: `http://auto_trad:3255`) |

### 🌍 Traduction automatique

Pour de nombreuses sources, le synopsis/description et les genres sont souvent en anglais. Vous pouvez activer la traduction automatique via le paramètre `autoTrad=1` :

#### Sources supportées

| Source | Champs traduits | Dictionnaire genres |
|--------|-----------------|---------------------|
| **IMDB** | `plot`, `genres` | media |
| **TVDB** | `synopsis`, `genres` | media |
| **TMDB** | `synopsis`, `genres` | media |
| **Jikan** | `synopsis`, `genres` | media |
| **MangaDex** | `synopsis`, `tags` | media |
| **Comic Vine** | `synopsis` | - |
| **Google Books** | `synopsis`, `genres` | book |
| **IGDB** | `summary`, `genres` | videogame |
| **RAWG** | `description`, `genres` | videogame |
| **Mega Construx** | `description` | - |
| **ConsoleVariations** | `name` | - |
| **Transformerland** | `name`, `description` | - |

#### Exemple d'utilisation

```bash
# Sans traduction (par défaut)
curl "http://localhost:3000/imdb/title/tt0076759?lang=fr-FR"

# Avec traduction automatique du plot et des genres
curl "http://localhost:3000/imdb/title/tt0076759?lang=fr-FR&autoTrad=1"

# Google Books avec traduction
curl "http://localhost:3000/googlebooks/book/ABC123?lang=fr&autoTrad=1" -H "X-Api-Key: VOTRE_CLE"

# IGDB avec traduction
curl "http://localhost:3000/igdb/game/123?lang=fr&autoTrad=1" -H "X-Api-Key: clientId:clientSecret"
```

**Réponse avec `autoTrad=1` :**
```json
{
  "title": "Star Wars: Episode IV - A New Hope",
  "plot": "Luke Skywalker rejoint des forces rebelles...",
  "plotOriginal": "Luke Skywalker joins rebel forces...",
  "plotTranslated": "Luke Skywalker rejoint des forces rebelles...",
  "genres": ["Action", "Aventure", "Fantastique", "Science-Fiction"],
  "genresOriginal": ["Action", "Adventure", "Fantasy", "Sci-Fi"],
  "genresTranslated": ["Action", "Aventure", "Fantastique", "Science-Fiction"]
}
```

| Champ | Description |
|-------|-------------|
| `plot`/`synopsis`/`description` | Texte traduit (ou original si échec) |
| `*Original` | Texte original (toujours présent) |
| `*Translated` | Texte traduit (null si non traduit) |
| `genres` | Genres traduits |
| `genresOriginal` | Genres originaux (si traduits) |
| `genresTranslated` | Genres traduits (null si non traduits) |

**Langues supportées pour les genres :** `fr`, `de`, `es`, `it`, `pt`

⚠️ **Prérequis** : Définir `AUTO_TRAD_URL` pointant vers le service auto_trad (pour la traduction des textes longs).

### 🔁 Bypass du Cache

Pour forcer une requête fraîche (ignorer le cache), ajoutez un des paramètres suivants :

```bash
# Via query parameter
curl "http://localhost:3000/lego/search?q=star&noCache"
curl "http://localhost:3000/lego/search?q=star&fresh"

# Via header HTTP
curl -H "X-No-Cache: 1" "http://localhost:3000/lego/search?q=star"
curl -H "Cache-Control: no-cache" "http://localhost:3000/lego/search?q=star"
```

| Paramètre | Description |
|-----------|-------------|
| `noCache` | Ignorer le cache pour cette requête |
| `fresh` | Alias de noCache |
| `X-No-Cache` header | Header HTTP alternatif |
| `Cache-Control: no-cache` | Header HTTP standard |

### �🛡️ Protection VPN Amazon (Optionnel)

Pour éviter les bans IP lors du scraping Amazon, vous pouvez utiliser un VPN dédié :

#### Architecture VPN v2.2.0

```
┌─────────────────┐                              ┌─────────────────┐
│   toys_api      │                              │   Sites Web     │
│                 │                              │                 │
│  ┌───────────┐  │     ┌──────────────────┐     │  Amazon.fr/com  │
│  │ Puppeteer │──┼────▶│ Proxy HTTP :8888 │────▶│                 │
│  │ Stealth   │  │     │                  │     │  Coleka, JVC,   │
│  └───────────┘  │     │   gluetun-toys   │     │  LEGO, etc.     │
│                 │     │      (VPN)       │     │                 │
│  ┌───────────┐  │     │                  │     │                 │
│  │FlareSolverr│─┼────▶│ FSR :8191        │────▶│                 │
│  └───────────┘  │     └──────────────────┘     └─────────────────┘
└─────────────────┘            │
                         Kill Switch
                         IP Rotation (30 min)
```

#### Fonctionnalités VPN

| Fonction | Description |
|----------|-------------|
| **Kill Switch** | Bloque TOUTES les requêtes Amazon si le VPN tombe |
| **Vérification IP** | Vérifie que l'IP VPN ≠ IP hôte avant chaque requête |
| **Rotation automatique** | Change d'IP toutes les 30 minutes |
| **Rotation manuelle** | `POST /amazon/vpn/rotate` |

#### Endpoints VPN

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/amazon/vpn/status` | GET | Statut VPN (actif/inactif, IP actuelle) |
| `/amazon/vpn/rotate` | POST | Force une rotation d'IP |

#### Exemple de réponse `/amazon/vpn/status`

```json
{
  "vpnActive": true,
  "vpnIp": "156.146.63.147",
  "error": null,
  "message": "VPN actif - IP: 156.146.63.147 (France)"
}
```

#### Configuration avec Gluetun (Private Internet Access)

Variables d'environnement requises dans votre stack :

```yaml
environment:
  # FlareSolverr via VPN (tous les providers)
  - FSR_URL=http://gluetun-toys:8191/v1
  # Proxy VPN pour Puppeteer Stealth (Amazon)
  - VPN_PROXY_URL=http://gluetun-toys:8888
  - PUPPETEER_USE_VPN=true
  # Control gluetun pour rotation IP
  - GLUETUN_CONTROL_URL=http://gluetun-toys:8000
```

Voir [portainer-stack.yml](portainer-stack.yml) pour un exemple complet avec gluetun + kill switch + vpn-monitor.

---

#### Services sans clé API requise

Ces services fonctionnent **sans authentification** :

| Service | Endpoints |
|---------|-----------|
| LEGO | `/lego/search`, `/lego/product/:id`, `/lego/instructions/:id` |
| Playmobil 🆕 | `/playmobil/search`, `/playmobil/product/:id`, `/playmobil/instructions/:id` |
| Klickypedia 🆕 | `/klickypedia/search`, `/klickypedia/product/:id`, `/klickypedia/set/:slug` |
| Mega Construx | `/mega/search`, `/mega/product/:id`, `/mega/instructions/:sku` |
| Coleka | `/coleka/search`, `/coleka/item` |
| Lulu-Berlu | `/luluberlu/search`, `/luluberlu/item/:id` |
| Transformerland | `/transformerland/search`, `/transformerland/item` |
| Paninimania | `/paninimania/search`, `/paninimania/album/:id` |
| JVC | `/jvc/search`, `/jvc/game/:id` |
| ConsoleVariations | `/consolevariations/search`, `/consolevariations/item/:slug`, `/consolevariations/platforms`, `/consolevariations/browse/:platform` |
| IMDB | `/imdb/search`, `/imdb/title/:id` |
| Jikan | `/jikan/anime/search`, `/jikan/manga/search` |
| MangaDex | `/mangadex/search`, `/mangadex/manga/:id` |
| Bedetheque | `/bedetheque/search`, `/bedetheque/album/:id` |
| OpenLibrary | `/openlibrary/search`, `/openlibrary/book/:id` |
| MusicBrainz | `/music/search` |
| Deezer | `/deezer/search`, `/deezer/album/:id` |
| Barcode | `/barcode/lookup/:code` |

#### Obtenir les clés API

| Service | URL d'inscription | Gratuit |
|---------|-------------------|---------|
| RAWG | [rawg.io/apidocs](https://rawg.io/apidocs) | ✅ |
| IGDB | [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) | ✅ |
| Rebrickable | [rebrickable.com/api](https://rebrickable.com/api/) | ✅ |
| Google Books | [console.cloud.google.com](https://console.cloud.google.com/apis/library/books.googleapis.com) | ✅ |
| TVDB | [thetvdb.com/api-information](https://thetvdb.com/api-information) | ✅ |
| TMDB | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | ✅ |
| Comic Vine | [comicvine.gamespot.com/api](https://comicvine.gamespot.com/api/) | ✅ |
| Discogs | [discogs.com/settings/developers](https://www.discogs.com/settings/developers) | ✅ |

#### 🔧 Endpoints Crypto (utilitaires)

Ces endpoints permettent de chiffrer et vérifier vos clés API.

##### Chiffrer une clé API
```bash
POST /crypto/encrypt
Content-Type: application/json

{"key": "votre-clé-api"}
```

Pour IGDB (Twitch), utilisez le format `clientId:clientSecret` :
```bash
POST /crypto/encrypt
Content-Type: application/json

{"key": "abc123:xyz789"}
```

**Réponse :**
```json
{
  "encrypted": "iv:authTag:encryptedData",
  "usage": "curl -H \"X-Encrypted-Key: iv:authTag:encryptedData\" ...",
  "curl_example": "curl -H \"X-Encrypted-Key: ...\" \"http://localhost:3000/rawg/search?q=zelda\""
}
```

##### Vérifier une clé chiffrée
```bash
POST /crypto/verify
Content-Type: application/json

{"encrypted": "iv:authTag:encryptedData"}
```

**Réponse :**
```json
{
  "valid": true,
  "keyLength": 32,
  "keyPreview": "abc1...xyz9"
}
```

### Endpoints de l'API

#### 🧱 Endpoints LEGO

##### Rechercher des Produits
```bash
GET /lego/search?q=millennium+falcon&lang=fr-FR&max=10
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `lang` | `fr-FR` | Langue (fr-FR, en-US, de-DE, etc.) |
| `max` | `24` | Nombre maximum de résultats (1-100) |
| `limit` | `24` | Alias pour `max` |

**Réponse :**
```json
{
  "products": [
    {
      "id": "75192",
      "productCode": "75192",
      "name": "Millennium Falcon™",
      "slug": "millennium-falcon-75192",
      "thumb": "https://...",
      "variant": {
        "price": { "formattedAmount": "849,99 €" },
        "attributes": { "pieceCount": 7541 }
      }
    }
  ],
  "total": 1
}
```

##### Obtenir les Détails d'un Produit
```bash
GET /lego/product/75192?lang=fr-FR
```

##### Obtenir les Instructions de Montage
```bash
GET /lego/instructions/75192?lang=fr-FR
```

##### Enrichir un Produit avec Rebrickable
```bash
GET /lego/product/75192?lang=fr-FR&enrich=true
X-Api-Key: votre-clé-rebrickable
```

Ajoute les données Rebrickable au produit LEGO : pièces, minifigs, instructions alternatives.

#### 🎭 Endpoints Playmobil 🆕

##### Rechercher des Produits
```bash
GET /playmobil/search?q=asterix&lang=fr-FR&max=10
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `lang` | `fr-FR` | Langue (fr-FR, en-US, de-DE, es-ES, it-IT, etc.) |
| `max` | `24` | Nombre maximum de résultats (1-100) |

**Réponse :**
```json
{
  "products": [
    {
      "id": "71148",
      "productCode": "71148",
      "url": "https://www.playmobil.com/fr-fr/asterix-la-pyramide-du-pharaon/71148.html",
      "thumb": "https://media.playmobil.com/i/playmobil/71148_product_detail?w=200&...",
      "baseImgUrl": "https://media.playmobil.com/i/playmobil/71148_product_detail?w=512&..."
    }
  ],
  "total": 5,
  "count": 5,
  "source": "playmobil"
}
```

##### Obtenir les Détails d'un Produit
```bash
GET /playmobil/product/71148?lang=fr-FR
```

**Réponse :**
```json
{
  "id": "71148",
  "productCode": "71148",
  "name": "Astérix : La Pyramide du Pharaon",
  "description": "Set PLAYMOBIL Astérix – La Pyramide du Pharaon, 93 pièces...",
  "price": 129.99,
  "currency": "EUR",
  "attributes": {
    "pieceCount": 93,
    "ageRange": "3+"
  },
  "images": [
    "https://media.playmobil.com/i/playmobil/71148_product_detail",
    "https://media.playmobil.com/i/playmobil/71148_product_box_front"
  ],
  "instructions": "https://playmobil.a.bigcontent.io/v1/static/71148_buildinginstruction",
  "brand": "Playmobil",
  "source": "playmobil"
}
```

##### Obtenir les Instructions de Montage
```bash
GET /playmobil/product/71148/instructions
# ou
GET /playmobil/instructions/71148
```

##### Rechercher des Instructions
```bash
GET /playmobil/instructions/search?q=asterix&lang=fr-FR
```

Retourne une liste d'instructions disponibles pour la recherche.

#### 📚 Endpoints Klickypedia 🆕

Klickypedia est une encyclopédie Playmobil communautaire avec des noms traduits en plusieurs langues.

##### Rechercher des Sets
```bash
GET /klickypedia/search?q=asterix&lang=fr&max=10
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `lang` | `fr` | Langue (fr, es, de, en) |
| `max` | `24` | Nombre maximum de résultats (1-100) |
| `translate` | - | Langue cible pour traduction auto |

**Réponse :**
```json
{
  "products": [
    {
      "id": "71148",
      "productCode": "71148",
      "name": "pyramide astérix",
      "fullName": "71148 - pyramide astérix",
      "slug": "71148-asterix-pyramid",
      "url": "https://www.klickypedia.com/sets/71148-asterix-pyramid/",
      "thumb": "https://www.klickypedia.com/wp-content/uploads/2023/10/fcddfed.png",
      "released": 2023,
      "discontinued": null
    }
  ],
  "total": 5,
  "source": "klickypedia"
}
```

##### Obtenir les Détails d'un Set
```bash
GET /klickypedia/product/71148?lang=fr
```

**Réponse :**
```json
{
  "id": "71148",
  "name": "pyramide astérix",
  "translations": {
    "en": "asterix pyramid",
    "es": "pirámide de astérix",
    "de": "Asterix: Pyramide des Pharao",
    "fr": "pyramide astérix"
  },
  "description": "Thème: Asterix\nFormat: Standard Box\nFigurines: 5\nSortie: 2023",
  "attributes": {
    "figureCount": 5,
    "theme": "Asterix",
    "format": "Standard Box",
    "tags": ["animaux domestiques", "antiquité", "aventuriers"]
  },
  "availability": {
    "status": "unknown",
    "released": 2023,
    "discontinued": null
  },
  "images": ["https://www.klickypedia.com/wp-content/uploads/2023/10/fcddfed.png"],
  "brand": "Playmobil",
  "source": "klickypedia"
}
```

##### Obtenir par Slug
```bash
GET /klickypedia/set/71148-asterix-pyramid?lang=de
```

#### 🧱 Endpoints Rebrickable

> 🔑 **Clé API requise** - Obtenez votre clé sur [rebrickable.com/api](https://rebrickable.com/api/)

##### Rechercher des Sets
```bash
GET /rebrickable/search?q=millennium+falcon&max=10
X-Api-Key: votre-clé-rebrickable
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `max` | `20` | Nombre maximum de résultats (1-1000) |
| `theme_id` | - | Filtrer par ID de thème |
| `min_year` | - | Année minimum |
| `max_year` | - | Année maximum |
| `min_parts` | - | Nombre minimum de pièces |
| `max_parts` | - | Nombre maximum de pièces |

##### Obtenir les Détails d'un Set
```bash
GET /rebrickable/set/75192-1
X-Api-Key: votre-clé-rebrickable
```

##### Obtenir les Pièces d'un Set
```bash
GET /rebrickable/set/75192-1/parts?max=50
X-Api-Key: votre-clé-rebrickable
```

##### Obtenir les Minifigs d'un Set
```bash
GET /rebrickable/set/75192-1/minifigs
X-Api-Key: votre-clé-rebrickable
```

##### Enrichir un Set avec les Données LEGO Officielles
```bash
GET /rebrickable/set/75192-1?enrich=true&lang=fr-FR
X-Api-Key: votre-clé-rebrickable
```

Ajoute les données LEGO officielles : prix, disponibilité, thème, images HD.

##### Lister les Thèmes
```bash
GET /rebrickable/themes
X-Api-Key: votre-clé-rebrickable
```

##### Lister les Couleurs
```bash
GET /rebrickable/colors
X-Api-Key: votre-clé-rebrickable
```

##### Rechercher une Pièce
```bash
GET /rebrickable/part/3001
X-Api-Key: votre-clé-rebrickable
```

##### Rechercher une Minifig
```bash
GET /rebrickable/minifig/fig-000001
X-Api-Key: votre-clé-rebrickable
```

#### 📚 Endpoints Google Books

> 🔑 **Clé API requise** - Obtenez votre clé sur [Google Cloud Console](https://console.cloud.google.com/apis/library/books.googleapis.com)

##### Rechercher des Livres
```bash
GET /googlebooks/search?q=harry+potter&lang=fr&max=10
X-Api-Key: votre-clé-google
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche (texte ou ISBN) |
| `lang` | - | Code langue (fr, en, de, es...) |
| `max` | `10` | Nombre maximum de résultats (1-40) |

##### Rechercher par ISBN
```bash
GET /googlebooks/isbn/9782070584628
X-Api-Key: votre-clé-google
```

Supporte ISBN-10 et ISBN-13. Conversion automatique.

**Exemple de réponse (Format Harmonisé) :**
```json
{
  "source": "googlebooks",
  "query": "harry potter",
  "language": "fr",
  "total": 3,
  "books": [
    {
      "id": "iFZbPVaknBMC",
      "type": "book",
      "title": "Harry Potter à l'école des sorciers",
      "originalTitle": null,
      "authors": ["J.K. Rowling"],
      "editors": ["Gallimard Jeunesse"],
      "releaseDate": "2015-12-03",
      "genres": ["Juvenile Fiction"],
      "pages": 320,
      "serie": null,
      "synopsis": "Le jour de ses onze ans...",
      "language": "fr",
      "tome": null,
      "image": [
        "https://books.google.com/books/content?id=iFZbPVaknBMC&printsec=frontcover&img=1&zoom=1"
      ],
      "isbn": "9782070584628",
      "price": null,
      "url": "https://books.google.fr/books?id=iFZbPVaknBMC",
      "source": "googlebooks"
    }
  ]
}
```

> 📖 **Voir aussi :** [Format Harmonisé Livres](#-format-harmonisé-livres) pour la structure complète des champs.

#### 📖 Endpoints OpenLibrary

> ✅ **Pas de clé API requise** - OpenLibrary est gratuit et ouvert

##### Rechercher des Livres
```bash
GET /openlibrary/search?q=dune+frank+herbert&lang=en&max=10
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche (texte ou ISBN) |
| `lang` | - | Code langue (fr→fre, en→eng, de→ger...) |
| `max` | `10` | Nombre maximum de résultats (1-100) |

##### Rechercher par ISBN
```bash
GET /openlibrary/isbn/9780441172719
```

##### Obtenir les Détails d'une Œuvre
```bash
GET /openlibrary/book/OL893415W
```

**Exemple de réponse (Format Harmonisé) :**
```json
{
  "source": "openlibrary",
  "query": "dune frank herbert",
  "type": "text",
  "totalItems": 158,
  "count": 3,
  "books": [
    {
      "id": "OL893415W",
      "type": "book",
      "title": "Dune",
      "originalTitle": null,
      "authors": ["Frank Herbert"],
      "editors": ["Ace Books", "Chilton Books"],
      "releaseDate": "1965",
      "genres": ["Science fiction", "Ecology", "Fiction"],
      "pages": null,
      "serie": null,
      "synopsis": null,
      "language": "eng",
      "tome": null,
      "image": [
        "https://covers.openlibrary.org/b/id/8769371-L.jpg",
        "https://covers.openlibrary.org/b/id/8769371-M.jpg",
        "https://covers.openlibrary.org/b/id/8769371-S.jpg"
      ],
      "isbn": "9780441172719",
      "price": null,
      "url": "https://openlibrary.org/works/OL893415W",
      "source": "openlibrary"
    }
  ]
}
```

> 📖 **Format Harmonisé :** Les endpoints `/openlibrary/search`, `/openlibrary/book/:olId` et `/openlibrary/isbn/:isbn` utilisent le [Format Harmonisé Livres](#-format-harmonisé-livres).

#### 🎮 Endpoints RAWG (Jeux Vidéo)

> 🔑 **Clé API requise** - Obtenez votre clé gratuite sur [rawg.io/apidocs](https://rawg.io/apidocs)

RAWG est la plus grande base de données de jeux vidéo avec plus de 500 000 jeux.

##### Rechercher des Jeux
```bash
GET /rawg/search?q=zelda&max=10
X-Api-Key: votre-clé-rawg
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `max` | `20` | Nombre max de résultats (1-40) |
| `page` | `1` | Numéro de page |
| `platforms` | - | IDs de plateformes (4=PC, 18=PS4, 1=Xbox One, 7=Switch) |
| `genres` | - | Slugs de genres (action, adventure, rpg...) |
| `ordering` | - | Tri (-rating, -released, -metacritic) |
| `dates` | - | Plage de dates (ex: 2020-01-01,2023-12-31) |
| `metacritic` | - | Plage de score (ex: 80,100) |

**Exemple de réponse (recherche) :**
```json
{
  "source": "rawg",
  "query": "zelda",
  "page": 1,
  "pageSize": 2,
  "totalResults": 203,
  "totalPages": 102,
  "hasNext": true,
  "hasPrevious": false,
  "count": 2,
  "games": [
    {
      "id": 22511,
      "slug": "the-legend-of-zelda-breath-of-the-wild",
      "name": "The Legend of Zelda: Breath of the Wild",
      "image": ["https://media.rawg.io/media/games/cc1/cc196a5ad763955d6532cdba236f730c.jpg"],
      "released": "2017-03-03",
      "rating": 4.47,
      "metacritic": 97,
      "platforms": [{ "id": 7, "name": "Nintendo Switch", "slug": "nintendo-switch" }],
      "genres": [{ "id": 4, "name": "Action", "slug": "action" }],
      "esrbRating": { "id": 2, "name": "Everyone 10+", "slug": "everyone-10-plus" },
      "url": "https://rawg.io/games/the-legend-of-zelda-breath-of-the-wild"
    }
  ]
}
```

##### Obtenir les Détails d'un Jeu
```bash
GET /rawg/game/22511
# Ou par slug :
GET /rawg/game/the-legend-of-zelda-breath-of-the-wild
X-Api-Key: votre-clé-rawg
```

**Exemple de réponse (détails) :**
```json
{
  "source": "rawg",
  "id": 22511,
  "slug": "the-legend-of-zelda-breath-of-the-wild",
  "name": "The Legend of Zelda: Breath of the Wild",
  "image": [
    "https://media.rawg.io/media/games/cc1/cc196a5ad763955d6532cdba236f730c.jpg",
    "https://media.rawg.io/media/screenshots/1e5/1e58e8a064da6906f09dba1edb3fdea6.jpg"
  ],
  "description": "The Legend of Zelda: Breath of the Wild is an adventure game developed by Nintendo...",
  "released": "2017-03-03",
  "rating": 4.47,
  "metacritic": 97,
  "playtime": 121,
  "platforms": [
    { "id": 7, "name": "Nintendo Switch", "slug": "nintendo-switch", "releasedAt": "2017-03-03" }
  ],
  "genres": [
    { "id": 4, "name": "Action", "slug": "action" },
    { "id": 3, "name": "Adventure", "slug": "adventure" }
  ],
  "developers": [{ "id": 16257, "name": "Nintendo", "slug": "nintendo" }],
  "publishers": [{ "id": 10681, "name": "Nintendo", "slug": "nintendo" }],
  "tags": [{ "id": 36, "name": "Open World", "slug": "open-world" }],
  "esrbRating": { "id": 2, "name": "Everyone 10+", "slug": "everyone-10-plus" },
  "pegi": "Everyone 10+",
  "minAge": 10,
  "isMultiplayer": false,
  "website": "https://www.nintendo.com/games/detail/the-legend-of-zelda-breath-of-the-wild-switch",
  "url": "https://rawg.io/games/the-legend-of-zelda-breath-of-the-wild"
}
```

#### 🕹️ Endpoints IGDB (Jeux Vidéo Twitch)

> 🔑 **Clé API requise** - Créez une application sur [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)

IGDB (Internet Game Database) est alimenté par Twitch et contient des données détaillées sur les jeux vidéo.

**Format de la clé :** `clientId:clientSecret`

##### Rechercher des Jeux
```bash
GET /igdb/search?q=witcher&max=10
X-Api-Key: clientId:clientSecret
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `max` | `20` | Nombre max de résultats (1-500) |
| `platforms` | - | IDs de plateformes (48=PS4, 167=PS5, 6=PC, 130=Switch) |
| `genres` | - | IDs de genres (12=RPG, 5=Shooter, 31=Adventure) |

**Exemple de réponse (recherche) :**
```json
{
  "source": "igdb",
  "query": "zelda",
  "count": 2,
  "games": [
    {
      "id": 7346,
      "slug": "the-legend-of-zelda-breath-of-the-wild",
      "name": "The Legend of Zelda: Breath of the Wild",
      "image": ["https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg"],
      "summary": "The Legend of Zelda: Breath of the Wild is the first 3D open-world game...",
      "rating": 92.6,
      "aggregatedRating": 97.6,
      "totalRating": 95.1,
      "releaseDate": "2017-03-03",
      "cover": {
        "imageId": "co3p2d",
        "thumbnail": "https://images.igdb.com/igdb/image/upload/t_thumb/co3p2d.jpg",
        "coverBig": "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg"
      },
      "genres": ["Puzzle", "Adventure"],
      "platforms": [{ "name": "Nintendo Switch", "abbreviation": "Switch" }],
      "developers": ["Nintendo EPD Production Group No. 3"],
      "publishers": ["Nintendo"],
      "gameModes": ["Single player"],
      "themes": ["Action", "Fantasy", "Open world"],
      "url": "https://www.igdb.com/games/the-legend-of-zelda-breath-of-the-wild"
    }
  ]
}
```

##### Obtenir les Détails d'un Jeu
```bash
GET /igdb/game/7346
# Ou par slug :
GET /igdb/game/the-legend-of-zelda-breath-of-the-wild
X-Api-Key: clientId:clientSecret
```

**Exemple de réponse (détails) :**
```json
{
  "source": "igdb",
  "id": 7346,
  "slug": "the-legend-of-zelda-breath-of-the-wild",
  "name": "The Legend of Zelda: Breath of the Wild",
  "image": [
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg",
    "https://images.igdb.com/igdb/image/upload/t_720p/fgubhnuapjmdbxwqxhsq.jpg",
    "https://images.igdb.com/igdb/image/upload/t_screenshot_big/sckj69.jpg"
  ],
  "summary": "The Legend of Zelda: Breath of the Wild is the first 3D open-world game in the Zelda series...",
  "storyline": "Link is awakened in a room by a voice calling him...",
  "rating": 92.6,
  "aggregatedRating": 97.6,
  "totalRating": 95.1,
  "releaseDate": "2017-03-03",
  "cover": {
    "imageId": "co3p2d",
    "thumbnail": "https://images.igdb.com/igdb/image/upload/t_thumb/co3p2d.jpg",
    "coverBig": "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg"
  },
  "genres": ["Puzzle", "Adventure"],
  "platforms": [{ "name": "Nintendo Switch", "abbreviation": "Switch" }],
  "developers": ["Nintendo EPD Production Group No. 3"],
  "publishers": ["Nintendo"],
  "gameModes": ["Single player"],
  "isMultiplayer": false,
  "themes": ["Action", "Fantasy", "Open world"],
  "ageRatings": [
    { "system": "PEGI", "rating": "PEGI 12", "minAge": 12 },
    { "system": "ESRB", "rating": "E10+", "minAge": 10 },
    { "system": "USK", "rating": "USK 12", "minAge": 12 }
  ],
  "pegi": "PEGI 12",
  "minAge": 12,
  "franchises": ["The Legend of Zelda"],
  "videos": [
    { "name": "Trailer", "videoId": "zw47_q9wbBE", "youtubeUrl": "https://www.youtube.com/watch?v=zw47_q9wbBE" }
  ],
  "similarGames": [
    { "name": "God of War", "slug": "god-of-war--1", "cover": "https://images.igdb.com/..." }
  ],
  "dlcs": [
    { "name": "The Champions' Ballad", "slug": "..." }
  ],
  "url": "https://www.igdb.com/games/the-legend-of-zelda-breath-of-the-wild"
}
```

Retourne des informations détaillées incluant : storyline, screenshots, artworks, vidéos YouTube, sites web, jeux similaires, DLCs, franchises, classifications PEGI/ESRB/USK/CERO.

#### 📺 Endpoints TVDB (Séries TV & Films) 🆕

> 🔑 **Clé API requise** - Obtenez une clé gratuite sur [thetvdb.com/api-information](https://thetvdb.com/api-information)

TVDB (TheTVDB) est une base de données communautaire pour les séries TV et films.

##### Rechercher des Séries & Films
```bash
GET /tvdb/search?q=breaking+bad&type=series&max=10&lang=fra
X-Api-Key: votre-clé-tvdb
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `type` | - | Type : `series`, `movie`, `person`, `company` |
| `max` | `20` | Nombre max de résultats (1-100) |
| `lang` | - | Code langue (fra, eng, deu, spa, etc.) |
| `year` | - | Année de sortie/diffusion |

**Exemple de réponse :**
```json
{
  "query": "breaking bad",
  "type": "all",
  "total": 5,
  "results": [
    {
      "id": 81189,
      "type": "series",
      "name": "Breaking Bad",
      "slug": "breaking-bad",
      "year": 2008,
      "overview": "Walter White, professeur de chimie...",
      "status": "Ended",
      "network": "AMC",
      "url": "https://thetvdb.com/series/breaking-bad",
      "source": "tvdb"
    }
  ]
}
```

##### Obtenir les Détails d'une Série
```bash
GET /tvdb/series/81189?lang=fra
X-Api-Key: votre-clé-tvdb
```

Retourne : synopsis, saisons, personnages, acteurs, genres, artworks, trailers, classifications.

##### Obtenir les Détails d'un Film
```bash
GET /tvdb/movie/12345?lang=fra
X-Api-Key: votre-clé-tvdb
```

Retourne : synopsis, casting, genres, dates de sortie, box office, budget, trailers.

#### 🎬 Endpoints TMDB (Films & Séries) 🆕

> 🔑 **Clé API requise** - Obtenez une clé gratuite sur [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)

TMDB (The Movie Database) est une base de données complète de films et séries TV.

##### Rechercher Films, Séries & Personnes
```bash
# Recherche multi (films, séries, personnes)
GET /tmdb/search?q=inception&lang=fr-FR

# Recherche filtrée
GET /tmdb/search?q=inception&type=movie&year=2010&max=10
X-Api-Key: votre-clé-tmdb
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `type` | `multi` | Type : `movie`, `tv`, `person`, `multi` |
| `max` | `20` | Nombre max de résultats (1-20 par page) |
| `lang` | `fr-FR` | Langue (ISO 639-1 + ISO 3166-1, ex: fr-FR, en-US) |
| `page` | `1` | Page pour la pagination |
| `year` | - | Année de sortie/diffusion |
| `adult` | `false` | Inclure le contenu adulte |

**Exemple de réponse :**
```json
{
  "query": "inception",
  "searchType": "multi",
  "page": 1,
  "totalResults": 45,
  "results": [
    {
      "id": 27205,
      "mediaType": "movie",
      "title": "Inception",
      "overview": "Dom Cobb est un voleur expérimenté...",
      "releaseDate": "2010-07-16",
      "year": 2010,
      "voteAverage": 8.4,
      "poster": "https://image.tmdb.org/t/p/w500/...",
      "url": "https://www.themoviedb.org/movie/27205",
      "source": "tmdb"
    }
  ]
}
```

##### Obtenir les Détails d'un Film
```bash
GET /tmdb/movie/27205?lang=fr-FR
X-Api-Key: votre-clé-tmdb
```

Retourne : synopsis, casting complet, crew (réalisateur, scénaristes), bandes-annonces YouTube, budget, recettes, genres, collections, films recommandés/similaires, mots-clés, IDs externes (IMDB, etc.), classifications par pays.

##### Obtenir les Détails d'une Série TV
```bash
GET /tmdb/tv/1396?lang=fr-FR
X-Api-Key: votre-clé-tmdb
```

Retourne : synopsis, nombre de saisons/épisodes, créateurs, casting, réseaux de diffusion, prochains épisodes, bandes-annonces, séries recommandées/similaires, IDs externes (IMDB, TVDB), classifications.

#### 🎬 Endpoints IMDB (Films & Séries - SANS CLÉ API) 🆕

IMDB (Internet Movie Database) est la base de données de films la plus populaire au monde. Accès fourni via [imdbapi.dev](https://imdbapi.dev) - **AUCUNE CLÉ API REQUISE** !

##### Rechercher des Titres
```bash
GET /imdb/search?q=inception&max=10
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `q` | requis | Terme de recherche |
| `max` | optionnel | Nombre max de résultats (défaut: 20, max: 50) |

Retourne : ID IMDB, titre, type (movie, tv_series, etc.), année, durée, genres, note moyenne, nombre de votes, affiche.

##### Obtenir les Détails d'un Titre
```bash
GET /imdb/title/tt1375666
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `:id` | requis | ID IMDB du titre (format: tt1234567) |

Retourne : synopsis, casting complet (acteurs, réalisateurs, scénaristes), genres, note IMDB et Metacritic, pays d'origine, langues parlées, tags/intérêts.

##### Parcourir les Titres avec Filtres Avancés
```bash
GET /imdb/browse?types=MOVIE&genres=Action,Sci-Fi&startYear=2020&endYear=2024&minRating=8&sortBy=SORT_BY_USER_RATING&sortOrder=DESC&max=20
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `types` | optionnel | Types de titres (séparés par virgule) : `MOVIE`, `TV_SERIES`, `TV_MINI_SERIES`, `TV_SPECIAL`, `TV_MOVIE`, `SHORT`, `VIDEO`, `VIDEO_GAME` |
| `genres` | optionnel | Genres (séparés par virgule) : `Action`, `Comedy`, `Drama`, `Horror`, `Sci-Fi`, etc. |
| `startYear` | optionnel | Année de début pour filtrer |
| `endYear` | optionnel | Année de fin pour filtrer |
| `minRating` | optionnel | Note minimum (0-10) |
| `maxRating` | optionnel | Note maximum (0-10) |
| `sortBy` | optionnel | Tri : `SORT_BY_POPULARITY` (défaut), `SORT_BY_RELEASE_DATE`, `SORT_BY_USER_RATING`, `SORT_BY_USER_RATING_COUNT`, `SORT_BY_YEAR` |
| `sortOrder` | optionnel | Ordre : `ASC`, `DESC` (défaut) |
| `pageToken` | optionnel | Token de pagination (retourné dans `nextPageToken`) |
| `max` | optionnel | Nombre max de résultats (défaut: 20, max: 50) |

Retourne : liste de titres avec pagination, nombre total de résultats, token pour la page suivante.

#### 🎌 Endpoints Jikan (Anime & Manga - SANS CLÉ API) 🆕

Jikan est une API REST non-officielle pour MyAnimeList.net, offrant l'accès aux données d'anime et de manga.

##### Rechercher des Anime
```bash
GET /jikan/anime?q=naruto&max=25&page=1
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `q` | requis | Terme de recherche |
| `max` | optionnel | Nombre max de résultats par page (défaut: 25, max: 25) |
| `page` | optionnel | Numéro de page pour la pagination (défaut: 1) |
| `type` | optionnel | Type d'anime : `tv`, `movie`, `ova`, `special`, `ona`, `music` |
| `status` | optionnel | Statut : `airing`, `complete`, `upcoming` |
| `rating` | optionnel | Classification : `g`, `pg`, `pg13`, `r17`, `r`, `rx` |
| `orderBy` | optionnel | Tri par : `mal_id`, `title`, `start_date`, `end_date`, `episodes`, `score`, `scored_by`, `rank`, `popularity`, `members`, `favorites` |
| `sort` | optionnel | Ordre : `asc`, `desc` |

Retourne : titre (plusieurs langues quand disponibles, dont français), nombre d'épisodes, statut, note, synopsis, genres, studios, poster, bande-annonce, URL MyAnimeList.

##### Obtenir les Détails d'un Anime
```bash
GET /jikan/anime/20
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `:id` | requis | ID MyAnimeList de l'anime (ex: 20 pour Naruto) |

Retourne : informations complètes incluant relations, plateformes de streaming, liens externes, info de diffusion, producteurs, licensors.

##### Rechercher des Manga
```bash
GET /jikan/manga?q=one+piece&max=25&page=1
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `q` | requis | Terme de recherche |
| `max` | optionnel | Nombre max de résultats par page (défaut: 25, max: 25) |
| `page` | optionnel | Numéro de page pour la pagination (défaut: 1) |
| `type` | optionnel | Type de manga : `manga`, `novel`, `lightnovel`, `oneshot`, `doujin`, `manhwa`, `manhua` |
| `status` | optionnel | Statut : `publishing`, `complete`, `hiatus`, `discontinued`, `upcoming` |
| `orderBy` | optionnel | Tri par : `mal_id`, `title`, `start_date`, `end_date`, `chapters`, `volumes`, `score`, `scored_by`, `rank`, `popularity`, `members`, `favorites` |
| `sort` | optionnel | Ordre : `asc`, `desc` |

Retourne : titre (plusieurs langues quand disponibles), chapitres, volumes, statut, note, synopsis, auteurs, genres, poster, URL MyAnimeList.

##### Obtenir les Détails d'un Manga
```bash
GET /jikan/manga/11
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `:id` | requis | ID MyAnimeList du manga (ex: 11 pour Naruto) |

Retourne : informations complètes incluant auteurs, sérialisations, relations, liens externes.

> **Note :** Jikan fournit les titres dans plusieurs langues lorsqu'ils sont disponibles sur MyAnimeList, y compris les titres français.
>
> 📖 **Format Harmonisé :** Les endpoints `/jikan/manga` et `/jikan/manga/:id` utilisent le [Format Harmonisé Livres](#-format-harmonisé-livres).

#### 🦸 Endpoints Comic Vine (Comics US) 🆕

Comic Vine est une base de données complète pour les comics américains, incluant personnages, volumes et numéros.

##### Rechercher des Comics
```bash
GET /comicvine/search?q=batman&type=volume&max=20
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `q` | requis | Terme de recherche |
| `type` | optionnel | Type de ressource : `volume`, `issue`, `character`, `person` (défaut: volume) |
| `max` | optionnel | Nombre max de résultats (défaut: 20, max: 100) |

Retourne : nom, description, image, éditeur, nombre de numéros, année de début, premier/dernier numéro.

##### Obtenir les Détails d'un Volume
```bash
GET /comicvine/volume/796
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `:id` | requis | ID Comic Vine du volume (ex: 796 pour Batman) |

Retourne : détails complets incluant tous les numéros, personnages, lieux, concepts et créateurs.

##### Obtenir les Détails d'un Numéro
```bash
GET /comicvine/issue/6643
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `:id` | requis | ID Comic Vine du numéro |

Retourne : détails complets incluant apparitions de personnages, équipes, arcs narratifs et crédits.

> **Note :** Comic Vine nécessite une clé API (configurée côté serveur).
>
> 📖 **Format Harmonisé :** Les endpoints `/comicvine/search` (type volume/issue), `/comicvine/volume/:id` et `/comicvine/issue/:id` utilisent le [Format Harmonisé Livres](#-format-harmonisé-livres).

#### 📚 Endpoints MangaDex (Manga - SANS CLÉ API) 🆕

MangaDex est un lecteur de manga gratuit avec un support multilingue étendu, incluant les traductions françaises.

##### Rechercher des Manga
```bash
GET /mangadex/search?q=one+piece&lang=fr&max=20
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `q` | requis | Terme de recherche |
| `lang` | optionnel | Filtrer par langue disponible (ex: `fr`, `en`, `ja`) |
| `max` | optionnel | Nombre max de résultats (défaut: 20, max: 100) |

Retourne : titre (plusieurs langues), description (français si disponible), auteurs, artistes, tags, langues disponibles, couverture.

##### Obtenir les Détails d'un Manga
```bash
GET /mangadex/manga/a1c7c817-4e59-43b7-9365-09675a149a6f
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `:id` | requis | UUID MangaDex du manga (ex: a1c7c817-4e59-43b7-9365-09675a149a6f pour One Piece) |

Retourne : détails complets incluant descriptions dans toutes les langues disponibles, tous les titres alternatifs, biographies des auteurs.

> **Note :** MangaDex supporte les traductions françaises ! Utilisez `lang=fr` pour filtrer les manga avec des chapitres français disponibles.
>
> 📖 **Format Harmonisé :** Les endpoints `/mangadex/search` et `/mangadex/manga/:id` utilisent le [Format Harmonisé Livres](#-format-harmonisé-livres).

#### 📖 Endpoints Bedetheque (BD Franco-Belge - Scraping) 🆕

Bedetheque est la plus grande base de données française pour les bandes dessinées franco-belges, manga et comics en français.

##### Rechercher des Séries
```bash
GET /bedetheque/search?q=asterix&max=20
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `q` | requis | Terme de recherche |
| `max` | optionnel | Nombre max de résultats (défaut: 20, max: 50) |

Retourne : ID, nom et URL de la série.

##### Rechercher des Albums (via Séries)
```bash
# Recherche par terme (recherche d'abord les séries, puis liste leurs albums)
GET /bedetheque/search/albums?q=asterix&max=20

# Recherche directe par ID de série (plus rapide)
GET /bedetheque/search/albums?serieId=59&max=20
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `q` | optionnel* | Terme de recherche (recherche dans les séries via API AJAX) |
| `serieId` | optionnel* | ID de la série Bedetheque pour lister ses albums directement |
| `max` | optionnel | Nombre max de résultats (défaut: 20, max: 50) |

*Au moins un paramètre requis (q ou serieId). Utilisez `/bedetheque/search` pour trouver l'ID d'une série.

**Fonctionnement :**
1. Si `serieId` fourni : liste directement les albums de cette série
2. Si `q` fourni : utilise l'API AJAX Bedetheque (rapide) pour trouver les séries, puis récupère les albums des 3 premières séries trouvées

> **💡 Astuce :** La recherche par `q` utilise l'API autocomplete de Bedetheque, qui est rapide mais ne trouve que des séries, pas des albums individuels. Pour chercher un album spécifique, utilisez d'abord `/bedetheque/search` pour trouver la série, puis `/bedetheque/search/albums?serieId=...` pour lister ses albums.

Retourne : Liste d'albums avec ID, titre, numéro de tome, série et URL. Utilisez `/bedetheque/album/:id` pour les détails complets.

##### Obtenir les Détails d'une Série
```bash
GET /bedetheque/serie/91
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `:id` | requis | ID Bedetheque de la série (ex: 91 pour Astérix) |

Retourne : détails incluant synopsis, albums, auteurs, genre, statut, couverture.

##### Obtenir les Détails d'un Album
```bash
GET /bedetheque/album/1721
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `:id` | requis | ID Bedetheque de l'album |

Retourne : détails incluant synopsis, ISBN, auteurs, éditeur, prix, nombre de pages.

> **⚠️ Note :** Bedetheque utilise du web scraping via FlareSolverr, ce qui signifie :
> - Les résultats peuvent être plus lents à cause du contournement des protections anti-bot
> - Certains champs de données peuvent être incomplets ou indisponibles
> - C'est la meilleure source francophone pour les BD franco-belges
>
> 📖 **Format Harmonisé :** Les endpoints `/bedetheque/serie/:id` et `/bedetheque/album/:id` utilisent le [Format Harmonisé Livres](#-format-harmonisé-livres).

#### 🎯 Endpoints Coleka

##### Rechercher sur Coleka
```bash
GET /coleka/search?q=lego+star+wars&nbpp=24&lang=fr
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `nbpp` | `24` | Nombre de résultats par page |
| `lang` | `fr` | Langue (fr, en, etc.) |

##### Obtenir les Détails d'un Item Coleka
```bash
GET /coleka/item?path=/fr/lego/star-wars/millennium-falcon-75192
# Ou avec le chemin dans l'URL :
GET /coleka/item/fr/lego/star-wars/millennium-falcon-75192
```

#### 🎮 Endpoints Lulu-Berlu

##### Rechercher sur Lulu-Berlu
```bash
GET /luluberlu/search?q=final+fantasy&max=24
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `max` | `24` | Nombre maximum de résultats |
| `lang` | ignoré | Paramètre de langue (ignoré, gardé pour compatibilité) |

##### Obtenir les Détails d'un Item Lulu-Berlu
```bash
GET /luluberlu/item/78643
# Ou avec l'URL complète :
GET /luluberlu/item?url=https://www.lulu-berlu.com/final-fantasy-viii-bandai-figurine-15cm-squall-leonhart-loose-a78643.html
```

#### 🤖 Endpoints Transformerland

##### Rechercher sur Transformerland
```bash
GET /transformerland/search?q=optimus+prime&max=50
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` ou `term` | requis | Terme de recherche |
| `max` | `50` | Nombre maximum de résultats |

##### Obtenir les Détails d'un Item Transformerland
```bash
GET /transformerland/item?url=https://www.transformerland.com/store/item/complete-transformers-g1-optimus-prime/394966/
```

#### 🏆 Endpoints Paninimania

##### Rechercher sur Paninimania
```bash
GET /paninimania/search?q=pokemon&max=20
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` ou `term` | requis | Terme de recherche |
| `max` | `20` | Nombre maximum de résultats |
| `lang` | ignoré | Site exclusivement en français |

##### Obtenir les Détails d'un Album Paninimania
```bash
GET /paninimania/album/7423
# Ou avec l'URL complète :
GET /paninimania/album?url=https://www.paninimania.com/?pag=cid508_alb&idf=15&idm=7423
```

#### 🧱 Endpoints Mega Construx (Sans Clé API) 🆕

Recherche de produits Mega Construx (Mattel) avec support multi-langue.

##### Rechercher des Produits
```bash
GET /mega/search?q=pokemon&max=20&page=1&lang=fr-FR
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `max` | `20` | Nombre de résultats (max: 100) |
| `page` | `1` | Page de résultats |
| `lang` | `fr-FR` | Langue (fr-FR, en-US, de-DE, es-ES, it-IT, nl-NL, en-GB) |

##### Obtenir les Détails d'un Produit
```bash
GET /mega/product/HNC57?lang=en-US
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:id` | requis | ID Shopify ou SKU du produit |
| `lang` | `fr-FR` | Langue |

> **Note :** Les manuels de construction sont automatiquement inclus si disponibles.

##### Rechercher par Franchise
```bash
GET /mega/franchise/pokemon?max=20&page=1&lang=en-US
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:franchise` | requis | pokemon, halo, barbie, hotwheels, bloks, construx |
| `max` | `20` | Nombre de résultats |
| `page` | `1` | Page de résultats |
| `lang` | `fr-FR` | Langue |

##### Lister les Instructions de Montage
```bash
GET /mega/instructions
GET /mega/instructions?category=pokemon
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `category` | - | Catégorie optionnelle (pokemon, halo, barbie, hot-wheels, etc.) |

##### Obtenir les Instructions par SKU
```bash
GET /mega/instructions/HNC57
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:sku` | requis | SKU du produit (ex: HNC57, HXP14) |

Retourne l'URL du PDF des instructions de montage.

##### Lister les Langues Disponibles
```bash
GET /mega/languages
```

Retourne les régions (US/EU), devises et langues supportées.

#### 🏷️ Endpoints Codes-barres (Sans Clé API) 🆕

Identification automatique de codes-barres UPC, EAN et ISBN.

##### Identifier par Code-barres (Auto-détection)
```bash
GET /barcode/5010993689040
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:code` | requis | Code-barres (UPC-A, UPC-E, EAN-8, EAN-13, ISBN-10, ISBN-13) |

L'API détecte automatiquement le type de code-barres :
- **ISBN** : Recherche dans Google Books, OpenLibrary et BNF
- **UPC/EAN** : Recherche dans Open Food Facts, UPCitemdb, Barcode Lookup

##### Détecter le Type de Code-barres
```bash
GET /barcode/detect/9782070612765
```

Retourne le type détecté (isbn-10, isbn-13, upc-a, upc-e, ean-8, ean-13).

##### Rechercher un Livre par ISBN
```bash
GET /barcode/isbn/9782070612765
```

Recherche spécifiquement dans les bases de données de livres.

##### Rechercher dans la BNF (Livres Français)
```bash
GET /barcode/bnf/9782070612765
```

Recherche dans le catalogue de la Bibliothèque nationale de France (livres français).

#### 🎵 Endpoints Musique (Sans Clé API*) 🆕

Recherche d'albums de musique sur plusieurs bases de données : MusicBrainz, Deezer, iTunes et Discogs.

##### Rechercher de la Musique
```bash
GET /music/search?q=daft+punk&type=album&max=10
GET /music/search?q=random+access+memories&sources=deezer,itunes
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `type` | `album` | Type de recherche (album, artist) |
| `max` | `20` | Nombre de résultats par source |
| `sources` | toutes | Sources à interroger (musicbrainz, deezer, itunes, discogs) |

##### Obtenir les Détails d'un Album (Deezer)
```bash
GET /music/album/6575789
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:id` | requis | ID Deezer de l'album |

##### Obtenir les Détails d'un Artiste (Deezer)
```bash
GET /music/artist/27
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:id` | requis | ID Deezer de l'artiste |

##### Obtenir une Sortie Discogs
```bash
GET /music/discogs/249504
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:id` | requis | ID Discogs de la sortie |

> **Note :** Discogs recommande un token personnel pour de meilleures performances.

##### Rechercher par Code-barres (CD/Vinyle)
```bash
GET /music/barcode/724384960650
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:code` | requis | Code-barres UPC/EAN du CD ou vinyle |

Recherche dans Discogs et MusicBrainz par code-barres.

#### 🎮 Endpoints JeuxVideo.com (Scraping) 🆕

Recherche de jeux vidéo sur JeuxVideo.com (en français uniquement). Source idéale pour les informations en français sur les jeux.

##### Rechercher des Jeux
```bash
GET /jvc/search?q=zelda&max=20
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `max` | `20` | Nombre maximum de résultats |

**Exemple de réponse (recherche) :**
```json
{
  "query": "zelda",
  "resultsCount": 2,
  "results": [
    {
      "id": 77113,
      "type": "game",
      "title": "The Legend of Zelda : Breath of the Wild",
      "description": "The Legend of Zelda : Breath of the Wild est un jeu d'action/aventure...",
      "releaseDate": "03 Mars 2017",
      "image": ["https://image.jeuxvideo.com/medias/149432/1494322310-8900-jaquette-avant.jpg"],
      "thumb": "https://image.jeuxvideo.com/medias/149432/1494322310-8900-jaquette-avant.jpg",
      "url": "https://www.jeuxvideo.com/jeux/jeu-77113/",
      "source": "jvc"
    }
  ],
  "source": "jvc",
  "note": "Résultats en français depuis JeuxVideo.com"
}
```

##### Obtenir les Détails d'un Jeu
```bash
GET /jvc/game/77113
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:id` | requis | ID JeuxVideo.com du jeu |

**Exemple de réponse (détails) :**
```json
{
  "id": 77113,
  "type": "game",
  "title": "The Legend of Zelda : Breath of the Wild",
  "image": ["https://image.jeuxvideo.com/medias/149432/1494322310-8900-jaquette-avant.jpg"],
  "description": "The Legend of Zelda : Breath of the Wild est un jeu d'action/aventure...",
  "cover": "https://image.jeuxvideo.com/medias/149432/1494322310-8900-jaquette-avant.jpg",
  "releaseDate": "2017-03-03",
  "platforms": ["Nintendo Switch", "Nintendo Switch 2", "Wii U"],
  "genres": ["Aventure", "Action", "RPG"],
  "publisher": "Nintendo",
  "developer": null,
  "pegi": "+12 ans",
  "minAge": 12,
  "nbPlayers": null,
  "isMultiplayer": false,
  "ratings": {
    "test": 20,
    "users": 17.1
  },
  "testUrl": "https://www.jeuxvideo.com/test/617770/...",
  "url": "https://www.jeuxvideo.com/jeux/jeu-77113/",
  "source": "jvc"
}
```

Retourne : titre, description, date de sortie, plateformes, note presse/utilisateurs, genre, éditeur, développeur, classification PEGI, nombre de joueurs et mode multijoueur.

> **⚠️ Note :** JeuxVideo.com utilise du web scraping via FlareSolverr.

#### 🎮 Endpoints ConsoleVariations (Scraping) 🆕

Base de données de variations de consoles, bundles et accessoires de jeux vidéo (11 000+ collectibles).

##### Rechercher des Consoles/Accessoires
```bash
GET /consolevariations/search?q=playstation+5&type=consoles&max=20
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `type` | `all` | Type de recherche : `all`, `consoles`, `accessories` |
| `max` | `20` | Nombre maximum de résultats |

**Valeurs du paramètre `type` :**
- `all` : Recherche tous les types (consoles et accessoires)
- `consoles` : Uniquement les consoles et bundles
- `accessories` : Uniquement les accessoires (manettes, câbles, etc.)

##### Obtenir les Détails d'un Item
```bash
GET /consolevariations/item/nes-mattel-super-mario-bros-bundle-uk
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:slug` | requis | Slug de l'item (dans l'URL) |

**Exemple de réponse :**
```json
{
  "source": "consolevariations",
  "slug": "nes-mattel-super-mario-bros-bundle-uk",
  "name": "Nintendo NES Mattel Super Mario Bros. Bundle [UK]",
  "url": "https://consolevariations.com/collectibles/nes-mattel-super-mario-bros-bundle-uk",
  "brand": "Nintendo",
  "platform": {
    "slug": "nes",
    "name": "NES"
  },
  "images": [
    {
      "id": 26414,
      "url": "https://cdn.consolevariations.com/26414/zktkYK...",
      "thumbnail": "https://cdn.consolevariations.com/26414/zktkYK...",
      "alt": "(Front View)",
      "contributor": {
        "id": 5530,
        "username": "robhlark"
      }
    }
  ],
  "details": {
    "releaseCountry": "United Kingdom",
    "releaseYear": 1987,
    "releaseType": "Official",
    "regionCode": "PAL",
    "amountProduced": "Between 50k - 100k",
    "limitedEdition": null,
    "isBundle": true,
    "color": null,
    "barcode": "074299009013"
  },
  "stats": {
    "rarityScore": 39,
    "userScore": "Common",
    "wantCount": 6,
    "ownCount": 7
  }
}
```

##### Lister les Plateformes/Marques
```bash
# Lister toutes les marques
GET /consolevariations/platforms

# Lister les plateformes d'une marque
GET /consolevariations/platforms?brand=nintendo
GET /consolevariations/platforms?brand=sony
GET /consolevariations/platforms?brand=microsoft
GET /consolevariations/platforms?brand=sega
```

##### Parcourir une Plateforme
```bash
GET /consolevariations/browse/nes?max=20
GET /consolevariations/browse/sony-playstation?max=30
GET /consolevariations/browse/xbox-series-x?max=10
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:platform` | requis | Slug de la plateforme |
| `max` | `20` | Nombre maximum de résultats |

> **⚠️ Note :** ConsoleVariations utilise du web scraping via FlareSolverr.

#### Vérification de Santé

---

## 🇬🇧 English

### Description

**Toys API** is a lightweight Node.js API that allows you to:
- 🔍 Search for LEGO products by name or keyword
- 📦 Get detailed product information (price, availability, piece count, etc.)
- 🧱 Search Rebrickable for sets, parts, minifigs, themes, and colors (requires API key)
- 🎯 Search Coleka collectibles database
- 🎮 Search Lulu-Berlu vintage toys shop
- 🤖 Search Transformerland vintage Transformers store
- 🏆 Search Paninimania sticker albums (French only)
- 🌍 Support for multiple locales (fr-FR, en-US, de-DE, etc.)
- 🛡️ Bypass Cloudflare protection via FlareSolverr integration

### Requirements

- Docker
- [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr) running and accessible

### Quick Start

```bash
docker pull nimai24/toys_api:latest

docker run -d \
  --name toys_api \
  -p 3000:3000 \
  -e FSR_URL=http://your-flaresolverr:8191/v1 \
  -e DEFAULT_LOCALE=en-US \
  nimai24/toys_api:latest
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API listening port |
| `FSR_URL` | `http://10.110.1.1:8191/v1` | FlareSolverr endpoint URL |
| `DEFAULT_LOCALE` | `fr-FR` | Default language/region |
| `MAX_RETRIES` | `3` | Max retry attempts on failure |
| `CACHE_TTL` | `300000` | Cache TTL in milliseconds (5 min) |
| `CACHE_MAX_SIZE` | `100` | Maximum cache entries |
| `USER_AGENT` | Chrome UA | Custom User-Agent string |
| `API_ENCRYPTION_KEY` | - | Secret key for API key encryption (AES-256-GCM) |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |

### 🔐 API Authentication

#### Key Transmission Methods

Three methods are available for transmitting your API keys:

```bash
# Method 1: X-Api-Key Header (recommended)
curl -H "X-Api-Key: your-api-key" "http://localhost:3000/rawg/search?q=zelda"

# Method 2: Query parameter
curl "http://localhost:3000/rawg/search?q=zelda&api_key=your-api-key"

# Method 3: X-Encrypted-Key Header (if API_ENCRYPTION_KEY is configured)
curl -H "X-Encrypted-Key: base64-encrypted-key" "http://localhost:3000/rawg/search?q=zelda"
```

#### Key Format by Service

| Service | Format | Example |
|---------|--------|---------|
| **RAWG** | Simple key | `abc123def456` |
| **Rebrickable** | Simple key | `key abc123def456` |
| **Google Books** | Simple key | `AIzaSyABC123...` |
| **TVDB** | Simple key | `abc123-def456-...` |
| **TMDB** | Simple key | `abc123def456...` |
| **Comic Vine** | Simple key | `abc123def456...` |
| **Discogs** | `token:secret` | `myToken:mySecret` |
| **IGDB** ⚠️ | `clientId:clientSecret` | `abc123:xyz789` |

#### ⚠️ Special Case: IGDB (Twitch)

IGDB uses **Twitch** authentication. You need to:

1. Create an app at [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)
2. Get the **Client ID** and **Client Secret**
3. Combine them with `:` as separator

```bash
# IGDB format: CLIENT_ID:CLIENT_SECRET
curl -H "X-Api-Key: your_client_id:your_client_secret" \
  "http://localhost:3000/igdb/search?q=zelda"
```

#### AES-256-GCM Encryption (optional)

If `API_ENCRYPTION_KEY` is configured, you can encrypt your API keys:

**Docker Configuration:**
```yaml
environment:
  - API_ENCRYPTION_KEY=your-secret-key-32-characters
```

**Client-side Encryption (Node.js):**
```javascript
const crypto = require('crypto');

function encryptApiKey(apiKey, encryptionKey) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(apiKey, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

const encryptedKey = encryptApiKey('my-rawg-key', 'your-secret-key-32-characters');
// Use with: X-Encrypted-Key: <result>
```

#### Services Without API Key Required

These services work **without authentication**:

| Service | Endpoints |
|---------|-----------|
| LEGO | `/lego/search`, `/lego/product/:id`, `/lego/instructions/:id` |
| Mega Construx | `/mega/search`, `/mega/product/:id`, `/mega/instructions/:sku` |
| Coleka | `/coleka/search`, `/coleka/item` |
| Lulu-Berlu | `/luluberlu/search`, `/luluberlu/item/:id` |
| Transformerland | `/transformerland/search`, `/transformerland/item` |
| Paninimania | `/paninimania/search`, `/paninimania/album/:id` |
| JVC | `/jvc/search`, `/jvc/game/:id` |
| ConsoleVariations | `/consolevariations/search`, `/consolevariations/item/:slug`, `/consolevariations/platforms`, `/consolevariations/browse/:platform` |
| IMDB | `/imdb/search`, `/imdb/title/:id` |
| Jikan | `/jikan/anime/search`, `/jikan/manga/search` |
| MangaDex | `/mangadex/search`, `/mangadex/manga/:id` |
| Bedetheque | `/bedetheque/search`, `/bedetheque/album/:id` |
| OpenLibrary | `/openlibrary/search`, `/openlibrary/book/:id` |
| MusicBrainz | `/music/search` |
| Deezer | `/deezer/search`, `/deezer/album/:id` |
| Barcode | `/barcode/lookup/:code` |

#### Get API Keys

| Service | Registration URL | Free |
|---------|------------------|------|
| RAWG | [rawg.io/apidocs](https://rawg.io/apidocs) | ✅ |
| IGDB | [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) | ✅ |
| Rebrickable | [rebrickable.com/api](https://rebrickable.com/api/) | ✅ |
| Google Books | [console.cloud.google.com](https://console.cloud.google.com/apis/library/books.googleapis.com) | ✅ |
| TVDB | [thetvdb.com/api-information](https://thetvdb.com/api-information) | ✅ |
| TMDB | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | ✅ |
| Comic Vine | [comicvine.gamespot.com/api](https://comicvine.gamespot.com/api/) | ✅ |
| Discogs | [discogs.com/settings/developers](https://www.discogs.com/settings/developers) | ✅ |

#### 🔧 Crypto Endpoints (utilities)

These endpoints allow you to encrypt and verify your API keys.

##### Encrypt an API Key
```bash
POST /crypto/encrypt
Content-Type: application/json

{"key": "your-api-key"}
```

For IGDB (Twitch), use the format `clientId:clientSecret`:
```bash
POST /crypto/encrypt
Content-Type: application/json

{"key": "abc123:xyz789"}
```

**Response:**
```json
{
  "encrypted": "iv:authTag:encryptedData",
  "usage": "curl -H \"X-Encrypted-Key: iv:authTag:encryptedData\" ...",
  "curl_example": "curl -H \"X-Encrypted-Key: ...\" \"http://localhost:3000/rawg/search?q=zelda\""
}
```

##### Verify an Encrypted Key
```bash
POST /crypto/verify
Content-Type: application/json

{"encrypted": "iv:authTag:encryptedData"}
```

**Response:**
```json
{
  "valid": true,
  "keyLength": 32,
  "keyPreview": "abc1...xyz9"
}
```

### API Endpoints

#### 🧱 LEGO Endpoints

##### Search Products
```bash
GET /lego/search?q=millennium+falcon&lang=en-US&max=10
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search term |
| `lang` | `fr-FR` | Language (fr-FR, en-US, de-DE, etc.) |
| `max` | `24` | Maximum results (1-100) |
| `limit` | `24` | Alias for `max` |

**Response:**
```json
{
  "products": [
    {
      "id": "75192",
      "productCode": "75192",
      "name": "Millennium Falcon™",
      "slug": "millennium-falcon-75192",
      "thumb": "https://...",
      "variant": {
        "price": { "formattedAmount": "$849.99" },
        "attributes": { "pieceCount": 7541 }
      }
    }
  ],
  "total": 1
}
```

##### Get Product Details
```bash
GET /lego/product/75192?lang=en-US

# With Rebrickable enrichment (adds minifigs, parts from Rebrickable):
GET /lego/product/75192?enrich_rebrickable=true&parts_limit=500
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `lang` | `fr-FR` | Language for LEGO data |
| `enrich_rebrickable` | `false` | Add minifigs/parts from Rebrickable (requires API key) |
| `parts_limit` | `500` | Max parts when enriching |

**Note:** When `enrich_rebrickable=true`, provide Rebrickable API key via `X-Api-Key` or `X-Encrypted-Key` header.

**Response (with enrichment):**
```json
{
  "id": "75192",
  "name": "Millennium Falcon™",
  "price": "849,99 €",
  "images": ["https://..."],
  "rebrickable": {
    "set_num": "75192-1",
    "minifigs": {
      "count": 9,
      "results": [...]
    },
    "parts": {
      "count": 7541,
      "results": [...]
    }
  },
  "source": "lego"
}
```

##### Get Building Instructions
```bash
GET /lego/instructions/75192?lang=en-US
```

#### 🎯 Coleka Endpoints

##### Search Coleka
```bash
GET /coleka/search?q=lego+star+wars&nbpp=24&lang=fr
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search query |
| `nbpp` | `24` | Number of results per page |
| `lang` | `fr` | Language (fr, en, etc.) |

**Response:**
```json
{
  "query": "lego star wars",
  "products": [
    {
      "id": "millennium-falcon-75192",
      "name": "Millennium Falcon",
      "url": "https://www.coleka.com/fr/lego/star-wars/millennium-falcon-75192",
      "image": "https://...",
      "category": "lego",
      "collection": "star-wars"
    }
  ],
  "total": 10,
  "source": "coleka"
}
```

##### Get Coleka Item Details
```bash
GET /coleka/item?path=/fr/lego/star-wars/millennium-falcon-75192
# Or with path in URL:
GET /coleka/item/fr/lego/star-wars/millennium-falcon-75192
```

**Response:**
```json
{
  "id": "millennium-falcon-75192",
  "name": "Millennium Falcon",
  "url": "https://www.coleka.com/fr/lego/star-wars/millennium-falcon-75192",
  "images": ["https://thumbs.coleka.com/media/item/.../millennium-falcon.webp"],
  "description": "...",
  "category": "lego",
  "collection": "star-wars",
  "series": "Star Wars",
  "reference": "75192",
  "releaseDate": "2017",
  "year": "2017",
  "brand": "LEGO",
  "price": 849.99,
  "highPrice": 849.99,
  "lowPrice": 699.99,
  "attributes": {...},
  "source": "coleka"
}
```

#### 🎮 Lulu-Berlu Endpoints

##### Search Lulu-Berlu
```bash
GET /luluberlu/search?q=final+fantasy&max=24
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search query |
| `max` | `24` | Maximum number of results |
| `lang` | ignored | Language parameter (ignored, kept for compatibility) |

**Response:**
```json
{
  "query": "final fantasy",
  "products": [
    {
      "id": "78643",
      "name": "Final Fantasy VIII - Bandai - Figurine 15cm Squall Leonhart (loose)",
      "url": "https://www.lulu-berlu.com/final-fantasy-viii-bandai-figurine-15cm-squall-leonhart-loose-a78643.html",
      "image": "https://www.lulu-berlu.com/upload/image/...-moyenne.jpg",
      "brand": "Bandai",
      "availability": "in_stock",
      "price": 14.99
    }
  ],
  "total": 82,
  "source": "lulu-berlu"
}
```

##### Get Lulu-Berlu Item Details
```bash
GET /luluberlu/item/78643
# Or with full URL:
GET /luluberlu/item?url=https://www.lulu-berlu.com/final-fantasy-viii-bandai-figurine-15cm-squall-leonhart-loose-a78643.html
```

**Response:**
```json
{
  "id": "78643",
  "name": "Final Fantasy VIII - Bandai - Figurine 15cm Squall Leonhart (loose)",
  "url": "https://www.lulu-berlu.com/final-fantasy-viii-bandai-figurine-15cm-squall-leonhart-loose-a78643.html",
  "images": ["https://www.lulu-berlu.com/upload/image/...-grande.jpg"],
  "description": "Type : Figurine articulée Matière : Plastique Taille : 15cm...",
  "brand": "Bandai",
  "reference": "AR0044663",
  "price": 14.99,
  "availability": "in_stock",
  "attributes": {
    "type": "Figurine articulée",
    "matière": "Plastique",
    "taille": "15cm",
    "origine": "Europe",
    "année": "1999",
    "condition": "Loose. Voir photos pour détails"
  },
  "source": "lulu-berlu"
}
```

#### 🤖 Transformerland Endpoints

##### Search Transformerland
```bash
GET /transformerland/search?q=optimus+prime&max=50
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` or `term` | required | Search query |
| `max` | `50` | Maximum number of results |

**Response:**
```json
{
  "query": "optimus prime",
  "count": 3,
  "results": [
    {
      "id": "394966",
      "name": "Complete Transformers G1 Optimus Prime",
      "url": "https://www.transformerland.com/store/item/complete-transformers-g1-optimus-prime/394966/",
      "image": "https://www.transformerland.com/image/inventory/hires/251126/IMG_3746.jpg",
      "price": 245,
      "currency": "USD",
      "availability": "in_stock",
      "series": "G1 > Leaders",
      "subline": null,
      "condition": null
    }
  ]
}
```

##### Get Transformerland Item Details
```bash
GET /transformerland/item?url=https://www.transformerland.com/store/item/complete-transformers-g1-optimus-prime/394966/
```

**Response:**
```json
{
  "id": "394966",
  "name": "Complete Transformers® G1 Optimus Prime SKU 394966",
  "url": "https://www.transformerland.com/store/item/complete-transformers-g1-optimus-prime/394966/",
  "price": 245,
  "currency": "USD",
  "availability": "in_stock",
  "description": "Complete with all accessories...",
  "images": [
    "https://www.transformerland.com/image/inventory/hires/251126/IMG_3746.jpg",
    "https://www.transformerland.com/image/inventory/hires/251126/IMG_3747.jpg"
  ],
  "series": "G1",
  "subline": "Leaders",
  "condition": "Complete",
  "year": 1984,
  "weight": null,
  "dimensions": null,
  "categories": []
}
```

#### 🏆 Paninimania Endpoints

##### Search Paninimania Albums
```bash
GET /paninimania/search?q=pokemon&max=20
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` or `term` | required | Search query |
| `max` | `20` | Maximum number of results |
| `lang` | ignored | Language parameter (ignored, French only) |

**Response:**
```json
{
  "source": "paninimania",
  "query": "pokemon",
  "formattedQuery": "pokemon",
  "total": 5,
  "results": [
    {
      "id": "7423",
      "title": "Pokémon Nintendo 150 Stickers - Dunkin Bubble Gum - 2000 FR",
      "url": "https://www.paninimania.com/?pag=cid508_alb&idf=15&idm=7423",
      "thumbnail": "https://www.paninimania.com/files/15/30/?n=7423s.jpg",
      "year": "2000",
      "editor": "Dunkin/Nintendo",
      "checklist": "1 à 151"
    }
  ]
}
```

##### Get Paninimania Album Details
```bash
GET /paninimania/album/7423
# Or with full URL:
GET /paninimania/album?url=https://www.paninimania.com/?pag=cid508_alb&idf=15&idm=7423
```

**Response:**
```json
{
  "id": "7423",
  "title": "Pokémon Nintendo 150 Stickers - Dunkin Bubble Gum - 2000 FR",
  "url": "https://www.paninimania.com/?pag=cid508_alb&idf=15&idm=7423",
  "description": "Dessins animés TV / BD Télévision. 2000. Dunkin - Nintendo...",
  "mainImage": "https://www.paninimania.com/files/15/30/?n=7423b.jpg",
  "copyright": "Dunkin, Nintendo",
  "releaseDate": "2000",
  "editor": "Dunkin/Nintendo",
  "checklist": "1 à 151",
  "categories": ["Télévision", "Dessins animés TV / BD"],
  "additionalImages": [
    {
      "url": "https://www.paninimania.com/files/15/30/?n=7423_i1b.jpg",
      "caption": "Exemple d'images"
    },
    {
      "url": "https://www.paninimania.com/files/15/30/?n=7423_i2b.jpg",
      "caption": "Checklist"
    }
  ],
  "articles": ["Collection complète"]
}
```

#### 🧱 Mega Construx Endpoints (No API Key Required) 🆕

Search Mattel's Mega Construx building blocks with multi-language support.

##### Search Products
```bash
GET /mega/search?q=halo&lang=en-US&max=20
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `q` | yes | Search query |
| `lang` | no | Language: `en-US`, `fr-FR`, `de-DE`, `en-GB`, `it-IT`, `es-ES`, `nl-NL` (default: `en-US`) |
| `max` | no | Max results (default: 20, max: 100) |

**Response:**
```json
{
  "query": "halo",
  "lang": "en-US",
  "region": "US",
  "total": 15,
  "products": [
    {
      "id": "HHC21",
      "sku": "HHC21",
      "name": "Halo Infinite Pelican Inbound",
      "url": "https://shop.mattel.com/products/mega-halo-infinite-pelican-inbound-hhc21",
      "image": "https://cdn.shopify.com/.../HHC21_01.jpg",
      "price": "$169.99",
      "pieces": 2024,
      "brand": "Mega™",
      "franchise": "Halo",
      "availability": "In Stock"
    }
  ],
  "source": "mega_us"
}
```

##### Get Product Details
```bash
GET /mega/product/:id?lang=en-US
```

##### Search by Franchise
```bash
GET /mega/franchise/:franchise?lang=en-US&max=50
```

| Franchise | Description |
|-----------|-------------|
| `halo` | Halo video game series |
| `pokemon` | Pokémon franchise |
| `hot-wheels` | Hot Wheels vehicles |
| `masters-of-the-universe` | He-Man & MOTU |
| `barbie` | Barbie building sets |
| `call-of-duty` | Call of Duty (older sets) |

##### List Building Instructions
```bash
GET /mega/instructions?franchise=halo&max=50
```

##### Get Instructions for a SKU
```bash
GET /mega/instructions/:sku
```

**Response:**
```json
{
  "sku": "HHC21",
  "instructions": [
    {
      "title": "HHC21 - Halo Infinite Pelican Inbound",
      "url": "https://shop.mattel.com/cdn/BI/HHC21.pdf",
      "format": "pdf"
    }
  ]
}
```

##### List Available Languages
```bash
GET /mega/languages
```

---

#### 🏷️ Barcode Endpoints (No API Key Required) 🆕

Universal barcode identification supporting UPC, EAN, and ISBN formats. Automatically detects barcode type and queries appropriate databases.

##### Identify by Barcode (Auto-detect)
```bash
GET /barcode/:code?lang=fr-FR
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `code` | yes | UPC-A (12 digits), EAN-13 (13 digits), EAN-8 (8 digits), ISBN-10/13 |
| `lang` | no | Language for book results (default: `fr`) |

**Response for UPC/EAN:**
```json
{
  "barcode": "012345678905",
  "type": "UPC-A",
  "sources": {
    "upc_item_db": {
      "found": true,
      "product": {
        "title": "Product Name",
        "brand": "Brand",
        "category": "Electronics",
        "description": "Product description",
        "images": ["https://..."]
      }
    },
    "open_food_facts": {
      "found": false
    }
  },
  "music": null
}
```

**Response for ISBN:**
```json
{
  "barcode": "9782070612758",
  "type": "ISBN-13",
  "sources": {
    "google_books": {
      "found": true,
      "book": {
        "title": "Harry Potter à l'école des sorciers",
        "authors": ["J.K. Rowling"],
        "publisher": "Gallimard Jeunesse",
        "publishedDate": "2017",
        "language": "fr"
      }
    },
    "open_library": {
      "found": true,
      "book": { ... }
    }
  }
}
```

##### Detect Barcode Type
```bash
GET /barcode/detect/:code
```

**Response:**
```json
{
  "code": "9782070612758",
  "type": "ISBN-13",
  "valid": true,
  "details": {
    "prefix": "978",
    "group": "2",
    "publisher": "07",
    "title": "061275",
    "checkDigit": "8"
  }
}
```

##### Search Book by ISBN
```bash
GET /barcode/isbn/:isbn?lang=fr
```

Searches Google Books and OpenLibrary for book information.

##### Search French Books via BNF
```bash
GET /barcode/bnf/:isbn
```

Searches the French National Library (data.bnf.fr) for French books.

---

#### 🎵 Music Endpoints (No API Key Required*) 🆕

Search for music albums across multiple databases: MusicBrainz, Deezer, iTunes, and Discogs.

*Note: Discogs search requires an API token (free at discogs.com/developers)

##### Search Music
```bash
GET /music/search?q=daft+punk&artist=daft+punk&lang=fr&limit=20
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `q` | yes | Search query (album name) |
| `artist` | no | Artist name to filter results |
| `lang` | no | Language/country: `fr`, `us`, `gb`, `de` (default: `fr`) |
| `limit` | no | Max results per source (default: 20, max: 100) |

**Response:**
```json
{
  "query": "random access memories",
  "artist": "daft punk",
  "results": {
    "musicbrainz": [
      {
        "id": "f5093e06-...",
        "title": "Random Access Memories",
        "artist": "Daft Punk",
        "date": "2013-05-17",
        "country": "XW",
        "label": "Columbia",
        "format": ["CD", "Vinyl"],
        "tracks": 13
      }
    ],
    "deezer": [
      {
        "id": 6575789,
        "title": "Random Access Memories",
        "artist": "Daft Punk",
        "cover": "https://api.deezer.com/album/6575789/image",
        "release_date": "2013-05-17",
        "tracks": 13,
        "link": "https://www.deezer.com/album/6575789"
      }
    ],
    "itunes": [
      {
        "id": 617154241,
        "title": "Random Access Memories",
        "artist": "Daft Punk",
        "artwork": "https://is1-ssl.mzstatic.com/image/...",
        "release_date": "2013-05-17",
        "price": "EUR 9.99",
        "tracks": 13,
        "link": "https://music.apple.com/album/617154241"
      }
    ]
  },
  "total": 15
}
```

##### Get Album Details (Deezer)
```bash
GET /music/album/:id
```

##### Get Artist Details (Deezer)
```bash
GET /music/artist/:id
```

##### Get Discogs Release
```bash
GET /music/discogs/:id
```

Headers:
- `X-Discogs-Token`: Your Discogs API token (optional but recommended)

##### Search Music by Barcode
```bash
GET /music/barcode/:code
```

Search for a music album using its UPC/EAN barcode (found on CD/vinyl).

**Response:**
```json
{
  "barcode": "886443927087",
  "results": {
    "musicbrainz": {
      "found": true,
      "album": {
        "title": "Random Access Memories",
        "artist": "Daft Punk",
        "date": "2013-05-17",
        "label": "Columbia"
      }
    },
    "discogs": {
      "found": true,
      "release": {
        "title": "Random Access Memories",
        "artist": "Daft Punk",
        "year": 2013,
        "format": ["CD", "Album"]
      }
    }
  }
}
```

---

#### 🧱 Rebrickable Endpoints (API Key Required)

Rebrickable endpoints require an API key. Get your free API key at [rebrickable.com/api](https://rebrickable.com/api/).

**Authentication:**
- If `API_ENCRYPTION_KEY` is set: Use `X-Encrypted-Key` header with AES-256-GCM encrypted key
- If `API_ENCRYPTION_KEY` is NOT set: Use `X-Api-Key` header or `api_key` query parameter

##### Smart Search (ID or Text)
```bash
# Search by set number (returns full details + minifigs + parts + LEGO instructions)
GET /rebrickable/search?q=75192

# Search by text (returns paginated list)
GET /rebrickable/search?q=millennium+falcon&page=1&page_size=20

# With filters:
GET /rebrickable/search?q=star+wars&min_year=2020&max_year=2024&theme_id=158
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search query (number = set ID, text = search) |
| `page` | `1` | Page number for text search |
| `page_size` | `100` | Results per page |
| `enrich_lego` | `true` | Add LEGO instructions to results |
| `parts_limit` | `500` | Max parts to return for set ID search |
| `theme_id` | - | Filter by LEGO theme ID |
| `min_year` | - | Minimum release year |
| `max_year` | - | Maximum release year |
| `min_parts` | - | Minimum part count |
| `max_parts` | - | Maximum part count |

**Response (Set ID Search):**
```json
{
  "type": "set_id",
  "set": {
    "set_num": "75192-1",
    "lego_id": "75192",
    "name": "Millennium Falcon",
    "year": 2017,
    "theme_id": 158,
    "num_parts": 7541,
    "set_img_url": "https://cdn.rebrickable.com/media/sets/75192-1/..."
  },
  "minifigs": {
    "count": 9,
    "results": [
      { "fig_num": "fig-000001", "name": "Han Solo", "quantity": 1 }
    ]
  },
  "parts": {
    "count": 7541,
    "results": [
      { "part_num": "3001", "name": "Brick 2 x 4", "quantity": 150, "color_name": "Dark Gray" }
    ]
  },
  "lego_data": {
    "instructions": [
      { "id": "1", "pdfUrl": "https://www.lego.com/cdn/product-assets/..." }
    ]
  },
  "source": "rebrickable"
}
```

**Response (Text Search):**
```json
{
  "query": "millennium falcon",
  "type": "text_search",
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_count": 45,
    "total_pages": 3,
    "has_next": true,
    "has_previous": false
  },
  "sets": [
    {
      "set_num": "75192-1",
      "lego_id": "75192",
      "name": "Millennium Falcon",
      "year": 2017,
      "num_parts": 7541
    }
  ],
  "source": "rebrickable"
}
```

##### Get Set Details (Full)
```bash
# Basic info only:
GET /rebrickable/set/75192?parts=false&minifigs=false&enrich_lego=false

# Full details (default):
GET /rebrickable/set/75192
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `parts` | `true` | Include parts list |
| `minifigs` | `true` | Include minifigs list |
| `enrich_lego` | `true` | Add LEGO instructions |
| `parts_limit` | `500` | Max parts to return |
| `lang` | `fr-FR` | Language for LEGO data |

**Note:** The endpoint accepts both LEGO IDs (`75192`) and Rebrickable IDs (`75192-1`).

##### Get Set Parts
```bash
GET /rebrickable/set/75192/parts?limit=500
```

**Response:**
```json
{
  "set_num": "75192-1",
  "count": 7541,
  "parts": [
    {
      "part_num": "3001",
      "name": "Brick 2 x 4",
      "part_cat_id": 11,
      "part_url": "https://rebrickable.com/parts/3001/brick-2-x-4/",
      "part_img_url": "https://cdn.rebrickable.com/media/parts/...",
      "color_id": 72,
      "color_name": "Dark Bluish Gray",
      "color_rgb": "6C6E68",
      "quantity": 150,
      "is_spare": false,
      "element_id": "4211103"
    }
  ],
  "source": "rebrickable"
}
```

##### Get Set Minifigs
```bash
GET /rebrickable/set/75192/minifigs
```

**Response:**
```json
{
  "set_num": "75192-1",
  "count": 7,
  "minifigs": [
    {
      "fig_num": "fig-000001",
      "name": "Han Solo",
      "quantity": 1,
      "set_img_url": "https://cdn.rebrickable.com/media/sets/..."
    }
  ],
  "source": "rebrickable"
}
```

##### Get LEGO Themes
```bash
GET /rebrickable/themes
# Or get sub-themes:
GET /rebrickable/themes?parent_id=158
```

##### Get LEGO Colors
```bash
GET /rebrickable/colors
```

**Response:**
```json
{
  "count": 200,
  "colors": [
    {
      "id": 0,
      "name": "Black",
      "rgb": "05131D",
      "is_trans": false
    }
  ],
  "source": "rebrickable"
}
```

#### 📚 Google Books Endpoints (API Key Required)

Google Books endpoints require an API key. Get your free API key at [Google Cloud Console](https://console.cloud.google.com/apis/library/books.googleapis.com).

**Authentication:**
- If `API_ENCRYPTION_KEY` is set: Use `X-Encrypted-Key` header with AES-256-GCM encrypted key
- If `API_ENCRYPTION_KEY` is NOT set: Use `X-Api-Key` header or `api_key` query parameter

##### Search Books (Text or ISBN)
```bash
# Search by text
GET /googlebooks/search?q=harry+potter&lang=fr&max=10

# Search by ISBN (auto-detected)
GET /googlebooks/search?q=9782070584628
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search query (text or ISBN) |
| `lang` | - | Language code (fr, en, es, etc.) |
| `max` | `20` | Max results (up to 40) |

**Response:**
```json
{
  "query": "harry potter",
  "type": "text",
  "totalItems": 1000000,
  "count": 10,
  "books": [
    {
      "id": "wrOQLV6xB-wC",
      "title": "Harry Potter à L'école des Sorciers",
      "authors": ["J.K. Rowling"],
      "publisher": "Pottermore Publishing",
      "publishedDate": "2015-12-08",
      "identifiers": {
        "isbn_10": "2070584623",
        "isbn_13": "9782070584628"
      },
      "coverUrl": "https://books.google.com/books/content?id=...",
      "previewLink": "https://books.google.fr/books?id=...",
      "averageRating": 4.5,
      "ratingsCount": 1234
    }
  ],
  "source": "google_books"
}
```

##### Get Book by Volume ID
```bash
GET /googlebooks/book/wrOQLV6xB-wC
```

**Response:**
```json
{
  "id": "wrOQLV6xB-wC",
  "title": "Harry Potter à L'école des Sorciers",
  "authors": ["J.K. Rowling"],
  "description": "Le jour de ses onze ans...",
  "pageCount": 311,
  "categories": ["Fiction", "Fantasy"],
  "identifiers": { "isbn_13": "9782070584628" },
  "mainCover": "https://books.google.com/books/content?id=...",
  "saleInfo": {
    "saleability": "FOR_SALE",
    "buyLink": "https://play.google.com/store/books/details?..."
  },
  "source": "google_books"
}
```

##### Get Book by ISBN (Shortcut)
```bash
GET /googlebooks/isbn/9782070584628?lang=fr
```

Returns the first matching book directly (not wrapped in array).

#### 📖 OpenLibrary Endpoints (No API Key Required)

OpenLibrary is a free, open API - no authentication needed!

##### Search Books (Text or ISBN)
```bash
# Search by text
GET /openlibrary/search?q=dune+frank+herbert&lang=en&max=10

# Search by ISBN (auto-detected)
GET /openlibrary/search?q=9780441172719
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search query (text or ISBN) |
| `lang` | - | Language code (fr, en, es, de, it, pt) |
| `max` | `20` | Max results (up to 100) |

**Response:**
```json
{
  "query": "dune frank herbert",
  "type": "text",
  "totalItems": 206,
  "count": 10,
  "books": [
    {
      "id": "OL893415W",
      "olKey": "/works/OL893415W",
      "title": "Dune",
      "authors": ["Frank Herbert"],
      "publisher": "Ace Books",
      "publishedDate": "1965",
      "firstPublishYear": 1965,
      "editionCount": 234,
      "identifiers": {
        "isbn_10": "0441172717",
        "isbn_13": "9780441172719"
      },
      "coverUrl": "https://covers.openlibrary.org/b/id/11481354-M.jpg",
      "subjects": ["Science Fiction", "Ecology"]
    }
  ],
  "source": "openlibrary"
}
```

##### Get Book by OpenLibrary ID
```bash
# Get a Work (OL...W)
GET /openlibrary/book/OL893415W

# Get an Edition (OL...M)
GET /openlibrary/book/OL59726263M
```

**Response (Work):**
```json
{
  "id": "OL893415W",
  "type": "work",
  "title": "Dune",
  "description": "Set on the desert planet Arrakis...",
  "subjects": ["Science Fiction", "Ecology", "Deserts"],
  "firstPublishDate": "1965",
  "mainCover": "https://covers.openlibrary.org/b/id/11481354-L.jpg",
  "covers": [
    {
      "id": 11481354,
      "small": "https://covers.openlibrary.org/b/id/11481354-S.jpg",
      "medium": "https://covers.openlibrary.org/b/id/11481354-M.jpg",
      "large": "https://covers.openlibrary.org/b/id/11481354-L.jpg"
    }
  ],
  "url": "https://openlibrary.org/works/OL893415W",
  "source": "openlibrary"
}
```

##### Get Book by ISBN (Shortcut)
```bash
GET /openlibrary/isbn/9780441172719
```

Returns the book data directly from ISBN lookup.

#### 🎮 RAWG Endpoints (API Key Required)

RAWG is the largest video game database with 500,000+ games. Get your free API key at [rawg.io/apidocs](https://rawg.io/apidocs).

**Authentication:**
- If `API_ENCRYPTION_KEY` is set: Use `X-Encrypted-Key` header with AES-256-GCM encrypted key
- If `API_ENCRYPTION_KEY` is NOT set: Use `X-Api-Key` header

##### Search Games
```bash
# Basic search
GET /rawg/search?q=zelda&max=10

# Advanced search with filters
GET /rawg/search?q=action&max=20&page=1&platforms=4,18&genres=action&ordering=-rating
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search query |
| `max` | `20` | Max results per page (up to 40) |
| `page` | `1` | Page number |
| `platforms` | - | Platform IDs (4=PC, 18=PS4, 1=Xbox One, 7=Switch) |
| `genres` | - | Genre slugs (action, adventure, rpg, etc.) |
| `ordering` | - | Sort field (-rating, -released, -metacritic) |
| `dates` | - | Date range (ex: 2020-01-01,2023-12-31) |
| `metacritic` | - | Metacritic range (ex: 80,100) |

**Response:**
```json
{
  "source": "rawg",
  "query": "zelda",
  "page": 1,
  "pageSize": 10,
  "totalResults": 158,
  "totalPages": 16,
  "hasNext": true,
  "hasPrevious": false,
  "count": 10,
  "games": [
    {
      "id": 22511,
      "slug": "the-legend-of-zelda-breath-of-the-wild",
      "name": "The Legend of Zelda: Breath of the Wild",
      "released": "2017-03-03",
      "backgroundImage": "https://media.rawg.io/media/games/...",
      "rating": 4.42,
      "ratingTop": 5,
      "ratingsCount": 8452,
      "metacritic": 97,
      "playtime": 75,
      "platforms": [
        { "id": 7, "name": "Nintendo Switch", "slug": "nintendo-switch" }
      ],
      "genres": [
        { "id": 4, "name": "Action", "slug": "action" },
        { "id": 3, "name": "Adventure", "slug": "adventure" }
      ],
      "esrbRating": { "id": 2, "name": "Everyone 10+", "slug": "everyone-10-plus" },
      "shortScreenshots": ["https://media.rawg.io/media/screenshots/..."],
      "url": "https://rawg.io/games/the-legend-of-zelda-breath-of-the-wild"
    }
  ]
}
```

##### Get Game Details
```bash
GET /rawg/game/22511
# Or by slug:
GET /rawg/game/the-legend-of-zelda-breath-of-the-wild
```

**Response:**
```json
{
  "source": "rawg",
  "id": 22511,
  "slug": "the-legend-of-zelda-breath-of-the-wild",
  "name": "The Legend of Zelda: Breath of the Wild",
  "nameOriginal": "The Legend of Zelda: Breath of the Wild",
  "description": "Step into a world of discovery...",
  "released": "2017-03-03",
  "tba": false,
  "backgroundImage": "https://media.rawg.io/media/games/...",
  "website": "https://www.zelda.com/breath-of-the-wild/",
  "rating": 4.42,
  "ratingTop": 5,
  "ratings": [
    { "id": 5, "title": "exceptional", "count": 5231, "percent": 61.9 }
  ],
  "metacritic": 97,
  "metacriticPlatforms": [
    { "platform": "Nintendo Switch", "score": 97, "url": "https://..." }
  ],
  "playtime": 75,
  "achievementsCount": 120,
  "platforms": [
    { "id": 7, "name": "Nintendo Switch", "slug": "nintendo-switch" }
  ],
  "genres": [
    { "id": 4, "name": "Action", "slug": "action" }
  ],
  "stores": [
    { "id": 6, "name": "Nintendo Store", "slug": "nintendo", "url": "https://..." }
  ],
  "developers": [
    { "id": 10681, "name": "Nintendo EPD", "slug": "nintendo-epd" }
  ],
  "publishers": [
    { "id": 10681, "name": "Nintendo", "slug": "nintendo" }
  ],
  "tags": [
    { "id": 31, "name": "Single-player", "slug": "singleplayer", "language": "eng" }
  ],
  "esrbRating": { "id": 2, "name": "Everyone 10+", "slug": "everyone-10-plus" },
  "clip": { "video": "https://...", "preview": "https://..." },
  "url": "https://rawg.io/games/the-legend-of-zelda-breath-of-the-wild"
}
```

#### 🕹️ IGDB Endpoints (API Key Required)

IGDB (Internet Game Database) is powered by Twitch. Get your credentials at [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps).

**Authentication:**
API key format: `clientId:clientSecret`
- If `API_ENCRYPTION_KEY` is set: Use `X-Encrypted-Key` header with encrypted key
- If `API_ENCRYPTION_KEY` is NOT set: Use `X-Api-Key` header

##### Search Games
```bash
# Basic search
GET /igdb/search?q=witcher&max=10

# Search with filters
GET /igdb/search?q=rpg&max=20&platforms=48,167&genres=12
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search query |
| `max` | `20` | Max results (up to 500) |
| `platforms` | - | Platform IDs (48=PS4, 167=PS5, 6=PC, 130=Switch) |
| `genres` | - | Genre IDs (12=RPG, 5=Shooter, 31=Adventure) |

**Response:**
```json
{
  "source": "igdb",
  "query": "witcher",
  "count": 10,
  "games": [
    {
      "id": 1942,
      "slug": "the-witcher-3-wild-hunt",
      "name": "The Witcher 3: Wild Hunt",
      "summary": "RPG and target third installment in...",
      "rating": 93.5,
      "aggregatedRating": 92.4,
      "totalRating": 92.9,
      "releaseDate": "2015-05-19",
      "cover": {
        "imageId": "co1wyy",
        "thumbnail": "https://images.igdb.com/igdb/image/upload/t_thumb/co1wyy.jpg",
        "coverSmall": "https://images.igdb.com/igdb/image/upload/t_cover_small/co1wyy.jpg",
        "coverBig": "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
        "hd": "https://images.igdb.com/igdb/image/upload/t_720p/co1wyy.jpg"
      },
      "genres": ["Role-playing (RPG)", "Adventure"],
      "platforms": [
        { "name": "PC (Microsoft Windows)", "abbreviation": "PC" },
        { "name": "PlayStation 4", "abbreviation": "PS4" }
      ],
      "developers": ["CD Projekt RED"],
      "publishers": ["CD Projekt"],
      "gameModes": ["Single player"],
      "themes": ["Action", "Fantasy", "Open world"],
      "screenshots": [
        {
          "imageId": "xxxx",
          "thumbnail": "https://images.igdb.com/igdb/image/upload/t_thumb/xxxx.jpg",
          "full": "https://images.igdb.com/igdb/image/upload/t_screenshot_big/xxxx.jpg"
        }
      ],
      "videos": [
        { "videoId": "c0i88t4Wctc", "youtubeUrl": "https://www.youtube.com/watch?v=c0i88t4Wctc" }
      ],
      "url": "https://www.igdb.com/games/the-witcher-3-wild-hunt"
    }
  ]
}
```

##### Get Game Details
```bash
GET /igdb/game/1942
# Or by slug:
GET /igdb/game/the-witcher-3-wild-hunt
```

**Response:**
```json
{
  "source": "igdb",
  "id": 1942,
  "slug": "the-witcher-3-wild-hunt",
  "name": "The Witcher 3: Wild Hunt",
  "summary": "RPG and target third installment...",
  "storyline": "The witcher Geralt of Rivia...",
  "rating": 93.5,
  "aggregatedRating": 92.4,
  "totalRating": 92.9,
  "ratingCount": 2500,
  "releaseDate": "2015-05-19",
  "cover": {
    "imageId": "co1wyy",
    "thumbnail": "https://images.igdb.com/igdb/image/upload/t_thumb/co1wyy.jpg",
    "coverBig": "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
    "hd": "https://images.igdb.com/igdb/image/upload/t_720p/co1wyy.jpg",
    "fullHd": "https://images.igdb.com/igdb/image/upload/t_1080p/co1wyy.jpg"
  },
  "artworks": [
    { "imageId": "xxx", "thumbnail": "...", "hd": "..." }
  ],
  "screenshots": [
    { "imageId": "xxx", "thumbnail": "...", "big": "..." }
  ],
  "genres": ["Role-playing (RPG)", "Adventure"],
  "platforms": [
    { "name": "PC (Microsoft Windows)", "abbreviation": "PC" }
  ],
  "developers": ["CD Projekt RED"],
  "publishers": ["CD Projekt", "Bandai Namco Entertainment"],
  "gameModes": ["Single player"],
  "themes": ["Action", "Fantasy", "Open world"],
  "playerPerspectives": ["Third person"],
  "keywords": ["rpg", "open world", "medieval"],
  "franchises": ["The Witcher"],
  "collection": "The Witcher",
  "ageRatings": [
    { "category": "PEGI", "rating": 18 },
    { "category": "ESRB", "rating": 17 }
  ],
  "videos": [
    { "name": "Launch Trailer", "videoId": "c0i88t4Wctc", "youtubeUrl": "https://www.youtube.com/watch?v=c0i88t4Wctc" }
  ],
  "websites": [
    { "url": "https://thewitcher.com/wiedzmin3/en/wild-hunt/", "category": "official" },
    { "url": "https://store.steampowered.com/app/292030", "category": "steam" }
  ],
  "similarGames": [
    { "name": "The Elder Scrolls V: Skyrim", "slug": "the-elder-scrolls-v-skyrim", "cover": "...", "url": "..." }
  ],
  "dlcs": [
    { "name": "Hearts of Stone", "slug": "hearts-of-stone" },
    { "name": "Blood and Wine", "slug": "blood-and-wine" }
  ],
  "expansions": [],
  "parentGame": null,
  "url": "https://www.igdb.com/games/the-witcher-3-wild-hunt"
}
```

#### 📺 TVDB Endpoints (API Key Required) 🆕

TVDB (TheTVDB) is a community-driven database for TV series and movies. Get your free API key at [thetvdb.com/api-information](https://thetvdb.com/api-information).

**Authentication:**
- If `API_ENCRYPTION_KEY` is set: Use `X-Encrypted-Key` header with encrypted key
- If `API_ENCRYPTION_KEY` is NOT set: Use `X-Api-Key` header

##### Search TV Series & Movies
```bash
# Basic search
GET /tvdb/search?q=breaking+bad

# Search with filters
GET /tvdb/search?q=breaking+bad&type=series&max=10&lang=fra&year=2008
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search query |
| `type` | - | Type filter: `series`, `movie`, `person`, `company` |
| `max` | `20` | Max results (up to 100) |
| `lang` | - | Language code (fra, eng, deu, spa, etc.) |
| `year` | - | Release/air year |

**Response:**
```json
{
  "query": "breaking bad",
  "type": "all",
  "total": 5,
  "results": [
    {
      "id": 81189,
      "type": "series",
      "name": "Breaking Bad",
      "slug": "breaking-bad",
      "year": 2008,
      "overview": "When Walter White, a chemistry teacher...",
      "primaryLanguage": "eng",
      "status": "Ended",
      "network": "AMC",
      "country": "usa",
      "thumbnail": "https://artworks.thetvdb.com/...",
      "image": "https://artworks.thetvdb.com/...",
      "url": "https://thetvdb.com/series/breaking-bad",
      "source": "tvdb"
    }
  ],
  "source": "tvdb"
}
```

##### Get Series Details
```bash
GET /tvdb/series/81189?lang=fra
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `:id` | required | TVDB series ID |
| `lang` | - | Language code for translation (fra, eng, etc.) |

**Response:**
```json
{
  "id": 81189,
  "type": "series",
  "name": "Breaking Bad",
  "originalName": "Breaking Bad",
  "slug": "breaking-bad",
  "overview": "A high school chemistry teacher diagnosed with...",
  "firstAired": "2008-01-20",
  "lastAired": "2013-09-29",
  "status": "Ended",
  "year": 2008,
  "averageRuntime": 47,
  "score": 1295066,
  "originalCountry": "usa",
  "originalLanguage": "eng",
  "image": "https://artworks.thetvdb.com/...",
  "artworks": [
    { "id": 123, "type": 1, "image": "...", "thumbnail": "...", "language": "eng", "score": 100 }
  ],
  "genres": [
    { "id": 1, "name": "Drama", "slug": "drama" },
    { "id": 2, "name": "Crime", "slug": "crime" }
  ],
  "characters": [
    { "id": 123, "name": "Walter White", "personName": "Bryan Cranston", "image": "...", "type": "actor" }
  ],
  "seasons": [
    { "id": 123, "number": 1, "name": "Season 1", "type": "official", "image": "..." }
  ],
  "companies": [
    { "id": 123, "name": "AMC", "slug": "amc", "country": "usa", "companyType": "Network" }
  ],
  "trailers": [
    { "id": 123, "name": "Official Trailer", "url": "https://youtube.com/...", "language": "eng" }
  ],
  "contentRatings": [...],
  "url": "https://thetvdb.com/series/breaking-bad",
  "source": "tvdb"
}
```

##### Get Movie Details
```bash
GET /tvdb/movie/12345?lang=fra
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `:id` | required | TVDB movie ID |
| `lang` | - | Language code for translation |

**Response:**
```json
{
  "id": 12345,
  "type": "movie",
  "name": "The Matrix",
  "originalName": "The Matrix",
  "slug": "the-matrix",
  "overview": "A computer hacker learns...",
  "year": 1999,
  "runtime": 136,
  "score": 100000,
  "status": "Released",
  "image": "https://artworks.thetvdb.com/...",
  "genres": [...],
  "characters": [...],
  "companies": [...],
  "releases": [
    { "country": "usa", "date": "1999-03-31", "detail": "Theatrical" }
  ],
  "boxOffice": 463517383,
  "budget": 63000000,
  "trailers": [...],
  "url": "https://thetvdb.com/movies/the-matrix",
  "source": "tvdb"
}
```

#### 🎬 TMDB Endpoints (API Key Required) 🆕

TMDB (The Movie Database) is a comprehensive movie and TV database. Get your free API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).

**Authentication:**
- If `API_ENCRYPTION_KEY` is set: Use `X-Encrypted-Key` header with encrypted key
- If `API_ENCRYPTION_KEY` is NOT set: Use `X-Api-Key` header

##### Search Movies, TV Shows & People
```bash
# Multi-search (movies, TV, people combined)
GET /tmdb/search?q=inception

# Search with filters
GET /tmdb/search?q=inception&type=movie&max=10&lang=fr-FR&year=2010
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search query |
| `type` | `multi` | Type filter: `movie`, `tv`, `person`, `multi` |
| `max` | `20` | Max results (up to 20 per page) |
| `lang` | `fr-FR` | Language (ISO 639-1 + ISO 3166-1, e.g., fr-FR, en-US) |
| `page` | `1` | Page number for pagination |
| `year` | - | Release/air year |
| `adult` | `false` | Include adult content |

**Response:**
```json
{
  "query": "inception",
  "searchType": "multi",
  "page": 1,
  "totalPages": 3,
  "totalResults": 45,
  "resultsOnPage": 20,
  "results": [
    {
      "id": 27205,
      "mediaType": "movie",
      "title": "Inception",
      "originalTitle": "Inception",
      "overview": "Cobb, a skilled thief who commits corporate espionage...",
      "releaseDate": "2010-07-16",
      "year": 2010,
      "popularity": 125.5,
      "voteAverage": 8.4,
      "voteCount": 32000,
      "originalLanguage": "en",
      "genreIds": [28, 878, 53],
      "poster": "https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Ber.jpg",
      "posterSmall": "https://image.tmdb.org/t/p/w185/9gk7adHYeDvHkCSEqAvQNLV5Ber.jpg",
      "backdrop": "https://image.tmdb.org/t/p/w1280/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
      "url": "https://www.themoviedb.org/movie/27205",
      "source": "tmdb"
    }
  ],
  "source": "tmdb"
}
```

##### Get Movie Details
```bash
GET /tmdb/movie/27205?lang=fr-FR
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `:id` | required | TMDB movie ID |
| `lang` | `fr-FR` | Language for localized content |

**Response:**
```json
{
  "id": 27205,
  "type": "movie",
  "imdbId": "tt1375666",
  "title": "Inception",
  "originalTitle": "Inception",
  "tagline": "Your mind is the scene of the crime.",
  "overview": "Cobb, a skilled thief who commits corporate espionage...",
  "releaseDate": "2010-07-16",
  "year": 2010,
  "runtime": 148,
  "status": "Released",
  "popularity": 125.5,
  "voteAverage": 8.4,
  "voteCount": 32000,
  "budget": 160000000,
  "revenue": 825532764,
  "originalLanguage": "en",
  "spokenLanguages": [
    { "code": "en", "name": "English", "englishName": "English" }
  ],
  "productionCountries": [
    { "code": "US", "name": "United States of America" }
  ],
  "poster": "https://image.tmdb.org/t/p/w500/...",
  "posterOriginal": "https://image.tmdb.org/t/p/original/...",
  "backdrop": "https://image.tmdb.org/t/p/w1280/...",
  "genres": [
    { "id": 28, "name": "Action" },
    { "id": 878, "name": "Science Fiction" }
  ],
  "productionCompanies": [
    { "id": 923, "name": "Legendary Pictures", "logo": "...", "country": "US" }
  ],
  "belongsToCollection": null,
  "cast": [
    { "id": 6193, "name": "Leonardo DiCaprio", "character": "Dom Cobb", "order": 0, "profile": "..." }
  ],
  "crew": [
    { "id": 525, "name": "Christopher Nolan", "job": "Director", "department": "Directing", "profile": "..." }
  ],
  "videos": [
    { "id": "xxx", "key": "YoHD9XEInc0", "name": "Official Trailer", "type": "Trailer", "url": "https://www.youtube.com/watch?v=YoHD9XEInc0" }
  ],
  "keywords": ["dream", "thief", "subconscious"],
  "externalIds": {
    "imdb": "tt1375666",
    "facebook": "inception",
    "wikidata": "Q25188"
  },
  "certifications": [
    { "country": "US", "certification": "PG-13", "releaseDate": "2010-07-16" }
  ],
  "recommendations": [...],
  "similar": [...],
  "homepage": "https://www.warnerbros.com/movies/inception",
  "url": "https://www.themoviedb.org/movie/27205",
  "source": "tmdb"
}
```

##### Get TV Show Details
```bash
GET /tmdb/tv/1396?lang=fr-FR
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `:id` | required | TMDB TV show ID |
| `lang` | `fr-FR` | Language for localized content |

**Response:**
```json
{
  "id": 1396,
  "type": "tv",
  "name": "Breaking Bad",
  "originalName": "Breaking Bad",
  "tagline": "All hail the king.",
  "overview": "When Walter White, a chemistry teacher...",
  "firstAirDate": "2008-01-20",
  "lastAirDate": "2013-09-29",
  "year": 2008,
  "status": "Ended",
  "tvType": "Scripted",
  "inProduction": false,
  "numberOfSeasons": 5,
  "numberOfEpisodes": 62,
  "episodeRunTime": [45, 47],
  "lastEpisodeToAir": {
    "id": 62161,
    "name": "Felina",
    "overview": "All bad things must come to an end.",
    "airDate": "2013-09-29",
    "seasonNumber": 5,
    "episodeNumber": 16
  },
  "popularity": 200.5,
  "voteAverage": 8.9,
  "voteCount": 10000,
  "poster": "https://image.tmdb.org/t/p/w500/...",
  "backdrop": "https://image.tmdb.org/t/p/w1280/...",
  "genres": [
    { "id": 18, "name": "Drama" },
    { "id": 80, "name": "Crime" }
  ],
  "networks": [
    { "id": 174, "name": "AMC", "logo": "...", "country": "US" }
  ],
  "createdBy": [
    { "id": 66633, "name": "Vince Gilligan", "profile": "..." }
  ],
  "seasons": [
    { "id": 3572, "name": "Season 1", "overview": "...", "seasonNumber": 1, "episodeCount": 7, "airDate": "2008-01-20", "poster": "..." }
  ],
  "cast": [...],
  "crew": [...],
  "videos": [...],
  "keywords": ["chemistry teacher", "drug dealer", "cancer"],
  "externalIds": {
    "imdb": "tt0903747",
    "tvdb": 81189,
    "facebook": "BreakingBad"
  },
  "contentRatings": [
    { "country": "US", "rating": "TV-MA" }
  ],
  "recommendations": [...],
  "similar": [...],
  "url": "https://www.themoviedb.org/tv/1396",
  "source": "tmdb"
}
```

#### 🎬 IMDB Endpoints (NO API KEY REQUIRED) 🆕

IMDB (Internet Movie Database) is the world's most popular movie database. Access is provided via [imdbapi.dev](https://imdbapi.dev) - **NO API KEY REQUIRED**!

##### Search Titles
```bash
GET /imdb/search?q=inception&max=10
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | required | Search query |
| `max` | optional | Max results (default: 20, max: 50) |

**Response:**
```json
{
  "query": "inception",
  "resultsCount": 3,
  "results": [
    {
      "id": "tt1375666",
      "type": "movie",
      "title": "Inception",
      "originalTitle": "Inception",
      "year": 2010,
      "runtimeMinutes": 148,
      "genres": ["Action", "Adventure", "Sci-Fi", "Thriller"],
      "rating": { "average": 8.8, "votes": 2759418 },
      "poster": "https://m.media-amazon.com/images/M/...",
      "isAdult": false,
      "url": "https://www.imdb.com/title/tt1375666/",
      "source": "imdb"
    }
  ],
  "source": "imdb"
}
```

##### Get Title Details
```bash
GET /imdb/title/tt1375666
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `:id` | required | IMDB title ID (format: tt1234567) |

**Response:**
```json
{
  "id": "tt1375666",
  "type": "movie",
  "title": "Inception",
  "originalTitle": "Inception",
  "year": 2010,
  "runtimeMinutes": 148,
  "isAdult": false,
  "rating": { "average": 8.8, "votes": 2759418 },
  "metacritic": { "score": 74, "reviewCount": 42 },
  "plot": "A thief who steals corporate secrets through the use of dream-sharing technology...",
  "genres": ["Action", "Adventure", "Sci-Fi", "Thriller"],
  "poster": "https://m.media-amazon.com/images/M/...",
  "directors": [
    { "id": "nm0634240", "name": "Christopher Nolan", "professions": ["director", "producer", "writer"] }
  ],
  "writers": [...],
  "stars": [
    { "id": "nm0000138", "name": "Leonardo DiCaprio", "professions": ["actor", "producer"] }
  ],
  "originCountries": [{ "code": "US", "name": "United States" }],
  "spokenLanguages": [{ "code": "eng", "name": "English" }],
  "interests": [{ "id": "in0000001", "name": "Action" }],
  "url": "https://www.imdb.com/title/tt1375666/",
  "source": "imdb"
}
```

##### Browse Titles with Filters
```bash
GET /imdb/browse?types=MOVIE&genres=Action,Sci-Fi&startYear=2020&endYear=2024&minRating=8&sortBy=SORT_BY_USER_RATING&sortOrder=DESC&max=20
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `types` | optional | Title types (comma-separated): `MOVIE`, `TV_SERIES`, `TV_MINI_SERIES`, `TV_SPECIAL`, `TV_MOVIE`, `SHORT`, `VIDEO`, `VIDEO_GAME` |
| `genres` | optional | Genres (comma-separated): `Action`, `Comedy`, `Drama`, `Horror`, `Sci-Fi`, etc. |
| `startYear` | optional | Start year filter |
| `endYear` | optional | End year filter |
| `minRating` | optional | Minimum rating (0-10) |
| `maxRating` | optional | Maximum rating (0-10) |
| `sortBy` | optional | Sort by: `SORT_BY_POPULARITY` (default), `SORT_BY_RELEASE_DATE`, `SORT_BY_USER_RATING`, `SORT_BY_USER_RATING_COUNT`, `SORT_BY_YEAR` |
| `sortOrder` | optional | Sort order: `ASC`, `DESC` (default) |
| `pageToken` | optional | Pagination token (from `nextPageToken` in response) |
| `max` | optional | Max results (default: 20, max: 50) |

**Response:**
```json
{
  "filters": {
    "types": ["MOVIE"],
    "genres": ["Action", "Sci-Fi"],
    "years": { "start": 2020, "end": 2024 },
    "rating": { "min": 8, "max": "any" },
    "sortBy": "SORT_BY_USER_RATING",
    "sortOrder": "DESC"
  },
  "totalCount": 512,
  "resultsCount": 20,
  "nextPageToken": "eyJlc1Rva2VuIj...",
  "results": [
    {
      "id": "tt6751668",
      "type": "movie",
      "title": "Parasite",
      "year": 2019,
      "rating": { "average": 8.5, "votes": 891234 },
      "genres": ["Comedy", "Drama", "Thriller"],
      "plot": "Greed and class discrimination threaten...",
      "poster": "https://m.media-amazon.com/images/M/...",
      "url": "https://www.imdb.com/title/tt6751668/",
      "source": "imdb"
    }
  ],
  "source": "imdb"
}
```

#### 🎌 Jikan Endpoints (Anime & Manga - NO API KEY REQUIRED) 🆕

Jikan is an unofficial REST API for MyAnimeList.net, providing access to anime and manga data.

##### Search Anime
```bash
GET /jikan/anime?q=naruto&max=25&page=1
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | required | Search query |
| `max` | optional | Max results per page (default: 25, max: 25) |
| `page` | optional | Page number for pagination (default: 1) |
| `type` | optional | Type filter: `tv`, `movie`, `ova`, `special`, `ona`, `music` |
| `status` | optional | Status filter: `airing`, `complete`, `upcoming` |
| `rating` | optional | Rating filter: `g`, `pg`, `pg13`, `r17`, `r`, `rx` |
| `orderBy` | optional | Sort by: `mal_id`, `title`, `start_date`, `end_date`, `episodes`, `score`, `scored_by`, `rank`, `popularity`, `members`, `favorites` |
| `sort` | optional | Sort order: `asc`, `desc` |

**Response:**
```json
{
  "query": "naruto",
  "pagination": {
    "currentPage": 1,
    "lastPage": 2,
    "hasNextPage": true,
    "totalResults": 30
  },
  "resultsCount": 25,
  "results": [
    {
      "id": 20,
      "type": "TV",
      "title": "Naruto",
      "titleEnglish": "Naruto",
      "titleJapanese": "ナルト",
      "titles": [
        { "type": "Default", "title": "Naruto" },
        { "type": "Japanese", "title": "ナルト" },
        { "type": "French", "title": "Naruto" }
      ],
      "episodes": 220,
      "status": "Finished Airing",
      "airing": false,
      "aired": {
        "from": "2002-10-03T00:00:00+00:00",
        "to": "2007-02-08T00:00:00+00:00",
        "string": "Oct 3, 2002 to Feb 8, 2007"
      },
      "duration": "23 min per ep",
      "rating": "PG-13 - Teens 13 or older",
      "score": 8.02,
      "scoredBy": 2101480,
      "rank": 667,
      "popularity": 9,
      "synopsis": "Twelve years ago, a colossal demon fox terrorized...",
      "genres": [{ "id": 1, "name": "Action" }, { "id": 2, "name": "Adventure" }],
      "studios": [{ "id": 1, "name": "Studio Pierrot" }],
      "poster": "https://cdn.myanimelist.net/images/anime/1141/142503l.jpg",
      "trailer": "https://www.youtube.com/watch?v=...",
      "url": "https://myanimelist.net/anime/20/Naruto",
      "source": "jikan_anime"
    }
  ],
  "source": "jikan_anime"
}
```

##### Get Anime Details
```bash
GET /jikan/anime/20
```

Returns full anime details including: relations, streaming platforms, external links, broadcast info, producers, licensors, etc.

##### Search Manga
```bash
GET /jikan/manga?q=one+piece&max=25&page=1
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | required | Search query |
| `max` | optional | Max results per page (default: 25, max: 25) |
| `page` | optional | Page number for pagination (default: 1) |
| `type` | optional | Type filter: `manga`, `novel`, `lightnovel`, `oneshot`, `doujin`, `manhwa`, `manhua` |
| `status` | optional | Status filter: `publishing`, `complete`, `hiatus`, `discontinued`, `upcoming` |
| `orderBy` | optional | Sort by: `mal_id`, `title`, `start_date`, `end_date`, `chapters`, `volumes`, `score`, `scored_by`, `rank`, `popularity`, `members`, `favorites` |
| `sort` | optional | Sort order: `asc`, `desc` |

**Response:**
```json
{
  "query": "one piece",
  "pagination": {
    "currentPage": 1,
    "lastPage": 3,
    "hasNextPage": true,
    "totalResults": 60
  },
  "resultsCount": 25,
  "results": [
    {
      "id": 13,
      "type": "Manga",
      "title": "One Piece",
      "titleEnglish": "One Piece",
      "titleJapanese": "ONE PIECE",
      "titles": [
        { "type": "Default", "title": "One Piece" },
        { "type": "French", "title": "One Piece" }
      ],
      "chapters": null,
      "volumes": null,
      "status": "Publishing",
      "publishing": true,
      "published": {
        "from": "1997-07-22T00:00:00+00:00",
        "to": null,
        "string": "Jul 22, 1997 to ?"
      },
      "score": 9.22,
      "scoredBy": 370000,
      "rank": 1,
      "popularity": 2,
      "synopsis": "Gol D. Roger, a man referred to as the King of the Pirates...",
      "authors": [{ "id": 1881, "name": "Oda, Eiichiro" }],
      "genres": [{ "id": 1, "name": "Action" }, { "id": 2, "name": "Adventure" }],
      "demographics": [{ "id": 27, "name": "Shounen" }],
      "poster": "https://cdn.myanimelist.net/images/manga/2/253146l.jpg",
      "url": "https://myanimelist.net/manga/13/One_Piece",
      "source": "jikan_manga"
    }
  ],
  "source": "jikan_manga"
}
```

##### Get Manga Details
```bash
GET /jikan/manga/11
```

Returns full manga details including: authors, serializations, relations, external links, etc.

> **Note:** Jikan provides titles in multiple languages when available in MyAnimeList, including French titles.

#### 🦸 Comic Vine Endpoints (US Comics) 🆕

Comic Vine is a comprehensive database for American comics, including characters, volumes, and issues.

##### Search Comics
```bash
GET /comicvine/search?q=batman&type=volume&max=20
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | required | Search query |
| `type` | optional | Resource type: `volume`, `issue`, `character`, `person` (default: volume) |
| `max` | optional | Max results (default: 20, max: 100) |

**Response:**
```json
{
  "query": "batman",
  "resourceType": "volume",
  "totalResults": 1234,
  "pageResults": 20,
  "resultsCount": 20,
  "results": [
    {
      "id": 796,
      "type": "volume",
      "name": "Batman",
      "aliases": ["The Dark Knight", "Caped Crusader"],
      "description": "The flagship Batman comic series...",
      "image": "https://comicvine.gamespot.com/a/uploads/original/...",
      "imageThumb": "https://comicvine.gamespot.com/a/uploads/scale_avatar/...",
      "issueCount": 713,
      "startYear": "1940",
      "publisher": {
        "id": 10,
        "name": "DC Comics"
      },
      "firstIssue": {
        "id": 6643,
        "name": "Batman",
        "issueNumber": "1"
      },
      "lastIssue": {
        "id": 987654,
        "name": "...",
        "issueNumber": "713"
      },
      "url": "https://comicvine.gamespot.com/batman/4050-796/",
      "source": "comicvine"
    }
  ],
  "source": "comicvine"
}
```

##### Get Volume Details
```bash
GET /comicvine/volume/796
```

Returns full volume details including: all issues, characters, locations, concepts, and creators.

##### Get Issue Details
```bash
GET /comicvine/issue/6643
```

Returns full issue details including: character appearances, teams, story arcs, and person credits.

> **Note:** Comic Vine requires an API key (configured server-side).

#### 📚 MangaDex Endpoints (Manga - NO API KEY REQUIRED) 🆕

MangaDex is a free manga reader with extensive multilingual support, including French translations.

##### Search Manga
```bash
GET /mangadex/search?q=one+piece&lang=fr&max=20
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | required | Search query |
| `lang` | optional | Filter by available language (e.g., `fr`, `en`, `ja`) |
| `max` | optional | Max results (default: 20, max: 100) |

**Response:**
```json
{
  "query": "one piece",
  "language": "fr",
  "totalResults": 45,
  "resultsCount": 20,
  "results": [
    {
      "id": "a1c7c817-4e59-43b7-9365-09675a149a6f",
      "type": "manga",
      "title": "ONE PIECE",
      "titleOriginal": "ワンピース",
      "altTitles": [
        { "lang": "ja", "title": "ワンピース" },
        { "lang": "fr", "title": "One Piece" },
        { "lang": "de", "title": "One Piece" }
      ],
      "description": "Gol D. Roger, a man referred to as the Pirate King...",
      "descriptionFr": "Il y a vingt-deux ans, Gol D. Roger, le légendaire pirate...",
      "originalLanguage": "ja",
      "status": "ongoing",
      "year": 1997,
      "contentRating": "suggestive",
      "demographic": "shounen",
      "lastChapter": null,
      "availableLanguages": ["en", "fr", "de", "es", "it", "pt-br", "ru", "ja"],
      "tags": [
        { "id": "...", "name": "Action", "group": "genre" },
        { "id": "...", "name": "Adventure", "group": "genre" }
      ],
      "authors": [{ "id": "...", "name": "Oda Eiichirou" }],
      "artists": [{ "id": "...", "name": "Oda Eiichirou" }],
      "cover": "https://uploads.mangadex.org/covers/.../cover.jpg",
      "coverThumb": "https://uploads.mangadex.org/covers/.../cover.jpg.256.jpg",
      "links": {
        "al": "30013",
        "mal": "13",
        "mu": "pb8uwds"
      },
      "url": "https://mangadex.org/title/a1c7c817-4e59-43b7-9365-09675a149a6f",
      "source": "mangadex"
    }
  ],
  "source": "mangadex"
}
```

##### Get Manga Details
```bash
GET /mangadex/manga/a1c7c817-4e59-43b7-9365-09675a149a6f
```

Returns full manga details including: descriptions in all available languages, all alternate titles, author biographies, etc.

> **Note:** MangaDex supports French translations! Use `lang=fr` to filter manga with French chapters available.

#### 📖 Bedetheque Endpoints (Franco-Belgian Comics - Scraping) 🆕

Bedetheque is the largest French database for Franco-Belgian comics (bandes dessinées), manga, and comics in French.

##### Search Series
```bash
GET /bedetheque/search?q=asterix&max=20
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | required | Search query |
| `max` | optional | Max results (default: 20, max: 50) |

**Response:**
```json
{
  "query": "asterix",
  "resultsCount": 5,
  "results": [
    {
      "id": 91,
      "type": "serie",
      "name": "Astérix",
      "url": "https://www.bedetheque.com/serie-91-BD-Asterix.html",
      "source": "bedetheque"
    }
  ],
  "source": "bedetheque",
  "note": "Résultats de recherche par scraping - certaines données peuvent être incomplètes"
}
```

##### Get Series Details
```bash
GET /bedetheque/serie/91
```

**Response:**
```json
{
  "id": 91,
  "type": "serie",
  "name": "Astérix",
  "synopsis": "Les aventures d'un village gaulois résistant à l'envahisseur romain...",
  "cover": "https://www.bedetheque.com/media/...",
  "genre": "Humour",
  "status": "En cours",
  "authors": ["René Goscinny", "Albert Uderzo", "Jean-Yves Ferri", "Didier Conrad"],
  "albumCount": 40,
  "albums": [
    {
      "id": 1721,
      "title": "1. Astérix le Gaulois",
      "url": "https://www.bedetheque.com/BD-Asterix-Tome-1-Asterix-le-Gaulois-1721.html",
      "source": "bedetheque"
    }
  ],
  "url": "https://www.bedetheque.com/serie-91-BD-Asterix.html",
  "source": "bedetheque"
}
```

##### Get Album Details
```bash
GET /bedetheque/album/1721
```

**Response:**
```json
{
  "id": 1721,
  "type": "album",
  "title": "Astérix le Gaulois",
  "serie": {
    "id": 91,
    "name": "Astérix"
  },
  "tome": 1,
  "cover": "https://www.bedetheque.com/media/Couvertures/...",
  "synopsis": "La première aventure d'Astérix et Obélix...",
  "isbn": "9782012101340",
  "releaseDate": "01/01/1961",
  "publisher": "Dargaud",
  "authors": ["René Goscinny", "Albert Uderzo"],
  "price": 10.95,
  "pages": 48,
  "url": "https://www.bedetheque.com/BD-Asterix-Tome-1-Asterix-le-Gaulois-1721.html",
  "source": "bedetheque"
}
```

> **⚠️ Note:** Bedetheque uses web scraping via FlareSolverr, which means:
> - Results may be slower due to anti-bot protection bypass
> - Some data fields may be incomplete or unavailable
> - This is the best French-language source for Franco-Belgian comics (BD)

#### 🎮 ConsoleVariations Endpoints (Consoles & Accessories - Scraping) 🆕

Database of video game console variations, bundles and accessories (11,000+ collectibles).

##### Search Consoles/Accessories
```bash
GET /consolevariations/search?q=playstation+5&type=consoles&max=20
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search term |
| `type` | `all` | Search type: `all`, `consoles`, `controllers`, `accessories` |
| `max` | `20` | Maximum number of results |

**`type` parameter values:**
- `all` : Search all types (consoles and accessories)
- `consoles` : Consoles and bundles only
- `controllers` : Controllers only
- `accessories` : Accessories only (cables, etc.)

##### Get Item Details
```bash
GET /consolevariations/item/nes-mattel-super-mario-bros-bundle-uk
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `:slug` | required | Item slug (from URL) |

**Response:**
```json
{
  "source": "consolevariations",
  "slug": "nes-mattel-super-mario-bros-bundle-uk",
  "name": "Nintendo NES Mattel Super Mario Bros. Bundle [UK]",
  "url": "https://consolevariations.com/collectibles/nes-mattel-super-mario-bros-bundle-uk",
  "brand": "Nintendo",
  "platform": {
    "slug": "nes",
    "name": "NES"
  },
  "images": [
    {
      "id": 26414,
      "url": "https://cdn.consolevariations.com/26414/zktkYK...",
      "thumbnail": "https://cdn.consolevariations.com/26414/zktkYK...",
      "alt": "(Front View)",
      "contributor": {
        "id": 5530,
        "username": "robhlark"
      }
    }
  ],
  "details": {
    "releaseCountry": "United Kingdom",
    "releaseYear": 1987,
    "releaseType": "Official",
    "regionCode": "PAL",
    "amountProduced": "Between 50k - 100k",
    "limitedEdition": null,
    "isBundle": true,
    "color": null,
    "barcode": "074299009013"
  },
  "stats": {
    "rarityScore": 39,
    "userScore": "Common",
    "wantCount": 6,
    "ownCount": 7
  }
}
```

##### List Platforms/Brands
```bash
# List all brands
GET /consolevariations/platforms

# List platforms for a brand
GET /consolevariations/platforms?brand=nintendo
GET /consolevariations/platforms?brand=sony
GET /consolevariations/platforms?brand=microsoft
GET /consolevariations/platforms?brand=sega
```

##### Browse a Platform
```bash
GET /consolevariations/browse/nes?max=20
GET /consolevariations/browse/sony-playstation?max=30
GET /consolevariations/browse/xbox-series-x?max=10
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `:platform` | required | Platform slug |
| `max` | `20` | Maximum number of results |

> **⚠️ Note:** ConsoleVariations uses web scraping via FlareSolverr.

#### � Amazon Endpoints (Multi-country Marketplace Scraper) 🆕

Scrape products from Amazon across 8 different countries with category filtering.

**Supported marketplaces:** 🇫🇷 France, 🇺🇸 USA, 🇬🇧 UK, 🇩🇪 Germany, 🇪🇸 Spain, 🇮🇹 Italy, 🇯🇵 Japan, 🇨🇦 Canada

**Supported categories:** `videogames`, `toys`, `books`, `music`, `movies`

##### List Supported Marketplaces
```bash
GET /amazon/marketplaces
```

**Response:**
```json
{
  "count": 8,
  "marketplaces": [
    { "code": "fr", "name": "Amazon France", "domain": "www.amazon.fr", "currency": "EUR" },
    { "code": "us", "name": "Amazon US", "domain": "www.amazon.com", "currency": "USD" },
    { "code": "uk", "name": "Amazon UK", "domain": "www.amazon.co.uk", "currency": "GBP" },
    { "code": "de", "name": "Amazon Allemagne", "domain": "www.amazon.de", "currency": "EUR" },
    { "code": "es", "name": "Amazon Espagne", "domain": "www.amazon.es", "currency": "EUR" },
    { "code": "it", "name": "Amazon Italie", "domain": "www.amazon.it", "currency": "EUR" },
    { "code": "jp", "name": "Amazon Japon", "domain": "www.amazon.co.jp", "currency": "JPY" },
    { "code": "ca", "name": "Amazon Canada", "domain": "www.amazon.ca", "currency": "CAD" }
  ]
}
```

##### List Supported Categories
```bash
GET /amazon/categories
```

##### Search Products
```bash
GET /amazon/search?q=zelda&country=fr&category=videogames&max=20
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search query |
| `country` | `fr` | Country code: `fr`, `us`, `uk`, `de`, `es`, `it`, `jp`, `ca` |
| `category` | all | Category filter: `videogames`, `toys`, `books`, `music`, `movies` |
| `page` | `1` | Page number |
| `max` | `20` | Max results per page |

**Response:**
```json
{
  "query": "zelda",
  "country": "fr",
  "marketplace": "Amazon France",
  "category": "videogames",
  "page": 1,
  "total": 15,
  "results": [
    {
      "asin": "B0BVZB4Q1W",
      "title": "The Legend of Zelda: Tears of the Kingdom",
      "image": "https://m.media-amazon.com/images/I/...",
      "price": "59,99 €",
      "priceValue": 59.99,
      "currency": "EUR",
      "isPrime": true,
      "source": "amazon",
      "marketplace": "fr",
      "url": "https://www.amazon.fr/dp/B0BVZB4Q1W"
    }
  ]
}
```

##### Get Product Details by ASIN
```bash
GET /amazon/product/B0BVZB4Q1W?country=fr
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `:asin` | required | Amazon ASIN (10 alphanumeric chars) |
| `country` | `fr` | Country code |

**Response:**
```json
{
  "asin": "B0BVZB4Q1W",
  "title": "The Legend of Zelda: Tears of the Kingdom",
  "images": ["https://m.media-amazon.com/images/I/..."],
  "image": "https://m.media-amazon.com/images/I/...",
  "price": "59,99 €",
  "priceValue": 59.99,
  "currency": "EUR",
  "rating": 4.8,
  "reviewCount": 12534,
  "brand": "Nintendo",
  "description": "Explorez les vastes étendues...",
  "isPrime": true,
  "availability": "in_stock",
  "details": {
    "Plateforme": "Nintendo Switch",
    "Éditeur": "Nintendo"
  },
  "barcode": "0045496510725",
  "barcodeType": "UPC",
  "source": "amazon",
  "marketplace": "fr",
  "url": "https://www.amazon.fr/dp/B0BVZB4Q1W"
}
```

##### Search by Barcode (EAN/UPC)
```bash
GET /amazon/barcode/0045496510725?country=fr&category=videogames
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `:code` | required | Barcode (8-14 digits) |
| `country` | `fr` | Country code |
| `category` | all | Category filter |

##### Multi-country Search
```bash
GET /amazon/multi-search?q=zelda&countries=fr,us,uk,de&category=videogames
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | required | Search query |
| `countries` | `fr,us,uk` | Comma-separated country codes |
| `category` | all | Category filter |
| `max` | `10` | Max results per country |

**Response:**
```json
{
  "query": "zelda",
  "countries": ["fr", "us", "uk", "de"],
  "results": {
    "fr": { "total": 12, "results": [...] },
    "us": { "total": 15, "results": [...] },
    "uk": { "total": 10, "results": [...] },
    "de": { "total": 8, "results": [...] }
  },
  "errors": { "de": "Timeout" }  // Erreurs éventuelles
}
```

##### Compare Prices Across Countries
```bash
GET /amazon/compare/B0BVZB4Q1W?countries=fr,us,uk,de,es
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `:asin` | required | Amazon ASIN |
| `countries` | `fr,us,uk,de,es` | Countries to compare |

**Response:**
```json
{
  "asin": "B0BVZB4Q1W",
  "prices": [
    { "country": "es", "marketplace": "Amazon Espagne", "price": "49,99 €", "priceValue": 49.99, "currency": "EUR", "isPrime": true, "availability": "in_stock", "url": "https://www.amazon.es/dp/B0BVZB4Q1W" },
    { "country": "us", "marketplace": "Amazon US", "price": "$54.99", "priceValue": 54.99, "currency": "USD", "isPrime": true, "availability": "in_stock", "url": "https://www.amazon.com/dp/B0BVZB4Q1W" },
    { "country": "fr", "marketplace": "Amazon France", "price": "59,99 €", "priceValue": 59.99, "currency": "EUR", "isPrime": true, "availability": "in_stock", "url": "https://www.amazon.fr/dp/B0BVZB4Q1W" }
  ],
  "bestPrice": {
    "country": "es",
    "marketplace": "Amazon Espagne",
    "price": "49,99 €",
    "priceValue": 49.99,
    "currency": "EUR"
  }
}
```

> **⚠️ Notes importantes sur Amazon:**
> - Les requêtes utilisent FlareSolverr pour contourner la protection anti-bot
> - Un délai de ~1.5s est appliqué entre les requêtes multi-pays pour éviter les blocages
> - Les données sont scrapées depuis le HTML et peuvent varier selon les mises à jour du site
> - Cache de 10 minutes pour réduire la charge sur Amazon
> - En cas de blocage CAPTCHA, l'erreur sera retournée explicitement

#### �🔐 Crypto Endpoints

##### Encrypt an API Key
```bash
POST /crypto/encrypt
Content-Type: application/json


{"key": "your-rebrickable-api-key"}
```

**Response:**
```json
{
  "encrypted": "base64-encoded-encrypted-key",
  "usage": "Utilisez cette valeur dans le header X-Encrypted-Key"
}
```

> **Note:** This endpoint is only available when `API_ENCRYPTION_KEY` is configured.

#### 🔧 System Endpoints

##### Health Check with Metrics
```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "fsr": "http://10.110.1.1:8191/v1",
  "uptime": "3600s",
  "cache": {
    "size": 15,
    "maxSize": 100,
    "ttl": 300,
    "hitRate": "45%"
  },
  "metrics": {
    "requests": {
      "total": 150,
      "cached": 68,
      "errors": 2
    },
    "avgResponseTime": "1250ms",
    "sources": {
      "lego": { "requests": 50, "errors": 1 },
      "coleka": { "requests": 40, "errors": 0 },
      "luluberlu": { "requests": 30, "errors": 1 },
      "transformerland": { "requests": 20, "errors": 0 },
      "paninimania": { "requests": 10, "errors": 0 },
      "rebrickable": { "requests": 15, "errors": 0 }
    }
  },
  "compression": "gzip enabled"
}
```

##### API Version & Endpoints List
```bash
GET /version
```

##### Clear Cache
```bash
DELETE /cache
```

##### Reset Metrics
```bash
DELETE /metrics
```

### Docker Compose Example

```yaml
version: "3.9"

services:
  toys_api:
    image: nimai24/toys_api:latest
    container_name: toys_api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - FSR_URL=http://flaresolverr:8191/v1
      - DEFAULT_LOCALE=en-US
      - MAX_RETRIES=3
      - CACHE_TTL=300000
      - CACHE_MAX_SIZE=100
    depends_on:
      - flaresolverr
    networks:
      - toys-net

  flaresolverr:
    image: ghcr.io/flaresolverr/flaresolverr:latest
    container_name: flaresolverr
    restart: unless-stopped
    ports:
      - "8191:8191"
    environment:
      - LOG_LEVEL=info
    networks:
      - toys-net

networks:
  toys-net:
    driver: bridge
```

---


```bash
GET /health
```

### Exemple Docker Compose

```yaml
version: "3.9"

services:
  toys_api:
    image: nimai24/toys_api:latest
    container_name: toys_api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - FSR_URL=http://flaresolverr:8191/v1
      - DEFAULT_LOCALE=fr-FR
      - MAX_RETRIES=3
    depends_on:
      - flaresolverr
    networks:
      - toys-net

  flaresolverr:
    image: ghcr.io/flaresolverr/flaresolverr:latest
    container_name: flaresolverr
    restart: unless-stopped
    ports:
      - "8191:8191"
    environment:
      - LOG_LEVEL=info
    networks:
      - toys-net

networks:
  toys-net:
    driver: bridge
```

### Exemples d'Utilisation avec cURL

```bash
# Recherche de produits Star Wars (LEGO)
curl "http://localhost:3000/lego/search?q=star+wars&lang=fr-FR"

# Détails du produit 75192 (Millennium Falcon)
curl "http://localhost:3000/lego/product/75192?lang=fr-FR"

# Produit LEGO enrichi avec Rebrickable (pièces, minifigs)
curl -H "X-Api-Key: votre-clé-rebrickable" \
  "http://localhost:3000/lego/product/75192?lang=fr-FR&enrich=true"

# Recherche sur Rebrickable
curl -H "X-Api-Key: votre-clé-rebrickable" \
  "http://localhost:3000/rebrickable/search?q=millennium+falcon&max=5"

# Set Rebrickable enrichi avec données LEGO officielles
curl -H "X-Api-Key: votre-clé-rebrickable" \
  "http://localhost:3000/rebrickable/set/75192-1?enrich=true&lang=fr-FR"

# Recherche de livres sur Google Books (en français)
curl -H "X-Api-Key: votre-clé-google" \
  "http://localhost:3000/googlebooks/search?q=harry+potter&lang=fr&max=5"

# Recherche par ISBN sur Google Books
curl -H "X-Api-Key: votre-clé-google" \
  "http://localhost:3000/googlebooks/isbn/9782070584628"

# Recherche sur OpenLibrary (gratuit, pas de clé)
curl "http://localhost:3000/openlibrary/search?q=dune+frank+herbert&max=5"

# Recherche par ISBN sur OpenLibrary
curl "http://localhost:3000/openlibrary/isbn/9780441172719"

# Détails d'une œuvre OpenLibrary
curl "http://localhost:3000/openlibrary/book/OL893415W"

# Recherche de jeux vidéo sur RAWG
curl -H "X-Api-Key: votre-clé-rawg" \
  "http://localhost:3000/rawg/search?q=zelda&max=10"

# Détails d'un jeu sur RAWG
curl -H "X-Api-Key: votre-clé-rawg" \
  "http://localhost:3000/rawg/game/the-legend-of-zelda-breath-of-the-wild"

# Recherche de jeux vidéo sur IGDB
curl -H "X-Api-Key: clientId:clientSecret" \
  "http://localhost:3000/igdb/search?q=witcher&max=10"

# Détails d'un jeu sur IGDB
curl -H "X-Api-Key: clientId:clientSecret" \
  "http://localhost:3000/igdb/game/the-witcher-3-wild-hunt"

# Recherche de séries/films sur TVDB
curl -H "X-Api-Key: votre-clé-tvdb" \
  "http://localhost:3000/tvdb/search?q=breaking+bad&type=series&lang=fra"

# Détails d'une série sur TVDB
curl -H "X-Api-Key: votre-clé-tvdb" \
  "http://localhost:3000/tvdb/series/81189?lang=fra"

# Recherche de films/séries sur TMDB
curl -H "X-Api-Key: votre-clé-tmdb" \
  "http://localhost:3000/tmdb/search?q=inception&type=movie&lang=fr-FR"

# Détails d'un film sur TMDB
curl -H "X-Api-Key: votre-clé-tmdb" \
  "http://localhost:3000/tmdb/movie/27205?lang=fr-FR"

# Détails d'une série TV sur TMDB
curl -H "X-Api-Key: votre-clé-tmdb" \
  "http://localhost:3000/tmdb/tv/1396?lang=fr-FR"

# Recherche de films/séries sur IMDB (SANS clé API !)
curl "http://localhost:3000/imdb/search?q=inception&max=5"

# Détails d'un titre sur IMDB (SANS clé API !)
curl "http://localhost:3000/imdb/title/tt1375666"

# Parcourir les films IMDB avec filtres (SANS clé API !)
curl "http://localhost:3000/imdb/browse?types=MOVIE&genres=Action&startYear=2020&minRating=8&max=10"

# Recherche sur Lulu-Berlu
curl "http://localhost:3000/luluberlu/search?q=final+fantasy&max=12"

# Détails d'un article Lulu-Berlu
curl "http://localhost:3000/luluberlu/item/78643"

# Recherche sur Paninimania (albums d'autocollants)
curl "http://localhost:3000/paninimania/search?q=pokemon&max=10"

# Détails d'un album Paninimania
curl "http://localhost:3000/paninimania/album/7423"

# 🆕 Recherche Mega Construx (multi-langue)
curl "http://localhost:3000/mega/search?q=halo&lang=en-US&max=20"
curl "http://localhost:3000/mega/search?q=pokemon&lang=fr-FR&max=20"

# 🆕 Instructions Mega Construx
curl "http://localhost:3000/mega/instructions?franchise=halo&max=20"
curl "http://localhost:3000/mega/instructions/HHC21"

# 🆕 Identification par code-barres (UPC/EAN/ISBN auto-détecté)
curl "http://localhost:3000/barcode/012345678905"
curl "http://localhost:3000/barcode/9782070612758?lang=fr"

# 🆕 Détection du type de code-barres
curl "http://localhost:3000/barcode/detect/9782070612758"

# 🆕 Recherche de livres par ISBN
curl "http://localhost:3000/barcode/isbn/9782070612758?lang=fr"

# 🆕 Recherche d'albums de musique
curl "http://localhost:3000/music/search?q=random+access+memories&artist=daft+punk&lang=fr"

# 🆕 Album de musique par code-barres (CD/vinyle)
curl "http://localhost:3000/music/barcode/886443927087"

# Vérification que l'API fonctionne
curl "http://localhost:3000/health"
```

---

## � Format Harmonisé Livres

Les endpoints de recherche de livres suivants utilisent un **format de réponse harmonisé** pour faciliter l'intégration :

### Sources harmonisées
- `/googlebooks/search` (Google Books)
- `/googlebooks/isbn/:isbn` (Google Books)
- `/openlibrary/search` (OpenLibrary)
- `/openlibrary/book/:olId` (OpenLibrary)
- `/openlibrary/isbn/:isbn` (OpenLibrary)
- `/jikan/manga` (Jikan/MyAnimeList)
- `/jikan/manga/:id` (Jikan/MyAnimeList)
- `/mangadex/search` (MangaDex)
- `/mangadex/manga/:id` (MangaDex)
- `/comicvine/search` (Comic Vine)
- `/comicvine/volume/:id` (Comic Vine)
- `/comicvine/issue/:id` (Comic Vine)
- `/bedetheque/serie/:id` (Bedetheque)
- `/bedetheque/album/:id` (Bedetheque)

### Structure de réponse

```json
{
  "id": "string|number",
  "type": "string",
  "title": "string",
  "originalTitle": "string|null",
  "authors": ["string"],
  "editors": ["string"],
  "releaseDate": "string|null",
  "genres": ["string"],
  "pages": "number|null",
  "serie": {"id": "string", "name": "string"} | null,
  "synopsis": "string|null",
  "language": "string",
  "tome": "number|null",
  "image": ["string"],
  "isbn": "string|null",
  "price": "number|null",
  "url": "string",
  "source": "string"
}
```

### Disponibilité des champs par source

| Champ | Google Books | OpenLibrary | Jikan | MangaDex | Comic Vine | Bedetheque |
|-------|:------------:|:-----------:|:-----:|:--------:|:----------:|:----------:|
| `title` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `originalTitle` | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `authors` | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| `editors` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `releaseDate` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `genres` | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ |
| `pages` | ✅ | ⚠️ | ❌ | ❌ | ❌ | ✅ |
| `serie` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `synopsis` | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| `language` | ✅ | ✅ | ✅ ja | ✅ | ✅ en | ✅ fr |
| `tome` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `image` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `isbn` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `price` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Légende :** ✅ = disponible | ⚠️ = partiel | ❌ = `null` ou `[]`

### Notes sur le champ `image`

Le champ `image` est un **tableau** pouvant contenir plusieurs URLs d'images (différentes tailles/résolutions) :

```json
{
  "image": [
    "https://example.com/cover-large.jpg",
    "https://example.com/cover-medium.jpg",
    "https://example.com/cover-small.jpg"
  ]
}
```

- **Google Books Detail** : jusqu'à 5 tailles (extraLarge, large, medium, small, thumbnail)
- **Jikan/MangaDex** : jusqu'à 3 tailles
- **Comic Vine** : jusqu'à 3 tailles (original, medium, thumb)
- **Bedetheque** : 1 image (couverture)

### Source non harmonisée : Paninimania

Les endpoints Paninimania (`/paninimania/search`, `/paninimania/album/:id`) conservent leur format spécifique adapté aux albums de vignettes (checklist, images spéciales, etc.).

---

## 🎮 Format Harmonisé Jeux Vidéo

Les endpoints de jeux vidéo utilisent un **format harmonisé** avec les champs suivants :

### Sources disponibles
- `/igdb/search`, `/igdb/game/:id` (IGDB/Twitch) 🔑
- `/rawg/search`, `/rawg/game/:id` (RAWG) 🔑
- `/jvc/search`, `/jvc/game/:id` (JeuxVideo.com) 🇫🇷

### Structure de réponse commune

```json
{
  "id": "number|string",
  "slug": "string",
  "name": "string",
  "image": ["string"],
  "description": "string|null",
  "releaseDate": "string|null",
  "platforms": ["object"],
  "genres": ["string|object"],
  "developers": ["string|object"],
  "publishers": ["string|object"],
  "pegi": "string|null",
  "minAge": "number|null",
  "isMultiplayer": "boolean",
  "rating": "number|null",
  "url": "string",
  "source": "string"
}
```

### Disponibilité des champs par source

| Champ | IGDB | RAWG | JVC |
|-------|:----:|:----:|:---:|
| `name/title` | ✅ | ✅ | ✅ |
| `image[]` | ✅ (cover + artworks + screenshots) | ✅ (background images) | ✅ (cover) |
| `description/summary` | ✅ | ✅ | ✅ |
| `releaseDate` | ✅ | ✅ | ✅ |
| `platforms` | ✅ (avec abbreviation) | ✅ (avec slug) | ✅ (noms FR) |
| `genres` | ✅ (noms EN) | ✅ (avec slug) | ✅ (noms FR) |
| `developers` | ✅ | ✅ | ⚠️ |
| `publishers` | ✅ | ✅ | ✅ |
| `pegi` | ✅ "PEGI 12" | ✅ "Everyone 10+" (ESRB) | ✅ "+12 ans" |
| `minAge` | ✅ | ✅ | ✅ |
| `isMultiplayer` | ✅ | ✅ | ✅ |
| `rating` | ✅ (0-100) | ✅ (0-100, normalisé) | ✅ (0-100, normalisé) |
| `_raw.metacritic` | ❌ | ✅ | ❌ |
| `_raw.ageRatings[]` | ✅ (PEGI/ESRB/USK/CERO) | ❌ | ❌ |
| `_raw.videos` | ✅ (YouTube) | ❌ | ❌ |
| `_raw.similarGames` | ✅ | ❌ | ❌ |
| `_raw.dlcs` | ✅ | ❌ | ❌ |
| `_raw.franchises` | ✅ | ❌ | ❌ |

**Légende :** ✅ = disponible | ⚠️ = partiel | ❌ = non disponible

### Structure de réponse harmonisée (v1.23.0+)

Tous les endpoints de détails (`/igdb/game/:id`, `/rawg/game/:id`, `/jvc/game/:id`) retournent maintenant un format harmonisé :

```json
{
  "source": "igdb",
  "id": 7346,
  "slug": "the-legend-of-zelda-breath-of-the-wild",
  "title": "The Legend of Zelda: Breath of the Wild",
  "image": ["https://...cover.jpg", "https://...artwork.jpg"],
  "synopsis": "The Legend of Zelda: Breath of the Wild is...",
  "releaseDate": "2017-03-03",
  "platforms": ["Nintendo Switch", "Wii U"],
  "genres": ["Puzzle", "Adventure"],
  "developers": ["Nintendo EPD Production Group No. 3"],
  "publishers": ["Nintendo"],
  "pegi": "PEGI 12",
  "minAge": 12,
  "isMultiplayer": false,
  "rating": 95,
  "url": "https://www.igdb.com/games/...",
  "_raw": {
    "storyline": "...",
    "videos": [...],
    "similarGames": [...],
    "dlcs": [...]
  }
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `title` | `string` | Titre du jeu (harmonisé depuis `name`/`title`) |
| `synopsis` | `string\|null` | Description/résumé (harmonisé depuis `summary`/`description`) |
| `releaseDate` | `string\|null` | Date au format ISO (harmonisé depuis `released`/`releaseDate`) |
| `platforms` | `string[]` | Liste de noms de plateformes |
| `genres` | `string[]` | Liste de noms de genres |
| `developers` | `string[]` | Liste de noms de développeurs |
| `publishers` | `string[]` | Liste de noms d'éditeurs |
| `rating` | `number\|null` | Note normalisée 0-100 |
| `_raw` | `object` | Données spécifiques à la source |

### Notes sur les classifications d'âge

| Source | Système | Format | Exemple |
|--------|---------|--------|---------|
| **IGDB** | PEGI, ESRB, USK, CERO, ACB | Array `_raw.ageRatings[]` + `pegi` | `"PEGI 12"`, `"E10+"` |
| **RAWG** | ESRB uniquement | `_raw.esrbRating` + `pegi` | `"Everyone 10+"` |
| **JVC** | PEGI (format français) | `pegi` | `"+12 ans"` |

### Recommandations d'utilisation

- **IGDB** : Meilleure source pour les données complètes (artworks, vidéos, DLCs, franchises, classifications multi-régions)
- **RAWG** : Bonne alternative avec score Metacritic et tags détaillés
- **JVC** : Source idéale pour les informations en **français** (descriptions, genres, PEGI)

---

## 📝 Notes

- Cette API scrappe le site officiel LEGO. Utilisez-la de manière responsable.
- FlareSolverr est requis pour contourner les protections Cloudflare.
- Les temps de réponse peuvent varier selon le niveau de protection Cloudflare.
- Google Books nécessite une clé API (gratuite avec quota).
- OpenLibrary est entièrement gratuit et ne nécessite pas de clé.
- TVDB nécessite une clé API (gratuite sur thetvdb.com).
- TMDB nécessite une clé API (gratuite sur themoviedb.org).
- **IMDB ne nécessite AUCUNE clé API** - Accès gratuit via imdbapi.dev.
- **Mega Construx** - Multi-langue sans clé API (US/EU). 🆕
- **Barcode** - Identification UPC/EAN/ISBN sans clé API. 🆕
- **Music** - MusicBrainz, Deezer, iTunes sans clé API. Discogs recommande un token. 🆕
- Rebrickable nécessite une clé API gratuite.

## 🐛 Dépannage

| Problème | Solution |
|----------|----------|
| `FlareSolverr error` | Vérifiez que FSR_URL est correct et que FlareSolverr fonctionne |
| `No products found` | Essayez un autre terme de recherche ou vérifiez la locale |
| `Timeout` | Augmentez MAX_RETRIES ou vérifiez le réseau |
| `API key required` | Fournissez une clé API via X-Api-Key ou X-Encrypted-Key |
| `Invalid ISBN` | Vérifiez le format ISBN-10 ou ISBN-13 |

## 📄 Licence

Licence MIT

---

## 📦 Changelog

### v3.1.1 🔧 (2025-12-18)
- 🐛 **Fix FlareSolverr sessions** : Les providers collectibles (Coleka, LuluBerlu, Transformerland, Paninimania, ConsoleVariations) passent désormais correctement le `sessionId` aux requêtes FSR
  - Résout le problème des challenges anti-bot "résolus" mais sans cookies partagés
- 🐛 **Fix mapping collectibles** : Route Coleka et LuluBerlu utilisaient `results/items` au lieu de `products`
  - Ajout des champs `url`, `category`, `collection` dans la réponse
- 🔑 **Fix ComicVine API key** : Le provider accepte maintenant la clé via header `X-Api-Key`
  - Ajout du middleware `requireApiKey('Comic Vine')` sur les routes ComicVine

### v3.1.0 (2025)
- 🛤️ **Routes normalisées** : Structure unifiée `/search`, `/details`, `/code` pour tous les providers
  - Middlewares de validation (`validateSearchParams`, `validateDetailsParams`, `validateCodeParams`)
  - Réponses standardisées (`formatSearchResponse`, `formatDetailResponse`)
  - `detailUrl` généré automatiquement dans les résultats de recherche
  - Rétrocompatibilité totale avec les endpoints legacy
- 🏷️ **Amazon par catégorie** : `/amazon_books`, `/amazon_toys`, `/amazon_videogames`, etc.
- 🎮 **JVC → JeuxVideo** : Endpoint renommé `/jvc/*` → `/jeuxvideo/*`

### v3.0.0 (2025)
- 🔄 **Normalisation complète** : Schémas unifiés pour tous les types de données
- 🧱 **Playmobil & Klickypedia** : Nouveaux providers jouets de construction
- 📖 **Bedetheque & ComicVine** : BD franco-belge et comics
- 🎮 **JVC** : Provider jeux vidéo français

### v2.1.0 (2025)
- 🔄 **Paramètre noCache/fresh** : Ignorer le cache sur n'importe quelle requête
- 🤖 **Amazon retry automatique** : Rotation IP automatique si robot détecté
- 🛡️ **Détection robot améliorée** : Patterns FR/EN pour captchas Amazon

### v2.0.0 (2025)
- 🏗️ **Architecture modulaire** : Code refactorisé en `lib/` (providers, utils) et `routes/`
- ✨ **Middlewares de validation** : `requireParam()`, `requireApiKey()` pour code DRY
- 🔄 **Cache unifié** : Amazon migré vers cache global avec TTL personnalisé
- 🛡️ **asyncHandler** : Appliqué à toutes les routes pour gestion d'erreurs centralisée
- 📊 **Version centralisée** : Unique source de vérité dans `lib/config.js`
- 🧹 ~200 lignes de code dupliqué supprimées

### v1.18.0
- 🎵 Ajout source Music (MusicBrainz, Deezer, iTunes, Discogs)
- 🏷️ Ajout Barcode (identification UPC/EAN/ISBN)
- 🛒 Amazon multi-pays avec protection VPN

---

**Image:** `nimai24/toys_api:latest`  
**Port:** `3000`  
**Source:** Node.js + Express
