#!/bin/bash
# Script pour supprimer les lignes de cache in-memory redondantes

PROVIDERS=(
  "lego.js"
  "igdb.js"
  "jvc.js"
  "tmdb.js"
  "rebrickable.js"
  "bgg-scraper.js"
  "googlebooks.js"
  "openlibrary.js"
  "transformerland.js"
  "coleka.js"
  "mangadex.js"
  "luluberlu.js"
  "jikan.js"
)

cd /NAS/Data/Mes\ Images\ Docker/toys_api/lib/providers

for file in "${PROVIDERS[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    
    # Backup
    cp "$file" "${file}.backup"
    
    # Supprimer getCached et setCache des imports (garder metrics)
    sed -i 's/import { getCached, setCache, metrics }/import { metrics }/' "$file"
    sed -i 's/import { getCached, setCache }//' "$file"
    sed -i '/^import { getCached, setCache }/d' "$file"
    
    # Supprimer les lignes vides d'import
    sed -i '/^import {  } from/d' "$file"
    
    echo "  ✓ Imports nettoyés"
  fi
done

echo "✅ Imports nettoyés dans ${#PROVIDERS[@]} fichiers"
echo "⚠️  Attention : Les blocs getCached/setCache doivent être supprimés manuellement"
