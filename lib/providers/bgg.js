/**
 * lib/providers/bgg.js - Provider BoardGameGeek
 * 
 * API XML BGG pour les jeux de société + scraping Files pour les règles/manuels
 * Nécessite un token Bearer BGG (inscription requise sur https://boardgamegeek.com/applications)
 * 
 * @module providers/bgg
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { translateText, extractLangCode } from '../utils/translator.js';
import { FSR_BASE, USER_AGENT } from '../config.js';
import { fetchViaProxy } from '../utils/fetch-proxy.js';

const log = createLogger('BGG');

// ============================================================================
// CONFIGURATION BGG
// ============================================================================

const BGG_API_URL = 'https://boardgamegeek.com/xmlapi2';
const BGG_BASE_URL = 'https://boardgamegeek.com';
const BGG_DEFAULT_MAX = 20;
const BGG_RATE_LIMIT_MS = 1000; // 1 seconde entre requêtes (BGG recommande 5s mais 1s suffit)

// Token BGG pour les tests/healthcheck uniquement (variable d'env)
// En production, le token est passé crypté via X-Encrypted-Key
const TEST_BGG_TOKEN = process.env.TEST_BGG_TOKEN || null;

// Dernière requête pour rate limiting
let lastRequestTime = 0;

// Mapping des codes langue pour la détection dans les fichiers BGG
const LANGUAGE_PATTERNS = {
  'fr': ['french', 'français', 'francais', 'fr-fr', '_fr', '(fr)', '[fr]', 'vf'],
  'en': ['english', 'anglais', 'en-us', 'en-gb', '_en', '(en)', '[en]', 'vo'],
  'de': ['german', 'deutsch', 'allemand', 'de-de', '_de', '(de)', '[de]'],
  'es': ['spanish', 'español', 'espagnol', 'es-es', '_es', '(es)', '[es]'],
  'it': ['italian', 'italiano', 'italien', 'it-it', '_it', '(it)', '[it]'],
  'pt': ['portuguese', 'português', 'portugais', 'pt-br', 'pt-pt', '_pt', '(pt)', '[pt]'],
  'nl': ['dutch', 'nederlands', 'néerlandais', 'nl-nl', '_nl', '(nl)', '[nl]'],
  'pl': ['polish', 'polski', 'polonais', 'pl-pl', '_pl', '(pl)', '[pl]'],
  'ru': ['russian', 'русский', 'russe', 'ru-ru', '_ru', '(ru)', '[ru]'],
  'ja': ['japanese', '日本語', 'japonais', 'ja-jp', '_ja', '(ja)', '[ja]'],
  'zh': ['chinese', '中文', 'chinois', 'zh-cn', 'zh-tw', '_zh', '(zh)', '[zh]'],
  'ko': ['korean', '한국어', 'coréen', 'ko-kr', '_ko', '(ko)', '[ko]']
};

// Mots-clés pour identifier les fichiers de règles
const RULES_KEYWORDS = [
  'rules', 'rule', 'règles', 'regle', 'regles',
  'rulebook', 'livret', 'manual', 'manuel',
  'instructions', 'how to play', 'comment jouer',
  'regolamento', 'regeln', 'reglas', 'regulamin'
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
 * Parse XML simple (sans dépendance externe)
 * @param {string} xml - Contenu XML
 * @returns {object} - Objet parsé basique
 */
function parseXML(xml) {
  // Helper pour extraire le contenu d'une balise
  const getTagContent = (str, tag) => {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    const matches = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
      matches.push(match[1].trim());
    }
    return matches;
  };
  
  // Helper pour extraire un attribut
  const getAttribute = (str, attr) => {
    const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
    const match = str.match(regex);
    return match ? match[1] : null;
  };
  
  // Helper pour extraire une balise avec ses attributs
  const getTagWithAttrs = (str, tag) => {
    const regex = new RegExp(`<${tag}([^>]*)>([\\s\\S]*?)<\\/${tag}>|<${tag}([^>]*?)\\/>`, 'gi');
    const results = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
      const attrs = match[1] || match[3] || '';
      const content = match[2] || '';
      results.push({ attrs, content: content.trim() });
    }
    return results;
  };
  
  return { getTagContent, getAttribute, getTagWithAttrs };
}

/**
 * Détecte la langue d'un titre/description de fichier
 * @param {string} text - Texte à analyser (titre, description)
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
// API BGG XML
// ============================================================================

/**
 * Construit les headers pour les requêtes BGG API
 * @param {string|null} token - Token Bearer BGG (optionnel, utilise TEST_BGG_TOKEN si non fourni)
 * @returns {object} - Headers HTTP
 */
