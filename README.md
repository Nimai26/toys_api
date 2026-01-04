# Toys API 🧸

> **Version 4.0.0** - Architecture modulaire + 100% VPN Coverage

A Docker-based REST API to search and retrieve product information from **37+ sources** across multiple categories.

## 📦 Categories & Providers

### 🧱 Construction Toys
- **LEGO** (lego.com) - Official LEGO sets & products
- **Playmobil** (playmobil.com) - Official Playmobil website  
- **Klickypedia** (klickypedia.com) - Playmobil encyclopedia with multilingual support
- **Mega Construx** (shop.mattel.com) - Mattel building blocks with instructions
- **Rebrickable** (rebrickable.com) 🔑 - LEGO sets database with parts & minifigs

### �� Books
- **Google Books** (books.google.com) 🔑 - Books search by ISBN or text
- **OpenLibrary** (openlibrary.org) 🆓 - Open books database

### 🎮 Video Games
- **RAWG** (rawg.io) 🔑 - 500K+ video games database
- **IGDB** (igdb.com) 🔑 - Internet Game Database (Twitch API)
- **JeuxVideo.com** (jeuxvideo.com) 🇫🇷 - French gaming database

### 📺 Movies & TV Shows
- **TMDB** (themoviedb.org) 🔑 - The Movie Database
- **TVDB** (thetvdb.com) 🔑 - TV series database
- **IMDB** (imdbapi.dev) 🆓 - Movies & TV via free API

### 🎌 Anime & Manga
- **Jikan** (myanimelist.net) 🆓 - 70K+ anime, 150K+ manga
- **MangaDex** (mangadex.org) 🆓 - Manga database

### 📖 Comics & BD
- **Comic Vine** (comicvine.gamespot.com) 🔑 - Comics database
- **Bedetheque** (bedetheque.com) 🇫🇷 - Franco-Belgian comics

### 🃏 Trading Card Games (TCG)
- **Magic: The Gathering** (scryfall.com) 🆓 - MTG cards via Scryfall
- **Yu-Gi-Oh!** (ygoprodeck.com) 🆓 - YGO cards database
- **Pokémon TCG** (pokemontcg.io) 🆓 - Pokémon trading cards
- **Pokémon Official** (pokemon.com) 🆓 - Official Pokémon cards
- **Lorcana** (lorcana-api.com) 🆓 - Disney Lorcana TCG
- **Digimon** (digimoncard.io) 🆓 - Digimon Card Game
- **One Piece** (onepiece-cardgame.com) 🇫🇷 - One Piece TCG
- **Carddass** (carddass.com) 🇯🇵 - Japanese Carddass collectibles

### 🎲 Board Games
- **BoardGameGeek** (boardgamegeek.com) 🆓 - Board games database & files

### 🎵 Music
- **MusicBrainz** (musicbrainz.org) 🆓 - Open music encyclopedia
- **Deezer** (deezer.com) 🆓 - Music streaming catalog
- **iTunes** (apple.com) 🆓 - Apple Music catalog
- **Discogs** (discogs.com) 🔑 - Music database & marketplace

### 🛒 E-commerce & Collectibles
- **Amazon** (amazon.com) 🆓 - Multi-country marketplace (FR, US, UK, DE, ES, IT, JP, CA)
- **ConsoleVariations** (consolevariations.com) 🆓 - 11K+ console variations & accessories
- **Coleka** (coleka.com) 🆓 - Collectibles database
- **Lulu-Berlu** (lulu-berlu.com) 🆓 - Vintage toys shop
- **Transformerland** (transformerland.com) 🆓 - Vintage Transformers
- **Paninimania** (paninimania.com) 🇫🇷 - Sticker albums

### 🏷️ Universal Identifiers
- **Barcode** 🆓 - UPC, EAN, ISBN identification with product lookup

---

## ✨ Key Features

