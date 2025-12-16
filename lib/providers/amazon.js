// lib/providers/amazon.js
// Scraper Amazon multi-pays pour toys_api
// Utilise un FlareSolverr dédié via VPN (PIA) pour éviter les bans IP
// SÉCURITÉ: Vérifie que le VPN est actif avant chaque requête Amazon

import { createLogger } from '../utils/logger.js';
import { getCached, setCache } from '../utils/state.js';
import { USER_AGENT } from '../config.js';

const log = createLogger('Amazon');

// ============================================================================
// CONFIGURATION
// ============================================================================

// FlareSolverr dédié Amazon (via VPN) - fallback sur FSR principal si non configuré
const FSR_AMAZON_BASE = process.env.FSR_AMAZON_URL || process.env.FSR_URL || "http://10.110.1.1:8191/v1";
const FSR_MAIN_BASE = process.env.FSR_URL || "http://10.110.1.1:8191/v1";
const GLUETUN_CONTROL_URL = process.env.GLUETUN_CONTROL_URL || "http://gluetun-amazon:8000";

// TTL spécifique pour le cache Amazon (10 minutes)
const AMAZON_CACHE_TTL = 600000;

// ============================================================================
// CIRCUIT BREAKER - Désactive Amazon temporairement si bloqué
// ============================================================================
let amazonCircuitOpen = false;
let amazonCircuitOpenTime = null;
const CIRCUIT_COOLDOWN = 15 * 60 * 1000; // 15 minutes avant réessai
let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_CIRCUIT_OPEN = 3;

/**
 * Vérifie si Amazon est disponible (circuit breaker fermé)
 * @returns {{available: boolean, reason: string|null, retryAfter: number|null}}
 */
export function isAmazonAvailable() {
  if (!amazonCircuitOpen) {
    return { available: true, reason: null, retryAfter: null };
  }
  
  const elapsed = Date.now() - amazonCircuitOpenTime;
  if (elapsed >= CIRCUIT_COOLDOWN) {
    // Réouvrir le circuit pour réessayer
    log.info('🔄 Circuit breaker Amazon: tentative de réouverture après cooldown');
    amazonCircuitOpen = false;
    consecutiveFailures = 0;
    return { available: true, reason: null, retryAfter: null };
  }
  
  const retryAfter = Math.ceil((CIRCUIT_COOLDOWN - elapsed) / 1000);
  return { 
    available: false, 
    reason: 'Amazon temporairement désactivé (détection anti-bot)',
    retryAfter 
  };
}

/**
 * Signale un succès Amazon (reset failures)
 */
function recordAmazonSuccess() {
  consecutiveFailures = 0;
  if (amazonCircuitOpen) {
    log.info('✅ Circuit breaker Amazon: fermé après succès');
    amazonCircuitOpen = false;
  }
}

/**
 * Signale un échec Amazon (potentiellement ouvre le circuit)
 */
function recordAmazonFailure(isRobotDetection = false) {
  consecutiveFailures++;
  
  if (isRobotDetection && consecutiveFailures >= MAX_FAILURES_BEFORE_CIRCUIT_OPEN) {
    amazonCircuitOpen = true;
    amazonCircuitOpenTime = Date.now();
    log.warn(`🔴 Circuit breaker Amazon: OUVERT après ${consecutiveFailures} échecs consécutifs`);
    log.warn(`   Retry dans ${CIRCUIT_COOLDOWN / 60000} minutes`);
  }
}

// IP de l'hôte à ne JAMAIS utiliser pour Amazon (sera détectée au démarrage)
let HOST_PUBLIC_IP = null;
let lastVpnCheck = 0;
let cachedVpnIp = null;
const VPN_CHECK_INTERVAL = 60000; // Vérifier le VPN toutes les 60 secondes max

// Log au démarrage si VPN dédié configuré
if (process.env.FSR_AMAZON_URL) {
  log.debug(` VPN FlareSolverr: ${FSR_AMAZON_BASE}`);
  log.debug(` Gluetun Control: ${GLUETUN_CONTROL_URL}`);
} else {
  log.debug(` ⚠️ Pas de VPN dédié, utilisation FSR principal: ${FSR_AMAZON_BASE}`);
}

// Détecter l'IP publique de l'hôte au démarrage (pour la comparer avec le VPN)
(async () => {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { timeout: 5000 });
    if (res.ok) {
      const data = await res.json();
      HOST_PUBLIC_IP = data.ip;
      log.debug(` IP hôte détectée: ${HOST_PUBLIC_IP} (sera bloquée pour Amazon)`);
    }
  } catch (e) {
    log.debug(` Impossible de détecter l'IP hôte: ${e.message}`);
  }
})();

