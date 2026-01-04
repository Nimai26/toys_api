/**
 * Fetch Proxy Wrapper - Route les requêtes HTTP via le proxy Gluetun VPN
 * 
 * Utilise le proxy HTTP de Gluetun pour masquer l'IP réelle lors du scraping
 * et des requêtes vers des APIs externes qui pourraient bannir l'IP.
 * 
 * Compatible avec l'API fetch native de Node.js.
 */

import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { createLogger } from './logger.js';

const log = createLogger('FetchProxy');

// Configuration du proxy Gluetun
const PROXY_URL = process.env.VPN_PROXY_URL || 'http://gluetun-toys:8888';
const USE_PROXY = process.env.USE_FETCH_PROXY !== 'false'; // Activé par défaut

// URLs à exclure du proxy (services Docker internes)
const PROXY_EXCLUSIONS = [
  'gluetun-toys',        // FlareSolverr, Proxy VPN, Control API
  'docker-mailserver',   // SMTP interne
  'auto_trad',           // Service de traduction interne
  'localhost',           // Local
  '127.0.0.1',          // Loopback IPv4
  '::1',                // Loopback IPv6
  '10.110.1.',          // Réseau local (range privé)
];

// Agents proxy réutilisables (singletons)
let httpAgent = null;
let httpsAgent = null;

/**
 * Vérifie si une URL doit être exclue du proxy (service Docker interne)
 * @param {string} url - URL à vérifier
 * @returns {boolean}
 */
function shouldBypassProxy(url) {
  const urlStr = url.toString().toLowerCase();
  return PROXY_EXCLUSIONS.some(exclusion => urlStr.includes(exclusion));
}

/**
 * Obtenir ou créer les agents proxy
 */
function getProxyAgents() {
  if (!httpAgent && USE_PROXY) {
    try {
      httpAgent = new HttpProxyAgent(PROXY_URL);
      httpsAgent = new HttpsProxyAgent(PROXY_URL);
      log.info(`🔒 Proxy HTTP/HTTPS activé: ${PROXY_URL}`);
    } catch (err) {
      log.error(`❌ Erreur création ProxyAgent: ${err.message}`);
    }
  }
  return { httpAgent, httpsAgent };
}

/**
 * Wrapper fetch qui utilise le proxy VPN Gluetun
 * 
 * @param {string|URL} url - URL à récupérer
 * @param {Object} options - Options fetch (headers, method, body, etc.)
 * @returns {Promise<Response>} - Response fetch
 * 
 * @example
 * const response = await fetchViaProxy('https://example.com/api/data');
 * const data = await response.json();
 */
export async function fetchViaProxy(url, options = {}) {
  // Bypass proxy pour les services Docker internes
  if (shouldBypassProxy(url)) {
    return await fetch(url, options);
  }

  const { httpAgent, httpsAgent } = getProxyAgents();
  
  if (httpAgent && httpsAgent) {
    // Déterminer quel agent utiliser selon le protocole
    const urlStr = url.toString();
    const agent = urlStr.startsWith('https') ? httpsAgent : httpAgent;
    
    // Utiliser le proxy VPN
    const fetchOptions = {
      ...options,
      agent, // Node.js fetch utilise 'agent' pour HTTP(S)_PROXY
    };
    
    try {
      return await fetch(url, fetchOptions);
    } catch (err) {
      // Si le proxy échoue, logger mais ne pas fallback (on veut forcer le VPN)
      log.error(`❌ Fetch via proxy échoué pour ${url}: ${err.message}`);
      throw err;
    }
  } else {
    // Proxy désactivé ou non disponible - fallback sur fetch natif
    if (USE_PROXY) {
      log.warn(`⚠️ Proxy non disponible, utilisation fetch natif pour ${url}`);
    }
    return await fetch(url, options);
  }
}

/**
 * Vérifier si le proxy VPN est actif
 * @returns {Promise<boolean>}
 */
export async function isProxyActive() {
  try {
    const response = await fetchViaProxy('https://api.ipify.org?format=json', { 
      signal: AbortSignal.timeout(5000) 
    });
    
    if (response.ok) {
      const data = await response.json();
      log.debug(`✅ Proxy actif - IP: ${data.ip}`);
      return true;
    }
  } catch (err) {
    log.warn(`⚠️ Proxy non accessible: ${err.message}`);
  }
  
  return false;
}

// Export par défaut
export default fetchViaProxy;

// Initialisation au chargement du module
if (USE_PROXY) {
  getProxyAgents();
  log.info('🛡️ Fetch Proxy VPN initialisé');
} else {
  log.info('ℹ️ Fetch Proxy VPN désactivé (USE_FETCH_PROXY=false)');
}