- 🔍 **37+ endpoints** across 8 categories
- 🛡️ **100% VPN coverage** - All external requests routed through Gluetun VPN
- 🔐 **Encrypted API keys** (AES-256-GCM)
- 🚀 **Hybrid caching** - In-memory + PostgreSQL
- 🗜️ **Gzip compression**
- 🌐 **CORS enabled**
- 🌍 **Multi-locale support**
- 🔄 **Auto-translation**
- 📊 **Built-in monitoring**
- 🛤️ **Normalized routes**
- 🔒 **Anti-bot bypass** (FlareSolverr + Puppeteer Stealth)

---

## 🚀 Quick Start

```bash
docker pull nimai24/toys_api:latest

docker run -d \
  --name toys_api \
  --network="swag" \
  -p 3000:3000 \
  -e FSR_URL=http://gluetun-toys:8191/v1 \
  -e VPN_PROXY_URL=http://gluetun-toys:8888 \
  -e DEFAULT_LOCALE=fr-FR \
  nimai24/toys_api:latest
```

Test the API:
```bash
curl "http://localhost:3000/health"
curl "http://localhost:3000/lego/search?q=star+wars"
```

---

## 📖 API Endpoints

Full documentation: [API_REFERENCE.md](API_REFERENCE.md) *(coming soon)*

### Quick Reference

**Construction:**
- `GET /lego/search?q=star` - Search LEGO sets
- `GET /playmobil/search?q=pirate` - Search Playmobil
- `GET /mega/search?q=halo` - Search Mega Construx
- `GET /rebrickable/search?q=millennium` 🔑 - Search Rebrickable

**Books:**
- `GET /googlebooks/search?q=harry+potter` ��
- `GET /openlibrary/search?q=tolkien` 🆓

**Games:**
- `GET /rawg/search?q=zelda` 🔑
- `GET /igdb/search?q=mario` 🔑

**Media:**
- `GET /tmdb/search?q=inception` 🔑
- `GET /imdb/search?q=matrix` 🆓

**Anime:**
- `GET /jikan/anime/search?q=naruto` ��

**TCG:**
- `GET /tcg/mtg/search?q=lotus` 🆓
- `GET /tcg/pokemon/search?q=pikachu` 🆓

**Music:**
- `GET /music/search?q=radiohead` 🆓

**E-commerce:**
- `GET /amazon/search?q=lego&country=fr` 🆓
- `GET /barcode/012345678905` 🆓

**System:**
- `GET /health` - Health check
- `GET /version` - Version info
- `GET /monitoring/status` - Monitoring status

---

## 🔧 Configuration

### Essential Environment Variables

```bash
# VPN & Anti-Bot
FSR_URL=http://gluetun-toys:8191/v1
VPN_PROXY_URL=http://gluetun-toys:8888
GLUETUN_CONTROL_URL=http://gluetun-toys:8000

# Security
API_ENCRYPTION_KEY=your-secret-key-32-chars

# Locale
DEFAULT_LOCALE=fr-FR

# Translation (optional)
AUTO_TRAD_URL=http://auto_trad:3255

# Cache (optional)
DB_CACHE_ENABLED=true
DB_HOST=toys_api_postgres
DB_NAME=toys_api_cache
DB_USER=toys_api
DB_PASSWORD=secure_password
```

### Complete docker-compose.yaml

See [docker-compose.example.yaml](docker-compose.example.yaml) for full setup with Gluetun VPN + FlareSolverr + PostgreSQL.

---

## 🛡️ VPN Protection

All providers are protected via Gluetun VPN using 3 methods:

| Method | Providers | Speed | Use Case |
|--------|-----------|-------|----------|
| **fetchViaProxy** | 29 | ~100ms | REST/GraphQL APIs |
| **Puppeteer Stealth** | 1 | ~5s | Amazon (anti-bot) |
| **FlareSolverr** | 2 | ~15s | Cloudflare sites |

