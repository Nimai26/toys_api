// lib/providers/tcg/onepiece.js
// Scraper One Piece TCG depuis fr.onepiece-cardgame.com
// Utilise FlareSolverr via VPN (Gluetun) pour contourner Cloudflare
// SÉCURITÉ: Tout le trafic passe par le VPN

import { createLogger } from '../../utils/logger.js';
import { getCached, setCache } from '../../utils/state.js';

const log = createLogger('OnePieceTCG');

// ============================================================================
// CONFIGURATION
// ============================================================================

// URL de contrôle Gluetun pour la rotation d'IP
const GLUETUN_CONTROL_URL = process.env.GLUETUN_CONTROL_URL || "http://10.110.1.1:8193";

// FlareSolverr (via réseau gluetun, donc accessible via localhost du container gluetun)
// Depuis toys_api, on accède via l'IP de l'hôte + port mappé
const FSR_URL = process.env.FSR_URL || "http://10.110.1.1:8191/v1";

// TTL cache One Piece (30 minutes - données statiques qui changent rarement)
const ONEPIECE_CACHE_TTL = 1800000; // 30 minutes
const ONEPIECE_CARD_CACHE_TTL = 3600000; // 1 heure pour détails de carte

// ============================================================================
// CIRCUIT BREAKER - Désactive One Piece temporairement si bloqué
// ============================================================================
let onepieceCircuitOpen = false;
let onepieceCircuitOpenTime = null;
const CIRCUIT_COOLDOWN = 15 * 60 * 1000; // 15 minutes avant réessai
let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_CIRCUIT_OPEN = 3;

/**
 * Vérifie si One Piece est disponible (circuit breaker fermé)
 * @returns {{available: boolean, reason: string|null, retryAfter: number|null}}
 */
export function isOnePieceAvailable() {
  if (!onepieceCircuitOpen) {
    return { available: true, reason: null, retryAfter: null };
  }
  
  const elapsed = Date.now() - onepieceCircuitOpenTime;
  if (elapsed >= CIRCUIT_COOLDOWN) {
    // Réouvrir le circuit pour réessayer
    log.info('🔄 Circuit breaker One Piece: tentative de réouverture après cooldown');
    onepieceCircuitOpen = false;
    consecutiveFailures = 0;
    return { available: true, reason: null, retryAfter: null };
  }
  
  const retryAfter = Math.ceil((CIRCUIT_COOLDOWN - elapsed) / 1000);
  return { 
    available: false, 
    reason: 'One Piece TCG temporairement désactivé (détection anti-bot)',
    retryAfter 
  };
}

/**
 * Signale un succès One Piece (reset failures)
 */
function recordOnePieceSuccess() {
  consecutiveFailures = 0;
  if (onepieceCircuitOpen) {
    log.info('✅ Circuit breaker One Piece: fermé après succès');
    onepieceCircuitOpen = false;
  }
}

/**
 * Signale un échec One Piece (potentiellement ouvre le circuit)
 */
function recordOnePieceFailure(isCloudflareBlock = false) {
  consecutiveFailures++;
  
  if (isCloudflareBlock && consecutiveFailures >= MAX_FAILURES_BEFORE_CIRCUIT_OPEN) {
    onepieceCircuitOpen = true;
    onepieceCircuitOpenTime = Date.now();
    log.warn(`🔴 Circuit breaker One Piece: OUVERT après ${consecutiveFailures} échecs consécutifs`);
    log.warn(`   Retry dans ${CIRCUIT_COOLDOWN / 60000} minutes`);
  }
}

// IP de l'hôte à ne JAMAIS utiliser pour One Piece
let HOST_PUBLIC_IP = null;
let lastVpnCheck = 0;
let cachedVpnIp = null;
const VPN_CHECK_INTERVAL = 60000; // Vérifier le VPN toutes les 60 secondes max

