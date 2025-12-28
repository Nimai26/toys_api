/**
 * routes/klickypedia.js - Routes Klickypedia
 * toys_api v4.0.0
 * 
 * Endpoints normalisés pour l'encyclopédie Playmobil Klickypedia
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { searchKlickypedia, getKlickypediaProductDetailsNormalized } from '../lib/providers/klickypedia.js';
import { KLICKYPEDIA_DEFAULT_LANG, KLICKYPEDIA_DEFAULT_MAX } from '../lib/config.js';
import { 
  addCacheHeaders,
  extractStandardParams,
  validateSearchParams,
  validateDetailsParams,
  generateDetailUrl,
  formatSearchResponse,
  formatDetailResponse,
  translateSearchDescriptions
} from '../lib/utils/index.js';
import { createProviderCache, getCacheInfo } from '../lib/database/cache-wrapper.js';

const router = Router();
const log = createLogger('Route:Klickypedia');

// Cache PostgreSQL pour Klickypedia
const klickypediaCache = createProviderCache('klickypedia', 'construct_toy');

// ============================================================================
// ENDPOINTS NORMALISÉS v3.0.0
// ============================================================================

/**
 * GET /klickypedia/search (avec cache PostgreSQL)
 * Recherche de sets Playmobil sur Klickypedia
 */
router.get('/search', validateSearchParams, async (req, res) => {
  try {
    const { q, lang, locale, max, autoTrad } = req.standardParams;
    const refresh = req.query.refresh === 'true';
    
    log.info(`Recherche Klickypedia: "${q}" (lang=${locale}, max=${max})`);
    
    const result = await klickypediaCache.searchWithCache(
      q,
      async () => {
        const rawResult = await searchKlickypedia(q, locale, 3, max);
        
        // Transformer au format normalisé
        const items = (rawResult.products || []).map(product => ({
          type: 'construct_toy',
          source: 'klickypedia',
          sourceId: product.productId || product.id,
          name: product.name,
          name_original: product.name,
          description: product.description || null,
          year: product.year || product.releaseYear || null,
          image: product.image || product.primaryImage,
          src_url: product.url || `https://www.klickypedia.com/product/${product.productId || product.id}`,
          detailUrl: generateDetailUrl('klickypedia', product.productId || product.id, 'product')
        }));
        
        return {
          results: items,
          total: rawResult.total || items.length,
          hasMore: (rawResult.total || 0) > items.length
        };
      },
      { params: { locale, max }, forceRefresh: refresh }
    );
    
    // Traduire les descriptions si autoTrad est activé (après le cache)
    const translatedResults = await translateSearchDescriptions(result.results || [], autoTrad, lang);
    
    addCacheHeaders(res, 1800, getCacheInfo());
    res.json(formatSearchResponse({
      items: translatedResults,
      provider: 'klickypedia',
      query: q,
      pagination: {
        page: 1,
        pageSize: (result.results || []).length,
        totalResults: result.total,
        hasMore: result.hasMore
      },
      meta: { lang, locale, autoTrad },
    cacheMatch: result._cacheMatch
  }));
    
  } catch (error) {
    log.error(`Erreur recherche Klickypedia: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la recherche', message: error.message });
  }
});

/**
 * GET /klickypedia/details
 * Détails d'un set Playmobil via detailUrl (avec cache PostgreSQL)
 */
router.get('/details', validateDetailsParams, async (req, res) => {
  try {
    const { lang, locale, autoTrad } = req.standardParams;
    const { id } = req.parsedDetailUrl;
    const forceRefresh = req.query.refresh === 'true';
    
    log.info(`Détails Klickypedia: ${id} (lang=${locale})`);
    
    const product = await klickypediaCache.getWithCache(
      id,
      async () => getKlickypediaProductDetailsNormalized(id, locale),
      { forceRefresh }
    );
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé', message: `Aucun produit trouvé avec l'ID ${id}` });
    }
    
    addCacheHeaders(res, 3600, getCacheInfo());
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
