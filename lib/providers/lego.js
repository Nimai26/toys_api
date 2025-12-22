/**
 * lib/providers/lego.js - Provider LEGO
 * 
 * Recherche et détails de produits LEGO via GraphQL/scraping
 * Utilise FlareSolverr pour bypass Cloudflare
 * 
 * @module providers/lego
 */

import { getCached, setCache, metrics } from '../utils/state.js';
import { createLogger } from '../utils/logger.js';
import { 
  fsrRequest, 
  createFsrSession, 
  destroyFsrSession,
  ensureFsrSession,
  getFsrSessionId,
  setFsrSessionId,
  getLastLegoHomeVisit,
  setLastLegoHomeVisit,
  areLegoSessionCookiesValid,
  LEGO_SESSION_TTL
} from '../utils/flaresolverr.js';
import { DEFAULT_LOCALE, MAX_RETRIES } from '../config.js';
import { normalizeLegoSearch, normalizeLegoDetail } from '../normalizers/construct-toy.js';

const log = createLogger('LEGO');

// ========================================
// Configuration LEGO
// ========================================
const GRAPHQL_URL = "https://www.lego.com/api/graphql/SearchProductsQuery";

// ========================================
// Query GraphQL complète
// ========================================
const GRAPHQL_QUERY = `query SearchProductsQuery($searchSessionId: Int, $q: String!, $page: Int!, $perPage: Int!, $sort: SortInput, $filters: [Filter!], $visibility: ProductVisibility, $offset: Int) {
  searchProducts(
    searchSession: $searchSessionId
    query: $q
    page: $page
    perPage: $perPage
    filters: $filters
    sort: $sort
    visibility: $visibility
  ) {
    ... on RedirectAction {
      __typename
      url
    }
    ... on SearchProducts {
      __typename
      productResult {
        count
        total
        results {
          __typename
          id
          productCode
          name
          slug
          primaryImage(size: THUMBNAIL)
          baseImgUrl: primaryImage
          ... on SingleVariantProduct {
            variant {
              id
              sku
              salePercentage
              attributes {
                rating
                availabilityStatus
                availabilityText
                canAddToBag
                onSale
                isNew
                ageRange
                pieceCount
              }
              price {
                formattedAmount
                centAmount
                currencyCode
              }
              listPrice {
                formattedAmount
                centAmount
              }
            }
          }
        }
      }
      resultFor
    }
    __typename
  }
}`;

// ========================================
// Fonctions utilitaires
// ========================================

/**
 * Récupérer cookies et token via FSR en visitant la page de recherche
 */
export async function obtainSessionData(searchTerm, lang = DEFAULT_LOCALE) {
  const searchUrl = `https://www.lego.com/${lang.toLowerCase()}/search?q=${encodeURIComponent(searchTerm)}`;
  const fsrSessionId = getFsrSessionId();
  const sol = await fsrRequest("request.get", searchUrl);
  
  const cookies = Array.isArray(sol.cookies) ? sol.cookies : [];
  const html = sol.response || "";
  
  let authorization = null;
  
  const authCookie = cookies.find(c => c.name && (c.name.toLowerCase() === "gqauth" || c.name === "authorization"));
  if (authCookie) {
    authorization = authCookie.value;
  }
  
  if (!authorization) {
    const jwtPattern = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
    const matches = html.match(jwtPattern);
    if (matches && matches.length > 0) {
      authorization = matches[0];
    }
  }
  
  return { cookies, authorization, html };
}

/**
 * Construire string Cookie pour header
 */
export function cookiesToHeader(cookieArray = []) {
  if (!Array.isArray(cookieArray) || cookieArray.length === 0) return "";
  return cookieArray.map(c => `${c.name}=${c.value}`).join("; ");
}

/**
 * Valider un ID produit LEGO
 */
export function isValidLegoProductId(id) {
  if (!id) return false;
  
  const idStr = String(id);
  
  if (/[?&=]/.test(idStr)) return false;
  if (idStr.includes('tbd') || idStr.includes('icmp')) return false;
  
  const numericMatch = idStr.match(/^(\d{4,6})$/);
  if (numericMatch) return true;
  
  const slugMatch = idStr.match(/-(\d{4,6})$/);
  if (slugMatch) return true;
  
  return false;
}

/**
 * Nettoyer et extraire l'ID numérique d'un produit LEGO
 */
export function extractLegoProductId(id) {
  if (!id) return null;
  
  const idStr = String(id);
  
  const numericMatch = idStr.match(/^(\d{4,6})$/);
  if (numericMatch) return numericMatch[1];
  
  const slugMatch = idStr.match(/(\d{4,6})(?:\?|$)/);
  if (slugMatch) return slugMatch[1];
  
  return null;
}

// ========================================
// Fonction principale de recherche
// ========================================

/**
 * Recherche de produits LEGO via GraphQL ou scraping
 * @param {string} searchTerm - Terme de recherche
 * @param {string} lang - Langue/locale (default: DEFAULT_LOCALE)
 * @param {number} retries - Nombre max de tentatives
 * @param {number} perPage - Nombre de résultats par page
 * @returns {Promise<object>} - Résultats de recherche
 */
