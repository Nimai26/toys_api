/**
 * Routes API - Carddass (animecollection.fr)
 * 
 * Endpoints pour rechercher des cartes Carddass vintage
 * Source: http://www.animecollection.fr/ (30,178 cartes)
 */

import express from 'express';
const router = express.Router();

import { asyncHandler } from '../lib/utils/index.js';
import carddass from '../lib/providers/tcg/carddass.js';
import { normalizeCarddassSearch, normalizeCarddassCard } from '../lib/normalizers/tcg.js';
import { metrics } from '../lib/utils/state.js';

// Middleware circuit breaker
router.use((req, res, next) => {
  if (!carddass.isAvailable()) {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'Carddass provider circuit breaker is open',
      retryAfter: 900 // 15 minutes
    });
  }
  next();
});

/**
 * GET /tcg_carddass/licenses
 * Liste toutes les licences Carddass disponibles
 * 
 * @query {string} q - Recherche par nom (optionnel)
 * 
 * @example
 * GET /tcg_carddass/licenses
 * GET /tcg_carddass/licenses?q=Dragon
 */
router.get('/licenses', asyncHandler(async (req, res) => {
  const { q } = req.query;
  const startTime = Date.now();
  
  if (!metrics.sources.carddass) {
    metrics.sources.carddass = { requests: 0, errors: 0, latency: 0 };
  }
  metrics.sources.carddass.requests++;

  try {
    let licenses;
    
    if (q) {
      licenses = await carddass.searchLicenses(q);
    } else {
      licenses = await carddass.getAllLicenses();
    }
    
    metrics.sources.carddass.latency = Date.now() - startTime;
    
    res.json({
      total: licenses.length,
      licenses: licenses.map(lic => ({
        id: lic.id,
        name: lic.name,
        url: `http://www.animecollection.fr/cartes.php?idl=${lic.id}`
      }))
    });
  } catch (error) {
    metrics.sources.carddass.errors++;
    throw error;
  }
}));

/**
 * GET /tcg_carddass/collections
 * Liste les collections d'une licence
 * 
 * @query {number} licenseId - ID de la licence (requis)
 * 
 * @example
 * GET /tcg_carddass/collections?licenseId=56
 */
router.get('/collections', asyncHandler(async (req, res) => {
  const { licenseId } = req.query;
  
  if (!licenseId) {
    return res.status(400).json({
      error: 'Missing required parameter',
      message: 'licenseId is required'
    });
  }

  const startTime = Date.now();
  if (!metrics.sources.carddass) {
    metrics.sources.carddass = { requests: 0, errors: 0, latency: 0 };
  }
  metrics.sources.carddass.requests++;

  try {
    const collections = await carddass.getCollectionsByLicense(licenseId);
    
    metrics.sources.carddass.latency = Date.now() - startTime;
    
    res.json({
      total: collections.length,
      licenseId: parseInt(licenseId),
      collections: collections.map(col => ({
        id: col.id,
        name: col.name,
        url: `http://www.animecollection.fr/cartes.php?idl=${licenseId}&idc=${col.id}`
      }))
    });
  } catch (error) {
    metrics.sources.carddass.errors++;
    throw error;
  }
}));

/**
 * GET /tcg_carddass/series
 * Liste les séries d'une collection
 * 
 * @query {number} licenseId - ID de la licence (requis)
 * @query {number} collectionId - ID de la collection (requis)
 * 
 * @example
 * GET /tcg_carddass/series?licenseId=56&collectionId=195
 */
router.get('/series', asyncHandler(async (req, res) => {
  const { licenseId, collectionId } = req.query;
  
  if (!licenseId || !collectionId) {
    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'licenseId and collectionId are required'
    });
  }

  const startTime = Date.now();
  if (!metrics.sources.carddass) {
    metrics.sources.carddass = { requests: 0, errors: 0, latency: 0 };
  }
  metrics.sources.carddass.requests++;

  try {
    const series = await carddass.getSeriesByCollection(licenseId, collectionId);
    
    metrics.sources.carddass.latency = Date.now() - startTime;
    
    res.json({
      total: series.length,
      licenseId: parseInt(licenseId),
      collectionId: parseInt(collectionId),
      series: series.map(ser => ({
        id: ser.id,
        name: ser.name,
        url: `http://www.animecollection.fr/cartes.php?idl=${licenseId}&idc=${collectionId}&ids=${ser.id}`
      }))
    });
  } catch (error) {
    metrics.sources.carddass.errors++;
    throw error;
  }
}));

