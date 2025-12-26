/**
 * lib/schemas/normalized-schemas.js
 * Schémas de normalisation pour tous les types de données
 * toys_api v3.0.0
 * 
 * Ce fichier définit la structure standard de retour pour chaque type de contenu.
 * Tous les providers doivent mapper leurs données vers ces schémas.
 */

// ============================================================================
// SCHÉMA DE BASE (commun à tous les types)
// ============================================================================

/**
 * Champs communs à tous les types de contenu
 */
export const BASE_SCHEMA = {
  // Identification
  id: null,                    // ID unique (string)
  source: null,                // Provider source (lego, playmobil, tmdb, etc.)
  sourceId: null,              // ID original du provider
  
  // Informations principales
  name: null,                  // Nom principal (string)
  originalName: null,          // Nom original si différent (string)
  slug: null,                  // Slug URL-friendly (string)
  description: null,           // Description courte (string)
  
  // Médias
  images: {
    thumbnail: null,           // Miniature (URL)
    cover: null,               // Image principale (URL)
    gallery: []                // Galerie d'images (array d'URLs)
  },
  
  // URLs
  urls: {
    official: null,            // URL officielle (string)
    source: null               // URL sur le site source (string)
  },
  
  // Métadonnées
  meta: {
    createdAt: null,           // Date de création/sortie (ISO string)
    updatedAt: null,           // Date de mise à jour (ISO string)
    lang: null                 // Langue des données (string)
  }
};

// ============================================================================
// SCHÉMA DE RÉSULTAT DE RECHERCHE (v3.2.8)
// ============================================================================

/**
 * Champs retournés par tous les endpoints /search
 * Ces champs sont harmonisés pour tous les providers
 */
export const SEARCH_RESULT_SCHEMA = {
  // Identification (requis)
  type: null,                  // Type de contenu (construct_toy, book, movie, etc.)
  source: null,                // Provider source (lego, tmdb, jikan, etc.)
  sourceId: null,              // ID original du provider
  
  // Noms (requis)
  name: null,                  // Nom affiché (traduit si disponible)
  name_original: null,         // Nom original si différent
  
  // Nouveaux champs harmonisés v3.2.8
  description: null,           // Description courte (string ou null)
  year: null,                  // Année de sortie/publication (number ou null)
  src_url: null,               // URL source du provider (string ou null)
  
  // Image (requis)
  image: null,                 // URL de l'image principale/thumbnail
  
  // Navigation (requis)
  detailUrl: null              // Endpoint pour détails (/lego/product/42217)
};

// ============================================================================
// TYPE: CONSTRUCT_TOY (LEGO, Playmobil, Mega Construx, etc.)
// ============================================================================

export const CONSTRUCT_TOY_SCHEMA = {
  ...BASE_SCHEMA,
  type: 'construct_toy',
  
  // Identifiants spécifiques
  productCode: null,           // Code produit officiel (string)
  ean: null,                   // Code EAN/barcode (string)
  upc: null,                   // Code UPC (string)
  
  // Informations produit
  brand: null,                 // Marque (LEGO, Playmobil, Mega, etc.)
  theme: null,                 // Thème/Collection (Star Wars, City, etc.)
  subtheme: null,              // Sous-thème (string)
  
  // Caractéristiques
  specs: {
    pieceCount: null,          // Nombre de pièces (number)
    figureCount: null,         // Nombre de figurines (number)
    minAge: null,              // Âge minimum (number)
    maxAge: null,              // Âge maximum (number)
    weight: null,              // Poids en grammes (number)
    dimensions: {              // Dimensions en cm
      width: null,
      height: null,
      depth: null
    }
  },
  
  // Prix et disponibilité
  pricing: {
    price: null,               // Prix actuel (number)
    originalPrice: null,       // Prix original avant promo (number)
    currency: null,            // Devise (EUR, USD, etc.)
    discount: null             // Pourcentage de remise (number)
  },
  
  availability: {
    status: null,              // available, out_of_stock, discontinued, coming_soon
    releaseDate: null,         // Date de sortie (ISO string)
    retireDate: null,          // Date de fin de vie (ISO string)
    inStock: null              // En stock (boolean)
  },
  
  // Instructions
  instructions: {
    available: false,          // Instructions disponibles (boolean)
    urls: [],                  // URLs des PDFs/pages d'instructions
    format: null               // Format (pdf, web)
  },
  
  // Enrichissement
  related: {
    parts: [],                 // Pièces détachées
    minifigs: [],              // Minifigurines
    alternates: []             // Sets alternatifs/similaires
  },
  
  // Tags et catégories
  tags: [],                    // Tags descriptifs (array de strings)
  categories: []               // Catégories (array de strings)
};

