/**
 * lib/utils/puppeteer-stealth.js
 * Gestionnaire Puppeteer avec plugin Stealth pour contourner la détection anti-bot
 * Utilise un proxy VPN (Gluetun) pour masquer l'IP réelle
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createLogger } from './logger.js';

const log = createLogger('PuppeteerStealth');

// Activer le plugin stealth
puppeteer.use(StealthPlugin());

// Instance du browser (singleton)
let browserInstance = null;
let browserLaunchPromise = null;
let lastUsed = Date.now();
const BROWSER_TIMEOUT = 5 * 60 * 1000; // 5 minutes d'inactivité avant fermeture

// Chemin Chromium système (Docker) ou téléchargé par Puppeteer
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || null;

// Configuration du proxy VPN (Gluetun HTTP Proxy)
const VPN_PROXY_URL = process.env.VPN_PROXY_URL || 'http://gluetun-toys:8888';
const USE_VPN_PROXY = process.env.PUPPETEER_USE_VPN !== 'false'; // Activé par défaut

// Configuration du browser de base (sans proxy - sera ajouté dynamiquement)
const BASE_BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--window-size=1920,1080',
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--lang=fr-FR,fr',
  '--single-process', // Important pour Docker
  // Arguments supplémentaires anti-détection
  '--disable-infobars',
  '--hide-scrollbars',
  '--mute-audio',
  '--disable-notifications',
  '--disable-extensions',
  '--no-first-run',
  '--no-default-browser-check',
];

// User agents réalistes (rotatifs)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
];

// Log la config au démarrage
if (USE_VPN_PROXY) {
  log.info(`🔒 Proxy VPN activé: ${VPN_PROXY_URL}`);
} else {
  log.warn('⚠️ Proxy VPN désactivé - IP réelle sera utilisée');
}/**
 * Obtient une instance du browser (crée si nécessaire)
 * @param {boolean} useProxy - Utiliser le proxy VPN (défaut: USE_VPN_PROXY)
 */
async function getBrowser(useProxy = USE_VPN_PROXY) {
  // Si le browser existe et est connecté, le retourner
  if (browserInstance && browserInstance.isConnected()) {
    lastUsed = Date.now();
    return browserInstance;
  }

  // Si un lancement est déjà en cours, attendre
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  // Construire les arguments avec ou sans proxy
  const browserArgs = [...BASE_BROWSER_ARGS];
  if (useProxy) {
    browserArgs.push(`--proxy-server=${VPN_PROXY_URL}`);
    log.info(`🚀 Lancement Puppeteer Stealth via proxy VPN (${VPN_PROXY_URL})...`);
  } else {
    log.info('🚀 Lancement Puppeteer Stealth (sans proxy)...');
  }

  // Configuration complète du browser
  const browserConfig = {
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: browserArgs,
    ignoreHTTPSErrors: true,
    ignoreDefaultArgs: ['--enable-automation'],
  };
  
  browserLaunchPromise = puppeteer.launch(browserConfig);
  
  try {
    browserInstance = await browserLaunchPromise;
    log.info('✅ Puppeteer Stealth prêt' + (useProxy ? ' (via VPN)' : ''));
    
    // Gérer la fermeture inattendue
    browserInstance.on('disconnected', () => {
      log.warn('⚠️ Browser déconnecté');
      browserInstance = null;
      browserLaunchPromise = null;
    });
    
    return browserInstance;
  } catch (err) {
    log.error('❌ Erreur lancement Puppeteer:', err.message);
    browserLaunchPromise = null;
    throw err;
  } finally {
    browserLaunchPromise = null;
  }
}

/**
 * Ferme le browser si inactif
 */
async function closeBrowserIfIdle() {
  if (browserInstance && Date.now() - lastUsed > BROWSER_TIMEOUT) {
    log.info('🔒 Fermeture du browser (inactivité)');
    try {
      await browserInstance.close();
    } catch (e) {
      // Ignorer les erreurs de fermeture
    }
    browserInstance = null;
  }
}

// Vérifier périodiquement l'inactivité
setInterval(closeBrowserIfIdle, 60000);