/**
 * Vérifie que le VPN est actif et retourne une IP différente de l'hôte
 * @returns {Promise<{ok: boolean, ip: string|null, error: string|null}>}
 */
async function checkVpnStatus() {
  // Cache la vérification pour éviter trop de requêtes
  if (cachedVpnIp && (Date.now() - lastVpnCheck) < VPN_CHECK_INTERVAL) {
    return { ok: true, ip: cachedVpnIp, error: null };
  }

  try {
    // Vérifier le statut via l'API gluetun
    const statusRes = await fetch(`${GLUETUN_CONTROL_URL}/v1/openvpn/status`, { 
      timeout: 5000,
      signal: AbortSignal.timeout(5000)
    });
    
    if (!statusRes.ok) {
      return { ok: false, ip: null, error: "Gluetun API inaccessible" };
    }
    
    const status = await statusRes.json();
    if (status.status !== "running") {
      return { ok: false, ip: null, error: `VPN status: ${status.status}` };
    }

    // Récupérer l'IP publique via le VPN
    const ipRes = await fetch(`${GLUETUN_CONTROL_URL}/v1/publicip/ip`, { 
      timeout: 5000,
      signal: AbortSignal.timeout(5000)
    });
    
    if (!ipRes.ok) {
      return { ok: false, ip: null, error: "Impossible de récupérer l'IP VPN" };
    }
    
    const vpnIp = (await ipRes.text()).trim();
    
    // SÉCURITÉ: Vérifier que l'IP VPN est différente de l'IP hôte
    if (HOST_PUBLIC_IP && vpnIp === HOST_PUBLIC_IP) {
      return { ok: false, ip: vpnIp, error: "IP VPN identique à l'IP hôte - VPN non actif!" };
    }

    // Tout est OK, mettre en cache
    cachedVpnIp = vpnIp;
    lastVpnCheck = Date.now();
    return { ok: true, ip: vpnIp, error: null };

  } catch (e) {
    return { ok: false, ip: null, error: `Erreur vérification VPN: ${e.message}` };
  }
}

/**
 * Force une rotation d'IP via gluetun
 */
