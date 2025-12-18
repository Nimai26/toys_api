/**
 * lib/normalizers/index.js
 * Point d'entrée pour tous les normalizers
 * 
 * @module normalizers
 */

// Import des normalizers par type
import constructToy from './construct-toy.js';
import book from './book.js';
import movie from './movie.js';
import series from './series.js';
import anime from './anime.js';
import manga from './manga.js';
import videogame from './videogame.js';
import musicAlbum from './music_album.js';
import collectible from './collectible.js';
import * as stickers from './stickers.js';
import * as console from './console.js';
import * as amazon from './amazon.js';

// Export groupé
export const normalizers = {
  constructToy,
  book,
  movie,
  series,
  anime,
  manga,
  videogame,
  musicAlbum,
  collectible,
  stickers,
  console,
  amazon
};

// Export individuel pour faciliter l'import
export { default as constructToy } from './construct-toy.js';
export { default as book } from './book.js';
export { default as movie } from './movie.js';
export { default as series } from './series.js';
export { default as anime } from './anime.js';
export { default as manga } from './manga.js';
export { default as videogame } from './videogame.js';
export { default as musicAlbum } from './music_album.js';
export { default as collectible } from './collectible.js';
export * as stickers from './stickers.js';
export * as console from './console.js';
export * as amazon from './amazon.js';

// Export des fonctions construct-toy pour accès direct
export const {
  // Recherche
  normalizeLegoSearch,
  normalizePlaymobilSearch,
  normalizeKlickypediaSearch,
  normalizeMegaSearch,
  normalizeRebrickableSearch,
  
  // Détails
  normalizeLegoDetail,
  normalizePlaymobilDetail,
  normalizeKlickypediaDetail,
  normalizeMegaDetail,
  normalizeRebrickableDetail,
  
  // Utilitaires construct-toy
  createSearchResult: createConstructToySearchResult,
  createDetailResult: createConstructToyDetailResult,
  normalizeAvailabilityStatus,
  parseAgeRange,
  generateDetailUrl,
  cleanTitle,
  extractFranchise,
  calculatePricePerPiece,
  formatPrice
} = constructToy;

// Export des fonctions book pour accès direct
export const {
  // Recherche
  normalizeOpenLibrarySearch,
  normalizeGoogleBooksSearch,
  normalizeBedethequeSearch,
  normalizeBedethequeSerieSearch,
  normalizeComicVineSearch,
  
  // Détails
  normalizeOpenLibraryDetail,
  normalizeGoogleBooksDetail,
  normalizeBedethequeAlbumDetail,
  normalizeBedethequeSerieDetail,
  normalizeComicVineVolumeDetail,
  normalizeComicVineIssueDetail,
  
  // Utilitaires book
  createSearchResult: createBookSearchResult,
  createDetailResult: createBookDetailResult,
  normalizeLanguageCode,
  normalizeDate,
  extractYear,
  normalizeIsbn,
  isbn10to13,
  isbn13to10,
  extractSeriesFromGenres,
  cleanGenres
} = book;

// Export des fonctions movie pour accès direct
export const {
  // Recherche
  normalizeTmdbSearch: normalizeTmdbMovieSearch,
  normalizeImdbSearch: normalizeImdbMovieSearch,
  normalizeTvdbSearch: normalizeTvdbMovieSearch,
  normalizeTmdbSearchResult: normalizeTmdbMovieSearchResult,
  normalizeImdbSearchResult: normalizeImdbMovieSearchResult,
  normalizeTvdbSearchResult: normalizeTvdbMovieSearchResult,
  
  // Détails
  normalizeTmdbMovieDetail,
  normalizeImdbMovieDetail,
  normalizeTvdbMovieDetail,
  
  // Utilitaires movie
  normalizeMovieStatus,
  extractRemoteId,
  buildExternalIds,
  extractImages
} = movie;

// Export des fonctions series pour accès direct
export const {
  // Recherche
  normalizeTmdbSearch: normalizeTmdbSeriesSearch,
  normalizeImdbSearch: normalizeImdbSeriesSearch,
  normalizeTvdbSearch: normalizeTvdbSeriesSearch,
  normalizeTmdbSearchResult: normalizeTmdbSeriesSearchResult,
  normalizeImdbSearchResult: normalizeImdbSeriesSearchResult,
  normalizeTvdbSearchResult: normalizeTvdbSeriesSearchResult,
  
  // Détails
  normalizeTmdbSeriesDetail,
  normalizeImdbSeriesDetail,
  normalizeTvdbSeriesDetail,
  
  // Utilitaires series
  normalizeSeriesStatus,
  normalizeSeriesType,
  calculateImdbSeriesStatus
} = series;

