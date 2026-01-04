/**
 * Provider Pokémon TCG Official Website
 * Scraping de www.pokemon.com (site officiel)
 * Support multilingue: fr, en, de, it, es, pt
 * Utilise puppeteer-stealth.js (comme Amazon) pour contourner Incapsula
 */

import * as cheerio from 'cheerio';
import { metrics } from '../../utils/state.js';
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
  // Si lang est un tableau (multiples paramètres), prendre le premier
  const langStr = Array.isArray(lang) ? lang[0] : lang;
  if (typeof langStr !== 'string') return DEFAULT_LANG;
  const normalized = langStr.toLowerCase().substring(0, 2);
  return SUPPORTED_LANGS.includes(normalized) ? normalized : DEFAULT_LANG;
}

/**
 * Construire l'URL de recherche
 */
function buildSearchUrl(query, lang, filters = {}, page = 1) {
  const normalizedLang = normalizeLang(lang);
  const langConfig = LANG_URL_MAP[normalizedLang];
  
  // Utiliser URLSearchParams pour construire proprement l'URL avec les valeurs par défaut
  const params = new URLSearchParams({
    cardName: query,
    cardText: '',
    evolvesFrom: '',
    simpleSubmit: '',
    hitPointsMin: 0,
    hitPointsMax: 340,
    retreatCostMin: 0,
    retreatCostMax: 5,
    totalAttackCostMin: 0,
    totalAttackCostMax: 5,
    particularArtist: ''
  });
  
  // Ajouter la pagination si page > 1
  if (page > 1) {
    params.append('format', 'detail');
    params.append('page', page.toString());
  }
  
  // Ajouter les filtres de type et rareté si fournis
  if (filters.type) params.append(`card-${filters.type.toLowerCase()}`, 'on');
  if (filters.rarity) params.append(`rarity-${filters.rarity.toLowerCase().replace(/\s+/g, '-')}`, 'on');
  
  return `${BASE_URL}/${langConfig.code}${langConfig.searchPath}?${params.toString()}`;
}

/**
 * Générer l'URL de l'image d'une carte Pokemon.com
 * Pattern: https://assets.pokemon.com/static-assets/content-assets/cms2-{lang}/img/cards/web/{SET}/{SET}_{LANG}_{NUMBER}.png
 */