async function rotateVpnIp() {
  try {
    log.debug(" 🔄 Demande de rotation IP...");
    
    // Stop le VPN
    const stopRes = await fetch(`${GLUETUN_CONTROL_URL}/v1/openvpn/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: "stopped" }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (!stopRes.ok) {
      log.warn(` ⚠️ Stop VPN a retourné ${stopRes.status}`);
    }
    
    await sleep(2000);
    
    // Redémarre le VPN
    log.debug(" ▶️ Redémarrage VPN...");
    const startRes = await fetch(`${GLUETUN_CONTROL_URL}/v1/openvpn/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: "running" }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (!startRes.ok) {
      throw new Error(`Redémarrage VPN échoué: ${startRes.status}`);
    }
    
    // Invalider le cache
    cachedVpnIp = null;
    lastVpnCheck = 0;
    
    // Attendre que le VPN soit prêt avec polling
    log.debug(" ⏳ Attente connexion VPN...");
    let attempts = 0;
    const maxAttempts = 12; // 12 * 5s = 60s max
    
    while (attempts < maxAttempts) {
      await sleep(5000);
      attempts++;
      
      try {
        const statusRes = await fetch(`${GLUETUN_CONTROL_URL}/v1/openvpn/status`, { 
          signal: AbortSignal.timeout(5000)
        });
        const status = await statusRes.json();
        
        if (status.status === "running") {
          // VPN running, vérifier l'IP
          const check = await checkVpnStatus();
          if (check.ok && check.ip) {
            log.info(` ✅ Nouvelle IP VPN: ${check.ip}`);
            return check;
          }
        }
        
        log.debug(` [${attempts}/${maxAttempts}] VPN status: ${status.status}`);
      } catch (e) {
        log.debug(` [${attempts}/${maxAttempts}] Erreur check: ${e.message}`);
      }
    }
    
    throw new Error("Timeout: VPN n'a pas redémarré après 60s");
    
  } catch (e) {
    log.error(` ❌ Erreur rotation IP: ${e.message}`);
    
    // Tenter de remettre le VPN en running en cas d'erreur
    try {
      await fetch(`${GLUETUN_CONTROL_URL}/v1/openvpn/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: "running" }),
        signal: AbortSignal.timeout(5000)
      });
    } catch (e2) {
      log.warn(` Impossible de remettre le VPN en running: ${e2.message}`);
    }
    
    return { ok: false, ip: null, error: e.message };
  }
}

// Exporter les fonctions de gestion VPN
export { checkVpnStatus, rotateVpnIp };

// Session FlareSolverr pour Amazon
let amazonFsrSession = null;
let lastAmazonSessionTime = 0;
const SESSION_MAX_AGE = 300000; // 5 minutes

/**
 * Configuration des différents marketplaces Amazon
 */
export const AMAZON_MARKETPLACES = {
  fr: {
    domain: "www.amazon.fr",
    baseUrl: "https://www.amazon.fr",
    locale: "fr_FR",
    currency: "EUR",
    name: "Amazon France"
  },
  us: {
    domain: "www.amazon.com",
    baseUrl: "https://www.amazon.com",
    locale: "en_US",
    currency: "USD",
    name: "Amazon US"
  },
  uk: {
    domain: "www.amazon.co.uk",
    baseUrl: "https://www.amazon.co.uk",
    locale: "en_GB",
    currency: "GBP",
    name: "Amazon UK"
  },
  de: {
    domain: "www.amazon.de",
    baseUrl: "https://www.amazon.de",
    locale: "de_DE",
    currency: "EUR",
    name: "Amazon Allemagne"
  },
  es: {
    domain: "www.amazon.es",
    baseUrl: "https://www.amazon.es",
    locale: "es_ES",
    currency: "EUR",
    name: "Amazon Espagne"
  },
  it: {
    domain: "www.amazon.it",
    baseUrl: "https://www.amazon.it",
    locale: "it_IT",
    currency: "EUR",
    name: "Amazon Italie"
  },
  jp: {
    domain: "www.amazon.co.jp",
    baseUrl: "https://www.amazon.co.jp",
    locale: "ja_JP",
    currency: "JPY",
    name: "Amazon Japon"
  },
  ca: {
    domain: "www.amazon.ca",
    baseUrl: "https://www.amazon.ca",
    locale: "en_CA",
    currency: "CAD",
    name: "Amazon Canada"
  }
};

/**
 * Catégories Amazon avec leurs nodes
 */
export const AMAZON_CATEGORIES = {
  videogames: {
    name: "Jeux vidéo",
    nodes: {
      fr: "530490",
      us: "468642",
      uk: "300703",
      de: "300992",
      es: "599382031",
      it: "412609031"
    },
    searchAlias: "videogames"
  },
  toys: {
    name: "Jouets",
    nodes: {
      fr: "322086011",
      us: "165793011",
      uk: "468292",
      de: "12950661",
      es: "599385031",
      it: "523997031"
    },
    searchAlias: "toys-and-games"
  },
  books: {
    name: "Livres",
    nodes: {
      fr: "301061",
      us: "283155",
      uk: "1025612",
      de: "186606",
      es: "599364031",
      it: "411663031"
    },
    searchAlias: "stripbooks"
  },
  music: {
    name: "Musique",
    nodes: {
      fr: "301062",
      us: "5174",
      uk: "520920",
      de: "255882",
      es: "599373031",
      it: "412601031"
    },
    searchAlias: "popular"
  },
  movies: {
    name: "Films & Séries",
    nodes: {
      fr: "405322",
      us: "2625373011",
      uk: "283926",
      de: "284266",
      es: "599379031",
      it: "412606031"
    },
    searchAlias: "dvd"
  }
};

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Détecte si Amazon bloque la requête (robot/captcha)
 * @param {string} html - Contenu HTML de la réponse
 * @returns {boolean}
 */
function isRobotDetected(html) {
  if (!html) return false;
  return html.includes("api-services-support@amazon.com") 
      || html.includes("Sorry, we just need to make sure")
      || html.includes("Enter the characters you see below")
      || html.includes("Type the characters you see in this image")
      || html.includes("Saisissez les caractères que vous voyez")
      || html.includes("robot");
}

/**
 * Exécute une requête Amazon avec retry automatique sur détection robot
 * Effectue une rotation d'IP et retente une fois avant d'échouer
 * Utilise le circuit breaker pour désactiver Amazon si trop d'échecs
 * @param {Function} requestFn - Fonction async qui exécute la requête
 * @param {string} context - Description pour les logs
 * @returns {Promise<string>} - HTML de la réponse
 */
async function executeWithRobotRetry(requestFn, context = "requête") {
  // Vérifier le circuit breaker
  const availability = isAmazonAvailable();
  if (!availability.available) {
    throw new Error(`${availability.reason}. Réessayer dans ${availability.retryAfter}s`);
  }
  
  let html;
  
  // Première tentative
  try {
    html = await requestFn();
    
    if (!isRobotDetected(html)) {
      recordAmazonSuccess();
      return html; // Succès
    }
    
    log.debug(` ⚠️ Robot détecté (${context}) - Rotation IP en cours...`);
  } catch (err) {
    // Si l'erreur n'est pas liée à un robot, on la propage
    if (!err.message.includes("robot") && !err.message.includes("captcha")) {
      throw err;
    }
    log.debug(` ⚠️ Erreur robot (${context}) - Rotation IP en cours...`);
  }
  
  // Rotation d'IP
  const rotateResult = await rotateVpnIp();
  if (!rotateResult.ok) {
    recordAmazonFailure(true);
    throw new Error(`Rotation IP échouée: ${rotateResult.error}. Amazon détecte un robot.`);
  }
  
  log.debug(` 🔄 Nouvelle IP: ${rotateResult.ip} - Nouvelle tentative...`);
  
  // Petite pause après rotation
  await sleep(2000);
  
  // Seconde tentative
  try {
    html = await requestFn();
    
    if (isRobotDetected(html)) {
      recordAmazonFailure(true);
      throw new Error("Amazon détecte toujours un robot après rotation IP - essayer plus tard");
    }
    
    recordAmazonSuccess();
    log.debug(` ✅ Succès après rotation IP`);
    return html;
    
  } catch (err) {
    recordAmazonFailure(true);
    log.error(` ❌ Échec après rotation IP (${context}):`, err.message);
    throw new Error(`Amazon détecte un robot même après rotation IP: ${err.message}`);
  }
}

function decodeHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ============================================================================
// FLARESOLVERR FUNCTIONS
// ============================================================================

async function createAmazonFsrSession() {
  try {
    const res = await fetch(FSR_AMAZON_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "sessions.create" })
    });
    const json = await res.json();
    if (json.status === "ok" && json.session) {
      log.debug(" Session FSR créée:", json.session);
      amazonFsrSession = json.session;
      lastAmazonSessionTime = Date.now();
      return json.session;
    }
  } catch (err) {
    log.error(" Erreur création session FSR:", err.message);
  }
  return null;
}

async function destroyAmazonFsrSession() {
  if (!amazonFsrSession) return;
  try {
    await fetch(FSR_AMAZON_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "sessions.destroy", session: amazonFsrSession })
    });
    log.debug(" Session FSR détruite");
  } catch (err) {
    log.error(" Erreur destruction session:", err.message);
  }
  amazonFsrSession = null;
  lastAmazonSessionTime = 0;
}

async function getAmazonSession(forceNew = false) {
  if (!forceNew && amazonFsrSession && (Date.now() - lastAmazonSessionTime) < SESSION_MAX_AGE) {
    return amazonFsrSession;
  }
  if (amazonFsrSession) {
    await destroyAmazonFsrSession();
  }
  return await createAmazonFsrSession();
}

async function amazonFsrGet(url, timeout = 60000) {
  // ========== SÉCURITÉ: Vérifier le VPN avant chaque requête Amazon ==========
  const vpnCheck = await checkVpnStatus();
  if (!vpnCheck.ok) {
    log.error(` ❌ VPN NON ACTIF - Requête bloquée: ${vpnCheck.error}`);
    throw new Error(`VPN non actif pour Amazon: ${vpnCheck.error}. Requête bloquée pour protéger votre IP.`);
  }
  log.debug(` ✅ VPN actif (IP: ${vpnCheck.ip})`);
  // ===========================================================================

  const session = await getAmazonSession();
  
  const res = await fetch(FSR_AMAZON_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmd: "request.get",
      url,
      maxTimeout: timeout,
      session: session
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    log.error(" FSR HTTP error:", res.status, errorText);
    throw new Error(`FlareSolverr error ${res.status}`);
  }
  
  const json = await res.json();
  
  if (json.status !== "ok") {
    log.error(" FSR status error:", json);
    throw new Error(`FlareSolverr status: ${json.status} - ${json.message || 'unknown error'}`);
  }
  
  if (!json.solution) throw new Error("FlareSolverr: pas de solution");
  
  return json.solution.response || "";
}

// ============================================================================
// PARSING HTML
// ============================================================================

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const cleaned = priceStr
    .replace(/[€$£¥CAD]/gi, "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .trim();
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

function parseSearchResults(html, country = "fr") {
  const marketplace = AMAZON_MARKETPLACES[country] || AMAZON_MARKETPLACES.fr;
  const results = [];
  const seenAsins = new Set();
  
  // Pattern 1: Extraire les ASIN depuis les liens produits
  const asinPattern = /\/dp\/([A-Z0-9]{10})/g;
  let match;
  const asins = [];
  
  while ((match = asinPattern.exec(html)) !== null) {
    if (!seenAsins.has(match[1])) {
      seenAsins.add(match[1]);
      asins.push(match[1]);
    }
  }
  
  // Pour chaque ASIN, chercher les infos dans le HTML
  for (const asin of asins.slice(0, 30)) { // Max 30 résultats
    const product = {
      asin,
      source: "amazon",
      marketplace: country,
      url: `${marketplace.baseUrl}/dp/${asin}`
    };
    
    // Méthode 1: Extraire le titre depuis l'attribut alt de l'image s-image
    // Pattern: data-asin="ASIN"...class="s-image"...alt="TITRE"
    const imgAltRegex = new RegExp(`data-asin="${asin}"[\\s\\S]*?<img[^>]*class="s-image"[^>]*alt="([^"]+)"`, 'i');
    const imgAltMatch = html.match(imgAltRegex);
    if (imgAltMatch) {
      product.title = decodeHtmlEntities(imgAltMatch[1].trim());
      // Supprimer les "..." de troncature à la fin
      if (product.title.endsWith('...')) {
        product.title = product.title.slice(0, -3).trim();
      }
    }
    
    // Méthode 2: Chercher dans le span a-text-normal (ancienne structure)
    if (!product.title) {
      const titleRegex = new RegExp(`data-asin="${asin}"[^>]*>[\\s\\S]*?class="[^"]*a-text-normal[^"]*"[^>]*>([^<]+)<`, 'i');
      const titleMatch = html.match(titleRegex);
      if (titleMatch && titleMatch[1].trim().length > 10) {
        product.title = decodeHtmlEntities(titleMatch[1].trim());
      }
    }
    
    // Méthode 3: Chercher le titre dans un lien contenant l'ASIN
    if (!product.title) {
      const altTitleRegex = new RegExp(`href="[^"]*${asin}[^"]*"[^>]*>\\s*<span[^>]*>([^<]{10,})<`, 'i');
      const altMatch = html.match(altTitleRegex);
      if (altMatch) {
        product.title = decodeHtmlEntities(altMatch[1].trim());
      }
    }
    
    // Ne pas ajouter si pas de titre
    if (!product.title) continue;
    
    // Chercher l'image - priorité: src dans le bloc data-asin
    const imgRegex = new RegExp(`data-asin="${asin}"[\\s\\S]*?<img[^>]*class="s-image"[^>]*src="([^"]+)"`, 'i');
    const imgMatch = html.match(imgRegex);
    if (imgMatch) {
      product.image = imgMatch[1].replace(/\._AC_[^.]*_\./, '._SL500_.');
    } else {
      // Fallback: ancienne méthode
      const imgFallbackRegex = new RegExp(`data-asin="${asin}"[\\s\\S]*?src="(https://m\\.media-amazon\\.com/images/[^"]+)"`, 'i');
      const imgFallbackMatch = html.match(imgFallbackRegex);
      if (imgFallbackMatch) {
        product.image = imgFallbackMatch[1].replace(/\._[^.]+_\./, '._SL500_.');
      }
    }
    
    // Chercher le prix dans le bloc du produit (data-asin jusqu'au prochain data-asin ou fin)
    const asinIndex = html.indexOf(`data-asin="${asin}"`);
    if (asinIndex !== -1) {
      // Trouver le bloc du produit (jusqu'au prochain data-asin ou 5000 chars max)
      const nextAsinIndex = html.indexOf('data-asin="', asinIndex + 20);
      const blockEnd = nextAsinIndex !== -1 ? nextAsinIndex : asinIndex + 5000;
      const productBlock = html.substring(asinIndex, Math.min(blockEnd, html.length));
      
      // Chercher le prix dans ce bloc spécifique
      const priceMatch = productBlock.match(/class="[^"]*a-price[^"]*"[^>]*>\s*<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>([^<]+)</i);
      if (priceMatch) {
        product.price = decodeHtmlEntities(priceMatch[1].trim());
        product.priceValue = parsePrice(product.price);
        product.currency = marketplace.currency;
      }
      
      // Prime badge dans ce bloc
      product.isPrime = productBlock.includes('a-icon-prime');
    }
    
    results.push(product);
  }
  
  return results;
}

