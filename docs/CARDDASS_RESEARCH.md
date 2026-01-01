# 🎴 Recherche Sources - Carddass Japonais (Bandai)

> **Date de recherche** : 1er janvier 2026  
> **Objectif** : Trouver la meilleure source de données pour les Carddass japonais (DBZ, Sailor Moon, Ranma, etc.)

---

## 📊 Résumé de la recherche

**Problématique** : Contrairement aux TCG modernes comme One Piece TCG qui ont des APIs communautaires (onepiece-cardgame.dev), **les Carddass japonais vintage (années 1988-2000) n'ont PAS d'API publique ni de base de données JSON structurée disponible**.

---

## ❌ Ce qui N'EXISTE PAS

### Pas d'API Bandai officielle
- ❌ **Portail Carddass officiel** (https://sec.carddass.com/club/) : Aucune API publique
- ❌ **Sites par franchise Bandai** : Pas de données historiques vintage exposées
- ❌ **GitHub** : Aucun projet communautaire type "carddass-json" ou "carddass-api" trouvé
- ❌ **Équivalent de onepiece-cardgame.dev** : N'existe pas pour les Carddass vintage

### Pas de base de données communautaire structurée
- ❌ **Format JSON téléchargeable** : Inexistant
- ❌ **API REST communautaire** : Aucune trouvée
- ❌ **Checklists structurées complètes** : Dispersées et incomplètes

---

## ✅ Ce qui EXISTE

### 1. **Fandom Wikis** (Sources principales mais non structurées)
#### Dragon Ball Carddass
- **URL** : https://dragonball.fandom.com/wiki/Dragon_Ball_Carddass
- **Contenu** :
  - Part 1-2 : Dragon Ball (1991)
  - Part 3-25 : Dragon Ball Z (1991-1996)
  - Part 26-30 : Dragon Ball GT (1996-1997)
  - Images de cartes (galerie)
- **Format** : HTML non structuré
- **Complétude** : Informations générales, pas de liste complète carte par carte

#### Sailor Moon Carddass
- **Wikis** : Sailor Moon Fandom (pas de page dédiée Carddass trouvée)
- **Contenu** : Informations dispersées dans les communautés Reddit
- **Format** : Posts Reddit, images individuelles

### 2. **Reddit Communities**
#### r/Bandai_Carddass
- **URL** : https://www.reddit.com/r/Bandai_Carddass/
- **Membres** : Petite communauté (~300 membres estimé)
- **Contenu** :
  - Photos de collections personnelles
  - Posts sur Ranma 1/2, Inuyasha, Dragon Ball
  - Pas de base de données structurée

#### r/dbz et r/sailormoon
- Nombreux posts sur l'identification de cartes vintage
- Questions "Qu'est-ce que j'ai trouvé?" avec photos
- Pas de ressource centralisée

### 3. **Sites de collectionneurs**
#### MyFigureCollection.net
- **URL** : https://myfigurecollection.net/
- **Type** : Base de données de figurines/collectibles japonais
- **Carddass** : Présence limitée, focus sur les figurines
- **Utilité** : Faible pour les cartes Carddass

### 4. **Marketplaces avec données partielles**
#### Cardmarket (Europe)
- **URL** : https://www.cardmarket.com/
- **Carddass disponibles** : Oui, mais inventaire limité
- **Données** : Prix, titres, raretés (incomplet)
- **API** : Nécessite partenariat commercial

#### eBay
- Listings individuels Carddass
- Pas de base de données structurée
- Informations non fiables (titres fantaisistes)

---

## 🎯 Séries Carddass Populaires (à couvrir)

| Série | Années | Parts | Estimation cartes | Disponibilité données |
|-------|--------|-------|-------------------|----------------------|
| **Dragon Ball** | 1988-1991 | Part 1-2 | ~120 | ⚠️ Partielle |
| **Dragon Ball Z** | 1991-1996 | Part 3-25 | ~1380 | ⚠️ Partielle |
| **Dragon Ball GT** | 1996-1997 | Part 26-30 | ~300 | ⚠️ Partielle |
| **Sailor Moon** | 1992-1997 | Multiple | ~500+ | ❌ Très limitée |
| **Saint Seiya** | 1988-1995 | Multiple | ~400+ | ❌ Très limitée |
| **Gundam** | 1988-présent | Multiple séries | 1000+ | ❌ Très limitée |
| **Ranma 1/2** | 1990-1995 | Prism/PP series | ~200+ | ❌ Très limitée |
| **Street Fighter** | 1991-1995 | Multiple | ~150+ | ❌ Très limitée |

---

## 🔧 Options d'implémentation

### Option 1 : Scraping Wikis (Complexe, faible ROI)
**Sources** : dragonball.fandom.com, autres wikis
**Difficulté** : ⭐⭐⭐⭐ (Très difficile)
**Problèmes** :
- Structure HTML non standardisée
- Informations incomplètes
- Pas de liste exhaustive carte par carte
- Images de qualité variable
- Maintenance difficile (mises à jour manuelles)

### Option 2 : Scraping Marketplaces (Légal, mais incomplet)
**Sources** : Cardmarket, eBay
**Difficulté** : ⭐⭐⭐ (Difficile)
**Problèmes** :
- Inventaire incomplet
- Données non normalisées
- Bans IP possibles
- Cardmarket nécessite API commerciale

### Option 3 : Base de données manuelle (Recommandé à court terme)
**Approche** :
1. Créer une structure JSON locale
2. Alimenter manuellement avec :
   - Informations des Wikis
   - Scans de catalogues vintage
   - Contributions communautaires
3. Héberger comme "API" locale dans toys_api

**Avantages** :
- ✅ Contrôle total des données
- ✅ Qualité garantie
- ✅ Pas de dépendance externe
- ✅ Évolutif

**Inconvénients** :
- ❌ Travail manuel initial important
- ❌ Couverture limitée au début
- ❌ Maintenance nécessaire

### Option 4 : Projet communautaire (Long terme)
**Concept** : Créer "carddass-json.org" sur le modèle de lorcanajson.org
**Étapes** :
1. GitHub repository public
2. Structure JSON standardisée
3. Contributions communautaires
4. GitHub Pages pour hosting statique
5. API REST optionnelle

**Effort** : ⭐⭐⭐⭐⭐ (Très important)
**ROI** : ⭐⭐⭐⭐⭐ (Excellent à long terme)

---

## 📝 Structure de données proposée

### Format JSON pour Carddass

```json
{
  "carddass": {
    "series": "Dragon Ball Z",
    "part": 3,
    "year": 1991,
    "manufacturer": "Bandai",
    "total_cards": 60,
    "cards": [
      {
        "id": "DBZ-003-001",
        "number": "001",
        "part": 3,
        "name": {
          "ja": "孫悟空",
          "romaji": "Son Goku",
          "en": "Son Goku",
          "fr": "Son Goku"
        },
        "character": "Son Goku",
        "saga": "Saiyan Saga",
        "type": "Normal",
        "rarity": "Normal",
        "special": false,
        "prism": false,
        "foil": false,
        "images": {
          "front": "url",
          "back": "url",
          "scan_high": "url"
        },
        "estimated_value": {
          "currency": "EUR",
          "low": 1.00,
          "mid": 3.00,
          "high": 10.00
        }
      },
      {
        "id": "DBZ-003-006",
        "number": "006",
        "part": 3,
        "name": {
          "ja": "孫悟空 スーパーサイヤ人",
          "romaji": "Son Goku Super Saiyan",
          "en": "Son Goku Super Saiyan",
          "fr": "Son Goku Super Saïyen"
        },
        "character": "Son Goku",
        "saga": "Frieza Saga",
        "type": "Prism",
        "rarity": "Rare",
        "special": true,
        "prism": true,
        "foil": false,
        "images": {
          "front": "url",
          "back": "url"
        },
        "estimated_value": {
          "currency": "EUR",
          "low": 15.00,
          "mid": 35.00,
          "high": 80.00
        }
      }
    ]
  },
  "metadata": {
    "version": "1.0.0",
    "last_updated": "2026-01-01",
    "source": "Community aggregation",
    "completeness": 0.75
  }
}
```

---

## 🚀 Recommandation FINALE

### Pour l'implémentation immédiate dans toys_api :

**❌ NE PAS implémenter Carddass maintenant**

**Raisons** :
1. **Pas de source de données fiable** (contrairement à One Piece TCG avec onepiece-cardgame.dev)
2. **Effort/bénéfice défavorable** : Scraping complexe pour données incomplètes
3. **Maintenance lourde** : Données manuelles à jour
4. **Prioriser les TCG modernes** : Pokémon, MTG, Yu-Gi-Oh!, Lorcana, Digimon ont tous des APIs

### Approche recommandée :

**Phase 1 : TCG modernes avec APIs** (Priorité ✅)
- Pokémon TCG
- Magic MTG
- Yu-Gi-Oh!
- Disney Lorcana
- Digimon
- One Piece ✅ (FAIT)

**Phase 2 : Recherche approfondie Carddass** (3-6 mois)
- Scanner catalogues vintage physiques
- Contacter collectionneurs r/Bandai_Carddass
- Créer checklist Excel/Google Sheets collaborative

**Phase 3 : Projet carddass-json.org** (Long terme)
- Si intérêt communautaire
- Structure JSON publique
- API REST auto-hébergée

---

## 🔗 Ressources Utiles

### Communautés
- r/Bandai_Carddass : https://www.reddit.com/r/Bandai_Carddass/
- r/dbz : https://www.reddit.com/r/dbz/
- r/sailormoon : https://www.reddit.com/r/sailormoon/

### Wikis
- Dragon Ball Carddass : https://dragonball.fandom.com/wiki/Dragon_Ball_Carddass

### Marketplaces (pour prix de référence)
- Cardmarket : https://www.cardmarket.com/
- eBay : https://www.ebay.com/ (search "vintage carddass")
- Yahoo! Auctions Japan : https://auctions.yahoo.co.jp/ (nécessite proxy)

### Portail Bandai
- Site officiel Carddass : https://sec.carddass.com/club/
- Bandai Card Games : https://www.carddass.com/bcg/jp/

---

## 📊 Comparaison One Piece TCG vs Carddass

| Critère | One Piece TCG | Carddass Vintage |
|---------|---------------|------------------|
| **API JSON communautaire** | ✅ onepiece-cardgame.dev | ❌ N'existe pas |
| **Nombre de cartes** | 1719 (actuel) | ~5000+ (toutes séries) |
| **Structure données** | ✅ JSON complet | ❌ Dispersé |
| **Images** | ✅ HD disponibles | ⚠️ Scans variables |
| **Metadata** | ✅ Complet | ⚠️ Partiel |
| **Mise à jour** | ✅ Auto (nouveaux sets) | ❌ Manuel |
| **Effort implémentation** | ⭐ Facile | ⭐⭐⭐⭐⭐ Très difficile |
| **ROI pour toys_api** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐ Faible |

---

*Document généré le 1er janvier 2026 - Conclusion : Attendre une source de données structurée avant d'implémenter Carddass*
