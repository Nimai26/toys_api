/**
 * lib/providers/bedetheque.js - Provider Bedetheque
 * 
 * Scraping Bedetheque pour BD franco-belge
 * Utilise FlareSolverr pour contourner les protections
 * 
 * @module providers/bedetheque
 */

import { metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { decodeHtmlEntities } from '../utils/helpers.js';
import { translateText, translateGenres, extractLangCode } from '../utils/translator.js';
import {
  BEDETHEQUE_BASE_URL,
  BEDETHEQUE_DEFAULT_MAX,
  FSR_BASE
} from '../config.js';
import { getFsrSessionId } from '../utils/flaresolverr.js';
import { fetchViaProxy } from '../utils/fetch-proxy.js';
import {
  normalizeBedethequeSearch,
  normalizeBedethequeSerieSearch,
  normalizeBedethequeAlbumDetail,
  normalizeBedethequeSerieDetail
} from '../normalizers/book.js';

const log = createLogger('Bedetheque');

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Normalise une chaîne pour comparaison (retire accents, lowercase)
 */
function normalizeStr(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ============================================================================
// RECHERCHE AJAX (RAPIDE)
// ============================================================================

/**
 * Recherche rapide de séries via l'API AJAX de Bedetheque (autocomplete)
 * Cette API ne nécessite pas FlareSolverr et est plus rapide
 * @param {string} query - Terme de recherche (min 3 caractères)
 * @returns {Promise<Array>} - Liste de séries {id, name, category}
 */
export async function searchBedethequeAjax(query) {
  if (!query || query.length < 3) {
    return [];
  }
  
  const cacheKey = `bedetheque_ajax_${query}`;
  try {
    log.debug(`Recherche AJAX: ${query}`);
    const url = `${BEDETHEQUE_BASE_URL}/ajax/tout?term=${encodeURIComponent(query)}`;
    
    const response = await fetchViaProxy(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      log.debug(`AJAX erreur HTTP: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    // Transformer les résultats: format {id: "S59", label: "Astérix", ...}
    const results = data
      .filter(item => item.id && item.id.startsWith('S')) // Seulement les séries (pas les auteurs 'A')
      .map(item => ({
        id: parseInt(item.id.replace('S', '')),
        name: item.label || item.value,
        category: item.category || 'Séries'
      }));
    
    log.debug(`AJAX: ${results.length} séries trouvées`); // Cache 10 min
    return results;
    
  } catch (err) {
    log.debug(`AJAX erreur: ${err.message}`);
    return [];
  }
}

// ============================================================================
// RECHERCHE SÉRIES
// ============================================================================

/**
 * Recherche de séries sur Bedetheque
 * @param {string} query - Terme de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchBedetheque(query, options = {}) {
  metrics.sources.bedetheque.requests++;
  const max = Math.min(options.max || BEDETHEQUE_DEFAULT_MAX, 50);
  
  const cacheKey = `bedetheque_search_${query}_${max}`;
  try {
    log.debug(`Recherche: ${query} (max: ${max})`);
    
    // Méthode 1: Utiliser l'API AJAX (rapide et fiable)
    const ajaxResults = await searchBedethequeAjax(query);
    
    if (ajaxResults && ajaxResults.length > 0) {
      const results = ajaxResults.slice(0, max).map(item => ({
        id: item.id,
        type: 'serie',
        name: item.name,
        url: `${BEDETHEQUE_BASE_URL}/serie-${item.id}-BD-${encodeURIComponent(item.name.replace(/\s+/g, '-'))}.html`,
        source: 'bedetheque'
      }));
      
      const result = {
        query,
        resultsCount: results.length,
        results,
        source: 'bedetheque',
        note: 'Résultats via API AJAX Bedetheque'
      };
      
      log.debug(`✅ AJAX: ${results.length} séries trouvées`);
      return result;
    }
    
    // Méthode 2: Fallback - Scraping HTML (si AJAX échoue)
    log.debug(`AJAX sans résultats, fallback scraping...`);
    
    // Normaliser la query: retirer les accents et remplacer espaces par _
    const urlQuery = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // Retirer les accents
      .toLowerCase()
      .replace(/\s+/g, '_');
    const searchUrl = `${BEDETHEQUE_BASE_URL}/bandes_dessinees_${encodeURIComponent(urlQuery)}.html`;
    
    log.debug(`URL scraping: ${searchUrl}`);
    
    const response = await fetchViaProxy(`${FSR_BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get",
        url: searchUrl,
        maxTimeout: 30000,
        session: getFsrSessionId()
      })
    });

    const data = await response.json();
    
    if (data.status !== "ok") {
      throw new Error(`FlareSolverr error: ${data.message || 'Unknown error'}`);
    }

    const html = data.solution?.response || "";
    
    // Parser les résultats de recherche
    const results = [];
    const seenIds = new Set();
    
    // Regex pour extraire les liens vers les séries
    const serieRegex = /href="[^"]*\/serie-(\d+)-BD-([^"]+)\.html"/gi;
    let match;
    
    // Normaliser la query pour la comparaison (retirer accents)
    const normalizedQuery = normalizeStr(query);
    
    while ((match = serieRegex.exec(html)) !== null && results.length < max) {
      const [fullMatch, id, namePart] = match;
      
      // Éviter les doublons
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      
      // Convertir le nom de l'URL en nom lisible
      const name = decodeHtmlEntities(decodeURIComponent(namePart).replace(/-/g, ' ').trim());
      if (!name || name.length < 2) continue;
      
      // Vérifier que le nom contient le terme de recherche (filtrage sans accents)
      const normalizedName = normalizeStr(name);
      if (!normalizedName.includes(normalizedQuery)) continue;
      
      results.push({
        id: parseInt(id),
        type: 'serie',
        name: name,
        url: `${BEDETHEQUE_BASE_URL}/serie-${id}-BD-${namePart}.html`,
        source: 'bedetheque'
      });
    }

    const result = {
      query,
      resultsCount: results.length,
      results,
      source: 'bedetheque',
      note: 'Résultats de recherche par scraping - certaines données peuvent être incomplètes'
    };

    log.debug(`✅ Scraping: ${results.length} séries trouvées`);
    return result;

  } catch (err) {
    metrics.sources.bedetheque.errors++;
    throw err;
  }
}

// ============================================================================
// RECHERCHE ALBUMS
// ============================================================================

/**
 * Recherche de livres par auteur sur Bedetheque
 * Utilise l'API AJAX pour trouver l'auteur, puis récupère toutes ses séries et leurs albums
 * @param {string} author - Nom de l'auteur
 * @param {object} options - Options de recherche (max, lang)
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchBedethequeByAuthor(author, options = {}) {
  metrics.sources.bedetheque.requests++;
  const max = Math.min(options.max || BEDETHEQUE_DEFAULT_MAX, 100);
  const lang = options.lang || null;
  
  const cacheKey = `bedetheque_author_${author}_${max}`;
  
  try {
    log.debug(`Recherche par auteur: ${author} (max: ${max})`);
    
    // Étape 1: Rechercher l'auteur via AJAX
    const ajaxUrl = `${BEDETHEQUE_BASE_URL}/ajax/tout?term=${encodeURIComponent(author)}`;
    const ajaxResponse = await fetch(ajaxUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!ajaxResponse.ok) {
      throw new Error(`Erreur AJAX: ${ajaxResponse.status}`);
    }
    
    const ajaxData = await ajaxResponse.json();
    
    // Filtrer les auteurs (id commence par 'A')
    const authors = ajaxData.filter(item => item.id && item.id.startsWith('A'));
    
    if (authors.length === 0) {
      log.debug(`Aucun auteur trouvé pour: ${author}`);
      return {
        query: author,
        type: 'author',
        albumsCount: 0,
        albums: [],
        source: 'bedetheque'
      };
    }
    
    // Prendre le premier auteur trouvé (meilleure correspondance)
    const authorData = authors[0];
    const authorId = parseInt(authorData.id.replace('A', ''));
    const authorName = decodeHtmlEntities((authorData.label || authorData.value).replace(/<[^>]*>/g, ''));
    
    log.debug(`Auteur trouvé: ${authorName} (ID: ${authorId})`);
    
    // Étape 2: Utiliser l'URL de recherche directe avec RechIdAuteur
    const searchUrl = `${BEDETHEQUE_BASE_URL}/search/albums?RechIdAuteur=${authorId}&RechAuteur=${encodeURIComponent(authorName)}`;
    log.debug(`Récupération albums: ${searchUrl}`);
    
    const fsrResponse = await fetch(`${FSR_BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get",
        url: searchUrl,
        maxTimeout: 30000,
        session: getFsrSessionId()
      })
    });
    
    const fsrData = await fsrResponse.json();
    
    if (fsrData.status !== "ok") {
      throw new Error(`Erreur FlareSolverr: ${fsrData.message}`);
    }
    
    const html = fsrData.solution?.response || "";
    
    // Étape 3: Parser les albums (même regex que searchBedethequeAlbums)
    const albumRegex = /<li class="li-album"[^>]*>[\s\S]*?<a[^>]*href="\/BD-([^-]+)-[^"]*"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<div class="sous-titre">([\s\S]*?)<\/div>/gi;
    const allAlbums = [];
    let albumMatch;
    
    while ((albumMatch = albumRegex.exec(html)) !== null && allAlbums.length < max) {
      const [, albumId, titleAttr, thumbnail, sousTitreHtml] = albumMatch;
      
      // Extraire la série depuis le titre
      let serieName = null;
      const serieMatch = titleAttr.match(/^Album de (.+?) -/i);
      if (serieMatch) {
        serieName = decodeHtmlEntities(serieMatch[1].trim());
      }
      
      // Extraire tome et titre depuis le sous-titre
      let tome = null;
      let tomeVariant = null;
      let albumTitle = null;
      
      const tomeMatch = sousTitreHtml.match(/<b>(?:Tome\s*)?(\d+)([a-zA-Z]*)<\/b>/i);
      const intMatch = sousTitreHtml.match(/<b>(INT|HS|TL)<\/b>/i);
      
      if (tomeMatch) {
        tome = parseInt(tomeMatch[1]) || null;
        if (tomeMatch[2]) {
          tomeVariant = tomeMatch[2];
        }
      } else if (intMatch) {
        tomeVariant = intMatch[1];
      }
      
      // Extraire le titre
      let cleanText = sousTitreHtml
        .replace(/<b>[^<]*<\/b>\s*-?\s*/gi, '')
        .replace(/<span[^>]*>[^<]*<\/span>\s*/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
      
      if (cleanText) {
        albumTitle = decodeHtmlEntities(cleanText);
      }
      
      // Fallback: extraire du title attribute
      if (!albumTitle && titleAttr) {
        const titleMatch = titleAttr.match(/Album de .+? -(\d+[a-zA-Z]?)- (.+)$/i);
        if (titleMatch) {
          albumTitle = decodeHtmlEntities(titleMatch[2].trim());
          if (!tome) {
            const numPart = titleMatch[1];
            tome = parseInt(numPart) || null;
            const variantMatch = numPart.match(/\d+([a-zA-Z]+)/);
            if (variantMatch) tomeVariant = variantMatch[1];
          }
        }
      }
      
      allAlbums.push({
        id: parseInt(albumId),
        type: 'album',
        title: albumTitle,
        tome: tome,
        tomeVariant: tomeVariant || undefined,
        serie: serieName ? { name: serieName } : null,
        author: authorName,
        image: thumbnail ? [thumbnail] : [],
        url: `${BEDETHEQUE_BASE_URL}/BD-${albumId}-.html`,
        source: 'bedetheque'
      });
    }
    
    log.debug(`✅ ${allAlbums.length} albums trouvés pour ${authorName}`);
    
    return {
      query: author,
      type: 'author',
      author: authorName,
      albumsCount: allAlbums.length,
      albums: allAlbums,
      source: 'bedetheque'
    };
            session: getFsrSessionId()
          })
        });
        
        const albumsData = await albumsResponse.json();
        
        if (albumsData.status !== "ok") {
          log.debug(`Erreur pour série ${serie.id}: ${albumsData.message}`);
          continue;
        }
        
        const albumsHtml = albumsData.solution?.response || "";
        
        // Parser les albums
        const seenIds = new Set();
        const albumBlockRegex = /<li>\s*<a[^>]*href="([^"]*\/BD-[^"]*-(\d+)\.html)"[^>]*title="([^"]*)"[^>]*>\s*<img[^>]*src="([^"]*)"[^>]*>/gi;
        let blockMatch;
        
        while ((blockMatch = albumBlockRegex.exec(albumsHtml)) !== null && allAlbums.length < max) {
          const [, url, albumId, titleAttr, thumbnail] = blockMatch;
          
          if (!albumId || seenIds.has(albumId)) continue;
          seenIds.add(albumId);
          
          allAlbums.push({
            id: `bedetheque-${albumId}`,
            title: decodeHtmlEntities(titleAttr.trim()),
            authors: [authorName],
            series: serie.name,
            image: thumbnail ? [thumbnail.replace('Couvertures/', 'Couvertures/200/')] : [],
            thumbnail: thumbnail,
            src_url: `${BEDETHEQUE_BASE_URL}${url}`,
            source: 'bedetheque'
          });
        }
      } catch (err) {
        log.debug(`Erreur récupération albums série ${serie.id}: ${err.message}`);
      }
    }
    
    log.debug(`✅ ${allAlbums.length} albums trouvés pour ${authorName}`);
    
    return {
      query: author,
      type: 'author',
      author: authorName,
      albumsCount: allAlbums.length,
      albums: allAlbums,
      source: 'bedetheque'
    };
    
  } catch (err) {
    metrics.sources.bedetheque.errors++;
    throw err;
  }
}