function parseProductDetails(html, asin, country = "fr") {
  const marketplace = AMAZON_MARKETPLACES[country] || AMAZON_MARKETPLACES.fr;
  
  const product = {
    asin,
    source: "amazon",
    marketplace: country,
    url: `${marketplace.baseUrl}/dp/${asin}`
  };
  
  // Titre
  const titleMatch = html.match(/id="productTitle"[^>]*>([^<]+)</i) ||
                     html.match(/id="title"[^>]*>\s*<span[^>]*>([^<]+)</i) ||
                     html.match(/property="og:title"[^>]*content="([^"]+)"/i);
  if (titleMatch) {
    product.title = decodeHtmlEntities(titleMatch[1].trim());
  }
  
  // Images
  const images = [];
  const imgPattern = /"hiRes"\s*:\s*"([^"]+)"/gi;
  let imgMatch;
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    if (!images.includes(imgMatch[1])) {
      images.push(imgMatch[1]);
    }
  }
  
  // Image principale
  const mainImgMatch = html.match(/id="landingImage"[^>]*src="([^"]+)"/i) ||
                       html.match(/id="imgBlkFront"[^>]*src="([^"]+)"/i);
  if (mainImgMatch && !images.includes(mainImgMatch[1])) {
    images.unshift(mainImgMatch[1].replace(/\._[^.]+_\./, '._SL1500_.'));
  }
  
  if (images.length > 0) {
    product.images = images;
    product.image = images[0];
  }
  
  // Prix
  const priceMatch = html.match(/class="[^"]*priceToPay[^"]*"[^>]*>\s*<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>([^<]+)</i) ||
                     html.match(/id="priceblock_ourprice"[^>]*>([^<]+)</i) ||
                     html.match(/class="[^"]*a-price[^"]*aok-align-center[^"]*reinventPricePriceToPayMargin[^"]*"[^>]*>\s*<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>([^<]+)</i);
  if (priceMatch) {
    product.price = decodeHtmlEntities(priceMatch[1].trim());
    product.priceValue = parsePrice(product.price);
    product.currency = marketplace.currency;
  }
  
  // Note
  const ratingMatch = html.match(/class="[^"]*a-icon-alt[^"]*"[^>]*>([0-9,\.]+)\s*(?:sur|out of|von|de|di)\s*5/i);
  if (ratingMatch) {
    product.rating = parseFloat(ratingMatch[1].replace(",", "."));
  }
  
  // Nombre d'avis
  const reviewsMatch = html.match(/id="acrCustomerReviewText"[^>]*>([0-9\s,.]+)/i);
  if (reviewsMatch) {
    product.reviewCount = parseInt(reviewsMatch[1].replace(/[\s,\.]/g, ""));
  }
  
  // Description
  const descMatch = html.match(/id="productDescription"[^>]*>([\s\S]*?)<\/div>/i);
  if (descMatch) {
    let desc = descMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    product.description = decodeHtmlEntities(desc).substring(0, 1000);
  }
  
  // Détails techniques
  const details = {};
  const detailPattern = /<tr[^>]*>\s*<th[^>]*>([^<]+)<\/th>\s*<td[^>]*>([^<]+)<\/td>\s*<\/tr>/gi;
  let detailMatch;
  while ((detailMatch = detailPattern.exec(html)) !== null) {
    const key = decodeHtmlEntities(detailMatch[1].trim().replace(/\s+/g, " "));
    const value = decodeHtmlEntities(detailMatch[2].trim());
    if (key && value && key.length < 50) {
      details[key] = value;
    }
  }
  if (Object.keys(details).length > 0) {
    product.details = details;
  }
  
  // EAN/UPC (produits standards)
  const eanMatch = html.match(/(?:EAN|UPC|GTIN)[^:]*:\s*<\/th>\s*<td[^>]*>\s*([0-9]{8,14})\s*</i);
  if (eanMatch) {
    product.barcode = eanMatch[1];
    product.barcodeType = eanMatch[1].length === 13 ? "EAN" : "UPC";
  }
  
  // ISBN pour les livres (format Amazon rpi-attribute)
  // ISBN-10 : dans rpi-attribute-book_details-isbn10
  const isbn10Match = html.match(/rpi-attribute-book_details-isbn10"[^>]*>[\s\S]*?rpi-attribute-value"[^>]*>\s*<span>([0-9X]{10})<\/span>/i);
  if (isbn10Match) {
    product.isbn10 = isbn10Match[1];
    // Pour les livres, ISBN-10 peut aussi être le barcode
    if (!product.barcode) {
      product.barcode = isbn10Match[1];
      product.barcodeType = "ISBN-10";
    }
  }
  
  // ISBN-13 : dans rpi-attribute-book_details-isbn13
  const isbn13Match = html.match(/rpi-attribute-book_details-isbn13"[^>]*>[\s\S]*?rpi-attribute-value"[^>]*>\s*<span>([0-9-]{13,17})<\/span>/i);
  if (isbn13Match) {
    product.isbn13 = isbn13Match[1].replace(/-/g, ""); // Normaliser sans tirets
    product.isbn13Formatted = isbn13Match[1]; // Garder aussi la version formatée
    // ISBN-13 est le format EAN standard pour les livres
    if (!product.barcode || product.barcodeType === "ISBN-10") {
      product.barcode = product.isbn13;
      product.barcodeType = "ISBN-13";
    }
  }
  
  // Si ASIN commence par un chiffre et fait 10 caractères, c'est probablement un ISBN-10
  if (!product.isbn10 && /^[0-9]{9}[0-9X]$/.test(asin)) {
    product.isbn10 = asin;
    product.isBook = true;
  }
  
  // Marque
  const brandMatch = html.match(/id="bylineInfo"[^>]*>[^<]*(?:Marque|Brand|Marke)[^<]*<a[^>]*>([^<]+)</i) ||
                     html.match(/id="bylineInfo"[^>]*>([^<]+)</i);
  if (brandMatch) {
    product.brand = decodeHtmlEntities(brandMatch[1].replace(/Visiter la boutique|Visit the|Marke:/gi, "").trim());
  }
  
  // Prime
  product.isPrime = html.includes("a-icon-prime");
  
  // Disponibilité
  const availMatch = html.match(/id="availability"[^>]*>\s*<span[^>]*>([^<]+)</i);
  if (availMatch) {
    const availText = availMatch[1].toLowerCase();
    if (availText.includes("en stock") || availText.includes("in stock") || availText.includes("auf lager")) {
      product.availability = "in_stock";
    } else if (availText.includes("indisponible") || availText.includes("unavailable")) {
      product.availability = "unavailable";
    } else {
      product.availability = "limited";
      product.availabilityText = decodeHtmlEntities(availMatch[1].trim());
    }
  }
  
  return product;
}

