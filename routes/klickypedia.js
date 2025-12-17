/**
 * routes/klickypedia.js - Routes Klickypedia
 * toys_api v2.4.0
 * 
 * Endpoints pour l'encyclopédie Playmobil Klickypedia
 * avec support de traduction automatique
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { searchKlickypedia, getKlickypediaProductDetails } from '../lib/providers/klickypedia.js';
import { KLICKYPEDIA_DEFAULT_LANG, KLICKYPEDIA_DEFAULT_MAX } from '../lib/config.js';

// Import optionnel du service de traduction
let translateText = null;
try {
  const translationModule = await import('../lib/utils/translation.js');
  translateText = translationModule.translateText;
} catch (e) {
  // Module de traduction non disponible
}

const router = Router();
const log = createLogger('Route:Klickypedia');

// ========================================
// GET /klickypedia/search
// Recherche de sets Playmobil
// ========================================
router.get('/search', async (req, res) => {
  try {
    const { q, query, max, limit, lang, translate } = req.query;
    const searchTerm = q || query;
    
    if (!searchTerm) {
      return res.status(400).json({
        error: 'Paramètre de recherche manquant',
        message: 'Utilisez ?q=votre+recherche ou ?query=votre+recherche'
      });
    }
    
    const effectiveMax = parseInt(max || limit) || KLICKYPEDIA_DEFAULT_MAX;
    const effectiveLang = lang || KLICKYPEDIA_DEFAULT_LANG;
    
    log.info(`Recherche Klickypedia: "${searchTerm}" (lang=${effectiveLang}, max=${effectiveMax})`);
    
    const results = await searchKlickypedia(searchTerm, effectiveLang, 3, effectiveMax);
    
    // Traduction automatique si demandée
    if (translate && translateText && results.products) {
      const targetLang = typeof translate === 'string' ? translate : 'fr';
      for (const product of results.products) {
        if (product.name) {
          product.name = await translateText(product.name, targetLang);
        }
      }
    }
    
    res.json(results);
    
  } catch (error) {
    log.error(`Erreur recherche Klickypedia: ${error.message}`);
    
    res.status(500).json({
      error: 'Erreur lors de la recherche',
      message: error.message
    });
  }
});

// ========================================
// GET /klickypedia/product/:id
// Détails d'un set Playmobil
// ========================================
router.get('/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lang, translate } = req.query;
    
    if (!id) {
      return res.status(400).json({
        error: 'ID produit manquant',
        message: 'Utilisez /klickypedia/product/71148'
      });
    }
    
    const effectiveLang = lang || KLICKYPEDIA_DEFAULT_LANG;
    
    log.info(`Détails Klickypedia: ${id} (lang=${effectiveLang})`);
    
    const product = await getKlickypediaProductDetails(id, effectiveLang);
    
    if (!product) {
      return res.status(404).json({
        error: 'Produit non trouvé',
        message: `Aucun produit trouvé avec l'ID ${id}`
      });
    }
    
    // Traduction automatique si demandée
    if (translate && translateText) {
      const targetLang = typeof translate === 'string' ? translate : 'fr';
      if (product.name) {
        product.name = await translateText(product.name, targetLang);
      }
      if (product.description) {
        product.description = await translateText(product.description, targetLang);
      }
    }
    
    res.json(product);
    
  } catch (error) {
    log.error(`Erreur détails Klickypedia: ${error.message}`);
    
    res.status(500).json({
      error: 'Erreur lors de la récupération des détails',
      message: error.message
    });
  }
});

// ========================================
// GET /klickypedia/set/:slug
// Détails par slug (alias)
// ========================================
router.get('/set/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { lang, translate } = req.query;
    
    // Extraire l'ID depuis le slug (ex: 71148-asterix-pyramid -> 71148)
    const idMatch = slug.match(/^(\d+)/);
    if (!idMatch) {
      return res.status(400).json({
        error: 'Slug invalide',
        message: 'Le slug doit commencer par un numéro de produit'
      });
    }
    
    const id = idMatch[1];
    const effectiveLang = lang || KLICKYPEDIA_DEFAULT_LANG;
    
    log.info(`Détails Klickypedia par slug: ${slug} -> ${id} (lang=${effectiveLang})`);
    
    const product = await getKlickypediaProductDetails(id, effectiveLang);
    
    if (!product) {
      return res.status(404).json({
        error: 'Produit non trouvé',
        message: `Aucun produit trouvé pour le slug ${slug}`
      });
    }
    
    // Traduction automatique si demandée
    if (translate && translateText) {
      const targetLang = typeof translate === 'string' ? translate : 'fr';
      if (product.name) {
        product.name = await translateText(product.name, targetLang);
      }
      if (product.description) {
        product.description = await translateText(product.description, targetLang);
      }
    }
    
    res.json(product);
    
  } catch (error) {
    log.error(`Erreur détails Klickypedia par slug: ${error.message}`);
    
    res.status(500).json({
      error: 'Erreur lors de la récupération des détails',
      message: error.message
    });
  }
});

export default router;
