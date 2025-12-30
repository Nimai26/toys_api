/**
 * lib/providers/paninimania.js - Provider Paninimania
 * 
 * Base de données d'albums Panini et stickers
 * Nécessite FlareSolverr pour le scraping
 * 
 * @module providers/paninimania
 */

import { getCached, setCache } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { decodeHtmlEntities } from '../utils/helpers.js';
import {
  PANINIMANIA_BASE_URL,
  PANINIMANIA_DEFAULT_MAX,
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
  normalizePaninimiaSearch,
  normalizePaninimiaAlbumDetail
} from '../normalizers/stickers.js';

const log = createLogger('Paninimania');

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Formate un terme de recherche pour Paninimania
 * @param {string} term - Terme de recherche
 * @returns {string} - Terme formaté
 */
function formatPaninimaniaTerm(term) {
  return term
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '+')
    .trim();
}

/**
 * Parse une checklist en tableau de numéros
 * @param {string} raw - Chaîne brute (ex: "1 à 100, 105, 110-120")
 * @returns {Array<number>} - Tableau de numéros
 */
function parseChecklistToArray(raw) {
  if (!raw) return [];
  
  const items = [];
  const parts = raw.split(/[,;]/);
  
  for (const part of parts) {
    const trimmed = part.trim();
    
    // Pattern "X à Y" ou "X - Y"
    const rangeMatch = trimmed.match(/(\d+)\s*(?:à|-)\s*(\d+)/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = parseInt(rangeMatch[2]);
      for (let i = start; i <= end; i++) {
        items.push(i);
      }
    } else {
      // Nombre simple
      const numMatch = trimmed.match(/(\d+)/);
      if (numMatch) {
        items.push(parseInt(numMatch[1]));
      }
    }
  }
  
  return items;
}

/**
 * Parse une liste de stickers spéciaux (lettres, alphanumériques, etc.)
 * Supporte : A, B, C ou A1, B2, C3 ou mélanges
 * @param {string} raw - Chaîne brute (ex: "A, B, C, D" ou "A1, B2, C3")
 * @returns {Array<string>} - Tableau d'identifiants
 */
function parseSpecialStickersToArray(raw) {
  if (!raw) return [];
  
  const items = [];
  const parts = raw.split(/[,;]/);
  
  for (const part of parts) {
    const trimmed = part.trim();
    
    // Pattern pour lettres seules ou combinaisons alphanumériques
    // Supporte : A, B, C ou A1, B2, C3 ou I, II, III
    const itemMatch = trimmed.match(/^([A-Z]+\d*|[IVX]+)$/i);
    if (itemMatch) {
      items.push(itemMatch[1].toUpperCase());
    } else {
      // Essayer de capturer "X à Y" pour les lettres (ex: "A à Z")
      const rangeMatch = trimmed.match(/^([A-Z])\s*(?:à|-)\s*([A-Z])$/i);
      if (rangeMatch) {
        const start = rangeMatch[1].toUpperCase().charCodeAt(0);
        const end = rangeMatch[2].toUpperCase().charCodeAt(0);
        for (let i = start; i <= end; i++) {
          items.push(String.fromCharCode(i));
        }
      }
    }
  }
  
  return items;
}

// ============================================================================
// RECHERCHE
// ============================================================================

