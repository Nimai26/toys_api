/**
 * lib/providers/bgg-scraper.js - Provider BGG par scraping web
 * 
 * Alternative au provider BGG API officiel qui nécessite un token Bearer.
 * Utilise FlareSolverr via VPN (gluetun) pour scraper les pages web BGG.
 * 
 * FONCTIONNALITÉS:
 * - Recherche via scraping avec waitInSeconds (attend le chargement JS)
 * - Détails complets des jeux
 * - Liste des manuels/règles avec détection de langue
 * 
 * AVANTAGES:
 * - Pas besoin de token API
 * - Toutes les données publiques accessibles
 * - Passe par le VPN avec kill switch
 * 
 * @module providers/bgg-scraper
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { translateText, extractLangCode, translateBoardGameCategories } from '../utils/translator.js';
import { FSR_BASE } from '../config.js';

const log = createLogger('BGG-Scraper');

// ============================================================================
// CONFIGURATION
// ============================================================================

const BGG_BASE_URL = 'https://boardgamegeek.com';
const BGG_SEARCH_URL = 'https://boardgamegeek.com/search/boardgame';
const BGG_DEFAULT_MAX = 20;
const BGG_RATE_LIMIT_MS = 2000; // 2 secondes entre requêtes (scraping = plus prudent)

// Dernière requête pour rate limiting
let lastRequestTime = 0;

// Mapping des codes langue pour la détection dans les fichiers BGG
const LANGUAGE_PATTERNS = {
  'fr': ['french', 'français', 'francais', 'fr-fr', '_fr', '(fr)', '[fr]', 'vf', '-fr-', '-fr.', 'regle', 'règle'],
  'en': ['english', 'anglais', 'en-us', 'en-gb', '_en', '(en)', '[en]', 'vo', '-en-', '-en.', 'rules', 'annotated'],
  'de': ['german', 'deutsch', 'allemand', 'de-de', '_de', '(de)', '[de]', '-de-', '-de.', 'regeln', 'spielregel'],
  'es': ['spanish', 'español', 'espagnol', 'es-es', '_es', '(es)', '[es]', '-es-', '-es.', 'reglas', 'titulo', 'instrucciones'],
  'it': ['italian', 'italiano', 'italien', 'it-it', '_it', '(it)', '[it]', '-it-', '-it.', 'regolamento', 'istruzioni'],
  'pt': ['portuguese', 'português', 'portugais', 'pt-br', 'pt-pt', '_pt', '(pt)', '[pt]', '-pt-', '-pt.', 'regras'],
  'nl': ['dutch', 'nederlands', 'néerlandais', 'nl-nl', '_nl', '(nl)', '[nl]', '-nl-', '-nl.', 'spelregels'],
  'pl': ['polish', 'polski', 'polonais', 'pl-pl', '_pl', '(pl)', '[pl]', '-pl-', '-pl.', 'regulamin', 'zasady'],
  'ru': ['russian', 'русский', 'russe', 'ru-ru', '_ru', '(ru)', '[ru]', '-ru-', '-ru.'],
  'ja': ['japanese', '日本語', 'japonais', 'ja-jp', '_ja', '(ja)', '[ja]', '-ja-', '-ja.'],
  'zh': ['chinese', '中文', 'chinois', 'zh-cn', 'zh-tw', '_zh', '(zh)', '[zh]', '-zh-', '-zh.'],
  'ko': ['korean', '한국어', 'coréen', 'ko-kr', '_ko', '(ko)', '[ko]', '-ko-', '-ko.'],
  'fi': ['finnish', 'suomi', 'finlandais', 'fi-fi', '_fi', '(fi)', '[fi]', '-fi-', 'tee-se-itse']
};

// Mots-clés pour identifier les fichiers de règles
const RULES_KEYWORDS = [
  'rules', 'rule', 'règles', 'regle', 'regles',
  'rulebook', 'livret', 'manual', 'manuel',
  'instructions', 'how to play', 'comment jouer',
  'regolamento', 'regeln', 'reglas', 'regulamin',
  'reference', 'aid', 'summary', 'cheat', 'guide'
];

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Respecte le rate limit BGG
 */
