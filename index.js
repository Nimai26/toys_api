// index.js - toys_api v4.0.0
import express from "express";
import crypto from "crypto";
import compression from "compression";

// Import des utilitaires et état centralisé
import {
  encryptApiKey,
  isEncryptionEnabled,
  API_ENCRYPTION_KEY,
  clearCache,
  getCacheStats,
  metrics,
  CACHE_TTL,
  CACHE_MAX_SIZE,
  createLogger,
  logger,
  errorHandler,
  handleCacheControl
} from './lib/utils/index.js';

// Import de la configuration centralisée (seulement ce qui est nécessaire pour index.js)
import {
  API_VERSION,
  FSR_BASE
} from './lib/config.js';

// Import du module base de données (cache PostgreSQL)
import { 
  initDatabase, 
  runMigrations, 
  DB_ENABLED, 
  CACHE_MODE,
  isCacheEnabled,
  getPoolStats,
  closePool
} from './lib/database/index.js';

const log = createLogger('Server');

// Import des routers
import {
  amazonRouter,
  amazonGenericRouter,
  amazonBooksRouter,
  amazonMoviesRouter,
  amazonMusicRouter,
  amazonToysRouter,
  amazonVideogamesRouter,
  legoRouter,
  rebrickableRouter,
  megaRouter,
  playmobilRouter,
  klickypediaRouter,
  colekaRouter,
  luluberluRouter,
  consolevariationsRouter,
  transformerlandRouter,
  paninimanaRouter,
  barcodeRouter,
  musicRouter,
  googleBooksRouter,
  openLibraryRouter,
  rawgRouter,
  igdbRouter,
  jeuxvideoRouter,
  tvdbRouter,
  tmdbRouter,
  imdbRouter,
  jikanRouter,
  jikanAnimeRouter,
  jikanMangaRouter,
  comicvineRouter,
  mangadexRouter,
  bedethequeRouter
} from './routes/index.js';

// Import du monitoring
import monitoringRouter from './routes/monitoring.js';
import { startMonitoringCron } from './lib/monitoring/healthcheck.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Activer la compression gzip pour toutes les réponses
app.use(compression({
  level: 6, // Niveau de compression (1-9, 6 est un bon compromis vitesse/taille)
  threshold: 1024, // Ne compresser que si > 1KB
  filter: (req, res) => {
    // Compresser sauf si le header indique de ne pas le faire
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Middleware JSON avec limite de taille (protection contre les gros payloads)
app.use(express.json({ limit: '1mb' }));

// Middleware CORS - permet l'accès depuis n'importe quel domaine
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware pour les headers de sécurité
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// Middleware pour ajouter un Request ID unique (utile pour le debugging)
app.use((req, res, next) => {
  req.id = crypto.randomUUID().substring(0, 8);
  res.header('X-Request-ID', req.id);
  next();
});

// Middleware pour tracker les métriques (utilise metrics de state.js)
app.use((req, res, next) => {
  const startTime = Date.now();
  metrics.requests.total++;
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metrics.responseTimeSum += duration;
    metrics.responseTimeCount++;
  });
  
  next();
});

// Middleware pour gérer le bypass du cache (paramètre noCache ou fresh)
app.use(handleCacheControl);

log.info("=========================================");
log.info(`🧸 Toys API v${API_VERSION}`);
log.info("=========================================");
log.info(`FSR: ${FSR_BASE}`);
log.info(`Cache TTL: ${CACHE_TTL/1000}s`);

// Log configuration chiffrement au démarrage
if (isEncryptionEnabled()) {
  log.info("Chiffrement des clés API activé (AES-256-GCM)");
} else {
  log.info("Chiffrement des clés API désactivé");
}

// Initialisation de la base de données PostgreSQL (cache local)
let dbInitialized = false;
if (DB_ENABLED) {
  log.info(`📦 Database cache: ${CACHE_MODE} mode`);
  try {
    await initDatabase();
    await runMigrations();
    dbInitialized = true;
    log.info("✅ Database cache initialisé avec succès");
  } catch (err) {
    log.error("⚠️  Erreur initialisation database cache", { error: err.message });
    log.warn("   Le serveur continuera sans cache persistant (mode API-only)");
  }
} else {
  log.info("📦 Database cache: désactivé (DB_ENABLED=false)");
}

// ============================================================================
// MONTAGE DES ROUTERS (Phase 3)
// ============================================================================

// Amazon - routes par catégorie (conformes aux appels du site web)
app.use('/amazon', amazonRouter);           // Legacy /amazon/* (rétrocompatibilité)
app.use('/amazon_generic', amazonGenericRouter);
app.use('/amazon_books', amazonBooksRouter);
app.use('/amazon_movies', amazonMoviesRouter);
app.use('/amazon_music', amazonMusicRouter);
app.use('/amazon_toys', amazonToysRouter);
app.use('/amazon_videogames', amazonVideogamesRouter);

// Jouets de construction
app.use('/lego', legoRouter);
app.use('/rebrickable', rebrickableRouter);
app.use('/mega', megaRouter);
app.use('/playmobil', playmobilRouter);
app.use('/klickypedia', klickypediaRouter);

// Utilitaires
app.use('/barcode', barcodeRouter);
app.use('/music', musicRouter);

// Livres
app.use('/googlebooks', googleBooksRouter);
app.use('/openlibrary', openLibraryRouter);

// Jeux vidéo
app.use('/rawg', rawgRouter);
app.use('/igdb', igdbRouter);
app.use('/jeuxvideo', jeuxvideoRouter);  // Renommé depuis /jvc

// Films & Séries
app.use('/tvdb', tvdbRouter);
app.use('/tmdb', tmdbRouter);
app.use('/imdb', imdbRouter);

// Anime & Manga
app.use('/jikan', jikanRouter);           // Legacy unifié
app.use('/jikan_anime', jikanAnimeRouter); // Spécifique anime
app.use('/jikan_manga', jikanMangaRouter); // Spécifique manga

// Comics & BD
app.use('/comicvine', comicvineRouter);
app.use('/mangadex', mangadexRouter);
app.use('/bedetheque', bedethequeRouter);

// Collectibles
app.use('/coleka', colekaRouter);
app.use('/luluberlu', luluberluRouter);
app.use('/consolevariations', consolevariationsRouter);
app.use('/transformerland', transformerlandRouter);
app.use('/paninimania', paninimanaRouter);

// Monitoring (tests de santé automatisés)
app.use('/monitoring', monitoringRouter);

// Middleware global de gestion d'erreurs (doit être monté après toutes les routes)
app.use(errorHandler);

// ============================================================================
// ENDPOINTS SYSTÈME (health, version, metrics, crypto)
// ============================================================================

// ============================================================================
// ENDPOINTS SYSTÈME (health, version, metrics, crypto)
// ============================================================================

// Endpoint utilitaire pour chiffrer une clé API (aide au développement)
// Accessible uniquement si API_ENCRYPTION_KEY est configurée
app.post("/crypto/encrypt", express.json(), (req, res) => {
  if (!API_ENCRYPTION_KEY) {
    return res.status(400).json({ 
      error: "Chiffrement non activé",
      hint: "Définissez la variable d'environnement API_ENCRYPTION_KEY"
    });
  }
  
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ error: "paramètre 'key' manquant dans le body JSON" });
  }
  
  const encrypted = encryptApiKey(key);
  if (!encrypted) {
    return res.status(500).json({ error: "Échec du chiffrement" });
  }
  
  res.json({
    encrypted: encrypted,
    usage: "Utilisez cette valeur dans le header X-Encrypted-Key"
  });
});

