# 🖼️ Analyse - Proxy d'images pour contourner CORS

> **Date** : 3 janvier 2026  
> **Contexte** : Application SnowShelf ne peut pas télécharger les images One Piece TCG  
> **Problème** : CORS bloqué par onepiece-cardgame.dev  

---

## 📊 Diagnostic du problème

### Erreurs constatées

```
POST https://snowshelf.fr/api/proxy-download.php 502 (Bad Gateway)
→ Le proxy actuel de SnowShelf échoue

Access to fetch at 'https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg' 
from origin 'https://snowshelf.fr' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
→ Téléchargement direct bloqué par CORS

Aucune image n'a pu être importée (source protégée contre le hotlinking)
→ Échec complet du téléchargement
```

### Tests effectués

1. **Test direct depuis le serveur** ✅
   ```bash
   curl -s -o /tmp/test.jpg "https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg"
   # Résultat: JPEG image data, 395K - SUCCÈS
   ```

2. **Vérification des headers HTTP** ✅
   ```bash
   curl -I "https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg"
   # HTTP/2 200 OK
   # Content-Type: image/jpeg
   # Content-Length: 404052
   # AUCUN header Access-Control-Allow-Origin
   ```

3. **Test wsrv.nl (service de proxy public)** ❌
   ```bash
   curl -I "https://wsrv.nl/?url=https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg"
   # HTTP/2 404 - ÉCHEC
   ```

### Conclusion

- ✅ Les images sont **publiques et accessibles** depuis le serveur
- ❌ Les images sont **bloquées par CORS** côté navigateur
- ❌ Le domaine onepiece-cardgame.dev **ne définit pas** `Access-Control-Allow-Origin`
- ✅ Un proxy côté serveur **résoudrait le problème**

---

## 🔧 Solutions possibles

### Solution 1 : Endpoint Proxy dans toys_api (RECOMMANDÉ) ⭐

**Principe** : Créer un endpoint `/proxy-image` dans toys_api qui télécharge et renvoie l'image

**Avantages** :
- ✅ Solution complète et contrôlée
- ✅ Fonctionne pour TOUTES les sources TCG (One Piece, Lorcana, etc.)
- ✅ Peut ajouter du caching (réduire la bande passante)
- ✅ Headers CORS configurables
- ✅ Support de multiples domaines via whitelist
- ✅ Déjà implémenté pour BGG (code réutilisable)

**Inconvénients** :
- ⚠️ Charge serveur supplémentaire (bande passante)
- ⚠️ Nécessite maintenance de la whitelist

**Implémentation** :

```javascript
// routes/proxy.js
import express from 'express';
const router = express.Router();

// Whitelist des domaines autorisés
const ALLOWED_DOMAINS = [
  'onepiece-cardgame.dev',
  'api.lorcana.ravensburger.com',
  'images.ygoprodeck.com',
  'cards.scryfall.io',
  'images.pokemontcg.io'
];

router.get('/image', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }
  
  // Validation du domaine
  const parsedUrl = new URL(url);
  if (!ALLOWED_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ToysAPI/4.0 Image Proxy',
        'Referer': parsedUrl.origin
      },
      signal: AbortSignal.timeout(30000)
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Image server returned ${response.status}` 
      });
    }
    
    // Copier headers pertinents
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    
    // CORS ouvert pour SnowShelf
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24h
    
    // Stream l'image
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**Utilisation côté SnowShelf** :
```javascript
// Au lieu de:
const imageUrl = "https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg";

// Utiliser:
const imageUrl = "http://10.110.1.1:3000/proxy/image?url=" + 
                 encodeURIComponent("https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg");
```

**Modification de l'API One Piece** :
```javascript
// lib/normalizers/tcg.js - normalizeOnePieceCard()
const images = [
  {
    type: 'full',
    url: rawCard.iu || null,
    proxied: rawCard.iu ? `/proxy/image?url=${encodeURIComponent(rawCard.iu)}` : null
  }
];
```

---

### Solution 2 : Modifier les réponses API pour inclure des URLs proxiées

**Principe** : Ajouter un champ `proxiedUrl` dans toutes les réponses d'images

**Avantages** :
- ✅ Transparent pour l'application cliente
- ✅ Fallback automatique (URL originale + URL proxiée)
- ✅ Pas de modification côté SnowShelf

**Inconvénients** :
- ⚠️ Nécessite modification de tous les normalizers TCG
- ⚠️ Augmente légèrement la taille des réponses JSON

**Exemple de réponse modifiée** :
```json
{
  "images": [
    {
      "type": "full",
      "url": "https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg",
      "proxied": "http://10.110.1.1:3000/proxy/image?url=https%3A%2F%2Fonepiece-cardgame.dev%2Fimages%2Fcards%2FST01-007_dec1fa_jp.jpg"
    }
  ]
}
```

