/**
 * lib/utils/asyncHandler.js - Wrapper pour les routes async
 * toys_api v1.27.0
 * 
 * Élimine le besoin de try/catch répétitifs dans les routes Express
 * 
 * Usage:
 *   import { asyncHandler } from '../lib/utils/asyncHandler.js';
 *   router.get("/search", asyncHandler(async (req, res) => {
 *     // Code async sans try/catch
 *     const result = await searchSomething(req.query.q);
 *     res.json(result);
 *   }));
 * 
 * @module utils/asyncHandler
 */

import { createLogger } from './logger.js';

const log = createLogger('AsyncHandler');

/**
 * Wrapper qui capture les erreurs async et les passe à next()
 * @param {Function} fn - Fonction async du handler
 * @returns {Function} - Handler Express wrappé
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Middleware de gestion d'erreur globale (à placer après les routes)
 * Capture les erreurs passées à next() et retourne une réponse JSON appropriée
 */
export function errorHandler(err, req, res, next) {
  log.error(`Erreur non gérée: ${err.message}`);
  
  // Déterminer le code HTTP approprié selon le message d'erreur
  let statusCode = err.status || 500;
  if (!err.status) {
    if (err.message?.includes('manquant') || err.message?.includes('invalide') || err.message?.includes('Format')) {
      statusCode = 400;
    } else if (err.message?.includes('non trouvé') || err.message?.includes('not found')) {
      statusCode = 404;
    } else if (err.message?.includes('clé API') || err.message?.includes('unauthorized') || err.message?.includes('401') || err.message?.includes('403')) {
      statusCode = 401;
    } else if (err.message?.includes('rate limit') || err.message?.includes('trop de requêtes') || err.message?.includes('429')) {
      statusCode = 429;
    }
  }
  
  res.status(statusCode).json({
    error: err.message || 'Erreur interne du serveur',
    timestamp: new Date().toISOString()
  });
}