export async function callLegoGraphql(searchTerm, lang = DEFAULT_LOCALE, retries = MAX_RETRIES, perPage = 24) {
  const cacheKey = `lego:search:${searchTerm}:${lang}:${perPage}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour recherche: "${searchTerm}"`);
      
      if (!getFsrSessionId()) {
        await ensureFsrSession();
      }
      
      const now = Date.now();
      if (now - getLastLegoHomeVisit() > LEGO_SESSION_TTL) {
        log.debug("Visite de la page d'accueil LEGO pour rafraîchir les cookies...");
        const homeSolution = await fsrRequest("request.get", `https://www.lego.com/${lang.toLowerCase()}/`, null, {}, 30000);
        const cookies = homeSolution.cookies || [];
        log.debug(`Obtenu ${cookies.length} cookies`);
        setLastLegoHomeVisit(now);
      } else {
        log.debug("Cookies LEGO encore valides, skip visite page d'accueil");
      }
      
      // Essayer GraphQL d'abord
      const variables = {
        q: searchTerm,
        page: 1,
        perPage: Math.min(perPage, 100),
        sort: { key: "RELEVANCE", direction: "DESC" }
      };
      
      const graphqlPayload = {
        operationName: "SearchProductsQuery",
        variables: variables,
        query: GRAPHQL_QUERY
      };
      
      log.debug("Appel GraphQL via FlareSolverr POST...");
      
      try {
        const graphqlSolution = await fsrRequest("request.post", GRAPHQL_URL, null, {
          postData: JSON.stringify(graphqlPayload)
        }, 60000);
        
        const responseText = graphqlSolution.response || "";
        
        if (responseText.includes('"data"') && responseText.includes('"searchProducts"')) {
          const graphqlResponse = JSON.parse(responseText);
          
          if (graphqlResponse.data?.searchProducts?.productResult) {
            const productResult = graphqlResponse.data.searchProducts.productResult;
            const results = productResult.results || [];
            
            const products = results
              .map(p => ({
                id: extractLegoProductId(p.productCode || p.id) || p.id,
                productCode: extractLegoProductId(p.productCode) || p.productCode,
                name: p.name,
                slug: p.slug,
                thumb: p.primaryImage || null,
                baseImgUrl: p.baseImgUrl || null,
                variant: p.variant || null
              }))
              .filter(p => {
                const isValid = isValidLegoProductId(p.id) || isValidLegoProductId(p.productCode);
                if (!isValid) {
                  log.debug(` Filtré produit invalide: ${p.id} (${p.name})`);
                }
                return isValid;
              });
            
            log.info(`✅ GraphQL: Trouvé ${results.length} produits, ${products.length} valides après filtrage`);
            
            const result = {
              products,
              total: products.length,
              count: products.length,
              resultFor: graphqlResponse.data.searchProducts.resultFor || searchTerm
            };
            
            setCache(cacheKey, result);
            metrics.sources.lego = metrics.sources.lego || { requests: 0, errors: 0 };
            metrics.sources.lego.requests++;
            return result;
          }
        }
        
        log.debug("Réponse GraphQL non valide, fallback sur scraping...");
      } catch (graphqlErr) {
        log.debug("Erreur GraphQL:", graphqlErr.message, "- fallback sur scraping...");
      }
      
      // Fallback: Scraper la page de recherche
      const searchUrl = `https://www.lego.com/${lang.toLowerCase()}/search?q=${encodeURIComponent(searchTerm)}`;
      log.debug("Visite de la page:", searchUrl);
      
      const pageSolution = await fsrRequest("request.get", searchUrl, null, {
        waitInSeconds: 2
      }, 60000);
      
      const html = pageSolution.response || "";
      log.debug("Page reçue, taille:", html.length);
      
      let products = [];
      let total = 0;
      let resultFor = searchTerm;
      
      // Chercher dans __NEXT_DATA__
      const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const pageProps = nextData?.props?.pageProps;
          const apolloState = pageProps?.__APOLLO_STATE__ || pageProps?.initialApolloState || {};
          
          const allKeys = Object.keys(apolloState);
          const productKeys = allKeys.filter(k => 
            k.startsWith("SingleVariantProduct:") || 
            k.startsWith("Product:") ||
            k.startsWith("MultiVariantProduct:")
          );
          
          log.debug(`Trouvé ${productKeys.length} clés de produits dans Apollo State`);
          
          if (productKeys.length > 0) {
            for (const key of productKeys) {
              const product = apolloState[key];
              if (product && product.name) {
                let variantData = product.variant;
                if (variantData?.__ref) {
                  variantData = apolloState[variantData.__ref];
                }
                
                let priceData = variantData?.price;
                if (priceData?.__ref) {
                  priceData = apolloState[priceData.__ref];
                }
                
                products.push({
                  id: product.id,
                  productCode: product.productCode,
                  name: product.name,
                  slug: product.slug,
                  image: product.primaryImage || product.baseImgUrl || null,
                  thumb: product.primaryImage || product.baseImgUrl || null,
                  baseImgUrl: product.baseImgUrl || null,
                  variant: variantData ? {
                    id: variantData.id,
                    sku: variantData.sku,
                    price: priceData,
                    attributes: variantData.attributes
                  } : null
                });
              }
            }
          }
        } catch (parseErr) {
          log.error("Erreur parsing __NEXT_DATA__:", parseErr.message);
        }
      }
      
      // Méthode 2: Parser HTML si pas de produits dans __NEXT_DATA__
      if (products.length === 0) {
        log.debug("Recherche de produits dans le HTML...");
        
        const productLinkPattern = /href="\/[a-z]{2}-[a-z]{2}\/product\/([^"]+)"/gi;
        const productMatches = [...html.matchAll(productLinkPattern)];
        
        // Chercher les images
        const imgPatterns = [
          /src="(https:\/\/[^"]*(?:lego|brickset)[^"]*\/(?:products|images|set\/assets)[^"]*\.(jpg|png|webp)[^"]*)"/gi,
          /srcset="([^"]*lego[^"]*)/gi,
          /data-src="(https:\/\/[^"]*lego[^"]*\.(jpg|png|webp)[^"]*)"/gi
        ];
        
        const allImages = [];
        for (const pattern of imgPatterns) {
          const matches = [...html.matchAll(pattern)];
          for (const m of matches) {
            const cleanUrl = m[1].replace(/&amp;/g, '&');
            allImages.push(cleanUrl);
          }
        }
        
        const productImages = new Map();
        for (const imgUrl of allImages) {
          const cleanedUrl = imgUrl.replace(/\?(.*?)$/, '');
          const codePatterns = [
            /\/(\d{5,6})(?:\/|_|\.|$)/,
            /_(\d{5,6})(?:_|\.|$)/,
            /-(\d{5,6})(?:-|\.|$)/
          ];
          
          for (const cp of codePatterns) {
            const match = cleanedUrl.match(cp);
            if (match && !productImages.has(match[1])) {
              productImages.set(match[1], cleanedUrl);
              break;
            }
          }
        }
        
        // Chercher les noms
        const productNames = new Map();
        const ariaLabelPattern = /aria-label="([^"]+)"[^>]*href="\/[a-z]{2}-[a-z]{2}\/product\/([^"]+)"/gi;
        for (const match of html.matchAll(ariaLabelPattern)) {
          const name = match[1].trim();
          const slug = match[2];
          if (slug && name && !productNames.has(slug)) {
            productNames.set(slug, name);
          }
        }
        
        const ariaLabelPattern2 = /href="\/[a-z]{2}-[a-z]{2}\/product\/([^"]+)"[^>]*aria-label="([^"]+)"/gi;
        for (const match of html.matchAll(ariaLabelPattern2)) {
          const slug = match[1];
          const name = match[2].trim();
          if (slug && name && !productNames.has(slug)) {
            productNames.set(slug, name);
          }
        }
        
        log.debug(`Noms de produits trouvés: ${productNames.size}`);
        
        const seenSlugs = new Set();
        for (const match of productMatches) {
          const slug = match[1];
          
          if (slug.includes('mosaic-maker') || slug.includes('mosaic_maker')) continue;
          if (slug.includes('?') || slug.includes('icmp') || slug.includes('tbd')) {
            log.debug(` Filtré slug invalide: ${slug}`);
            continue;
          }
          
          if (!seenSlugs.has(slug)) {
            seenSlugs.add(slug);
            const codeMatch = slug.match(/(\d{4,6})(?:\?|$)/);
            const productCode = codeMatch ? codeMatch[1] : null;
            
            if (!productCode || !isValidLegoProductId(productCode)) {
              log.debug(` Filtré produit sans ID valide: ${slug}`);
              continue;
            }
            
            const thumb = productCode ? productImages.get(productCode) : null;
            const localizedName = productNames.get(slug);
            const name = localizedName || slug.replace(/-/g, ' ').replace(/\d+$/, '').trim();
            
            products.push({
              id: productCode,
              productCode: productCode,
              name: name,
              slug: slug,
              image: thumb,
              thumb: thumb,
              baseImgUrl: thumb,
              variant: null
            });
          }
        }
        
        log.debug(`Trouvé ${products.length} liens produits dans le HTML (${productImages.size} images)`);
      }
      
      // Filtrage final
      const validProducts = products.filter(p => {
        const isValid = isValidLegoProductId(p.id) || isValidLegoProductId(p.productCode);
        if (!isValid) {
          log.debug(` Filtré produit final invalide: ${p.id} (${p.name})`);
        }
        return isValid;
      });
      
      total = validProducts.length;
      log.info(`✅ Trouvé ${validProducts.length} produits valides (${products.length - validProducts.length} filtrés)`);
      
      const result = { 
        products: validProducts, 
        total,
        count: validProducts.length,
        resultFor,
        htmlSize: html.length
      };
      
      setCache(cacheKey, result);
      metrics.sources.lego = metrics.sources.lego || { requests: 0, errors: 0 };
      metrics.sources.lego.requests++;
      return result;

    } catch (err) {
      lastError = err;
      log.warn(`Erreur tentative ${attempt}: ${err.message}`);
      
      if (getFsrSessionId()) {
        await destroyFsrSession();
      }
      
      if (attempt >= retries) break;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  
  metrics.sources.lego = metrics.sources.lego || { requests: 0, errors: 0 };
  metrics.sources.lego.errors++;
  throw lastError || new Error("Échec après toutes les tentatives");
}

