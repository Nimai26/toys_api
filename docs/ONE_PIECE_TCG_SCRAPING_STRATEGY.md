# 🏴‍☠️ One Piece TCG - Stratégie de scraping (site officiel FR)

> **Date** : 1er janvier 2026  
> **Objectif** : Scraper https://fr.onepiece-cardgame.com/ malgré Cloudflare  
> **Infrastructure** : Gluetun VPN + FlareSolverr (réutilisation de l'architecture Amazon)

---

## 🎯 Objectif

Extraire les données de cartes One Piece depuis le site officiel français **https://fr.onepiece-cardgame.com/** en utilisant notre infrastructure VPN existante pour éviter les bans IP.

---

## 🏗️ Architecture existante (réutilisable)

### Infrastructure déployée

```yaml
gluetun-toys:
  - VPN: Private Internet Access
  - Kill switch: ✅
  - HTTP Proxy: ✅ (port 8888)
  - Control API: ✅ (port ${TOY_API_GLUETUN_CONTROL_PORT})
  - Rotation IP: ✅ automatique toutes les 30 min

flaresolverr-vpn:
  - Via réseau gluetun (network_mode: service:gluetun-toys)
  - Port: 8191 (accessible via gluetun)
  - Protection Cloudflare: ✅
  - Browser: Chromium headless

vpn-monitor:
  - Health check: toutes les 60s
  - Rotation automatique: toutes les 1800s
  - Auto-restart VPN: après 3 échecs
```

### Provider Amazon existant (modèle à suivre)

```javascript
// lib/providers/amazon.js
- Utilise puppeteer-stealth via proxy VPN
- Circuit breaker après 3 échecs consécutifs
- Vérification VPN active avant chaque requête
- Rotation IP automatique en cas de détection
- Cache TTL: 10 minutes
```

---

## 📋 Analyse du site One Piece TCG

### Structure du site

```
https://fr.onepiece-cardgame.com/
├── /cardlist/                    # Liste de toutes les cartes
├── /products/boosters/op14.php   # Détails d'un set
├── /products/decks/st29.php      # Détails d'un deck
└── /card/[id].php                # Détails d'une carte
```

### Protection détectée

- ✅ **Cloudflare** (challenge JavaScript + cookies)
- ✅ **Anti-bot** (User-Agent check)
- ⚠️ **Rate limiting** (probablement basé sur IP)

### Données disponibles

```
Cardlist:
- Nom de la carte (français ✅)
- Numéro (ex: OP01-047)
- Set/Extension
- Rareté
- Type (Leader, Character, Event, Stage)
- Couleur
- Image (URL)

Page carte individuelle:
- Effet complet (français ✅)
- Cost
- Power
- Counter
- Life (Leaders)
- Traits
- Attribut
- Description flavor text
```

---

## 🛠️ Stratégie d'implémentation

### Phase 1 : Provider One Piece (scraping via VPN)

Créer **`lib/providers/onepiece.js`** sur le modèle d'Amazon :

```javascript
// lib/providers/onepiece.js
import { createLogger } from '../utils/logger.js';
import { getCached, setCache } from '../utils/state.js';

let puppeteerStealth = null;
let puppeteerAvailable = false;

// Charger puppeteer-stealth
(async () => {
  try {
    puppeteerStealth = await import('../utils/puppeteer-stealth.js');
    puppeteerAvailable = true;
    log.info('✅ Puppeteer Stealth chargé pour One Piece TCG');
  } catch (err) {
    log.error('❌ Puppeteer Stealth non disponible - One Piece TCG désactivé');
  }
})();

const log = createLogger('OnePiece');

// URL de contrôle Gluetun
const GLUETUN_CONTROL_URL = process.env.GLUETUN_CONTROL_URL || "http://gluetun-toys:8000";

// TTL cache One Piece (30 minutes - données statiques)
const ONEPIECE_CACHE_TTL = 1800000; // 30 minutes

// Circuit breaker
let onepieceCircuitOpen = false;
let onepieceCircuitOpenTime = null;
const CIRCUIT_COOLDOWN = 15 * 60 * 1000; // 15 minutes
let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_CIRCUIT_OPEN = 3;

/**
 * Vérifie si One Piece est disponible (circuit breaker)
 */
export function isOnePieceAvailable() {
  if (!onepieceCircuitOpen) {
    return { available: true, reason: null, retryAfter: null };
  }
  
  const elapsed = Date.now() - onepieceCircuitOpenTime;
  if (elapsed >= CIRCUIT_COOLDOWN) {
    log.info('🔄 Circuit breaker One Piece: réouverture');
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
 * Vérifie que le VPN est actif
 */
async function checkVpnStatus() {
  try {
    const statusRes = await fetch(`${GLUETUN_CONTROL_URL}/v1/openvpn/status`, { 
      timeout: 5000 
    });
    
    if (!statusRes.ok) {
      return { ok: false, error: "Gluetun API inaccessible" };
    }
    
    const status = await statusRes.json();
    if (status.status !== "running") {
      return { ok: false, error: `VPN status: ${status.status}` };
    }

    const ipRes = await fetch(`${GLUETUN_CONTROL_URL}/v1/publicip/ip`, { 
      timeout: 5000 
    });
    
    if (!ipRes.ok) {
      return { ok: false, error: "Impossible de récupérer l'IP VPN" };
    }
    
    const vpnIp = (await ipRes.text()).trim();
    return { ok: true, ip: vpnIp, error: null };

  } catch (e) {
    return { ok: false, error: `Erreur vérification VPN: ${e.message}` };
  }
}

/**
 * Scrape la cardlist One Piece via FlareSolverr + VPN
 */
export async function scrapeOnePieceCardlist(options = {}) {
  const cacheKey = 'onepiece_cardlist';
  
  // Vérifier le cache (30 min)
  const cached = getCached(cacheKey);
  if (cached && !options.bypassCache) {
    log.debug(' Cache hit pour cardlist');
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
    throw new Error('VPN requis pour One Piece TCG');
  }

  log.info(` Scraping cardlist via VPN (IP: ${vpnCheck.ip})`);

  try {
    if (!puppeteerAvailable) {
      throw new Error('Puppeteer Stealth non disponible');
    }

    // Utiliser FlareSolverr via VPN pour contourner Cloudflare
    const flareSolverUrl = process.env.FSR_URL || 'http://10.110.1.1:8191/v1';
    
    const response = await fetch(flareSolverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'request.get',
        url: 'https://fr.onepiece-cardgame.com/cardlist/',
        maxTimeout: 60000
      })
    });

    if (!response.ok) {
      throw new Error(`FlareSolverr error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'ok') {
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_FAILURES_BEFORE_CIRCUIT_OPEN) {
        onepieceCircuitOpen = true;
        onepieceCircuitOpenTime = Date.now();
        log.warn(` Circuit breaker OUVERT après ${consecutiveFailures} échecs`);
      }
      throw new Error('FlareSolverr challenge failed');
    }

    // Parser le HTML retourné
    const html = data.solution.response;
    const cards = parseOnePieceCardlistHtml(html);

    // Succès - reset failures
    consecutiveFailures = 0;
    
    // Mettre en cache
    setCache(cacheKey, cards, ONEPIECE_CACHE_TTL);
    
    log.info(` ${cards.length} cartes récupérées`);
    return cards;

  } catch (error) {
    log.error(` Erreur scraping: ${error.message}`);
    throw error;
  }
}

