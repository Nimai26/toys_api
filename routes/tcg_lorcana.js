import express from 'express';
import { logger } from '../lib/utils/logger.js';
import { metrics } from '../lib/utils/state.js';
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
 * - lang: Langue (en, fr, de, it - défaut 'en')
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
      lang = 'en'
    } = req.query;
    
    if (!q) {
      return res.status(400).json({
        error: 'Paramètre "q" requis pour la recherche'
      });
    }
    
    const options = {
      lang,
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
    const normalized = await normalizeLorcanaSearch(rawData, { lang });
    
    res.json(normalized);
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
      lang = 'en'
    } = req.query;
    
    if (!name && !id) {
      return res.status(400).json({
        error: 'Paramètre "name" ou "id" requis'
      });
    }
    
    let rawCard;
    if (id) {
      rawCard = await getLorcanaCardDetails(id, { lang });
    } else {
      rawCard = await getLorcanaCardByName(name, { lang });
    }
    
    if (!rawCard) {
      return res.status(404).json({
        error: 'Carte non trouvée'
      });
    }
    
    const normalized = await normalizeLorcanaCard(rawCard, { lang });
    
    res.json({ data: normalized });
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
      lang = 'en'
    } = req.query;
    
    if (!id) {
      return res.status(400).json({
        error: 'Paramètre "id" requis'
      });
    }
    
    const rawCard = await getLorcanaCardDetails(id, { lang });
    
    if (!rawCard) {
      return res.status(404).json({
        error: 'Carte non trouvée'
      });
    }
    
    const normalized = await normalizeLorcanaCard(rawCard, { lang });
    
    res.json({ data: normalized });
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
    
    const rawSets = await getLorcanaSets({ lang });
    const normalized = normalizeLorcanaSets(rawSets);
    
    res.json(normalized);
  } catch (error) {
    metrics.sources.lorcana.errors++;
    logger.error('Erreur lors de la récupération des sets Lorcana:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
