/**
 * lib/providers/consolevariations.js - Provider Console Variations
 * 
 * Base de données des variations de consoles de jeux
 * Nécessite FlareSolverr pour le scraping
 * 
 * @module providers/consolevariations
 */

import { getCached, setCache } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { translateText, extractLangCode } from '../utils/translator.js';
import { decodeHtmlEntities } from '../utils/helpers.js';
import {
  CONSOLEVARIATIONS_BASE_URL,
  CONSOLEVARIATIONS_DEFAULT_MAX,
  MAX_RETRIES
} from '../config.js';
import {
  ensureFsrSession,
  destroyFsrSession,
  fsrRequest,
  getFsrSessionId,
  cleanupFsrSession
} from '../utils/flaresolverr.js';
import {
  normalizeConsoleVariationsSearch,
  normalizeConsoleVariationsDetail,
  normalizeConsoleVariationsPlatforms,
  normalizeConsoleVariationsBrowse
} from '../normalizers/console.js';

const log = createLogger('ConsoleVariations');

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur ConsoleVariations.com
 * @param {string} query - Terme de recherche
 * @param {number} maxResults - Nombre max de résultats
 * @param {string} type - Type de filtre (all, consoles, controllers, accessories)
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchConsoleVariations(query, maxResults = CONSOLEVARIATIONS_DEFAULT_MAX, type = 'all', retries = MAX_RETRIES) {
  const cacheKey = `consolevariations:search:${query}:${maxResults}:${type}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    log.debug(`Recherche "${query}" type=${type} (tentative ${attempt}/${retries})`);
    
    try {
      await ensureFsrSession();
      
      let searchUrl = `${CONSOLEVARIATIONS_BASE_URL}/database?search=${encodeURIComponent(query)}`;
      if (type === 'consoles') {
        searchUrl += '&filters[type][0]=1';
      } else if (type === 'controllers') {
        searchUrl += '&filters[type][0]=3';
      } else if (type === 'accessories') {
        searchUrl += '&filters[type][0]=4';
      }
      
      log.debug(`Accès à ${searchUrl}`);
      const response = await fsrRequest("request.get", searchUrl, {
        waitInSeconds: 3
      }, 60000);
      
      if (!response || !response.response) {
        throw new Error("Pas de réponse FlareSolverr");
      }
      
      const html = response.response;
      const results = [];
      const seenNames = new Set();
      
      const imgPattern = /alt="([^"]{10,})" src="(https:\/\/cdn\.consolevariations\.com\/\d+\/[^"]+)"/gi;
      const itemCandidates = [];
      let imgMatch;
      
      while ((imgMatch = imgPattern.exec(html)) !== null) {
        const name = decodeHtmlEntities(imgMatch[1].trim());
        const thumbnail = imgMatch[2];
        
        if (name.toLowerCase().includes('consolevariations') || name.length < 10) {
          continue;
        }
        
        const imgPos = imgMatch.index;
        const contextStart = Math.max(0, imgPos - 1500);
        const contextEnd = Math.min(html.length, imgPos + 1500);
        const context = html.substring(contextStart, contextEnd);
        
        const slugPattern = /href="(?:https?:\/\/consolevariations\.com)?\/collectibles\/([a-z0-9][a-z0-9-]+[a-z0-9])"/gi;
        let slugMatch;
        let foundSlug = null;
        
        while ((slugMatch = slugPattern.exec(context)) !== null) {
          const candidateSlug = slugMatch[1];
          if (candidateSlug !== 'compare' && candidateSlug.length > 5) {
            foundSlug = candidateSlug;
            break;
          }
        }
        
        if (foundSlug && !seenNames.has(name)) {
          seenNames.add(name);
          itemCandidates.push({ name, thumbnail, slug: foundSlug });
        }
      }
      
      const seenSlugs = new Set();
      for (const item of itemCandidates) {
        if (results.length >= maxResults) break;
        if (seenSlugs.has(item.slug)) continue;
        seenSlugs.add(item.slug);
        
        results.push({
          slug: item.slug,
          name: item.name,
          url: `${CONSOLEVARIATIONS_BASE_URL}/collectibles/${item.slug}`,
          image: item.thumbnail,
          thumbnail: item.thumbnail
        });
      }
      
      const result = {
        source: "consolevariations",
        query,
        type,
        total: results.length,
        items: results
      };
      
      setCache(cacheKey, result);
      return result;
      
    } catch (err) {
      lastError = err;
      log.error(`Erreur tentative ${attempt}: ${err.message}`);
      await cleanupFsrSession();
      if (attempt >= retries) break;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  
  throw lastError || new Error("Échec après toutes les tentatives");
}

// ============================================================================
// DÉTAILS ITEM
// ============================================================================

/**
 * Récupère les détails d'un item ConsoleVariations
 * @param {string} slug - Slug de l'item
 * @param {number} retries - Nombre de tentatives
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails de l'item
 */
export async function getConsoleVariationsItem(slug, retries = MAX_RETRIES, options = {}) {
  const { lang = 'en', autoTrad = false } = options;
  const destLang = extractLangCode(lang);
  const shouldTranslate = autoTrad === true || autoTrad === 1 || autoTrad === '1';
  
  const cacheKey = `consolevariations:item:${slug}:${shouldTranslate ? 'trad' : 'notrad'}:${destLang || 'none'}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    log.debug(`Détails item "${slug}" (tentative ${attempt}/${retries})`);
    
    try {
      const sessionId = await ensureFsrSession();
      const itemUrl = `${CONSOLEVARIATIONS_BASE_URL}/collectibles/${slug}`;
      
      const response = await fsrRequest("request.get", itemUrl, sessionId, { waitInSeconds: 2 }, 60000);
      if (!response || !response.response) throw new Error("Pas de réponse FlareSolverr");
      
      const html = response.response;
      if (/<title>Not Found<\/title>/i.test(html)) throw new Error(`Item non trouvé: ${slug}`);
      
      // Extraire le titre
      const titleMatch = html.match(/<h1[^>]*class="[^"]*text-2xl[^"]*"[^>]*>\s*([^<]+)\s*<\/h1>/i);
      const name = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : slug.replace(/-/g, ' ');
      
      // Extraire les images
      const images = [];
      const imagesMatch = html.match(/images:\s*JSON\.parse\('(\[[\s\S]*?\])'\)/);
      if (imagesMatch) {
        try {
          const jsonStr = imagesMatch[1].replace(/\\u0022/g, '"').replace(/\\\//g, '/');
          const imagesData = JSON.parse(jsonStr);
          for (const img of imagesData) {
            images.push({
              id: img.id,
              url: img.original_url || img.preview_url,
              thumbnail: img.preview_url,
              alt: img.alt_text || ''
            });
          }
        } catch (e) {
          const imgRegex = /src="(https:\/\/cdn\.consolevariations\.com\/[^"]+)"/gi;
          let imgMatch;
          const seenUrls = new Set();
          while ((imgMatch = imgRegex.exec(html)) !== null) {
            if (!seenUrls.has(imgMatch[1]) && !imgMatch[1].includes('profile-photos')) {
              seenUrls.add(imgMatch[1]);
              images.push({ url: imgMatch[1], thumbnail: imgMatch[1] });
            }
          }
        }
      }
      
      // Extraire les détails du tableau
      const details = {};
      const tableRowRegex = /<tr>\s*<td[^>]*>\s*([^<]+)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/gi;
      let rowMatch;
      while ((rowMatch = tableRowRegex.exec(html)) !== null) {
        const label = decodeHtmlEntities(rowMatch[1].trim());
        let value = rowMatch[2].replace(/<[^>]+>/g, ' ').trim();
        value = decodeHtmlEntities(value);
        
        switch (label.toLowerCase()) {
          case 'releases':
            const releaseMatch = value.match(/([A-Za-z\s]+)\s*-?\s*(\d{4})?/);
            if (releaseMatch) {
              details.releaseCountry = releaseMatch[1].trim();
              details.releaseYear = releaseMatch[2] ? parseInt(releaseMatch[2]) : null;
            }
            break;
          case 'release type': details.releaseType = value; break;
          case 'amount produced estimate': details.amountProduced = value; break;
          case 'region code': details.regionCode = value; break;
          case 'limited edition': details.limitedEdition = value === 'Yes'; break;
          case 'color': details.color = value || null; break;
          case 'is bundle': details.isBundle = value === 'Yes'; break;
        }
      }
      
      // Extraire les stats
      const rarityMatch = html.match(/(\d+)\s*Rarity\s*Score/i);
      const wantMatch = html.match(/(\d+)\s*people\s*want\s*this/i);
      const ownMatch = html.match(/(\d+)\s*people\s*own\s*this/i);
      
      // Extraire la plateforme et marque
      const platformMatch = html.match(/href="\/database\/([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i);
      const brandMatch = html.match(/href="\/browse\/brand\/([^"\/]+)"/i);
      const barcodeMatch = html.match(/Barcode:\s*(\d+)/i);
      
      // Nom original
      const nameOriginal = name;
      
      // Applique la traduction si demandée
      let finalName = nameOriginal;
      let nameTranslated = null;
      
      if (shouldTranslate && destLang && nameOriginal) {
        const translated = await translateText(nameOriginal, destLang);
        if (translated !== nameOriginal) {
          finalName = translated;
          nameTranslated = translated;
        }
      }
      
      const result = {
        source: "consolevariations",
        slug,
        name: finalName,
        nameOriginal: nameOriginal,
        nameTranslated: nameTranslated,
        url: itemUrl,
        brand: brandMatch ? brandMatch[1].charAt(0).toUpperCase() + brandMatch[1].slice(1) : null,
        platform: platformMatch ? { slug: platformMatch[1], name: decodeHtmlEntities(platformMatch[2].trim()) } : null,
        images,
        details: {
          releaseCountry: details.releaseCountry || null,
          releaseYear: details.releaseYear || null,
          releaseType: details.releaseType || null,
          regionCode: details.regionCode || null,
          amountProduced: details.amountProduced || null,
          limitedEdition: details.limitedEdition || false,
          isBundle: details.isBundle || false,
          color: details.color || null,
          barcode: barcodeMatch ? barcodeMatch[1] : null
        },
        stats: {
          rarityScore: rarityMatch ? parseInt(rarityMatch[1]) : null,
          wantCount: wantMatch ? parseInt(wantMatch[1]) : 0,
          ownCount: ownMatch ? parseInt(ownMatch[1]) : 0
        }
      };
      
      setCache(cacheKey, result);
      return result;
      
    } catch (err) {
      lastError = err;
      log.error(`Erreur tentative ${attempt}: ${err.message}`);
      if (getFsrSessionId()) await destroyFsrSession();
      if (attempt >= retries) break;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  
  throw lastError || new Error("Échec après toutes les tentatives");
}

