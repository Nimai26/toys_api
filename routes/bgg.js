/**
 * routes/bgg.js - Routes BoardGameGeek (API XML officielle)
 * 
 * Endpoints pour les jeux de société via BGG XML API
 * Nécessite un token Bearer BGG (https://boardgamegeek.com/applications)
 * 
 * NOTE: Pour les routes sans token, voir /bgg_scrape/* (routes/bgg_scrape.js)
 * 
 * @module routes/bgg
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { isAutoTradEnabled } from '../lib/utils/translator.js';
import { extractApiKey, requireApiKey } from '../lib/utils/index.js';
import {
  searchBGGGames,
  getBGGGameDetails,
  getBGGGameFiles,
  getBGGManual,
  BGG_DEFAULT_MAX
} from '../lib/providers/bgg.js';

const router = Router();
const log = createLogger('BGG-Routes');

// Middleware d'authentification BGG
const bggAuth = requireApiKey('BoardGameGeek', 'https://boardgamegeek.com/applications');

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /bgg/search
 * Recherche de jeux de société
 * 
 * @header {string} X-Encrypted-Key - Token BGG Bearer (crypté)
 * @query {string} q - Terme de recherche (requis)
 * @query {number} max - Nombre max de résultats (défaut: 20)
 * @query {string} lang - Langue (défaut: fr)
 */
router.get('/search', bggAuth, async (req, res) => {
  try {
    const { q, query, max, lang = 'fr' } = req.query;
    const searchQuery = q || query;
    
    if (!searchQuery) {
      return res.status(400).json({
        error: 'Paramètre de recherche manquant',
        hint: 'Utilisez ?q=nom_du_jeu'
      });
    }
    
    const maxResults = Math.min(parseInt(max) || BGG_DEFAULT_MAX, 100);
    
    // req.apiKey contient le token déchiffré par le middleware
    const result = await searchBGGGames(searchQuery, req.apiKey, {
      max: maxResults,
      lang
    });
    
    res.json(result);
    
  } catch (error) {
    log.error(`Erreur recherche: ${error.message}`);
    res.status(500).json({
      error: 'Erreur lors de la recherche',
      message: error.message
    });
  }
});

/**
 * GET /bgg/details/:id
 * Détails d'un jeu de société
 * 
 * @header {string} X-Encrypted-Key - Token BGG Bearer (crypté)
 * @param {string} id - ID BGG du jeu
 * @query {string} lang - Langue pour la traduction (défaut: fr)
 * @query {string} autoTrad - Active la traduction auto (1 pour activer)
 */
router.get('/details/:id', bggAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { lang = 'fr' } = req.query;
    const autoTrad = isAutoTradEnabled(req.query);
    
    if (!id) {
      return res.status(400).json({
        error: 'ID BGG manquant'
      });
    }
    
    // req.apiKey contient le token déchiffré
    const result = await getBGGGameDetails(id, req.apiKey, {
      lang,
      autoTrad
    });
    
    if (!result) {
      return res.status(404).json({
        error: 'Jeu non trouvé',
        bggId: id
      });
    }
    
    res.json(result);
    
  } catch (error) {
    log.error(`Erreur détails: ${error.message}`);
    res.status(500).json({
      error: 'Erreur lors de la récupération des détails',
      message: error.message
    });
  }
});

/**
 * GET /bgg/files/:id
 * Liste tous les fichiers disponibles pour un jeu
 * (via scraping, ne nécessite pas de token BGG)
 * 
 * @param {string} id - ID BGG du jeu
 */
router.get('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        error: 'ID BGG manquant'
      });
    }
    
    const result = await getBGGGameFiles(id);
    
    res.json(result);
    
  } catch (error) {
    log.error(`Erreur fichiers: ${error.message}`);
    res.status(500).json({
      error: 'Erreur lors de la récupération des fichiers',
      message: error.message
    });
  }
});

/**
 * GET /bgg/manual/:id
 * Récupère le meilleur manuel disponible pour un jeu
 * Préférence: langue demandée > anglais > premier fichier
 * 
 * @param {string} id - ID BGG du jeu
 * @query {string} lang - Langue préférée (défaut: fr)
 */
router.get('/manual/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lang = 'fr' } = req.query;
    
    if (!id) {
      return res.status(400).json({
        error: 'ID BGG manquant'
      });
    }
    
    const result = await getBGGManual(id, lang);
    
    if (!result) {
      return res.status(404).json({
        error: 'Aucun manuel trouvé pour ce jeu',
        bggId: id,
        hint: 'Ce jeu n\'a peut-être pas de fichiers de règles sur BGG'
      });
    }
    
    res.json(result);
    
  } catch (error) {
    log.error(`Erreur manuel: ${error.message}`);
    res.status(500).json({
      error: 'Erreur lors de la récupération du manuel',
      message: error.message
    });
  }
});

/**
 * GET /bgg/
 * Info sur l'API BGG (API XML officielle)
 */
router.get('/', (req, res) => {
  res.json({
    provider: 'BoardGameGeek (API XML)',
    description: 'API pour les jeux de société via BGG XML API - Nécessite token Bearer',
    note: 'Pour les routes sans token, voir /bgg_scrape/*',
    endpoints: {
      search: {
        method: 'GET',
        path: '/bgg/search?q={query}',
        requiresAuth: true,
        description: 'Recherche via API XML BGG',
        params: {
          q: 'Terme de recherche (requis)',
          max: 'Nombre max de résultats (défaut: 20)',
          lang: 'Langue (défaut: fr)'
        }
      },
      details: {
        method: 'GET',
        path: '/bgg/details/{id}',
        requiresAuth: true,
        description: 'Détails via API XML BGG',
        params: {
          lang: 'Langue pour traduction (défaut: fr)',
          autoTrad: 'Active la traduction auto (1 pour activer)'
        }
      },
      files: {
        method: 'GET',
        path: '/bgg/files/{id}',
        requiresAuth: false,
        description: 'Liste tous les fichiers (scraping)'
      },
      manual: {
        method: 'GET',
        path: '/bgg/manual/{id}',
        requiresAuth: false,
        description: 'Meilleur manuel/règles (scraping)',
        params: {
          lang: 'Langue préférée (défaut: fr)'
        }
      }
    },
    authentication: {
      required: true,
      type: 'Bearer Token',
      header: 'X-Encrypted-Key (token crypté)',
      registration: 'https://boardgamegeek.com/applications',
      note: 'Token BGG obligatoire depuis juillet 2025'
    },
    alternatives: {
      scraping: {
        description: 'Routes sans token via scraping web',
        baseUrl: '/bgg_scrape',
        endpoints: ['/bgg_scrape/search', '/bgg_scrape/details/{id}', '/bgg_scrape/manuals/{id}'],
        info: 'GET /bgg_scrape/ pour plus de détails'
      }
    },
    examples: {
      search: '/bgg/search?q=catan (nécessite token)',
      details: '/bgg/details/13?lang=fr&autoTrad=1 (nécessite token)',
      files: '/bgg/files/13',
      manual: '/bgg/manual/13?lang=fr'
    }
  });
});

export default router;
