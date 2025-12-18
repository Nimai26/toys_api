/**
 * lib/utils/routeHelpers.js - Helpers pour routes normalisées
 * toys_api v3.0.0
 * 
 * Structure standard des endpoints :
 * - /search : Recherche avec q, lang, max, autoTrad
 * - /details : Détails via detailUrl fournie par search
 * - /code : Recherche par code-barres (EAN/UPC/ISBN)
 */

import { DEFAULT_LOCALE } from '../config.js';

// ============================================================================
// CONSTANTES
// ============================================================================

export const DEFAULT_MAX_RESULTS = 20;
export const MAX_RESULTS_LIMIT = 100;

/**
 * Paramètres standard extraits de toutes les requêtes normalisées
 */
export const STANDARD_PARAMS = {
  lang: 'fr',           // Langue par défaut
  max: 20,              // Nombre max de résultats par défaut
  autoTrad: false       // Traduction automatique désactivée par défaut
};

// ============================================================================
// EXTRACTION DES PARAMÈTRES STANDARD
// ============================================================================

/**
 * Extrait et normalise les paramètres standard d'une requête
 * @param {Request} req - Requête Express
 * @returns {Object} Paramètres normalisés
 */
export function extractStandardParams(req) {
  return {
    // Terme de recherche
    q: req.query.q || req.query.query || req.query.search || null,
    
    // Langue (format: fr, en, de, etc. ou locale: fr-FR, en-US)
    lang: normalizeLanguage(req.query.lang || req.query.language || req.query.locale || 'fr'),
    locale: normalizeLocale(req.query.lang || req.query.language || req.query.locale || DEFAULT_LOCALE),
    
    // Nombre max de résultats
    max: Math.min(
      parseInt(req.query.max || req.query.limit || req.query.pageSize || DEFAULT_MAX_RESULTS, 10),
      MAX_RESULTS_LIMIT
    ),
    
    // Pagination
    page: parseInt(req.query.page || 1, 10),
    
    // Traduction automatique
    autoTrad: parseBoolean(req.query.autoTrad || req.query.autotrad || req.query.translate),
    
    // URL de détails (pour /details)
    detailUrl: req.query.detailUrl || req.query.url || req.query.detail_url || null,
    
    // Code-barres (pour /code)
    code: req.query.code || req.params.code || null,
    
    // Pays (pour Amazon et autres multi-pays)
    country: req.query.country || req.query.region || 'fr'
  };
}

/**
 * Normalise un code langue vers format court (fr, en, de, etc.)
 * @param {string} lang - Code langue ou locale
 * @returns {string}
 */
export function normalizeLanguage(lang) {
  if (!lang) return 'fr';
  // Si c'est une locale (fr-FR, en-US), extraire la langue
  if (lang.includes('-') || lang.includes('_')) {
    return lang.split(/[-_]/)[0].toLowerCase();
  }
  return lang.toLowerCase().substring(0, 2);
}

/**
 * Normalise vers une locale complète (fr-FR, en-US, etc.)
 * @param {string} input - Code langue ou locale
 * @returns {string}
 */
export function normalizeLocale(input) {
  if (!input) return 'fr-FR';
  
  // Si c'est déjà une locale complète
  if (input.includes('-')) return input;
  if (input.includes('_')) return input.replace('_', '-');
  
  // Mapping langue courte vers locale
  const localeMap = {
    'fr': 'fr-FR',
    'en': 'en-US',
    'de': 'de-DE',
    'es': 'es-ES',
    'it': 'it-IT',
    'pt': 'pt-PT',
    'nl': 'nl-NL',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
    'ru': 'ru-RU',
    'pl': 'pl-PL'
  };
  
  return localeMap[input.toLowerCase()] || `${input.toLowerCase()}-${input.toUpperCase()}`;
}

/**
 * Parse une valeur en booléen
 * @param {any} value 
 * @returns {boolean}
 */
export function parseBoolean(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const str = String(value).toLowerCase().trim();
  return str === 'true' || str === '1' || str === 'yes' || str === 'on';
}

// ============================================================================
// GÉNÉRATION DES URLs DE DÉTAIL
// ============================================================================

/**
 * Génère l'URL de détails pour un provider
 * Format: /{provider}/details?detailUrl={encodedPath}
 * 
 * @param {string} provider - Nom du provider
 * @param {string} id - ID du produit
 * @param {string} [type] - Type de ressource (product, set, album, etc.)
 * @returns {string}
 */
export function generateDetailUrl(provider, id, type = 'product') {
  // Chemin interne (sera utilisé par /details pour router)
  const internalPath = `/${provider}/${type}/${id}`;
  return `/${provider}/details?detailUrl=${encodeURIComponent(internalPath)}`;
}

/**
 * Parse une detailUrl pour extraire provider, type et id
 * @param {string} detailUrl - URL de détails encodée ou non
 * @returns {{provider: string, type: string, id: string}|null}
 */
export function parseDetailUrl(detailUrl) {
  if (!detailUrl) return null;
  
  try {
    // Décoder si nécessaire
    const decoded = decodeURIComponent(detailUrl);
    
    // Format attendu: /provider/type/id ou provider/type/id
    const match = decoded.match(/^\/?([^\/]+)\/([^\/]+)\/(.+)$/);
    if (match) {
      return {
        provider: match[1],
        type: match[2],
        id: match[3]
      };
    }
    
    // Format alternatif: /provider/id (type implicite = product)
    const simpleMatch = decoded.match(/^\/?([^\/]+)\/(.+)$/);
    if (simpleMatch) {
      return {
        provider: simpleMatch[1],
        type: 'product',
        id: simpleMatch[2]
      };
    }
  } catch (e) {
    // Erreur de décodage, retourner null
  }
  
  return null;
}

