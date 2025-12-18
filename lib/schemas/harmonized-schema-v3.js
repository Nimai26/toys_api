/**
 * lib/schemas/harmonized-schema-v3.js
 * Schémas harmonisés pour l'API toys_api v3.0.0
 * 
 * PRINCIPE:
 * - Recherche: Retour minimaliste pour liste rapide
 * - Détails: Maximum d'informations, même si null pour certains providers
 * - Traductions: champ + champ_original pour les données traduites
 * 
 * Créé le: 2024-12-18
 * Basé sur l'analyse des providers construct_toy:
 * - LEGO, Playmobil, Klickypedia, Mega, Rebrickable
 */

// ============================================================================
// SCHÉMA DE BASE RECHERCHE (commun à tous les types)
// ============================================================================

/**
 * Format de retour pour les recherches (liste)
 * Objectif: Affichage rapide en liste, permet d'appeler les détails
 */
export const BASE_SEARCH_SCHEMA = {
  // Identification
  type: null,                  // Type de contenu (construct_toy, book, movie, etc.)
  source: null,                // Provider source (lego, playmobil, tmdb, etc.)
  sourceId: null,              // ID original du provider
  
  // Informations minimales
  name: null,                  // Nom affiché (traduit si disponible)
  name_original: null,         // Nom original si différent
  
  // Image unique pour la liste
  image: null,                 // URL de l'image principale/thumbnail
  
  // Lien pour obtenir les détails
  detailUrl: null              // URL endpoint pour détails (ex: /lego/product/42217)
};

// ============================================================================
// SCHÉMA DE BASE DÉTAILS (commun à tous les types)
// ============================================================================

/**
 * Format de retour pour les détails (fiche complète)
 * Objectif: Toutes les informations disponibles, même si null
 */
export const BASE_DETAIL_SCHEMA = {
  // === IDENTIFICATION ===
  type: null,                  // Type de contenu
  source: null,                // Provider source
  sourceId: null,              // ID original du provider
  sourceRef: null,             // Référence secondaire (code produit, ISBN, etc.)
  
  // === INFORMATIONS PRINCIPALES (avec traduction) ===
  name: null,                  // Nom traduit/localisé
  name_original: null,         // Nom original
  description: null,           // Description traduite
  description_original: null,  // Description originale
  slug: null,                  // Slug URL-friendly
  
  // === MÉDIAS ===
  images: {
    primary: null,             // Image principale HD
    thumbnail: null,           // Miniature
    box_front: null,           // Image de la boîte (face)
    box_back: null,            // Image de la boîte (dos)
    gallery: []                // Toutes les autres images
  },
  videos: [],                  // URLs des vidéos [{url, type, title}]
  
  // === URLS ===
  urls: {
    official: null,            // URL officielle du produit
    source: null,              // URL sur le site source
    api: null                  // URL API pour rafraîchir les données
  },
  
  // === TRADUCTIONS DISPONIBLES ===
  translations: {
    en: null,
    fr: null,
    de: null,
    es: null,
    it: null,
    pt: null,
    nl: null,
    ja: null
  },
  
  // === MÉTADONNÉES ===
  meta: {
    fetchedAt: null,           // Date de récupération (ISO string)
    lastModified: null,        // Date dernière modification source (ISO string)
    lang: null,                // Langue des données retournées
    locale: null               // Locale complète (fr-FR, en-US, etc.)
  }
};

// ============================================================================
// TYPE: CONSTRUCT_TOY - RECHERCHE
// ============================================================================

export const CONSTRUCT_TOY_SEARCH_SCHEMA = {
  ...BASE_SEARCH_SCHEMA,
  type: 'construct_toy'
};

// ============================================================================
// TYPE: CONSTRUCT_TOY - DÉTAILS
// ============================================================================

/**
 * Schéma détaillé pour construct_toy
 * Sources: LEGO, Playmobil, Klickypedia, Mega, Rebrickable
 * 
 * Légende disponibilité par provider:
 * ✅ LEGO: prix, stock, instructions, images HD, rating
 * ✅ Playmobil: prix, stock, instructions, images HD
 * ✅ Klickypedia: historique, traductions, figurines, dates (pas de prix)
 * ✅ Mega: prix, stock via Shopify (peu de détails techniques)
 * ✅ Rebrickable: pièces détaillées, minifigs, années (pas de prix)
 */