/**
 * GET /tcg_carddass/search
 * Recherche de cartes par série
 * 
 * @query {number} licenseId - ID de la licence (requis)
 * @query {number} collectionId - ID de la collection (requis)
 * @query {number} serieId - ID de la série (requis)
 * @query {string} lang - Langue (optionnel, défaut: fr)
 * 
 * @example
 * GET /tcg_carddass/search?licenseId=56&collectionId=195&serieId=425
 * # Ranma ½ Carddass Part 1 (42 cartes)
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { licenseId, collectionId, serieId, lang = 'fr' } = req.query;
  
  if (!licenseId || !collectionId || !serieId) {
    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'licenseId, collectionId, and serieId are required',
      hint: 'Use /licenses, /collections, and /series endpoints to browse available data'
    });
  }

  const startTime = Date.now();
  if (!metrics.sources.carddass) {
    metrics.sources.carddass = { requests: 0, errors: 0, latency: 0 };
  }
  metrics.sources.carddass.requests++;

  try {
    const result = await carddass.getCardsBySerie(licenseId, collectionId, serieId);
    const normalized = normalizeCarddassSearch(result.cards, { lang });
    
    metrics.sources.carddass.latency = Date.now() - startTime;
    
    res.json({
      total: normalized.length,
      serie: {
        license: result.license,
        collection: result.collection,
        serie: result.serie,
        year: result.year,
        totalCards: result.totalCards,
        prismCards: result.prismCards,
        regularCards: result.regularCards,
        description: result.description
      },
      results: normalized
    });
  } catch (error) {
    metrics.sources.carddass.errors++;
    throw error;
  }
}));

/**
 * GET /tcg_carddass/card
 * Détails d'une carte par ID
 * 
 * @query {string} id - ID de la carte (requis)
 * @query {number} licenseId - ID de la licence (requis pour contexte)
 * @query {number} collectionId - ID de la collection (requis pour contexte)
 * @query {number} serieId - ID de la série (requis pour contexte)
 * @query {string} lang - Langue (optionnel, défaut: fr)
 * 
 * @example
 * GET /tcg_carddass/card?id=17673&licenseId=56&collectionId=195&serieId=425
 */
router.get('/card', asyncHandler(async (req, res) => {
  const { id, licenseId, collectionId, serieId, lang = 'fr' } = req.query;
  
  if (!id || !licenseId || !collectionId || !serieId) {
    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'id, licenseId, collectionId, and serieId are required'
    });
  }

  const startTime = Date.now();
  if (!metrics.sources.carddass) {
    metrics.sources.carddass = { requests: 0, errors: 0, latency: 0 };
  }
  metrics.sources.carddass.requests++;

  try {
    const result = await carddass.getCardsBySerie(licenseId, collectionId, serieId);
    const card = result.cards.find(c => c.id === id);
    
    if (!card) {
      return res.status(404).json({
        error: 'Card not found',
        message: `Card with id ${id} not found in this serie`
      });
    }
    
    const normalized = await normalizeCarddassCard(card, { lang });
    
    metrics.sources.carddass.latency = Date.now() - startTime;
    
    res.json(normalized);
  } catch (error) {
    metrics.sources.carddass.errors++;
    throw error;
  }
}));

/**
 * GET /tcg_carddass/health
 * Status du provider Carddass
 */
router.get('/health', (req, res) => {
  const stats = carddass.getStats();
  const isHealthy = stats.state === 'closed';
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    circuit_breaker: stats.state,
    failure_count: stats.failureCount,
    last_failure: stats.lastFailure,
    cache_size: stats.cacheSize,
    metrics: metrics.sources.carddass || { requests: 0, errors: 0, latency: 0 }
  });
});

export default router;
