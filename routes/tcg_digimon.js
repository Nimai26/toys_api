import express from 'express';
import { logger } from '../lib/utils/logger.js';
import { metrics } from '../lib/utils/state.js';
import {
  searchDigimonCards,
  getDigimonCardDetails,
  getDigimonCardByName
} from '../lib/providers/tcg/digimon.js';
import {
  normalizeDigimonSearch,
  normalizeDigimonCard
} from '../lib/normalizers/tcg.js';

const router = express.Router();

/**
 * GET /tcg_digimon/search
 * Rechercher des cartes Digimon
 * 
 * Query params:
 * - q: Nom de carte à chercher (requis)
 * - type: Filtre par type (Digimon, Digi-Egg, Tamer, Option)
 * - color: Filtre par couleur (Red, Blue, Yellow, Green, Black, Purple, White)
 * - level: Filtre par niveau (2-7)
 * - series: Série (défaut: Digimon Card Game)
 * - attribute: Attribut (Vaccine, Virus, Data, Free, Variable)
 * - rarity: Rareté (c, u, r, sr, sec)
 * - stage: Stage (In-Training, Rookie, Champion, Ultimate, Mega)
 * - max: Nombre max de résultats (défaut 20)
 * - lang: Langue (défaut 'en')
 * - autoTrad: Traduire automatiquement (défaut false)
 */
router.get('/search', async (req, res) => {
  try {
    metrics.sources.digimon.requests++;
    
    const {
      q,
      type,
      color,
      level,
      series,
      attribute,
      rarity,
      stage,
      max = 20,
      lang = 'en',
      autoTrad = false
    } = req.query;
    
    if (!q) {
      return res.status(400).json({
        error: 'Paramètre "q" requis pour la recherche'
      });
    }
    
    const options = {
      type,
      color,
      level,
      series,
      attribute,
      rarity,
      stage,
      max: parseInt(max, 10)
    };
    
    const rawData = await searchDigimonCards(q, options);
    const normalized = await normalizeDigimonSearch(rawData.data, {
      lang,
      autoTrad: autoTrad === 'true'
    });
    
    res.json({
      success: true,
      provider: 'tcg_digimon',
      query: q,
      total: normalized.total,
      count: normalized.data.length,
      data: normalized.data,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang,
        autoTrad: autoTrad === 'true'
      }
    });
  } catch (error) {
    metrics.sources.digimon.errors++;
    logger.error('Erreur lors de la recherche Digimon:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tcg_digimon/card
 * Récupérer une carte Digimon par nom exact ou ID
 * 
 * Query params:
 * - name: Nom exact de la carte
 * - id: ID unique de la carte (ex: BT1-084)
 * - series: Série (défaut: Digimon Card Game)
 * - lang: Langue (défaut 'en')
 * - autoTrad: Traduire automatiquement (défaut false)
 */
router.get('/card', async (req, res) => {
  try {
    metrics.sources.digimon.requests++;
    
    const {
      name,
      id,
      series,
      lang = 'en',
      autoTrad = false
    } = req.query;
    
    if (!name && !id) {
      return res.status(400).json({
        error: 'Paramètre "name" ou "id" requis'
      });
    }
    
    let rawCard;
    if (id) {
      rawCard = await getDigimonCardDetails(id);
    } else {
      const results = await getDigimonCardByName(name, { series });
      rawCard = results && results.length > 0 ? results[0] : null;
    }
    
    if (!rawCard) {
      return res.status(404).json({
        error: 'Carte non trouvée'
      });
    }
    
    const normalized = await normalizeDigimonCard(rawCard, {
      lang,
      autoTrad: autoTrad === 'true'
    });
    
    res.json({
      success: true,
      provider: 'tcg_digimon',
      id: id || name,
      data: normalized,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang,
        autoTrad: autoTrad === 'true'
      }
    });
  } catch (error) {
    metrics.sources.digimon.errors++;
    logger.error('Erreur lors de la récupération de la carte Digimon:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tcg_digimon/details
 * Alias pour /card avec ID uniquement
 * 
 * Query params:
 * - id: ID unique de la carte
 * - lang: Langue (défaut 'en')
 * - autoTrad: Traduire automatiquement (défaut false)
 */
router.get('/details', async (req, res) => {
  try {
    metrics.sources.digimon.requests++;
    
    const {
      id,
      lang = 'en',
      autoTrad = false
    } = req.query;
    
    if (!id) {
      return res.status(400).json({
        error: 'Paramètre "id" requis'
      });
    }
    
    const rawCard = await getDigimonCardDetails(id);
    
    if (!rawCard) {
      return res.status(404).json({
        error: 'Carte non trouvée'
      });
    }
    
    const normalized = await normalizeDigimonCard(rawCard, {
      lang,
      autoTrad: autoTrad === 'true'
    });
    
    res.json({
      success: true,
      provider: 'tcg_digimon',
      id,
      data: normalized,
      meta: {
        fetchedAt: new Date().toISOString(),
        lang,
        autoTrad: autoTrad === 'true'
      }
    });
  } catch (error) {
    metrics.sources.digimon.errors++;
    logger.error('Erreur lors de la récupération des détails Digimon:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
