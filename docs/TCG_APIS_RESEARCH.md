# 🃏 Recherche APIs - Trading Card Games (TCG)

> **Date de recherche** : 30 décembre 2025  
> **Objectif** : Intégrer des sources TCG dans toys_api pour la collection de cartes

---

## 📋 Sommaire

1. [APIs Recommandées (Prêtes à intégrer)](#-apis-recommandées-prêtes-à-intégrer)
2. [Pokémon TCG](#pokémon-tcg)
3. [Magic: The Gathering (Scryfall)](#magic-the-gathering-scryfall)
4. [Yu-Gi-Oh! (YGOPRODeck)](#yu-gi-oh-ygoprodeck)
5. [Disney Lorcana](#disney-lorcana)
6. [Digimon TCG](#digimon-tcg)
7. [One Piece Card Game](#one-piece-card-game)
8. [Carddass Japonais (Bandai)](#-carddass-japonais-bandai)
9. [Autres TCG Bandai](#autres-tcg-bandai)
10. [TCGPlayer (Marketplace multi-TCG)](#tcgplayer-marketplace-multi-tcg)
11. [Plan d'implémentation](#-plan-dimplémentation)

---

## ✅ APIs Recommandées (Prêtes à intégrer)

| TCG | API | Clé requise | Rate Limit | Langues | Priorité |
|-----|-----|-------------|------------|---------|----------|
| **Pokémon** | pokemontcg.io | Optionnelle | 1000/jour (sans clé) | EN | ⭐⭐⭐⭐⭐ |
| **Magic: The Gathering** | scryfall.com | Non | 10 req/s | Multi | ⭐⭐⭐⭐⭐ |
| **Yu-Gi-Oh!** | ygoprodeck.com | Non | 20 req/s | FR, EN, DE, IT, PT | ⭐⭐⭐⭐⭐ |
| **Disney Lorcana** | lorcana-api.com | Non | Non spécifié | EN | ⭐⭐⭐⭐ |
| **Disney Lorcana** | lorcanajson.org | Non (JSON statique) | N/A | EN, FR, DE, IT | ⭐⭐⭐⭐⭐ |
| **Digimon** | digimoncard.io | Non | 20 req/s | EN | ⭐⭐⭐⭐ |

---

## Pokémon TCG

### Informations générales
- **Site** : https://pokemontcg.io/
- **Documentation** : https://docs.pokemontcg.io/
- **Portail développeur** : https://dev.pokemontcg.io/
- **Type** : API REST
- **Format** : JSON
- **Authentification** : Optionnelle (clé API pour rate limits plus élevés)

### Endpoints principaux
```
Base URL: https://api.pokemontcg.io/v2

GET /cards              # Liste toutes les cartes
GET /cards/{id}         # Détails d'une carte
GET /cards?q=name:pikachu  # Recherche avec syntaxe Lucene
GET /sets               # Liste tous les sets
GET /sets/{id}          # Détails d'un set
GET /types              # Types de Pokémon
GET /subtypes           # Sous-types
GET /supertypes         # Super-types
GET /rarities           # Raretés
```

### Exemple de réponse carte
```json
{
  "id": "base1-4",
  "name": "Charizard",
  "supertype": "Pokémon",
  "subtypes": ["Stage 2"],
  "hp": "120",
  "types": ["Fire"],
  "attacks": [...],
  "weaknesses": [...],
  "retreatCost": ["Colorless", "Colorless", "Colorless"],
  "set": {
    "id": "base1",
    "name": "Base",
    "series": "Base"
  },
  "number": "4",
  "rarity": "Rare Holo",
  "images": {
    "small": "https://images.pokemontcg.io/base1/4.png",
    "large": "https://images.pokemontcg.io/base1/4_hires.png"
  },
  "tcgplayer": {
    "url": "https://prices.pokemontcg.io/tcgplayer/base1-4",
    "prices": {
      "holofoil": {
        "low": 150.0,
        "mid": 200.0,
        "high": 350.0,
        "market": 180.0
      }
    }
  }
}
```

### Fonctionnalités
- ✅ Images haute résolution
- ✅ Prix TCGPlayer intégrés
- ✅ Recherche avancée (syntaxe Lucene)
- ✅ Données complètes (attaques, faiblesses, etc.)
- ✅ SDKs disponibles (Python, Ruby, JavaScript, etc.)
- ❌ Pas de support multi-langues natif

### Rate Limits
| Avec clé API | Sans clé API |
|--------------|--------------|
| 20,000 req/jour | 1,000 req/jour |
| Pas de limite IP | Limite par IP |

### Intégration toys_api
```javascript
// Exemple d'intégration
const auth = requireApiKey('PokemonTCG', 'https://dev.pokemontcg.io/', true); // optionnel

router.get("/pokemon-tcg/search", auth, asyncHandler(async (req, res) => {
  const { q, page = 1, pageSize = 20 } = req.query;
  const headers = req.apiKey ? { 'X-Api-Key': req.apiKey } : {};
  
  const response = await fetch(
    `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`,
    { headers }
  );
  // ...
}));
```

---

## Magic: The Gathering (Scryfall)

### Informations générales
- **Site** : https://scryfall.com/
- **Documentation** : https://scryfall.com/docs/api
- **Type** : API REST
- **Format** : JSON
- **Authentification** : Aucune requise

### Endpoints principaux
```
Base URL: https://api.scryfall.com

GET /cards/search?q=name       # Recherche de cartes
GET /cards/{id}                # Carte par ID Scryfall
GET /cards/named?exact=name    # Carte par nom exact
GET /cards/named?fuzzy=name    # Recherche floue
GET /cards/autocomplete?q=     # Autocomplétion
GET /cards/random               # Carte aléatoire
GET /cards/collection          # Lot de cartes (POST)
GET /sets                       # Tous les sets
GET /sets/{code}               # Set par code
GET /symbology                  # Symboles de mana
GET /catalog/card-names        # Tous les noms de cartes
GET /bulk-data                 # Téléchargement en masse
```

### Syntaxe de recherche
```
# Exemples de requêtes
name:lightning          # Nom contient "lightning"
type:creature           # Type créature
color:red               # Couleur rouge
cmc:3                   # Coût de mana converti = 3
set:m21                 # Set Core 2021
rarity:mythic           # Rareté mythique
artist:"john avon"      # Par artiste
year:2020               # Année de sortie
is:foil                 # Version foil disponible
```

### Exemple de réponse carte
```json
{
  "id": "0000579f-7b35-4ed3-b44c-db2a538066fe",
  "oracle_id": "44623693-51d6-49ad-8cd7-140505caf02f",
  "name": "Fury Sliver",
  "lang": "en",
  "released_at": "2006-10-06",
  "uri": "https://api.scryfall.com/cards/0000579f-7b35-4ed3-b44c-db2a538066fe",
  "layout": "normal",
  "mana_cost": "{5}{R}",
  "cmc": 6.0,
  "type_line": "Creature — Sliver",
  "oracle_text": "All Sliver creatures have double strike.",
  "power": "3",
  "toughness": "3",
  "colors": ["R"],
  "set": "tsp",
  "set_name": "Time Spiral",
  "rarity": "uncommon",
  "image_uris": {
    "small": "https://cards.scryfall.io/small/front/...",
    "normal": "https://cards.scryfall.io/normal/front/...",
    "large": "https://cards.scryfall.io/large/front/...",
    "png": "https://cards.scryfall.io/png/front/...",
    "art_crop": "https://cards.scryfall.io/art_crop/front/...",
    "border_crop": "https://cards.scryfall.io/border_crop/front/..."
  },
  "prices": {
    "usd": "0.35",
    "usd_foil": "1.50",
    "eur": "0.25",
    "eur_foil": "1.00"
  },
  "legalities": {
    "standard": "not_legal",
    "modern": "legal",
    "legacy": "legal",
    "vintage": "legal",
    "commander": "legal"
  }
}
```

### Fonctionnalités
- ✅ Base de données la plus complète pour MTG
- ✅ Images multiples formats (PNG, art crop, etc.)
- ✅ Prix multi-devises (USD, EUR)
- ✅ Légalités par format
- ✅ Support multi-langues
- ✅ Bulk data pour téléchargement complet
- ✅ Pas de clé API requise

### Rate Limits
- **10 requêtes par seconde** recommandé
- Délai de 50-100ms entre requêtes conseillé
- HTTP 429 si dépassement → ban temporaire possible

### Headers requis
```javascript
const headers = {
  'User-Agent': 'ToysAPI/1.0',
  'Accept': 'application/json'
};
```

---

## Yu-Gi-Oh! (YGOPRODeck)

### Informations générales
- **Site** : https://ygoprodeck.com/
- **Documentation** : https://ygoprodeck.com/api-guide/
- **Type** : API REST
- **Format** : JSON
- **Authentification** : Aucune requise

### Endpoints principaux
```
Base URL: https://db.ygoprodeck.com/api/v7

GET /cardinfo.php                    # Toutes les cartes ou filtrées
GET /cardinfo.php?name=Dark Magician # Carte par nom exact
GET /cardinfo.php?fname=Magician     # Recherche floue
GET /cardinfo.php?id=46986414        # Carte par passcode
GET /cardinfo.php?archetype=Blue-Eyes # Par archétype
GET /cardsets.php                    # Tous les sets
GET /cardsetsinfo.php?setcode=XXX    # Info d'un set
GET /archetypes.php                  # Tous les archétypes
GET /checkDBVer.php                  # Version de la DB
GET /randomcard.php                  # Carte aléatoire
```

### Paramètres de filtrage
```
name          - Nom exact (peut utiliser | pour plusieurs)
fname         - Recherche floue
id            - Passcode 8 chiffres
konami_id     - ID Konami
type          - Type de carte (Effect Monster, Spell Card, etc.)
atk           - Valeur ATK (supports lt, lte, gt, gte)
def           - Valeur DEF
level         - Niveau/Rang
race          - Race (Spellcaster, Warrior, etc.)
attribute     - Attribut (DARK, LIGHT, etc.)
link          - Valeur Link
linkmarker    - Marqueurs Link
scale         - Échelle Pendule
cardset       - Set
archetype     - Archétype
banlist       - Banlist (TCG, OCG, Goat)
sort          - Tri (atk, def, name, type, level, id, new)
format        - Format (tcg, ocg, goat, speed duel, etc.)
language      - Langue (fr, de, it, pt)
misc=yes      - Infos supplémentaires
```

### Exemple de réponse carte
```json
{
  "data": [{
    "id": 46986414,
    "name": "Dark Magician",
    "type": "Normal Monster",
    "frameType": "normal",
    "desc": "The ultimate wizard in terms of attack and defense.",
    "atk": 2500,
    "def": 2100,
    "level": 7,
    "race": "Spellcaster",
    "attribute": "DARK",
    "archetype": "Dark Magician",
    "card_sets": [
      {
        "set_name": "Legendary Collection 3: Yugi's World",
        "set_code": "LCYW-EN001",
        "set_rarity": "Secret Rare",
        "set_price": "4.99"
      }
    ],
    "card_images": [
      {
        "id": 46986414,
        "image_url": "https://images.ygoprodeck.com/images/cards/46986414.jpg",
        "image_url_small": "https://images.ygoprodeck.com/images/cards_small/46986414.jpg",
        "image_url_cropped": "https://images.ygoprodeck.com/images/cards_cropped/46986414.jpg"
      }
    ],
    "card_prices": [
      {
        "cardmarket_price": "0.15",
        "tcgplayer_price": "0.25",
        "ebay_price": "2.99",
        "amazon_price": "1.50",
        "coolstuffinc_price": "0.49"
      }
    ]
  }]
}
```

### Support multi-langues
```
GET /cardinfo.php?name=Survie%20du%20Plus%20Fort&language=fr  # Français
GET /cardinfo.php?language=de&num=5&offset=0&sort=new        # Allemand
```

**Langues supportées** : `fr` (Français), `de` (Allemand), `it` (Italien), `pt` (Portugais)

### Fonctionnalités
- ✅ Base complète Yu-Gi-Oh!
- ✅ Multi-langues (FR, DE, IT, PT)
- ✅ Prix multi-sources (Cardmarket, TCGPlayer, eBay, Amazon)
- ✅ Images 3 formats (full, small, cropped)
- ✅ Artwork alternatifs inclus
- ✅ Banlists (TCG, OCG, Goat)
- ✅ Formats (TCG, Speed Duel, Rush Duel, Master Duel, etc.)

### Rate Limits
- **20 requêtes par seconde**
- Dépassement → blocage 1 heure
- Cache serveur : 2 jours (172800s)

### ⚠️ Important - Images
> "Images are pulled from our image server. **You must download and store these images yourself!** If we find you are pulling a very high volume of images per second then your IP will be blacklisted."

---

## Disney Lorcana

### Option 1 : Lorcana-API.com (REST API)

- **Site** : https://lorcana-api.com/
- **Documentation** : https://lorcana-api.com/docs/intro
- **GitHub** : https://github.com/Dogloverblue/Lorcana-API
- **Type** : API REST (Java)
- **Format** : JSON
- **Authentification** : Aucune

#### Caractéristiques
- ✅ Open source
- ✅ Gratuit, sans compte
- ✅ Auto-hébergeable
- ❌ Documentation limitée

### Option 2 : LorcanaJSON (JSON statique) ⭐ RECOMMANDÉ

- **Site** : https://lorcanajson.org/
- **GitHub** : https://github.com/LorcanaJSON/LorcanaJSON
- **Type** : Fichiers JSON téléchargeables
- **Format** : JSON
- **Authentification** : Aucune

#### Fichiers disponibles
```
metadata.json           # Version et date de génération
allCards.json           # Toutes les cartes
setdata.{setCode}.json  # Cartes par set
deckdata.{deckCode}.json # Decks pré-construits
```

#### Langues disponibles
- 🇬🇧 Anglais (EN)
- 🇫🇷 Français (FR)
- 🇩🇪 Allemand (DE)
- 🇮🇹 Italien (IT)

#### Exemple de réponse carte
```json
{
  "id": 1,
  "name": "Ariel - On Human Legs",
  "fullName": "Ariel - On Human Legs",
  "version": "On Human Legs",
  "type": "Character",
  "color": "Amber",
  "cost": 4,
  "inkwell": true,
  "strength": 3,
  "willpower": 4,
  "lore": 2,
  "rarity": "Uncommon",
  "story": "The Little Mermaid",
  "artists": ["Matthew Robert Davies"],
  "setCode": "1",
  "number": 1,
  "fullIdentifier": "1/204 • EN • 1",
  "abilities": [...],
  "images": {
    "full": "https://...",
    "thumbnail": "https://..."
  },
  "externalLinks": {
    "tcgPlayerId": 123456,
    "tcgPlayerUrl": "https://...",
    "cardmarketId": 789,
    "cardmarketUrl": "https://..."
  }
}
```

#### Symboles spéciaux (Unicode)
```
⟳ (U+27F3) - Exert
⬡ (U+2B21) - Ink
◊ (U+25CA) - Lore
¤ (U+00A4) - Strength
⛉ (U+26C9) - Willpower
◉ (U+25C9) - Inkwell
```

#### Fonctionnalités
- ✅ Données officielles (source : app Disney Lorcana)
- ✅ Multi-langues (EN, FR, DE, IT)
- ✅ Liens externes (TCGPlayer, Cardmarket)
- ✅ Masques foil pour rendu visuel
- ✅ Historique des errata
- ✅ Format Cockatrice disponible

---

## Digimon TCG

### Informations générales
- **Site** : https://digimoncard.io/
- **Documentation API** : https://documenter.getpostman.com/view/14059948/TzecB4fH
- **Type** : API REST
- **Format** : JSON
- **Authentification** : Aucune

### Endpoints principaux
```
Base URL: https://digimoncard.io/api-public

GET /getAllCards                     # Toutes les cartes
GET /getAllCards?sort=name           # Triées par nom
GET /getAllCards?series=Digimon Card Game  # Par série
GET /getAllCards?sortdirection=asc   # Direction du tri
```

### Paramètres
```
sort          - Tri (name)
series        - Série ("Digimon Card Game", "Digimon Digi-Battle Card Game", "Digimon Collectible Card Game")
sortdirection - Direction (asc, desc)
```

### Exemple de réponse
```json
[
  {
    "name": "Agumon",
    "cardnumber": "BT1-010"
  },
  {
    "name": "Greymon",
    "cardnumber": "BT1-015"
  }
]
```

### Fonctionnalités
- ✅ Base complète Digimon TCG
- ✅ Gratuit sans clé
- ❌ Données limitées (nom + numéro seulement via API publique)
- ℹ️ Site web complet avec plus de données (scraping possible)

### Rate Limits
- **20 requêtes par seconde**
- Blocage temporaire si dépassement

---

## One Piece Card Game

### État actuel
**❌ Pas d'API officielle connue**

### Ressources communautaires
- **Site communautaire** : https://www.onepiece-cardgame.dev/
- **Discord** : https://discord.gg/pgzSYPZEHD

### Options d'intégration
1. **Scraping** du site onepiece-cardgame.dev (non recommandé, ToS)
2. **Attendre** une API officielle Bandai
3. **Cardmarket API** pour les prix (si disponible)

### Données Bandai officielles
- **Site officiel** : https://www.onepiece-cardgame.com/
- **Pas d'API publique exposée**

---

## 🎴 Carddass Japonais (Bandai)

### Qu'est-ce que les Carddass ?
Les **Carddass** (カードダス) sont des cartes à collectionner produites par Bandai depuis 1988, distribuées via des distributeurs automatiques au Japon.

### Séries Carddass populaires
| Série | Années | Notes |
|-------|--------|-------|
| **Dragon Ball** | 1988-présent | La plus célèbre |
| **Sailor Moon** | 1992-1997 | Très recherchée |
| **Saint Seiya** | 1988-1995 | Chevaliers du Zodiaque |
| **Gundam** | 1988-présent | Multiple séries |
| **SD Gundam** | 1989-présent | Style super-deformed |
| **Final Fantasy** | 1992-1994 | Rare |
| **Street Fighter** | 1991-1995 | Arcade |
| **Kamen Rider** | 1988-présent | Tokusatsu |
| **Super Sentai** | 1988-présent | Power Rangers JP |
| **Ultraman** | 1990-présent | Tokusatsu |

### Portail officiel Bandai
- **URL** : https://sec.carddass.com/club/
- **Langue** : Japonais uniquement
- **API** : ❌ **Aucune API publique**

### Sites officiels par franchise (Bandai)
```
Battle Spirits      : https://www.battlespirits.com/
Digimon Card Game   : https://digimoncard.com/
Digimon Alysion     : https://digimon-alysion.com/
Dragon Ball FW      : https://www.dbs-cardgame.com/fw/jp/
DB Super Diversers  : https://www.dbsdv.com/
Gundam Arsenal Base : https://www.gundam-ab.com/
Gundam Card Game    : https://www.gundam-gcg.com/jp/
Kamen Rider         : https://www.ganbalegends.com/
One Piece Card Game : https://www.onepiece-cardgame.com/
Union Arena         : https://www.unionarena-tcg.com/jp/
```

### Options d'intégration Carddass

#### Option 1 : Scraping (Complexe)
```javascript
// Sites potentiels à scraper
const carddass_sources = [
  'https://sec.carddass.com/',           // Portail officiel (JP)
  'https://www.carddass.com/bcg/jp/',    // Bandai Card Games
  'https://myfigurecollection.net/',     // Collectibles (pas TCG)
];
```
**Difficultés** :
- Sites en japonais
- Protection anti-bot possible
- Structure HTML complexe
- Pas de données de prix

#### Option 2 : Bases de données communautaires
| Source | URL | Contenu |
|--------|-----|---------|
| **Cardmarket** | cardmarket.com | Prix EU, certaines séries |
| **TCGPlayer** | tcgplayer.com | Prix US, séries limitées |
| **eBay** | ebay.com | Listings, pas de DB structurée |

#### Option 3 : Créer notre propre base
- Parser manuellement les catalogues
- Stocker dans une DB locale
- Maintenir via contributions communautaires

### Structure de données suggérée pour Carddass
```javascript
const carddassCard = {
  id: "DB-001",
  name: {
    ja: "孫悟空",
    en: "Son Goku",
    fr: "Son Goku"
  },
  series: "Dragon Ball",
  subseries: "Carddass Part 1",
  year: 1988,
  cardNumber: "1",
  rarity: "Normal", // Normal, Prism, Holo, etc.
  type: "Character",
  images: {
    front: "url",
    back: "url"
  },
  attributes: {
    power: 1500,
    // Spécifique à chaque série
  }
};
```

---

## Autres TCG Bandai

### Dragon Ball Super Card Game (Fusion World)
- **Site** : https://www.dbs-cardgame.com/fw/
- **API** : ❌ Pas d'API publique connue
- **Alternative** : Scraping ou attente API

### Union Arena
- **Site** : https://www.unionarena-tcg.com/
- **Franchises** : Jujutsu Kaisen, Demon Slayer, Bleach, Hunter x Hunter, etc.
- **API** : ❌ Pas d'API publique

### Battle Spirits
- **Site** : https://www.battlespirits.com/
- **API** : ❌ Pas d'API publique

---

## TCGPlayer (Marketplace multi-TCG)

### Informations générales
- **Site** : https://www.tcgplayer.com/
- **API** : Disponible (partenariat requis)
- **Couverture** : 452,000+ produits

### TCG supportés par TCGPlayer
- Magic: The Gathering
- Pokémon
- Yu-Gi-Oh!
- Disney Lorcana
- One Piece
- Digimon
- Cardfight!! Vanguard
- Weiß Schwarz
- Flesh and Blood
- Star Wars: Unlimited
- Final Fantasy TCG
- Et plus...

### Accès API
L'API TCGPlayer nécessite un **partenariat commercial**.
- Documentation : https://docs.tcgplayer.com/
- Contact : partenariats commerciaux uniquement

### Alternative : TCGCSV
- **URL** : https://tcgcsv.com/
- Données de prix TCGPlayer exportées en CSV
- Peut être utilisé pour enrichir les données

---

## 📈 Plan d'implémentation

### Phase 1 : APIs stables (Priorité haute)
1. **Pokémon TCG** - pokemontcg.io
   - Endpoints : `/pokemon-tcg/search`, `/pokemon-tcg/card`, `/pokemon-tcg/sets`
   - Clé API optionnelle
   - Estimation : 2-3 heures

2. **Magic: The Gathering** - Scryfall
   - Endpoints : `/mtg/search`, `/mtg/card`, `/mtg/sets`
   - Pas de clé API
   - Estimation : 2-3 heures

3. **Yu-Gi-Oh!** - YGOPRODeck
   - Endpoints : `/yugioh/search`, `/yugioh/card`, `/yugioh/sets`
   - Pas de clé API
   - Support français natif
   - Estimation : 2-3 heures

### Phase 2 : APIs secondaires (Priorité moyenne)
4. **Disney Lorcana** - LorcanaJSON
   - Télécharger JSON et servir localement
   - Ou proxy vers lorcanajson.org
   - Estimation : 1-2 heures

5. **Digimon TCG** - digimoncard.io
   - API limitée, enrichir via scraping si besoin
   - Estimation : 2-3 heures

### Phase 3 : Carddass et TCG Bandai (Priorité basse - R&D)
6. **Carddass japonais**
   - Recherche approfondie de sources
   - Scraping si nécessaire
   - Création base de données manuelle possible
   - Estimation : 5-10 heures (R&D)

7. **One Piece / Union Arena / etc.**
   - Dépend des APIs futures Bandai
   - Scraping comme fallback

---

## 🔗 Ressources supplémentaires

### Communautés et Discord
- Pokémon TCG API : https://discord.gg/dpsTCvg
- Lorcana API : https://discord.gg/wu6gYF6j2X
- YGOPRODeck : https://discord.gg/nx24PSBGFE

### GitHub repositories
```
Pokémon TCG : https://github.com/PokemonTCG
Scryfall    : https://github.com/scryfall
YGOPRODeck  : https://github.com/AlanOC91/YGOPRODeck
LorcanaJSON : https://github.com/LorcanaJSON/LorcanaJSON
Lorcana-API : https://github.com/Dogloverblue/Lorcana-API
```

### Outils de développement
- **Postman** : Collections API disponibles pour la plupart
- **SDKs** : Python, JavaScript, Ruby pour Pokémon TCG
- **Bulk Data** : Scryfall propose des dumps complets quotidiens

---

## 📝 Notes pour implémentation toys_api

### Structure de fichiers suggérée
```
toys_api/
├── lib/
│   ├── providers/
│   │   ├── tcg/
│   │   │   ├── pokemon.js
│   │   │   ├── mtg.js
│   │   │   ├── yugioh.js
│   │   │   ├── lorcana.js
│   │   │   ├── digimon.js
│   │   │   └── index.js
│   └── normalizers/
│       └── tcg.js
└── routes/
    └── tcg.js          # Routes groupées ou séparées
```

### Normalisation des données
```javascript
// Format unifié pour toutes les cartes TCG
const normalizedCard = {
  id: string,           // ID unique
  name: string,         // Nom de la carte
  game: string,         // pokemon, mtg, yugioh, lorcana, digimon
  set: {
    id: string,
    name: string,
    code: string
  },
  number: string,       // Numéro dans le set
  rarity: string,
  type: string,         // Type de carte
  images: [{
    url: string,
    type: string        // small, normal, large, art_crop
  }],
  prices: {
    usd: number,
    eur: number,
    source: string      // tcgplayer, cardmarket, etc.
  },
  attributes: {},       // Spécifiques au jeu (ATK, HP, mana, etc.)
  detailUrl: string     // URL pour /details
};
```

---

*Document généré le 30 décembre 2025 - À mettre à jour lors des implémentations*