/**
 * Recherche sur Paninimania
 * @param {string} term - Terme de recherche
 * @param {number} maxResults - Nombre max de résultats
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchPaninimania(term, maxResults = PANINIMANIA_DEFAULT_MAX, retries = MAX_RETRIES) {
  const formattedTerm = formatPaninimaniaTerm(term);
  
  const cacheKey = `paninimania:search:${formattedTerm}:${maxResults}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour recherche: "${term}" -> "${formattedTerm}"`);
      
      await ensureFsrSession();
      const sessionId = getFsrSessionId();
      
      const allResults = [];
      let currentPage = 1;
      let totalPages = 1;
      
      while (allResults.length < maxResults) {
        let searchUrl = `${PANINIMANIA_BASE_URL}/?pag=cid508&idf=15&idd=all&ids=111_${formattedTerm}`;
        if (currentPage > 1) {
          searchUrl += `&npa=${currentPage}`;
        }
        
        log.debug(`Page ${currentPage}`);

        const pageSolution = await fsrRequest("request.get", searchUrl, sessionId, {
          waitInSeconds: 2
        }, 45000);
        
        const html = pageSolution.response || "";
        
        if (html.includes("Aucun album") || html.length < 5000) {
          break;
        }
        
        const pageMatch = html.match(/Page\s+(\d+)\/(\d+)/i);
        if (pageMatch) {
          currentPage = parseInt(pageMatch[1]);
          totalPages = parseInt(pageMatch[2]);
        }
        
        // Parser les albums
        const albumBlockRegex = /<div\s+class="d2">\s*<div\s+class="y0"[^>]*style="gap:\s*10px\s+10px[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
        let albumMatch;
        let pageResults = 0;
        
        while ((albumMatch = albumBlockRegex.exec(html)) !== null) {
          if (allResults.length >= maxResults) break;
          
          const albumHtml = albumMatch[1];
          
          try {
            const idMatch = albumHtml.match(/href="[^"]*pag=cid508_alb[^"]*idm=(\d+)"/i);
            if (!idMatch) continue;
            const albumId = idMatch[1];
            
            const titleMatch = albumHtml.match(/<b><a\s+href="[^"]*"[^>]*>([^<]+)<\/a><\/b>/i);
            const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;
            
            if (!title) continue;
            
            const imgMatch = albumHtml.match(/src="(files\/[^"]+\?n=\d+s\.jpg)"/i);
            const thumbnail = imgMatch ? `${PANINIMANIA_BASE_URL}/${imgMatch[1]}` : null;
            
            const yearMatch = albumHtml.match(/<b>\s*(\d{4}|[a-z]+\s+\d{4})\s*<\/b>/i);
            const year = yearMatch ? yearMatch[1].trim() : null;
            
            const albumUrl = `${PANINIMANIA_BASE_URL}/?pag=cid508_alb&idf=15&idm=${albumId}`;
            
            allResults.push({
              id: albumId,
              title: title,
              url: albumUrl,
              image: thumbnail,
              thumbnail: thumbnail,
              year: year
            });
            
            pageResults++;
          } catch (e) {
            log.warn(`Erreur parsing album: ${e.message}`);
          }
        }
        
        if (currentPage >= totalPages || pageResults === 0) {
          break;
        }
        
        currentPage++;
        await new Promise(r => setTimeout(r, 500));
      }
      
      const result = {
        source: "paninimania",
        query: term,
        formattedQuery: formattedTerm,
        total: allResults.length,
        results: allResults
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
// DÉTAILS ALBUM
// ============================================================================

/**
 * Récupère les détails d'un album Paninimania
 * @param {string} albumId - ID ou URL de l'album
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Détails de l'album
 */
