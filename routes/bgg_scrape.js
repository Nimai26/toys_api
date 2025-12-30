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
  scrapeBGGManuals,
  fsrGet
} from '../lib/providers/bgg-scraper.js';
import { normalizeBGGDetail, normalizeBGGSearchItem } from '../lib/normalizers/boardgame.js';

const router = express.Router();
const log = createLogger('BGG-Scrape-Routes');

// Constantes
const SCRAPER_DEFAULT_MAX = 20;

// Whitelist des domaines autorisés pour le proxy
const PROXY_ALLOWED_DOMAINS = [
  'cf.geekdo-images.com',
  'cf.geekdo-files.com',      // Fichiers téléchargés (ancien)
  'geekdo-files.com',         // Fichiers S3
  's3.amazonaws.com',         // S3 AWS (fichiers BGG)
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
 * @query {string} name - Nom localisé optionnel (issu de la recherche, pour éviter le nom anglais)
 */
router.get('/details/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lang = 'fr', includeManuals = '1', refresh, name: localizedName } = req.query;
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
    
    // Si un nom localisé est fourni (depuis la recherche), l'utiliser
    if (localizedName && localizedName !== rawResult.name) {
      rawResult.nameOriginal = rawResult.name; // Garder le nom anglais
      rawResult.name = localizedName; // Utiliser le nom localisé
      rawResult.nameLocalized = true;
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
 * Vérifie si une URL BGG est une page de téléchargement (nécessite extraction)
 * @param {string} url - URL à vérifier
 * @returns {boolean}
 */
function isBGGDownloadPage(url) {
  // Les pages /filepage/ nécessitent un scraping pour extraire le lien download_redirect
  // Les pages /file/download/ sont l'ancien format (ne fonctionnent plus)
  return url.includes('/filepage/') || url.includes('/file/download/');
}

/**
 * Vérifie si la page BGG contient un bouton de login (fichier non accessible sans auth)
 * @param {string} html - Contenu HTML de la page
 * @returns {boolean}
 */
function requiresAuthentication(html) {
  // BGG affiche "ggloginbutton" avec href="javascript://" dans le contexte du téléchargement
  // Le pattern exact: <a ggloginbutton="" href="javascript://"> [nom du fichier]
  // Note: il y a un espace après "//"
  return html.includes('gg-downloadable-file') && 
         (html.includes('ggloginbutton') && html.includes('href="javascript://'));
}

/**
 * Extrait le lien download_redirect depuis une page filepage BGG
 * Note: Ce lien n'existe que pour les utilisateurs connectés à BGG
 * @param {string} url - URL de la page filepage
 * @returns {Promise<{redirectUrl: string, filename: string, requiresAuth: boolean} | null>}
 */
async function extractDownloadRedirectLink(url) {
  try {
    log.debug(`📥 Extraction lien download_redirect via FlareSolverr: ${url}`);
    
    // Scraper la page filepage avec FlareSolverr (besoin de JS pour le rendu Angular)
    const html = await fsrGet(url, 60000, { waitInSeconds: 8 });
    
    // Vérifier si la page demande une authentification
    if (requiresAuthentication(html)) {
      log.info(`🔒 Page BGG nécessite une authentification pour télécharger`);
      
      // Extraire le nom du fichier depuis la page quand même
      const titleMatch = html.match(/gg-downloadable-file[^>]*>[\s\S]*?<a[^>]*>([^<]+)/i);
      const filename = titleMatch ? titleMatch[1].trim() : null;
      
      return { redirectUrl: null, filename, requiresAuth: true };
    }
    
    // Pattern pour extraire le lien download_redirect
    // Format: href="/file/download_redirect/{token}/{filename}"
    const pattern = /href="(\/file\/download_redirect\/([^"\/]+)\/([^"]+))"/i;
    const match = html.match(pattern);
    
    if (match) {
      const redirectPath = match[1];
      const filename = decodeURIComponent(match[3].replace(/\+/g, ' '));
      const redirectUrl = `https://boardgamegeek.com${redirectPath}`;
      
      log.debug(`✅ Lien download_redirect trouvé: ${redirectUrl}`);
      return { redirectUrl, filename, requiresAuth: false };
    }
    
    // Fallback: chercher d'autres patterns possibles
    const altPattern = /download_redirect\/([^"\/\s]+)\/([^">\s]+)/i;
    const altMatch = html.match(altPattern);
    
    if (altMatch) {
      const token = altMatch[1];
      const filename = decodeURIComponent(altMatch[2].replace(/\+/g, ' '));
      const redirectUrl = `https://boardgamegeek.com/file/download_redirect/${token}/${encodeURIComponent(filename)}`;
      
      log.debug(`✅ Lien download_redirect (alt) trouvé: ${redirectUrl}`);
      return { redirectUrl, filename, requiresAuth: false };
    }
    
    log.warn(`⚠️ Aucun lien download_redirect trouvé dans la page`);
    return null;
    
  } catch (error) {
    log.error(`Erreur extraction download_redirect: ${error.message}`);
    return null;
  }
}

/**
 * Suit la redirection download_redirect pour obtenir l'URL S3 finale
 * @param {string} redirectUrl - URL download_redirect
 * @returns {Promise<string | null>} - URL S3 signée
 */
async function followDownloadRedirect(redirectUrl) {
  try {
    log.debug(`🔄 Suivi redirection: ${redirectUrl}`);
    
    // Faire une requête HEAD pour obtenir l'URL de redirection sans télécharger
    const response = await fetch(redirectUrl, {
      method: 'HEAD',
      headers: PROXY_HEADERS,
      redirect: 'manual', // Ne pas suivre automatiquement
      signal: AbortSignal.timeout(15000)
    });
    
    // BGG redirige vers S3 avec un 302
    if (response.status === 302 || response.status === 301) {
      const s3Url = response.headers.get('location');
      if (s3Url) {
        log.debug(`✅ URL S3 obtenue: ${s3Url.substring(0, 100)}...`);
        return s3Url;
      }
    }
    
    // Si pas de redirection, essayer GET et suivre manuellement
    const getResponse = await fetch(redirectUrl, {
      method: 'GET',
      headers: PROXY_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    });
    
    // L'URL finale après redirection
    if (getResponse.url && getResponse.url.includes('s3.amazonaws.com')) {
      log.debug(`✅ URL S3 (via GET): ${getResponse.url.substring(0, 100)}...`);
      return getResponse.url;
    }
    
    log.warn(`⚠️ Pas de redirection S3 trouvée (status: ${response.status})`);
    return null;
    
  } catch (error) {
    log.error(`Erreur suivi redirection: ${error.message}`);
    return null;
  }
}

/**
 * GET /bgg_scrape/proxy
 * Proxy pour les images et fichiers BGG (contourne l'anti-hotlinking)
 * 
 * @query {string} url - URL complète du fichier BGG à récupérer (requis)
 * 
 * Domaines autorisés:
 * - cf.geekdo-images.com (images/thumbnails)
 * - boardgamegeek.com (pages filepage → extraction lien S3)
 * - s3.amazonaws.com (fichiers téléchargés)
 * - geekdo-files.com (fichiers S3)
 * 
 * Note: Les URLs /filepage/ sont automatiquement traitées pour extraire
 * le lien de téléchargement S3 réel via FlareSolverr.
 */
router.get('/proxy', async (req, res) => {
  try {
    let { url } = req.query;
    
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
        hint: 'Seuls les domaines BGG sont autorisés',
        allowedDomains: PROXY_ALLOWED_DOMAINS
      });
    }
    
    log.debug(`🔄 Proxy: ${url}`);
    
    let filename = null;
    
    // Si c'est une page filepage, extraire le lien download_redirect puis l'URL S3
    if (isBGGDownloadPage(url)) {
      log.info(`📥 Page de téléchargement BGG détectée, extraction du lien...`);
      
      // Étape 1: Extraire le lien download_redirect depuis la page filepage
      const downloadInfo = await extractDownloadRedirectLink(url);
      
      if (!downloadInfo) {
        return res.status(502).json({
          error: 'Impossible d\'extraire le lien de téléchargement',
          hint: 'La page BGG ne contient pas de lien download_redirect valide',
          originalUrl: url,
          browserLink: url
        });
      }
      
      // Cas où BGG demande une authentification
      if (downloadInfo.requiresAuth) {
        log.info(`🔒 Téléchargement BGG nécessite une connexion utilisateur`);
        return res.status(401).json({
          error: 'Authentification BGG requise',
          message: 'BoardGameGeek nécessite une connexion pour télécharger ce fichier.',
          hint: 'Ouvrez le lien ci-dessous dans votre navigateur (connecté à BGG) pour télécharger manuellement.',
          filename: downloadInfo.filename,
          browserLink: url,
          requiresAuth: true
        });
      }
      
      filename = downloadInfo.filename;
      
      // Étape 2: Suivre la redirection pour obtenir l'URL S3 signée
      const s3Url = await followDownloadRedirect(downloadInfo.redirectUrl);
      
      if (!s3Url) {
        return res.status(502).json({
          error: 'Impossible d\'obtenir l\'URL de téléchargement S3',
          hint: 'La redirection BGG n\'a pas retourné d\'URL S3',
          redirectUrl: downloadInfo.redirectUrl,
          browserLink: url
        });
      }
      
      url = s3Url;
      log.info(`✅ URL S3 obtenue: ${url.substring(0, 80)}...`);
    }
    
    // Télécharger le fichier depuis l'URL (S3 ou image directe)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...PROXY_HEADERS,
        // S3 n'aime pas certains headers
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate'
      },
      signal: AbortSignal.timeout(60000),
      redirect: 'follow'
    });
    
    if (!response.ok) {
      log.warn(`Proxy: Serveur a retourné ${response.status} pour ${url.substring(0, 80)}`);
      return res.status(response.status).json({
        error: `Erreur serveur: ${response.status} ${response.statusText}`,
        hint: 'L\'URL peut être expirée. Les URLs S3 BGG expirent après 2 minutes.'
      });
    }
    
    // Copier les headers de réponse pertinents
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const cacheControl = response.headers.get('cache-control');
    const lastModified = response.headers.get('last-modified');
    const etag = response.headers.get('etag');
    const contentDisposition = response.headers.get('content-disposition');
    
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    } else {
      // Cache court pour les fichiers (les URLs S3 expirent)
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
    if (lastModified) res.setHeader('Last-Modified', lastModified);
    if (etag) res.setHeader('ETag', etag);
    
    // Content-Disposition pour le téléchargement
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else if (filename) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    
    // CORS
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
        message: 'Le serveur n\'a pas répondu dans les 60 secondes'
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
