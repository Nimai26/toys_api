# 🖼️ Proxy d'images TCG - Documentation

> **Version** : 1.0.0  
> **Date** : 3 janvier 2026  
> **Endpoint** : `/proxy/image`  

---

## 📋 Vue d'ensemble

Le proxy d'images permet de contourner les restrictions CORS imposées par les CDN d'images TCG (One Piece, Yu-Gi-Oh, Lorcana, etc.). Il télécharge les images côté serveur et les renvoie avec les headers CORS appropriés.

### Problème résolu

Les images TCG sont hébergées sur des CDN qui ne définissent pas `Access-Control-Allow-Origin`, empêchant leur téléchargement direct depuis un navigateur :

```javascript
// ❌ BLOQUÉ PAR CORS
fetch("https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg")
// Error: No 'Access-Control-Allow-Origin' header

// ✅ FONCTIONNE VIA PROXY
fetch("http://10.110.1.1:3000/proxy/image?url=https%3A%2F%2Fonepiece-cardgame.dev%2F...")
// Success!
```

---

## 🚀 Utilisation

### Endpoint principal

```
GET /proxy/image?url={IMAGE_URL}&maxAge={SECONDS}
```

#### Paramètres

| Paramètre | Type | Requis | Défaut | Description |
|-----------|------|--------|--------|-------------|
| `url` | string | ✅ Oui | - | URL complète de l'image à proxier (encodée) |
| `maxAge` | number | ❌ Non | 86400 | Durée du cache en secondes (24h par défaut) |

#### Exemple

```bash
# URL originale (bloquée par CORS)
https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg

# URL via proxy (CORS activé)
http://10.110.1.1:3000/proxy/image?url=https%3A%2F%2Fonepiece-cardgame.dev%2Fimages%2Fcards%2FST01-007_dec1fa_jp.jpg

# Avec cache personnalisé (1h)
http://10.110.1.1:3000/proxy/image?url=...&maxAge=3600
```

### Intégration automatique dans l'API

Les endpoints TCG retournent désormais **deux URLs** pour chaque image :

```json
{
  "images": [
    {
      "type": "full",
      "url": "https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg",
      "proxied": "/proxy/image?url=https%3A%2F%2Fonepiece-cardgame.dev%2Fimages%2Fcards%2FST01-007_dec1fa_jp.jpg"
    }
  ]
}
```

**Côté client** : Utilisez `proxied` en priorité, avec `url` en fallback.

---

## 🔒 Sécurité

### Whitelist des domaines

Seuls les domaines TCG autorisés peuvent être proxiés :

| TCG | Domaine |
|-----|---------|
| **One Piece** | `onepiece-cardgame.dev` |
| **Lorcana** | `api.lorcana.ravensburger.com`, `lorcanajson.org` |
| **Yu-Gi-Oh** | `images.ygoprodeck.com` |
| **Magic** | `cards.scryfall.io` |
| **Pokemon** | `images.pokemontcg.io` |
| **Digimon** | `digimoncard.io`, `images.digimoncard.io` |

### Tentative de domaine non autorisé

```bash
curl "http://10.110.1.1:3000/proxy/image?url=https://example.com/test.jpg"
```

```json
{
  "error": "Domain not allowed",
  "hint": "Only TCG image domains are allowed",
  "allowedDomains": ["onepiece-cardgame.dev", "..."],
  "requestedUrl": "https://example.com/test.jpg"
}
```

**Status HTTP** : `403 Forbidden`

---

## 📊 Réponses

### Succès (200 OK)

**Headers** :
```
HTTP/1.1 200 OK
Content-Type: image/jpeg
Content-Length: 404052
Cache-Control: public, max-age=86400
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
Last-Modified: Sat, 25 Jun 2022 21:50:10 GMT
```

**Body** : Stream binaire de l'image (JPEG, PNG, WebP, etc.)

### Erreurs

#### 400 - URL manquante

```json
{
  "error": "URL parameter required",
  "hint": "Usage: /proxy/image?url=https://...",
  "example": "/proxy/image?url=https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg"
}
```

#### 403 - Domaine non autorisé

```json
{
  "error": "Domain not allowed",
  "hint": "Only TCG image domains are allowed",
  "allowedDomains": ["..."],
  "requestedUrl": "https://evil.com/hack.jpg"
}
```

#### 404 - Image introuvable

```json
{
  "error": "Image server error: 404 Not Found",
  "hint": "Image not found on remote server",
  "originalUrl": "https://onepiece-cardgame.dev/images/cards/INVALID.jpg"
}
```

#### 500 - Erreur serveur

```json
{
  "error": "Proxy error",
  "message": "fetch failed",
  "hint": "Request timeout (30s)"
}
```

---

## 🏥 Health Check

### GET /proxy/health

Vérification du statut du service proxy.

