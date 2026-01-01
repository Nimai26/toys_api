# 🏴‍☠️ One Piece Card Game - Sources de données

> **Date de recherche** : 1er janvier 2026  
> **Objectif** : Identifier les meilleures sources pour intégrer One Piece TCG dans toys_api

---

## ✅ Source #1 : onepiece-cardgame.dev (JSON API) ⭐ RECOMMANDÉ

### Informations générales
- **URL Base** : https://www.onepiece-cardgame.dev/
- **Type** : Fichiers JSON statiques publics
- **Format** : JSON
- **Authentification** : Aucune
- **Langue** : Anglais uniquement
- **Total cartes** : **1719 cartes** (au 1er janvier 2026)

### Endpoints JSON disponibles

```
https://www.onepiece-cardgame.dev/cards.json     # Toutes les cartes
https://www.onepiece-cardgame.dev/meta.json      # Métadonnées (types, couleurs, raretés, sets)
https://www.onepiece-cardgame.dev/sources.json   # Liste des sets
https://www.onepiece-cardgame.dev/dates.json     # Dates de sortie
```

### Structure de données (cards.json)

```json
{
  "gid": "47",
  "cid": "OP01-047",
  "n": "Trafalgar Law",
  "t": "2",
  "col": "7",
  "cs": "5",
  "tr": "Supernovas/ Heart Pirates",
  "a": "1",
  "p": "6000",
  "cp": null,
  "l": null,
  "r": "5",
  "ar": null,
  "iu": "https://onepiece-cardgame.dev/images/cards/OP01-047_9bea1f_jp.png",
  "e": "<Blocker>\r\n[On Play] You may return one of your Characters to your hand: Play 1 Cost 3 or lower Character Card from your hand.",
  "al": null,
  "intl": "0",
  "srcN": "Romance Dawn [OP-01]",
  "srcD": null
}
```

### Mapping des champs

| Champ | Description |
|-------|-------------|
| `gid` | Global ID (unique) |
| `cid` | Card ID (ex: OP01-047) |
| `n` | Nom de la carte |
| `t` | Type ID (1=Leader, 2=Character, 3=Event, 4=Stage, 5=DON) |
| `col` | Color ID (1=Red, 6=Blue, 7=Green, 4=Purple, 12=Black, 16=Yellow, 5=DON) |
| `cs` | Cost |
| `tr` | Traits (ex: "Supernovas/ Heart Pirates") |
| `a` | Attribute/Attack ID (1=Slash, 2=Strike, 3=Ranged, 4=Wisdom, 5=Special) |
| `p` | Power |
| `cp` | Counter Power |
| `l` | Life (pour Leaders uniquement) |
| `r` | Rarity ID (1=Leader, 2=Common, 3=Uncommon, 4=Rare, 5=Super Rare, 6=Secret Rare, 7=Promo, 8=Special Rare, 9=Treasure Rare) |
| `ar` | Alternate rarity |
| `iu` | Image URL |
| `e` | Effect text (en anglais) |
| `al` | Alternate art link |
| `intl` | International (0 ou 1) |
| `srcN` | Source name (nom du set) |
| `srcD` | Source date (date de sortie) |

### Métadonnées (meta.json)

#### Couleurs disponibles
- Red (1)
- Blue (6)
- Green (7)
- Purple (4)
- Black (12)
- Yellow (16)
- DON (5)
- Couleurs duales : Blue/Green, Red/Blue, Purple/Black, etc.

#### Types de cartes
- Leader (1)
- Character (2)
- Event (3)
- Stage (4)
- DON (5)

#### Raretés
- Leader (1)
- Common (2)
- Uncommon (3)
- Rare (4)
- Super Rare (5)
- Secret Rare (6)
- Promo (7)
- Special Rare (8)
- Treasure Rare (9)

#### Sets disponibles (31 sets au total)
```json
[
  "Romance Dawn [OP-01]",
  "Paramount War [OP-02]",
  "Pillars of Strength [OP-03]",
  "Kingdoms of Intrigue [OP-04]",
  "Awakening of the New Era [OP-05]",
  "Wings of Captain [OP-06]",
  "500 Years in the Future [OP-07]",
  "Two Legends [OP-08]",
  "Memorial Collection [EB-01]",
  "Straw Hat Crew [ST-01]",
  "Worst Generation [ST-02]",
  "The Seven Warlords of the Sea [ST-03]",
  "Animal Kingdom Pirates [ST-04]",
  // ... et plus
]
```

### Attributs de combat
- NA (0)
- Slash (1)
- Strike (2)
- Ranged (3)
- Wisdom (4)
- Special (5)
- Combinaisons : Slash/Strike, Slash/Special, Strike/Ranged, Strike/Special

### Mots-clés (keywords)
- Rush
- [On Play]
- Double Attack
- Blocker
- [When Attacking]
- Banish
- [DON!!]
- [On K.O.]
- [On Block]
- [Activate]
- [End of Your Turn]

### Avantages ✅
- ✅ **Gratuit et public** - aucune authentification
- ✅ **JSON bien structuré** - facile à parser
- ✅ **Complet** - 1719 cartes, tous les sets
- ✅ **Images disponibles** - URLs directes vers les images
- ✅ **Métadonnées riches** - types, couleurs, raretés, sets
- ✅ **Pas de rate limiting** - fichiers statiques
- ✅ **Stable** - site communautaire bien maintenu

### Inconvénients ❌
- ❌ **Anglais uniquement** - pas de VF native
- ❌ **Pas d'API dynamique** - fichiers JSON statiques uniquement
- ❌ **Pas de prix** - pas de données TCGPlayer/Cardmarket
- ❌ **Abréviations** - noms de champs courts (gid, cid, n, t, etc.)

