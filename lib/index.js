/**
 * lib/index.js - Point d'entrée principal de toys_api
 * toys_api v1.27.0
 * 
 * Structure modulaire :
 * - lib/config.js : Configuration globale
 * - lib/utils/ : Utilitaires (logger, state, helpers, flaresolverr)
 * - lib/providers/ : Tous les providers de données
 * 
 * @module lib
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
export * from './config.js';

// ============================================================================
// UTILITAIRES
// ============================================================================
// Logger, State (cache/métriques), Helpers (crypto, HTML), FlareSolverr
export * from './utils/index.js';

// ============================================================================
// PROVIDERS
// ============================================================================
// Tous les providers de données (collectibles, LEGO, videogames, anime, books, media, music, comics, barcode, amazon)
export * from './providers/index.js';
