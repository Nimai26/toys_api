# Audit toys_api - 16 décembre 2025

## Résumé du projet

- **Version**: 1.26.0
- **Stack**: Node.js 20 + Express
- **Dépendances**: 3 (compression, express, node-fetch)
- **Fichiers JS**: 48 (hors backup)
- **Providers**: 27

## Structure actuelle

```
toys_api/
├── index.js              (475 lignes - point d'entrée)
├── package.json
├── Dockerfile
├── lib/
│   ├── index.js          (exports centralisés)
│   ├── config.js         (324 lignes - configuration)
│   ├── utils/
│   │   ├── index.js      (exports utils)
│   │   ├── logger.js     (182 lignes)
│   │   ├── state.js      (202 lignes - cache, métriques)
│   │   ├── helpers.js    (272 lignes - crypto, HTML)
│   │   └── flaresolverr.js (230 lignes)
│   └── providers/
│       ├── index.js      (exports providers)
│       └── [27 providers...]
├── routes/
│   ├── index.js          (exports routes)
│   └── [13 fichiers routes...]
└── lib/backup_original/  (anciens fichiers)
```

---

## Tâches d'amélioration

### 1. [FACILE] Supprimer node-fetch
**Problème**: Node 20 a fetch natif, node-fetch n'est plus nécessaire.
**Fichiers concernés**:
- lib/providers/deezer.js
- lib/providers/discogs.js
- lib/providers/itunes.js
- lib/providers/musicbrainz.js
- package.json

**Actions**:
- [ ] Supprimer `import fetch from 'node-fetch';` des 4 fichiers
- [ ] Supprimer node-fetch de package.json
- [ ] Tester que tout fonctionne

---

### 2. [FACILE] Factoriser cleanupFsrSession
**Problème**: Fonction identique copiée dans 5 providers.
**Fichiers concernés**:
- lib/providers/coleka.js
- lib/providers/consolevariations.js
- lib/providers/luluberlu.js
- lib/providers/paninimania.js
- lib/providers/transformerland.js
- lib/utils/flaresolverr.js (destination)

**Actions**:
- [ ] Ajouter cleanupFsrSession dans flaresolverr.js
- [ ] Exporter depuis utils/index.js
- [ ] Supprimer la fonction locale des 5 providers
- [ ] Importer depuis ../utils/flaresolverr.js

---

### 3. [FACILE] Corriger USER_AGENT dupliqué
**Problème**: USER_AGENT défini dans config.js ET amazon.js
**Fichiers concernés**:
- lib/config.js (source de vérité)
- lib/providers/amazon.js (duplication)

**Actions**:
- [ ] Importer USER_AGENT depuis ../config.js dans amazon.js
- [ ] Supprimer la définition locale

---

### 4. [MOYEN] Nettoyer helpers.js
**Problème**: Re-exports de state.js pour "rétrocompatibilité" abandonnée.
**Fichiers concernés**:
- lib/utils/helpers.js
- Tous les fichiers qui importent depuis helpers.js

**Actions**:
- [ ] Identifier les fichiers qui utilisent les re-exports
- [ ] Mettre à jour leurs imports pour pointer vers state.js directement
- [ ] Supprimer les re-exports de helpers.js

---

### 5. [FACILE] Renommer searchByBarcode dans amazon.js
**Problème**: Conflit de nom avec barcode.js
**Fichiers concernés**:
- lib/providers/amazon.js
- lib/providers/index.js

**Actions**:
- [ ] Renommer searchByBarcode -> searchAmazonByBarcode dans amazon.js
- [ ] Mettre à jour l'export dans providers/index.js

---

### 6. [OPTIONNEL] Créer asyncHandler pour les routes
**Problème**: 81 blocs try/catch répétitifs dans les routes.
**Impact**: Réduction significative du code boilerplate.

**Actions**:
- [ ] Créer lib/utils/asyncHandler.js
- [ ] Refactoriser les routes pour utiliser le wrapper
- [ ] (À faire dans un second temps si souhaité)

---

## Statistiques

| Métrique | Valeur |
|----------|--------|
| Providers | 27 |
| Routes | 13 |
| Endpoints | 39 GET, 1 POST |
| Lignes de code | ~15000 |
| Dépendances | 3 → 2 (après task 1) |

---

## Priorité recommandée

1. ✅ Task 1 - Supprimer node-fetch (risque minimal)
2. ✅ Task 3 - USER_AGENT (changement isolé)
3. ✅ Task 5 - Renommer searchByBarcode (clarification)
4. ✅ Task 2 - Factoriser cleanupFsrSession (DRY)
5. ✅ Task 4 - Nettoyer helpers.js (nettoyage)
6. ⏳ Task 6 - asyncHandler (optionnel, plus invasif)