// Endpoint de santé avec métriques avancées
app.get("/health", async (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  const avgResponseTime = metrics.responseTimeCount > 0 
    ? Math.round(metrics.responseTimeSum / metrics.responseTimeCount) 
    : 0;
  const cacheHitRate = metrics.requests.total > 0 
    ? Math.round((metrics.requests.cached / metrics.requests.total) * 100) 
    : 0;
  const cacheStats = getCacheStats();
  
  // Stats base de données
  let dbStatus = { enabled: false };
  if (DB_ENABLED && dbInitialized) {
    try {
      const poolStats = getPoolStats();
      dbStatus = {
        enabled: true,
        mode: CACHE_MODE,
        connected: true,
        pool: poolStats
      };
    } catch (err) {
      dbStatus = {
        enabled: true,
        mode: CACHE_MODE,
        connected: false,
        error: err.message
      };
    }
  } else if (DB_ENABLED) {
    dbStatus = {
      enabled: true,
      mode: CACHE_MODE,
      connected: false,
      error: 'Initialization failed'
    };
  }
  
  res.json({ 
    status: "ok", 
    fsr: FSR_BASE,
    uptime: `${uptime}s`,
    cache: {
      size: cacheStats.size,
      maxSize: CACHE_MAX_SIZE,
      ttl: CACHE_TTL / 1000,
      hitRate: `${cacheHitRate}%`
    },
    database: dbStatus,
    metrics: {
      requests: {
        total: metrics.requests.total,
        cached: metrics.requests.cached,
        errors: metrics.requests.errors
      },
      avgResponseTime: `${avgResponseTime}ms`,
      sources: metrics.sources
    },
    compression: "gzip enabled"
  });
});