/**
 * Récupérer les détails complets d'un produit par son ID
 * @param {string} productId - ID du produit LEGO
 * @param {string} lang - Langue/locale
 * @param {number} retries - Nombre max de tentatives
 * @returns {Promise<object>} - Détails du produit
 */
export async function getProductDetails(productId, lang = DEFAULT_LOCALE, retries = MAX_RETRIES) {
  const cacheKey = `lego:product:${productId}:${lang}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour produit: "${productId}"`);
      
      if (!getFsrSessionId()) {
        await ensureFsrSession();
      }
      
      const now = Date.now();
      if (now - getLastLegoHomeVisit() > LEGO_SESSION_TTL) {
        log.debug("Rafraîchissement cookies LEGO...");
        await fsrRequest("request.get", `https://www.lego.com/${lang.toLowerCase()}/`, null, {}, 30000);
        setLastLegoHomeVisit(now);
      }
      
      const productUrl = `https://www.lego.com/${lang.toLowerCase()}/product/${productId}`;
      log.debug("Visite de la page produit:", productUrl);
      
      const pageSolution = await fsrRequest("request.get", productUrl, null, {
        waitInSeconds: 2
      }, 60000);
      
      const html = pageSolution.response || "";
      log.debug("Page produit reçue, taille:", html.length);
      
      const isProductPage = html.includes('product-overview') || 
                            html.includes('ProductOverview') ||
                            html.includes('data-test="product-') ||
                            html.includes('/product/' + productId);
      
      if (!isProductPage && (html.includes("Cette page n'existe pas") || html.length < 100000)) {
        throw new Error("Produit non trouvé");
      }
      
      const product = {
        id: productId,
        productCode: productId,
        name: null,
        description: null,
        images: [],
        videos: [],
        ageRange: null,
        pieceCount: null,
        minifiguresCount: null,
        price: null,
        listPrice: null,
        availability: null,
        availabilityText: null,
        rating: null,
        reviewCount: null,
        themes: [],
        url: productUrl
      };
      
      // Extraction du nom - Priorité aux données JSON structurées
      // 1. D'abord chercher dans le JSON-LD (données structurées)
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const jsonLdData = JSON.parse(jsonLdMatch[1]);
          if (jsonLdData.name && !jsonLdData.name.includes('LEGO.com')) {
            product.name = jsonLdData.name.trim();
            log.debug("Nom extrait du JSON-LD:", product.name);
          }
        } catch (e) {
          log.debug("Erreur parsing JSON-LD:", e.message);
        }
      }
      
      // 2. Chercher dans les données JSON embarquées (window.__APOLLO_STATE__ ou similaire)
      if (!product.name) {
        const jsonNamePatterns = [
          /"productName"\s*:\s*"([^"]+)"/i,
          /"displayName"\s*:\s*"([^"]+)"/i,
          /"product"[^}]*"name"\s*:\s*"([^"]+)"/i
        ];
        
        for (const pattern of jsonNamePatterns) {
          const match = html.match(pattern);
          if (match && match[1].length > 3) {
            product.name = match[1].trim();
            log.debug("Nom extrait du JSON embarqué:", product.name);
            break;
          }
        }
      }
      
      // 3. Patterns HTML spécifiques
      if (!product.name) {
        const htmlNamePatterns = [
          /<h1[^>]*data-test="product-overview-name"[^>]*>([^<]+)<\/h1>/i,
          /<h1[^>]*class="[^"]*ProductOverviewstyles[^"]*"[^>]*>([^<]+)<\/h1>/i,
          /<span[^>]*data-test="product-overview-name"[^>]*>([^<]+)<\/span>/i,
          /<h1[^>]*class="[^"]*product[^"]*name[^"]*"[^>]*>([^<]+)<\/h1>/i
        ];
        
        for (const pattern of htmlNamePatterns) {
          const match = html.match(pattern);
          if (match) {
            product.name = match[1].trim();
            log.debug("Nom extrait du HTML:", product.name);
            break;
          }
        }
      }
      
      // 4. Fallback: extraire du titre de la page (souvent contient "Nom | LEGO® | Boutique")
      if (!product.name) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          const titleParts = titleMatch[1].split(/\s*[\|·]\s*/);
          if (titleParts[0] && titleParts[0].length > 3 && !titleParts[0].includes('LEGO.com')) {
            product.name = titleParts[0].trim();
            log.debug("Nom extrait du titre de page:", product.name);
          }
        }
      }
      
      // Extraction de la description
      const descPatterns = [
        /<p[^>]*data-test="product-overview-description"[^>]*>([\s\S]*?)<\/p>/i,
        /<div[^>]*class="[^"]*ProductDescription[^"]*"[^>]*>([\s\S]*?)<\/div>/i
      ];
      
      for (const pattern of descPatterns) {
        const match = html.match(pattern);
        if (match) {
          product.description = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          break;
        }
      }
      
      // Extraction des images
      const imagePatterns = [
        /src="(https:\/\/[^"]*(?:lego\.com|cloudfront)[^"]*\/(?:products|set\/assets)[^"]*\.(jpg|png|webp)[^"]*)"/gi,
        /srcset="([^"]+)"/gi,
        /data-src="(https:\/\/[^"]*lego[^"]*\.(jpg|png|webp)[^"]*)"/gi
      ];
      
      const seenImageBases = new Set();
      
      for (const pattern of imagePatterns) {
        const matches = [...html.matchAll(pattern)];
        for (const m of matches) {
          let imgUrl = m[1].replace(/&amp;/g, '&');
          
          const urlsToProcess = [];
          if (imgUrl.includes(',')) {
            const srcsetParts = imgUrl.split(',').map(s => s.trim());
            for (const part of srcsetParts) {
              urlsToProcess.push(part.split(' ')[0]);
            }
          } else {
            urlsToProcess.push(imgUrl);
          }
          
          for (const url of urlsToProcess) {
            const cleanUrl = url.replace(/\?(.*?)$/, '');
            const fileNameMatch = cleanUrl.match(/\/([^\/]+\.(jpg|png|webp))$/i);
            if (!fileNameMatch) continue;
            
            const fileName = fileNameMatch[1];
            const baseName = fileName.toLowerCase();
            
            const isProductImage = fileName.includes(productId) && 
                                   !baseName.includes('thumbnail') &&
                                   !baseName.includes('logo');
            
            if (isProductImage && !seenImageBases.has(baseName)) {
              seenImageBases.add(baseName);
              product.images.push(cleanUrl);
            }
          }
        }
      }
      
      // Extraction des vidéos
      const videoPatterns = [
        /src="(https:\/\/[^"]*(?:youtube|vimeo|lego)[^"]*(?:embed|video)[^"]*)"/gi,
        /data-video-id="([^"]+)"/gi,
        /"videoId"\s*:\s*"([^"]+)"/gi,
        /youtube\.com\/embed\/([^"?\s]+)/gi
      ];
      
      const seenVideos = new Set();
      
      for (const pattern of videoPatterns) {
        const matches = [...html.matchAll(pattern)];
        for (const m of matches) {
          let videoUrl = m[1];
          if (videoUrl.match(/^[a-zA-Z0-9_-]{11}$/)) {
            videoUrl = `https://www.youtube.com/watch?v=${videoUrl}`;
          }
          if (!seenVideos.has(videoUrl)) {
            seenVideos.add(videoUrl);
            product.videos.push(videoUrl);
          }
        }
      }
      
      // Extraction âge, pièces, prix, etc.
      const agePatterns = [
        /data-test="product-details-ages"[^>]*>([^<]+)</i,
        /"ageRange"\s*:\s*"([^"]+)"/i,
        /Âge[s]?\s*:?\s*(\d+\+?)/i,
        /Age[s]?\s*:?\s*(\d+\+?)/i
      ];
      
      for (const pattern of agePatterns) {
        const match = html.match(pattern);
        if (match) {
          product.ageRange = match[1].trim();
          break;
        }
      }
      
      const piecePatterns = [
        /data-test="product-details-pieces"[^>]*>([^<]+)</i,
        /"pieceCount"\s*:\s*(\d+)/i,
        /(\d+)\s*(?:pièces?|pieces?|éléments?)/i
      ];
      
      for (const pattern of piecePatterns) {
        const match = html.match(pattern);
        if (match) {
          product.pieceCount = parseInt(match[1].replace(/\s/g, ''), 10);
          break;
        }
      }
      
      const minifigPatterns = [
        /data-test="product-details-minifigures"[^>]*>([^<]+)</i,
        /"minifiguresCount"\s*:\s*(\d+)/i,
        /(\d+)\s*(?:figurines?|minifig(?:ure)?s?)/i
      ];
      
      for (const pattern of minifigPatterns) {
        const match = html.match(pattern);
        if (match) {
          product.minifiguresCount = parseInt(match[1], 10);
          break;
        }
      }
      
      const pricePatterns = [
        /data-test="product-price"[^>]*>([^<]+)</i,
        /data-test="product-price-sale"[^>]*>([^<]+)</i,
        /"formattedAmount"\s*:\s*"([^"]+)"/i,
        /Prix\s*:?\s*([\d,.\s]+\s*€)/i
      ];
      
      for (const pattern of pricePatterns) {
        const match = html.match(pattern);
        if (match) {
          product.price = match[1].trim().replace(/&nbsp;/g, ' ').replace(/&#160;/g, ' ');
          break;
        }
      }
      
      const listPricePatterns = [
        /data-test="product-price-list"[^>]*>([^<]+)</i,
        /<s[^>]*>([^<]*€[^<]*)<\/s>/i
      ];
      
      for (const pattern of listPricePatterns) {
        const match = html.match(pattern);
        if (match) {
          product.listPrice = match[1].trim();
          break;
        }
      }
      
      // Disponibilité
      const availabilityPatterns = [
        /data-test="product-overview-availability"[^>]*>([^<]+)</i,
        /"availabilityStatus"\s*:\s*"([^"]+)"/i,
        /"availabilityText"\s*:\s*"([^"]+)"/i
      ];
      
      for (const pattern of availabilityPatterns) {
        const match = html.match(pattern);
        if (match) {
          product.availabilityText = match[1].trim();
          const text = product.availabilityText.toLowerCase();
          if (text.includes('disponible') || text.includes('available') || text.includes('en stock')) {
            product.availability = 'AVAILABLE';
          } else if (text.includes('épuisé') || text.includes('out of stock') || text.includes('indisponible')) {
            product.availability = 'OUT_OF_STOCK';
          } else if (text.includes('bientôt') || text.includes('coming soon')) {
            product.availability = 'COMING_SOON';
          } else if (text.includes('retiré') || text.includes('retired')) {
            product.availability = 'RETIRED';
          } else {
            product.availability = 'UNKNOWN';
          }
          break;
        }
      }
      
      // Note et avis
      const ratingPatterns = [
        /data-test="product-rating"[^>]*>([^<]+)</i,
        /"rating"\s*:\s*([\d.]+)/i
      ];
      
      for (const pattern of ratingPatterns) {
        const match = html.match(pattern);
        if (match) {
          product.rating = parseFloat(match[1].replace(',', '.'));
          break;
        }
      }
      
      const reviewPatterns = [
        /data-test="product-review-count"[^>]*>([^<]+)</i,
        /"reviewCount"\s*:\s*(\d+)/i,
        /(\d+)\s*(?:avis|reviews?)/i
      ];
      
      for (const pattern of reviewPatterns) {
        const match = html.match(pattern);
        if (match) {
          product.reviewCount = parseInt(match[1], 10);
          break;
        }
      }
      
      // Essayer __NEXT_DATA__ pour plus de données
      const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const pageProps = nextData?.props?.pageProps;
          const apolloState = pageProps?.__APOLLO_STATE__ || pageProps?.initialApolloState || {};
          
          for (const key of Object.keys(apolloState)) {
            if (key.startsWith("SingleVariantProduct:") || key.startsWith("Product:") || key.startsWith("MultiVariantProduct:")) {
              const prodData = apolloState[key];
              
              if (prodData && (prodData.productCode === productId || key.includes(productId))) {
                if (prodData.name && !product.name) {
                  product.name = prodData.name;
                }
                
                if (prodData.variant?.__ref) {
                  const variantData = apolloState[prodData.variant.__ref];
                  if (variantData) {
                    if (variantData.attributes) {
                      const attrs = variantData.attributes;
                      if (attrs.rating && !product.rating) product.rating = attrs.rating;
                      if (attrs.availabilityStatus && !product.availability) product.availability = attrs.availabilityStatus;
                      if (attrs.availabilityText && !product.availabilityText) product.availabilityText = attrs.availabilityText;
                      if (attrs.ageRange && !product.ageRange) product.ageRange = attrs.ageRange;
                      if (attrs.pieceCount && !product.pieceCount) product.pieceCount = attrs.pieceCount;
                    }
                    
                    if (variantData.price?.__ref) {
                      const priceData = apolloState[variantData.price.__ref];
                      if (priceData?.formattedAmount && !product.price) {
                        product.price = priceData.formattedAmount;
                      }
                    } else if (variantData.price?.formattedAmount && !product.price) {
                      product.price = variantData.price.formattedAmount;
                    }
                  }
                }
                
                break;
              }
            }
          }
        } catch (parseErr) {
          log.warn("Erreur parsing __NEXT_DATA__ pour produit:", parseErr.message);
        }
      }
      
      log.info(`✅ Produit récupéré: ${product.name || productId}`);
      log.debug(`   Images: ${product.images.length}, Vidéos: ${product.videos.length}`);
      
      setCache(cacheKey, product);
      metrics.sources.lego = metrics.sources.lego || { requests: 0, errors: 0 };
      metrics.sources.lego.requests++;
      return product;

    } catch (err) {
      lastError = err;
      log.warn(`Erreur tentative ${attempt}: ${err.message}`);
      
      if (getFsrSessionId()) {
        await destroyFsrSession();
      }
      
      if (attempt >= retries) break;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  
  metrics.sources.lego = metrics.sources.lego || { requests: 0, errors: 0 };
  metrics.sources.lego.errors++;
  throw lastError || new Error("Échec après toutes les tentatives");
}

