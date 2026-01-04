import express from 'express';
import { logger } from '../lib/utils/logger.js';
import { metrics } from '../lib/utils/state.js';
import { formatDetailResponse } from '../lib/utils/index.js';
import {
  searchLorcanaCards,
  getLorcanaCardDetails,
  getLorcanaCardByName,
  getLorcanaSets
} from '../lib/providers/tcg/lorcana.js';
import {
  normalizeLorcanaSearch,
  normalizeLorcanaCard,
  normalizeLorcanaSets
} from '../lib/normalizers/tcg.js';

const router = express.Router();

/**
 * Normalise les codes de langue (fr-FR → fr, en-US → en, etc.)
 * @param {string} lang - Code langue potentiellement avec région
 * @returns {string} - Code langue normalisé (en, fr, de, it)
 */
function normalizeLangCode(lang) {
  if (!lang) return 'en';
  
  // Convertir en minuscules et prendre seulement la partie avant le tiret
  const baseLang = lang.toLowerCase().split('-')[0];
  
  // Valider que c'est une langue supportée
  const supportedLangs = ['en', 'fr', 'de', 'it'];
  return supportedLangs.includes(baseLang) ? baseLang : 'en';
}

/**
 * GET /tcg_lorcana/search
 * Rechercher des cartes Disney Lorcana (LorcanaJSON)
 * 
 * Query params:
 * - q: Nom de carte à chercher
 * - color: Filtre par couleur (Amber, Amethyst, Emerald, Ruby, Sapphire, Steel)
 * - type: Filtre par type (Character, Action, Item, Location)
 * - rarity: Filtre par rareté (Common, Uncommon, Rare, Super Rare, Legendary, Enchanted)
 * - set: Filtre par set (nom ou ID)
 * - cost: Filtre par coût
 * - inkable: Filtre par inkable (true/false)
 * - max: Nombre max de résultats (défaut 20)
 * - page: Page (défaut 1)
 * - lang: Langue (en, fr, de, it - défaut 'en') - Accepte aussi fr-FR, en-US, etc.
 */
router.get('/search', async (req, res) => {
  try {
    metrics.sources.lorcana.requests++;
    
    const {
      q,
      color,
      type,
      rarity,
      set,
      cost,
      inkable,
      max = 20,
      page = 1,
      lang = 'en',
      autoTrad
    } = req.query;
    
    // Normaliser le code de langue (fr-FR -> fr, en-US -> en)
    const normalizedLang = normalizeLangCode(lang);
    
    if (!q) {
      return res.status(400).json({
        error: 'Paramètre "q" requis pour la recherche'
      });
    }
    
    const options = {
      lang: normalizedLang,
      color,
      type,
      rarity,
      set,
      cost,
      inkable: inkable === 'true' ? true : inkable === 'false' ? false : undefined,
      max: parseInt(max, 10),
      page: parseInt(page, 10)
    };
    
    const rawData = await searchLorcanaCards(q, options);
    const normalized = await normalizeLorcanaSearch(rawData, { lang: normalizedLang });
    
    res.json({
      success: true,
      provider: 'tcg_lorcana',
      query: q,
      total: normalized.total,
      count: normalized.data.length,
      data: normalized.data,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang: normalizedLang,
        locale: lang,
        autoTrad: autoTrad === 'true' || autoTrad === '1' || autoTrad === true
      }
    });
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error('Erreur lors de la recherche Lorcana:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tcg_lorcana/card
 * Récupérer une carte Lorcana par nom exact ou ID (LorcanaJSON)
 * 
 * Query params:
 * - name: Nom exact de la carte
 * - id: ID unique de la carte
 * - lang: Langue (en, fr, de, it - défaut 'en')
 */
router.get('/card', async (req, res) => {
  try {
    metrics.sources.lorcana.requests++;
    
    const {
      name,
      id,
      lang = 'en',
      autoTrad
    } = req.query;
    
    // Normaliser le code de langue (fr-FR -> fr, en-US -> en)
    const normalizedLang = normalizeLangCode(lang);
    
    if (!name && !id) {
      return res.status(400).json({
        error: 'Paramètre "name" ou "id" requis'
      });
    }
    
    let rawCard;
    if (id) {
      rawCard = await getLorcanaCardDetails(id, { lang: normalizedLang });
    } else {
      rawCard = await getLorcanaCardByName(name, { lang: normalizedLang });
    }
    
    if (!rawCard) {
      return res.status(404).json({
        error: 'Carte non trouvée'
      });
    }
    
    const normalized = await normalizeLorcanaCard(rawCard, { lang: normalizedLang });
    
    res.json(formatDetailResponse({
      total: normalized.total,
      count: normalized.data.length,
      data: normalized.data,
      provider: 'tcg_lorcana',
      id: id || rawCard.id || rawCard.fullIdentifier,
      meta: { lang: normalizedLang, locale: lang, autoTrad: autoTrad === 'true' || autoTrad === '1' }
    }));
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error('Erreur lors de la récupération de la carte Lorcana:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tcg_lorcana/details
 * Alias pour /card avec ID uniquement (LorcanaJSON)
 * 
 * Query params:
 * - id: ID unique de la carte
 * - lang: Langue (en, fr, de, it - défaut 'en')
 */
router.get('/details', async (req, res) => {
  try {
    metrics.sources.lorcana.requests++;
    
    const {
      id,
      lang = 'en',
      autoTrad
    } = req.query;
    
    // Normaliser le code de langue (fr-FR -> fr, en-US -> en)
    const normalizedLang = normalizeLangCode(lang);
    
    if (!id) {
      return res.status(400).json({
        error: 'Paramètre "id" requis'
      });
    }
    
    const rawCard = await getLorcanaCardDetails(id, { lang: normalizedLang });
    
    if (!rawCard) {
      return res.status(404).json({
        error: 'Carte non trouvée'
      });
    }
    
    const normalized = await normalizeLorcanaCard(rawCard, { lang: normalizedLang });
    
    res.json(formatDetailResponse({
      total: normalized.total,
      count: normalized.data.length,
      data: normalized.data,
      provider: 'tcg_lorcana',
      id: rawCard.id || rawCard.fullIdentifier,
      meta: { lang: normalizedLang, locale: lang, autoTrad: autoTrad === 'true' || autoTrad === '1' }
    }));
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error('Erreur lors de la récupération des détails Lorcana:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tcg_lorcana/sets
 * Lister tous les sets Lorcana (LorcanaJSON)
 * 
 * Query params:
 * - lang: Langue (en, fr, de, it - défaut 'en')
 */
router.get('/sets', async (req, res) => {
  try {
    metrics.sources.lorcana.requests++;
    
    const { lang = 'en' } = req.query;
    
    // Normaliser le code de langue (fr-FR -> fr, en-US -> en)
    const normalizedLang = normalizeLangCode(lang);
    
    const rawSets = await getLorcanaSets({ lang: normalizedLang });
    const normalized = normalizeLorcanaSets(rawSets);
    
    res.json({
      success: true,
      provider: 'tcg_lorcana',
      total: normalized.total,
      count: normalized.data.length,
      data: normalized.data,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang: normalizedLang
      }
    });
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error('Erreur lors de la récupération des sets Lorcana:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
