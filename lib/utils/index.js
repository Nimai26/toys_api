/**
 * lib/utils/index.js - Point d'entrée pour les utilitaires
 * toys_api v2.0.0
 * 
 * Regroupe tous les modules utilitaires :
 * - logger.js : Système de logging coloré
 * - state.js : État global (cache, métriques, sessions)
 * - helpers.js : Fonctions utilitaires (crypto, décodage HTML)
 * - flaresolverr.js : Gestion des sessions FlareSolverr
 * - asyncHandler.js : Wrapper pour routes async
 * - middleware.js : Middlewares Express réutilisables
 * - translator.js : Traduction automatique via auto_trad
 */

// Logger
export * from './logger.js';

// État global (cache, métriques, sessions FSR)
export * from './state.js';

// Helpers (crypto, décodage HTML, etc.)
export * from './helpers.js';

// FlareSolverr (bypass Cloudflare)
export * from './flaresolverr.js';

// Async handlers pour routes Express
export * from './asyncHandler.js';

// Middlewares Express
export * from './middleware.js';

// Traduction automatique
export * from './translator.js';
