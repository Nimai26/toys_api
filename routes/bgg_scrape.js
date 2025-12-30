/**
 * routes/bgg_scrape.js - Routes BGG par scraping web
 * 
 * Alternative aux routes BGG API officielles qui nécessitent un token Bearer.
 * Utilise FlareSolverr via VPN (gluetun) pour scraper les pages web BGG.
 * 
 * ENDPOINTS:
 * - GET /bgg_scrape/search    - Recherche de jeux avec attente JS
 * - GET /bgg_scrape/details/:id - Détails complets d'un jeu (inclut manuels)
 * - GET /bgg_scrape/manuals/:id - Liste des manuels/règles
 * - GET /bgg_scrape/proxy     - Proxy images/fichiers (contourne anti-hotlinking)
 * 
 * AVANTAGES:
 * - Pas besoin de token API BGG
 * - Toutes les données publiques accessibles
 * - Support traduction automatique (autoTrad)
 * 
 * @module routes/bgg_scrape
 */

import express from 'express';
import { createLogger } from '../lib/utils/logger.js';
import {
  scrapeBGGSearch,
  scrapeBGGDetails,
  scrapeBGGManuals
} from '../lib/providers/bgg-scraper.js';
import { normalizeBGGDetail, normalizeBGGSearchItem } from '../lib/normalizers/boardgame.js';

const router = express.Router();
const log = createLogger('BGG-Scrape-Routes');

// Constantes
const SCRAPER_DEFAULT_MAX = 20;

// Whitelist des domaines autorisés pour le proxy
const PROXY_ALLOWED_DOMAINS = [
  'cf.geekdo-images.com',
  'boardgamegeek.com',
  'www.boardgamegeek.com'
];

log.info(`🔒 Proxy BGG activé`);

// Headers pour simuler un navigateur venant de BGG
const PROXY_HEADERS = {
  'Referer': 'https://boardgamegeek.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'image',
  'sec-fetch-mode': 'no-cors',
  'sec-fetch-site': 'cross-site'
};

/**
 * Helper pour vérifier si autoTrad est activé
 */
function isAutoTradEnabled(query) {
  return query.autoTrad === '1' || query.autoTrad === 'true';
}

/**
 * Vérifie si une URL est dans la whitelist
 * @param {string} url - URL à vérifier
 * @returns {boolean}
 */
