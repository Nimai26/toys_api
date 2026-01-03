// routes/proxy.js
// Proxy pour les images TCG (contourne CORS et anti-hotlinking)

import express from 'express';
import { createLogger } from '../lib/utils/logger.js';

const router = express.Router();
const log = createLogger('Proxy');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Whitelist des domaines TCG autorisés
const ALLOWED_DOMAINS = [
  // One Piece
  'onepiece-cardgame.dev',
  
  // Lorcana
  'api.lorcana.ravensburger.com',
  'lorcanajson.org',
  
  // Yu-Gi-Oh
  'images.ygoprodeck.com',
  
  // Magic: The Gathering
  'cards.scryfall.io',
  
  // Pokemon
  'images.pokemontcg.io',
  
  // Digimon
  'digimoncard.io',
  'images.digimoncard.io'
];

// Headers à utiliser pour les requêtes (simule un navigateur)
const PROXY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'image',
  'sec-fetch-mode': 'no-cors',
  'sec-fetch-site': 'cross-site'
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Vérifie si une URL est autorisée dans la whitelist
 * @param {string} url - URL à vérifier
 * @returns {boolean}
 */
function isUrlAllowed(url) {
  try {
    const parsedUrl = new URL(url);
    return ALLOWED_DOMAINS.some(domain => 
      parsedUrl.hostname === domain || 
      parsedUrl.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /proxy/image
 * Proxy pour les images TCG (contourne CORS)
 * 
 * @query {string} url - URL de l'image à proxier (requis)
 * @query {number} maxAge - Cache-Control max-age en secondes (défaut: 86400 = 24h)
 * 
 * Exemples:
 * - /proxy/image?url=https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg
 * - /proxy/image?url=https://images.ygoprodeck.com/images/cards/46986414.jpg&maxAge=3600
 * 
 * Domaines autorisés:
 * - onepiece-cardgame.dev (One Piece)
 * - images.ygoprodeck.com (Yu-Gi-Oh)
 * - cards.scryfall.io (Magic)
 * - images.pokemontcg.io (Pokemon)
 * - api.lorcana.ravensburger.com (Lorcana)
 * - digimoncard.io (Digimon)
 */
router.get('/image', async (req, res) => {
  try {
    const { url, maxAge = 86400 } = req.query;
    
    // Validation de l'URL
    if (!url) {
      return res.status(400).json({
        error: 'URL parameter required',
        hint: 'Usage: /proxy/image?url=https://...',
        example: '/proxy/image?url=https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg'
      });
    }
    
    // Validation du domaine (whitelist)
    if (!isUrlAllowed(url)) {
      log.warn(`Blocked proxy request for non-whitelisted domain: ${url}`);
      return res.status(403).json({
        error: 'Domain not allowed',
        hint: 'Only TCG image domains are allowed',
        allowedDomains: ALLOWED_DOMAINS,
        requestedUrl: url
      });
    }
    
    log.debug(`📸 Proxying image: ${url.substring(0, 80)}...`);
    
    // Télécharger l'image avec headers appropriés
    const parsedUrl = new URL(url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...PROXY_HEADERS,
        'Referer': parsedUrl.origin + '/',
        'Origin': parsedUrl.origin
      },
      signal: AbortSignal.timeout(30000)
    });
    
    if (!response.ok) {
      log.warn(`Image server returned ${response.status} for ${url.substring(0, 80)}`);
      return res.status(response.status).json({
        error: `Image server error: ${response.status} ${response.statusText}`,
        hint: response.status === 404 
          ? 'Image not found on remote server' 
          : 'Remote server error',
        originalUrl: url
      });
    }
    
    // Copier headers pertinents de la réponse
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const lastModified = response.headers.get('last-modified');
    const etag = response.headers.get('etag');
    
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (lastModified) res.setHeader('Last-Modified', lastModified);
    if (etag) res.setHeader('ETag', etag);
    
    // Headers de cache et CORS
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Stream l'image vers le client (efficace en mémoire)
    const reader = response.body.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
      
      log.debug(`✅ Image proxied successfully (${contentLength || 'unknown size'} bytes)`);
      
    } catch (streamError) {
      log.error(`Stream error: ${streamError.message}`);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Stream error',
          message: streamError.message
        });
      }
    }
    
  } catch (error) {
    log.error(`❌ Proxy error: ${error.message}`);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Proxy error',
        message: error.message,
        hint: error.name === 'AbortError' 
          ? 'Request timeout (30s)' 
          : 'Internal server error'
      });
    }
  }
});

/**
 * OPTIONS /proxy/image
 * Support CORS preflight requests
 */
router.options('/image', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

/**
 * GET /proxy/health
 * Health check pour le service proxy
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Image Proxy',
    allowedDomains: ALLOWED_DOMAINS,
    maxTimeout: 30000,
    defaultCache: 86400
  });
});

export default router;