/**
 * Parse le HTML de la cardlist
 */
function parseOnePieceCardlistHtml(html) {
  // À implémenter avec cheerio ou JSDOM
  // Extraction des données depuis le HTML
  
  const cards = [];
  // TODO: Parser le HTML et extraire:
  // - Card ID (ex: OP01-047)
  // - Nom (français)
  // - Set
  // - Rareté
  // - Type
  // - Couleur
  // - URL image
  
  return cards;
}

/**
 * Scrape les détails d'une carte individuelle
 */
export async function scrapeOnePieceCardDetails(cardId, options = {}) {
  const cacheKey = `onepiece_card_${cardId}`;
  
  const cached = getCached(cacheKey);
  if (cached && !options.bypassCache) {
    return cached;
  }

  // Vérifier VPN
  const vpnCheck = await checkVpnStatus();
  if (!vpnCheck.ok) {
    throw new Error('VPN requis pour One Piece TCG');
  }

  log.info(` Scraping carte ${cardId} via VPN`);

  try {
    const flareSolverUrl = process.env.FSR_URL || 'http://10.110.1.1:8191/v1';
    
    // Construire l'URL de la carte (à adapter selon la structure du site)
    const cardUrl = `https://fr.onepiece-cardgame.com/card/${cardId}.php`;
    
    const response = await fetch(flareSolverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'request.get',
        url: cardUrl,
        maxTimeout: 60000
      })
    });

    if (!response.ok) {
      throw new Error(`FlareSolverr error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'ok') {
      throw new Error('FlareSolverr challenge failed');
    }

    const html = data.solution.response;
    const cardDetails = parseOnePieceCardDetailsHtml(html);

    setCache(cacheKey, cardDetails, ONEPIECE_CACHE_TTL);
    return cardDetails;

  } catch (error) {
    log.error(` Erreur scraping carte ${cardId}: ${error.message}`);
    throw error;
  }
}

function parseOnePieceCardDetailsHtml(html) {
  // Parser les détails complets
  const details = {};
  // TODO: Extraire tous les champs
  return details;
}
```

### Phase 2 : Normalizer

Créer **`normalizeOnePieceCard()`** dans `lib/normalizers/tcg.js` :

```javascript
export function normalizeOnePieceSearch(rawCards, options = {}) {
  return rawCards.map(card => ({
    id: card.cid,
    name: card.name_fr,
    game: 'onepiece',
    set: {
      id: extractSetCode(card.cid),
      name: card.set_name,
      code: extractSetCode(card.cid)
    },
    number: extractCardNumber(card.cid),
    rarity: card.rarity,
    type: card.type,
    images: [{
      url: card.image_url,
      type: 'full'
    }],
    attributes: {
      color: card.color,
      cost: card.cost,
      power: card.power,
      counterPower: card.counter,
      life: card.life,
      traits: card.traits,
      attribute: card.attribute
    },
    description: buildDescription(card),
    detailUrl: `/tcg_onepiece/details?id=${card.cid}`
  }));
}

function extractSetCode(cid) {
  // OP01-047 -> OP-01
  const match = cid.match(/^([A-Z]+\d+)-/);
  return match ? match[1].replace(/(\D+)(\d+)/, '$1-$2') : null;
}

function extractCardNumber(cid) {
  // OP01-047 -> 047
  const match = cid.match(/-(\d+)$/);
  return match ? match[1] : null;
}

function buildDescription(card) {
  let desc = `Cost: ${card.cost || 'N/A'} | Power: ${card.power || 'N/A'}`;
  if (card.counter) desc += ` | Counter: ${card.counter}`;
  if (card.life) desc += ` | Life: ${card.life}`;
  desc += `\nColor: ${card.color || 'N/A'}`;
  if (card.traits) desc += `\nTraits: ${card.traits.join(', ')}`;
  if (card.effect) desc += `\n\n${card.effect}`;
  return desc;
}
```

### Phase 3 : Routes API

Créer **`routes/tcg_onepiece.js`** :

```javascript
import express from 'express';
import { asyncHandler } from '../lib/utils/async-handler.js';
import { 
  scrapeOnePieceCardlist, 
  scrapeOnePieceCardDetails,
  isOnePieceAvailable 
} from '../lib/providers/onepiece.js';
import { 
  normalizeOnePieceSearch, 
  normalizeOnePieceCard 
} from '../lib/normalizers/tcg.js';

const router = express.Router();

// Middleware de disponibilité
router.use((req, res, next) => {
  const availability = isOnePieceAvailable();
  if (!availability.available) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: availability.reason,
      retryAfter: availability.retryAfter
    });
  }
  next();
});

/**
 * GET /tcg_onepiece/search
 * Recherche de cartes One Piece
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { q, type, color, rarity, set, max = 20 } = req.query;

  if (!q) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Le paramètre "q" (nom de carte) est requis'
    });
  }

  // Scraper la cardlist complète
  const allCards = await scrapeOnePieceCardlist();
  
  // Filtrer localement
  let filtered = allCards.filter(card => 
    card.name_fr?.toLowerCase().includes(q.toLowerCase())
  );

  if (type) {
    filtered = filtered.filter(c => c.type?.toLowerCase() === type.toLowerCase());
  }
  if (color) {
    filtered = filtered.filter(c => c.color?.toLowerCase() === color.toLowerCase());
  }
  if (rarity) {
    filtered = filtered.filter(c => c.rarity?.toLowerCase() === rarity.toLowerCase());
  }
  if (set) {
    filtered = filtered.filter(c => c.cid?.startsWith(set.toUpperCase()));
  }

  // Limiter les résultats
  const results = filtered.slice(0, parseInt(max));
  
  // Normaliser
  const normalized = normalizeOnePieceSearch(results, req.query);

  res.json({
    total: filtered.length,
    returned: normalized.length,
    data: normalized
  });
}));

/**
 * GET /tcg_onepiece/card
 * Détails d'une carte par nom ou ID
 */
router.get('/card', asyncHandler(async (req, res) => {
  const { name, id } = req.query;

  if (!name && !id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Paramètre "name" ou "id" requis'
    });
  }

  if (id) {
    // Récupérer par ID
    const cardDetails = await scrapeOnePieceCardDetails(id);
    const normalized = normalizeOnePieceCard(cardDetails, req.query);
    return res.json(normalized);
  }

  // Recherche par nom
  const allCards = await scrapeOnePieceCardlist();
  const card = allCards.find(c => 
    c.name_fr?.toLowerCase() === name.toLowerCase()
  );

  if (!card) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Carte "${name}" introuvable`
    });
  }

  // Récupérer les détails complets
  const cardDetails = await scrapeOnePieceCardDetails(card.cid);
  const normalized = normalizeOnePieceCard(cardDetails, req.query);
  res.json(normalized);
}));