// Endpoint version de l'API
app.get("/version", (req, res) => {
  res.json({
    name: "Toys API",
    version: API_VERSION,
    features: [
      "LEGO search & product details",
      "Rebrickable API integration (sets, parts, minifigs, themes, colors)",
      "LEGO ↔ Rebrickable cross-enrichment",
      "Google Books search & details (ISBN/text)",
      "OpenLibrary search & details (ISBN/text)",
      "RAWG video games database (search/details)",
      "IGDB video games database (search/details via Twitch)",
      "TVDB TV series & movies database (search/details)",
      "TMDB movies & TV shows database (search/details)",
      "IMDB movies & TV database (search/details/browse - NO API KEY)",
      "Jikan anime & manga database (search/details - NO API KEY)",
      "Comic Vine comics database (search/volumes/issues)",
      "MangaDex manga database (search/details - NO API KEY)",
      "Bedetheque BD franco-belge (search/series/albums - scraping)",
      "JeuxVideo.com jeux vidéo FR (search/details - scraping)",
      "ConsoleVariations consoles & accessories database (search/browse/details - scraping)",
      "Smart search (ID vs text detection)",
      "Coleka collectibles database",
      "Lulu-Berlu vintage toys",
      "Transformerland vintage Transformers",
      "Paninimania sticker albums (FR)",
      "Mega Construx search (multi-language: fr-FR, en-US, de-DE, etc.)",
      "Barcode identification (UPC, EAN, ISBN detection)",
      "Music search (MusicBrainz, Deezer, iTunes, Discogs)",
      "Encrypted API key support (AES-256-GCM)",
      "In-memory caching with TTL",
      "Gzip compression",
      "CORS enabled",
      "Metrics & monitoring"
    ],
    endpoints: {
      // Amazon - routes par catégorie
      amazon_generic: ["/amazon_generic/search", "/amazon_generic/product/:asin", "/amazon_generic/barcode/:code", "/amazon_generic/multi"],
      amazon_books: ["/amazon_books/search", "/amazon_books/product/:asin", "/amazon_books/barcode/:code"],
      amazon_movies: ["/amazon_movies/search", "/amazon_movies/product/:asin", "/amazon_movies/barcode/:code"],
      amazon_music: ["/amazon_music/search", "/amazon_music/product/:asin", "/amazon_music/barcode/:code"],
      amazon_toys: ["/amazon_toys/search", "/amazon_toys/product/:asin", "/amazon_toys/barcode/:code"],
      amazon_videogames: ["/amazon_videogames/search", "/amazon_videogames/product/:asin", "/amazon_videogames/barcode/:code"],
      amazon_legacy: ["/amazon/search", "/amazon/product/:asin", "/amazon/compare/:asin", "/amazon/vpn/status", "/amazon/marketplaces"],
      
      // Jouets de construction
      lego: ["/lego/search", "/lego/product/:id", "/lego/instructions/:id"],
      rebrickable: ["/rebrickable/search", "/rebrickable/set/:setNum", "/rebrickable/set/:setNum/parts", "/rebrickable/set/:setNum/minifigs", "/rebrickable/themes", "/rebrickable/colors"],
      mega: ["/mega/search", "/mega/product/:id", "/mega/franchise/:franchise", "/mega/instructions", "/mega/instructions/:sku", "/mega/languages"],
      playmobil: ["/playmobil/search", "/playmobil/product/:id", "/playmobil/instructions/:id"],
      klickypedia: ["/klickypedia/search", "/klickypedia/product/:id", "/klickypedia/set/:slug"],
      
      // Livres
      googlebooks: ["/googlebooks/search", "/googlebooks/book/:volumeId", "/googlebooks/isbn/:isbn"],
      openlibrary: ["/openlibrary/search", "/openlibrary/book/:olId", "/openlibrary/isbn/:isbn"],
      
      // Jeux vidéo
      rawg: ["/rawg/search", "/rawg/game/:id"],
      igdb: ["/igdb/search", "/igdb/game/:id"],
      jeuxvideo: ["/jeuxvideo/search (scraping)", "/jeuxvideo/game/:id (scraping)"],
      
      // Films & Séries
      tvdb: ["/tvdb/search", "/tvdb/series/:id", "/tvdb/movie/:id"],
      tmdb: ["/tmdb/search", "/tmdb/movie/:id", "/tmdb/tv/:id"],
      imdb: ["/imdb/search (NO API KEY)", "/imdb/title/:id (NO API KEY)", "/imdb/browse (NO API KEY)"],
      
      // Anime & Manga
      jikan: ["/jikan/search", "/jikan/details (NO API KEY)"],
      jikan_anime: ["/jikan_anime/search", "/jikan_anime/details", "/jikan_anime/:id (NO API KEY)"],
      jikan_manga: ["/jikan_manga/search", "/jikan_manga/details", "/jikan_manga/:id (NO API KEY)"],
      
      // Comics & BD
      comicvine: ["/comicvine/search", "/comicvine/volume/:id", "/comicvine/issue/:id"],
      mangadex: ["/mangadex/search (NO API KEY)", "/mangadex/manga/:id (NO API KEY)"],
      bedetheque: ["/bedetheque/search (scraping)", "/bedetheque/serie/:id (scraping)", "/bedetheque/album/:id (scraping)"],
      
      // Collectibles
      coleka: ["/coleka/search", "/coleka/item"],
      luluberlu: ["/luluberlu/search", "/luluberlu/item/:id"],
      transformerland: ["/transformerland/search", "/transformerland/item"],
      paninimania: ["/paninimania/search", "/paninimania/album/:id", "/paninimania/album"],
      consolevariations_consoles: ["/consolevariations/search?type=consoles (scraping)"],
      consolevariations_accessories: ["/consolevariations/search?type=accessories (scraping)"],
      consolevariations: ["/consolevariations/item/:slug", "/consolevariations/platforms", "/consolevariations/browse/:platform"],
      
      // Utilitaires
      barcode: ["/barcode/:code (auto-detect UPC/EAN/ISBN)", "/barcode/detect/:code", "/barcode/isbn/:isbn", "/barcode/bnf/:isbn"],
      music: ["/music/search", "/music/album/:id", "/music/artist/:id", "/music/discogs/:id", "/music/barcode/:code"],
      
      // Système
      crypto: ["/crypto/encrypt (POST)", "/crypto/verify (POST)"],
      system: ["/health", "/version", "/cache (DELETE)", "/metrics (DELETE)"]
    },
    security: {
      encryption: API_ENCRYPTION_KEY ? "enabled" : "disabled",
      algorithm: "AES-256-GCM",
      headers: {
        encrypted: "X-Encrypted-Key",
        plain: "X-Api-Key (only if encryption disabled)"
      }
    }
  });
});