// Export des fonctions anime pour accès direct
export const {
  // Recherche
  normalizeJikanSearch,
  normalizeJikanSearchItem,
  
  // Détails
  normalizeJikanAnimeDetail,
  
  // Utilitaires anime
  normalizeAnimeStatus,
  parseDuration,
  extractDate: extractAnimeDate,
  extractYear: extractAnimeYear,
  extractNames,
  collectAlternativeTitles,
  buildImages: buildAnimeImages,
  buildTrailer,
  buildBroadcast,
  buildRelated,
  buildRating: buildAnimeRating
} = anime;

// Export des fonctions manga pour accès direct
export const {
  // Recherche
  normalizeJikanMangaSearch,
  normalizeJikanMangaSearchItem,
  
  // Détails
  normalizeJikanMangaDetail,
  
  // Utilitaires manga
  normalizeMangaStatus,
  parseAuthors,
  extractDate: extractMangaDate,
  extractYear: extractMangaYear,
  extractNames: extractMangaNames,
  collectAlternativeTitles: collectMangaAlternativeTitles,
  buildImages: buildMangaImages,
  buildRating: buildMangaRating,
  buildRelated: buildMangaRelated
} = manga;

// Export des fonctions videogame pour accès direct
export const {
  // RAWG
  normalizeRawgSearch,
  normalizeRawgSearchItem,
  normalizeRawgGameDetail,
  
  // IGDB
  normalizeIgdbSearch,
  normalizeIgdbSearchItem,
  normalizeIgdbGameDetail,
  
  // JVC
  normalizeJvcSearch,
  normalizeJvcSearchItem,
  normalizeJvcGameDetail,
  
  // Utilitaires videogame
  extractNames: extractVideogameNames,
  extractYear: extractVideogameYear,
  esrbToMinAge,
  pegiToMinAge,
  detectMultiplayer,
  parseMaxPlayers,
  buildIgdbImageUrl
} = videogame;

// Export des fonctions music_album pour accès direct
export const {
  // Helpers
  formatDuration: formatMusicDuration,
  
  // MusicBrainz
  normalizeMusicBrainzSearch,
  normalizeMusicBrainzSearchItem,
  normalizeMusicBrainzAlbumDetail,
  
  // Discogs
  normalizeDiscogsSearch,
  normalizeDiscogsSearchItem,
  normalizeDiscogsReleaseDetail,
  
  // Deezer
  normalizeDeezerSearch,
  normalizeDeezerSearchItem,
  normalizeDeezerAlbumDetail,
  
  // iTunes
  normalizeItunesSearch,
  normalizeItunesSearchItem,
  normalizeItunesAlbumDetail
} = musicAlbum;

// Export des fonctions collectible pour accès direct
export const {
  // Helpers
  normalizeCondition,
  normalizeAvailability,
  
  // Coleka
  normalizeColekaSearch,
  normalizeColekaSearchItem,
  normalizeColekaDetail,
  
  // Lulu-Berlu
  normalizeLuluBerluSearch,
  normalizeLuluBerluSearchItem,
  normalizeLuluBerluDetail,
  
  // Transformerland
  normalizeTransformerlandSearch,
  normalizeTransformerlandSearchItem,
  normalizeTransformerlandDetail
} = collectible;

// Export des fonctions stickers pour accès direct
export const {
  // Paninimania
  normalizePaninimiaSearch,
  normalizePaninimiaAlbumDetail,
  
  // Utilitaires stickers
  normalizeSpecialStickerType,
  parseFrenchDate,
  extractYear: extractStickersYear,
  generateRange
} = stickers;

// Export des fonctions console pour accès direct
export const {
  // ConsoleVariations
  normalizeConsoleVariationsSearch,
  normalizeConsoleVariationsDetail,
  normalizeConsoleVariationsPlatforms,
  normalizeConsoleVariationsBrowse,
  
  // Utilitaires console
  normalizeReleaseType,
  getRarityLevel,
  normalizeItemType
} = console;

// Export des fonctions amazon pour accès direct
export const {
  // Amazon
  normalizeAmazonSearch,
  normalizeAmazonProductDetail,
  normalizeAmazonPriceComparison,
  normalizeAmazonMultiCountrySearch,
  
  // Utilitaires amazon
  getMarketplaceInfo,
  normalizeAvailabilityStatus: normalizeAmazonAvailability
} = amazon;

export default normalizers;