function buildBGGHeaders(token = null) {
  const effectiveToken = token || TEST_BGG_TOKEN;
  const headers = { 'User-Agent': USER_AGENT };
  
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken}`;
  }
  
  return headers;
}

/**
 * Recherche des jeux de société sur BGG
 * @param {string} query - Terme de recherche
 * @param {string|null} token - Token Bearer BGG (optionnel)
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchBGGGames(query, token = null, options = {}) {
  const { max = BGG_DEFAULT_MAX, lang = 'fr' } = options;
  
  if (!query || query.trim().length < 2) {
    return { results: [], total: 0, query };
  }
  
  const cacheKey = `bgg_search_${query}_${max}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }
  
  await respectRateLimit();
  
  try {
    const url = `${BGG_API_URL}/search?query=${encodeURIComponent(query)}&type=boardgame`;
    log.debug(`🔍 Recherche BGG: ${query}`);
    
    const response = await fetchViaProxy(url, {
      headers: buildBGGHeaders(token),
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('BGG API: Token Bearer requis ou invalide. Voir https://boardgamegeek.com/applications');
      }
      throw new Error(`BGG API error: ${response.status}`);
    }
    
    const xml = await response.text();
    const parser = parseXML(xml);
    
    // Extraire les items
    const items = parser.getTagWithAttrs(xml, 'item');
    const results = [];
    
    for (const item of items.slice(0, max)) {
      const id = parser.getAttribute(item.attrs, 'id');
      const type = parser.getAttribute(item.attrs, 'type');
      
      // Extraire le nom (premier <name> avec type="primary")
      const nameMatches = item.content.match(/<name[^>]*value="([^"]*)"[^>]*>/gi);
      let name = '';
      if (nameMatches && nameMatches.length > 0) {
        const primaryMatch = nameMatches.find(m => m.includes('type="primary"'));
        const matchToUse = primaryMatch || nameMatches[0];
        const valueMatch = matchToUse.match(/value="([^"]*)"/);
        if (valueMatch) name = valueMatch[1];
      }
      
      // Extraire l'année
      const yearMatch = item.content.match(/<yearpublished[^>]*value="([^"]*)"/i);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;
      
      if (id && name) {
        results.push({
          id,
          type,
          name,
          year,
          url: `${BGG_BASE_URL}/boardgame/${id}`
        });
      }
    }
    
    const result = {
      results,
      total: items.length,
      query,
      source: 'boardgamegeek'
    };
    
    setCache(cacheKey, result);
    log.info(`✅ ${results.length} jeux trouvés pour "${query}"`);
    
    return result;
    
  } catch (error) {
    log.error(`❌ Erreur recherche BGG: ${error.message}`);
    throw error;
  }
}

/**
 * Récupère les détails d'un jeu BGG
 * @param {string|number} bggId - ID BGG du jeu
 * @param {string|null} token - Token Bearer BGG (optionnel)
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails du jeu
 */