/**
 * Récupérer les manuels d'instructions d'un produit
 * @param {string} productId - ID du produit LEGO
 * @param {string} lang - Langue/locale
 * @param {number} retries - Nombre max de tentatives
 * @returns {Promise<object>} - Manuels d'instructions
 */
export async function getBuildingInstructions(productId, lang = DEFAULT_LOCALE, retries = MAX_RETRIES) {
  let attempt = 0;
  let lastError = null;
  
  while (attempt < retries) {
    attempt++;
    try {
      log.debug(`Tentative ${attempt}/${retries} pour instructions: "${productId}"`);
      
      if (!getFsrSessionId()) {
        await ensureFsrSession();
      }
      
      const now = Date.now();
      if (now - getLastLegoHomeVisit() > LEGO_SESSION_TTL) {
        log.debug("Rafraîchissement cookies LEGO...");
        await fsrRequest("request.get", `https://www.lego.com/${lang.toLowerCase()}/`, null, {}, 30000);
        setLastLegoHomeVisit(now);
      }
      
      const instructionsUrl = `https://www.lego.com/${lang.toLowerCase()}/service/building-instructions/${productId}`;
      log.debug("Visite de la page instructions:", instructionsUrl);
      
      const pageSolution = await fsrRequest("request.get", instructionsUrl, null, {
        waitInSeconds: 2
      }, 60000);
      
      const html = pageSolution.response || "";
      log.debug("Page instructions reçue, taille:", html.length);
      
      const isInstructionsPage = html.includes('building-instructions') || 
                                  html.includes('BuildingInstructions') ||
                                  html.includes('.pdf');
      
      if (!isInstructionsPage && (html.includes("Cette page n'existe pas") || html.length < 50000)) {
        throw new Error("Instructions non trouvées pour ce produit");
      }
      
      const instructions = {
        id: productId,
        productCode: productId,
        name: null,
        ageRange: null,
        pieceCount: null,
        year: null,
        manuals: [],
        url: instructionsUrl
      };
      
      // Chercher dans __NEXT_DATA__
      const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const pageProps = nextData?.props?.pageProps;
          
          const productData = pageProps?.product || pageProps?.data?.product;
          
          if (productData) {
            if (productData.name) instructions.name = productData.name;
            if (productData.ageRange) instructions.ageRange = productData.ageRange;
            if (productData.pieceCount) instructions.pieceCount = parseInt(productData.pieceCount, 10);
          }
          
          const buildingInstructions = pageProps?.buildingInstructions || 
                                       pageProps?.data?.buildingInstructions ||
                                       pageProps?.instructions;
          
          if (Array.isArray(buildingInstructions)) {
            for (const instr of buildingInstructions) {
              if (instr.pdfUrl || instr.pdfLocation || instr.url) {
                instructions.manuals.push({
                  id: instr.id || null,
                  description: instr.description || instr.name || null,
                  pdfUrl: instr.pdfUrl || instr.pdfLocation || instr.url,
                  sequence: instr.sequence || instr.sequenceNumber || null
                });
              }
            }
          }
          
          const apolloState = pageProps?.__APOLLO_STATE__ || pageProps?.initialApolloState || {};
          
          for (const key of Object.keys(apolloState)) {
            const data = apolloState[key];
            
            if (key.startsWith("Product:") || key.startsWith("SingleVariantProduct:") || key.includes(productId)) {
              if (data.name && !instructions.name) instructions.name = data.name;
              if (data.ageRange && !instructions.ageRange) instructions.ageRange = data.ageRange;
              if (data.pieceCount && !instructions.pieceCount) instructions.pieceCount = parseInt(data.pieceCount, 10);
            }
            
            if (key.includes("BuildingInstruction") || (data && data.pdfLocation)) {
              if (data.pdfLocation && !instructions.manuals.find(m => m.pdfUrl === data.pdfLocation)) {
                instructions.manuals.push({
                  id: data.id || key,
                  description: data.description || data.name || null,
                  pdfUrl: data.pdfLocation,
                  sequence: data.sequence || data.sequenceNumber || null
                });
              }
            }
          }
          
        } catch (parseErr) {
          log.error("Erreur parsing __NEXT_DATA__:", parseErr.message);
        }
      }
      
      // Extraction HTML si pas dans __NEXT_DATA__
      if (!instructions.name) {
        const namePatterns = [
          /<h1[^>]*>([^<]+)<\/h1>/i,
          /data-test="[^"]*product[^"]*name[^"]*"[^>]*>([^<]+)</i
        ];
        
        for (const pattern of namePatterns) {
          const match = html.match(pattern);
          if (match && !match[1].includes('LEGO')) {
            instructions.name = match[1].trim();
            break;
          }
        }
      }
      
      if (!instructions.ageRange) {
        const agePatterns = [
          /"ageRange"\s*:\s*"([^"]+)"/i,
          /<p[^>]*productDetails[^>]*>(\d{1,2}\+)/i
        ];
        
        for (const pattern of agePatterns) {
          const match = html.match(pattern);
          if (match) {
            instructions.ageRange = match[1];
            break;
          }
        }
      }
      
      if (!instructions.pieceCount) {
        const piecePatterns = [
          /"pieceCount"\s*:\s*(\d+)/i,
          /(\d+)\s*(?:pièces?|pieces?)/i
        ];
        
        for (const pattern of piecePatterns) {
          const match = html.match(pattern);
          if (match) {
            instructions.pieceCount = parseInt(match[1], 10);
            break;
          }
        }
      }
      
      if (!instructions.year) {
        const yearPatterns = [
          /"launchDate"\s*:\s*"(\d{4})/i,
          /"year"\s*:\s*(\d{4})/i
        ];
        
        for (const pattern of yearPatterns) {
          const match = html.match(pattern);
          if (match) {
            instructions.year = parseInt(match[1], 10);
            break;
          }
        }
      }
      
      // Chercher les PDFs dans le HTML
      if (instructions.manuals.length === 0) {
        const pdfPatterns = [
          /href="(https?:\/\/[^"]+\.pdf)"/gi,
          /"pdfUrl"\s*:\s*"([^"]+\.pdf)"/gi,
          /"pdfLocation"\s*:\s*"([^"]+\.pdf)"/gi,
          /(https?:\/\/[^"\s]+\.pdf)/gi
        ];
        
        const seenPdfs = new Set();
        
        for (const pattern of pdfPatterns) {
          const matches = [...html.matchAll(pattern)];
          for (const m of matches) {
            let pdfUrl = m[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
            
            if (pdfUrl.startsWith('//')) {
              pdfUrl = 'https:' + pdfUrl;
            }
            
            if (!seenPdfs.has(pdfUrl)) {
              seenPdfs.add(pdfUrl);
              
              const fileNameMatch = pdfUrl.match(/\/([^\/]+)\.pdf$/i);
              const fileName = fileNameMatch ? fileNameMatch[1] : null;
              
              const excludePatterns = [
                /slavery/i, /transparency/i, /statement/i, /policy/i,
                /report/i, /annual/i, /legal/i, /terms/i, /privacy/i
              ];
              
              const isExcluded = excludePatterns.some(pattern => pattern.test(fileName || pdfUrl));
              const isManual = pdfUrl.includes('product.bi') || 
                               pdfUrl.includes(productId) || 
                               /^\d+$/.test(fileName);
              
              if (!isExcluded && isManual) {
                let sequence = null;
                const seqMatch = fileName?.match(/_(?:BK)?(\d+)(?:_|$)/i);
                if (seqMatch) {
                  sequence = parseInt(seqMatch[1], 10);
                }
                
                instructions.manuals.push({
                  id: fileName || seenPdfs.size.toString(),
                  description: fileName ? `Manuel ${fileName}` : null,
                  pdfUrl: pdfUrl,
                  sequence: sequence
                });
              }
            }
          }
        }
      }
      
      // Trier les manuels
      instructions.manuals.sort((a, b) => {
        if (a.sequence === null && b.sequence === null) return 0;
        if (a.sequence === null) return 1;
        if (b.sequence === null) return -1;
        return a.sequence - b.sequence;
      });
      
      log.info(`✅ Trouvé ${instructions.manuals.length} manuels pour ${productId}`);
      
      metrics.sources.lego = metrics.sources.lego || { requests: 0, errors: 0 };
      metrics.sources.lego.requests++;
      return instructions;

    } catch (err) {
      lastError = err;
      log.warn(`Erreur tentative ${attempt}: ${err.message}`);
      
      if (getFsrSessionId()) {
        await destroyFsrSession();
      }
      
      if (attempt >= retries) break;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  
  metrics.sources.lego = metrics.sources.lego || { requests: 0, errors: 0 };
  metrics.sources.lego.errors++;
  throw lastError || new Error("Échec après toutes les tentatives");
}

