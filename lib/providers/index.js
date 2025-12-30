/**
 * lib/providers/index.js - Point d'entrée des providers
 * 
 * Exporte toutes les fonctions de chaque provider pour faciliter les imports
 * 
 * @module providers
 */

// ============================================================================
// COLLECTIBLES / TOYS
// ============================================================================

// MEGA Construx
export {
  searchMega,
  getMegaProductById,
  getMegaInstructions,
  listMegaInstructions
} from './mega.js';

// Coleka
export {
  searchColeka,
  getColekaItemDetails
} from './coleka.js';

// Lulu-Berlu
export {
  searchLuluBerlu,
  getLuluBerluItemDetails
} from './luluberlu.js';

// Transformerland
export {
  searchTransformerland,
  getTransformerlandItemDetails
} from './transformerland.js';

// Paninimania
export {
  searchPaninimania,
  searchPaninimanisaNormalized,
  getPaninimanialbumDetails,
  getPaninimanialbumDetailsNormalized
} from './paninimania.js';

// ============================================================================
// LEGO
// ============================================================================

// LEGO Official (GraphQL/scraping)
export {
  callLegoGraphql,
  getProductDetails as getLegoProductDetails,
  getBuildingInstructions,
  obtainSessionData,
  cookiesToHeader,
  isValidLegoProductId,
  extractLegoProductId,
  GRAPHQL_URL,
  GRAPHQL_QUERY
} from './lego.js';

// Rebrickable API
export {
  rebrickableRequest,
  searchRebrickable,
  getRebrickableSet,
  getRebrickableSetParts,
  getRebrickableSetMinifigs,
  getRebrickableThemes,
  getRebrickableColors,
  getRebrickableSetFull,
  smartRebrickableSearch,
  enrichLegoWithRebrickable,
  enrichRebrickableWithLego,
  legoIdToRebrickable,
  rebrickableIdToLego,
  isSetNumber,
  setLegoFunctions
} from './rebrickable.js';

// ============================================================================
// VIDEOGAMES
// ============================================================================

// Console Variations
export {
  searchConsoleVariations,
  getConsoleVariationsItem,
  listConsoleVariationsPlatforms,
  browseConsoleVariationsPlatform
} from './consolevariations.js';

// RAWG API
export {
  searchRawg,
  getRawgGameDetails
} from './rawg.js';

// IGDB/Twitch API
export {
  parseIgdbCredentials,
  getIgdbWebsiteCategory,
  parseIgdbAgeRating,
  detectMultiplayer,
  getIgdbToken,
  searchIgdb,
  getIgdbGameDetails
} from './igdb.js';

// JeuxVideo.com (scraping)
export {
  searchJVC,
  getJVCGameById
} from './jvc.js';

// ============================================================================
// ANIME / MANGA
// ============================================================================

// Jikan (MyAnimeList)
export {
  searchJikanAnime,
  getJikanAnimeById,
  searchJikanManga,
  getJikanMangaById
} from './jikan.js';

// ============================================================================
// BOOKS
// ============================================================================

// Google Books
export {
  isIsbn,
  validateIsbn,
  isbn10to13,
  searchGoogleBooks,
  getGoogleBookById
} from './googlebooks.js';

// OpenLibrary
export {
  searchOpenLibrary,
  searchOpenLibraryByIsbn,
  searchOpenLibraryByText,
  parseOpenLibraryBook,
  getOpenLibraryById
} from './openlibrary.js';

// ============================================================================
// MEDIA (TV/Movies)
// ============================================================================

// TheTVDB
export {
  getTvdbToken,
  searchTvdb,
  getTvdbSeriesById,
  getTvdbMovieById
} from './tvdb.js';

// TMDB (The Movie Database)
export {
  searchTmdb,
  getTmdbMovieById,
  getTmdbTvById
} from './tmdb.js';

// IMDB (scraping)
export {
  searchImdb,
  getImdbTitleById,
  browseImdbTitles
} from './imdb.js';

// ============================================================================
// MUSIC
// ============================================================================

// MusicBrainz
export {
  formatDuration,
  searchMusicBrainz,
  getMusicBrainzAlbum,
  searchMusicBrainzByBarcode
} from './musicbrainz.js';

// Deezer
export {
  searchDeezer,
  getDeezerAlbum,
  getDeezerArtist
} from './deezer.js';

// Discogs
export {
  searchDiscogs,
  getDiscogsRelease,
  searchDiscogsByBarcode
} from './discogs.js';

// iTunes
export {
  searchItunes
} from './itunes.js';

// ============================================================================
// COMICS / BD
// ============================================================================

// ComicVine
export {
  searchComicVine,
  getComicVineVolume,
  getComicVineIssue
} from './comicvine.js';

// MangaDex
export {
  searchMangaDex,
  getMangaDexById
} from './mangadex.js';

// Bédéthèque
export {
  searchBedethequeAjax,
  searchBedetheque,
  searchBedethequeAlbums,
  getBedethequeSerieById,
  getBedethequeAlbumById
} from './bedetheque.js';

// ============================================================================
// BARCODE / IDENTIFICATION
// ============================================================================

// Barcode identification
export {
  detectBarcodeType,
  isbn10ToIsbn13,
  searchUpcItemDb,
  searchOpenFoodFacts,
  searchBnfByIsbn,
  searchBookByIsbn,
  tryIdentifyVideoGame,
  tryIdentifyMusic,
  searchMusicByBarcode,
  searchByBarcode
} from './barcode.js';

// ============================================================================
// AMAZON
// ============================================================================

// Amazon scraper (multi-pays, via VPN)
export {
  checkVpnStatus,
  rotateVpnIp,
  AMAZON_MARKETPLACES,
  AMAZON_CATEGORIES,
  searchAmazon,
  getAmazonProduct,
  searchAmazonByBarcode,
  searchMultiCountry as searchAmazonMultiCountry,
  comparePrices as compareAmazonPrices,
  getSupportedMarketplaces,
  getSupportedCategories
} from './amazon.js';
