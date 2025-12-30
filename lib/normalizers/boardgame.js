/**
 * lib/normalizers/boardgame.js
 * Normalisation des données de jeux de société
 * 
 * Transforme les données brutes des providers (BGG, etc.)
 * en format standardisé compatible avec l'API
 * 
 * @module normalizers/boardgame
 */

/**
 * Normalise les données de détails BGG vers le format standardisé
 * @param {object} raw - Données brutes du scraper BGG
 * @param {object} options - Options (lang, autoTrad)
 * @returns {object} - Données normalisées
 */
export function normalizeBGGDetail(raw, options = {}) {
  const { lang = 'fr', autoTrad = false } = options;
  
  if (!raw) return null;
  
  // Formater le temps de jeu
  let playtimeText = null;
  if (raw.minPlaytime && raw.maxPlaytime) {
    playtimeText = raw.minPlaytime === raw.maxPlaytime 
      ? `${raw.minPlaytime} min`
      : `${raw.minPlaytime}-${raw.maxPlaytime} min`;
  } else if (raw.minPlaytime || raw.maxPlaytime) {
    playtimeText = `${raw.minPlaytime || raw.maxPlaytime} min`;
  }
  
  // Formater le nombre de joueurs
  let playersText = null;
  if (raw.minPlayers && raw.maxPlayers) {
    playersText = raw.minPlayers === raw.maxPlayers 
      ? `${raw.minPlayers} joueur${raw.minPlayers > 1 ? 's' : ''}`
      : `${raw.minPlayers}-${raw.maxPlayers} joueurs`;
  } else if (raw.minPlayers || raw.maxPlayers) {
    playersText = `${raw.minPlayers || raw.maxPlayers} joueur(s)`;
  }
  
  // Normaliser les manuels - utiliser les URLs proxy par défaut pour contourner les protections BGG
  const manuals = (raw.manuals || []).map(m => ({
    id: m.id,
    title: m.title,
    language: m.language,
    type: m.type || 'PDF',
    // URLs proxy par défaut (contourne anti-hotlinking BGG)
    url: m.urlProxy || m.url,
    downloadUrl: m.downloadUrlProxy || m.downloadUrl,
    // URLs directes conservées pour référence
    urlDirect: m.url,
    downloadUrlDirect: m.downloadUrl,
    isRules: m.isRules,
    thumbs: m.thumbs
  }));
  
  return {
    type: 'boardgame',
    source: 'bgg_scrape',
    sourceId: raw.id,
    sourceRef: raw.id,
    productCode: raw.id,
    ean: null,
    upc: null,
    
    // Noms
    name: raw.name,
    name_original: raw.nameOriginal || null,
    
    // Description
    description: raw.description,
    description_original: raw.descriptionOriginal || null,
    
    // Métadonnées éditeur
    brand: null, // Les jeux de société n'ont pas de "marque" au sens LEGO
    publisher: raw.publishers?.[0] || null,
    publishers: raw.publishers || [],
    designers: raw.designers || [],
    
    // Catégorisation BGG (avec traductions si disponibles)
    categories: raw.categories || [],
    categories_original: raw.categoriesOriginal || null,
    mechanics: raw.mechanics || [],
    mechanics_original: raw.mechanicsOriginal || null,
    
    // Spécifications jeu de société
    specs: {
      minPlayers: raw.minPlayers,
      maxPlayers: raw.maxPlayers,
      playersRange: playersText,
      minPlaytime: raw.minPlaytime,
      maxPlaytime: raw.maxPlaytime,
      playtimeRange: playtimeText,
      minAge: raw.minAge,
      ageRange: raw.minAge ? `${raw.minAge}+` : null,
      complexity: raw.complexity, // Poids BGG (1-5)
      complexityLabel: getComplexityLabel(raw.complexity)
    },
    
    // Packaging (non applicable pour BGG)
    packaging: {
      format: null,
      weight: null,
      dimensions: null
    },
    
    // Prix (non disponible sur BGG)
    pricing: {
      price: null,
      originalPrice: null,
      currency: null,
      formatted: null,
      discount: null,
      onSale: false
    },
    
    // Disponibilité
    availability: {
      status: 'unknown',
      statusText: null,
      inStock: null,
      releaseYear: raw.year,
      isRetired: null
    },
    
    // Notation BGG
    rating: {
      average: raw.rating,
      count: raw.votes,
      rank: raw.rank,
      distribution: null
    },
    
    // Instructions/Règles - URLs proxy par défaut pour contourner anti-hotlinking BGG
    instructions: {
      available: manuals.length > 0,
      count: manuals.length,
      bestManual: raw.bestManual ? {
        id: raw.bestManual.id,
        title: raw.bestManual.title,
        language: raw.bestManual.language,
        // URLs proxy par défaut
        url: raw.bestManual.urlProxy || raw.bestManual.url,
        downloadUrl: raw.bestManual.downloadUrlProxy || raw.bestManual.downloadUrl,
        // URLs directes conservées
        urlDirect: raw.bestManual.url,
        downloadUrlDirect: raw.bestManual.downloadUrl
      } : null,
      manuals
    },
    
    // Images - URLs proxy par défaut pour contourner anti-hotlinking BGG
    images: {
      // URLs proxy par défaut (contourne protection BGG)
      primary: raw.imageProxy || raw.image,
      thumbnail: raw.imageProxy || raw.image,
      // URLs directes conservées pour référence
      primaryDirect: raw.image,
      thumbnailDirect: raw.image,
      box_front: null,
      box_back: null,
      gallery: []
    },
    
    // Vidéos
    videos: [],
    
    // URLs
    urls: {
      official: raw.url,
      source: raw.url,
      api: raw.detailUrl
    },
    
    // Traductions
    translations: {
      en: null,
      fr: null,
      de: null,
      es: null,
      it: null
    },
    
    // Relations
    related: {
      expansions: [],
      baseGame: null,
      reimplementations: [],
      similar: []
    },
    
    // Tags et catégories
    tags: [...(raw.categories || []), ...(raw.mechanics || [])],
    
    // Features spécifiques BGG
    features: buildFeatures(raw),
    
    // Métadonnées
    meta: {
      fetchedAt: new Date().toISOString(),
      lastModified: null,
      lang,
      autoTrad,
      method: raw.method || 'web-scraping'
    }
  };
}