// ============================================================================
// TYPE: BOOK (Livres, BD, Comics, Manga)
// ============================================================================

export const BOOK_SCHEMA = {
  ...BASE_SCHEMA,
  type: 'book',
  
  // Identifiants
  isbn10: null,                // ISBN-10 (string)
  isbn13: null,                // ISBN-13 (string)
  
  // Auteurs et éditeur
  authors: [],                 // Auteurs (array de strings)
  illustrators: [],            // Illustrateurs (array de strings)
  publisher: null,             // Éditeur (string)
  
  // Publication
  publication: {
    date: null,                // Date de publication (ISO string)
    year: null,                // Année (number)
    edition: null,             // Édition (string)
    language: null,            // Langue du livre (string)
    originalLanguage: null     // Langue originale (string)
  },
  
  // Format
  format: {
    type: null,                // paperback, hardcover, ebook, comic, manga
    pages: null,               // Nombre de pages (number)
    dimensions: {
      width: null,             // Largeur en cm
      height: null             // Hauteur en cm
    }
  },
  
  // Numéro de tome (accès direct)
  tome: null,                  // Numéro de tome/volume (number ou string)
  
  // Contenu (pour séries/collections)
  series: {
    name: null,                // Nom de la série (string)
    volume: null,              // Numéro de tome (number) - alias de tome
    totalVolumes: null         // Nombre total de tomes (number)
  },
  
  // Classification
  genres: [],                  // Genres (array de strings)
  subjects: [],                // Sujets/Thèmes (array de strings)
  
  // Évaluations
  ratings: {
    average: null,             // Note moyenne (number 0-5 ou 0-10)
    count: null,               // Nombre de votes (number)
    source: null               // Source de la note
  },
  
  // Prix
  pricing: {
    price: null,
    currency: null
  }
};

// ============================================================================
// TYPE: MOVIE (Films)
// ============================================================================

export const MOVIE_SCHEMA = {
  ...BASE_SCHEMA,
  type: 'movie',
  
  // Identifiants externes
  externalIds: {
    imdb: null,                // ID IMDB (tt...)
    tmdb: null,                // ID TMDB
    tvdb: null                 // ID TVDB
  },
  
  // Titre
  title: null,                 // Titre principal (alias de name)
  originalTitle: null,         // Titre original
  tagline: null,               // Slogan/Tagline
  
  // Production
  production: {
    releaseDate: null,         // Date de sortie (ISO string)
    year: null,                // Année (number)
    runtime: null,             // Durée en minutes (number)
    status: null,              // released, post_production, in_production
    budget: null,              // Budget (number)
    revenue: null,             // Revenus (number)
    countries: [],             // Pays de production (array)
    languages: [],             // Langues (array)
    studios: []                // Studios (array)
  },
  
  // Équipe
  crew: {
    directors: [],             // Réalisateurs (array)
    writers: [],               // Scénaristes (array)
    producers: [],             // Producteurs (array)
    composers: []              // Compositeurs (array)
  },
  
  // Casting
  cast: [],                    // Array de { name, character, image, order }
  
  // Classification
  genres: [],                  // Genres (array)
  
  // Évaluations
  ratings: {
    average: null,             // Note moyenne (0-10)
    count: null,               // Nombre de votes
    imdb: null,                // Note IMDB
    tmdb: null,                // Note TMDB
    rottenTomatoes: null       // Note Rotten Tomatoes
  },
  
  // Classification d'âge
  certification: {
    country: null,             // Pays de la classification
    rating: null               // Classification (PG, R, etc.)
  },
  
  // Collection
  collection: {
    id: null,
    name: null,
    posterPath: null
  },
  
  // Médias supplémentaires
  videos: [],                  // Array de { type, key, site, name }
  
  // Disponibilité streaming
  watchProviders: []           // Plateformes de streaming
};