/**
 * GET /tcg_onepiece/details
 * Détails complets d'une carte par ID
 */
router.get('/details', asyncHandler(async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Paramètre "id" requis'
    });
  }

  const cardDetails = await scrapeOnePieceCardDetails(id);
  const normalized = normalizeOnePieceCard(cardDetails, req.query);
  res.json(normalized);
}));

export default router;
```

---

## 🔒 Sécurité et bonnes pratiques

### 1. **Utilisation obligatoire du VPN**

```javascript
// Vérifier le VPN AVANT chaque requête
const vpnCheck = await checkVpnStatus();
if (!vpnCheck.ok) {
  throw new Error('VPN requis pour One Piece TCG');
}
```

### 2. **Circuit breaker**

- Ouvrir après **3 échecs consécutifs**
- Cooldown de **15 minutes**
- Reset automatique après succès

### 3. **Rate limiting respectueux**

```javascript
// Délai entre requêtes
await sleep(2000); // 2 secondes minimum entre chaque carte

// Batch processing avec délais
for (const cardId of cardIds) {
  await scrapeOnePieceCardDetails(cardId);
  await sleep(3000); // 3 secondes entre chaque
}
```

### 4. **Cache agressif**

```javascript
// 30 minutes pour la cardlist (rarement mise à jour)
const ONEPIECE_CACHE_TTL = 1800000;