---

## 📍 Source #2 : Site officiel Bandai (scraping possible)

### Site officiel japonais
- **URL** : https://www.onepiece-cardgame.com/cardlist/
- **Langue** : Japonais 🇯🇵
- **Format** : HTML (scraping requis)
- **Données** : Cartes complètes avec effets en japonais

### Site officiel français
- **URL** : https://fr.onepiece-cardgame.com/
- **Langue** : Français 🇫🇷
- **Format** : HTML (scraping requis)
- **Données** : Produits, événements, actualités

### Cardlist officiel
- **URL** : https://fr.onepiece-cardgame.com/cardlist/ (redirige vers version japonaise)
- **État** : Pas de version française de la cardlist officielle

### Problèmes du scraping
- ⚠️ **Protection anti-bot** - Cloudflare présent
- ⚠️ **Structure complexe** - React app avec JavaScript
- ⚠️ **ToS** - Violations possibles des conditions d'utilisation
- ⚠️ **Maintenance élevée** - structure HTML peut changer
- ⚠️ **Pas d'API exposée** - aucun endpoint JSON public détecté

---

## 🎯 Recommandation

### Solution retenue : **onepiece-cardgame.dev JSON API**

**Stratégie d'implémentation** :

1. **Télécharger et cacher les JSON** (cards.json + meta.json)
   - Stockage local dans `toys_api/data/onepiece/`
   - Mise à jour quotidienne ou hebdomadaire via cron
   - Évite les requêtes répétées au site communautaire

2. **Créer un provider One Piece**
   ```javascript
   // lib/providers/tcg/onepiece.js
   - searchOnePieceCards(query, options)
   - getOnePieceCardDetails(cardId)
   - getOnePieceCardByName(name, options)
   - getAllOnePieceSets()
   ```

3. **Normalisation des données**
   ```javascript
   // lib/normalizers/tcg.js
   - normalizeOnePieceSearch(rawData, options)
   - normalizeOnePieceCard(rawCard, options)
   ```

4. **Routes API**
   ```javascript
   // routes/tcg_onepiece.js
   GET /tcg_onepiece/search?q=luffy
   GET /tcg_onepiece/card?name=Trafalgar Law
   GET /tcg_onepiece/card?id=OP01-047
   GET /tcg_onepiece/details?id=OP01-047
   GET /tcg_onepiece/sets
   ```

5. **Traduction automatique**
   - Utiliser `translateText()` pour traduire les effets de l'anglais vers le français
   - Support du paramètre `?lang=fr` et `?autoTrad=true`

6. **Enrichissement futur**
   - Possibilité d'ajouter des prix via scraping TCGPlayer/Cardmarket
   - Possibilité de compléter avec traductions françaises manuelles

### Structure de données normalisée

```javascript
const normalizedCard = {
  id: "OP01-047",
  globalId: 47,
  name: "Trafalgar Law",
  game: "onepiece",
  set: {
    id: "OP-01",
    name: "Romance Dawn [OP-01]",
    code: "OP-01",
    releaseDate: null
  },
  number: "047",
  rarity: "Super Rare",
  type: "Character",
  images: [{
    url: "https://onepiece-cardgame.dev/images/cards/OP01-047_9bea1f_jp.png",
    type: "full"
  }],
  prices: null, // À enrichir ultérieurement
  attributes: {
    color: "Green",
    cost: 5,
    power: 6000,
    counterPower: null,
    life: null,
    traits: ["Supernovas", "Heart Pirates"],
    attribute: "Slash",
    effect: "<Blocker>\r\n[On Play] You may return one of your Characters to your hand: Play 1 Cost 3 or lower Character Card from your hand."
  },
  description: "Cost: 5 | Power: 6000 | Green\nTraits: Supernovas, Heart Pirates\nAttribute: Slash\n\n<Blocker>\n[On Play] You may return one of your Characters to your hand: Play 1 Cost 3 or lower Character Card from your hand.",
  detailUrl: "/tcg_onepiece/details?id=OP01-047"
};
```

### Paramètres de recherche

```
q         - Nom de la carte (fuzzy search)
type      - Type de carte (leader, character, event, stage)
color     - Couleur (red, blue, green, purple, black, yellow)
rarity    - Rareté (common, uncommon, rare, super-rare, secret-rare, promo)
set       - Code du set (OP-01, ST-01, etc.)
cost      - Coût (0-10)
power     - Puissance (0-12000+)
trait     - Trait (Straw Hat Crew, Supernovas, etc.)
attribute - Attribut de combat (slash, strike, ranged, wisdom, special)
max       - Nombre max de résultats (défaut: 20)
lang      - Langue de sortie (en, fr) - via traduction auto
autoTrad  - Traduction automatique (true/false)
```

---

## 📊 Estimation de développement

| Tâche | Durée estimée |
|-------|---------------|
| Provider One Piece | 2-3 heures |
| Normalizers | 1-2 heures |
| Routes API | 2 heures |
| Cache local JSON | 1 heure |
| Tests | 1-2 heures |
| Documentation | 1 heure |
| **TOTAL** | **8-11 heures** |

---

## 🔗 Ressources

- Site communautaire : https://www.onepiece-cardgame.dev/
- Discord One Piece TCG : https://discord.gg/pgzSYPZEHD
- Site officiel FR : https://fr.onepiece-cardgame.com/
- Site officiel JP : https://www.onepiece-cardgame.com/
- GitHub onepiece-cardgame.dev : (pas trouvé de repo public)

---

*Document généré le 1er janvier 2026*