function buildCardImageUrl(set, number, lang) {
  const normalizedLang = normalizeLang(lang);
  const langConfig = LANG_URL_MAP[normalizedLang];
  const langCode = langConfig.code === 'us' ? 'en' : langConfig.code; // us → en pour les images
  
  // Format: SMP_FR_SM108.png
  const setUpper = set.toUpperCase();
  const langUpper = langCode.toUpperCase();
  const filename = `${setUpper}_${langUpper}_${number}.png`;
  
  // URL complète
  return `https://assets.pokemon.com/static-assets/content-assets/cms2-${langConfig.code}-${langCode}/img/cards/web/${setUpper}/${filename}`;
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
    // Extraire l'image de la carte
    // Format: https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/SMP/SMP_FR_SM108.png
    let imageUrl = null;
    
    // 1. Chercher dans le div avec classe card-image (page de détails)
    const cardImageDiv = $('.card-image img, .content-block-full.card-image img');
    if (cardImageDiv.length > 0) {
      imageUrl = cardImageDiv.first().attr('src');
    }
    
    // 2. Chercher les images dans /static-assets/content-assets/cms2.../img/cards/web/
    if (!imageUrl) {
      const cardImageSelectors = [
        'img[src*="/static-assets/content-assets/cms2"]',
        'img[src*="/img/cards/web/"]',
        'img[src*="/cards/web/"]'
      ];
      
      for (const selector of cardImageSelectors) {
        const src = $(selector).attr('src');
        if (src && src.includes('/cards/web/')) {
          imageUrl = src;
          break;
        }
      }
    }
    
    // 3. Fallback: toute image avec /cards/ dans l'URL (exclure logos)
    if (!imageUrl) {
      $('img').each((i, elem) => {
        const src = $(elem).attr('src');
        if (src && 
            src.includes('/cards/') && 
            !src.includes('/buttons/') && 
            !src.includes('/icons/') && 
            !src.includes('/logo') &&
            !src.includes('79x45')) {
          imageUrl = src;
          return false; // break
        }
      });
    }
    
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
    filters = {},
    forceRefresh = false
  } = options;

  const normalizedLang = normalizeLang(lang);
  const url = buildSearchUrl(query, normalizedLang, filters);
  
  try {
    logger.info(`[Pokemon Official] Searching: ${query} (lang: ${normalizedLang}, max: ${max})`);
    
    // Résultats de toutes les pages
    const allResults = [];
    let currentPage = 1;
    const RESULTS_PER_PAGE = 12; // Pokemon.com affiche 12 résultats par page
    const maxPages = Math.ceil(max / RESULTS_PER_PAGE);
    
    // Boucle de pagination
    while (allResults.length < max && currentPage <= maxPages) {
      const pageUrl = currentPage === 1 ? url : buildSearchUrl(query, normalizedLang, filters, currentPage);
      
      logger.debug(`[Pokemon Official] Fetching page ${currentPage}/${maxPages}`, { url: pageUrl });
      
      // Utiliser puppeteer-stealth comme Amazon
      const { html, status } = await puppeteerStealth.stealthGet(pageUrl, {
        timeout: 20000, // Réduit de 50s à 20s
        waitFor: 'domcontentloaded', // Plus rapide que networkidle2, suffisant pour le HTML
        fullPageScroll: false, // Désactivé : les 12 cartes sont déjà dans le HTML initial
        useProxy: false, // Pokemon.com ne bloque pas - accélère le chargement
        fastMode: true // Désactiver les délais de simulation humaine (~4-7s économisés par page)
      });
      
      if (status !== 200) {
        logger.warn(`[Pokemon Official] Page ${currentPage} returned HTTP ${status}`);
        break;
      }
      
      // Parser avec Cheerio
      const $ = cheerio.load(html);
      
      // Debug pour la première page uniquement
      if (currentPage === 1) {
        logger.debug(`[Pokemon Official] HTML length: ${html.length} chars`);
        logger.debug(`[Pokemon Official] Page title: ${$('title').text()}`);
        logger.debug(`[Pokemon Official] Links found: ${$('a').length}`);
      }
      
      // Extraire les liens vers les cartes avec leurs noms (depuis l'attribut alt de l'image)
      const pageResults = [];
      
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
        const matchedElements = $(selector);
        logger.debug(`[Pokemon Official] Selector '${selector}' matched ${matchedElements.length} elements on page ${currentPage}`);
        
        $(selector).each((i, elem) => {
          const href = $(elem).attr('href');
          
          if (href && href.match(/\/series\/[^/]+\/[^/]+\/?$/)) {
            // Construire l'URL complète si nécessaire
            const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
            
            // Extraire le nom depuis l'attribut alt de l'image
            const img = $(elem).find('img');
            const name = img.attr('alt') || null;
            
            // Extraire set et number depuis l'URL
            // Exemples: /series/svp/27/ ou /series/smp/SM109/ ou /series/bwp/BW54/
            const match = fullUrl.match(/\/series\/([^/]+)\/([^/]+)\/?$/);
            if (match) {
              const isDuplicate = allResults.find(r => r.url === fullUrl) || pageResults.find(r => r.url === fullUrl);
              if (!isDuplicate) {
                pageResults.push({
                  set: match[1],
                  number: match[2],
                  url: fullUrl,
                  name: name
                });
              }
            }
          }
        });
        
        if (pageResults.length > 0) {
          logger.debug(`[Pokemon Official] Found ${pageResults.length} results on page ${currentPage} with selector: ${selector}`);
          break; // Arrêter dès qu'on trouve des résultats
        }
      }
      
      // Si aucun résultat sur cette page, arrêter la pagination
      if (pageResults.length === 0) {
        if (currentPage === 1) {
          const htmlSample = html.replace(/\s+/g, ' ').substring(0, 2000);
          logger.warn(`[Pokemon Official] No cards found on page 1. HTML sample: ${htmlSample.substring(0, 500)}...`);
          logger.warn(`[Pokemon Official] URL was: ${pageUrl}`);
        }
        logger.debug(`[Pokemon Official] No more results found on page ${currentPage}, stopping pagination`);
        break;
      }
      
      // Ajouter les résultats de cette page
      allResults.push(...pageResults);
      
      logger.info(`[Pokemon Official] Page ${currentPage}: ${pageResults.length} cards (total: ${allResults.length}/${max})`);
      
      // Si on a atteint le max demandé ou qu'on n'a plus de résultats, arrêter
      if (allResults.length >= max) {
        logger.debug(`[Pokemon Official] Max results reached (${allResults.length}/${max})`);
        break;
      }
      
      currentPage++;
      
      // Limiter à 5 pages max pour éviter des boucles infinies
      if (currentPage > 5) {
        logger.warn(`[Pokemon Official] Max pages limit reached (5), stopping`);
        break;
      }
    }
    
    logger.info(`[Pokemon Official] Search complete: ${allResults.length} total card links from ${currentPage} page(s)`);
    
    // Limiter les résultats au max demandé
    const limitedResults = allResults.slice(0, max);
    
    const data = {
      query,
      lang: normalizedLang,
      count: limitedResults.length,
      cards: limitedResults
    };
    
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
  const { lang = 'en', forceRefresh = false } = options;
  const normalizedLang = normalizeLang(lang);
  const url = buildCardUrl(set, number, normalizedLang);
  
  try {
    logger.info(`[Pokemon Official] Fetching card details: ${set}/${number} (lang: ${normalizedLang})`);
    
    // Générer l'URL de l'image
    const imageUrl = buildCardImageUrl(set, number, normalizedLang);
    
    // Scraper la page de détails avec Puppeteer Stealth
    const { html, status } = await puppeteerStealth.stealthGet(url, {
      timeout: 20000,
      waitFor: 'domcontentloaded'
    });
    
    if (status !== 200) {
      throw new Error(`HTTP ${status} - Failed to fetch card page`);
    }
    
    const $ = cheerio.load(html);
    
    // Conteneur principal des informations
    const container = $('.content-block.full-card-information');
    
    if (container.length === 0) {
      logger.warn(`[Pokemon Official] Card details container not found for ${set}-${number}`);
      throw new Error('Card details container not found');
    }
    
    // Nom de la carte
    const name = container.find('.card-description h1').text().trim() || null;
    
    // Type de carte (ex: "Pokémon de base")
    const cardType = container.find('.card-type h2').text().trim() || null;
    
    // HP
    const hpElement = container.find('.card-hp span');
    let hp = null;
    if (hpElement.length > 0) {
      // Le HTML est: <span class="card-hp"><span>PV</span>60</span>
      const hpText = hpElement.parent().text().replace(/PV|HP/i, '').trim();
      hp = hpText ? parseInt(hpText) : null;
    }
    
    // Type d'énergie principal (icône dans .card-basic-info .right)
    const energyIcon = container.find('.card-basic-info .right i.energy');
    const energyType = energyIcon.length > 0 ? energyIcon.attr('class').replace('energy icon-', '') : null;
    
    // Attaques
    const attacks = [];
    container.find('.pokemon-abilities .ability').each((i, elem) => {
      const $ability = $(elem);
      const name = $ability.find('h4.label').text().trim();
      const damage = $ability.find('.plus').text().trim() || null;
      const description = $ability.find('pre p').text().trim() || null;
      
      // Coûts d'énergie
      const energyCosts = [];
      $ability.find('ul.left li i.energy').each((j, energyElem) => {
        const energyClass = $(energyElem).attr('class').replace('energy icon-', '');
        energyCosts.push(energyClass);
      });
      
      if (name) {
        attacks.push({
          name,
          damage,
          description,
          energyCost: energyCosts
        });
      }
    });
    
    // Stats (Faiblesse, Résistance, Coût de retraite)
    const stats = container.find('.pokemon-stats .stat');
    
    let weakness = null;
    let resistance = null;
    let retreatCost = 0;
    
    stats.each((i, elem) => {
      const $stat = $(elem);
      const title = $stat.find('h4').text().trim();
      
      if (title === 'Faiblesse') {
        const energyIcon = $stat.find('i.energy');
        const multiplier = $stat.find('.card-energies').text().trim().match(/×(\d+)/);
        if (energyIcon.length > 0) {
          weakness = {
            type: energyIcon.attr('class').replace('energy icon-', ''),
            value: multiplier ? `×${multiplier[1]}` : null
          };
        }
      } else if (title === 'Résistance') {
        const energyIcon = $stat.find('i.energy');
        const value = $stat.find('.card-energies').text().trim().match(/(-\d+)/);
        if (energyIcon.length > 0) {
          resistance = {
            type: energyIcon.attr('class').replace('energy icon-', ''),
            value: value ? value[1] : null
          };
        }
      } else if (title === 'Coût de Retraite') {
        retreatCost = $stat.find('.card-energies li').length;
      }
    });
    
    // Informations du set
    const setName = container.find('.stats-footer h3 a').text().trim() || null;
    const setNumber = container.find('.stats-footer span').text().trim() || null;
    const setSymbolUrl = container.find('.expansion i').css('background-image');
    const setSymbol = setSymbolUrl ? setSymbolUrl.replace(/^url\(["']?/, '').replace(/["']?\)$/, '') : null;
    
    // Illustrateur (dans un div séparé après pokemon-stats)
    let illustrator = null;
    const illustratorBlock = $('.illustrator, .content-block.illustrator');
    if (illustratorBlock.length > 0) {
      const illustratorLink = illustratorBlock.find('a').text().trim();
      const illustratorH4 = illustratorBlock.find('h4').text().replace(/Illustrateur\s*:\s*/i, '').trim();
      illustrator = illustratorLink || illustratorH4 || null;
    }
    
    const cardData = {
      name,
      cardType,
      hp,
      energyType,
      attacks,
      weakness,
      resistance,
      retreatCost,
      setName,
      setNumber,
      setSymbol,
      illustrator,
      imageUrl,
      set,
      number,
      url,
      lang: normalizedLang
    };
    
    logger.info(`[Pokemon Official] Card scraped: ${name || set + '-' + number} (${attacks.length} attacks)`);
    
    metrics.sources.pokemon_official = metrics.sources.pokemon_official || { requests: 0, errors: 0 };
    metrics.sources.pokemon_official.requests++;
    
    return cardData;
    
  } catch (error) {
    metrics.sources.pokemon_official = metrics.sources.pokemon_official || { requests: 0, errors: 0 };
    metrics.sources.pokemon_official.errors++;
    logger.error(`[Pokemon Official] Card details error: ${error.message}`);
    
    // Fallback: retourner données minimales
    logger.warn(`[Pokemon Official] Returning minimal data for ${set}-${number}`);
    return {
      name: null,
      imageUrl: buildCardImageUrl(set, number, normalizedLang),
      set,
      number,
      url: buildCardUrl(set, number, normalizedLang),
      lang: normalizedLang
    };
  }
}
