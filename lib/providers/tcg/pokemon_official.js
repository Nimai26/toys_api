/**
 * Provider Pokémon TCG Official Website
 * Scraping de www.pokemon.com (site officiel)
 * Support multilingue: fr, en, de, it, es, pt
 * Utilise puppeteer-stealth.js (comme Amazon) pour contourner Incapsula
 */

import * as cheerio from 'cheerio';
import { getCached, setCache, metrics } from '../../utils/state.js';
import { logger } from '../../utils/logger.js';
import * as puppeteerStealth from '../../utils/puppeteer-stealth.js';

// Langues supportées avec fallback en anglais
const SUPPORTED_LANGS = ['en', 'fr', 'de', 'it', 'es', 'pt'];
const DEFAULT_LANG = 'en';

// Mapping des codes de langues pour les URLs
const LANG_URL_MAP = {
  'fr': { code: 'fr', searchPath: '/jcc-pokemon/cartes-pokemon', cardPath: '/jcc-pokemon/cartes-pokemon/series' },
  'en': { code: 'us', searchPath: '/pokemon-tcg/pokemon-cards', cardPath: '/pokemon-tcg/pokemon-cards/series' },
  'de': { code: 'de', searchPath: '/tcg-pokemon/pokemon-karten', cardPath: '/tcg-pokemon/pokemon-karten/series' },
  'it': { code: 'it', searchPath: '/gcc-pokemon/carte-pokemon', cardPath: '/gcc-pokemon/carte-pokemon/series' },
  'es': { code: 'es', searchPath: '/jcc-pokemon/cartas-pokemon', cardPath: '/jcc-pokemon/cartas-pokemon/series' },
  'pt': { code: 'pt', searchPath: '/estampas-ilustradas-pokemon/cartas-pokemon', cardPath: '/estampas-ilustradas-pokemon/cartas-pokemon/series' }
};

// Pattern d'URL pour les pages de cartes
const BASE_URL = 'https://www.pokemon.com';

/**
 * Normaliser le code langue avec fallback
 */
function normalizeLang(lang) {
  if (!lang) return DEFAULT_LANG;
  const normalized = lang.toLowerCase().substring(0, 2);
  return SUPPORTED_LANGS.includes(normalized) ? normalized : DEFAULT_LANG;
}

/**
 * Construire l'URL de recherche
 */
function buildSearchUrl(query, lang, filters = {}) {
  const normalizedLang = normalizeLang(lang);
  const langConfig = LANG_URL_MAP[normalizedLang];
  
  let url = `${BASE_URL}/${langConfig.code}${langConfig.searchPath}?cardName=${encodeURIComponent(query)}`;
  
  // Ajouter les filtres optionnels
  if (filters.type) url += `&card-${filters.type.toLowerCase()}=on`;
  if (filters.hitPointsMin !== undefined) url += `&hitPointsMin=${filters.hitPointsMin}`;
  if (filters.hitPointsMax !== undefined) url += `&hitPointsMax=${filters.hitPointsMax}`;
  if (filters.rarity) url += `&rarity-${filters.rarity.toLowerCase().replace(/\s+/g, '-')}=on`;
  
  return url;
}

/**
 * Construire l'URL d'une carte spécifique
 */
function buildCardUrl(set, number, lang) {
  const normalizedLang = normalizeLang(lang);
  const langConfig = LANG_URL_MAP[normalizedLang];
  
  // URL pattern: /us/pokemon-tcg/pokemon-cards/series/svp/27/
  return `${BASE_URL}/${langConfig.code}${langConfig.cardPath}/${set}/${number}/`;
}

/**
 * Extraire les données d'une carte depuis le HTML
 */
