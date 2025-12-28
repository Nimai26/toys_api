/**
 * Routes Index - toys_api v4.0.0
 * Export centralisé de tous les routers
 */

// Amazon - routers séparés par catégorie
export { 
  default as amazonRouter,
  amazonGenericRouter,
  amazonBooksRouter,
  amazonMoviesRouter,
  amazonMusicRouter,
  amazonToysRouter,
  amazonVideogamesRouter
} from './amazon.js';

export { default as legoRouter } from './lego.js';
export { default as rebrickableRouter } from './rebrickable.js';
export { default as megaRouter } from './mega.js';
export { default as playmobilRouter } from './playmobil.js';
export { default as klickypediaRouter } from './klickypedia.js';
export { default as barcodeRouter } from './barcode.js';
export { default as musicRouter } from './music.js';

// Books - Google Books et OpenLibrary
export { googleBooksRouter, openLibraryRouter } from './books.js';

// Video Games - RAWG, IGDB, JeuxVideo.com
export { rawgRouter, igdbRouter, jeuxvideoRouter } from './videogames.js';

// Media - TVDB, TMDB, IMDB (recherche globale)
export { tvdbRouter, tmdbRouter, imdbRouter } from './media.js';

// Media - Routes dédiées films et séries
export { 
  tmdbMoviesRouter, tmdbSeriesRouter,
  tvdbMoviesRouter, tvdbSeriesRouter,
  imdbMoviesRouter, imdbSeriesRouter
} from './media.js';

// Anime - Jikan (MyAnimeList)
export { default as jikanRouter, jikanAnimeRouter, jikanMangaRouter } from './anime.js';

// Comics - ComicVine, MangaDex, Bedetheque
export { comicvineRouter, mangadexRouter, bedethequeRouter } from './comics.js';

// Collectibles - routers séparés par service
export { 
  colekaRouter, 
  luluberluRouter, 
  consolevariationsRouter,
  consolevariationsConsolesRouter,
  consolevariationsAccessoriesRouter,
  transformerlandRouter,
  paninimanaRouter
} from './collectibles.js';

// Local database cache (v4.0.0)
export { localRouter } from './local.js';