export const CONSTRUCT_TOY_DETAIL_SCHEMA = {
  ...BASE_DETAIL_SCHEMA,
  type: 'construct_toy',
  
  // === IDENTIFICATION PRODUIT ===
  productCode: null,           // Code produit officiel (42217, 70176, etc.)
  sku: null,                   // SKU interne (variant LEGO, Mattel, etc.)
  ean: null,                   // Code EAN/barcode
  upc: null,                   // Code UPC
  
  // === MARQUE ET THÈME ===
  brand: null,                 // Marque: LEGO, Playmobil, MEGA, etc.
  theme: null,                 // Thème traduit: Technic, City, Pirates...
  theme_original: null,        // Thème original
  subtheme: null,              // Sous-thème traduit
  subtheme_original: null,     // Sous-thème original
  franchise: null,             // Franchise: Star Wars, Pokemon, etc.
  
  // === SPÉCIFICATIONS TECHNIQUES ===
  specs: {
    pieceCount: null,          // Nombre de pièces (number)
    figureCount: null,         // Nombre de figurines/minifigs (number)
    minAge: null,              // Âge minimum recommandé (number)
    maxAge: null,              // Âge maximum recommandé (number)
    ageRange: null,            // Tranche d'âge texte: "18+", "6-12"
    weight: null,              // Poids en grammes (number)
    dimensions: {
      width: null,             // Largeur en cm (number)
      height: null,            // Hauteur en cm (number)
      depth: null,             // Profondeur en cm (number)
      unit: 'cm'               // Unité de mesure
    },
    scale: null,               // Échelle si applicable (ex: "1:8")
    difficulty: null           // Niveau de difficulté (1-5)
  },
  
  // === PACKAGING ===
  packaging: {
    format: null,              // Format: Standard Box, Collector, Polybag, etc.
    weight: null,              // Poids emballé (grammes)
    dimensions: {
      width: null,
      height: null,
      depth: null
    }
  },
  
  // === PRIX ET PROMOTION ===
  pricing: {
    price: null,               // Prix actuel (number)
    originalPrice: null,       // Prix original avant promo (number)
    currency: null,            // Devise: EUR, USD, GBP...
    currencySymbol: null,      // Symbole: €, $, £...
    formatted: null,           // Prix formaté: "189,99 €"
    discount: null,            // Remise en % (number)
    onSale: false,             // En promotion (boolean)
    pricePerPiece: null        // Prix par pièce (calculé)
  },
  
  // === DISPONIBILITÉ ===
  availability: {
    status: null,              // Statut normalisé (voir mapping ci-dessous)
    statusText: null,          // Texte du statut traduit
    statusText_original: null, // Texte du statut original
    inStock: null,             // En stock (boolean)
    quantity: null,            // Quantité disponible (number)
    canAddToBag: null,         // Peut être ajouté au panier (boolean)
    isNew: null,               // Nouveauté (boolean)
    isExclusive: null,         // Exclusivité (boolean)
    isRetired: null,           // Retiré de la vente (boolean)
    isComingSoon: null,        // Prochainement disponible (boolean)
    releaseDate: null,         // Date de sortie (ISO string ou année)
    releaseYear: null,         // Année de sortie (number)
    retireDate: null,          // Date de fin de vie (ISO string ou année)
    retireYear: null           // Année de fin de vie (number)
  },
  
  // === ÉVALUATIONS ===
  rating: {
    average: null,             // Note moyenne (0-5)
    count: null,               // Nombre d'avis (number)
    distribution: null         // Répartition {1: x, 2: x, 3: x, 4: x, 5: x}
  },
  
  // === INSTRUCTIONS DE MONTAGE ===
  instructions: {
    available: false,          // Instructions disponibles (boolean)
    count: null,               // Nombre de livrets (number)
    format: null,              // Format: pdf, web, interactive
    manuals: []                // Liste [{id, description, url, pdfUrl}]
  },
  
  // === PIÈCES DÉTAILLÉES (principalement Rebrickable) ===
  parts: {
    totalCount: null,          // Nombre total de pièces
    uniqueCount: null,         // Nombre de pièces uniques
    spareCount: null,          // Nombre de pièces de rechange
    items: []                  // Liste [{partNum, name, color, colorRgb, quantity, isSpare, imageUrl, elementId}]
  },
  
  // === MINIFIGURINES ===
  minifigs: {
    count: null,               // Nombre de minifigs
    items: []                  // Liste [{id, name, quantity, imageUrl, numParts}]
  },
  
  // === RELATIONS ===
  related: {
    alternates: [],            // Sets alternatifs (même pièces)
    similar: [],               // Sets similaires
    series: [],                // Autres sets de la même série
    accessories: []            // Accessoires compatibles
  },
  
  // === TAGS ET CATÉGORIES ===
  tags: [],                    // Tags descriptifs
  categories: [],              // Catégories
  features: []                 // Caractéristiques spéciales (motorisé, télécommandé, etc.)
};

// ============================================================================
// MAPPING DES STATUTS DE DISPONIBILITÉ
// ============================================================================

/**
 * Mapping des statuts vers un format normalisé
 * Utilisé pour homogénéiser les statuts des différents providers
 */
