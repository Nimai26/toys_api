# 🎴 Guide d'implémentation TCG - Toys API

> **Date de création** : 1er janvier 2026  
> **Objectif** : Normaliser l'implémentation de toutes les sources TCG dans toys_api

---

## 📋 Table des matières

1. [Structure de normalisation unifiée](#-structure-de-normalisation-unifiée)
2. [Paramètres standardisés](#-paramètres-standardisés)
3. [Gestion des langues](#-gestion-des-langues)
4. [Architecture des fichiers](#-architecture-des-fichiers)
5. [Checklist d'implémentation](#-checklist-dimplémentation)
6. [Exemples de code](#-exemples-de-code)

---

## 🎯 Structure de normalisation unifiée

### Format de réponse standardisé

Toutes les cartes TCG doivent suivre ce format de normalisation (basé sur le modèle Panini) :

```javascript
{
  "success": true,
  "provider": "pokemon-tcg|mtg|yugioh|lorcana|digimon",
  "id": "unique-card-id",
  "data": {
    // === Identifiants ===
    "id": string,              // ID unique dans la source
    "source": string,          // Nom de la source (pokemon-tcg, mtg, etc.)
    "name": string,            // Nom de la carte (traduit selon lang)
    "name_original": string,   // Nom original (EN) si différent
    
    // === Description ===
    "description": string,     // Description/effet de la carte (traduit si autoTrad)
    "flavor_text": string,     // Texte d'ambiance (optionnel)
    "url": string,             // URL vers la source
    
    // === Images ===
    "images": [
      {
        "url": string,         // URL full-size
        "thumbnail": string,   // URL miniature
        "caption": string,     // Type d'image (normal, holo, promo, etc.)
        "is_main": boolean     // true pour l'image principale
      }
    ],
    
    // === Métadonnées produit ===
    "barcode": string|null,    // Code-barres (rare pour les TCG)
    "release_date": string,    // Format YYYY-MM ou YYYY-MM-DD
    "year": number,            // Année de sortie
    
    // === Set/Série ===
    "set": {
      "id": string,            // ID du set
      "name": string,          // Nom du set (traduit)
      "code": string,          // Code court du set
      "series": string,        // Série parente (optionnel)
      "total_cards": number,   // Nombre total de cartes dans le set
      "release_date": string,  // Date de sortie du set
      "logo": string           // URL du logo du set (optionnel)
    },
    
    // === Identification carte ===
    "card_number": string,     // Numéro dans le set (ex: "4/102", "BT1-010")
    "rarity": string,          // Rareté (traduite selon lang)
    "rarity_original": string, // Rareté originale (EN)
    
    // === Type de carte ===
    "type": string,            // Type principal (Pokémon, Creature, Monster, etc.)
    "subtypes": [string],      // Sous-types (Stage 2, Spell, Effect, etc.)
    
    // === Attributs spécifiques au jeu ===
    "attributes": {
      // Pokémon TCG
      "hp": string,
      "types": [string],       // Types élémentaires
      "evolves_from": string,
      "evolves_to": [string],
      "attacks": [...],
      "abilities": [...],
      "weaknesses": [...],
      "resistances": [...],
      "retreat_cost": number,
      
      // MTG
      "mana_cost": string,
      "cmc": number,
      "colors": [string],
      "color_identity": [string],
      "type_line": string,
      "power": string,
      "toughness": string,
      "loyalty": string,
      "oracle_text": string,
      
      // Yu-Gi-Oh!
      "atk": number,
      "def": number,
      "level": number,
      "rank": number,
      "link_value": number,
      "link_markers": [string],
      "scale": number,
      "race": string,          // Spellcaster, Warrior, etc.
      "archetype": string,
      
      // Lorcana
      "cost": number,
      "inkwell": boolean,
      "strength": number,
      "willpower": number,
      "lore": number,
      "story": string,
      
      // Digimon
      "play_cost": number,
      "dp": number,
      "digivolve_cost": number,
      "level": number,
      "form": string,
      "attribute": string,
      "card_type": string
    },
    
    // === Prix ===
    "prices": {
      "usd": {
        "low": number,
        "mid": number,
        "high": number,
        "market": number
      },
      "eur": {
        "low": number,
        "mid": number,
        "high": number,
        "market": number
      },
      "source": string,        // tcgplayer, cardmarket, etc.
      "updated_at": string     // ISO 8601
    },
    
    // === Légalité (formats de jeu) ===
    "legal_formats": {
      "standard": boolean,
      "expanded": boolean,
      "unlimited": boolean,
      "modern": boolean,
      "legacy": boolean,
      "vintage": boolean,
      "commander": boolean,
      // etc. selon le jeu
    },
    
    // === Artiste ===
    "artist": string,
    "artists": [string],       // Si multiples
    
    // === Variantes ===
    "variants": [
      {
        "id": string,
        "name": string,
        "type": string         // holo, reverse_holo, first_edition, etc.
      }
    ],
    
    // === Liens externes ===
    "external_links": {
      "tcgplayer": string,
      "cardmarket": string,
      "official": string
    }
  },
  
  "meta": {
    "fetchedAt": string,       // ISO 8601
    "lang": string,            // Code langue (fr, en, de, etc.)
    "locale": string,          // Locale complète (fr-FR, en-US)
    "autoTrad": boolean        // Si traduction auto activée
  }
}
```

### Format de réponse recherche

```javascript
{
  "success": true,
  "provider": "pokemon-tcg",
  "query": "pikachu",
  "data": {
    "total": number,           // Nombre total de résultats
    "count": number,           // Nombre de résultats retournés
    "page": number,            // Page actuelle (si pagination)
    "totalPages": number,      // Nombre total de pages
    "results": [
      {
        "id": string,
        "source": string,
        "name": string,
        "thumbnail": string,
        "set": {
          "id": string,
          "name": string,
          "code": string
        },
        "card_number": string,
        "rarity": string,
        "type": string,
        "year": number,
        "detailUrl": string    // URL vers /tcg/{provider}/card?id=xxx
      }
    ]
  },
  "meta": {
    "fetchedAt": string,
    "lang": string,
    "locale": string,
    "autoTrad": boolean
  }
}
```

---

## ⚙️ Paramètres standardisés

### Paramètres de requête communs

Tous les endpoints TCG doivent supporter ces paramètres :

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `lang` | string | `fr` | Code langue ISO 639-1 (fr, en, de, it, pt, ja) |
| `locale` | string | `fr-FR` | Locale complète (fallback : `{lang}-{lang.toUpperCase()}`) |
| `max` | number | `20` | Nombre maximum de résultats à retourner |
| `page` | number | `1` | Page de résultats (si pagination supportée) |
| `autoTrad` | boolean | `false` | Activer la traduction automatique via auto_trad |

### Paramètres spécifiques par endpoint

#### `/tcg/{provider}/search`
```
q             - Requête de recherche (nom de carte)
set           - Filtrer par set/série
type          - Filtrer par type de carte
rarity        - Filtrer par rareté
year          - Filtrer par année
sort          - Tri (name, number, rarity, price)
order         - Ordre (asc, desc)
```

#### `/tcg/{provider}/card`
```
id            - ID unique de la carte (requis)
```

#### `/tcg/{provider}/sets`
```
series        - Filtrer par série parente
year          - Filtrer par année
```

---

## 🌍 Gestion des langues

### Priorité de langue (fallback)

```javascript
// Ordre de priorité pour récupérer le nom/description
const languageFallback = [
  req.query.lang || 'fr',   // 1. Langue demandée
  'en',                      // 2. Anglais (défaut universel)
  'ja',                      // 3. Japonais (si source asiatique)
  'original'                 // 4. Langue originale de la carte
];
```

### Traduction automatique (autoTrad)

Lorsque `autoTrad=true` :

1. **Champs à traduire** :
   - `description` (effet de la carte)
   - `flavor_text` (texte d'ambiance)
   - `rarity` (si pas de traduction native)
   - `type` / `subtypes` (si pas de traduction native)
   - `attributes.*` contenant du texte

2. **Champs à NE PAS traduire** :
   - `name` (utiliser la version native si disponible)
   - Noms propres (artistes, personnages)
   - Valeurs numériques
   - URLs

3. **Appel au service auto_trad** :
```javascript
const { translateText } = require('../utils/auto_trad');

if (autoTrad && description) {
  const translated = await translateText(description, {
    from: 'en',
    to: lang,
    cache: true  // Utiliser le cache de traduction
  });
  card.description = translated;
}
```

### Codes de langue supportés

| Code | Langue | Disponibilité |
|------|--------|---------------|
| `fr` | Français | Toutes sources |
| `en` | Anglais | Toutes sources |
| `de` | Allemand | MTG, Lorcana, Yu-Gi-Oh! |
| `it` | Italien | MTG, Lorcana, Yu-Gi-Oh! |
| `pt` | Portugais | Yu-Gi-Oh! |
| `ja` | Japonais | Sources Bandai, Pokémon |
| `es` | Espagnol | MTG, Yu-Gi-Oh! |

---

## 📁 Architecture des fichiers

### Structure des dossiers

```
toys_api/
├── lib/
│   ├── providers/
│   │   ├── tcg/
│   │   │   ├── pokemon.js       # Provider Pokémon TCG
│   │   │   ├── mtg.js           # Provider Magic
│   │   │   ├── yugioh.js        # Provider Yu-Gi-Oh!
│   │   │   ├── lorcana.js       # Provider Lorcana
│   │   │   ├── digimon.js       # Provider Digimon
│   │   │   └── index.js         # Exports centralisés
│   │   └── index.js
│   ├── normalizers/
│   │   ├── tcg.js               # Normalizers TCG
│   │   └── index.js
│   └── utils/
│       ├── auto_trad.js         # Service de traduction
│       └── index.js
└── routes/
    ├── tcg.js                   # Routes TCG groupées
    └── index.js
```

### Convention de nommage

#### Fichiers providers
```javascript
// lib/providers/tcg/pokemon.js

/**
 * Recherche de cartes Pokémon TCG
 * @param {string} query - Requête de recherche
 * @param {object} options - Options (lang, max, filters)
 * @returns {Promise<object>} - Résultats bruts
 */
export async function searchPokemonCards(query, options = {}) {
  // ...
}

/**
 * Détails d'une carte Pokémon TCG
 * @param {string} cardId - ID de la carte
 * @param {object} options - Options (lang)
 * @returns {Promise<object>} - Données brutes de la carte
 */
export async function getPokemonCardDetails(cardId, options = {}) {
  // ...
}

/**
 * Liste des sets Pokémon TCG
 * @param {object} options - Options (lang, filters)
 * @returns {Promise<object>} - Liste des sets
 */
export async function getPokemonSets(options = {}) {
  // ...
}
```

#### Fichiers normalizers
```javascript
// lib/normalizers/tcg.js

/**
 * Normalise les résultats de recherche Pokémon TCG
 * @param {object} rawData - Données brutes de l'API
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Résultats normalisés
 */
export async function normalizePokemonSearch(rawData, options = {}) {
  // ...
}

/**
 * Normalise une carte Pokémon TCG
 * @param {object} rawCard - Données brutes de la carte
 * @param {object} options - Options (lang, autoTrad)
 * @returns {Promise<object>} - Carte normalisée
 */
export async function normalizePokemonCard(rawCard, options = {}) {
  // ...
}
```

#### Routes
```javascript
// routes/tcg.js

// Endpoints par provider
GET /tcg/pokemon/search
GET /tcg/pokemon/card
GET /tcg/pokemon/sets

GET /tcg/mtg/search
GET /tcg/mtg/card
GET /tcg/mtg/sets

GET /tcg/yugioh/search
GET /tcg/yugioh/card
GET /tcg/yugioh/sets

// etc.
```

---

## ✅ Checklist d'implémentation

Pour chaque nouvelle source TCG, suivre cette checklist :

### Phase 1 : Provider (lib/providers/tcg/{source}.js)
- [ ] Créer le fichier provider
- [ ] Implémenter `search{Source}Cards(query, options)`
  - [ ] Support paramètre `lang`
  - [ ] Support paramètre `max`/`pageSize`
  - [ ] Support filtres (set, type, rarity)
  - [ ] Cache avec `getCached()`/`setCache()`
  - [ ] Métriques avec `metrics.sources.{source}.requests++`
  - [ ] Headers HTTP appropriés
  - [ ] Gestion erreurs try/catch
- [ ] Implémenter `get{Source}CardDetails(id, options)`
  - [ ] Support paramètre `lang`
  - [ ] Cache
  - [ ] Métriques
- [ ] Implémenter `get{Source}Sets(options)` (optionnel)
- [ ] Ajouter exports dans `lib/providers/tcg/index.js`
- [ ] Ajouter exports dans `lib/providers/index.js`

### Phase 2 : Normalizer (lib/normalizers/tcg.js)
- [ ] Créer les fonctions de normalisation
- [ ] `normalize{Source}Search(rawData, options)`
  - [ ] Mapper vers format standardisé
  - [ ] Support `lang` avec fallback
  - [ ] Générer `detailUrl`
- [ ] `normalize{Source}Card(rawCard, options)`
  - [ ] Mapper tous les champs obligatoires
  - [ ] Mapper attributs spécifiques au jeu
  - [ ] Support `autoTrad` pour descriptions
  - [ ] Images avec `is_main`
  - [ ] Prix si disponibles
  - [ ] Legal formats si disponibles
- [ ] Ajouter exports dans `lib/normalizers/index.js`

### Phase 3 : Routes (routes/tcg.js)
- [ ] Créer le router Express pour la source
- [ ] `/tcg/{source}/search`
  - [ ] Middleware `requireParam('q')`
  - [ ] Middleware `asyncHandler`
  - [ ] Extraction des paramètres standardisés
  - [ ] Cache provider
  - [ ] Headers cache `addCacheHeaders(res, 300)`
  - [ ] Format de réponse standardisé
- [ ] `/tcg/{source}/card`
  - [ ] Middleware `requireParam('id')`
  - [ ] Support `autoTrad`
  - [ ] Cache provider
  - [ ] Headers cache
- [ ] `/tcg/{source}/sets` (optionnel)
- [ ] Ajouter métriques dans `state.js`
- [ ] Monter le router dans `index.js`

### Phase 4 : Tests
- [ ] Build container de test
- [ ] Tester `/search` avec différents paramètres
  - [ ] `?q=test`
  - [ ] `?q=test&lang=fr`
  - [ ] `?q=test&lang=en`
  - [ ] `?q=test&max=5`
  - [ ] `?q=test&autoTrad=true`
- [ ] Tester `/card` avec ID valide
  - [ ] Sans `autoTrad`
  - [ ] Avec `autoTrad=true`
  - [ ] Différentes langues
- [ ] Vérifier structure de réponse conforme
- [ ] Vérifier images accessibles
- [ ] Vérifier cache fonctionne
- [ ] Vérifier métriques incrémentées

### Phase 5 : Documentation
- [ ] Mettre à jour README.md
  - [ ] Section endpoints TCG
  - [ ] Exemples de requêtes
  - [ ] Exemples de réponses
  - [ ] Tableau des paramètres
- [ ] Mettre à jour `/version` endpoint
  - [ ] Ajouter dans `features`
  - [ ] Ajouter dans `endpoints`
- [ ] Documenter dans TCG_APIS_RESEARCH.md
  - [ ] Marquer comme ✅ implémenté
  - [ ] Ajouter notes d'implémentation

### Phase 6 : Déploiement
- [ ] `./deploy.sh`
- [ ] Tester en production
- [ ] Nettoyer images locales
- [ ] Commit Git avec message descriptif

---

## 💻 Exemples de code

### Provider Pokemon TCG

```javascript
// lib/providers/tcg/pokemon.js
import { getCached, setCache } from '../../utils/state.js';
import { logger } from '../../utils/logger.js';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';

/**
 * Recherche de cartes Pokémon TCG
 */
export async function searchPokemonCards(query, options = {}) {
  const {
    lang = 'en',
    max = 20,
    page = 1,
    set = null,
    type = null,
    rarity = null
  } = options;

  // Cache key
  const cacheKey = `pokemon:search:${query}:${lang}:${max}:${page}:${set}:${type}:${rarity}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Build query
  let searchQuery = `name:"${query}"`;
  if (set) searchQuery += ` set.id:${set}`;
  if (type) searchQuery += ` types:${type}`;
  if (rarity) searchQuery += ` rarity:"${rarity}"`;

  const url = `${POKEMON_TCG_API}/cards?q=${encodeURIComponent(searchQuery)}&page=${page}&pageSize=${max}`;

  // Headers (optionnel : ajouter X-Api-Key si disponible)
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'ToysAPI/1.0'
  };

  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Pokemon TCG API error: ${response.status}`);
    }

    const data = await response.json();
    
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    logger.error(`[Pokemon TCG] Search error: ${error.message}`);
    throw error;
  }
}

/**
 * Détails d'une carte Pokémon TCG
 */
export async function getPokemonCardDetails(cardId, options = {}) {
  const cacheKey = `pokemon:card:${cardId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `${POKEMON_TCG_API}/cards/${cardId}`;
  
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'ToysAPI/1.0'
  };

  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Pokemon TCG API error: ${response.status}`);
    }

    const data = await response.json();
    
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    logger.error(`[Pokemon TCG] Card details error: ${error.message}`);
    throw error;
  }
}
```

### Normalizer Pokemon TCG

```javascript
// lib/normalizers/tcg.js
import { translateText } from '../utils/auto_trad.js';

/**
 * Normalise les résultats de recherche Pokémon TCG
 */
export async function normalizePokemonSearch(rawData, options = {}) {
  const { lang = 'fr' } = options;

  if (!rawData || !rawData.data) {
    return {
      total: 0,
      count: 0,
      results: []
    };
  }

  const results = rawData.data.map(card => ({
    id: card.id,
    source: 'pokemon-tcg',
    name: card.name,
    thumbnail: card.images?.small || null,
    set: {
      id: card.set?.id || null,
      name: card.set?.name || null,
      code: card.set?.series || null
    },
    card_number: card.number ? `${card.number}/${card.set?.printedTotal || card.set?.total}` : null,
    rarity: card.rarity || null,
    type: card.supertype || null,
    year: card.set?.releaseDate ? parseInt(card.set.releaseDate.split('-')[0]) : null,
    detailUrl: `/tcg/pokemon/card?id=${card.id}&lang=${lang}`
  }));

  return {
    total: rawData.totalCount || results.length,
    count: results.length,
    page: rawData.page || 1,
    totalPages: rawData.totalPages || 1,
    results
  };
}

/**
 * Normalise une carte Pokémon TCG
 */
export async function normalizePokemonCard(rawCard, options = {}) {
  const { lang = 'fr', autoTrad = false } = options;

  if (!rawCard || !rawCard.data) return null;

  const card = rawCard.data;

  // Images
  const images = [];
  if (card.images?.large) {
    images.push({
      url: card.images.large,
      thumbnail: card.images.small || card.images.large,
      caption: 'normal',
      is_main: true
    });
  }

  // Description (concatener attaques et capacités)
  let description = '';
  if (card.abilities && card.abilities.length > 0) {
    description += card.abilities.map(a => `**${a.name}**: ${a.text}`).join('\n\n');
  }
  if (card.attacks && card.attacks.length > 0) {
    if (description) description += '\n\n';
    description += card.attacks.map(a => `**${a.name}** (${a.cost?.join('')}): ${a.text}`).join('\n\n');
  }

  // Traduction auto si demandée
  if (autoTrad && description && lang !== 'en') {
    try {
      description = await translateText(description, { from: 'en', to: lang });
    } catch (error) {
      // Garder la version originale en cas d'erreur
    }
  }

  // Normalisation
  return {
    id: card.id,
    source: 'pokemon-tcg',
    name: card.name,
    name_original: card.name, // Pokemon TCG est en anglais par défaut
    description,
    flavor_text: card.flavorText || null,
    url: `https://pokemontcg.io/card/${card.id}`,
    
    images,
    
    barcode: null, // TCG n'ont généralement pas de code-barres
    release_date: card.set?.releaseDate || null,
    year: card.set?.releaseDate ? parseInt(card.set.releaseDate.split('-')[0]) : null,
    
    set: {
      id: card.set?.id || null,
      name: card.set?.name || null,
      code: card.set?.series || null,
      series: card.set?.series || null,
      total_cards: card.set?.total || null,
      release_date: card.set?.releaseDate || null,
      logo: card.set?.images?.logo || null
    },
    
    card_number: card.number ? `${card.number}/${card.set?.printedTotal || card.set?.total}` : null,
    rarity: card.rarity || null,
    rarity_original: card.rarity || null,
    
    type: card.supertype || null,
    subtypes: card.subtypes || [],
    
    attributes: {
      hp: card.hp || null,
      types: card.types || [],
      evolves_from: card.evolvesFrom || null,
      evolves_to: card.evolvesTo || [],
      attacks: card.attacks || [],
      abilities: card.abilities || [],
      weaknesses: card.weaknesses || [],
      resistances: card.resistances || [],
      retreat_cost: card.retreatCost?.length || 0
    },
    
    prices: card.tcgplayer?.prices ? {
      usd: {
        low: card.tcgplayer.prices.holofoil?.low || card.tcgplayer.prices.normal?.low || null,
        mid: card.tcgplayer.prices.holofoil?.mid || card.tcgplayer.prices.normal?.mid || null,
        high: card.tcgplayer.prices.holofoil?.high || card.tcgplayer.prices.normal?.high || null,
        market: card.tcgplayer.prices.holofoil?.market || card.tcgplayer.prices.normal?.market || null
      },
      source: 'tcgplayer',
      updated_at: card.tcgplayer.updatedAt || null
    } : null,
    
    legal_formats: card.legalities || {},
    
    artist: card.artist || null,
    
    external_links: {
      tcgplayer: card.tcgplayer?.url || null,
      cardmarket: card.cardmarket?.url || null,
      official: `https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/${card.id}/`
    }
  };
}
```

### Route Pokemon TCG

```javascript
// routes/tcg.js
import express from 'express';
import { asyncHandler, requireParam, addCacheHeaders } from '../lib/utils/index.js';
import { 
  searchPokemonCards, 
  getPokemonCardDetails 
} from '../lib/providers/tcg/pokemon.js';
import { 
  normalizePokemonSearch, 
  normalizePokemonCard 
} from '../lib/normalizers/tcg.js';
import { metrics } from '../lib/utils/state.js';

const router = express.Router();

// Pokemon TCG
router.get("/pokemon/search", requireParam('q'), asyncHandler(async (req, res) => {
  const { 
    q, 
    lang = 'fr', 
    locale = 'fr-FR',
    max = 20, 
    page = 1,
    set,
    type,
    rarity,
    autoTrad = false
  } = req.query;

  metrics.sources.pokemon_tcg.requests++;

  const rawData = await searchPokemonCards(q, {
    lang,
    max: parseInt(max),
    page: parseInt(page),
    set,
    type,
    rarity
  });

  const normalized = await normalizePokemonSearch(rawData, { lang, autoTrad: autoTrad === 'true' });

  addCacheHeaders(res, 300);
  res.json({
    success: true,
    provider: 'pokemon-tcg',
    query: q,
    data: normalized,
    meta: {
      fetchedAt: new Date().toISOString(),
      lang,
      locale,
      autoTrad: autoTrad === 'true'
    }
  });
}));

router.get("/pokemon/card", requireParam('id'), asyncHandler(async (req, res) => {
  const { 
    id, 
    lang = 'fr',
    locale = 'fr-FR',
    autoTrad = false 
  } = req.query;

  metrics.sources.pokemon_tcg.requests++;

  const rawCard = await getPokemonCardDetails(id);
  const normalized = await normalizePokemonCard(rawCard, { 
    lang, 
    autoTrad: autoTrad === 'true' 
  });

  addCacheHeaders(res, 300);
  res.json({
    success: true,
    provider: 'pokemon-tcg',
    id,
    data: normalized,
    meta: {
      fetchedAt: new Date().toISOString(),
      lang,
      locale,
      autoTrad: autoTrad === 'true'
    }
  });
}));

export default router;
```

### Ajouter dans state.js

```javascript
// lib/utils/state.js
const metrics = {
  // ... métriques existantes
  sources: {
    // ... sources existantes
    pokemon_tcg: { requests: 0, errors: 0 },
    mtg: { requests: 0, errors: 0 },
    yugioh: { requests: 0, errors: 0 },
    lorcana: { requests: 0, errors: 0 },
    digimon: { requests: 0, errors: 0 }
  }
};
```

---

## 📝 Notes importantes

### Statut d'implémentation

#### ✅ Implémentés

1. **Pokémon TCG** (pokemontcg.io)
   - Provider: `lib/providers/tcg/pokemon.js`
   - Normalizer: `normalizePokemonSearch`, `normalizePokemonCard`, `normalizePokemonSets`
   - Routes: `/tcg_pokemon/*`
   - Authentification: Clé API optionnelle (X-API-Key header)
   - **Tests** : ✅ Fonctionnel (API lente parfois)
   - **Cache** : PostgreSQL via createProviderCache
   - **Date** : 1er janvier 2026

2. **Magic: The Gathering** (Scryfall)
   - Provider: `lib/providers/tcg/mtg.js`
   - Normalizer: `normalizeMTGSearch`, `normalizeMTGCard`, `normalizeMTGSets`
   - Routes: `/tcg_mtg/*`
   - Authentification: Aucune (API gratuite)
   - **Tests** : ✅ Fonctionnel (API rapide et stable)
   - **Syntaxe** : Supporte la recherche Scryfall avancée (`t:creature c:green`)
   - **Date** : 1er janvier 2026

3. **Yu-Gi-Oh!** (YGOPRODeck)
   - Provider: `lib/providers/tcg/yugioh.js`
   - Normalizer: `normalizeYuGiOhSearch`, `normalizeYuGiOhCard`, `normalizeYuGiOhSets`
   - Routes: `/tcg_yugioh/*`
   - Authentification: Aucune (API gratuite)
   - **Tests** : ✅ Fonctionnel (API très rapide)
   - **Endpoints** : 
     - `/search` - Recherche avec filtres (type, race, attribute, level, archetype)
     - `/card` - Détails carte par ID
     - `/details` - Détails normalisés
     - `/sets` - Liste de 1011 sets
     - `/archetype` - Recherche par archétype (Blue-Eyes, Dark Magician, etc.)
   - **Particularités** :
     - Types spécifiques requis ('Effect Monster', 'Spell Card', 'Trap Card', etc.)
     - Support complet des archétypes
     - Prix multi-marchés (TCGPlayer, Cardmarket, eBay, Amazon, CoolStuffInc)
     - Banlist info incluse
   - **Date** : 1er janvier 2026

4. **Disney Lorcana** ✅ (Lorcana API)
   - API : https://api.lorcana-api.com
   - Routes : `/tcg_lorcana/search`, `/card`, `/details`, `/sets`
   - Authentification : Aucune requise (API complètement gratuite)
   - Particularités :
     - Recherche avec filtres (color, type, rarity, set, cost, inkable)
     - 11 sets disponibles (Archazia's Island, Azurite Sea, Fabled, etc.)
     - Attributs spécifiques : Inkable, Strength, Willpower, Lore, Franchise
     - Types : Character, Action, Item, Location
     - Couleurs : Amber, Amethyst, Emerald, Ruby, Sapphire, Steel
     - API très rapide et stable
   - **Date** : 1er janvier 2026

5. **Digimon Card Game** ✅ (DigimonCard.io)
   - API : https://digimoncard.io/api-public
   - Routes : `/tcg_digimon/search`, `/card`, `/details`
   - Authentification : Aucune requise (API gratuite)
   - Particularités :
     - Recherche avec filtres (type, color, level, series, attribute, rarity, stage)
     - 3961 cartes disponibles dans Digimon Card Game
     - Types : Digimon, Digi-Egg, Tamer, Option
     - Couleurs : Red, Blue, Yellow, Green, Black, Purple, White
     - Attributs : Vaccine, Virus, Data, Free, Variable
     - Stages : In-Training, Rookie, Champion, Ultimate, Mega
     - Mécaniques : Evolution (cost/level/color), DP, Play Cost
     - API rapide et stable
   - **Date** : 1er janvier 2026

#### 🔜 À implémenter

Toutes les APIs TCG principales sont maintenant implémentées !

### Rate Limiting

Respecter les limites de chaque API :
- **Pokémon TCG** : 1000 req/jour sans clé, 20000 avec clé
- **Scryfall (MTG)** : 10 req/s recommandé (100ms délai)
- **YGOPRODeck** : 20 req/s recommandé (50ms délai)
- **Lorcana** : Aucune limite documentée
- **Digimon** : 20 req/s recommandé (50ms délai)

### Images

⚠️ **YGOPRODeck** : Ne pas hotlink les images, les télécharger et stocker localement si volume élevé

### Cache

- Toujours utiliser le cache pour les requêtes répétitives
- TTL recommandé : 300s (5 minutes) pour les cartes, 3600s (1h) pour les sets
- Clés de cache descriptives : `{provider}:{type}:{params...}`

### Traduction

- Utiliser `autoTrad` uniquement quand la langue native n'est pas disponible
- Mettre en cache les traductions (auto_trad le fait automatiquement)
- Toujours garder `name_original` et `rarity_original` en anglais

---

*Document créé le 1er janvier 2026 - Dernière mise à jour : 1er janvier 2026*  
*Pokémon TCG, Magic: The Gathering et Yu-Gi-Oh! implémentés et testés*