// ============================================================================
// TYPE: SERIES (Séries TV)
// ============================================================================

export const SERIES_SCHEMA = {
  ...BASE_SCHEMA,
  type: 'series',
  
  // Identifiants externes
  externalIds: {
    imdb: null,
    tmdb: null,
    tvdb: null
  },
  
  // Titre
  title: null,
  originalTitle: null,
  tagline: null,
  
  // Diffusion
  broadcast: {
    status: null,              // returning, ended, canceled, in_production
    firstAirDate: null,        // Première diffusion (ISO string)
    lastAirDate: null,         // Dernière diffusion (ISO string)
    network: null,             // Chaîne principale
    networks: [],              // Toutes les chaînes
    runtime: null,             // Durée moyenne d'épisode (minutes)
    type: null                 // scripted, documentary, reality, etc.
  },
  
  // Épisodes
  episodes: {
    seasonCount: null,         // Nombre de saisons (number)
    episodeCount: null,        // Nombre total d'épisodes (number)
    seasons: []                // Array de { number, episodeCount, airDate, name }
  },
  
  // Équipe
  crew: {
    creators: [],              // Créateurs
    showrunners: []            // Showrunners
  },
  
  // Casting
  cast: [],
  
  // Classification
  genres: [],
  
  // Évaluations
  ratings: {
    average: null,
    count: null,
    imdb: null,
    tmdb: null
  },
  
  // Classification d'âge
  certification: {
    country: null,
    rating: null
  },
  
  // Disponibilité
  watchProviders: []
};

// ============================================================================
// TYPE: ANIME (Anime)
// ============================================================================

export const ANIME_SCHEMA = {
  ...BASE_SCHEMA,
  type: 'anime',
  
  // Identifiants
  externalIds: {
    mal: null,                 // MyAnimeList ID
    anilist: null,             // AniList ID
    kitsu: null                // Kitsu ID
  },
  
  // Titres
  titles: {
    romaji: null,              // Titre en romaji
    english: null,             // Titre anglais
    japanese: null,            // Titre japonais
    synonyms: []               // Titres alternatifs
  },
  
  // Format
  format: {
    type: null,                // tv, movie, ova, ona, special, music
    source: null,              // manga, light_novel, original, etc.
    episodes: null,            // Nombre d'épisodes
    duration: null             // Durée par épisode (minutes)
  },
  
  // Diffusion
  broadcast: {
    status: null,              // airing, finished, not_yet_aired
    season: null,              // winter, spring, summer, fall
    year: null,                // Année
    startDate: null,
    endDate: null,
    studio: null               // Studio principal
  },
  
  // Classification
  genres: [],
  themes: [],                  // Thèmes spécifiques (isekai, mecha, etc.)
  demographics: [],            // Shounen, Shoujo, Seinen, Josei
  
  // Évaluations
  ratings: {
    score: null,               // Score (0-10)
    scoredBy: null,            // Nombre de votes
    rank: null,                // Classement
    popularity: null           // Rang de popularité
  },
  
  // Relations
  relations: {
    prequels: [],
    sequels: [],
    adaptations: [],
    spinoffs: []
  },
  
  // Streaming
  streaming: []                // Plateformes de streaming
};

// ============================================================================
// TYPE: MANGA (Manga, Manhwa, Manhua)
// ============================================================================

export const MANGA_SCHEMA = {
  ...BASE_SCHEMA,
  type: 'manga',
  
  // Identifiants
  externalIds: {
    mal: null,
    anilist: null,
    mangadex: null
  },
  
  // Titres
  titles: {
    romaji: null,
    english: null,
    japanese: null,
    synonyms: []
  },
  
  // Format
  format: {
    type: null,                // manga, manhwa, manhua, one_shot
    status: null,              // publishing, finished, hiatus
    chapters: null,            // Nombre de chapitres
    volumes: null              // Nombre de volumes
  },
  
  // Publication
  publication: {
    startDate: null,
    endDate: null,
    magazine: null,            // Magazine de prépublication
    publisher: null
  },
  
  // Auteurs
  authors: [],                 // Auteurs (story)
  artists: [],                 // Dessinateurs (art)
  
  // Classification
  genres: [],
  themes: [],
  demographics: [],
  
  // Évaluations
  ratings: {
    score: null,
    scoredBy: null,
    rank: null,
    popularity: null
  }
};