// ============================================================================
// FONCTIONS PRINCIPALES
// ============================================================================

/**
 * Recherche de produits sur Amazon
 */
export async function searchAmazon(query, options = {}) {
  const {
    country = "fr",
    category = null,
    page = 1,
    limit = 20
  } = options;
  
  const marketplace = AMAZON_MARKETPLACES[country];
  if (!marketplace) {
    throw new Error(`Marketplace Amazon non supporté: ${country}. Valides: ${Object.keys(AMAZON_MARKETPLACES).join(', ')}`);
  }
  
  // Construire l'URL de recherche
  const params = new URLSearchParams({
    k: query,
    page: page.toString()
  });
  
  // Ajouter le filtre catégorie si spécifié
  if (category && AMAZON_CATEGORIES[category]) {
    const cat = AMAZON_CATEGORIES[category];
    if (cat.nodes[country]) {
      params.set("rh", `n:${cat.nodes[country]}`);
    }
    if (cat.searchAlias) {
      params.set("i", cat.searchAlias);
    }
  }
  
  const searchUrl = `${marketplace.baseUrl}/s?${params.toString()}`;
  const cacheKey = `amazon:search:${country}:${category || 'all'}:${query}:${page}`;
  
  // Vérifier le cache
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  log.debug(` Recherche "${query}" sur ${marketplace.name}...`);
  
  try {
    // Exécuter avec retry automatique sur détection robot
    const html = await executeWithRobotRetry(
      () => amazonFsrGet(searchUrl, 60000),
      `recherche "${query}" sur ${marketplace.name}`
    );
    
    if (!html || html.length < 1000) {
      throw new Error("Réponse Amazon vide ou trop courte");
    }
    
    // Parser les résultats
    const products = parseSearchResults(html, country);
    
    const result = {
      query,
      country,
      marketplace: marketplace.name,
      category: category || "all",
      page,
      total: products.length,
      results: products.slice(0, limit)
    };
    
    setCache(cacheKey, result, AMAZON_CACHE_TTL);
    log.debug(` ✅ ${result.results.length} produits trouvés`);
    
    return result;
    
  } catch (err) {
    log.error(` Erreur recherche:`, err.message);
    throw err;
  }
}