export async function getPaninimanialbumDetails(albumId, retries = MAX_RETRIES) {
  // Si c'est une URL complète, extraire l'ID
  let id = albumId;
  if (albumId.includes("paninimania.com")) {
    const match = albumId.match(/idm=(\d+)/i);
    if (match) {
      id = match[1];
    }
  }
  
  // Vérifier le cache
  const cacheKey = `paninimania:album:${id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      const albumUrl = `${PANINIMANIA_BASE_URL}/?pag=cid508_alb&idf=15&idm=${id}`;
      log.debug(`Tentative ${attempt}/${retries} pour album: ${id}`);
      log.debug(`URL: ${albumUrl}`);
      
      // Créer une session FSR si elle n'existe pas
      const sessionId = await ensureFsrSession();
      
      if (!sessionId) {
        throw new Error("Impossible de créer une session FlareSolverr");
      }

      const pageSolution = await fsrRequest("request.get", albumUrl, sessionId, {
        waitInSeconds: 2
      }, 45000);
      
      const html = pageSolution.response || "";
      log.debug(`Page album reçue, taille: ${html.length}`);
      
      // Vérifier si l'album existe
      if (html.includes("page introuvable") || html.includes("n'existe pas") || html.length < 3000) {
        throw new Error(`Album ${id} non trouvé`);
      }
      
      // Extraire le titre depuis <h1>
      const titleMatch = html.match(/<h1>\s*([^<]+)\s*<\/h1>/i);
      const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;
      
      // Extraire la description détaillée depuis <div class="d2"> > <div class="g0">
      let description = null;
      const descMatch = html.match(/<div\s+class="d2">\s*<div\s+class="g0">([\s\S]*?)<\/div>\s*<\/div>/i);
      if (descMatch) {
        // Nettoyer le HTML (garder les <br> comme retours à la ligne)
        description = descMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\n\n+/g, '\n\n')
          .trim();
        description = decodeHtmlEntities(description);
      }
      
      // Extraire l'image principale (format: files/15/{folder}/?n={id}b.jpg)
      const mainImgMatch = html.match(/src="(files\/[^"]+\?n=\d+b\.jpg)"/i);
      const mainImage = mainImgMatch ? `${PANINIMANIA_BASE_URL}/${mainImgMatch[1]}` : null;
      
      // Extraire le copyright
      const copyrightMatch = html.match(/Copyright\s*:\s*<\/b>([^<]+)/i);
      const copyright = copyrightMatch ? decodeHtmlEntities(copyrightMatch[1].trim()) : null;
      
      // Extraire le code-barres (EAN/UPC) - capturer tout le texte après "Code-barres :"
      const barcodeMatch = html.match(/Code-barres\s*:\s*<\/b>([^<]+)/i);
      const barcode = barcodeMatch ? barcodeMatch[1].trim() : null;
      
      // Extraire la date de parution
      const dateMatch = html.match(/Premi[èe]re\s+parution\s*:\s*<\/b>([^<]+)/i);
      const releaseDate = dateMatch ? decodeHtmlEntities(dateMatch[1].trim()) : null;
      
      // Extraire la checklist (texte après le titre, format "Editeur : X à Y")
      const checklistMatch = html.match(/<b>[^<]+<\/b><br>\s*([^<:]+:\s*[^<]+)<br>/i);
      let editor = null;
      let checklistRaw = null;
      let checklistParsed = [];
      
      if (checklistMatch) {
        const checklistText = decodeHtmlEntities(checklistMatch[1].trim());
        const colonIdx = checklistText.indexOf(':');
        if (colonIdx > 0) {
          editor = checklistText.substring(0, colonIdx).trim();
          checklistRaw = checklistText.substring(colonIdx + 1).trim();
        } else {
          checklistRaw = checklistText;
        }
        
        // Parser la checklist (ne traiter que les numéros)
        const parts = checklistRaw.split(/[,;]/);
        
        for (const part of parts) {
          const trimmed = part.trim();
          
          // Parser uniquement les numéros (ignorer les lettres, maintenant dans specialStickers)
          const numRangeMatch = trimmed.match(/^(\d+)\s*(?:à|-)\s*(\d+)$/i);
          if (numRangeMatch) {
            const start = parseInt(numRangeMatch[1]);
            const end = parseInt(numRangeMatch[2]);
            for (let i = start; i <= end; i++) {
              checklistParsed.push(i);
            }
          } else if (/^\d+$/.test(trimmed)) {
            // Nombre simple
            checklistParsed.push(parseInt(trimmed));
          }
        }
      }
      
      // Construire l'objet checklist structuré
      const checklist = checklistRaw ? {
        raw: checklistRaw,
        total: checklistParsed.length,
        items: checklistParsed
      } : null;
      
      // Extraire les catégories depuis le fil d'Ariane
      const categories = [];
      const breadcrumbMatch = html.match(/<H2>([\s\S]*?)<\/H2>/i);
      if (breadcrumbMatch) {
        const catRegex = /<a\s+href="[^"]*"[^>]*>([^<]+)<\/a>/gi;
        let catMatch;
        while ((catMatch = catRegex.exec(breadcrumbMatch[1])) !== null) {
          const cat = decodeHtmlEntities(catMatch[1].trim());
          if (cat && cat !== "Menu" && cat !== "Tous les albums" && !categories.includes(cat)) {
            categories.push(cat);
          }
        }
      }
      
      // Extraire les images supplémentaires (exemples d'images, checklist, etc.)
      const additionalImages = [];
      const addImgRegex = /<a\s+href="(files\/[^"]+\.jpg)"\s+target="_blank"[^>]*title="([^"]+)"/gi;
      let addImgMatch;
      while ((addImgMatch = addImgRegex.exec(html)) !== null) {
        additionalImages.push({
          url: `${PANINIMANIA_BASE_URL}/${addImgMatch[1]}`,
          caption: decodeHtmlEntities(addImgMatch[2])
        });
      }
      
      // Extraire les articles divers
      const articles = [];
      const articleMatch = html.match(/Articles\s+divers\s*:<\/b><br>([\s\S]*?)(?:<\/div>|<br>\s*<br>)/i);
      if (articleMatch) {
        const articleLines = articleMatch[1].split(/<br\s*\/?>/i);
        for (const line of articleLines) {
          const clean = line.replace(/<[^>]+>/g, '').trim();
          if (clean && clean.startsWith('-')) {
            articles.push(clean.substring(1).trim());
          }
        }
      }
      
      // Extraire les images spéciales (Fluorescentes, Brillantes, Hologrammes, etc.)
      const specialStickers = [];
      
      // Pattern pour les différents types d'images spéciales
      const specialPatternsRegex = /<b>Images?\s+(Fluorescentes?|Brillantes?|Hologrammes?|Métallisées?|Pailletées?|Transparentes?|Puzzle|Relief|Autocollantes?|Tatouages?|Phosphorescentes?|3D|Lenticulaires?|Dorées?|Argentées?)\s*<\/b>\s*(?:<em>[^<]*<\/em>)?\s*(?:<b>)?\s*:\s*<\/b>?\s*([^<]+)/gi;
      let specialMatch;
      
      while ((specialMatch = specialPatternsRegex.exec(html)) !== null) {
        const type = decodeHtmlEntities(specialMatch[1].trim());
        const rawList = specialMatch[2].trim();
        
        // Déterminer si c'est une liste de numéros ou de lettres/alphanumériques
        const hasNumbers = /\d/.test(rawList.replace(/\d+\s*(?:à|-)\s*\d+/g, '')); // Vrai si nombres isolés
        const hasLetters = /[A-Z]/i.test(rawList);
        
        let parsedList = [];
        
        if (hasLetters && !hasNumbers) {
          // Que des lettres : A, B, C ou A à X
          parsedList = parseSpecialStickersToArray(rawList);
        } else if (hasNumbers && !hasLetters) {
          // Que des nombres : 1, 2, 3 ou 1 à 10
          parsedList = parseChecklistToArray(rawList);
        } else {
          // Mixte : essayer de parser intelligemment
          const parts = rawList.split(/[,;]/);
          for (const part of parts) {
            const trimmed = part.trim();
            // Alphanumérique (A1, B2) ou lettre seule
            if (/^[A-Z]+\d*$/i.test(trimmed)) {
              parsedList.push(trimmed.toUpperCase());
            } else if (/^\d+$/.test(trimmed)) {
              parsedList.push(parseInt(trimmed));
            } else {
              // Tentative de range
              const numRange = trimmed.match(/^(\d+)\s*(?:à|-)\s*(\d+)$/i);
              if (numRange) {
                const start = parseInt(numRange[1]);
                const end = parseInt(numRange[2]);
                for (let i = start; i <= end; i++) {
                  parsedList.push(i);
                }
              } else {
                const letterRange = trimmed.match(/^([A-Z])\s*(?:à|-)\s*([A-Z])$/i);
                if (letterRange) {
                  const start = letterRange[1].toUpperCase().charCodeAt(0);
                  const end = letterRange[2].toUpperCase().charCodeAt(0);
                  for (let i = start; i <= end; i++) {
                    parsedList.push(String.fromCharCode(i));
                  }
                }
              }
            }
          }
        }
        
        if (parsedList.length > 0) {
          specialStickers.push({
            name: type,
            raw: rawList,
            total: parsedList.length,
            list: parsedList
          });
        }
      }
      
      // Fallback: chercher tout type "Images X : ..." qui pourrait exister
      const genericSpecialRegex = /<b>Images?\s+([^<:]+)\s*<\/b>\s*(?:<em>[^<]*<\/em>)?\s*(?:<b>)?\s*:\s*<\/b>?\s*([^<]+)/gi;
      while ((specialMatch = genericSpecialRegex.exec(html)) !== null) {
        const type = decodeHtmlEntities(specialMatch[1].trim());
        
        // Éviter les doublons (vérifier si déjà ajouté)
        const alreadyExists = specialStickers.some(s => s.name.toLowerCase() === type.toLowerCase());
        
        if (!alreadyExists && type !== 'divers' && !type.includes('article')) {
          const rawList = specialMatch[2].trim();
          
          // Même logique de parsing
          const hasNumbers = /\d/.test(rawList.replace(/\d+\s*(?:à|-)\s*\d+/g, ''));
          const hasLetters = /[A-Z]/i.test(rawList);
          
          let parsedList = [];
          
          if (hasLetters && !hasNumbers) {
            parsedList = parseSpecialStickersToArray(rawList);
          } else if (hasNumbers && !hasLetters) {
            parsedList = parseChecklistToArray(rawList);
          } else {
            const parts = rawList.split(/[,;]/);
            for (const part of parts) {
              const trimmed = part.trim();
              if (/^[A-Z]+\d*$/i.test(trimmed)) {
                parsedList.push(trimmed.toUpperCase());
              } else if (/^\d+$/.test(trimmed)) {
                parsedList.push(parseInt(trimmed));
              } else {
                const numRange = trimmed.match(/^(\d+)\s*(?:à|-)\s*(\d+)$/i);
                if (numRange) {
                  const start = parseInt(numRange[1]);
                  const end = parseInt(numRange[2]);
                  for (let i = start; i <= end; i++) {
                    parsedList.push(i);
                  }
                } else {
                  const letterRange = trimmed.match(/^([A-Z])\s*(?:à|-)\s*([A-Z])$/i);
                  if (letterRange) {
                    const start = letterRange[1].toUpperCase().charCodeAt(0);
                    const end = letterRange[2].toUpperCase().charCodeAt(0);
                    for (let i = start; i <= end; i++) {
                      parsedList.push(String.fromCharCode(i));
                    }
                  }
                }
              }
            }
          }
          
          if (parsedList.length > 0) {
            specialStickers.push({
              name: type,
              raw: rawList,
              total: parsedList.length,
              list: parsedList
            });
          }
        }
      }
      
      if (!title) {
        throw new Error(`Impossible d'extraire les informations de l'album: ${albumUrl}`);
      }
      
      // Calculer le total réel (images normales + spéciales)
      if (checklist) {
        let totalSpecials = 0;
        
        // Compter toutes les images spéciales depuis specialStickers
        if (specialStickers && specialStickers.length > 0) {
          for (const special of specialStickers) {
            totalSpecials += special.list.length;
          }
        }
        
        checklist.totalWithSpecials = checklist.total + totalSpecials;
      }
      
      const result = {
        id: id,
        title: title,
        url: albumUrl,
        description: description,
        mainImage: mainImage,
        barcode: barcode,
        copyright: copyright,
        releaseDate: releaseDate,
        editor: editor,
        checklist: checklist,
        categories: categories,
        additionalImages: additionalImages,
        articles: articles,
        specialStickers: specialStickers.length > 0 ? specialStickers : null
      };
      
      // Mettre en cache le résultat
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
// FONCTIONS NORMALISÉES
// ============================================================================

/**
 * Recherche sur Paninimania avec résultats normalisés
 * @param {string} term - Terme de recherche
 * @param {number} maxResults - Nombre max de résultats
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function searchPaninimanisaNormalized(term, maxResults = PANINIMANIA_DEFAULT_MAX, retries = MAX_RETRIES) {
  const rawResult = await searchPaninimania(term, maxResults, retries);
  return normalizePaninimiaSearch(rawResult);
}

/**
 * Récupère les détails d'un album Paninimania avec résultat normalisé
 * @param {string} albumId - ID ou URL de l'album
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getPaninimanialbumDetailsNormalized(albumId, retries = MAX_RETRIES) {
  const rawResult = await getPaninimanialbumDetails(albumId, retries);
  return normalizePaninimiaAlbumDetail(rawResult);
}