export async function getBGGGameDetails(bggId, token = null, options = {}) {
  const { lang = 'fr', autoTrad = false } = options;
  
  if (!bggId) {
    throw new Error('ID BGG requis');
  }
  
  const cacheKey = `bgg_details_${bggId}_${lang}_${autoTrad}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }
  
  await respectRateLimit();
  
  try {
    const url = `${BGG_API_URL}/thing?id=${bggId}&stats=1`;
    log.debug(`📋 Détails BGG: ${bggId}`);
    
    const response = await fetchViaProxy(url, {
      headers: buildBGGHeaders(token),
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('BGG API: Token Bearer requis ou invalide. Voir https://boardgamegeek.com/applications');
      }
      throw new Error(`BGG API error: ${response.status}`);
    }
    
    const xml = await response.text();
    
    // Vérifier si le jeu existe
    if (xml.includes('<items total="0"') || !xml.includes('<item')) {
      return null;
    }
    
    const parser = parseXML(xml);
    
    // Extraire les informations de base
    const itemMatch = xml.match(/<item[^>]*type="([^"]*)"[^>]*id="([^"]*)"/);
    const type = itemMatch ? itemMatch[1] : 'boardgame';
    const id = itemMatch ? itemMatch[2] : bggId;
    
    // Nom principal
    const primaryNameMatch = xml.match(/<name[^>]*type="primary"[^>]*value="([^"]*)"/);
    const name = primaryNameMatch ? primaryNameMatch[1] : '';
    
    // Noms alternatifs
    const altNames = [];
    const altNameMatches = xml.matchAll(/<name[^>]*type="alternate"[^>]*value="([^"]*)"/g);
    for (const m of altNameMatches) {
      altNames.push(m[1]);
    }
    
    // Description
    const descMatch = xml.match(/<description>([^<]*)<\/description>/);
    let description = descMatch ? descMatch[1] : '';
    // Décoder les entités HTML
    description = description
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#10;/g, '\n')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"');
    
    // Année
    const yearMatch = xml.match(/<yearpublished[^>]*value="([^"]*)"/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;
    
    // Joueurs
    const minPlayersMatch = xml.match(/<minplayers[^>]*value="([^"]*)"/);
    const maxPlayersMatch = xml.match(/<maxplayers[^>]*value="([^"]*)"/);
    const minPlayers = minPlayersMatch ? parseInt(minPlayersMatch[1]) : null;
    const maxPlayers = maxPlayersMatch ? parseInt(maxPlayersMatch[1]) : null;
    
    // Temps de jeu
    const minPlaytimeMatch = xml.match(/<minplaytime[^>]*value="([^"]*)"/);
    const maxPlaytimeMatch = xml.match(/<maxplaytime[^>]*value="([^"]*)"/);
    const playingTimeMatch = xml.match(/<playingtime[^>]*value="([^"]*)"/);
    const minPlaytime = minPlaytimeMatch ? parseInt(minPlaytimeMatch[1]) : null;
    const maxPlaytime = maxPlaytimeMatch ? parseInt(maxPlaytimeMatch[1]) : null;
    const playingTime = playingTimeMatch ? parseInt(playingTimeMatch[1]) : null;
    
    // Âge minimum
    const minAgeMatch = xml.match(/<minage[^>]*value="([^"]*)"/);
    const minAge = minAgeMatch ? parseInt(minAgeMatch[1]) : null;
    
    // Image
    const imageMatch = xml.match(/<image>([^<]*)<\/image>/);
    const thumbnailMatch = xml.match(/<thumbnail>([^<]*)<\/thumbnail>/);
    const image = imageMatch ? imageMatch[1] : null;
    const thumbnail = thumbnailMatch ? thumbnailMatch[1] : null;
    
    // Statistiques
    const avgRatingMatch = xml.match(/<average[^>]*value="([^"]*)"/);
    const numRatingsMatch = xml.match(/<usersrated[^>]*value="([^"]*)"/);
    const rankMatch = xml.match(/<rank[^>]*type="subtype"[^>]*name="boardgame"[^>]*value="([^"]*)"/);
    const weightMatch = xml.match(/<averageweight[^>]*value="([^"]*)"/);
    
    const rating = avgRatingMatch ? parseFloat(avgRatingMatch[1]) : null;
    const numRatings = numRatingsMatch ? parseInt(numRatingsMatch[1]) : null;
    const rank = rankMatch && rankMatch[1] !== 'Not Ranked' ? parseInt(rankMatch[1]) : null;
    const complexity = weightMatch ? parseFloat(weightMatch[1]) : null;
    
    // Catégories et mécaniques
    const categories = [];
    const categoryMatches = xml.matchAll(/<link[^>]*type="boardgamecategory"[^>]*value="([^"]*)"/g);
    for (const m of categoryMatches) {
      categories.push(m[1]);
    }
    
    const mechanics = [];
    const mechanicMatches = xml.matchAll(/<link[^>]*type="boardgamemechanic"[^>]*value="([^"]*)"/g);
    for (const m of mechanicMatches) {
      mechanics.push(m[1]);
    }
    
    // Designers et éditeurs
    const designers = [];
    const designerMatches = xml.matchAll(/<link[^>]*type="boardgamedesigner"[^>]*value="([^"]*)"/g);
    for (const m of designerMatches) {
      designers.push(m[1]);
    }
    
    const publishers = [];
    const publisherMatches = xml.matchAll(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]*)"/g);
    for (const m of publisherMatches) {
      publishers.push(m[1]);
    }
    
    // Artists
    const artists = [];
    const artistMatches = xml.matchAll(/<link[^>]*type="boardgameartist"[^>]*value="([^"]*)"/g);
    for (const m of artistMatches) {
      artists.push(m[1]);
    }
    
    // Construire le résultat
    let result = {
      id,
      type,
      name,
      alternateNames: altNames.length > 0 ? altNames : undefined,
      description,
      year,
      players: {
        min: minPlayers,
        max: maxPlayers
      },
      playTime: {
        min: minPlaytime,
        max: maxPlaytime,
        average: playingTime
      },
      minAge,
      image,
      thumbnail,
      stats: {
        rating: rating ? Math.round(rating * 10) / 10 : null,
        numRatings,
        rank,
        complexity: complexity ? Math.round(complexity * 100) / 100 : null
      },
      categories,
      mechanics,
      designers,
      artists,
      publishers,
      url: `${BGG_BASE_URL}/boardgame/${id}`,
      source: 'boardgamegeek'
    };
    
    // Traduction de la description si demandée
    const targetLang = extractLangCode(lang);
    if (autoTrad && description && targetLang !== 'en') {
      const translated = await translateText(description, targetLang, {
        enabled: true,
        sourceLang: 'en'
      });
      
      if (translated.translated) {
        result.descriptionOriginal = description;
        result.description = translated.text;
        result._translations = {
          description: { from: 'en', to: targetLang }
        };
      }
    }
    
    setCache(cacheKey, result);
    log.info(`✅ Détails récupérés pour ${name} (${id})`);
    
    return result;
    
  } catch (error) {
    log.error(`❌ Erreur détails BGG: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// SCRAPING FILES BGG
// ============================================================================

/**
 * Récupère la liste des fichiers (règles) d'un jeu BGG
 * Nécessite FlareSolverr pour contourner Cloudflare
 * @param {string|number} bggId - ID BGG du jeu
 * @returns {Promise<object[]>} - Liste des fichiers
 */
export async function getBGGGameFiles(bggId) {
  if (!bggId) {
    throw new Error('ID BGG requis');
  }
  
  const cacheKey = `bgg_files_${bggId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }
  
  try {
    const url = `${BGG_BASE_URL}/boardgame/${bggId}/files`;
    log.debug(`📁 Récupération fichiers BGG: ${bggId}`);
    
    // Utiliser FlareSolverr
    const fsrResponse = await fetch(FSR_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'request.get',
        url,
        maxTimeout: 30000
      }),
      signal: AbortSignal.timeout(35000)
    });
    
    if (!fsrResponse.ok) {
      throw new Error(`FlareSolverr error: ${fsrResponse.status}`);
    }
    
    const fsrData = await fsrResponse.json();
    
    if (fsrData.status !== 'ok' || !fsrData.solution) {
      throw new Error('FlareSolverr: pas de solution');
    }
    
    const html = fsrData.solution.response;
    const files = [];
    
    // Pattern pour extraire les fichiers
    // Format: <a href="/filepage/XXXXX/...">Title</a>
    const filePagePattern = /<a[^>]*href="(\/filepage\/(\d+)\/[^"]*)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = filePagePattern.exec(html)) !== null) {
      const [, path, fileId, title] = match;
      
      // Extraire le type de fichier (PDF, DOC, etc.)
      const typeMatch = title.match(/\.(pdf|doc|docx|zip|rar)$/i) || 
                        html.substring(match.index, match.index + 500).match(/\[(PDF|DOC|DOCX|ZIP)\]/i);
      const fileType = typeMatch ? typeMatch[1].toUpperCase() : 'PDF';
      
      // Détection de langue depuis le titre
      const language = detectFileLanguage(title);
      
      // Vérifier si c'est un fichier de règles
      const isRules = isRulesFile(title, '');
      
      files.push({
        id: fileId,
        title: title.trim(),
        url: `${BGG_BASE_URL}${path}`,
        type: fileType,
        language,
        isRules
      });
    }
    
    // Dédupliquer par ID
    const uniqueFiles = [...new Map(files.map(f => [f.id, f])).values()];
    
    const result = {
      gameId: bggId,
      files: uniqueFiles,
      total: uniqueFiles.length,
      source: 'boardgamegeek'
    };
    
    setCache(cacheKey, result);
    log.info(`✅ ${uniqueFiles.length} fichiers trouvés pour jeu ${bggId}`);
    
    return result;
    
  } catch (error) {
    log.error(`❌ Erreur fichiers BGG: ${error.message}`);
    // Retourner un résultat vide plutôt qu'une erreur
    return {
      gameId: bggId,
      files: [],
      total: 0,
      error: error.message,
      source: 'boardgamegeek'
    };
  }
}

/**
 * Récupère l'URL de téléchargement d'un fichier BGG
 * @param {string|number} fileId - ID du fichier
 * @returns {Promise<string|null>} - URL de téléchargement S3
 */
export async function getBGGFileDownloadUrl(fileId) {
  if (!fileId) return null;
  
  try {
    const url = `${BGG_BASE_URL}/filepage/${fileId}`;
    log.debug(`🔗 Récupération URL téléchargement: ${fileId}`);
    
    // Utiliser FlareSolverr
    const fsrResponse = await fetch(FSR_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'request.get',
        url,
        maxTimeout: 30000
      }),
      signal: AbortSignal.timeout(35000)
    });
    
    if (!fsrResponse.ok) return null;
    
    const fsrData = await fsrResponse.json();
    if (fsrData.status !== 'ok' || !fsrData.solution) return null;
    
    const html = fsrData.solution.response;
    
    // Chercher le lien de téléchargement S3
    // Pattern: href="https://s3-xxx.amazonaws.com/..."
    const s3Match = html.match(/href="(https:\/\/[^"]*amazonaws\.com[^"]*)"/i);
    if (s3Match) {
      return s3Match[1];
    }
    
    // Alternative: chercher un lien de téléchargement direct
    const downloadMatch = html.match(/href="([^"]*\/file\/download[^"]*)"/i);
    if (downloadMatch) {
      return `${BGG_BASE_URL}${downloadMatch[1]}`;
    }
    
    return null;
    
  } catch (error) {
    log.error(`❌ Erreur URL téléchargement: ${error.message}`);
    return null;
  }
}

/**
 * Récupère le meilleur manuel disponible pour un jeu
 * Préférence: langue demandée > anglais > premier fichier de règles
 * @param {string|number} bggId - ID BGG du jeu
 * @param {string} lang - Langue préférée (fr, en, de, etc.)
 * @returns {Promise<object|null>} - Manuel avec URL de téléchargement
 */
export async function getBGGManual(bggId, lang = 'fr') {
  if (!bggId) {
    throw new Error('ID BGG requis');
  }
  
  const targetLang = extractLangCode(lang);
  const cacheKey = `bgg_manual_${bggId}_${targetLang}`;
  const cached = getCached(cacheKey);
  if (cached) {
    metrics.requests.cached++;
    return cached;
  }
  
  try {
    // Récupérer tous les fichiers
    const filesResult = await getBGGGameFiles(bggId);
    
    if (!filesResult.files || filesResult.files.length === 0) {
      return null;
    }
    
    // Filtrer les fichiers de règles uniquement
    let rulesFiles = filesResult.files.filter(f => f.isRules);
    
    // Si aucun fichier de règles identifié, prendre tous les PDFs
    if (rulesFiles.length === 0) {
      rulesFiles = filesResult.files.filter(f => f.type === 'PDF');
    }
    
    if (rulesFiles.length === 0) {
      return null;
    }
    
    // Trier par préférence de langue
    const sortedFiles = rulesFiles.sort((a, b) => {
      // 1. Langue demandée en premier
      if (a.language === targetLang && b.language !== targetLang) return -1;
      if (b.language === targetLang && a.language !== targetLang) return 1;
      
      // 2. Anglais en fallback
      if (a.language === 'en' && b.language !== 'en') return -1;
      if (b.language === 'en' && a.language !== 'en') return 1;
      
      // 3. Fichiers avec langue détectée avant ceux sans
      if (a.language && !b.language) return -1;
      if (b.language && !a.language) return 1;
      
      return 0;
    });
    
    // Prendre le meilleur fichier
    const bestFile = sortedFiles[0];
    
    // Récupérer l'URL de téléchargement
    const downloadUrl = await getBGGFileDownloadUrl(bestFile.id);
    
    const result = {
      gameId: bggId,
      file: {
        id: bestFile.id,
        title: bestFile.title,
        pageUrl: bestFile.url,
        downloadUrl,
        type: bestFile.type,
        language: bestFile.language || 'unknown',
        languageRequested: targetLang,
        isExactMatch: bestFile.language === targetLang
      },
      alternativesCount: rulesFiles.length - 1,
      source: 'boardgamegeek'
    };
    
    setCache(cacheKey, result);
    log.info(`✅ Manuel trouvé: ${bestFile.title} (${bestFile.language || 'unknown'})`);
    
    return result;
    
  } catch (error) {
    log.error(`❌ Erreur récupération manuel: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  BGG_API_URL,
  BGG_BASE_URL,
  BGG_DEFAULT_MAX,
  LANGUAGE_PATTERNS,
  RULES_KEYWORDS
};