/**
 * Récupérer les détails d'un produit par ASIN
 */
export async function getAmazonProduct(asin, country = "fr") {
  const marketplace = AMAZON_MARKETPLACES[country];
  if (!marketplace) {
    throw new Error(`Marketplace Amazon non supporté: ${country}`);
  }
  
  if (!/^[A-Z0-9]{10}$/.test(asin)) {
    throw new Error(`ASIN invalide: ${asin}`);
  }
  
  const productUrl = `${marketplace.baseUrl}/dp/${asin}`;
  const cacheKey = `amazon:product:${country}:${asin}`;
  
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  log.debug(` Détails produit ${asin} sur ${marketplace.name}...`);
  
  try {
    // Exécuter avec retry automatique sur détection robot
    const html = await executeWithRobotRetry(
      () => amazonFsrGet(productUrl, 60000),
      `produit ${asin} sur ${marketplace.name}`
    );
    
    if (!html || html.length < 1000) {
      throw new Error("Réponse Amazon vide ou trop courte");
    }
    
    if (html.includes("nous n'avons trouvé aucun résultat") || 
        html.includes("we couldn't find that page") ||
        html.includes("Page Not Found")) {
      throw new Error(`Produit non trouvé: ${asin}`);
    }
    
    const product = parseProductDetails(html, asin, country);
    
    if (!product.title) {
      throw new Error(`Impossible d'extraire les infos du produit ${asin}`);
    }
    
    setCache(cacheKey, product, AMAZON_CACHE_TTL);
    log.debug(` ✅ Produit récupéré: ${product.title}`);
    
    return product;
    
  } catch (err) {
    log.error(` Erreur détails produit:`, err.message);
    throw err;
  }
}

