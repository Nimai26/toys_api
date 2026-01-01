# 🎴 Stratégie d'implémentation - Carddass via animecollection.fr

> **Date** : 1er janvier 2026  
> **Source de données** : http://www.animecollection.fr/  
> **Statut** : ✅ Implémentation VIABLE et RECOMMANDÉE

---

## 📊 Vue d'ensemble

### Pourquoi animecollection.fr ?

**Base de données complète et fiable** :
- 🎯 **30 178 cartes référencées** (toutes époques Carddass)
- 🌟 **80 licences** (Dragon Ball, Sailor Moon, Ranma, Saint Seiya, Gundam, etc.)
- 📚 **335 collections**
- 📦 **713 séries**
- 🖼️ **6 386 images additionnelles**
- 📸 **1 704 packagings**

**Avantages** :
- ✅ Site français actif depuis 2008
- ✅ Communauté engagée
- ✅ Images haute qualité (h50, h100, h200)
- ✅ Données structurées par licence/collection/série
- ✅ Mises à jour régulières
- ✅ Raretés documentées

---

## 🔍 Analyse de la structure du site

### URLs Pattern

```
Homepage:
http://www.animecollection.fr/

Recherche:
http://www.animecollection.fr/cartes.php

Par licence:
http://www.animecollection.fr/cartes.php?idl={licence_id}
Exemple: idl=56 = Ranma ½

Par série complète:
http://www.animecollection.fr/cartes.php?idl={idl}&idc={collection_id}&ids={serie_id}
Exemple: idl=56&idc=195&ids=425 = Ranma ½ Carddass Part 1

Carte individuelle:
http://www.animecollection.fr/carte.php?id={card_id}
Exemple: id=17673 = Ranma ½ Carddass Part 1 #1
```

### Structure HTML d'une série

```html
<!-- En-tête série -->
Première série de la franchise Ranma ½ sortie en 1991 et comprenant 42 cartes
dont 6 prismes et 36 regulars.

<!-- Liste des cartes -->
1 <img src="http://www.animecollection.fr/cartes/195/425/h100_17673_carte.jpg">
2 <img src="http://www.animecollection.fr/cartes/195/425/h100_17674_carte.jpg">
...
42 <img src="http://www.animecollection.fr/cartes/195/425/h100_17714_carte.jpg">

<!-- Packaging -->
Display <img src="http://www.animecollection.fr/packagings/195/425/h100_859_packaging.jpg">
Dos des cartes <img src="http://www.animecollection.fr/packagings/195/425/h100_845_packaging.jpg">
```

### Pattern d'images

```
Cartes:
http://www.animecollection.fr/cartes/{collection_id}/{serie_id}/h{size}_{card_id}_carte.jpg
Sizes: h50 (thumb), h100 (medium), h200 (large)

Packagings:
http://www.animecollection.fr/packagings/{collection_id}/{serie_id}/h{size}_{pack_id}_packaging.jpg
```

### Données extractibles

Pour chaque série :
- ✅ Nom de la licence (ex: "Ranma ½")
- ✅ Nom de la collection (ex: "Carddass")
- ✅ Nom de la série (ex: "Part 1")
- ✅ Année de sortie (ex: "1991")
- ✅ Nombre total de cartes (ex: "42 cartes")
- ✅ Distribution raretés (ex: "6 prismes et 36 regulars")

Pour chaque carte :
- ✅ Numéro (1-42)
- ✅ ID unique (17673-17714)
- ✅ Images (h50, h100, h200)
- ✅ Rareté (via légende + description série)

---

## 🛠️ Plan d'implémentation

### Phase 1 : Infrastructure de scraping (2-4 heures)

#### 1.1. Provider Carddass
**Fichier** : `lib/providers/tcg/carddass.js`