/**
 * Recherche d'albums sur Bedetheque via la page d'albums d'une série
 * @param {string} query - Terme de recherche
 * @param {object} options - Options de recherche (max, serieId)
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function searchBedethequeAlbums(query, options = {}) {
  metrics.sources.bedetheque.requests++;
  const max = Math.min(options.max || BEDETHEQUE_DEFAULT_MAX, 50);
  const serieId = options.serieId || null;
  
  const cacheKey = `bedetheque_albums_${query}_${serieId || 'search'}_${max}`;
  try {
    log.debug(`Recherche albums: ${query} (serieId: ${serieId || 'auto'}, max: ${max})`);
    
    let seriesData = [];
    
    if (serieId) {
      const serieName = options.serieName || query;
      
      if (serieName) {
        const slug = serieName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');
        
        seriesData = [{ 
          id: parseInt(serieId), 
          name: serieName, 
          url: `${BEDETHEQUE_BASE_URL}/serie-${serieId}-BD-${slug}.html`
        }];
        log.debug(`Série ${serieId} avec nom: ${serieName}`);
      } else {
        log.debug(`⚠️ Série ${serieId} sans nom - impossible de construire l'URL`);
        return {
          query,
          searchType: 'albums',
          error: true,
          message: 'Pour rechercher les albums d\'une série par ID, vous devez fournir le nom de la série',
          resultsCount: 0,
          results: [],
          source: 'bedetheque'
        };
      }
    } else {
      // Essayer d'abord l'API AJAX (plus rapide)
      const ajaxResults = await searchBedethequeAjax(query);
      
      if (ajaxResults.length > 0) {
        // Prendre toutes les séries trouvées (jusqu'à 10 max pour éviter trop de requêtes)
        seriesData = ajaxResults.slice(0, 10).map(s => {
          const slug = s.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
          return {
            id: s.id,
            name: s.name,
            url: `${BEDETHEQUE_BASE_URL}/serie-${s.id}-BD-${slug}.html`
          };
        });
        log.debug(`Utilisé AJAX: ${seriesData.length} séries`);
      } else {
        // Fallback sur la recherche classique avec FlareSolverr
        log.debug(`AJAX sans résultat, fallback sur scraping`);
        const seriesResult = await searchBedetheque(query, { max: 10 });
        if (seriesResult.results && seriesResult.results.length > 0) {
          seriesData = seriesResult.results.slice(0, 10).map(s => ({
            id: s.id,
            name: s.name,
            url: s.url
          }));
        }
      }
    }
    
    if (seriesData.length === 0) {
      return {
        query,
        searchType: 'albums',
        resultsCount: 0,
        results: [],
        source: 'bedetheque',
        note: 'Aucune série trouvée correspondant à la recherche.'
      };
    }
    
    // Récupérer les albums de chaque série trouvée
    const allAlbums = [];
    const normalizedQuery = normalizeStr(query);
    
    for (const serie of seriesData) {
      if (allAlbums.length >= max) break;
      
      let albumsUrl;
      if (serie.url) {
        albumsUrl = serie.url.replace('/serie-', '/albums-');
      } else {
        albumsUrl = `${BEDETHEQUE_BASE_URL}/albums-${serie.id}-BD-.html`;
      }
      log.debug(`Récupération albums série ${serie.id}: ${albumsUrl}`);
      
      const response = await fetchViaProxy(`${FSR_BASE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: "request.get",
          url: albumsUrl,
          maxTimeout: 30000,
          session: getFsrSessionId()
        })
      });

      const data = await response.json();
      
      if (data.status !== "ok") {
        log.debug(`Erreur pour série ${serie.id}: ${data.message}`);
        continue;
      }

      const html = data.solution?.response || "";
      
      // Extraire le nom de la série depuis le HTML si pas déjà connu
      let currentSerieName = serie.name;
      if (!currentSerieName) {
        const serieNameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        currentSerieName = serieNameMatch ? decodeHtmlEntities(serieNameMatch[1].trim()) : null;
      }
      
      // Parser les albums - format gallery-couv-large
      const seenIds = new Set();
      const albumBlockRegex = /<li>\s*<a[^>]*href="([^"]*\/BD-[^"]*-(\d+)\.html)"[^>]*title="([^"]*)"[^>]*>\s*<img[^>]*src="([^"]*)"[^>]*>\s*<\/a>\s*<div class="sous-titre">([\s\S]*?)<\/div>\s*<\/li>/gi;
      let blockMatch;
      
      while ((blockMatch = albumBlockRegex.exec(html)) !== null && allAlbums.length < max) {
        const [, url, albumId, titleAttr, thumbnail, sousTitreHtml] = blockMatch;
        
        if (!albumId || seenIds.has(albumId)) continue;
        seenIds.add(albumId);
        
        // Extraire tome et titre depuis le sous-titre
        let tome = null;
        let tomeVariant = null;
        let albumTitle = null;
        
        // Chercher une variante numa-serie
        const numaSerieMatch = sousTitreHtml.match(/<span class="numa-serie"><b>([a-zA-Z]+)<\/b>\s*-\s*<\/span>/i);
        if (numaSerieMatch) {
          tomeVariant = numaSerieMatch[1];
        }
        
        // Extraire le tome
        const tomeMatch = sousTitreHtml.match(/<b>(?:Tome\s*)?(\d+)([a-zA-Z]*)<\/b>/i);
        const intMatch = sousTitreHtml.match(/<b>(INT|HS|TL)<\/b>/i);
        
        if (tomeMatch) {
          tome = parseInt(tomeMatch[1]) || null;
          if (tomeMatch[2] && !tomeVariant) {
            tomeVariant = tomeMatch[2];
          }
        } else if (intMatch) {
          tomeVariant = intMatch[1];
        }
        
        // Extraire le titre
        let cleanText = sousTitreHtml
          .replace(/<b>[^<]*<\/b>\s*-?\s*/gi, '')
          .replace(/<span[^>]*>[^<]*<\/span>\s*/gi, '')
          .replace(/<[^>]*>/g, '')
          .trim();
        
        if (cleanText) {
          albumTitle = decodeHtmlEntities(cleanText);
        }
        
        // Fallback: extraire du title attribute
        if (!albumTitle && titleAttr) {
          const titleMatch = titleAttr.match(/Album de .+? -(\d+[a-zA-Z]?)- (.+)$/i);
          if (titleMatch) {
            albumTitle = decodeHtmlEntities(titleMatch[2].trim());
            if (!tome) {
              const numPart = titleMatch[1];
              tome = parseInt(numPart) || null;
              const variantMatch = numPart.match(/\d+([a-zA-Z]+)/);
              if (variantMatch) tomeVariant = variantMatch[1];
            }
          }
        }
        
        // Filtrer par pertinence si plusieurs séries
        if (query && !serieId && seriesData.length > 1) {
          const normalizedTitle = normalizeStr(albumTitle || '');
          const normalizedSerie = normalizeStr(currentSerieName || '');
          if (!normalizedTitle.includes(normalizedQuery) && !normalizedSerie.includes(normalizedQuery)) {
            continue;
          }
        }
        
        allAlbums.push({
          id: parseInt(albumId),
          type: 'album',
          title: albumTitle,
          tome: tome,
          tomeVariant: tomeVariant || undefined,
          serie: currentSerieName ? { id: serie.id, name: currentSerieName } : null,
          image: thumbnail ? [thumbnail] : [],
          url: url,
          source: 'bedetheque'
        });
      }
    }

    const result = {
      query,
      searchType: 'albums',
      seriesSearched: seriesData.map(s => s.id),
      resultsCount: allAlbums.length,
      results: allAlbums,
      source: 'bedetheque',
      note: serieId 
        ? 'Albums de la série spécifiée' 
        : 'Albums trouvés via recherche de séries.'
    };

    log.debug(`✅ ${allAlbums.length} albums trouvés`);
    return result;

  } catch (err) {
    metrics.sources.bedetheque.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS SÉRIE
// ============================================================================

/**
 * Récupère les détails d'une série Bedetheque par ID
 * @param {string|number} serieId - ID de la série
 * @returns {Promise<object>} - Détails de la série
 */
export async function getBedethequeSerieById(serieId) {
  metrics.sources.bedetheque.requests++;
  
  const cacheKey = `bedetheque_serie_${serieId}`;
  try {
    log.debug(`Récupération série ID: ${serieId}`);
    
    const serieUrl = `${BEDETHEQUE_BASE_URL}/serie-${serieId}-BD-.html`;
    
    const response = await fetchViaProxy(`${FSR_BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get",
        url: serieUrl,
        maxTimeout: 30000,
        session: getFsrSessionId()
      })
    });

    const data = await response.json();
    
    if (data.status !== "ok") {
      throw new Error(`FlareSolverr error: ${data.message || 'Unknown error'}`);
    }

    const html = data.solution?.response || "";
    const finalUrl = data.solution?.url || serieUrl;

    // Extraire le titre de la série
    let serieName = null;
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || 
                       html.match(/<title>([^<|]+)/i);
    if (titleMatch) {
      serieName = decodeHtmlEntities(titleMatch[1].trim());
    }

    // Extraire la description/synopsis
    let synopsis = null;
    const synopsisMatch = html.match(/<div class="serie-info"[^>]*>([\s\S]*?)<\/div>/i) ||
                          html.match(/<p class="serie-resume"[^>]*>([\s\S]*?)<\/p>/i);
    if (synopsisMatch) {
      synopsis = decodeHtmlEntities(synopsisMatch[1].replace(/<[^>]+>/g, ' ').trim());
    }

    // Extraire l'image de couverture
    let cover = null;
    const coverMatch = html.match(/src="(https?:\/\/[^"]*couv[^"]*\.jpg)"/i) ||
                       html.match(/src="(https?:\/\/[^"]*media[^"]*\.jpg)"/i);
    if (coverMatch) {
      cover = coverMatch[1];
    }

    // Extraire les albums
    const albums = [];
    const albumRegex = /<a[^>]*href="(https?:\/\/www\.bedetheque\.com\/BD-[^"]*-(\d+)\.html)"[^>]*title="([^"]*)"[^>]*>/gi;
    let match;
    const seenAlbumIds = new Set();
    
    while ((match = albumRegex.exec(html)) !== null) {
      const [, url, id, title] = match;
      
      if (seenAlbumIds.has(id)) continue;
      seenAlbumIds.add(id);
      
      const cleanTitle = decodeHtmlEntities(title.trim());
      if (!cleanTitle) continue;
      
      albums.push({
        id: parseInt(id),
        title: cleanTitle,
        url,
        source: 'bedetheque'
      });
    }

    // Extraire les auteurs
    const authors = [];
    const authorRegex = /<a[^>]*href="[^"]*auteur-[^"]*"[^>]*>([^<]+)<\/a>/gi;
    while ((match = authorRegex.exec(html)) !== null) {
      const name = decodeHtmlEntities(match[1].trim());
      if (name && !authors.includes(name)) {
        authors.push(name);
      }
    }

    // Extraire le genre
    let genre = null;
    const genreMatch = html.match(/Genre\s*:\s*<[^>]*>([^<]+)/i);
    if (genreMatch) {
      genre = decodeHtmlEntities(genreMatch[1].trim());
    }

    // Extraire le statut
    let status = null;
    if (html.includes('Série terminée') || html.includes('série terminée')) {
      status = 'Terminée';
    } else if (html.includes('Série en cours') || html.includes('série en cours')) {
      status = 'En cours';
    }

    const result = {
      id: parseInt(serieId),
      type: 'serie',
      title: serieName,
      originalTitle: null,
      authors: authors,
      editors: [],
      releaseDate: null,
      genres: genre ? [genre] : [],
      pages: null,
      serie: null,
      synopsis: synopsis,
      language: 'fr',
      tome: null,
      image: cover ? [cover] : [],
      isbn: null,
      price: null,
      status: status,
      albumCount: albums.length,
      albums: albums,
      url: finalUrl,
      source: 'bedetheque'
    };

    log.debug(`✅ Série récupérée: ${result.title || 'Unknown'} (${albums.length} albums)`);
    return result;

  } catch (err) {
    metrics.sources.bedetheque.errors++;
    throw err;
  }
}

// ============================================================================
// DÉTAILS ALBUM
// ============================================================================

/**
 * Récupère les détails d'un album Bedetheque par ID
 * @param {string|number} albumId - ID de l'album
 * @returns {Promise<object>} - Détails de l'album
 */
export async function getBedethequeAlbumById(albumId) {
  metrics.sources.bedetheque.requests++;
  
  const cacheKey = `bedetheque_album_${albumId}`;
  try {
    log.debug(`Récupération album ID: ${albumId}`);
    
    const albumUrl = `${BEDETHEQUE_BASE_URL}/BD--${albumId}.html`;
    
    const response = await fetchViaProxy(`${FSR_BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get",
        url: albumUrl,
        maxTimeout: 30000,
        session: getFsrSessionId()
      })
    });

    const data = await response.json();
    
    if (data.status !== "ok") {
      throw new Error(`FlareSolverr error: ${data.message || 'Unknown error'}`);
    }

    const html = data.solution?.response || "";
    const finalUrl = data.solution?.url || albumUrl;

    // Extraire le titre de la série (h1) et le titre de l'album (h2)
    let serieTitle = null;
    let albumTitle = null;
    
    const serieTitleMatch = html.match(/<h1[^>]*>\s*<a[^>]*>([^<]+)<\/a>\s*<\/h1>/i);
    if (serieTitleMatch) {
      serieTitle = decodeHtmlEntities(serieTitleMatch[1].trim());
    }
    
    const albumTitleMatch = html.match(/<h2[^>]*>(?:[\s\S]*?<\/span>)?\s*\.?\s*([^<]+?)\s*<\/h2>/i);
    if (albumTitleMatch) {
      albumTitle = decodeHtmlEntities(albumTitleMatch[1].trim())
        .replace(/^\s*\.\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    if (!albumTitle) {
      const metaNameMatch = html.match(/<meta\s+itemprop="name"\s+content="([^"]+)"/i);
      if (metaNameMatch) {
        albumTitle = decodeHtmlEntities(metaNameMatch[1].trim());
      }
    }

    // Extraire la série avec ID
    let serie = null;
    const serieMatch = html.match(/<a[^>]*href="[^"]*serie-(\d+)-[^"]*"[^>]*title="([^"]+)"[^>]*>/i) ||
                       html.match(/<a[^>]*href="[^"]*serie-(\d+)-[^"]*"[^>]*>([^<]+)<\/a>/i);
    if (serieMatch) {
      serie = {
        id: parseInt(serieMatch[1]),
        name: decodeHtmlEntities(serieMatch[2].trim())
      };
    }

    // Extraire le tome
    let tome = null;
    let tomeVariant = null;
    const tomeFullMatch = html.match(/<h2[^>]*>\s*(\d+)\s*(?:<span[^>]*>([a-z])<\/span>)?/i);
    if (tomeFullMatch) {
      tome = parseInt(tomeFullMatch[1]);
      tomeVariant = tomeFullMatch[2] || null;
    }

    // Extraire les images
    const images = [];
    
    const coverMatch = html.match(/src="(https?:\/\/[^"]*\/media\/Couvertures\/[^"]+\.jpg)"/i) ||
                       html.match(/itemprop="image"[^>]*src="([^"]+)"/i);
    if (coverMatch) {
      images.push(coverMatch[1]);
    }
    
    const planchesRegex = /href="(https?:\/\/[^"]*\/media\/Planches\/[^"]+\.jpg)"/gi;
    let plancheMatch;
    while ((plancheMatch = planchesRegex.exec(html)) !== null) {
      if (!images.includes(plancheMatch[1])) {
        images.push(plancheMatch[1]);
      }
    }
    
    const versoMatch = html.match(/href="(https?:\/\/[^"]*\/media\/Versos\/[^"]+\.jpg)"/i);
    if (versoMatch && !images.includes(versoMatch[1])) {
      images.push(versoMatch[1]);
    }

    // Extraire le synopsis
    let synopsis = null;
    const synopsisMatch = html.match(/<div class="album-resume"[^>]*>([\s\S]*?)<\/div>/i) ||
                          html.match(/<p class="resume"[^>]*>([\s\S]*?)<\/p>/i) ||
                          html.match(/id="p-serie"[^>]*>([\s\S]*?)<\/p>/i);
    if (synopsisMatch) {
      synopsis = decodeHtmlEntities(synopsisMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      if (!synopsis || synopsis.length < 5) synopsis = null;
    }

    // Extraire l'ISBN
    let isbn = null;
    const isbnMatch = html.match(/ISBN\s*:?\s*([0-9X-]+)/i) ||
                      html.match(/EAN\s*:?\s*(\d{13})/i);
    if (isbnMatch) {
      isbn = isbnMatch[1].replace(/-/g, '');
    }

    // Extraire la date
    let releaseDate = null;
    let year = null;
    
    const depotLegalMatch = html.match(/icon-calendar[^>]*><\/i>\s*(\d{1,2}\/\d{4})/i) ||
                            html.match(/Dépot légal[^>]*>\s*(\d{1,2}\/\d{4})/i);
    if (depotLegalMatch) {
      releaseDate = depotLegalMatch[1].trim();
      const yearFromDate = releaseDate.match(/(\d{4})/);
      if (yearFromDate) year = parseInt(yearFromDate[1]);
    }
    
    if (!releaseDate) {
      const metaDateMatch = html.match(/<meta\s+itemprop="datePublished"\s+content="([^"]+)"/i);
      if (metaDateMatch) {
        releaseDate = metaDateMatch[1];
        const yearFromMeta = releaseDate.match(/(\d{4})/);
        if (yearFromMeta) year = parseInt(yearFromMeta[1]);
      }
    }
    
    if (!year) {
      const yearMatch = html.match(/<span class="annee">(\d{4})<\/span>/i);
      if (yearMatch) {
        year = parseInt(yearMatch[1]);
      }
    }

    // Extraire l'éditeur
    let publisher = null;
    const publisherMatch = html.match(/itemprop="publisher"[^>]*>([^<]+)<\/span>/i) ||
                           html.match(/class="editeur"[^>]*>([^<]+)<\/span>/i);
    if (publisherMatch) {
      publisher = decodeHtmlEntities(publisherMatch[1].trim());
    }

    // Extraire les auteurs
    const authors = [];
    const authorsDetailed = [];
    
    const listeAuteursMatch = html.match(/<div class="liste-auteurs">([\s\S]*?)<\/div>/i);
    if (listeAuteursMatch) {
      const listeHtml = listeAuteursMatch[1];
      const auteurRoleRegex = /<a[^>]*href="[^"]*auteur-(\d+)[^"]*"[^>]*>\s*([^<]+)\s*<\/a>\s*<span class="metier">\(([^)]+)\)<\/span>/gi;
      let auteurMatch;
      while ((auteurMatch = auteurRoleRegex.exec(listeHtml)) !== null) {
        const authorId = parseInt(auteurMatch[1]);
        const name = decodeHtmlEntities(auteurMatch[2].trim());
        const role = decodeHtmlEntities(auteurMatch[3].trim());
        
        if (name && !authors.includes(name)) {
          authors.push(name);
        }
        authorsDetailed.push({ id: authorId, name: name, role: role });
      }
    }
    
    if (authors.length === 0) {
      const authorRegex = /<a[^>]*href="[^"]*auteur-[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>\s*<\/a>/gi;
      let match;
      while ((match = authorRegex.exec(html)) !== null) {
        const name = decodeHtmlEntities(match[1].trim());
        if (name && !authors.includes(name)) {
          authors.push(name);
        }
      }
    }

    // Extraire le prix
    let price = null;
    const priceMatch = html.match(/Prix\s*:?\s*([0-9,.]+)\s*€/i) ||
                       html.match(/(\d+[.,]\d{2})\s*€/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(',', '.'));
    }

    // Extraire le nombre de pages
    let pages = null;
    const pagesMatch = html.match(/itemprop="numberOfPages"[^>]*>(\d+)<\/span>/i) ||
                       html.match(/(\d+)\s*pages/i);
    if (pagesMatch) {
      pages = parseInt(pagesMatch[1]);
    }

    // Extraire le genre
    const genres = [];
    const genreMatch = html.match(/<meta\s+itemprop="genre"\s+content="([^"]+)"/i);
    if (genreMatch) {
      const genreParts = genreMatch[1].split(' - ').map(g => g.trim()).filter(g => g);
      genres.push(...genreParts);
    }

    // Extraire le format
    let format = null;
    const formatMatch = html.match(/icon-tablet[^>]*><\/i>\s*([^<]+)/i) ||
                        html.match(/Format\s*:\s*([^<\n]+)/i);
    if (formatMatch) {
      format = decodeHtmlEntities(formatMatch[1].trim());
    }

    // Extraire le type de couverture
    let coverType = null;
    if (html.includes('title="Couverture souple"')) {
      coverType = 'souple';
    } else if (html.includes('title="Couverture rigide"') || html.includes('title="Couverture cartonnée"')) {
      coverType = 'rigide';
    }

    // Vérifier si édition originale
    const isOriginalEdition = html.includes('title="Edition originale"');

    // Extraire l'estimation
    let estimation = null;
    const estimationMatch = html.match(/<label>Estimation\s*:\s*<\/label>([^<]+)/i);
    if (estimationMatch) {
      const estValue = estimationMatch[1].trim();
      if (estValue.toLowerCase() !== 'non coté' && estValue !== '') {
        const priceFromEst = estValue.match(/([0-9,.]+)\s*€?/);
        if (priceFromEst) {
          estimation = parseFloat(priceFromEst[1].replace(',', '.'));
        } else {
          estimation = estValue;
        }
      }
    }

    // EAN/ISBN fallback
    if (!isbn) {
      const eanIsbnMatch = html.match(/<label>EAN\/ISBN\s*:\s*<\/label>\s*<span>([^<]*)<\/span>/i);
      if (eanIsbnMatch && eanIsbnMatch[1].trim()) {
        isbn = eanIsbnMatch[1].trim().replace(/-/g, '');
      }
    }

    // Collection
    let collection = null;
    const collectionMatch = html.match(/<label>Collection\s*:\s*<\/label>\s*<span>([^<]+)<\/span>/i) ||
                            html.match(/<label>Collection\s*:\s*<\/label>([^<]+)/i);
    if (collectionMatch) {
      collection = decodeHtmlEntities(collectionMatch[1].trim());
    }

    // Langue
    let language = 'fr';
    const langMatch = html.match(/<meta\s+itemprop="inLanguage"\s+content="([^"]+)"/i);
    if (langMatch) {
      language = langMatch[1];
    }

    const result = {
      id: parseInt(albumId),
      type: 'album',
      title: albumTitle || serieTitle,
      originalTitle: null,
      authors: authors,
      authorsDetailed: authorsDetailed.length > 0 ? authorsDetailed : undefined,
      editors: publisher ? [publisher] : [],
      collection: collection,
      releaseDate: releaseDate,
      year: year,
      genres: genres,
      pages: pages,
      format: format,
      coverType: coverType,
      isOriginalEdition: isOriginalEdition,
      serie: serie,
      tome: tome,
      tomeVariant: tomeVariant,
      synopsis: synopsis,
      language: language,
      image: images,
      isbn: isbn,
      price: price,
      estimation: estimation,
      url: finalUrl,
      source: 'bedetheque'
    };

    log.debug(`✅ Album récupéré: ${result.title || 'Unknown'}`);
    return result;

  } catch (err) {
    metrics.sources.bedetheque.errors++;
    throw err;
  }
}

