/**
 * routes/klickypedia.js - Routes Klickypedia
 * toys_api v3.0.0
 * 
 * Endpoints normalisés pour l'encyclopédie Playmobil Klickypedia
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { searchKlickypedia, getKlickypediaProductDetails } from '../lib/providers/klickypedia.js';
import { KLICKYPEDIA_DEFAULT_LANG, KLICKYPEDIA_DEFAULT_MAX } from '../lib/config.js';
import { 
  addCacheHeaders,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams,
  generateDetailUrl,
  formatSearchResponse,
  formatDetailResponse
} from '../lib/utils/index.js';

const router = Router();
const log = createLogger('Route:Klickypedia');

// ============================================================================
// ENDPOINTS NORMALISÉS v3.0.0
// ============================================================================

/**
 * GET /klickypedia/search
 * Recherche de sets Playmobil sur Klickypedia
 */
router.get('/search', validateSearchParams, async (req, res) => {
  try {
    const { q, lang, locale, max, autoTrad } = req.standardParams;
    
    log.info(`Recherche Klickypedia: "${q}" (lang=${locale}, max=${max})`);
    
    const rawResult = await searchKlickypedia(q, locale, 3, max);
    
    // Transformer au format normalisé
    const items = (rawResult.products || []).map(product => ({
      type: 'construct_toy',
      source: 'klickypedia',
      sourceId: product.productId || product.id,
      name: product.name,
      name_original: product.name,
      image: product.image || product.primaryImage,
      detailUrl: generateDetailUrl('klickypedia', product.productId || product.id, 'product')
    }));
    
    addCacheHeaders(res, 1800);
    res.json(formatSearchResponse({
      items,
      provider: 'klickypedia',
      query: q,
      pagination: {
        page: 1,
        pageSize: items.length,
        totalResults: rawResult.total || items.length,
        hasMore: (rawResult.total || 0) > items.length
      },
      meta: { lang, locale, autoTrad }
    }));
    
  } catch (error) {
    log.error(`Erreur recherche Klickypedia: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la recherche', message: error.message });
  }
});

/**
 * GET /klickypedia/details
 * Détails d'un set Playmobil via detailUrl
 */
router.get('/details', validateDetailsParams, async (req, res) => {
  try {
    const { lang, locale, autoTrad } = req.standardParams;
    const { id } = req.parsedDetailUrl;
    
    log.info(`Détails Klickypedia: ${id} (lang=${locale})`);
    
    const product = await getKlickypediaProductDetails(id, locale);
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé', message: `Aucun produit trouvé avec l'ID ${id}` });
    }
    
    addCacheHeaders(res, 3600);
    res.json(formatDetailResponse({
      data: product,
      provider: 'klickypedia',
      id,
      meta: { lang, locale, autoTrad }
    }));
    
  } catch (error) {
    log.error(`Erreur détails Klickypedia: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails', message: error.message });
  }
});

// ============================================================================
// ENDPOINTS LEGACY (rétrocompatibilité)
// ============================================================================

router.get('/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const params = extractStandardParams(req);
    
    if (!id) {
      return res.status(400).json({ error: 'ID produit manquant' });
    }
    
    const product = await getKlickypediaProductDetails(id, params.locale);
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    addCacheHeaders(res, 3600);
    res.json(product);
    
  } catch (error) {
    log.error(`Erreur détails Klickypedia: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails', message: error.message });
  }
});

router.get('/set/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const params = extractStandardParams(req);
    
    const idMatch = slug.match(/^(\d+)/);
    if (!idMatch) {
      return res.status(400).json({ error: 'Slug invalide' });
    }
    
    const id = idMatch[1];
    const product = await getKlickypediaProductDetails(id, params.locale);
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    addCacheHeaders(res, 3600);
    res.json(product);
    
  } catch (error) {
    log.error(`Erreur détails Klickypedia par slug: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails', message: error.message });
  }
});

export default router;