// ============================================================================
// TYPE: VIDEOGAME (Jeux vidéo)
// ============================================================================

export const VIDEOGAME_SCHEMA = {
  ...BASE_SCHEMA,
  type: 'videogame',
  
  // Identifiants
  externalIds: {
    rawg: null,
    igdb: null,
    steam: null
  },
  
  // Informations principales
  title: null,
  
  // Sortie
  release: {
    date: null,                // Date de sortie (ISO string)
    year: null,
    status: null               // released, upcoming, early_access
  },
  
  // Plateformes
  platforms: [],               // Array de { name, slug, releaseDate }
  
  // Développement
  development: {
    developers: [],            // Studios de développement
    publishers: [],            // Éditeurs
    engine: null               // Moteur de jeu
  },
  
  // Gameplay
  gameplay: {
    genres: [],                // Genres (RPG, FPS, etc.)
    modes: [],                 // Modes (single, multi, coop)
    perspectives: [],          // Vue (first_person, third_person, etc.)
    themes: []                 // Thèmes (sci-fi, fantasy, etc.)
  },
  
  // Évaluations
  ratings: {
    average: null,             // Note moyenne
    count: null,               // Nombre de votes
    metacritic: null,          // Score Metacritic
    opencritic: null           // Score OpenCritic
  },
  
  // Classification
  esrb: null,                  // Classification ESRB
  pegi: null,                  // Classification PEGI
  
  // DLC et éditions
  editions: [],                // Éditions disponibles
  dlcs: [],                    // DLCs
  
  // Système
  requirements: {
    minimum: null,
    recommended: null
  },
  
  // Liens
  stores: []                   // Array de { name, url, price }
};

// ============================================================================
// TYPE: MUSIC_ALBUM (Albums musicaux)
// ============================================================================

export const MUSIC_ALBUM_SCHEMA = {
  ...BASE_SCHEMA,
  type: 'music_album',
  
  // Identifiants
  externalIds: {
    musicbrainz: null,
    discogs: null,
    spotify: null,
    deezer: null
  },
  
  // Artistes
  artists: [],                 // Array de { name, id }
  
  // Album
  album: {
    type: null,                // album, single, ep, compilation
    releaseDate: null,
    year: null,
    label: null,               // Label
    format: null,              // cd, vinyl, digital
    totalTracks: null,
    totalDiscs: null,
    duration: null             // Durée totale en secondes
  },
  
  // Pistes
  tracks: [],                  // Array de { number, title, duration, disc }
  
  // Genres
  genres: [],
  styles: [],                  // Styles plus spécifiques
  
  // Évaluations
  ratings: {
    average: null,
    count: null
  },
  
  // Liens
  links: {
    spotify: null,
    deezer: null,
    appleMusic: null,
    youtube: null
  }
};

// ============================================================================
// TYPE: COLLECTIBLE (Objets de collection génériques)
// ============================================================================

export const COLLECTIBLE_SCHEMA = {
  ...BASE_SCHEMA,
  type: 'collectible',
  
  // Identifiants
  sku: null,                   // SKU vendeur
  ean: null,
  upc: null,
  
  // Produit
  brand: null,                 // Marque
  manufacturer: null,          // Fabricant
  line: null,                  // Ligne de produits
  series: null,                // Série
  
  // Caractéristiques
  specs: {
    material: null,            // Matériau
    scale: null,               // Échelle (1:18, etc.)
    size: null,                // Taille (cm ou description)
    weight: null,              // Poids (grammes)
    color: null                // Couleur principale
  },
  
  // Condition (pour vintage)
  condition: {
    grade: null,               // mint, near_mint, good, fair, poor
    boxed: null,               // En boîte (boolean)
    complete: null             // Complet (boolean)
  },
  
  // Prix
  pricing: {
    price: null,
    originalPrice: null,
    currency: null
  },
  
  // Disponibilité
  availability: {
    status: null,              // available, sold, rare, discontinued
    quantity: null,
    releaseYear: null
  },
  
  // Catégorisation
  category: null,              // Catégorie principale
  subcategory: null,           // Sous-catégorie
  tags: []
};

