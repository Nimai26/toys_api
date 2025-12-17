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
| `AUTO_TRAD_URL` | - | URL of auto_trad service for translation (e.g., `http://auto_trad:3255`) |

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

### 🌍 Automatic IMDB Translation

IMDB plot summaries are typically in English. You can enable automatic translation via the [auto_trad](../auto_trad/) service:

```bash
# Without translation (default)
curl "http://localhost:3000/imdb/title/tt0411008?lang=fr-FR"

# With automatic plot translation
curl "http://localhost:3000/imdb/title/tt0411008?lang=fr-FR&autoTrad=1"
```

**Response with `autoTrad=1`:**
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

**Supported languages for genres:** `fr`, `de`, `es`, `it`, `pt`

⚠️ **Prerequisite**: Set `AUTO_TRAD_URL` pointing to the auto_trad service (for plot translation).

---

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

**Image:** `nimai24/toys_api:latest`  
**Port:** `3000`  
**Source:** Node.js + Express