/**
 * Rechercher un produit Amazon par code-barres (EAN/UPC)
 */
export async function searchAmazonByBarcode(barcode, options = {}) {
  const { country = "fr", category = null } = options;
  
  if (!/^[0-9]{8,14}$/.test(barcode)) {
    throw new Error(`Code-barres invalide: ${barcode}`);
  }
  
  log.debug(` Recherche par code-barres ${barcode}...`);
  
  const results = await searchAmazon(barcode, {
    country,
    category,
    limit: 10
  });
  
  // Filtrer pour garder uniquement les correspondances exactes si possible
  const exactMatches = results.results.filter(p => p.barcode === barcode);
  
  if (exactMatches.length > 0) {
    results.results = exactMatches;
    results.total = exactMatches.length;
    results.matchType = "exact";
  } else {
    results.matchType = "search";
  }
  
  return results;
}

/**
 * Recherche multi-pays simultanée
 */
export async function searchMultiCountry(query, countries = ["fr", "us", "uk"], options = {}) {
  const results = {};
  const errors = {};
  
  for (const country of countries) {
    try {
      await sleep(1500); // Délai entre les requêtes pour éviter les blocks
      results[country] = await searchAmazon(query, { ...options, country });
    } catch (err) {
      errors[country] = err.message;
      log.error(` Erreur recherche ${country}:`, err.message);
    }
  }
  
  return {
    query,
    countries,
    results,
    errors: Object.keys(errors).length > 0 ? errors : undefined
  };
}