function extractCardData($, lang) {
  try {
    // Extraire l'image
    const imageUrl = $('img[alt*="Pikachu"], img.card-image, img[src*="assets.pokemon.com"]').attr('src') ||
                     $('img[src*="/cards/web/"]').attr('src');
    
    // Extraire le nom
    const name = $('h1').first().text().trim() ||
                 $('.card-name').text().trim();
    
    // Extraire le type de carte (Pokémon de base, Niveau 1, etc.)
    const cardType = $('h2').first().text().trim() ||
                     $('.card-type').text().trim();
    
    // Extraire les PV (Points de Vie)
    const hpMatch = $('body').html().match(/PV\s*(\d+)|HP\s*(\d+)/i);
    const hp = hpMatch ? (hpMatch[1] || hpMatch[2]) : null;
    
    // Extraire le numéro de carte et extension
    const cardNumberText = $('body').text();
    const numberMatch = cardNumberText.match(/(\d+)\/(\d+|[A-Z]+)\s+(Promo|Rare|Commune)/i) ||
                       cardNumberText.match(/([A-Z]{2,4})\s+([A-Z]{2})\s+(\d+)/);
    
    const cardNumber = numberMatch ? numberMatch[1] : null;
    const setTotal = numberMatch ? numberMatch[2] : null;
    const rarity = numberMatch ? numberMatch[3] : null;
    
    // Extraire l'extension
    const setName = $('a[href*="/cartes-pokemon?"]').first().text().trim() ||
                    $('.set-name').text().trim();
    
    // Extraire les attaques
    const attacks = [];
    $('h4, .attack-name').each((i, elem) => {
      const attackName = $(elem).text().trim();
      if (attackName && attackName.length > 0 && attackName.length < 50) {
        const attackText = $(elem).next('p, .attack-description').text().trim();
        const damageMatch = attackText.match(/(\d+)\+?/);
        attacks.push({
          name: attackName,
          damage: damageMatch ? damageMatch[1] : null,
          text: attackText
        });
      }
    });
    
    // Extraire les énergies d'attaque (icônes)
    const energyCost = [];
    $('[class*="energy"], [class*="card-"]').each((i, elem) => {
      const classes = $(elem).attr('class') || '';
      const energyMatch = classes.match(/(lightning|fire|water|grass|psychic|fighting|darkness|metal|colorless|fairy|dragon)/i);
      if (energyMatch) {
        energyCost.push(energyMatch[1]);
      }
    });
    
    // Extraire faiblesse
    const weaknessHtml = $('h4:contains("Faiblesse"), h4:contains("Weakness")').parent().html() || '';
    const weaknessMatch = weaknessHtml.match(/(fighting|psychic|fire|water|grass|lightning|darkness|metal|dragon|fairy|colorless)/i);
    const weakness = weaknessMatch ? weaknessMatch[1] : null;
    const weaknessMultiplier = weaknessHtml.match(/×(\d+)/) ? weaknessHtml.match(/×(\d+)/)[1] : null;
    
    // Extraire résistance
    const resistanceHtml = $('h4:contains("Résistance"), h4:contains("Resistance")').parent().html() || '';
    const resistanceMatch = resistanceHtml.match(/(fighting|psychic|fire|water|grass|lightning|darkness|metal|dragon|fairy|colorless)/i);
    const resistance = resistanceMatch ? resistanceMatch[1] : null;
    const resistanceValue = resistanceHtml.match(/-(\d+)/) ? `-${resistanceHtml.match(/-(\d+)/)[1]}` : null;
    
    // Extraire coût de retraite
    const retreatHtml = $('h4:contains("Coût de Retraite"), h4:contains("Retreat")').parent().html() || '';
    const retreatCostMatch = retreatHtml.match(/(\d+)/);
    const retreatCost = retreatCostMatch ? parseInt(retreatCostMatch[1]) : 0;
    
    // Extraire l'illustrateur
    const illustrator = $('a[href*="particularArtist"]').text().trim() ||
                        $('.illustrator').text().trim();
    
    return {
      name,
      imageUrl,
      cardType,
      hp: hp ? parseInt(hp) : null,
      attacks,
      energyCost: energyCost.length > 0 ? energyCost : null,
      weakness: weakness ? { type: weakness, value: weaknessMultiplier || '×2' } : null,
      resistance: resistance ? { type: resistance, value: resistanceValue || '-20' } : null,
      retreatCost,
      cardNumber,
      setTotal,
      rarity,
      setName,
      illustrator,
      lang
    };
  } catch (error) {
    logger.error(`[Pokemon Official] Error extracting card data: ${error.message}`);
    return null;
  }
}

/**
 * Recherche de cartes Pokémon sur le site officiel
 */