// ============================================================================
// TYPE: CONSOLE (Consoles et accessoires gaming)
// ============================================================================

export const CONSOLE_SCHEMA = {
  ...BASE_SCHEMA,
  type: 'console',
  
  // Identifiants
  sku: null,
  
  // Produit
  brand: null,                 // Nintendo, Sony, Microsoft, Sega, etc.
  platform: null,              // Plateforme (PS5, Switch, etc.)
  variant: null,               // Variante (Slim, Pro, etc.)
  region: null,                // Région (PAL, NTSC, etc.)
  
  // Type
  productType: null,           // console, controller, accessory, bundle
  
  // Caractéristiques
  specs: {
    color: null,
    storage: null,             // Capacité stockage (string)
    connectivity: [],          // Connectivité (wifi, bluetooth, etc.)
    included: []               // Contenu du pack
  },
  
  // Dates
  dates: {
    releaseDate: null,
    releaseYear: null,
    discontinuedYear: null
  },
  
  // Rareté
  rarity: {
    level: null,               // common, uncommon, rare, very_rare, legendary
    production: null           // Nombre produit (si connu)
  },
  
  // Prix
  pricing: {
    price: null,
    currency: null
  },
  
  // État
  condition: null
};

// ============================================================================
// TYPE: STICKERS (Albums et vignettes à collectionner)
// ============================================================================

export const STICKERS_SCHEMA = {
  ...BASE_SCHEMA,
  type: 'stickers',
  
  // Identifiants
  ean: null,
  catalogNumber: null,         // Numéro de catalogue éditeur
  
  // Éditeur
  publisher: null,             // Panini, Topps, etc.
  brand: null,                 // Marque/Licence
  
  // Type de produit
  productType: null,           // album, packet, box, sticker, card
  
  // Album
  album: {
    name: null,                // Nom de l'album/collection
    year: null,                // Année de sortie
    totalStickers: null,       // Nombre total de vignettes
    totalPages: null,          // Nombre de pages (pour albums)
    format: null,              // softcover, hardcover
    edition: null,             // standard, premium, collector
    language: null,            // Langue de l'album
    country: null              // Pays de distribution
  },
  
  // Contenu (pour paquets/boîtes)
  content: {
    stickersPerPack: null,     // Vignettes par paquet
    packsPerBox: null,         // Paquets par boîte
    specialCards: null,        // Cartes spéciales incluses
    hasShiny: null             // Contient des brillantes (boolean)
  },
  
  // Thème
  theme: {
    sport: null,               // football, basketball, etc.
    competition: null,         // World Cup, Euro, Champions League
    season: null,              // Saison (2024-2025)
    license: null              // Licence (FIFA, UEFA, etc.)
  },
  
  // État et rareté
  condition: {
    grade: null,               // mint, near_mint, good, fair
    complete: null,            // Album complet (boolean)
    missingCount: null         // Nombre de vignettes manquantes
  },
  
  rarity: {
    level: null,               // common, rare, very_rare
    isLimitedEdition: false
  },
  
  // Prix
  pricing: {
    price: null,
    originalPrice: null,
    currency: null
  },
  
  // Disponibilité
  availability: {
    status: null,              // available, out_of_stock, discontinued
    releaseDate: null,
    endDate: null              // Fin de commercialisation
  },
  
  // Catégories
  categories: [],
  tags: []
};

// ============================================================================
// TYPE: BARCODE_RESULT (Résultat de scan de code-barres)
// ============================================================================