/**
 * Obtenir le meilleur prix parmi plusieurs pays
 */
export async function comparePrices(asin, countries = ["fr", "us", "uk", "de", "es"]) {
  const prices = [];
  const errors = [];
  
  for (const country of countries) {
    try {
      await sleep(1500);
      const product = await getAmazonProduct(asin, country);
      
      if (product.priceValue) {
        prices.push({
          country,
          marketplace: AMAZON_MARKETPLACES[country].name,
          price: product.price,
          priceValue: product.priceValue,
          currency: product.currency,
          isPrime: product.isPrime,
          availability: product.availability,
          url: product.url
        });
      }
    } catch (err) {
      errors.push({ country, error: err.message });
    }
  }
  
  // Trier par prix (conversion approx. en EUR)
  const conversionRates = {
    EUR: 1,
    USD: 0.92,
    GBP: 1.17,
    CAD: 0.68,
    JPY: 0.0061
  };
  
  prices.sort((a, b) => {
    const aEur = a.priceValue * (conversionRates[a.currency] || 1);
    const bEur = b.priceValue * (conversionRates[b.currency] || 1);
    return aEur - bEur;
  });
  
  return {
    asin,
    prices,
    bestPrice: prices[0] || null,
    errors: errors.length > 0 ? errors : undefined
  };
}

// ============================================================================
// EXPORTS UTILITAIRES
// ============================================================================

export function getSupportedMarketplaces() {
  return Object.entries(AMAZON_MARKETPLACES).map(([code, info]) => ({
    code,
    name: info.name,
    domain: info.domain,
    currency: info.currency
  }));
}

export function getSupportedCategories() {
  return Object.entries(AMAZON_CATEGORIES).map(([code, info]) => ({
    code,
    name: info.name
  }));
}
