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

const router = express.Router();
const log = createLogger('BGG-Scrape-Routes');

// Constantes
const SCRAPER_DEFAULT_MAX = 20;

/**
 * Helper pour vérifier si autoTrad est activé
 */
function isAutoTradEnabled(query) {
  return query.autoTrad === '1' || query.autoTrad === 'true';
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /bgg_scrape/search
 * Recherche de jeux de société par scraping web
 * 
 * @query {string} q - Terme de recherche (requis)
 * @query {number} max - Nombre max de résultats (défaut: 20)
 * @query {string} lang - Langue cible pour les traductions (défaut: fr)
 * @query {string} autoTrad - Active la traduction auto du nom et description (1 pour activer)
 */
router.get('/search', async (req, res) => {
  try {
    const { q, query, max, lang, autoTrad } = req.query;
    const searchQuery = q || query;
    
    if (!searchQuery) {
      return res.status(400).json({
        error: 'Paramètre de recherche manquant',
        hint: 'Utilisez ?q=nom_du_jeu'
      });
    }
    
    const maxResults = Math.min(parseInt(max) || SCRAPER_DEFAULT_MAX, 50);
    const targetLang = lang || 'fr';
    const enableAutoTrad = autoTrad === '1' || autoTrad === 'true';
    
    const result = await scrapeBGGSearch(searchQuery, { 
      max: maxResults,
      lang: targetLang,
      autoTrad: enableAutoTrad
    });
    
    res.json(result);
    
  } catch (error) {
    log.error(`Erreur search: ${error.message}`);
    res.status(500).json({
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
 * 
 * @param {string} id - ID BGG du jeu
 * @query {string} lang - Langue pour la traduction et les manuels (défaut: fr)
 * @query {string} autoTrad - Active la traduction auto (1 pour activer)
 * @query {string} includeManuals - Inclure les manuels (1 par défaut, 0 pour désactiver)
 */
router.get('/details/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lang = 'fr', includeManuals = '1' } = req.query;
    const autoTrad = isAutoTradEnabled(req.query);
    
    if (!id) {
      return res.status(400).json({
        error: 'ID BGG manquant'
      });
    }
    
    const result = await scrapeBGGDetails(id, {
      lang,
      autoTrad,
      includeManuals: includeManuals !== '0'
    });
    
    if (!result || !result.name) {
      return res.status(404).json({
        error: 'Jeu non trouvé',
        bggId: id
      });
    }
    
    res.json(result);
    
  } catch (error) {
    log.error(`Erreur details: ${error.message}`);
    res.status(500).json({
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
 */
router.get('/manuals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lang = 'fr' } = req.query;
    
    if (!id) {
      return res.status(400).json({
        error: 'ID BGG manquant'
      });
    }
    
    const result = await scrapeBGGManuals(id, lang);
    
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
      }
    },
    examples: {
      search: '/bgg_scrape/search?q=catan&lang=fr&autoTrad=1',
      details: '/bgg_scrape/details/13?lang=fr&autoTrad=1',
      manuals: '/bgg_scrape/manuals/13?lang=fr'
    },
    notes: {
      rateLimit: '2 secondes minimum entre requêtes',
      jsWait: 'La recherche attend 10s pour le chargement JavaScript React',
      translation: 'autoTrad utilise le service auto_trad pour traduire nom et description',
      languages: 'La détection de langue des manuels supporte: fr, en, de, es, it, pt, nl, pl, ru, ja, zh, ko, fi'
    }
  });
});

export default router;