**Automatic exclusions:** Docker internal services (`gluetun-toys`, `docker-mailserver`, `auto_trad`, `localhost`)

---

## 🔐 API Key Management

### Encrypted Keys (Recommended)

```bash
# 1. Encrypt your API key
curl -X POST "http://localhost:3000/crypto/encrypt" \
  -H "Content-Type: application/json" \
  -d '{"text": "your_api_key"}'

# Response: {"encrypted": "enc_AES256_..."}

# 2. Use encrypted key
curl "http://localhost:3000/rebrickable/search?q=star" \
  -H "X-Api-Key: enc_AES256_..."
```

### Plain Keys (Development)

```bash
curl "http://localhost:3000/rebrickable/search?q=star" \
  -H "X-Api-Key: your_plain_api_key"
```

---

## 🌍 Translation & Localization

### Auto-Translation

Add `autoTrad=1` to translate plot/synopsis and genres:

```bash
curl "http://localhost:3000/imdb/title/tt0076759?lang=fr&autoTrad=1"
```

**Supported:** IMDB, TVDB, TMDB, Jikan, MangaDex, Google Books, IGDB, RAWG, etc.

### Multi-Locale

```bash
# French
curl "http://localhost:3000/lego/search?q=star&lang=fr"

# English
curl "http://localhost:3000/lego/search?q=star&lang=en"

# German
curl "http://localhost:3000/lego/search?q=star&lang=de"
```

---

## 📊 Monitoring

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "version": "4.0.0",
  "uptime": "3h 24m",
  "cache": {
    "size": 47,
    "hitRate": "68%"
  },
  "metrics": {
    "requests": {
      "total": 1547,
      "cached": 1053,
      "errors": 12
    },
    "avgResponseTime": "324ms"
  }
}
```

### Automated Monitoring

Configure periodic health checks with email alerts:

```bash
ENABLE_MONITORING=true
HEALTHCHECK_PROVIDERS_INTERVAL_HOURS=10
SMTP_HOST=docker-mailserver
SMTP_PORT=587
EMAIL_DEST=admin@example.com
```

Tests all 37 providers and sends email report.

---

## 🗄️ Database Cache

Optional PostgreSQL caching for persistence across restarts:

```yaml
services:
  toys_api_postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=toys_api_cache
      - POSTGRES_USER=toys_api
      - POSTGRES_PASSWORD=secure_pass
    volumes:
      - toys_api_db:/var/lib/postgresql/data
```

**Modes:** `write-through`, `read-through`, `hybrid` (default)

---

## 🚀 Performance

### Cache Hit Rates

Typical: **60-80%** depending on usage patterns

### Response Times (median)

| Provider | Cached | Uncached |
|----------|--------|----------|
| LEGO | 5ms | 1.2s |
| Amazon | 8ms | 6.5s |
| Rebrickable | 3ms | 450ms |
| TMDB | 4ms | 320ms |

### Compression

Gzip enabled by default: **70-85%** reduction for JSON responses

---

## 📝 Changelog

### v4.0.0 (2026-01-04)

**Major Release - Modular Architecture**

- ✨ Architecture refactored (lib/ + routes/)
- 🛡️ 100% VPN coverage via Gluetun
- 🃏 8 TCG providers added
- 🎲 BoardGameGeek integration
- 📦 PostgreSQL cache support
- 🔧 Middleware validation system
- 📊 Automated monitoring with email alerts

---

## 📄 License

MIT License

---

## 🤝 Contributing

Contributions welcome! Please fork, create a feature branch, and submit a PR.

---

## 🙏 Credits

**APIs:** Scryfall, YGOPRODeck, Pokémon TCG API, Rebrickable, RAWG, IGDB, TMDB, TVDB, Jikan, MangaDex, MusicBrainz, BoardGameGeek

**Infrastructure:** FlareSolverr, Gluetun, Puppeteer, auto_trad

---

**Made with ❤️ by [Nimai24](https://github.com/nimai24)**
