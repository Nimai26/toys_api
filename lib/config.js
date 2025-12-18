/**
 * lib/config.js - Configuration centralisée de l'API
 * toys_api v3.2.2
 * 
 * Contient toutes les constantes et configurations des différentes sources
 */

// ========================================
// Configuration générale
// ========================================
const API_VERSION = process.env.API_VERSION || "3.2.2";
const DEFAULT_LOCALE = process.env.DEFAULT_LOCALE || "fr-FR";
const MAX_RETRIES = 3;

const USER_AGENT = process.env.USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const GRAPHQL_URL = "https://www.lego.com/api/graphql/SearchProductsQuery";

// ========================================
// FlareSolverr
// ========================================
const FSR_BASE = process.env.FSR_URL || "http://flaresolverr:8191/v1";
const FSR_AMAZON_URL = process.env.FSR_AMAZON_URL || "http://10.110.1.1:8192/v1";

// ========================================
// Coleka
// ========================================
const COLEKA_BASE_URL = "https://www.coleka.com";
const COLEKA_DEFAULT_NBPP = 24;

// ========================================
// Lulu-Berlu
// ========================================
const LULUBERLU_BASE_URL = "https://www.lulu-berlu.com";
const LULUBERLU_SEARCH_URL = "https://www.lulu-berlu.com/dhtml/resultat_recherche.php";
const LULUBERLU_RESULTS_PER_PAGE = 12;
const LULUBERLU_DEFAULT_MAX = 24;

// ========================================
// Transformerland
// ========================================
const TRANSFORMERLAND_BASE_URL = "https://www.transformerland.com";
const TRANSFORMERLAND_SEARCH_URL = "https://www.transformerland.com/store/search.php";
const TRANSFORMERLAND_DEFAULT_MAX = 50;

// ========================================
// Paninimania
// ========================================
const PANINIMANIA_BASE_URL = "https://www.paninimania.com";
const PANINIMANIA_RESULTS_PER_PAGE = 10;
const PANINIMANIA_DEFAULT_MAX = 20;

// ========================================
// Rebrickable
// ========================================
const REBRICKABLE_BASE_URL = "https://rebrickable.com/api/v3";
const REBRICKABLE_DEFAULT_MAX = 100;

// ========================================
// Google Books
// ========================================
const GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1";
const GOOGLE_BOOKS_DEFAULT_MAX = 20;
const GOOGLE_BOOKS_MAX_LIMIT = 40;

// ========================================
// OpenLibrary
// ========================================
const OPENLIBRARY_BASE_URL = "https://openlibrary.org";
const OPENLIBRARY_DEFAULT_MAX = 20;
const OPENLIBRARY_MAX_LIMIT = 100;

// ========================================
// RAWG (Jeux vidéo)
// ========================================
const RAWG_BASE_URL = "https://api.rawg.io/api";
const RAWG_DEFAULT_MAX = 20;
const RAWG_MAX_LIMIT = 40;

// ========================================
// IGDB (Jeux vidéo Twitch)
// ========================================
const IGDB_BASE_URL = "https://api.igdb.com/v4";
const IGDB_AUTH_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_DEFAULT_MAX = 20;
const IGDB_MAX_LIMIT = 500;

// ========================================
// TVDB
// ========================================
const TVDB_BASE_URL = "https://api4.thetvdb.com/v4";
const TVDB_DEFAULT_MAX = 20;
const TVDB_MAX_LIMIT = 100;

// ========================================
// TMDB
// ========================================
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const TMDB_DEFAULT_MAX = 20;
const TMDB_MAX_LIMIT = 20;

// ========================================
// IMDB (via imdbapi.dev)
// ========================================
const IMDB_BASE_URL = "https://api.imdbapi.dev";
const IMDB_DEFAULT_MAX = 20;
const IMDB_MAX_LIMIT = 50;

// ========================================
// Service de traduction (auto_trad)
// ========================================
// AUTO_TRAD_URL doit être configuré via variable d'environnement
// Ex: AUTO_TRAD_URL=http://auto_trad:3255
const AUTO_TRAD_URL = process.env.AUTO_TRAD_URL || null;
// AUTO_TRAD_ENABLED est automatiquement true si AUTO_TRAD_URL est défini
const AUTO_TRAD_ENABLED = !!AUTO_TRAD_URL && process.env.AUTO_TRAD_ENABLED !== "false";

// ========================================
// Jikan (MyAnimeList)
// ========================================
const JIKAN_BASE_URL = "https://api.jikan.moe/v4";
const JIKAN_DEFAULT_MAX = 25;
const JIKAN_MAX_LIMIT = 25;

