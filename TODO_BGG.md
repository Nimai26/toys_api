# TODO - Implémentation Provider BoardGameGeek

## 📋 Tâches

### 1. Configuration de base
- [x] Ajouter les constantes BGG dans config
- [x] Créer le fichier provider `/lib/providers/bgg.js`
- [x] Créer les routes `/routes/bgg.js`
- [x] Enregistrer les routes dans `index.js`

### 2. Authentification BGG (NOUVEAU - Juillet 2025)
- [x] Supporter le token Bearer BGG
- [x] Variable d'env `TEST_BGG_TOKEN` pour tests/healthcheck
- [x] Token crypté via `X-Encrypted-Key` pour production
- [ ] ⏳ **EN ATTENTE** : Obtenir le token BGG (inscription en cours)
- [ ] Tester avec le token une fois reçu

### 3. Fonctions du Provider BGG
- [x] `searchBGGGames(query, token, options)` - Recherche via XML API
- [x] `getBGGGameDetails(id, token, options)` - Détails avec traduction auto_trad
- [x] `getBGGGameFiles(id)` - Liste des fichiers (scraping, sans token)
- [x] `getBGGManual(id, lang)` - Récupère le meilleur manuel (sans token)

### 4. Parsing XML BGG
- [x] Parser XML pour search results
- [x] Parser XML pour thing details
- [x] Extraire descriptions et les traduire si nécessaire

### 5. Scraping Files BGG
- [x] Scraper la page `/boardgame/{id}/files` via FlareSolverr
- [x] Détecter la langue des fichiers (titre, tags)
- [x] Filtrer les fichiers "rules" / "règles"
- [x] Sélectionner le meilleur fichier selon la langue

### 6. Routes API
- [x] `GET /bgg/search?q=&lang=` - Recherche (nécessite token)
- [x] `GET /bgg/details/:id?lang=` - Détails traduits (nécessite token)
- [x] `GET /bgg/files/:id` - Liste fichiers (sans token, scraping)
- [x] `GET /bgg/manual/:id?lang=` - Manuel unique (sans token, scraping)

### 7. Monitoring
- [x] Ajouter test BGG dans healthcheck.js
- [x] Ajouter `bgg` dans testKeys de monitoring.js

### 8. Tests et Documentation
- [ ] ⏳ Tester recherche (en attente token)
- [ ] ⏳ Tester détails avec traduction (en attente token)
- [ ] Tester récupération fichiers/manuel (scraping)
- [ ] Mettre à jour README

---

## 📊 Progression

| Étape | Status | Notes |
|-------|--------|-------|
| Config | ✅ Terminé | Constantes dans config.js |
| Provider | ✅ Terminé | bgg.js créé avec support token |
| Routes | ✅ Terminé | bgg.js avec auth middleware |
| Monitoring | ✅ Terminé | Test BGG ajouté |
| Token BGG | ⏳ **EN ATTENTE** | Inscription en cours |
| Tests | ⏳ En attente | Dépend du token |

---

## 🔧 Notes Techniques

### Authentification BGG (OBLIGATOIRE depuis Juillet 2025)
- **Inscription** : https://boardgamegeek.com/applications
- **Header** : `Authorization: Bearer {token}`
- **Délai approbation** : ~1 semaine
- **Domaine** : `boardgamegeek.com` (sans www)

### Configuration
```env
# Pour tests et healthcheck uniquement
TEST_BGG_TOKEN=votre-token-ici
```

### API BGG XML
- Base URL: `https://boardgamegeek.com/xmlapi2/`
- Rate limit: 1 seconde entre requêtes (recommandé 5s)
- Endpoints:
  - `/search?query={q}&type=boardgame`
  - `/thing?id={id}&stats=1`

### Scraping Files (SANS TOKEN)
- URL: `https://boardgamegeek.com/boardgame/{id}/files`
- Nécessite FlareSolverr (Cloudflare)
- Fichiers stockés sur S3 Amazon
- Ne nécessite PAS de token BGG

### Détection Langue Fichiers
- Analyser le titre du fichier
- Chercher tags de langue (English, French, Français, etc.)
- Patterns: `_fr`, `_en`, `french`, `règles`, `rules`

### auto_trad Integration
- URL: `http://auto_trad:3255/translate`
- Body: `{ "text": "...", "source": "en", "target": "fr" }`