// 1 heure pour les détails de cartes (données statiques)
const ONEPIECE_CARD_CACHE_TTL = 3600000;
```

### 5. **Headers réalistes**

```javascript
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://fr.onepiece-cardgame.com/',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};
```

---

## 📊 Estimation de développement

| Tâche | Durée | Priorité |
|-------|-------|----------|
| Provider One Piece (scraping) | 4-5h | ⭐⭐⭐⭐⭐ |
| Parser HTML (cheerio) | 3-4h | ⭐⭐⭐⭐⭐ |
| Normalizers | 2h | ⭐⭐⭐⭐ |
| Routes API | 2h | ⭐⭐⭐⭐ |
| Tests + debug | 3-4h | ⭐⭐⭐⭐⭐ |
| **TOTAL** | **14-17h** | |

---

## ⚠️ Risques et mitigation

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Ban IP malgré VPN | Moyenne | Rotation IP automatique toutes les 30 min |
| Cloudflare challenge | Haute | FlareSolverr + cookies persistants |
| Structure HTML change | Moyenne | Parser robuste avec fallbacks |
| Rate limiting | Faible | Circuit breaker + cache 30 min |
| ToS violation | Haute | Usage respectueux, cache agressif |

---

## 🚀 Déploiement

### Variables d'environnement requises

```bash
# Dans .env ou docker-compose
GLUETUN_CONTROL_URL=http://gluetun-toys:8000
FSR_URL=http://10.110.1.1:8191/v1
TOY_API_GLUETUN_CONTROL_PORT=8200
TOY_API_VPN_REGION=France
```

### Ordre de démarrage

1. ✅ `gluetun-toys` (VPN)
2. ✅ `flaresolverr-vpn` (via réseau gluetun)
3. ✅ `vpn-monitor` (surveillance)
4. ✅ `toys_api` (utilise FlareSolverr)

---

## 📝 TODO

- [ ] Créer `lib/providers/onepiece.js`
- [ ] Créer parsers HTML (cheerio)
- [ ] Ajouter normalizers dans `tcg.js`
- [ ] Créer `routes/tcg_onepiece.js`
- [ ] Tester avec VPN actif
- [ ] Documenter les endpoints
- [ ] Ajouter métriques

---

*Stratégie créée le 1er janvier 2026 - Prête pour implémentation*