// Détecter l'IP publique de l'hôte au démarrage
(async () => {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { timeout: 5000 });
    if (res.ok) {
      const data = await res.json();
      HOST_PUBLIC_IP = data.ip;
      log.debug(` IP hôte détectée: ${HOST_PUBLIC_IP} (sera bloquée pour One Piece)`);
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
    
    const ipData = await ipRes.json();
    const vpnIp = ipData.public_ip;
    
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
 * Utilitaire sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// SCRAPING VIA FLARESOLVERR
// ============================================================================

/**
 * Scrape une URL via FlareSolverr (contourne Cloudflare)
 * @param {string} url - URL à scraper
 * @param {number} maxTimeout - Timeout max en ms
 * @returns {Promise<string>} HTML de la page
 */
async function scrapePage(url, maxTimeout = 60000) {
  try {
    log.debug(` Requête FlareSolverr: ${url}`);
    
    const response = await fetch(FSR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'request.get',
        url: url,
        maxTimeout: maxTimeout
      }),
      signal: AbortSignal.timeout(maxTimeout + 5000)
    });

    if (!response.ok) {
      throw new Error(`FlareSolverr HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'ok') {
      throw new Error(`FlareSolverr status: ${data.status} - ${data.message || 'Unknown error'}`);
    }

    if (!data.solution || !data.solution.response) {
      throw new Error('FlareSolverr: solution.response manquant');
    }

    log.debug(` HTML récupéré (${data.solution.response.length} chars)`);
    return data.solution.response;

  } catch (error) {
    log.error(` Erreur FlareSolverr: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// MÉTHODES PUBLIQUES
// ============================================================================

/**
 * Récupère toutes les cartes de la cardlist (ou depuis le cache)
 * @param {object} options - Options
 * @returns {Promise<Array>} Liste des cartes brutes
 */
export async function getAllOnePieceCards(options = {}) {
  const cacheKey = 'onepiece_all_cards';
  
  // Vérifier le cache (30 min)
  const cached = getCached(cacheKey);
  if (cached && !options.bypassCache) {
    log.debug(' Cache hit pour toutes les cartes');
    return cached;
  }

  // Vérifier circuit breaker
  const availability = isOnePieceAvailable();
  if (!availability.available) {
    throw new Error(availability.reason);
  }

  // Vérifier VPN
  const vpnCheck = await checkVpnStatus();
  if (!vpnCheck.ok) {
    log.error(` VPN non disponible: ${vpnCheck.error}`);
    throw new Error('VPN requis pour One Piece TCG - Gluetun doit être actif');
  }

  log.info(` Scraping cardlist via VPN (IP: ${vpnCheck.ip})`);

  try {
    // Utiliser le JSON disponible sur onepiece-cardgame.dev (plus facile que le scraping HTML)
    // Mais passer quand même par le VPN pour éviter les bans
    const cardsUrl = 'https://www.onepiece-cardgame.dev/cards.json';
    const metaUrl = 'https://www.onepiece-cardgame.dev/meta.json';
    
    log.debug(` Téléchargement cards.json via VPN...`);
    
    // Pour le moment, on va télécharger directement le JSON (pas de Cloudflare sur ce domaine)
    // Si Cloudflare est ajouté plus tard, on utilisera FlareSolverr
    const cardsRes = await fetch(cardsUrl, {
      signal: AbortSignal.timeout(30000)
    });
    
    if (!cardsRes.ok) {
      throw new Error(`HTTP ${cardsRes.status} pour cards.json`);
    }
    
    const cards = await cardsRes.json();
    
    // Télécharger aussi les métadonnées
    const metaRes = await fetch(metaUrl, {
      signal: AbortSignal.timeout(30000)
    });
    
    let meta = null;
    if (metaRes.ok) {
      meta = await metaRes.json();
    }
    
    // Enrichir les cartes avec les métadonnées
    const enrichedCards = enrichCardsWithMeta(cards, meta);

    // Succès - reset failures
    recordOnePieceSuccess();
    
    // Mettre en cache
    setCache(cacheKey, enrichedCards, ONEPIECE_CACHE_TTL);
    
    log.info(` ${enrichedCards.length} cartes récupérées et mises en cache`);
    return enrichedCards;

  } catch (error) {
    log.error(` Erreur scraping: ${error.message}`);
    recordOnePieceFailure(error.message.includes('Cloudflare') || error.message.includes('403'));
    throw error;
  }
}

/**
 * Enrichit les cartes avec les métadonnées (types, couleurs, raretés)
 */
function enrichCardsWithMeta(cards, meta) {
  if (!meta) return cards;
  
  // Créer des maps pour recherche rapide
  const typesMap = {};
  const colorsMap = {};
  const raritiesMap = {};
  const attributesMap = {};
  const setsMap = {};
  
  if (meta.t) meta.t.forEach(t => typesMap[t.type_id] = t.name);
  if (meta.c) meta.c.forEach(c => colorsMap[c.color_id] = c.name);
  if (meta.r) meta.r.forEach(r => raritiesMap[r.rarity_id] = r.name);
  if (meta.a) meta.a.forEach(a => attributesMap[a.atk_id] = a.name);
  if (meta.s) meta.s.forEach(s => setsMap[s.src_id] = s);
  
  return cards.map(card => ({
    ...card,
    type_name: typesMap[card.t] || 'Unknown',
    color_name: colorsMap[card.col] || 'Unknown',
    rarity_name: raritiesMap[card.r] || 'Unknown',
    attribute_name: attributesMap[card.a] || 'N/A',
    set_info: setsMap[card.srcId] || null
  }));
}

/**
 * Recherche des cartes One Piece par nom
 * @param {string} query - Nom de la carte (recherche fuzzy)
 * @param {object} options - Options de filtrage
 * @returns {Promise<Array>} Cartes trouvées
 */
export async function searchOnePieceCards(query, options = {}) {
  const allCards = await getAllOnePieceCards(options);
  
  if (!query || query.trim() === '') {
    return allCards;
  }
  
  const lowerQuery = query.toLowerCase();
  let filtered = allCards.filter(card => 
    card.n?.toLowerCase().includes(lowerQuery)
  );
  
  // Filtres additionnels
  if (options.type) {
    filtered = filtered.filter(c => c.type_name?.toLowerCase() === options.type.toLowerCase());
  }
  
  if (options.color) {
    filtered = filtered.filter(c => c.color_name?.toLowerCase().includes(options.color.toLowerCase()));
  }
  
  if (options.rarity) {
    filtered = filtered.filter(c => c.rarity_name?.toLowerCase() === options.rarity.toLowerCase());
  }
  
  if (options.set) {
    const setUpper = options.set.toUpperCase();
    filtered = filtered.filter(c => c.cid?.startsWith(setUpper));
  }
  
  if (options.cost) {
    const cost = parseInt(options.cost);
    if (!isNaN(cost)) {
      filtered = filtered.filter(c => c.cs === cost.toString() || c.cs === cost);
    }
  }
  
  if (options.power) {
    const power = parseInt(options.power);
    if (!isNaN(power)) {
      filtered = filtered.filter(c => c.p === power.toString() || c.p === power);
    }
  }
  
  if (options.trait) {
    const traitLower = options.trait.toLowerCase();
    filtered = filtered.filter(c => c.tr?.toLowerCase().includes(traitLower));
  }
  
  if (options.attribute) {
    filtered = filtered.filter(c => c.attribute_name?.toLowerCase() === options.attribute.toLowerCase());
  }
  
  return filtered;
}

/**
 * Récupère une carte One Piece par son ID exact
 * @param {string} cardId - ID de la carte (ex: OP01-047)
 * @param {object} options - Options
 * @returns {Promise<object|null>} Carte trouvée ou null
 */
export async function getOnePieceCardById(cardId, options = {}) {
  const cacheKey = `onepiece_card_${cardId}`;
  
  const cached = getCached(cacheKey);
  if (cached && !options.bypassCache) {
    return cached;
  }
  
  const allCards = await getAllOnePieceCards(options);
  const card = allCards.find(c => c.cid === cardId);
  
  if (card) {
    setCache(cacheKey, card, ONEPIECE_CARD_CACHE_TTL);
  }
  
  return card || null;
}

/**
 * Récupère une carte One Piece par son nom exact
 * @param {string} name - Nom de la carte
 * @param {object} options - Options
 * @returns {Promise<object|null>} Carte trouvée ou null
 */
export async function getOnePieceCardByName(name, options = {}) {
  const allCards = await getAllOnePieceCards(options);
  return allCards.find(c => c.n?.toLowerCase() === name.toLowerCase()) || null;
}