export const BARCODE_RESULT_SCHEMA = {
  type: 'barcode_result',
  
  // Code scanné
  barcode: {
    code: null,                // Code brut
    type: null,                // ean13, upc, isbn10, isbn13
    isValid: false             // Validité du code
  },
  
  // Produit identifié
  product: null,               // Objet produit (selon son type)
  productType: null,           // Type de produit détecté
  
  // Sources consultées
  sources: {
    matched: [],               // Sources ayant trouvé le produit
    failed: []                 // Sources sans résultat
  },
  
  // Confiance
  confidence: null             // Score de confiance (0-1)
};

// ============================================================================
// WRAPPER DE RÉPONSE API
// ============================================================================

/**
 * Structure standard pour les réponses de recherche
 */
export const SEARCH_RESPONSE_SCHEMA = {
  success: true,
  data: {
    results: [],               // Array d'objets normalisés
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasMore: false
    },
    query: null,               // Requête effectuée
    filters: {}                // Filtres appliqués
  },
  meta: {
    source: null,              // Provider source
    responseTime: null,        // Temps de réponse (ms)
    cached: false,             // Depuis le cache
    lang: null                 // Langue des résultats
  }
};

/**
 * Structure standard pour les réponses de détail
 */
export const DETAIL_RESPONSE_SCHEMA = {
  success: true,
  data: null,                  // Objet normalisé unique
  meta: {
    source: null,
    responseTime: null,
    cached: false,
    lang: null
  }
};

/**
 * Structure standard pour les erreurs
 */
export const ERROR_RESPONSE_SCHEMA = {
  success: false,
  error: {
    code: null,                // Code erreur (string)
    message: null,             // Message utilisateur
    details: null              // Détails techniques (optionnel)
  },
  meta: {
    source: null,
    responseTime: null
  }
};

// ============================================================================
// MAPPING DES TYPES PAR PROVIDER
// ============================================================================

export const PROVIDER_TYPE_MAP = {
  // Jouets de construction
  lego: 'construct_toy',
  playmobil: 'construct_toy',
  klickypedia: 'construct_toy',
  mega: 'construct_toy',
  rebrickable: 'construct_toy',
  
  // Livres
  googlebooks: 'book',
  openlibrary: 'book',
  
  // BD/Comics/Manga
  bedetheque: 'book',          // subtype: comic_fr
  comicvine: 'book',           // subtype: comic_us
  mangadex: 'manga',
  
  // Films et séries
  tmdb: ['movie', 'series'],   // Selon l'endpoint
  tvdb: ['movie', 'series'],
  imdb: ['movie', 'series'],
  
  // Anime
  jikan: ['anime', 'manga'],
  
  // Jeux vidéo
  rawg: 'videogame',
  igdb: 'videogame',
  jvc: 'videogame',
  
  // Musique
  musicbrainz: 'music_album',
  discogs: 'music_album',
  deezer: 'music_album',
  itunes: 'music_album',
  
  // Collectibles génériques
  coleka: 'collectible',
  luluberlu: 'collectible',
  transformerland: 'collectible',
  
  // Stickers / Albums Panini
  paninimania: 'stickers',
  
  // Consoles
  consolevariations: 'console',
  
  // Commerce multi-types
  amazon: [
    'book',
    'construct_toy',
    'music_album',
    'videogame',
    'collectible',
    'movie',
    'series',
    'console',
    'manga',
    'anime'
  ],
  
  // Barcode
  barcode: 'barcode_result'
};

// ============================================================================
// EXPORT DES SCHÉMAS
// ============================================================================

export const SCHEMAS = {
  base: BASE_SCHEMA,
  construct_toy: CONSTRUCT_TOY_SCHEMA,
  book: BOOK_SCHEMA,
  movie: MOVIE_SCHEMA,
  series: SERIES_SCHEMA,
  anime: ANIME_SCHEMA,
  manga: MANGA_SCHEMA,
  videogame: VIDEOGAME_SCHEMA,
  music_album: MUSIC_ALBUM_SCHEMA,
  collectible: COLLECTIBLE_SCHEMA,
  console: CONSOLE_SCHEMA,
  stickers: STICKERS_SCHEMA,
  barcode_result: BARCODE_RESULT_SCHEMA
};

export default SCHEMAS;