/**
 * Normalise un résultat de recherche BGG
 * @param {object} raw - Données brutes d'un résultat de recherche
 * @param {object} options - Options
 * @returns {object} - Données normalisées
 */
export function normalizeBGGSearchItem(raw, options = {}) {
  if (!raw) return null;
  
  return {
    type: 'boardgame',
    source: 'bgg_scrape',
    sourceId: raw.id,
    name: raw.name,
    name_original: raw.nameOriginal || null,
    description: raw.description,
    description_original: raw.descriptionOriginal || null,
    year: raw.year,
    // Image proxy par défaut (contourne anti-hotlinking BGG)
    image: raw.imageProxy || raw.image,
    imageDirect: raw.image,
    detailUrl: raw.detailUrl,
    url: raw.url,
    // Champs additionnels pour compatibilité
    nameTranslated: raw.nameTranslated || false,
    descriptionTranslated: raw.descriptionTranslated || false
  };
}

/**
 * Détermine le label de complexité basé sur le poids BGG
 * @param {number} weight - Poids BGG (1-5)
 * @returns {string|null}
 */
function getComplexityLabel(weight) {
  if (!weight) return null;
  if (weight < 1.5) return 'Très simple';
  if (weight < 2.5) return 'Simple';
  if (weight < 3.5) return 'Moyen';
  if (weight < 4.5) return 'Complexe';
  return 'Très complexe';
}

/**
 * Construit la liste des features à partir des données BGG
 * @param {object} raw - Données brutes
 * @returns {string[]}
 */
function buildFeatures(raw) {
  const features = [];
  
  if (raw.minPlayers && raw.maxPlayers) {
    if (raw.minPlayers === raw.maxPlayers) {
      features.push(`${raw.minPlayers} joueur${raw.minPlayers > 1 ? 's' : ''}`);
    } else {
      features.push(`${raw.minPlayers}-${raw.maxPlayers} joueurs`);
    }
  }
  
  if (raw.minPlaytime && raw.maxPlaytime) {
    if (raw.minPlaytime === raw.maxPlaytime) {
      features.push(`${raw.minPlaytime} min`);
    } else {
      features.push(`${raw.minPlaytime}-${raw.maxPlaytime} min`);
    }
  }
  
  if (raw.minAge) {
    features.push(`${raw.minAge}+ ans`);
  }
  
  if (raw.complexity) {
    features.push(`Complexité: ${raw.complexity.toFixed(1)}/5`);
  }
  
  if (raw.rank) {
    features.push(`Rang BGG: #${raw.rank}`);
  }
  
  return features;
}

export default {
  normalizeBGGDetail,
  normalizeBGGSearchItem,
  getComplexityLabel
};
