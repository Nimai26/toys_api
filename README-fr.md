# Toys API 🧸

A Docker-based REST API to search and retrieve product information from multiple sources:
- **LEGO** - Official LEGO website (lego.com)
- **Mega Construx** - Mattel building blocks (shop.mattel.com) 🆕
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

- 🔍 Multi-source product search (LEGO, Mega Construx, Rebrickable, Google Books, OpenLibrary, RAWG, IGDB, TVDB, TMDB, IMDB, Jikan, ConsoleVariations, Coleka, Lulu-Berlu, Transformerland, Paninimania)
- 🛒 **Amazon scraper** - Multi-country search (FR, US, UK, DE, ES, IT, JP, CA), price comparison, barcode lookup 🆕
- 🧱 **Mega Construx search** multi-language (fr-FR, en-US, de-DE, etc.) with instructions 🆕
- 🎮 **ConsoleVariations** - Console variations, bundles & accessories database (11K+ collectibles) 🆕
- 📚 **Books search** via Google Books & OpenLibrary (ISBN or text)
- 🎮 **Video games search** via RAWG & IGDB (500K+ games)
- 📺 **TV series & movies search** via TVDB, TMDB & IMDB (millions of entries)
- 🎌 **Anime & Manga search** via Jikan/MyAnimeList (70K+ anime, 150K+ manga)
- 📖 **Comics & BD** via Comic Vine, MangaDex & Bedetheque
- 🏷️ **Barcode identification** - Auto-detect UPC, EAN, ISBN with product lookup 🆕
- 🎵 **Music album search** via MusicBrainz, Deezer, iTunes, Discogs 🆕
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

### 🛡️ Protection VPN Amazon (Optionnel)

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

### 🌍 Traduction automatique IMDB

Pour les résultats IMDB, le synopsis (plot) est généralement en anglais. Vous pouvez activer la traduction automatique via le service [auto_trad](../auto_trad/) :

```bash
# Sans traduction (par défaut)
curl "http://localhost:3000/imdb/title/tt0411008?lang=fr-FR"

# Avec traduction automatique du plot
curl "http://localhost:3000/imdb/title/tt0411008?lang=fr-FR&autoTrad=1"
```

**Réponse avec `autoTrad=1` :**
```json
{
  "title": "Star Wars: Episode IV - A New Hope",
  "plot": "Luke Skywalker rejoint des forces rebelles...",
  "plotOriginal": "Luke Skywalker joins rebel forces...",
  "plotTranslated": true,
  "genres": ["Action", "Aventure", "Fantastique", "Science-Fiction"],
  "genresOriginal": ["Action", "Adventure", "Fantasy", "Sci-Fi"],
  "genresTranslated": true
}
```

**Langues supportées pour les genres :** `fr`, `de`, `es`, `it`, `pt`

⚠️ **Prérequis** : Définir `AUTO_TRAD_URL` pointant vers le service auto_trad (pour la traduction du plot).

---

### 🛒 Endpoints Amazon (Sans Clé API) 🆕

Scraping Amazon multi-pays avec protection VPN. Recherche de produits, détails, comparaison de prix et lookup par code-barres.

#### Marketplaces Supportés

| Code | Pays | Domaine | Devise |
|------|------|---------|--------|
| `fr` | France 🇫🇷 | amazon.fr | EUR |
| `us` | États-Unis 🇺🇸 | amazon.com | USD |
| `uk` | Royaume-Uni 🇬🇧 | amazon.co.uk | GBP |
| `de` | Allemagne 🇩🇪 | amazon.de | EUR |
| `es` | Espagne 🇪🇸 | amazon.es | EUR |
| `it` | Italie 🇮🇹 | amazon.it | EUR |
| `jp` | Japon 🇯🇵 | amazon.co.jp | JPY |
| `ca` | Canada 🇨🇦 | amazon.ca | CAD |

#### Catégories Supportées