```javascript
const cheerio = require('cheerio');
const { fetch } = require('../../utils');
const circuitBreaker = require('../../utils/circuit-breaker');

const ANIMECOLLECTION_BASE = 'http://www.animecollection.fr';

class CarddassProvider {
  constructor() {
    this.baseUrl = ANIMECOLLECTION_BASE;
    this.cache = new Map();
    this.circuitBreaker = circuitBreaker.create('carddass', {
      failureThreshold: 3,
      cooldownPeriod: 15 * 60 * 1000 // 15 min
    });
  }

  /**
   * Récupère toutes les licences Carddass
   * Parse: http://www.animecollection.fr/cartes.php
   */
  async getAllLicenses() {
    const url = `${this.baseUrl}/cartes.php`;
    const html = await this._fetchWithCircuitBreaker(url);
    const $ = cheerio.load(html);
    
    // Parser les liens de licences
    const licenses = [];
    $('a[href*="idl="]').each((i, el) => {
      const href = $(el).attr('href');
      const match = href.match(/idl=(\d+)/);
      if (match) {
        licenses.push({
          id: match[1],
          name: $(el).text().trim()
        });
      }
    });
    
    return licenses;
  }

  /**
   * Récupère toutes les collections d'une licence
   * Parse: http://www.animecollection.fr/cartes.php?idl=56
   */
  async getCollectionsByLicense(licenseId) {
    const url = `${this.baseUrl}/cartes.php?idl=${licenseId}`;
    const html = await this._fetchWithCircuitBreaker(url);
    const $ = cheerio.load(html);
    
    // Parser les collections
    const collections = [];
    $('a[href*="idc="]').each((i, el) => {
      const href = $(el).attr('href');
      const match = href.match(/idc=(\d+)/);
      if (match) {
        collections.push({
          id: match[1],
          licenseId,
          name: $(el).text().trim()
        });
      }
    });
    
    return collections;
  }

  /**
   * Récupère toutes les séries d'une collection
   */
  async getSeriesByCollection(licenseId, collectionId) {
    const url = `${this.baseUrl}/cartes.php?idl=${licenseId}&idc=${collectionId}`;
    const html = await this._fetchWithCircuitBreaker(url);
    const $ = cheerio.load(html);
    
    const series = [];
    $('a[href*="ids="]').each((i, el) => {
      const href = $(el).attr('href');
      const match = href.match(/ids=(\d+)/);
      if (match) {
        series.push({
          id: match[1],
          collectionId,
          licenseId,
          name: $(el).text().trim()
        });
      }
    });
    
    return series;
  }

  /**
   * Récupère toutes les cartes d'une série
   * Parse: http://www.animecollection.fr/cartes.php?idl=56&idc=195&ids=425
   */
  async getCardsBySerie(licenseId, collectionId, serieId) {
    const cacheKey = `serie_${licenseId}_${collectionId}_${serieId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const url = `${this.baseUrl}/cartes.php?idl=${licenseId}&idc=${collectionId}&ids=${serieId}`;
    const html = await this._fetchWithCircuitBreaker(url);
    const $ = cheerio.load(html);
    
    // Parser métadonnées série
    const serieInfo = this._parseSerieInfo($);
    
    // Parser cartes
    const cards = [];
    $('img[src*="_carte.jpg"]').each((i, el) => {
      const imgSrc = $(el).attr('src');
      const match = imgSrc.match(/h\d+_(\d+)_carte\.jpg/);
      
      if (match) {
        const cardId = match[1];
        const cardNumber = $(el).prev().text().trim() || (i + 1).toString();
        
        cards.push({
          id: cardId,
          number: cardNumber,
          license: serieInfo.license,
          collection: serieInfo.collection,
          serie: serieInfo.serie,
          year: serieInfo.year,
          rarity: this._determineRarity(cardNumber, serieInfo),
          images: {
            thumb: imgSrc.replace(/h\d+_/, 'h50_'),
            medium: imgSrc.replace(/h\d+_/, 'h100_'),
            large: imgSrc.replace(/h\d+_/, 'h200_')
          },
          source: 'animecollection.fr',
          detailUrl: `${this.baseUrl}/carte.php?id=${cardId}`
        });
      }
    });
    
    const result = { ...serieInfo, cards };
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Parse les infos d'une série depuis la description
   * Ex: "Première série de la franchise Ranma ½ sortie en 1991 et comprenant 42 cartes dont 6 prismes et 36 regulars"
   */
  _parseSerieInfo($) {
    const breadcrumb = $('a[href*="cartes.php"]').map((i, el) => $(el).text().trim()).get();
    const description = $('.titre_vert_cartes').next('p').text();
    
    const yearMatch = description.match(/sortie en (\d{4})/);
    const totalMatch = description.match(/(\d+) cartes/);
    const prismMatch = description.match(/(\d+) prismes?/);
    const regularMatch = description.match(/(\d+) regulars?/);
    
    return {
      license: breadcrumb[1] || '',
      collection: breadcrumb[2] || '',
      serie: breadcrumb[3] || '',
      year: yearMatch ? parseInt(yearMatch[1]) : null,
      totalCards: totalMatch ? parseInt(totalMatch[1]) : 0,
      prismCards: prismMatch ? parseInt(prismMatch[1]) : 0,
      regularCards: regularMatch ? parseInt(regularMatch[1]) : 0,
      description
    };
  }

  /**
   * Détermine la rareté d'une carte
   */
  _determineRarity(cardNumber, serieInfo) {
    const num = parseInt(cardNumber);
    const prismCount = serieInfo.prismCards || 0;
    
    // Généralement les prismes sont en fin de série
    if (num > (serieInfo.totalCards - prismCount)) {
      return 'Prism';
    }
    return 'Regular';
  }

  /**
   * Fetch avec circuit breaker + VPN check
   */
  async _fetchWithCircuitBreaker(url) {
    return this.circuitBreaker.execute(async () => {
      // VPN check optionnel (si Gluetun actif)
      if (process.env.USE_VPN === 'true') {
        await this._checkVpn();
      }
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ToysAPI/4.0.0 (Carddass Collector)',
          'Accept': 'text/html',
          'Accept-Language': 'fr-FR,fr;q=0.9'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
      }
      
      return response.text();
    });
  }

  async _checkVpn() {
    // Vérifier Gluetun si nécessaire
    try {
      const response = await fetch('http://gluetun-toys:8000/v1/publicip/ip');
      const data = await response.json();
      return data.public_ip;
    } catch (error) {
      console.warn('VPN check failed, continuing without VPN');
      return null;
    }
  }

  isAvailable() {
    return this.circuitBreaker.getState() !== 'open';
  }

  getStats() {
    return {
      state: this.circuitBreaker.getState(),
      cacheSize: this.cache.size
    };
  }
}

