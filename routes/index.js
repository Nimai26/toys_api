/**
 * Routes Index - toys_api
 * Export centralisé de tous les routers
 */

export { default as amazonRouter } from './amazon.js';
export { default as legoRouter } from './lego.js';
export { default as rebrickableRouter } from './rebrickable.js';
export { default as megaRouter } from './mega.js';
export { default as barcodeRouter } from './barcode.js';
export { default as musicRouter } from './music.js';

// Books - Google Books et OpenLibrary
export { googleBooksRouter, openLibraryRouter } from './books.js';

// Video Games - RAWG, IGDB, JVC
export { rawgRouter, igdbRouter, jvcRouter } from './videogames.js';

// Media - TVDB, TMDB, IMDB
export { tvdbRouter, tmdbRouter, imdbRouter } from './media.js';

// Anime - Jikan (MyAnimeList)
export { default as jikanRouter } from './anime.js';

// Comics - ComicVine, MangaDex, Bedetheque
export { comicvineRouter, mangadexRouter, bedethequeRouter } from './comics.js';

// Collectibles - routers séparés par service
export { 
  colekaRouter, 
  luluberluRouter, 
  consolevariationsRouter, 
  transformerlandRouter,
  paninimanaRouter
} from './collectibles.js';