// ============================================================================
// FORMAT DE RÉPONSE STANDARDISÉ
// ============================================================================

/**
 * Formate une réponse de recherche de manière standardisée
 * @param {Object} options
 * @param {Array} options.items - Résultats de recherche
 * @param {string} options.provider - Nom du provider
 * @param {string} options.query - Terme recherché
 * @param {Object} [options.pagination] - Info de pagination
 * @param {Object} [options.meta] - Métadonnées supplémentaires
 * @returns {Object}
 */
export function formatSearchResponse({ items, provider, query, pagination = {}, meta = {} }) {
  return {
    success: true,
    provider,
    query,
    count: items.length,
    items,
    pagination: {
      page: pagination.page || 1,
      pageSize: pagination.pageSize || items.length,
      totalResults: pagination.totalResults || items.length,
      totalPages: pagination.totalPages || 1,
      hasMore: pagination.hasMore || false
    },
    meta: {
      fetchedAt: new Date().toISOString(),
      lang: meta.lang || 'fr',
      ...meta
    }
  };
}

/**
 * Formate une réponse de détails de manière standardisée
 * @param {Object} options
 * @param {Object} options.data - Données du produit
 * @param {string} options.provider - Nom du provider
 * @param {string} options.id - ID du produit
 * @param {Object} [options.meta] - Métadonnées supplémentaires
 * @returns {Object}
 */
export function formatDetailResponse({ data, provider, id, meta = {} }) {
  return {
    success: true,
    provider,
    id,
    data,
    meta: {
      fetchedAt: new Date().toISOString(),
      lang: meta.lang || 'fr',
      ...meta
    }
  };
}

/**
 * Formate une réponse d'erreur de manière standardisée
 * @param {Object} options
 * @param {string} options.error - Message d'erreur
 * @param {number} [options.code] - Code HTTP
 * @param {string} [options.provider] - Provider concerné
 * @param {Object} [options.details] - Détails supplémentaires
 * @returns {Object}
 */
export function formatErrorResponse({ error, code = 500, provider = null, details = {} }) {
  return {
    success: false,
    error,
    code,
    provider,
    ...details,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// MIDDLEWARE DE VALIDATION POUR ROUTES NORMALISÉES
// ============================================================================

/**
 * Middleware qui valide les paramètres pour /search
 * Requiert: q (terme de recherche)
 */
export function validateSearchParams(req, res, next) {
  const params = extractStandardParams(req);
  
  if (!params.q) {
    return res.status(400).json(formatErrorResponse({
      error: "Paramètre 'q' (terme de recherche) requis",
      code: 400,
      details: {
        hint: "Utilisez ?q=votre+recherche",
        params: ['q (requis)', 'lang', 'max', 'autoTrad', 'page']
      }
    }));
  }
  
  // Attacher les params normalisés à la requête
  req.standardParams = params;
  next();
}

/**
 * Middleware qui valide les paramètres pour /details
 * Requiert: detailUrl (URL fournie par search)
 */
export function validateDetailsParams(req, res, next) {
  const params = extractStandardParams(req);
  
  if (!params.detailUrl) {
    return res.status(400).json(formatErrorResponse({
      error: "Paramètre 'detailUrl' requis",
      code: 400,
      details: {
        hint: "Utilisez l'URL fournie par /search dans le champ detailUrl de chaque résultat",
        params: ['detailUrl (requis)', 'lang', 'autoTrad']
      }
    }));
  }
  
  // Parser l'URL de détails
  const parsed = parseDetailUrl(params.detailUrl);
  if (!parsed) {
    return res.status(400).json(formatErrorResponse({
      error: "Format de detailUrl invalide",
      code: 400,
      details: {
        received: params.detailUrl,
        expectedFormat: "/provider/type/id"
      }
    }));
  }
  
  req.standardParams = params;
  req.parsedDetailUrl = parsed;
  next();
}

/**
 * Middleware qui valide les paramètres pour /code
 * Requiert: code (EAN/UPC/ISBN)
 */
export function validateCodeParams(req, res, next) {
  const params = extractStandardParams(req);
  
  // Code peut être dans query ou params
  const code = params.code || req.params.code;
  
  if (!code) {
    return res.status(400).json(formatErrorResponse({
      error: "Paramètre 'code' (code-barres) requis",
      code: 400,
      details: {
        hint: "Utilisez ?code=XXXXXXXXXXXXX ou /code/XXXXXXXXXXXXX",
        supported: ['EAN-13', 'UPC-A', 'ISBN-10', 'ISBN-13']
      }
    }));
  }
  
  // Valider le format du code
  const cleanCode = code.replace(/[-\s]/g, '');
  if (!/^\d{8,14}$/.test(cleanCode)) {
    return res.status(400).json(formatErrorResponse({
      error: "Format de code-barres invalide",
      code: 400,
      details: {
        received: code,
        hint: "Le code doit contenir entre 8 et 14 chiffres"
      }
    }));
  }
  
  params.code = cleanCode;
  req.standardParams = params;
  next();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Constantes
  DEFAULT_MAX_RESULTS,
  MAX_RESULTS_LIMIT,
  STANDARD_PARAMS,
  
  // Extraction
  extractStandardParams,
  normalizeLanguage,
  normalizeLocale,
  parseBoolean,
  
  // URLs
  generateDetailUrl,
  parseDetailUrl,
  
  // Formatage réponses
  formatSearchResponse,
  formatDetailResponse,
  formatErrorResponse,
  
  // Middlewares
  validateSearchParams,
  validateDetailsParams,
  validateCodeParams
};