async function respectRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < BGG_RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, BGG_RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Effectue une requête via FlareSolverr
 * @param {string} url - URL à scraper
 * @param {number} timeout - Timeout en ms
 * @param {object} extraOptions - Options FlareSolverr supplémentaires (waitInSeconds, etc.)
 * @returns {Promise<string>} - HTML de la page
 */
async function fsrGet(url, timeout = 45000, extraOptions = {}) {
  log.debug(`🌐 FlareSolverr GET: ${url}`, extraOptions.waitInSeconds ? { waitInSeconds: extraOptions.waitInSeconds } : {});
  
  const response = await fetch(FSR_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cmd: 'request.get',
      url,
      maxTimeout: timeout,
      ...extraOptions
    }),
    signal: AbortSignal.timeout(timeout + (extraOptions.waitInSeconds || 0) * 1000 + 5000)
  });
  
  if (!response.ok) {
    throw new Error(`FlareSolverr HTTP error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.status !== 'ok' || !data.solution) {
    throw new Error(`FlareSolverr error: ${data.status} - ${data.message || 'pas de solution'}`);
  }
  
  return data.solution.response;
}

/**
 * Décode les entités HTML
 * @param {string} text - Texte avec entités HTML
 * @returns {string} - Texte décodé
 */
function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .trim();
}

/**
 * Détecte la langue d'un titre/description de fichier
 * @param {string} text - Texte à analyser
 * @returns {string|null} - Code langue détecté ou null
 */
function detectFileLanguage(text) {
  if (!text) return null;
  const lowerText = text.toLowerCase();
  
  for (const [langCode, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        return langCode;
      }
    }
  }
  
  return null;
}

/**
 * Vérifie si un fichier est un fichier de règles
 * @param {string} title - Titre du fichier
 * @param {string} description - Description du fichier
 * @returns {boolean}
 */
function isRulesFile(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  return RULES_KEYWORDS.some(keyword => text.includes(keyword));
}

// ============================================================================
// SCRAPING RECHERCHE
// ============================================================================

/**
 * Recherche des jeux de société par scraping de la page de recherche BGG
 * 
 * Utilise FlareSolverr avec l'option waitInSeconds pour attendre que 
 * JavaScript charge les résultats dynamiquement (React).
 * 
 * @param {string} query - Terme de recherche
 * @param {object} options - Options de recherche
 * @param {number} options.max - Nombre max de résultats (défaut: 20)
 * @param {string} options.lang - Langue cible pour les traductions (défaut: 'fr')
 * @param {boolean} options.autoTrad - Activer la traduction automatique du nom et description
 * @param {boolean} options.refresh - Forcer le rechargement sans cache
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function scrapeBGGSearch(query, options = {}) {
  const { max = BGG_DEFAULT_MAX, lang = 'fr', autoTrad = false, refresh = false } = options;
  
  if (!query || query.trim().length < 2) {
    return { results: [], total: 0, query };
  }
  
  // Clé de cache inclut autoTrad car les résultats peuvent être différents
  const cacheKey = `bgg_scrape_search_${query}_${max}_${lang}_${autoTrad}`;
  
  // Vérifier le cache sauf si refresh est demandé
  if (!refresh) {
    const cached = getCached(cacheKey);
    if (cached) {
      metrics.requests.cached++;
      return cached;
    }
  } else {
    log.debug(`🔄 Refresh forcé pour: ${query}`);
  }
  
  await respectRateLimit();
  
  try {
    // URL de recherche BGG
    const searchUrl = `${BGG_SEARCH_URL}?q=${encodeURIComponent(query)}`;
    log.debug(`🔍 Scraping recherche BGG: ${query}`, { lang, autoTrad });
    
    // Utiliser waitInSeconds=10 pour laisser le temps au JavaScript React de charger les résultats
    const html = await fsrGet(searchUrl, 120000, { waitInSeconds: 10 });
    
    const results = [];
    const seenIds = new Set();
    
    // Pattern pour extraire les lignes du tableau de résultats avec thumbnail, lien et nom
    // Structure: <td class="collection_thumbnail">...<img srcset="URL">...<a href="/boardgame/ID/slug" class="primary">NOM</a>
    const rowPattern = /<td class="collection_thumbnail">[\s\S]*?<img[^>]*src(?:set)?="([^"]+)"[\s\S]*?<a[^>]*href="\/boardgame\/(\d+)\/([^"]+)"[^>]*class="primary"[^>]*>([^<]+)<\/a>/gi;
    
    let match;
    while ((match = rowPattern.exec(html)) !== null) {
      const [fullMatch, imgSrcset, id, slug, rawName] = match;
      
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      
      // Décoder le nom depuis le HTML
      const nameOriginal = decodeHtmlEntities(rawName);
      
      // Chercher l'année et la description après le match
      const afterMatch = html.substring(match.index + fullMatch.length, match.index + fullMatch.length + 600);
      
      // Année: <span class="smallerfont dull">(ANNÉE)</span>
      const yearMatch = afterMatch.match(/<span[^>]*class="[^"]*smallerfont[^"]*"[^>]*>\s*\((\d{4})\)/i);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;
      
      // Description: <p class="smallefont dull">DESCRIPTION</p>
      const descMatch = afterMatch.match(/<p[^>]*class="[^"]*smallefont[^"]*"[^>]*>([^<]+)<\/p>/i);
      const descriptionOriginal = descMatch ? decodeHtmlEntities(descMatch[1]).trim() : null;
      
      // Extraire la meilleure URL d'image du srcset
      // srcset contient: "url1 1x, url2 2x" - on prend la première
      // NOTE: Les URLs __thumb peuvent retourner 400 sur CloudFront
      // On garde __micro ou on utilise __original qui sont plus stables
      let image = null;
      let imageProxy = null;
      if (imgSrcset) {
        const firstImg = imgSrcset.split(',')[0].trim().split(' ')[0];
        // Garder le format d'origine (micro) - c'est petit mais stable
        // Alternative: utiliser __original pour avoir l'image complète
        image = firstImg;
        // Générer l'URL du proxy pour contourner l'anti-hotlinking
        imageProxy = `/bgg_scrape/proxy?url=${encodeURIComponent(firstImg)}`;
      }
      
      if (nameOriginal.length > 1) {
        results.push({
          id,
          nameOriginal,
          name: nameOriginal, // Sera traduit si autoTrad
          year,
          descriptionOriginal,
          description: descriptionOriginal, // Sera traduit si autoTrad
          image,
          imageProxy,
          url: `${BGG_BASE_URL}/boardgame/${id}`,
          detailUrl: `/bgg_scrape/details/${id}`,
          source: 'bgg-scraper'
        });
        
        if (results.length >= max) break;
      }
    }
    
    // Si autoTrad est activé, traduire les noms et descriptions
    if (autoTrad && lang !== 'en' && results.length > 0) {
      log.debug(`🌐 Traduction auto vers ${lang} pour ${results.length} résultats...`);
      
      const destLang = extractLangCode(lang);
      
      // Traduire en parallèle pour plus de performance
      await Promise.all(results.map(async (game) => {
        try {
          // Traduire le nom
          if (game.nameOriginal) {
            const nameResult = await translateText(game.nameOriginal, destLang, { enabled: true, sourceLang: 'en' });
            if (nameResult.translated) {
              game.name = nameResult.text;
              game.nameTranslated = true;
            }
          }
          
          // Traduire la description
          if (game.descriptionOriginal) {
            const descResult = await translateText(game.descriptionOriginal, destLang, { enabled: true, sourceLang: 'en' });
            if (descResult.translated) {
              game.description = descResult.text;
              game.descriptionTranslated = true;
            }
          }
        } catch (err) {
          log.warn(`Erreur traduction pour ${game.id}: ${err.message}`);
        }
      }));
    }
    
    const result = {
      results,
      total: results.length,
      query,
      lang,
      autoTrad,
      source: 'bgg-scraper',
      method: 'web-scraping-with-js-wait'
    };
    
    setCache(cacheKey, result, 600000); // Cache 10 minutes
    log.info(`✅ ${results.length} jeux trouvés pour "${query}" (scraping avec attente JS${autoTrad ? ', traduit en ' + lang : ''})`);
    
    return result;
    
  } catch (error) {
    log.error(`❌ Erreur scraping recherche BGG: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// SCRAPING DÉTAILS
// ============================================================================

/**
 * Récupère les détails d'un jeu par scraping de la page BGG
 * @param {string|number} bggId - ID BGG du jeu
 * @param {object} options - Options (lang, autoTrad, includeManuals, refresh)
 * @returns {Promise<object>} - Détails du jeu
 */
export async function scrapeBGGDetails(bggId, options = {}) {
  const { lang = 'fr', autoTrad = false, includeManuals = true, refresh = false } = options;
  
  if (!bggId) {
    throw new Error('ID BGG requis');
  }
  
  const cacheKey = `bgg_scrape_details_${bggId}_${lang}_${autoTrad}_${includeManuals}`;
  
  // Vérifier le cache sauf si refresh est demandé
  if (!refresh) {
    const cached = getCached(cacheKey);
    if (cached) {
      metrics.requests.cached++;
      return cached;
    }
  } else {
    log.debug(`🔄 Refresh forcé pour détails: ${bggId}`);
  }
  
  await respectRateLimit();
  
  try {
    const url = `${BGG_BASE_URL}/boardgame/${bggId}`;
    log.debug(`📋 Scraping détails BGG: ${bggId}`);
    
    const html = await fsrGet(url);
    
    // Extraire le titre
    // Format: og:title ou <title>NOM (ANNÉE) | Board Game | BoardGameGeek</title>
    const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                       html.match(/<title>([^|<]+)/i);
    let name = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : null;
    let year = null;
    
    // Extraire l'année - plusieurs méthodes
    // 1. Dans le titre entre parenthèses
    const yearInTitle = name?.match(/\((\d{4})\)/);
    if (yearInTitle) {
      year = parseInt(yearInTitle[1]);
      name = name.replace(/\s*\(\d{4}\)\s*/, '').trim();
    }
    // 2. Dans le HTML comme "(ANNÉE)" standalone
    if (!year) {
      const yearStandalone = html.match(/>\s*\((\d{4})\)\s*</);
      if (yearStandalone) {
        year = parseInt(yearStandalone[1]);
      }
    }
    // 3. Dans les données JSON: "yearpublished":"2017"
    if (!year) {
      const yearJson = html.match(/"yearpublished"\s*:\s*"?(\d{4})"?/i);
      if (yearJson) {
        year = parseInt(yearJson[1]);
      }
    }
    
    // Nettoyer le nom (enlever " | BoardGameGeek" ou "| Board Game")
    if (name) {
      name = name.replace(/\s*\|.*$/i, '').trim();
    }
    
    // Extraire le nombre de joueurs
    // Format: "3–4 Players" ou JSON "minplayers":"X"
    let minPlayers = null, maxPlayers = null;
    const playersMatch = html.match(/(\d+)[–-](\d+)\s*Players/i);
    if (playersMatch) {
      minPlayers = parseInt(playersMatch[1]);
      maxPlayers = parseInt(playersMatch[2]);
    } else {
      // Format JSON: "minplayers":"1" ou "maxplayers":"4"
      const minPMatch = html.match(/"minplayers"\s*:\s*"?(\d+)"?/i);
      const maxPMatch = html.match(/"maxplayers"\s*:\s*"?(\d+)"?/i);
      if (minPMatch) minPlayers = parseInt(minPMatch[1]);
      if (maxPMatch) maxPlayers = parseInt(maxPMatch[1]);
    }
    
    // Extraire le temps de jeu
    // Format: "30 Min" ou "30–60 Min" ou JSON "minplaytime"/"maxplaytime"
    let minPlaytime = null, maxPlaytime = null;
    const timeRangeMatch = html.match(/(\d{1,3})[–-](\d{1,3})\s*Min/i);
    if (timeRangeMatch) {
      minPlaytime = parseInt(timeRangeMatch[1]);
      maxPlaytime = parseInt(timeRangeMatch[2]);
    } else {
      // Format JSON: "minplaytime":"60", "maxplaytime":"120"
      const minTimeMatch = html.match(/"minplaytime"\s*:\s*"?(\d+)"?/i);
      const maxTimeMatch = html.match(/"maxplaytime"\s*:\s*"?(\d+)"?/i);
      if (minTimeMatch) minPlaytime = parseInt(minTimeMatch[1]);
      if (maxTimeMatch) maxPlaytime = parseInt(maxTimeMatch[1]);
      
      // Fallback: "playingtime":"X" pour un temps unique
      if (!minPlaytime && !maxPlaytime) {
        const playingTimeMatch = html.match(/"playingtime"\s*:\s*"?(\d+)"?/i);
        if (playingTimeMatch) {
          minPlaytime = maxPlaytime = parseInt(playingTimeMatch[1]);
        }
      }
    }
    
    // Extraire l'âge
    // Format: "Age: X+" ou JSON "minage":"X"
    const ageMatch = html.match(/Age:\s*(\d+)\+/i) ||
                     html.match(/"minage"\s*:\s*"?(\d+)"?/i);
    const minAge = ageMatch ? parseInt(ageMatch[1]) : null;
    
    // Extraire la complexité (poids) - JSON "averageweight":X, arrondir à 2 décimales
    const weightMatch = html.match(/"averageweight"\s*:\s*"?([\d.]+)"?/i) ||
                        html.match(/Weight:\s*([\d.]+)/i);
    const complexity = weightMatch ? Math.round(parseFloat(weightMatch[1]) * 100) / 100 : null;
    
    // Extraire le rating - JSON "average":X
    const ratingMatch = html.match(/"average"\s*:\s*"?([\d.]+)"?/i) ||
                        html.match(/ratingValue.*?([\d.]+)/i);
    const rating = ratingMatch ? Math.round(parseFloat(ratingMatch[1]) * 100) / 100 : null;
    
    // Extraire le nombre de votes - JSON "usersrated":X
    const votesMatch = html.match(/"usersrated"\s*:\s*"?(\d+)"?/i) ||
                       html.match(/(\d+(?:,\d+)*)\s*Ratings/i);
    const votes = votesMatch ? parseInt(votesMatch[1].replace(/,/g, '')) : null;
    
    // Extraire la description - og:description ou JSON "description"
    let description = null;
    const descMatch = html.match(/property="og:description"[^>]*content="([^"]+)"/i);
    if (descMatch) {
      description = decodeHtmlEntities(descMatch[1]).substring(0, 2000);
    } else {
      // Essayer JSON - attention aux balises HTML dans la description
      const descJson = html.match(/"description"\s*:\s*"([^"]{20,500})/i);
      if (descJson) {
        description = decodeHtmlEntities(descJson[1].replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ')).substring(0, 2000);
      }
    }
    
    // Extraire les catégories
    const categories = [];
    const categoryMatches = html.matchAll(/href="\/boardgamecategory\/\d+\/[^"]*">([^<]+)<\/a>/gi);
    for (const m of categoryMatches) {
      categories.push(decodeHtmlEntities(m[1]));
    }
    
    // Extraire les mécanismes
    const mechanics = [];
    const mechanicMatches = html.matchAll(/href="\/boardgamemechanic\/\d+\/[^"]*">([^<]+)<\/a>/gi);
    for (const m of mechanicMatches) {
      mechanics.push(decodeHtmlEntities(m[1]));
    }
    
    // Extraire les designers
    const designers = [];
    const designerMatches = html.matchAll(/href="\/boardgamedesigner\/\d+\/[^"]*">([^<]+)<\/a>/gi);
    for (const m of designerMatches) {
      designers.push(decodeHtmlEntities(m[1]));
    }
    
    // Extraire les éditeurs
    const publishers = [];
    const publisherMatches = html.matchAll(/href="\/boardgamepublisher\/\d+\/[^"]*">([^<]+)<\/a>/gi);
    for (const m of publisherMatches) {
      if (publishers.length < 5) { // Limiter à 5 éditeurs
        publishers.push(decodeHtmlEntities(m[1]));
      }
    }
    
    // Extraire l'image
    const imageMatch = html.match(/property="og:image"[^>]*content="([^"]+)"/i) ||
                       html.match(/class="game-header-image"[^>]*src="([^"]+)"/i);
    const image = imageMatch ? imageMatch[1] : null;
    const imageProxy = image ? `/bgg_scrape/proxy?url=${encodeURIComponent(image)}` : null;
    
    // Extraire le rank
    const rankMatch = html.match(/OVERALL[^>]*>.*?(\d+)/i) ||
                      html.match(/Board Game Rank[^>]*>.*?(\d+)/i);
    const rank = rankMatch ? parseInt(rankMatch[1]) : null;
    
    // Préparer le résultat de base
    let result = {
      id: bggId.toString(),
      name,
      year,
      description,
      minPlayers,
      maxPlayers,
      minPlaytime,
      maxPlaytime,
      minAge,
      complexity,
      rating,
      votes,
      rank,
      categories: [...new Set(categories)].slice(0, 10),
      mechanics: [...new Set(mechanics)].slice(0, 15),
      designers: [...new Set(designers)].slice(0, 5),
      publishers: [...new Set(publishers)],
      image,
      imageProxy,
      url: `${BGG_BASE_URL}/boardgame/${bggId}`,
      detailUrl: `/bgg_scrape/details/${bggId}`,
      source: 'bgg-scraper',
      method: 'web-scraping'
    };
    
    // Optionnel: inclure les manuels
    if (includeManuals) {
      try {
        const manualsResult = await scrapeBGGManuals(bggId, lang);
        result.manuals = manualsResult.manuals || [];
        result.bestManual = manualsResult.bestManual || null;
      } catch (manualError) {
        log.warn(`⚠️ Impossible de récupérer les manuels: ${manualError.message}`);
        result.manuals = [];
        result.bestManual = null;
      }
    }
    
    // Traduction automatique si demandée
    if (autoTrad && lang !== 'en') {
      const destLang = extractLangCode(lang);
      
      // Traduire le nom du jeu
      if (name) {
        try {
          const nameResult = await translateText(name, destLang, { enabled: true, sourceLang: 'en' });
          if (nameResult && nameResult.translated && nameResult.text) {
            result.nameOriginal = name;
            result.name = nameResult.text;
            result.nameTranslated = true;
          }
        } catch (tradError) {
          log.warn(`⚠️ Traduction nom échouée: ${tradError.message}`);
        }
      }
      
      // Traduire la description
      if (description) {
        try {
          const translationResult = await translateText(description, destLang, { enabled: true, sourceLang: 'en' });
          if (translationResult && translationResult.translated && translationResult.text) {
            result.descriptionOriginal = description;
            result.description = translationResult.text;
            result.descriptionTranslated = true;
          }
        } catch (tradError) {
          log.warn(`⚠️ Traduction description échouée: ${tradError.message}`);
        }
      }
      
      // Traduire les catégories (termsTranslated est le bon champ retourné par translateBoardGameCategories)
      if (result.categories && result.categories.length > 0) {
        try {
          const catResult = await translateBoardGameCategories(result.categories, destLang);
          if (catResult && catResult.termsTranslated) {
            result.categoriesOriginal = catResult.termsOriginal || result.categories;
            result.categories = catResult.terms;
            result.categoriesTranslated = true;
          }
        } catch (tradError) {
          log.warn(`⚠️ Traduction catégories échouée: ${tradError.message}`);
        }
      }
      
      // Traduire les mécaniques
      if (result.mechanics && result.mechanics.length > 0) {
        try {
          const mechResult = await translateBoardGameCategories(result.mechanics, destLang);
          if (mechResult && mechResult.termsTranslated) {
            result.mechanicsOriginal = mechResult.termsOriginal || result.mechanics;
            result.mechanics = mechResult.terms;
            result.mechanicsTranslated = true;
          }
        } catch (tradError) {
          log.warn(`⚠️ Traduction mécaniques échouée: ${tradError.message}`);
        }
      }
    }
    
    setCache(cacheKey, result, 1800000); // Cache 30 minutes
    log.info(`✅ Détails scrapés pour ${name} (${bggId})`);
    
    return result;
    
  } catch (error) {
    log.error(`❌ Erreur scraping détails BGG: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// SCRAPING MANUELS/FICHIERS
// ============================================================================

/**
 * Récupère les manuels/fichiers de règles d'un jeu par scraping
 * @param {string|number} bggId - ID BGG du jeu
 * @param {string} preferredLang - Langue préférée
 * @param {object} options - Options (refresh)
 * @returns {Promise<object>} - Liste des manuels avec le meilleur
 */
export async function scrapeBGGManuals(bggId, preferredLang = 'fr', options = {}) {
  const { refresh = false } = options;
  
  if (!bggId) {
    throw new Error('ID BGG requis');
  }
  
  const cacheKey = `bgg_scrape_manuals_${bggId}_${preferredLang}`;
  
  // Vérifier le cache sauf si refresh est demandé
  if (!refresh) {
    const cached = getCached(cacheKey);
    if (cached) {
      metrics.requests.cached++;
      return cached;
    }
  } else {
    log.debug(`🔄 Refresh forcé pour manuels: ${bggId}`);
  }
  
  await respectRateLimit();
  
  try {
    const url = `${BGG_BASE_URL}/boardgame/${bggId}/files`;
    log.debug(`📁 Scraping fichiers BGG: ${bggId}`);
    
    const html = await fsrGet(url);
    
    const files = [];
    
    // Pattern pour extraire les fichiers depuis les liens
    // Format: <a href="/filepage/XXXXX/slug-du-fichier">
    // On extrait l'ID et le slug de l'URL
    const filePattern = /href="(\/filepage\/(\d+)\/([^"]+))"/gi;
    
    let match;
    const seenIds = new Set();
    
    while ((match = filePattern.exec(html)) !== null) {
      const [fullMatch, path, fileId, slug] = match;
      
      if (seenIds.has(fileId)) continue;
      seenIds.add(fileId);
      
      // Extraire le titre depuis le slug de l'URL
      // Exemple: "klaus2playerpdf" -> "Klaus 2 Player"
      // Exemple: "the-settlers-of-catan-completely-annotated-rules-a" -> "The Settlers of Catan Completely Annotated Rules"
      let title = slug
        .replace(/-/g, ' ')
        .replace(/\.(pdf|doc|docx|zip|rar|txt|jpg|png)$/i, '')
        .replace(/pdf$/i, '')
        .replace(/([a-z])(\d)/gi, '$1 $2')  // "klaus2player" -> "klaus 2 player"
        .replace(/(\d)([a-z])/gi, '$1 $2')  // Séparer chiffres et lettres
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .trim();
      
      // Chercher un titre plus complet dans le contexte HTML
      // Le titre peut être dans un élément proche
      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(html.length, match.index + fullMatch.length + 200);
      const context = html.substring(contextStart, contextEnd);
      
      // Pattern pour trouver le texte du lien
      const linkTextMatch = context.match(new RegExp(`href="${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([^<]+)<`, 'i'));
      if (linkTextMatch && linkTextMatch[1].trim().length > 3) {
        const capturedTitle = decodeHtmlEntities(linkTextMatch[1].trim());
        // Utiliser le titre capturé seulement si ce n'est pas juste "PDF" ou "JPG"
        if (capturedTitle.toLowerCase() !== 'pdf' && capturedTitle.toLowerCase() !== 'jpg' && capturedTitle.length > title.length * 0.5) {
          title = capturedTitle;
        }
      }
      
      // Déterminer le type de fichier depuis le slug ou le contexte
      let fileType = 'PDF';
      const typeMatch = slug.match(/\.(pdf|doc|docx|zip|rar|txt|jpg|png)$/i) ||
                        context.match(/\[(PDF|DOC|DOCX|ZIP|RAR|JPG)\]/i);
      if (typeMatch) {
        fileType = typeMatch[1].toUpperCase();
      }
      
      // Détecter la langue depuis le titre
      const language = detectFileLanguage(title) || detectFileLanguage(slug);
      
      // Vérifier si c'est un fichier de règles
      const isRules = isRulesFile(title, slug);
      
      // Extraire le nombre de thumbs up si disponible
      const thumbsMatch = context.match(/(\d+)\s*<\/span>/);
      const thumbs = thumbsMatch ? parseInt(thumbsMatch[1]) : 0;
      
      files.push({
        id: fileId,
        title,
        url: `${BGG_BASE_URL}${path}`,
        urlProxy: `/bgg_scrape/proxy?url=${encodeURIComponent(`${BGG_BASE_URL}${path}`)}`,
        downloadUrl: `${BGG_BASE_URL}/file/download/${fileId}`,
        downloadUrlProxy: `/bgg_scrape/proxy?url=${encodeURIComponent(`${BGG_BASE_URL}/file/download/${fileId}`)}`,
        type: fileType,
        language,
        isRules,
        thumbs
      });
    }
    
    // Filtrer pour garder uniquement les fichiers de règles (PDF principalement)
    const rulesFiles = files.filter(f => f.isRules || f.type === 'PDF');
    
    // Trier: langue préférée > anglais > thumbs
    const sortedManuals = rulesFiles.sort((a, b) => {
      // Priorité 1: Langue préférée
      if (a.language === preferredLang && b.language !== preferredLang) return -1;
      if (b.language === preferredLang && a.language !== preferredLang) return 1;
      
      // Priorité 2: Anglais
      if (a.language === 'en' && b.language !== 'en') return -1;
      if (b.language === 'en' && a.language !== 'en') return 1;
      
      // Priorité 3: Est un fichier de règles
      if (a.isRules && !b.isRules) return -1;
      if (b.isRules && !a.isRules) return 1;
      
      // Priorité 4: Nombre de thumbs
      return (b.thumbs || 0) - (a.thumbs || 0);
    });
    
    const result = {
      gameId: bggId,
      manuals: sortedManuals,
      allFiles: files,
      total: sortedManuals.length,
      totalAllFiles: files.length,
      bestManual: sortedManuals[0] || null,
      preferredLang,
      source: 'bgg-scraper',
      method: 'web-scraping'
    };
    
    setCache(cacheKey, result, 1800000); // Cache 30 minutes
    log.info(`✅ ${sortedManuals.length} manuels trouvés pour jeu ${bggId}`);
    
    return result;
    
  } catch (error) {
    log.error(`❌ Erreur scraping fichiers BGG: ${error.message}`);
    return {
      gameId: bggId,
      manuals: [],
      allFiles: [],
      total: 0,
      totalAllFiles: 0,
      bestManual: null,
      preferredLang,
      error: error.message,
      source: 'bgg-scraper'
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  BGG_BASE_URL,
  BGG_DEFAULT_MAX
};