/**
 * Obtient un User-Agent aléatoire
 */
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Effectue une requête GET avec Puppeteer Stealth
 * @param {string} url - URL à charger
 * @param {Object} options - Options
 * @returns {Promise<{html: string, status: number, url: string}>}
 */
export async function stealthGet(url, options = {}) {
  const {
    timeout = 30000,
    waitFor = 'networkidle2',
    userAgent = getRandomUserAgent(),
    cookies = [],
    extraHeaders = {},
    skipExtraNavWait = false,
    handleNavigation = false, // Pour gérer les sites qui redirigent pendant le chargement
  } = options;

  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    // Configuration anti-détection avancée
    await page.setUserAgent(userAgent);
    await page.setViewport({ 
      width: 1920 + Math.floor(Math.random() * 100), 
      height: 1080 + Math.floor(Math.random() * 100),
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false,
    });
    
    // Masquer webdriver
    await page.evaluateOnNewDocument(() => {
      // Supprimer webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Simuler plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ],
      });
      
      // Simuler languages
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
      
      // Chrome runtime
      window.chrome = { runtime: {} };
      
      // Permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    
    // Headers supplémentaires
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      ...extraHeaders,
    });

    // Cookies si fournis
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }

    // Navigation
    log.debug(`📄 Chargement: ${url}`);
    
    let response;
    if (handleNavigation) {
      // Pour les sites qui font des redirections pendant le chargement (Pokemon.com)
      // On utilise un Promise.race pour capturer soit le goto soit la navigation
      try {
        response = await Promise.race([
          page.goto(url, { waitUntil: waitFor, timeout }),
          page.waitForNavigation({ waitUntil: waitFor, timeout }).then(() => null)
        ]);
      } catch (err) {
        // Si la navigation échoue, on continue quand même
        log.debug(`Navigation partielle: ${err.message}`);
      }
    } else {
      // Comportement normal
      response = await page.goto(url, { waitUntil: waitFor, timeout });
    }

    // Attendre les navigations supplémentaires (ex: redirections JS)
    if (!skipExtraNavWait && !handleNavigation) {
      try {
        await page.waitForNavigation({ 
          waitUntil: 'networkidle2', 
          timeout: 5000 
        }).catch(() => {
          // Pas de navigation supplémentaire, c'est OK
          log.debug('Pas de navigation supplémentaire');
        });
      } catch (err) {
        // Timeout = pas de navigation = OK
        log.debug('Pas de navigation détectée après 5s');
      }
    }

    // Simuler des comportements humains
    // 1. Attendre un délai aléatoire
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
    
    // 2. Scroll aléatoire pour simuler un utilisateur
    try {
      await page.evaluate(() => {
        window.scrollTo(0, 300 + Math.random() * 500);
      });
    } catch (err) {
      log.debug('Erreur lors du scroll (contexte détruit?)');
    }
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // 3. Mouvements de souris simulés
    try {
      await page.mouse.move(
        400 + Math.floor(Math.random() * 800),
        300 + Math.floor(Math.random() * 400)
      );
    } catch (err) {
      log.debug('Erreur lors du mouvement souris (contexte détruit?)');
    }
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

    // 4. Attendre le lazy-loading des images (pour Pokemon.com)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Récupérer le HTML
    const html = await page.content();
    const status = response ? response.status() : 0;
    const finalUrl = page.url();

    log.debug(`✅ Page chargée (${status}) - ${html.length} chars`);

    return { html, status, url: finalUrl };

  } finally {
    await page.close();
  }
}

/**
 * Effectue une recherche Amazon avec Puppeteer Stealth
 * @param {string} searchUrl - URL de recherche Amazon
 * @param {Object} options - Options
 * @returns {Promise<string>} - HTML de la page
 */