**Réponse** :
```json
{
  "success": true,
  "service": "Image Proxy",
  "allowedDomains": [
    "onepiece-cardgame.dev",
    "api.lorcana.ravensburger.com",
    "lorcanajson.org",
    "images.ygoprodeck.com",
    "cards.scryfall.io",
    "images.pokemontcg.io",
    "digimoncard.io",
    "images.digimoncard.io"
  ],
  "maxTimeout": 30000,
  "defaultCache": 86400
}
```

---

## 💡 Exemples d'utilisation

### JavaScript (Fetch API)

```javascript
// URL d'origine (bloquée par CORS)
const originalUrl = "https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg";

// Encoder l'URL
const proxiedUrl = `/proxy/image?url=${encodeURIComponent(originalUrl)}`;

// Télécharger via proxy
const response = await fetch(`http://10.110.1.1:3000${proxiedUrl}`);
const blob = await response.blob();
const imageUrl = URL.createObjectURL(blob);

// Afficher dans une <img>
document.getElementById('card').src = imageUrl;
```

### HTML (img tag)

```html
<!-- Utilisation directe dans un <img> -->
<img src="http://10.110.1.1:3000/proxy/image?url=https%3A%2F%2Fonepiece-cardgame.dev%2Fimages%2Fcards%2FST01-007_dec1fa_jp.jpg" 
     alt="Nami">
```

### Utilisation avec l'API toys_api

```javascript
// Récupérer une carte One Piece
const response = await fetch('http://10.110.1.1:3000/tcg_onepiece/card?id=ST01-007');
const card = await response.json();

// L'API retourne déjà l'URL proxiée
const imageUrl = card.data.images[0].proxied;
// "/proxy/image?url=https%3A%2F%2Fonepiece-cardgame.dev%2F..."

// Utiliser l'URL complète
const fullUrl = `http://10.110.1.1:3000${imageUrl}`;
```

### Fallback automatique

```javascript
async function getCardImage(card) {
  const image = card.data.images[0];
  
  // Tentative 1: URL proxiée (recommandé)
  if (image.proxied) {
    try {
      const response = await fetch(`http://10.110.1.1:3000${image.proxied}`);
      if (response.ok) return await response.blob();
    } catch (e) {
      console.warn('Proxy failed, trying direct:', e);
    }
  }
  
  // Tentative 2: URL directe (peut échouer avec CORS)
  const response = await fetch(image.url);
  return await response.blob();
}
```

---

## ⚡ Performances

### Cache

- **Durée par défaut** : 24 heures (86400s)
- **Personnalisable** : `?maxAge=3600` pour 1 heure
- **Headers** : `Cache-Control: public, max-age=86400`
- **Navigateur** : Les images sont mises en cache par le navigateur

### Bande passante

| Métrique | Valeur |
|----------|--------|
| Taille moyenne d'une image | 300-500 KB |
| Requêtes estimées/jour | 50-100 |
| **Bande passante/jour** | **15-50 MB** |
| **Bande passante/mois** | **450 MB - 1.5 GB** |

### Timeout

- **Délai maximum** : 30 secondes
- **Erreur** : `Request timeout (30s)` si dépassé

---

## 🔧 Configuration

### Ajouter un nouveau domaine

Modifier `/routes/proxy.js` :

```javascript
const ALLOWED_DOMAINS = [
  // Domaines existants
  'onepiece-cardgame.dev',
  'images.ygoprodeck.com',
  
  // Nouveau domaine
  'new-tcg-cdn.com',  // ✅ Ajouter ici
];
```

### Modifier le cache par défaut

```javascript
router.get('/image', async (req, res) => {
  const { url, maxAge = 172800 } = req.query; // 48h au lieu de 24h
  // ...
});
```

---

## 🐛 Dépannage

### L'image ne se charge pas

1. **Vérifier l'URL encodée** :
   ```javascript
   encodeURIComponent("https://onepiece-cardgame.dev/images/cards/ST01-007_dec1fa_jp.jpg")
   // "https%3A%2F%2Fonepiece-cardgame.dev%2Fimages%2Fcards%2FST01-007_dec1fa_jp.jpg"
   ```

2. **Tester directement** :
   ```bash
   curl -I "http://10.110.1.1:3000/proxy/image?url=..."
   ```

3. **Vérifier le domaine** :
   ```bash
   curl "http://10.110.1.1:3000/proxy/health" | jq .allowedDomains
   ```

### Erreur 403

Le domaine n'est pas dans la whitelist. Vérifier que l'URL commence par un domaine autorisé.

### Erreur 504 (Timeout)

Le serveur d'origine met plus de 30s à répondre. Cela peut indiquer :
- Serveur distant surchargé
- Connexion internet lente
- Firewall bloquant les requêtes

---

## 📚 Références

- [Code source](../routes/proxy.js)
- [Analyse complète](./IMAGE_PROXY_ANALYSIS.md)
- [BGG Proxy (similaire)](../routes/bgg_scrape.js)
- [CORS MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

*Documentation créée le 3 janvier 2026*