// Exports Configuration
export { GRAPHQL_URL, GRAPHQL_QUERY };

// ========================================
// Fonctions de normalisation v3.0.0
// ========================================

/**
 * Recherche LEGO avec retour normalisé v3.0.0
 * @param {string} searchTerm - Terme de recherche
 * @param {string} lang - Locale
 * @param {object} options - Options (perPage, retries)
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function searchLegoNormalized(searchTerm, lang = DEFAULT_LOCALE, options = {}) {
  const { perPage = 24, retries = MAX_RETRIES } = options;
  
  const raw = await callLegoGraphql(searchTerm, lang, retries, perPage);
  
  return {
    results: (raw.products || []).map(p => normalizeLegoSearch(p)),
    total: raw.total || 0,
    count: raw.count || 0,
    query: raw.resultFor || searchTerm,
    source: 'lego'
  };
}

/**
 * Détails produit LEGO avec retour normalisé v3.0.0
 * @param {string} productId - ID du produit
 * @param {string} lang - Locale
 * @param {number} retries - Nombre de tentatives
 * @returns {Promise<object>} - Détails normalisés
 */
export async function getProductDetailsNormalized(productId, lang = DEFAULT_LOCALE, retries = MAX_RETRIES) {
  const raw = await getProductDetails(productId, lang, retries);
  return normalizeLegoDetail(raw, lang);
}

// Export des fonctions de normalisation
export { normalizeLegoSearch, normalizeLegoDetail };
