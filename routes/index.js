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

// Authors - Search by author for multiple providers
export { default as authorsRouter } from './authors.js';

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

// BoardGameGeek (jeux de société)
export { default as bggRouter } from './bgg.js';
export { default as bggScrapeRouter } from './bgg_scrape.js';

// Proxy (images TCG, anti-CORS)
export { default as proxyRouter } from './proxy.js';

// Trading Card Games (TCG)
export { default as tcgPokemonRouter } from './tcg_pokemon.js';
export { default as tcgMtgRouter } from './tcg_mtg.js';
export { default as tcgYugiohRouter } from './tcg_yugioh.js';
export { default as tcgLorcanaRouter } from './tcg_lorcana.js';
export { default as tcgDigimonRouter } from './tcg_digimon.js';
export { default as tcgOnePieceRouter } from './tcg_onepiece.js';
export { default as tcgCarddassRouter } from './tcg_carddass.js';

// Local database cache (v4.0.0)
export { localRouter } from './local.js';
