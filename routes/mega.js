/**
 * Routes Mega Construx - toys_api
 * Endpoints pour Mega Construx (recherche, produits, instructions)
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { addCacheHeaders, asyncHandler } from '../lib/utils/index.js';
import { MEGA_DEFAULT_MAX, MEGA_DEFAULT_LANG } from '../lib/config.js';

import {
  searchMega as searchMegaLib,
  getMegaProductById as getMegaProductByIdLib,
  getMegaInstructions,
  listMegaInstructions
} from '../lib/providers/mega.js';

const router = Router();
const log = createLogger('Route:Mega');

// ============================================================================
// MEGA CONSTRUX ENDPOINTS
// ============================================================================

/**
 * Recherche de produits Mega Construx
 * @queryparam q - Terme de recherche (requis)
 * @queryparam max - Nombre max de résultats (défaut: 20, max: 100)
 * @queryparam page - Page de résultats (défaut: 1)
 * @queryparam lang - Langue (fr-FR, en-US, de-DE, es-ES, it-IT, nl-NL, en-GB, etc.)
 */
router.get("/search", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const max = req.query.max ? parseInt(req.query.max, 10) : MEGA_DEFAULT_MAX;
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const lang = req.query.lang || MEGA_DEFAULT_LANG;
  
  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  const result = await searchMegaLib(q, { max, page, lang });
  addCacheHeaders(res, 1800);
  res.json(result);
}));

/**
 * Récupère les détails d'un produit Mega Construx par ID ou SKU
 * @param id - ID Shopify ou SKU du produit
 * @queryparam lang - Langue
 */
router.get("/product/:id", asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const lang = req.query.lang || MEGA_DEFAULT_LANG;
  
  if (!productId) return res.status(400).json({ error: "ID ou SKU manquant" });
  
  const result = await getMegaProductByIdLib(productId, { lang });
  if (!result || !result.title) {
    return res.status(404).json({ error: `Produit ${productId} non trouvé` });
  }
  
  // Récupérer automatiquement les manuels de construction
  const skuForInstructions = result.sku || productId;
  if (skuForInstructions) {
    try {
      const instructionsResult = await getMegaInstructions(skuForInstructions);
      if (instructionsResult && instructionsResult.instructionsUrl) {
        result.instructions = [{
          url: instructionsResult.instructionsUrl,
          format: instructionsResult.format || 'PDF',
          productName: instructionsResult.productName
        }];
      } else {
        result.instructions = [];
      }
    } catch (instrErr) {
      // Si échec avec le SKU du produit, essayer avec le productId original
      if (result.sku && result.sku.toUpperCase() !== productId.toUpperCase()) {
        try {
          const instructionsResult2 = await getMegaInstructions(productId);
          if (instructionsResult2 && instructionsResult2.instructionsUrl) {
            result.instructions = [{
              url: instructionsResult2.instructionsUrl,
              format: instructionsResult2.format || 'PDF',
              productName: instructionsResult2.productName
            }];
          } else {
            result.instructions = [];
          }
        } catch (instrErr2) {
          log.debug(`Manuels non trouvés pour Mega ${productId}:`, instrErr2.message);
          result.instructions = [];
        }
      } else {
        log.debug(`Manuels non trouvés pour Mega ${skuForInstructions}:`, instrErr.message);
        result.instructions = [];
      }
    }
  } else {
    result.instructions = [];
  }
  
  addCacheHeaders(res, 3600);
  res.json(result);
}));

/**
 * Liste les produits Mega par franchise/thème
 * @param franchise - Nom de la franchise (pokemon, halo, barbie, hotwheels)
 */
router.get("/franchise/:franchise", asyncHandler(async (req, res) => {
  const franchise = req.params.franchise;
  const max = req.query.max ? parseInt(req.query.max, 10) : MEGA_DEFAULT_MAX;
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const lang = req.query.lang || MEGA_DEFAULT_LANG;
  
  const franchiseMap = {
    'pokemon': 'mega pokemon',
    'halo': 'mega halo',
    'barbie': 'mega barbie',
    'hotwheels': 'mega hot wheels',
    'hot-wheels': 'mega hot wheels',
    'bloks': 'mega bloks',
    'construx': 'mega construx'
  };
  
  const searchQuery = franchiseMap[franchise.toLowerCase()] || `mega ${franchise}`;
  
  const result = await searchMegaLib(searchQuery, { max, page, lang });
  result.franchise = franchise;
  addCacheHeaders(res, 1800);
  res.json(result);
}));

/**
 * Liste les langues supportées pour Mega Construx
 */
router.get("/languages", (req, res) => {
  const languages = {
    US: {
      region: 'Amérique',
      baseUrl: MEGA_BASE_URL_US,
      currency: 'USD',
      languages: ['en-US', 'es-MX', 'fr-CA', 'pt-BR', 'en-CA']
    },
    EU: {
      region: 'Europe',
      baseUrl: MEGA_BASE_URL_EU,
      currency: 'EUR',
      languages: ['fr-FR', 'de-DE', 'es-ES', 'it-IT', 'nl-NL', 'en-GB', 'pl-PL', 'tr-TR', 'el-GR', 'ru-RU']
    }
  };
  
  addCacheHeaders(res, 86400);
  res.json({
    default: MEGA_DEFAULT_LANG,
    regions: languages,
    source: 'mega'
  });
});

/**
 * Récupère les instructions de montage pour un produit Mega par SKU
 * @param sku - SKU du produit (ex: HMW05, HTH96)
 */
router.get("/instructions/:sku", asyncHandler(async (req, res) => {
  const sku = req.params.sku;
  
  if (!sku) return res.status(400).json({ error: "SKU manquant" });
  
  const result = await getMegaInstructions(sku);
  addCacheHeaders(res, 86400);
  res.json(result);
}));

/**
 * Liste toutes les instructions disponibles pour une catégorie
 * @queryparam category - Catégorie (pokemon, halo, barbie, hot-wheels, tesla, etc.)
 */
router.get("/instructions", asyncHandler(async (req, res) => {
  const category = req.query.category || '';
  
  const result = await listMegaInstructions(category);
  addCacheHeaders(res, 21600);
  res.json(result);
}));

export default router;