| Code | Nom | Description |
|------|-----|-------------|
| `videogames` | Jeux vidéo | Jeux, consoles, accessoires |
| `toys` | Jouets | LEGO, figurines, jeux de société |
| `books` | Livres | Romans, BD, manga |
| `music` | Musique | CD, vinyles |
| `movies` | Films & Séries | DVD, Blu-ray |

#### Lister les Marketplaces
```bash
GET /amazon/marketplaces
```

**Réponse :**
```json
{
  "count": 8,
  "marketplaces": [
    { "code": "fr", "name": "Amazon France", "domain": "amazon.fr", "currency": "EUR" },
    { "code": "us", "name": "Amazon USA", "domain": "amazon.com", "currency": "USD" },
    ...
  ]
}
```

#### Lister les Catégories
```bash
GET /amazon/categories
```

**Réponse :**
```json
{
  "count": 5,
  "categories": [
    { "code": "videogames", "name": "Jeux vidéo" },
    { "code": "toys", "name": "Jouets" },
    { "code": "books", "name": "Livres" },
    { "code": "music", "name": "Musique" },
    { "code": "movies", "name": "Films & Séries" }
  ]
}
```

#### Rechercher des Produits
```bash
GET /amazon/search?q=lego+star+wars&country=fr&category=toys&max=20
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `country` | `fr` | Code marketplace (fr, us, uk, de, es, it, jp, ca) |
| `category` | - | Catégorie optionnelle (videogames, toys, books, music, movies) |
| `page` | `1` | Numéro de page |
| `max` | `20` | Nombre max de résultats |

**Exemple de réponse :**
```json
{
  "source": "amazon",
  "marketplace": "fr",
  "query": "lego star wars",
  "category": "toys",
  "page": 1,
  "resultsCount": 20,
  "results": [
    {
      "asin": "B0DWDQ4YGR",
      "title": "LEGO Star Wars 75413 Le Juggernaut de la République",
      "url": "https://www.amazon.fr/dp/B0DWDQ4YGR",
      "image": "https://m.media-amazon.com/images/I/81xyz.jpg",
      "price": "€129,99",
      "priceValue": 129.99,
      "currency": "EUR",
      "rating": 4.7,
      "reviewsCount": 234,
      "isPrime": true,
      "isSponsored": false,
      "seller": "Amazon"
    }
  ]
}
```

#### Obtenir les Détails d'un Produit
```bash
GET /amazon/product/B0DWDQ4YGR?country=fr
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:asin` | requis | ASIN du produit (10 caractères alphanumériques) |
| `country` | `fr` | Code marketplace |

**Exemple de réponse :**
```json
{
  "source": "amazon",
  "marketplace": "fr",
  "asin": "B0DWDQ4YGR",
  "title": "LEGO Star Wars 75413 Le Juggernaut de la République - Jouet de Construction avec 3 Droïdes & 5 Minifigurines",
  "url": "https://www.amazon.fr/dp/B0DWDQ4YGR",
  "images": [
    "https://m.media-amazon.com/images/I/81xyz.jpg",
    "https://m.media-amazon.com/images/I/71abc.jpg"
  ],
  "price": "€129,99",
  "priceValue": 129.99,
  "currency": "EUR",
  "listPrice": "€149,99",
  "discount": "-13%",
  "availability": "En stock",
  "isPrime": true,
  "rating": 4.7,
  "reviewsCount": 234,
  "brand": "LEGO",
  "category": "Jouets",
  "features": [
    "7541 pièces",
    "Âge: 9+ ans",
    "Inclut 5 minifigurines"
  ],
  "description": "Recreate epic Clone Wars battles...",
  "technicalDetails": {
    "Poids": "3.5 kg",
    "Dimensions": "58 x 48 x 12 cm",
    "Fabricant": "LEGO"
  }
}
```

#### Rechercher par Code-barres (EAN/UPC)
```bash
GET /amazon/barcode/5702017421384?country=fr&category=toys
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:code` | requis | Code-barres EAN/UPC (8-14 chiffres) |
| `country` | `fr` | Code marketplace |
| `category` | - | Catégorie optionnelle |

**Réponse :** Même format que `/amazon/search`

#### Recherche Multi-Pays
```bash
GET /amazon/multi-search?q=nintendo+switch&countries=fr,us,uk,de&max=5
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `q` | requis | Terme de recherche |
| `countries` | `fr,us,uk` | Liste de pays séparés par virgule |
| `category` | - | Catégorie optionnelle |
| `max` | `10` | Max résultats par pays |