// ============================================================================
// FONCTIONS NORMALISÉES (v3.0)
// ============================================================================

/**
 * Recherche séries Bedetheque avec résultats normalisés
 * @param {string} query - Requête de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<Array>} - Résultats normalisés
 */
export async function searchBedethequeNormalized(query, options = {}) {
  const result = await searchBedetheque(query, options);
  return (result.results || []).map(normalizeBedethequeSerieSearch);
}

/**
 * Recherche albums Bedetheque avec résultats normalisés
 * @param {string} query - Requête de recherche
 * @param {object} options - Options de recherche
 * @returns {Promise<Array>} - Résultats normalisés
 */
export async function searchBedethequeAlbumsNormalized(query, options = {}) {
  const result = await searchBedethequeAlbums(query, options);
  return (result.results || []).map(normalizeBedethequeSearch);
}

/**
 * Récupère les détails d'une série Bedetheque normalisés avec traduction optionnelle
 * @param {string|number} serieId - ID de la série
 * @param {object} options - Options de traduction { lang, autoTrad }
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getBedethequeSerieByIdNormalized(serieId, options = {}) {
  const { lang = null, autoTrad = false } = options;
  const result = await getBedethequeSerieById(serieId);
  const normalized = normalizeBedethequeSerieDetail(result);
  
  // Appliquer la traduction si demandée (source = français)
  const shouldTranslate = autoTrad && lang;
  const destLang = lang ? extractLangCode(lang) : null;
  
  if (shouldTranslate && destLang && destLang !== 'fr') {
    // Traduire le synopsis
    if (normalized.synopsis) {
      try {
        const synopsisResult = await translateText(normalized.synopsis, destLang, { 
          enabled: true,
          sourceLang: 'fr',  // Source: français (Bedetheque est une source française)
          detectEnglish: false  // Pas besoin de détecter, on sait que c'est du français
        });
        if (synopsisResult.translated) {
          normalized.synopsis = synopsisResult.text;
        }
      } catch (err) {
        log.warn(`Erreur traduction synopsis série: ${err.message}`);
      }
    }
    
    // Traduire les genres
    if (normalized.genres && normalized.genres.length > 0) {
      try {
        const genresResult = await translateGenres(normalized.genres, destLang, { sourceLang: 'fr' });
        if (genresResult.genresTranslated && genresResult.genres) {
          normalized.genres = genresResult.genres;
        }
      } catch (err) {
        log.warn(`Erreur traduction genres série: ${err.message}`);
      }
    }
  }
  
  return normalized;
}

/**
 * Récupère les détails d'un album Bedetheque normalisés avec traduction optionnelle
 * @param {string|number} albumId - ID de l'album
 * @param {object} options - Options de traduction { lang, autoTrad }
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getBedethequeAlbumByIdNormalized(albumId, options = {}) {
  const { lang = null, autoTrad = false } = options;
  const result = await getBedethequeAlbumById(albumId);
  const normalized = normalizeBedethequeAlbumDetail(result);
  
  // Appliquer la traduction si demandée (source = français)
  const shouldTranslate = autoTrad && lang;
  const destLang = lang ? extractLangCode(lang) : null;
  
  log.debug(`Album ${albumId}: autoTrad=${autoTrad}, lang=${lang}, destLang=${destLang}, shouldTranslate=${shouldTranslate}`);
  
  if (shouldTranslate && destLang && destLang !== 'fr') {
    log.debug(`Traduction demandée vers ${destLang}`);
    // Traduire le synopsis
    if (normalized.synopsis) {
      try {
        log.debug(`Traduction synopsis (${normalized.synopsis.substring(0, 50)}...)`);
        const synopsisResult = await translateText(normalized.synopsis, destLang, { 
          enabled: true,
          sourceLang: 'fr',  // Source: français (Bedetheque est une source française)
          detectEnglish: false  // Pas besoin de détecter, on sait que c'est du français
        });
        log.debug(`Résultat traduction: translated=${synopsisResult.translated}`);
        if (synopsisResult.translated) {
          normalized.synopsis = synopsisResult.text;
        }
      } catch (err) {
        log.warn(`Erreur traduction synopsis: ${err.message}`);
      }
    }
    
    // Traduire les genres
    if (normalized.genres && normalized.genres.length > 0) {
      try {
        const genresResult = await translateGenres(normalized.genres, destLang, { sourceLang: 'fr' });
        if (genresResult.genresTranslated && genresResult.genres) {
          normalized.genres = genresResult.genres;
        }
      } catch (err) {
        log.warn(`Erreur traduction genres: ${err.message}`);
      }
    }
  }
  
  return normalized;
}