export const AVAILABILITY_STATUS_MAP = {
  // LEGO
  'E_AVAILABLE': 'in_stock',
  'F_BACKORDER_FOR_DATE': 'backorder',
  'C_OUT_OF_STOCK': 'out_of_stock',
  'D_TEMPORARILY_SOLD_OUT': 'temporarily_unavailable',
  
  // Playmobil
  'available': 'in_stock',
  'out_of_stock': 'out_of_stock',
  
  // Klickypedia
  'discontinued': 'retired',
  'unknown': 'unknown',
  
  // Mega
  'true': 'in_stock',   // inStock: true
  'false': 'out_of_stock', // inStock: false
  
  // Valeurs normalisées
  'in_stock': 'in_stock',
  'out_of_stock': 'out_of_stock',
  'backorder': 'backorder',
  'preorder': 'preorder',
  'temporarily_unavailable': 'temporarily_unavailable',
  'retired': 'retired',
  'coming_soon': 'coming_soon',
  'unknown': 'unknown'
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Crée un objet de recherche vide pour construct_toy
 */
export function createConstructToySearchResult() {
  return JSON.parse(JSON.stringify(CONSTRUCT_TOY_SEARCH_SCHEMA));
}

/**
 * Crée un objet de détails vide pour construct_toy
 */
export function createConstructToyDetail() {
  return JSON.parse(JSON.stringify(CONSTRUCT_TOY_DETAIL_SCHEMA));
}

/**
 * Normalise un statut de disponibilité
 * @param {string} status - Statut brut du provider
 * @returns {string} Statut normalisé
 */
export function normalizeAvailabilityStatus(status) {
  if (!status) return 'unknown';
  const normalized = AVAILABILITY_STATUS_MAP[status.toString()];
  return normalized || 'unknown';
}

/**
 * Parse une tranche d'âge vers des valeurs min/max
 * @param {string} ageRange - Ex: "18+", "6-12", "3+"
 * @returns {{minAge: number|null, maxAge: number|null}}
 */
export function parseAgeRange(ageRange) {
  if (!ageRange) return { minAge: null, maxAge: null };
  
  const str = ageRange.toString();
  
  // Format "18+" ou "3+"
  const plusMatch = str.match(/(\d+)\+/);
  if (plusMatch) {
    return { minAge: parseInt(plusMatch[1]), maxAge: null };
  }
  
  // Format "6-12"
  const rangeMatch = str.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    return { minAge: parseInt(rangeMatch[1]), maxAge: parseInt(rangeMatch[2]) };
  }
  
  // Nombre seul
  const numMatch = str.match(/(\d+)/);
  if (numMatch) {
    return { minAge: parseInt(numMatch[1]), maxAge: null };
  }
  
  return { minAge: null, maxAge: null };
}

/**
 * Extrait l'année d'une date ISO ou d'un nombre
 * @param {string|number} date - Date ISO ou année
 * @returns {number|null}
 */
export function extractYear(date) {
  if (!date) return null;
  
  // Si c'est déjà un nombre (année)
  if (typeof date === 'number') return date;
  
  // Si c'est une chaîne
  const str = date.toString();
  
  // Format ISO (2024-12-18T...)
  if (str.includes('-')) {
    const year = parseInt(str.substring(0, 4));
    return isNaN(year) ? null : year;
  }
  
  // Année seule
  const year = parseInt(str);
  return isNaN(year) ? null : year;
}

/**
 * Calcule le prix par pièce
 * @param {number} price - Prix total
 * @param {number} pieceCount - Nombre de pièces
 * @returns {number|null}
 */
export function calculatePricePerPiece(price, pieceCount) {
  if (!price || !pieceCount || pieceCount === 0) return null;
  return Math.round((price / pieceCount) * 100) / 100;
}

/**
 * Génère l'URL de détails pour un provider
 * @param {string} provider - Nom du provider
 * @param {string} id - ID du produit
 * @returns {string}
 */
export function generateDetailUrl(provider, id) {
  const routes = {
    'lego': `/lego/product/${id}`,
    'playmobil': `/playmobil/product/${id}`,
    'klickypedia': `/klickypedia/product/${id}`,
    'mega': `/mega/product/${id}`,
    'rebrickable': `/rebrickable/set/${id}`
  };
  return routes[provider] || `/${provider}/product/${id}`;
}

// ============================================================================
// EXPORT PAR DÉFAUT
// ============================================================================

export default {
  // Schémas de recherche
  BASE_SEARCH_SCHEMA,
  CONSTRUCT_TOY_SEARCH_SCHEMA,
  
  // Schémas de détails
  BASE_DETAIL_SCHEMA,
  CONSTRUCT_TOY_DETAIL_SCHEMA,
  
  // Mappings
  AVAILABILITY_STATUS_MAP,
  
  // Fonctions utilitaires
  createConstructToySearchResult,
  createConstructToyDetail,
  normalizeAvailabilityStatus,
  parseAgeRange,
  extractYear,
  calculatePricePerPiece,
  generateDetailUrl
};