module.exports = new CarddassProvider();
```

#### 1.2. Normalizer Carddass
**Fichier** : `lib/normalizers/tcg.js` (ajouter)

```javascript
/**
 * Normalise les cartes Carddass depuis animecollection.fr
 */
function normalizeCarddassSearch(rawCards, options = {}) {
  return rawCards.map(card => ({
    id: `carddass-${card.id}`,
    source: 'carddass',
    name: `${card.license} ${card.collection} ${card.serie} #${card.number}`,
    thumbnail: card.images.thumb,
    set: `${card.collection} ${card.serie}`,
    card_number: card.number,
    rarity: card.rarity,
    type: 'Character', // Généralement des cartes personnages
    year: card.year,
    detailUrl: card.detailUrl,
    description: `${card.license} - ${card.collection} (${card.year})`
  }));
}

function normalizeCarddassCard(rawCard, options = {}) {
  return {
    id: `carddass-${rawCard.id}`,
    source: 'carddass',
    name: `${rawCard.license} ${rawCard.collection} ${rawCard.serie} #${rawCard.number}`,
    thumbnail: rawCard.images.medium,
    set: {
      name: `${rawCard.collection} ${rawCard.serie}`,
      code: `${rawCard.serie}`,
      year: rawCard.year
    },
    card_number: rawCard.number,
    rarity: rawCard.rarity,
    type: 'Character',
    images: [
      { url: rawCard.images.thumb, type: 'thumbnail' },
      { url: rawCard.images.medium, type: 'normal' },
      { url: rawCard.images.large, type: 'large' }
    ],
    attributes: {
      license: rawCard.license,
      collection: rawCard.collection,
      serie: rawCard.serie,
      year: rawCard.year,
      rarity: rawCard.rarity
    },
    detailUrl: rawCard.detailUrl,
    description: rawCard.description || `Carddass ${rawCard.license}`
  };
}

module.exports = {
  // ... existing normalizers
  normalizeCarddassSearch,
  normalizeCarddassCard
};
```

---

### Phase 2 : Routes API (1-2 heures)

**Fichier** : `routes/tcg_carddass.js`

```javascript
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../lib/utils');
const carddass = require('../lib/providers/tcg/carddass');
const { normalizeCarddassSearch, normalizeCarddassCard } = require('../lib/normalizers/tcg');
const { metrics } = require('../lib/utils/state');

// Middleware circuit breaker
router.use((req, res, next) => {
  if (!carddass.isAvailable()) {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'Carddass provider circuit breaker is open',
      retryAfter: 900 // 15 minutes
    });
  }
  next();
});

/**
 * GET /tcg_carddass/licenses
 * Liste toutes les licences Carddass disponibles
 */
router.get('/licenses', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  metrics.sources.carddass.requests++;

  try {
    const licenses = await carddass.getAllLicenses();
    
    metrics.sources.carddass.latency = Date.now() - startTime;
    
    res.json({
      total: licenses.length,
      licenses
    });
  } catch (error) {
    metrics.sources.carddass.errors++;
    throw error;
  }
}));