export async function searchPokemonCardsOfficial(query, options = {}) {
  const {
    lang = 'en',
    max = 20,
    filters = {}
  } = options;

  const normalizedLang = normalizeLang(lang);
  const cacheKey = `pokemon-official:search:${query}:${normalizedLang}:${max}`;
  
  // Vérifier le cache
  const cached = getCached(cacheKey);
  if (cached) {
    logger.info(`[Pokemon Official] Cache hit for search: ${query} (${normalizedLang})`);
    return cached;
  }

  const url = buildSearchUrl(query, normalizedLang, filters);
  
  try {
    logger.info(`[Pokemon Official] Searching: ${query} (lang: ${normalizedLang})`);
    
    // Utiliser puppeteer-stealth comme Amazon
    const { html, status } = await puppeteerStealth.stealthGet(url, {
      timeout: 40000,
      waitFor: 'networkidle2', // Attendre que tout le JS ait fini de charger
    });
    
    if (status !== 200) {
      throw new Error(`HTTP ${status}`);
    }
    
    // Parser avec Cheerio
    const $ = cheerio.load(html);
    
    // Debug: Sauvegarder un échantillon du HTML
    logger.debug(`[Pokemon Official] HTML length: ${html.length} chars`);
    logger.debug(`[Pokemon Official] Page title: ${$('title').text()}`);
    logger.debug(`[Pokemon Official] Links found: ${$('a').length}`);
    
    // Extraire les liens vers les cartes (multiples patterns)
    const cardLinks = [];
    
    // Sélecteurs possibles pour les cartes Pokemon.com
    const selectors = [
      'a[href*="/series/"]',
      '.card-item a',
      '.results-item a',
      'a[href*="cartes-pokemon/series"]',
      'a[href*="pokemon-cards/series"]',
      '[class*="card"] a[href*="/series/"]', // Plus générique
      'div[data-card] a', // Si les cartes ont un attribut data
    ];
    
    for (const selector of selectors) {
      $(selector).each((i, elem) => {
        const href = $(elem).attr('href');
        if (href && href.match(/\/series\/[^/]+\/\d+\/?$/)) {
          // Construire l'URL complète si nécessaire
          const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
          if (!cardLinks.includes(fullUrl)) {
            cardLinks.push(fullUrl);
          }
        }
      });
      
      if (cardLinks.length > 0) {
        logger.debug(`[Pokemon Official] Found ${cardLinks.length} results with selector: ${selector}`);
        break; // Arrêter dès qu'on trouve des résultats
      }
    }
    
    // Si aucun résultat trouvé, logger un échantillon du HTML pour debug
    if (cardLinks.length === 0) {
      const htmlSample = html.replace(/\s+/g, ' ').substring(0, 2000);
      logger.warn(`[Pokemon Official] No cards found. HTML sample: ${htmlSample.substring(0, 500)}...`);
      logger.warn(`[Pokemon Official] URL was: ${url}`);
    }
    
    logger.info(`[Pokemon Official] Found ${cardLinks.length} card links`);
    
    // Extraire set et number depuis chaque URL
    const results = cardLinks.map(url => {
      const match = url.match(/\/series\/([^/]+)\/(\d+)\//);
      if (match) {
        return {
          set: match[1],
          number: match[2],
          url
        };
      }
      return null;
    }).filter(Boolean).slice(0, max);
    
    const data = {
      query,
      lang: normalizedLang,
      count: results.length,
      cards: results
    };
    
    setCache(cacheKey, data, 3600); // Cache 1h
    return data;
    
  } catch (error) {
    metrics.sources.pokemon_official = metrics.sources.pokemon_official || { requests: 0, errors: 0 };
    metrics.sources.pokemon_official.errors++;
    logger.error(`[Pokemon Official] Search error: ${error.message}`);
    
    // Fallback en anglais si la langue demandée échoue
    if (normalizedLang !== DEFAULT_LANG) {
      logger.info(`[Pokemon Official] Trying fallback to English...`);
      return searchPokemonCardsOfficial(query, { ...options, lang: DEFAULT_LANG });
    }
    
    throw error;
  }
}

/**
 * Obtenir les détails d'une carte spécifique
 */
export async function getPokemonCardDetailsOfficial(set, number, options = {}) {
  const { lang = 'en' } = options;
  const normalizedLang = normalizeLang(lang);
  
  const cacheKey = `pokemon-official:card:${set}:${number}:${normalizedLang}`;
  
  // Vérifier le cache
  const cached = getCached(cacheKey);
  if (cached) {
    logger.info(`[Pokemon Official] Cache hit for card: ${set}/${number} (${normalizedLang})`);
    return cached;
  }

  const url = buildCardUrl(set, number, normalizedLang);
  
  try {
    logger.info(`[Pokemon Official] Fetching card: ${set}/${number} (lang: ${normalizedLang})`);
    
    // Utiliser puppeteer-stealth comme Amazon
    const { html, status } = await puppeteerStealth.stealthGet(url, {
      timeout: 40000,
      waitFor: 'domcontentloaded',
    });
    
    // Vérifier si la page existe (404 = fallback en anglais)
    if (status === 404) {
      if (normalizedLang !== DEFAULT_LANG) {
        logger.info(`[Pokemon Official] Card not found in ${normalizedLang}, trying English...`);
        return getPokemonCardDetailsOfficial(set, number, { lang: DEFAULT_LANG });
      }
      
      throw new Error(`Card ${set}/${number} not found`);
    }
    
    if (status !== 200) {
      throw new Error(`HTTP ${status}`);
    }
    
    // Parser avec Cheerio pour extraire les données
    const $ = cheerio.load(html);
    
    const cardData = extractCardData($, normalizedLang);
    
    if (!cardData) {
      throw new Error('Failed to extract card data');
    }
    
    cardData.set = set;
    cardData.number = number;
    cardData.url = url;
    
    setCache(cacheKey, cardData, 86400); // Cache 24h
    
    metrics.sources.pokemon_official = metrics.sources.pokemon_official || { requests: 0, errors: 0 };
    metrics.sources.pokemon_official.requests++;
    
    return cardData;
    
  } catch (error) {
    metrics.sources.pokemon_official = metrics.sources.pokemon_official || { requests: 0, errors: 0 };
    metrics.sources.pokemon_official.errors++;
    logger.error(`[Pokemon Official] Card details error: ${error.message}`);
    
    // Fallback en anglais
    if (normalizedLang !== DEFAULT_LANG) {
      logger.info(`[Pokemon Official] Trying fallback to English...`);
      return getPokemonCardDetailsOfficial(set, number, { lang: DEFAULT_LANG });
    }
    
    throw error;
  }
}