function isUrlAllowed(url) {
  try {
    const parsedUrl = new URL(url);
    return PROXY_ALLOWED_DOMAINS.some(domain => 
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /bgg_scrape/search
 * Recherche de jeux de société par scraping web
 * Retourne un format normalisé compatible avec les autres providers
 * 
 * @query {string} q - Terme de recherche (requis)
 * @query {number} max - Nombre max de résultats (défaut: 20)
 * @query {string} lang - Langue cible pour les traductions (défaut: fr)
 * @query {string} autoTrad - Active la traduction auto du nom et description (1 pour activer)
 * @query {string} refresh - Force le rechargement sans cache (true pour activer)
 */
router.get('/search', async (req, res) => {
  try {
    const { q, query, max, lang, autoTrad, refresh } = req.query;
    const searchQuery = q || query;
    
    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Paramètre de recherche manquant',
        hint: 'Utilisez ?q=nom_du_jeu'
      });
    }
    
    const maxResults = Math.min(parseInt(max) || SCRAPER_DEFAULT_MAX, 50);
    const targetLang = lang || 'fr';
    const enableAutoTrad = autoTrad === '1' || autoTrad === 'true';
    const forceRefresh = refresh === '1' || refresh === 'true';
    
    const rawResult = await scrapeBGGSearch(searchQuery, { 
      max: maxResults,
      lang: targetLang,
      autoTrad: enableAutoTrad,
      refresh: forceRefresh
    });
    
    // Normaliser chaque résultat
    const normalizedResults = (rawResult.results || []).map(item => 
      normalizeBGGSearchItem(item, { lang: targetLang, autoTrad: enableAutoTrad })
    );
    
    // Retourner au format standardisé
    res.json({
      success: true,
      provider: 'bgg_scrape',
      query: searchQuery,
      total: normalizedResults.length,
      results: normalizedResults,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang: targetLang,
        autoTrad: enableAutoTrad,
        method: rawResult.method || 'web-scraping'
      }
    });
    
  } catch (error) {
    log.error(`Erreur search: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recherche par scraping',
      message: error.message,
      hint: 'Vérifiez que FlareSolverr est accessible via le VPN'
    });
  }
});

/**
 * GET /bgg_scrape/details/:id
 * Détails d'un jeu par scraping web
 * Inclut automatiquement les manuels disponibles
 * Retourne un format normalisé compatible avec les autres providers
 * 
 * @param {string} id - ID BGG du jeu
 * @query {string} lang - Langue pour la traduction et les manuels (défaut: fr)
 * @query {string} autoTrad - Active la traduction auto (1 pour activer)
 * @query {string} includeManuals - Inclure les manuels (1 par défaut, 0 pour désactiver)
 * @query {string} refresh - Force le rechargement sans cache (true pour activer)
 */
router.get('/details/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lang = 'fr', includeManuals = '1', refresh } = req.query;
    const autoTrad = isAutoTradEnabled(req.query);
    const forceRefresh = refresh === '1' || refresh === 'true';
    
    if (!id) {
      return res.status(400).json({
        error: 'ID BGG manquant'
      });
    }
    
    const rawResult = await scrapeBGGDetails(id, {
      lang,
      autoTrad,
      includeManuals: includeManuals !== '0',
      refresh: forceRefresh
    });
    
    if (!rawResult || !rawResult.name) {
      return res.status(404).json({
        error: 'Jeu non trouvé',
        bggId: id
      });
    }
    
    // Normaliser les données au format standardisé
    const normalizedData = normalizeBGGDetail(rawResult, { lang, autoTrad });
    
    // Retourner au format standardisé comme les autres providers
    res.json({
      success: true,
      provider: 'bgg_scrape',
      id: id,
      data: normalizedData,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang,
        autoTrad,
        method: rawResult.method || 'web-scraping'
      }
    });
    
  } catch (error) {
    log.error(`Erreur details: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des détails par scraping',
      message: error.message,
      hint: 'Vérifiez que FlareSolverr est accessible via le VPN'
    });
  }
});

/**
 * GET /bgg_scrape/manuals/:id
 * Récupère tous les manuels/règles d'un jeu par scraping
 * 
 * @param {string} id - ID BGG du jeu
 * @query {string} lang - Langue préférée (défaut: fr)
 * @query {string} refresh - Force le rechargement sans cache (true pour activer)
 */
router.get('/manuals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lang = 'fr', refresh } = req.query;
    const forceRefresh = refresh === '1' || refresh === 'true';
    
    if (!id) {
      return res.status(400).json({
        error: 'ID BGG manquant'
      });
    }
    
    const result = await scrapeBGGManuals(id, lang, { refresh: forceRefresh });
    
    res.json(result);
    
  } catch (error) {
    log.error(`Erreur manuals: ${error.message}`);
    res.status(500).json({
      error: 'Erreur lors de la récupération des manuels par scraping',
      message: error.message,
      hint: 'Vérifiez que FlareSolverr est accessible via le VPN'
    });
  }
});

// ============================================================================
// PROXY POUR IMAGES/FICHIERS BGG
// Contourne la protection anti-hotlinking de BGG
// ============================================================================

/**
 * GET /bgg_scrape/proxy
 * Proxy pour les images et fichiers BGG (contourne l'anti-hotlinking)
 * 
 * @query {string} url - URL complète du fichier BGG à récupérer (requis)
 * 
 * Domaines autorisés:
 * - cf.geekdo-images.com (images/thumbnails)
 * - boardgamegeek.com (fichiers PDF, manuels)
 */