export async function amazonStealthSearch(searchUrl, options = {}) {
  const {
    timeout = 45000,
    retries = 2,
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      log.debug(`🔍 Tentative ${attempt}/${retries}: ${searchUrl}`);
      
      const result = await stealthGet(searchUrl, {
        timeout,
        waitFor: 'domcontentloaded',
        userAgent: getRandomUserAgent(), // UA différent à chaque tentative
      });

      // Vérifier si on a été bloqué
      if (isAmazonBlocked(result.html)) {
        log.warn(`⚠️ Amazon bloqué (tentative ${attempt})`);
        
        if (attempt < retries) {
          // Attendre avant de réessayer
          await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
          continue;
        }
        throw new Error('Amazon a détecté une activité automatisée');
      }

      return result.html;

    } catch (err) {
      lastError = err;
      log.warn(`❌ Tentative ${attempt} échouée: ${err.message}`);
      
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error('Échec après plusieurs tentatives');
}

/**
 * Vérifie si Amazon a bloqué la requête
 */
function isAmazonBlocked(html) {
  if (!html) return true;
  
  // Indicateurs précis de captcha/blocage (éviter faux positifs)
  const blockedIndicators = [
    'api-services-support@amazon.com',
    'Sorry, we just need to make sure',
    'Enter the characters you see below',
    'Saisissez les caractères que vous voyez',
    'Type the characters you see in this image',
    'To discuss automated access to Amazon data',
    'captcha',
    '/errors/validateCaptcha',
  ];
  
  const lowerHtml = html.toLowerCase();
  const isBlocked = blockedIndicators.some(indicator => 
    lowerHtml.includes(indicator.toLowerCase())
  );
  
  // Debug: afficher un extrait du HTML si bloqué
  if (isBlocked) {
    log.debug(`🔍 HTML bloqué (extrait): ${html.substring(0, 500).replace(/\s+/g, ' ')}`);
  }
  
  return isBlocked;
}

/**
 * Vérifie si Puppeteer Stealth est disponible
 */
export async function isPuppeteerAvailable() {
  try {
    const browser = await getBrowser();
    return browser.isConnected();
  } catch (err) {
    return false;
  }
}

/**
 * Ferme le browser proprement
 */
export async function closeBrowser() {
  if (browserInstance) {
    log.info('🔒 Fermeture du browser Puppeteer');
    try {
      await browserInstance.close();
    } catch (e) {
      // Ignorer
    }
    browserInstance = null;
  }
}

/**
 * Statistiques du browser
 */
export function getBrowserStats() {
  return {
    isRunning: browserInstance?.isConnected() || false,
    lastUsed: new Date(lastUsed).toISOString(),
    idleTime: Math.floor((Date.now() - lastUsed) / 1000),
    vpnProxy: {
      enabled: USE_VPN_PROXY,
      url: USE_VPN_PROXY ? VPN_PROXY_URL : null,
    },
  };
}

/**
 * Vérifie si le proxy VPN est accessible
 * @returns {Promise<{ok: boolean, ip: string|null, error: string|null}>}
 */
export async function checkVpnProxy() {
  if (!USE_VPN_PROXY) {
    return { ok: true, ip: null, error: 'Proxy VPN désactivé' };
  }

  try {
    const browser = await getBrowser(true);
    const page = await browser.newPage();
    
    try {
      // Vérifier l'IP via un service externe
      await page.goto('https://api.ipify.org?format=json', { 
        waitUntil: 'networkidle2',
        timeout: 15000 
      });
      
      const content = await page.content();
      const ipMatch = content.match(/"ip"\s*:\s*"([^"]+)"/);
      const ip = ipMatch ? ipMatch[1] : null;
      
      if (ip) {
        log.debug(`🔒 IP via proxy VPN: ${ip}`);
        return { ok: true, ip, error: null };
      }
      
      return { ok: false, ip: null, error: 'Impossible de récupérer l\'IP via le proxy' };
    } finally {
      await page.close();
    }
  } catch (err) {
    log.error(`❌ Erreur vérification proxy VPN: ${err.message}`);
    return { ok: false, ip: null, error: err.message };
  }
}

export default {
  stealthGet,
  amazonStealthSearch,
  isPuppeteerAvailable,
  closeBrowser,
  getBrowserStats,
  checkVpnProxy,
  VPN_PROXY_URL,
  USE_VPN_PROXY,
};