// Endpoint pour vider le cache
app.delete("/cache", (req, res) => {
  const stats = getCacheStats();
  const size = stats.size;
  clearCache();
  res.json({ status: "ok", cleared: size });
});

// Endpoint pour réinitialiser les métriques
app.delete("/metrics", (req, res) => {
  metrics.requests = { total: 0, cached: 0, errors: 0 };
  metrics.responseTimeSum = 0;
  metrics.responseTimeCount = 0;
  Object.keys(metrics.sources).forEach(key => {
    metrics.sources[key] = { requests: 0, errors: 0 };
  });
  log.info("Metrics réinitialisées");
  res.json({ status: "ok", message: "Metrics reset" });
});

// Démarrer le serveur
const server = app.listen(PORT, "0.0.0.0", () => {
  log.info(`🚀 Toys API running at http://0.0.0.0:${PORT}`);
  log.info(`   - Routes: amazon, lego, rebrickable, mega, barcode, music`);
  log.info(`   - Books: googlebooks, openlibrary`);
  log.info(`   - Games: rawg, igdb, jvc`);
  log.info(`   - Media: tvdb, tmdb, imdb`);
  log.info(`   - Anime: jikan`);
  log.info(`   - Comics: comicvine, mangadex, bedetheque`);
  log.info(`   - Collectibles: coleka, luluberlu, consolevariations, transformerland, paninimania`);
  log.info(`   - Monitoring: /monitoring/status, /monitoring/test`);
  log.info(`   - Compression: gzip | CORS: enabled`);
  
  // Démarrer le cron de monitoring si activé
  if (process.env.ENABLE_MONITORING === 'true') {
    startMonitoringCron();
  } else {
    log.info(`   - Monitoring automatique: désactivé (ENABLE_MONITORING=false)`);
  }
});

// Graceful shutdown - fermeture propre lors de l'arrêt
const gracefulShutdown = async (signal) => {
  log.warn(`${signal} reçu. Arrêt gracieux en cours...`);
  
  // Détruire la session FlareSolverr si elle existe
  if (getFsrSessionId()) {
    try {
      log.info("Destruction de la session FSR...");
      await destroyFsrSession();
      log.info("Session FSR détruite");
    } catch (err) {
      log.error("Erreur destruction session FSR", { error: err.message });
    }
  }
  
  // Fermer la connexion PostgreSQL si active
  if (DB_ENABLED && dbInitialized) {
    try {
      log.info("Fermeture du pool PostgreSQL...");
      await closePool();
      log.info("Pool PostgreSQL fermé");
    } catch (err) {
      log.error("Erreur fermeture pool PostgreSQL", { error: err.message });
    }
  }
  
  // Fermer le serveur HTTP
  server.close(() => {
    log.info("✅ Serveur HTTP fermé");
    log.info(`📊 Stats finales`, { requests: metrics.requests.total, cached: metrics.requests.cached, errors: metrics.requests.errors });
    process.exit(0);
  });
  
  // Forcer la fermeture après 10 secondes
  setTimeout(() => {
    log.error("⚠️  Forçage de l'arrêt après timeout");
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