router.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        error: 'Paramètre url manquant',
        hint: 'Utilisez ?url=https://cf.geekdo-images.com/...'
      });
    }
    
    // Vérifier que l'URL est dans la whitelist
    if (!isUrlAllowed(url)) {
      return res.status(403).json({
        error: 'Domaine non autorisé',
        hint: 'Seuls les domaines BGG sont autorisés (cf.geekdo-images.com, boardgamegeek.com)',
        allowedDomains: PROXY_ALLOWED_DOMAINS
      });
    }
    
    log.debug(`🔄 Proxy: ${url}`);
    
    // Faire la requête vers BGG avec les bons headers
    const response = await fetch(url, {
      method: 'GET',
      headers: PROXY_HEADERS,
      signal: AbortSignal.timeout(30000)
    });
    
    if (!response.ok) {
      log.warn(`Proxy: BGG a retourné ${response.status} pour ${url}`);
      return res.status(response.status).json({
        error: `Erreur BGG: ${response.status} ${response.statusText}`,
        url,
        hint: 'L\'URL peut être expirée ou malformée. Récupérez une URL fraîche depuis /bgg_scrape/search ou /bgg_scrape/details'
      });
    }
    
    // Copier les headers de réponse pertinents
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const cacheControl = response.headers.get('cache-control');
    const lastModified = response.headers.get('last-modified');
    const etag = response.headers.get('etag');
    
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    } else {
      // Cache par défaut pour les images (1 jour)
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    if (lastModified) res.setHeader('Last-Modified', lastModified);
    if (etag) res.setHeader('ETag', etag);
    
    // CORS pour permettre l'accès depuis n'importe où
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Stream le body vers le client
    const reader = response.body.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (streamError) {
      log.error(`Proxy: Erreur streaming: ${streamError.message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erreur lors du streaming' });
      } else {
        res.end();
      }
    }
    
  } catch (error) {
    log.error(`Proxy: ${error.message}`);
    
    if (error.message === 'Timeout' || error.message.includes('timeout')) {
      return res.status(504).json({
        error: 'Timeout lors de la récupération du fichier',
        message: 'BGG n\'a pas répondu dans les 30 secondes'
      });
    }
    
    res.status(500).json({
      error: 'Erreur lors de la récupération du fichier',
      message: error.message
    });
  }
});

/**
 * GET /bgg_scrape/
 * Info sur l'API BGG Scrape
 */
router.get('/', (req, res) => {
  res.json({
    provider: 'BoardGameGeek (Scraping)',
    description: 'API pour les jeux de société via scraping BGG - Sans token requis',
    method: 'Scraping web via FlareSolverr + VPN',
    endpoints: {
      search: {
        method: 'GET',
        path: '/bgg_scrape/search?q={query}',
        description: 'Recherche par scraping avec attente JS',
        params: {
          q: 'Terme de recherche (requis)',
          max: 'Nombre max de résultats (défaut: 20, max: 50)',
          lang: 'Langue cible pour les traductions (défaut: fr)',
          autoTrad: 'Active la traduction auto du nom et description (1 pour activer)'
        }
      },
      details: {
        method: 'GET',
        path: '/bgg_scrape/details/{id}',
        description: 'Détails par scraping web (inclut manuels)',
        params: {
          lang: 'Langue pour traduction et manuels (défaut: fr)',
          autoTrad: 'Active la traduction auto (1 pour activer)',
          includeManuals: 'Inclure les manuels (1 par défaut)'
        }
      },
      manuals: {
        method: 'GET',
        path: '/bgg_scrape/manuals/{id}',
        description: 'Liste des manuels/règles',
        params: {
          lang: 'Langue préférée (défaut: fr)'
        }
      },
      proxy: {
        method: 'GET',
        path: '/bgg_scrape/proxy?url={url}',
        description: 'Proxy pour images/fichiers BGG (contourne anti-hotlinking)',
        params: {
          url: 'URL complète du fichier BGG (requis)'
        },
        allowedDomains: ['cf.geekdo-images.com', 'boardgamegeek.com']
      }
    },
    examples: {
      search: '/bgg_scrape/search?q=catan&lang=fr&autoTrad=1',
      details: '/bgg_scrape/details/13?lang=fr&autoTrad=1',
      manuals: '/bgg_scrape/manuals/13?lang=fr',
      proxy: '/bgg_scrape/proxy?url=https://cf.geekdo-images.com/xxx/pic123.jpg'
    },
    notes: {
      rateLimit: '2 secondes minimum entre requêtes',
      jsWait: 'La recherche attend 10s pour le chargement JavaScript React',
      translation: 'autoTrad utilise le service auto_trad pour traduire nom et description',
      languages: 'La détection de langue des manuels supporte: fr, en, de, es, it, pt, nl, pl, ru, ja, zh, ko, fi',
      proxy: 'Le proxy stream les fichiers sans buffering, avec cache 24h par défaut'
    }
  });
});

export default router;
