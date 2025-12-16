/**
 * lib/utils/middleware.js - Middlewares Express réutilisables
 * toys_api v2.0.0
 * 
 * Middlewares pour validation des paramètres et authentification API
 */

import { extractApiKey, API_ENCRYPTION_KEY } from './helpers.js';

/**
 * Middleware qui valide la présence d'un paramètre query requis
 * @param {string} param - Nom du paramètre (ex: 'q')
 * @param {string} [message] - Message d'erreur personnalisé
 * @returns {Function} Middleware Express
 * 
 * @example
 * router.get("/search", requireParam('q'), asyncHandler(async (req, res) => { ... }));
 */
export function requireParam(param, message = null) {
  return (req, res, next) => {
    const value = req.query[param] || req.params[param];
    if (!value) {
      return res.status(400).json({ 
        error: message || `paramètre '${param}' manquant` 
      });
    }
    next();
  };
}

/**
 * Middleware qui valide la présence d'une clé API
 * La clé extraite est attachée à req.apiKey
 * 
 * @param {string} source - Nom de la source API (pour le message d'erreur)
 * @param {string} [hint] - Hint pour obtenir une clé API
 * @returns {Function} Middleware Express
 * 
 * @example
 * router.get("/search", requireApiKey('RAWG', 'https://rawg.io/apidocs'), asyncHandler(...));
 */
export function requireApiKey(source, hint = null) {
  return (req, res, next) => {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      return res.status(401).json({ 
        error: `Clé API ${source} requise`,
        hint: API_ENCRYPTION_KEY 
          ? "Utilisez le header X-Encrypted-Key avec la clé chiffrée"
          : hint || "Utilisez le header X-Api-Key ou le paramètre api_key"
      });
    }
    // Attacher la clé à la requête pour usage dans le handler
    req.apiKey = apiKey;
    next();
  };
}

/**
 * Middleware combiné : valide paramètre + clé API
 * @param {string} param - Paramètre requis
 * @param {string} source - Source API
 * @param {string} [hint] - Hint pour la clé API
 * @returns {Function[]} Array de middlewares
 * 
 * @example
 * router.get("/search", ...requireParamAndKey('q', 'RAWG'), asyncHandler(...));
 */
export function requireParamAndKey(param, source, hint = null) {
  return [requireParam(param), requireApiKey(source, hint)];
}