// ========================================
// Comic Vine
// ========================================
const COMICVINE_API_KEY = process.env.COMICVINE_API_KEY || null;
const COMICVINE_BASE_URL = "https://comicvine.gamespot.com/api";
const COMICVINE_DEFAULT_MAX = 20;
const COMICVINE_MAX_LIMIT = 100;

// ========================================
// MangaDex
// ========================================
const MANGADEX_BASE_URL = "https://api.mangadex.org";
const MANGADEX_COVERS_URL = "https://uploads.mangadex.org/covers";
const MANGADEX_DEFAULT_MAX = 20;
const MANGADEX_MAX_LIMIT = 100;

// ========================================
// Bedetheque
// ========================================
const BEDETHEQUE_BASE_URL = "https://www.bedetheque.com";
const BEDETHEQUE_DEFAULT_MAX = 20;

// ========================================
// JeuxVideo.com
// ========================================
const JVC_BASE_URL = "https://www.jeuxvideo.com";
const JVC_DEFAULT_MAX = 20;

// ========================================
// Mega Construx (Mattel)
// ========================================
// Site US
const MEGA_API_URL_US = "https://ck4bj7.a.searchspring.io/api/search/search.json";
const MEGA_SITE_ID_US = "ck4bj7";
const MEGA_BASE_URL_US = "https://shop.mattel.com";
// Site EU
const MEGA_API_URL_EU = "https://0w0shw.a.searchspring.io/api/search/search.json";
const MEGA_SITE_ID_EU = "0w0shw";
const MEGA_BASE_URL_EU = "https://shopping.mattel.com";
const MEGA_DEFAULT_MAX = 20;
const MEGA_MAX_LIMIT = 100;
const MEGA_DEFAULT_LANG = "fr-FR";

// Mapping des langues vers la région
const MEGA_LANG_REGION = {
  'en-US': 'US', 'es-MX': 'US', 'fr-CA': 'US', 'pt-BR': 'US', 'en-CA': 'US',
  'fr-FR': 'EU', 'de-DE': 'EU', 'es-ES': 'EU', 'it-IT': 'EU', 'nl-NL': 'EU',
  'en-GB': 'EU', 'pl-PL': 'EU', 'tr-TR': 'EU', 'el-GR': 'EU', 'ru-RU': 'EU'
};

// ========================================
// Playmobil
// ========================================
const PLAYMOBIL_BASE_URL = "https://www.playmobil.com";
const PLAYMOBIL_DEFAULT_MAX = 24;
const PLAYMOBIL_MAX_LIMIT = 100;
const PLAYMOBIL_DEFAULT_LANG = "fr-FR";

// ========================================
// Klickypedia (Encyclopédie Playmobil)
// ========================================
const KLICKYPEDIA_BASE_URL = "https://www.klickypedia.com";
const KLICKYPEDIA_DEFAULT_MAX = 24;
const KLICKYPEDIA_MAX_LIMIT = 100;
const KLICKYPEDIA_DEFAULT_LANG = "fr";

// ========================================
// APIs Code-Barres
// ========================================
const UPCITEMDB_BASE_URL = "https://api.upcitemdb.com/prod/trial/lookup";
const OPENFOODFACTS_BASE_URL = "https://world.openfoodfacts.org/api/v2/product";
const BARCODELOOKUP_BASE_URL = "https://api.barcodelookup.com/v3/products";

// ========================================
// APIs Musique
// ========================================
const MUSICBRAINZ_BASE_URL = "https://musicbrainz.org/ws/2";
const MUSICBRAINZ_COVER_URL = "https://coverartarchive.org";
const DISCOGS_BASE_URL = "https://api.discogs.com";
const DEEZER_BASE_URL = "https://api.deezer.com";
const ITUNES_BASE_URL = "https://itunes.apple.com";
const MUSIC_DEFAULT_MAX = 20;

// ========================================
// ConsoleVariations
// ========================================
const CONSOLEVARIATIONS_BASE_URL = "https://consolevariations.com";
const CONSOLEVARIATIONS_CDN_URL = "https://cdn.consolevariations.com";
const CONSOLEVARIATIONS_DEFAULT_MAX = 20;