// ============================================================================
// PLATEFORMES
// ============================================================================

/**
 * Liste les plateformes disponibles sur ConsoleVariations
 * @param {string} brand - Marque optionnelle (nintendo, sony, microsoft, sega...)
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Liste des plateformes
 */
export async function listConsoleVariationsPlatforms(brand = null, retries = MAX_RETRIES) {
  const cacheKey = `consolevariations:platforms:${brand || 'all'}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    log.debug(`Liste plateformes${brand ? ` (${brand})` : ''} (tentative ${attempt}/${retries})`);
    
    try {
      const sessionId = await ensureFsrSession();
      const url = brand 
        ? `${CONSOLEVARIATIONS_BASE_URL}/browse/brand/${brand.toLowerCase()}/platforms`
        : `${CONSOLEVARIATIONS_BASE_URL}/browse/brand`;
      
      const response = await fsrRequest("request.get", url, sessionId, { waitInSeconds: 2 }, 60000);
      if (!response || !response.response) throw new Error("Pas de réponse FlareSolverr");
      
      const html = response.response;
      const platforms = [];
      const seen = new Set();
      
      if (brand) {
        const simpleRegex = /href="\/database\/([^"]+)"[^>]*>[^<]*<[^>]*>[^<]*([^<]+)/gi;
        let match;
        while ((match = simpleRegex.exec(html)) !== null) {
          const slug = match[1];
          if (!seen.has(slug) && !slug.includes('?')) {
            seen.add(slug);
            const name = decodeHtmlEntities(match[2].trim());
            if (name && name.length > 1) {
              platforms.push({ slug, name, url: `${CONSOLEVARIATIONS_BASE_URL}/database/${slug}` });
            }
          }
        }
      } else {
        const brandRegex = /href="\/browse\/brand\/([^"\/]+)(?:\/platforms)?"[^>]*>[\s\S]*?([A-Za-z0-9\s]+)<\/a>/gi;
        let match;
        while ((match = brandRegex.exec(html)) !== null) {
          const slug = match[1];
          if (!seen.has(slug)) {
            seen.add(slug);
            platforms.push({
              slug,
              name: decodeHtmlEntities(match[2].trim()) || slug.charAt(0).toUpperCase() + slug.slice(1),
              url: `${CONSOLEVARIATIONS_BASE_URL}/browse/brand/${slug}/platforms`
            });
          }
        }
      }
      
      const result = {
        source: "consolevariations",
        type: brand ? "platforms" : "brands",
        brand: brand || null,
        total: platforms.length,
        items: platforms
      };
      
      setCache(cacheKey, result, 3600000);
      return result;
      
    } catch (err) {
      lastError = err;
      log.error(`Erreur tentative ${attempt}: ${err.message}`);
      if (getFsrSessionId()) await destroyFsrSession();
      if (attempt >= retries) break;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  
  throw lastError || new Error("Échec après toutes les tentatives");
}

/**
 * Browse les items d'une plateforme spécifique
 * @param {string} platformSlug - Slug de la plateforme (ex: "nes", "sony-playstation")
 * @param {number} maxResults - Nombre max de résultats
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Items de la plateforme
 */
export async function browseConsoleVariationsPlatform(platformSlug, maxResults = CONSOLEVARIATIONS_DEFAULT_MAX, retries = MAX_RETRIES) {
  const cacheKey = `consolevariations:browse:${platformSlug}:${maxResults}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    log.debug(`Browse plateforme "${platformSlug}" (tentative ${attempt}/${retries})`);
    
    try {
      const sessionId = await ensureFsrSession();
      const url = `${CONSOLEVARIATIONS_BASE_URL}/database/${platformSlug}`;
      
      const response = await fsrRequest("request.get", url, sessionId, { waitInSeconds: 3 }, 60000);
      if (!response || !response.response) throw new Error("Pas de réponse FlareSolverr");
      
      const html = response.response;
      if (/<title>Not Found<\/title>/i.test(html)) throw new Error(`Plateforme non trouvée: ${platformSlug}`);
      
      const items = [];
      const seen = new Set();
      
      // Extraire les liens vers collectibles
      const fullLinkRegex = /href="https?:\/\/consolevariations\.com\/collectibles\/([^"]+)"[^>]*>\s*([^<]*)</gi;
      let match;
      
      while ((match = fullLinkRegex.exec(html)) !== null && items.length < maxResults) {
        const slug = match[1];
        let name = match[2] ? match[2].trim() : null;
        
        if (slug && !seen.has(slug) && name && name.length > 2) {
          seen.add(slug);
          
          // Chercher l'image proche
          const startIdx = Math.max(0, match.index - 2000);
          const context = html.substring(startIdx, match.index);
          const imgInContext = context.match(/src="(https:\/\/cdn\.consolevariations\.com\/\d+\/[^"]+)"/gi);
          const thumbnail = imgInContext && imgInContext.length > 0 
            ? imgInContext[imgInContext.length - 1].match(/src="([^"]+)"/)[1] 
            : null;
          
          items.push({
            slug,
            name: decodeHtmlEntities(name),
            url: `${CONSOLEVARIATIONS_BASE_URL}/collectibles/${slug}`,
            thumbnail
          });
        }
      }
      
      // Fallback avec URLs relatives
      if (items.length < maxResults) {
        const altRegex = /href="\/collectibles\/([^"]+)"/gi;
        while ((match = altRegex.exec(html)) !== null && items.length < maxResults) {
          const slug = match[1];
          if (!seen.has(slug)) {
            seen.add(slug);
            items.push({
              slug,
              name: slug.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              url: `${CONSOLEVARIATIONS_BASE_URL}/collectibles/${slug}`,
              thumbnail: null
            });
          }
        }
      }
      
      const result = {
        source: "consolevariations",
        platform: platformSlug,
        total: items.length,
        items: items.slice(0, maxResults)
      };
      
      setCache(cacheKey, result);
      return result;
      
    } catch (err) {
      lastError = err;
      log.error(`Erreur tentative ${attempt}: ${err.message}`);
      if (getFsrSessionId()) await destroyFsrSession();
      if (attempt >= retries) break;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  
  throw lastError || new Error("Échec après toutes les tentatives");
}