---

### Solution 3 : Service de cache d'images externe

**Principe** : Utiliser un service tiers comme Cloudflare Images, Imgix, ou Cloudinary

**Avantages** :
- ✅ Pas de charge sur toys_api
- ✅ CDN mondial (performances)
- ✅ Optimisation automatique (resize, format)

**Inconvénients** :
- ❌ Coût mensuel (généralement payant)
- ❌ Dépendance à un service tiers
- ❌ Configuration complexe

**Non recommandé** pour un usage privé/personnel.

---

### Solution 4 : Hébergement local des images

**Principe** : Télécharger et stocker toutes les images TCG localement

**Avantages** :
- ✅ Contrôle total
- ✅ Pas de problèmes CORS
- ✅ Vitesse maximale (réseau local)

**Inconvénients** :
- ❌ Espace disque important (plusieurs Go)
- ❌ Maintenance manuelle des mises à jour
- ❌ Synchronisation complexe
- ❌ Possibles problèmes de droits d'auteur

**Estimation de l'espace** :
- One Piece: 1719 cartes × 400KB = ~687 MB
- Lorcana: 2455 cartes × 300KB = ~736 MB
- Yu-Gi-Oh: ~12000 cartes × 50KB = ~600 MB
- Pokemon: ~20000 cartes × 200KB = ~4 GB
- **Total estimé** : ~6-8 GB

**Non recommandé** sauf si besoin de disponibilité offline.

---

### Solution 5 : Modification côté SnowShelf uniquement

**Principe** : Modifier le proxy-download.php de SnowShelf pour mieux gérer les images

**Avantages** :
- ✅ Pas de modification de toys_api
- ✅ Solution centralisée côté client

**Inconvénients** :
- ❌ Le proxy actuel retourne déjà 502 (problème serveur SnowShelf)
- ❌ Nécessite accès au code PHP de SnowShelf
- ❌ Ne résout pas le problème pour d'autres clients potentiels

**Non recommandé** si toys_api doit servir d'autres applications.

---

## 🏆 Recommandation finale

### Solution choisie : **Solution 1 - Endpoint Proxy dans toys_api** ⭐

**Pourquoi ?**
1. ✅ **Réutilisable** : Code similaire existe déjà pour BGG ([bgg_scrape.js](../routes/bgg_scrape.js))
2. ✅ **Flexible** : Fonctionne pour tous les TCG
3. ✅ **Performant** : Possibilité de caching côté serveur
4. ✅ **Transparent** : Compatible avec l'architecture actuelle
5. ✅ **Évolutif** : Peut ajouter compression, resize, etc.

### Implémentation proposée

#### Étape 1 : Créer `/routes/proxy.js`
- Endpoint `GET /proxy/image?url=...`
- Whitelist des domaines TCG autorisés
- Streaming de l'image avec headers CORS
- Cache 24h

#### Étape 2 : Modifier les normalizers TCG
- Ajouter champ `proxied` dans les objets images
- Format: `/proxy/image?url=${encodeURIComponent(originalUrl)}`
- Appliquer à :
  - `normalizeOnePieceCard()` ✅ Prioritaire
  - `normalizeLorcanaCard()`
  - `normalizeYugiohCard()`
  - `normalizeMtgCard()`
  - `normalizePokemonCard()`

#### Étape 3 : Tester avec SnowShelf
- Vérifier que `proxied` est utilisé en fallback
- Valider le téléchargement des images
- Mesurer l'impact sur les performances

#### Étape 4 : Documentation
- Ajouter endpoint à la doc API
- Exemples d'utilisation
- Liste des domaines autorisés

---

## 📝 Exemple de code complet

### Route proxy complète (basée sur bgg_scrape.js)