// ========================================
// Exports (ES Modules)
// ========================================
export {
  // Général
  API_VERSION,
  DEFAULT_LOCALE,
  MAX_RETRIES,
  
  // FlareSolverr
  FSR_BASE,
  FSR_AMAZON_URL,
  
  // Coleka
  COLEKA_BASE_URL,
  COLEKA_DEFAULT_NBPP,
  
  // Lulu-Berlu
  LULUBERLU_BASE_URL,
  LULUBERLU_SEARCH_URL,
  LULUBERLU_RESULTS_PER_PAGE,
  LULUBERLU_DEFAULT_MAX,
  
  // Transformerland
  TRANSFORMERLAND_BASE_URL,
  TRANSFORMERLAND_SEARCH_URL,
  TRANSFORMERLAND_DEFAULT_MAX,
  
  // Paninimania
  PANINIMANIA_BASE_URL,
  PANINIMANIA_RESULTS_PER_PAGE,
  PANINIMANIA_DEFAULT_MAX,
  
  // Rebrickable
  REBRICKABLE_BASE_URL,
  REBRICKABLE_DEFAULT_MAX,
  
  // Google Books
  GOOGLE_BOOKS_BASE_URL,
  GOOGLE_BOOKS_DEFAULT_MAX,
  GOOGLE_BOOKS_MAX_LIMIT,
  
  // OpenLibrary
  OPENLIBRARY_BASE_URL,
  OPENLIBRARY_DEFAULT_MAX,
  OPENLIBRARY_MAX_LIMIT,
  
  // RAWG
  RAWG_BASE_URL,
  RAWG_DEFAULT_MAX,
  RAWG_MAX_LIMIT,
  
  // IGDB
  IGDB_BASE_URL,
  IGDB_AUTH_URL,
  IGDB_DEFAULT_MAX,
  IGDB_MAX_LIMIT,
  
  // TVDB
  TVDB_BASE_URL,
  TVDB_DEFAULT_MAX,
  TVDB_MAX_LIMIT,
  
  // TMDB
  TMDB_BASE_URL,
  TMDB_IMAGE_BASE_URL,
  TMDB_DEFAULT_MAX,
  TMDB_MAX_LIMIT,
  
  // IMDB
  IMDB_BASE_URL,
  IMDB_DEFAULT_MAX,
  IMDB_MAX_LIMIT,
  
  // Traduction automatique
  AUTO_TRAD_URL,
  AUTO_TRAD_ENABLED,
  
  // Jikan
  JIKAN_BASE_URL,
  JIKAN_DEFAULT_MAX,
  JIKAN_MAX_LIMIT,
  
  // Comic Vine
  COMICVINE_API_KEY,
  COMICVINE_BASE_URL,
  COMICVINE_DEFAULT_MAX,
  COMICVINE_MAX_LIMIT,
  
  // MangaDex
  MANGADEX_BASE_URL,
  MANGADEX_COVERS_URL,
  MANGADEX_DEFAULT_MAX,
  MANGADEX_MAX_LIMIT,
  
  // Bedetheque
  BEDETHEQUE_BASE_URL,
  BEDETHEQUE_DEFAULT_MAX,
  
  // JVC
  JVC_BASE_URL,
  JVC_DEFAULT_MAX,
  
  // Mega Construx
  MEGA_API_URL_US,
  MEGA_SITE_ID_US,
  MEGA_BASE_URL_US,
  MEGA_API_URL_EU,
  MEGA_SITE_ID_EU,
  MEGA_BASE_URL_EU,
  MEGA_DEFAULT_MAX,
  MEGA_MAX_LIMIT,
  MEGA_DEFAULT_LANG,
  MEGA_LANG_REGION,
  
  // Playmobil
  PLAYMOBIL_BASE_URL,
  PLAYMOBIL_DEFAULT_MAX,
  PLAYMOBIL_MAX_LIMIT,
  PLAYMOBIL_DEFAULT_LANG,
  
  // Klickypedia
  KLICKYPEDIA_BASE_URL,
  KLICKYPEDIA_DEFAULT_MAX,
  KLICKYPEDIA_MAX_LIMIT,
  KLICKYPEDIA_DEFAULT_LANG,
  
  // Code-Barres
  UPCITEMDB_BASE_URL,
  OPENFOODFACTS_BASE_URL,
  BARCODELOOKUP_BASE_URL,
  
  // Musique
  MUSICBRAINZ_BASE_URL,
  MUSICBRAINZ_COVER_URL,
  DISCOGS_BASE_URL,
  DEEZER_BASE_URL,
  ITUNES_BASE_URL,
  MUSIC_DEFAULT_MAX,
  
  // ConsoleVariations
  CONSOLEVARIATIONS_BASE_URL,
  CONSOLEVARIATIONS_CDN_URL,
  CONSOLEVARIATIONS_DEFAULT_MAX,
  
  // Général
  USER_AGENT,
  GRAPHQL_URL
};