**Exemple de réponse :**
```json
{
  "source": "amazon",
  "query": "nintendo switch",
  "countries": ["fr", "us", "uk", "de"],
  "results": {
    "fr": {
      "marketplace": "fr",
      "resultsCount": 5,
      "results": [...]
    },
    "us": {
      "marketplace": "us",
      "resultsCount": 5,
      "results": [...]
    },
    ...
  },
  "summary": {
    "totalResults": 20,
    "cheapest": {
      "asin": "B07VGRJDFY",
      "title": "Nintendo Switch Lite",
      "price": "$199.99",
      "marketplace": "us"
    }
  }
}
```

#### Comparer les Prix Multi-Pays
```bash
GET /amazon/compare/B07VGRJDFY?countries=fr,us,uk,de,es
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `:asin` | requis | ASIN du produit |
| `countries` | `fr,us,uk,de,es` | Liste de pays à comparer |

**Exemple de réponse :**
```json
{
  "source": "amazon",
  "asin": "B07VGRJDFY",
  "productName": "Nintendo Switch Lite - Turquoise",
  "comparison": [
    {
      "marketplace": "us",
      "price": "$199.99",
      "priceValue": 199.99,
      "priceEUR": 183.50,
      "currency": "USD",
      "availability": "En stock",
      "url": "https://www.amazon.com/dp/B07VGRJDFY"
    },
    {
      "marketplace": "fr",
      "price": "€219,99",
      "priceValue": 219.99,
      "priceEUR": 219.99,
      "currency": "EUR",
      "availability": "En stock",
      "url": "https://www.amazon.fr/dp/B07VGRJDFY"
    },
    ...
  ],
  "cheapest": {
    "marketplace": "us",
    "price": "$199.99",
    "priceEUR": 183.50,
    "savings": "16.6%"
  }
}
```

#### Statut VPN
```bash
GET /amazon/vpn/status
```

**Réponse :**
```json
{
  "vpnActive": true,
  "vpnIp": "156.146.63.147",
  "error": null,
  "message": "VPN actif - IP: 156.146.63.147"
}
```

#### Rotation IP
```bash
POST /amazon/vpn/rotate
```

**Réponse :**
```json
{
  "success": true,
  "newIp": "191.101.31.50",
  "error": null,
  "message": "Nouvelle IP: 191.101.31.50"
}
```

> **⚠️ Notes Amazon :**
> - Le scraping Amazon nécessite FlareSolverr pour contourner les protections anti-bot
> - Un VPN dédié (gluetun) est **fortement recommandé** pour éviter les bans IP
> - Les résultats sont mis en cache 10 minutes pour limiter les requêtes
> - L'ASIN est l'identifiant unique Amazon (ex: B0DWDQ4YGR)
> - Certains produits peuvent ne pas être disponibles dans tous les marketplaces

---

#### Services sans clé API requise

Ces services fonctionnent **sans authentification** :

| Service | Endpoints |
|---------|-----------|
| LEGO | `/lego/search`, `/lego/product/:id`, `/lego/instructions/:id` |
| Amazon | `/amazon/search`, `/amazon/product/:asin`, `/amazon/barcode/:code`, `/amazon/compare/:asin`, `/amazon/multi-search` |
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