/**
 * GET /tcg_carddass/search?license=Ranma&collection=Carddass&serie=Part%201
 * Recherche de cartes par licence/collection/série
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { license, collection, serie, licenseId, collectionId, serieId } = req.query;
  const startTime = Date.now();
  metrics.sources.carddass.requests++;

  try {
    let result;
    
    if (serieId && collectionId && licenseId) {
      // Recherche directe par IDs
      result = await carddass.getCardsBySerie(licenseId, collectionId, serieId);
    } else {
      // Recherche par noms (nécessite plusieurs requêtes)
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Use licenseId, collectionId, serieId for direct search'
      });
    }
    
    const normalized = normalizeCarddassSearch(result.cards, { lang: req.query.lang });
    
    metrics.sources.carddass.latency = Date.now() - startTime;
    
    res.json({
      total: normalized.length,
      serie: {
        license: result.license,
        collection: result.collection,
        serie: result.serie,
        year: result.year,
        totalCards: result.totalCards
      },
      results: normalized
    });
  } catch (error) {
    metrics.sources.carddass.errors++;
    throw error;
  }
}));

/**
 * GET /tcg_carddass/card?id=17673
 * Détails d'une carte par ID
 */
router.get('/card', asyncHandler(async (req, res) => {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({
      error: 'Missing required parameter: id'
    });
  }

  // Pour l'instant, nécessite de connaître la série
  // TODO: Implémenter recherche inverse par ID
  res.status(501).json({
    error: 'Not implemented',
    message: 'Use /search with serie parameters to get card details'
  });
}));

/**
 * GET /tcg_carddass/health
 * Status du provider Carddass
 */
router.get('/health', (req, res) => {
  const stats = carddass.getStats();
  res.json({
    status: stats.state === 'closed' ? 'ok' : 'degraded',
    circuit_breaker: stats.state,
    cache_size: stats.cacheSize,
    metrics: metrics.sources.carddass
  });
});

module.exports = router;
```

---

### Phase 3 : Tests et documentation (1-2 heures)

#### Tests à effectuer

```bash
# 1. Toutes les licences
curl "http://10.110.1.1:3000/tcg_carddass/licenses"

# 2. Recherche série Ranma ½
curl "http://10.110.1.1:3000/tcg_carddass/search?licenseId=56&collectionId=195&serieId=425"

# 3. Health check
curl "http://10.110.1.1:3000/tcg_carddass/health"
```

---

## 📊 Estimation des coûts

### Temps de développement
- **Phase 1 (Infrastructure)** : 2-4 heures
- **Phase 2 (Routes API)** : 1-2 heures
- **Phase 3 (Tests)** : 1-2 heures
- **TOTAL** : **4-8 heures** (vs 50-100h pour DB manuelle)

### Performance
- **Cache agressif recommandé** : 24h (données vintage = peu de mises à jour)
- **Rate limiting** : Respecter le site (1 req/sec max)
- **Circuit breaker** : Protéger animecollection.fr

---

## ⚠️ Considérations éthiques

### Respect du site source
1. **User-Agent identifiable** : "ToysAPI/4.0.0 (Carddass Collector)"
2. **Rate limiting strict** : 1 requête par seconde maximum
3. **Cache long** : 24h minimum pour réduire la charge
4. **Attribution** : Mentionner animecollection.fr dans les réponses

### Alternative recommandée
**Contacter le webmaster** pour :
- Demander autorisation formelle
- Proposer partenariat
- Obtenir export JSON direct (idéal)
- Contribuer au site si possible

---

## 🎯 Prochaines étapes

### Implémentation immédiate
1. ✅ Créer provider carddass.js
2. ✅ Ajouter normalizers
3. ✅ Créer routes tcg_carddass.js
4. ✅ Tests sur séries Ranma ½, Dragon Ball, Sailor Moon
5. ✅ Documentation README

### Améliorations futures
- [ ] Cache Redis pour partage entre instances
- [ ] Export JSON statique type lorcanajson.org
- [ ] Scraping parallèle des séries
- [ ] Support recherche par nom de carte
- [ ] Images en local (miroir) pour performances

---

## 📚 Ressources

- **Site source** : http://www.animecollection.fr/
- **Facebook** : https://www.facebook.com/Carddass/
- **Sites partenaires** :
  - http://www.dbzcollection.fr/ (Dragon Ball spécialisé)
  - http://www.onepiececollection.fr/ (One Piece)

---

*Document créé le 1er janvier 2026 - Implémentation recommandée après contact webmaster*