// ============================================================================
// FONCTIONS NORMALISÉES
// ============================================================================

/**
 * Recherche sur ConsoleVariations avec résultats normalisés
 * @param {string} query - Terme de recherche
 * @param {number} maxResults - Nombre max de résultats
 * @param {string} type - Type de filtre (all, consoles, controllers, accessories)
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function searchConsoleVariationsNormalized(query, maxResults = CONSOLEVARIATIONS_DEFAULT_MAX, type = 'all', retries = MAX_RETRIES) {
  const rawResult = await searchConsoleVariations(query, maxResults, type, retries);
  return normalizeConsoleVariationsSearch(rawResult);
}

/**
 * Récupère les détails d'un item ConsoleVariations avec résultat normalisé
 * @param {string} slug - Slug de l'item
 * @param {number} retries - Nombre de tentatives
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getConsoleVariationsItemNormalized(slug, retries = MAX_RETRIES, options = {}) {
  const rawResult = await getConsoleVariationsItem(slug, retries, options);
  return normalizeConsoleVariationsDetail(rawResult);
}

/**
 * Liste les plateformes ConsoleVariations avec résultats normalisés
 * @param {string} brand - Marque optionnelle
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function listConsoleVariationsPlatformsNormalized(brand = null, retries = MAX_RETRIES) {
  const rawResult = await listConsoleVariationsPlatforms(brand, retries);
  return normalizeConsoleVariationsPlatforms(rawResult);
}

/**
 * Browse une plateforme ConsoleVariations avec résultats normalisés
 * @param {string} platformSlug - Slug de la plateforme
 * @param {number} maxResults - Nombre max de résultats
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function browseConsoleVariationsPlatformNormalized(platformSlug, maxResults = CONSOLEVARIATIONS_DEFAULT_MAX, retries = MAX_RETRIES) {
  const rawResult = await browseConsoleVariationsPlatform(platformSlug, maxResults, retries);
  return normalizeConsoleVariationsBrowse(rawResult);
}