```javascript
// routes/proxy.js
import express from 'express';
import { createLogger } from '../lib/utils/logger.js';

const router = express.Router();
const log = createLogger('Proxy');

// Whitelist des domaines TCG autorisés
const ALLOWED_DOMAINS = [
  // One Piece
  'onepiece-cardgame.dev',
  
  // Lorcana
  'api.lorcana.ravensburger.com',
  'lorcanajson.org',
  
  // Yu-Gi-Oh
  'images.ygoprodeck.com',
  
  // Magic
  'cards.scryfall.io',
  
  // Pokemon
  'images.pokemontcg.io',
  
  // Digimon
  'digimoncard.io',
  'images.digimoncard.io'
];

// Headers à utiliser pour les requêtes
const PROXY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

/**
 * Vérifie si une URL est autorisée
 */
function isUrlAllowed(url) {
  try {
    const parsedUrl = new URL(url);
    return ALLOWED_DOMAINS.some(domain => 
      parsedUrl.hostname === domain || 
      parsedUrl.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * GET /proxy/image
 * Proxy pour les images TCG (contourne CORS)
 * 
 * @query {string} url - URL de l'image à proxier
 * @query {number} maxAge - Cache-Control max-age (défaut: 86400 = 24h)
 */
router.get('/image', async (req, res) => {
  try {
    const { url, maxAge = 86400 } = req.query;
    
    if (!url) {
      return res.status(400).json({
        error: 'URL parameter required',
        hint: 'Usage: /proxy/image?url=https://...'
      });
    }
    
    // Validation du domaine
    if (!isUrlAllowed(url)) {
      return res.status(403).json({
        error: 'Domain not allowed',
        hint: 'Only TCG image domains are allowed',
        allowedDomains: ALLOWED_DOMAINS
      });
    }
    
    log.debug(`Proxying image: ${url}`);
    
    // Télécharger l'image
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...PROXY_HEADERS,
        'Referer': new URL(url).origin
      },
      signal: AbortSignal.timeout(30000)
    });
    
    if (!response.ok) {
      log.warn(`Image server returned ${response.status} for ${url}`);
      return res.status(response.status).json({
        error: `Image server error: ${response.status} ${response.statusText}`
      });
    }
    
    // Copier headers pertinents
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const lastModified = response.headers.get('last-modified');
    const etag = response.headers.get('etag');
    
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (lastModified) res.setHeader('Last-Modified', lastModified);
    if (etag) res.setHeader('ETag', etag);
    
    // Cache et CORS
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Stream l'image vers le client
    const reader = response.body.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    
    res.end();
    log.debug(`Image proxied successfully: ${url.substring(0, 80)}...`);
    
  } catch (error) {
    log.error(`Proxy error: ${error.message}`);
    res.status(500).json({
      error: 'Proxy error',
      message: error.message
    });
  }
});

/**
 * OPTIONS /proxy/image
 * Support CORS preflight
 */
router.options('/image', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(204).end();
});

export default router;
```

### Modification du normalizer One Piece

```javascript
// lib/normalizers/tcg.js - normalizeOnePieceCard()

// AVANT:
const images = [
  {
    type: 'full',
    url: rawCard.iu || null
  }
];

// APRÈS:
const images = [
  {
    type: 'full',
    url: rawCard.iu || null,
    proxied: rawCard.iu ? `/proxy/image?url=${encodeURIComponent(rawCard.iu)}` : null
  }
];
```

### Modification côté SnowShelf (import.js)

```javascript
// AVANT:
async function importImageFromUrl(imageUrl) {
  // Tentative 1: Proxy snowshelf
  // Tentative 2: wsrv.nl
  // Tentative 3: Direct (échoue avec CORS)
}

// APRÈS:
async function importImageFromUrl(imageData) {
  // Si imageData.proxied existe, utiliser en priorité
  if (imageData.proxied) {
    const fullProxiedUrl = `http://10.110.1.1:3000${imageData.proxied}`;
    return await downloadImageDirect(fullProxiedUrl);
  }
  
  // Sinon fallback sur méthodes actuelles
  return await downloadImageDirect(imageData.url);
}
```

---

## 📊 Impact et métriques

### Bande passante estimée
- Image moyenne: 300-500 KB
- Utilisations par jour: ~50-100 imports
- **Bande passante/jour** : 15-50 MB
- **Bande passante/mois** : 450 MB - 1.5 GB

➡️ **Impact négligeable** sur un serveur domestique

### Performance
- Latence ajoutée: +100-300ms (téléchargement serveur)
- Compensé par le cache (24h)
- Requête en cache: ~10-50ms

### Évolutions possibles
1. **Cache disque** : Stocker les images téléchargées (réduire bande passante)
2. **Resize on-the-fly** : Générer des thumbnails (économiser bande passante)
3. **Compression** : WebP/AVIF (réduire taille de 30-50%)
4. **CDN** : Cloudflare en frontal (optionnel)

---

## ✅ Checklist d'implémentation

- [ ] Créer `routes/proxy.js`
- [ ] Ajouter `proxyRouter` dans `routes/index.js`
- [ ] Enregistrer route dans `index.js` principal
- [ ] Modifier `normalizeOnePieceCard()` pour ajouter `proxied`
- [ ] Modifier `normalizeOnePieceSearch()` pour ajouter `proxied`
- [ ] Tester endpoint `/proxy/image?url=...`
- [ ] Tester avec SnowShelf
- [ ] Documenter dans README.md
- [ ] Ajouter tests unitaires
- [ ] Déployer en production

---

## 🔗 Références

- [BGG Proxy existant](../routes/bgg_scrape.js) (lignes 267-550)
- [One Piece Normalizer](../lib/normalizers/tcg.js) (lignes 1162-1330)
- [CORS MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Fetch API Streaming](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams)

---

*Document créé le 3 janvier 2026*
