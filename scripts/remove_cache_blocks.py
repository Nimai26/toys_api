#!/usr/bin/env python3
"""
Script pour supprimer automatiquement les blocs de cache in-memory redondants
"""
import re
import os

PROVIDERS_DIR = "/NAS/Data/Mes Images Docker/toys_api/lib/providers"

PROVIDERS = [
    "lego.js", "igdb.js", "jvc.js", "tmdb.js", "rebrickable.js",
    "bgg-scraper.js", "googlebooks.js", "openlibrary.js",
    "transformerland.js", "coleka.js", "mangadex.js",
    "luluberlu.js", "jikan.js"
]

def remove_cache_blocks(content):
    """Supprime les blocs getCached et setCache"""
    
    # Pattern 1: Bloc getCached simple
    # const cached = getCached(cacheKey);
    # if (cached) return cached;
    pattern1 = re.compile(
        r'^\s*const cached = getCached\([^)]+\);\s*\n\s*if \(cached\) return cached;\s*\n',
        re.MULTILINE
    )
    
    # Pattern 2: Bloc getCached avec accolades
    # const cached = getCached(cacheKey);
    # if (cached) {
    #   return cached;
    # }
    pattern2 = re.compile(
        r'^\s*const cached = getCached\([^)]+\);\s*\n\s*if \(cached\) \{\s*\n\s*return cached;\s*\n\s*\}\s*\n',
        re.MULTILINE
    )
    
    # Pattern 3: setCache simple
    # setCache(cacheKey, result);
    pattern3 = re.compile(
        r'^\s*setCache\([^;]+\);\s*\n',
        re.MULTILINE
    )
    
    # Pattern 4: setCache avec TTL
    # setCache(cacheKey, result, 3600);
    pattern4 = re.compile(
        r'^\s*setCache\([^;]+,\s*\d+\);\s*\n',
        re.MULTILINE
    )
    
    # Appliquer les patterns
    content = pattern1.sub('', content)
    content = pattern2.sub('', content)
    content = pattern3.sub('', content)
    content = pattern4.sub('', content)
    
    # Supprimer les variables cacheKey inutilisées
    # const cacheKey = `...`;
    # (seulement si suivie directement d'un log.debug ou try)
    pattern_unused_key = re.compile(
        r'^\s*const cacheKey = [^;]+;\s*\n(?=\s*(log\.|try))',
        re.MULTILINE
    )
    content = pattern_unused_key.sub('', content)
    
    return content

def main():
    total_changes = 0
    
    for filename in PROVIDERS:
        filepath = os.path.join(PROVIDERS_DIR, filename)
        
        if not os.path.exists(filepath):
            print(f"⏭️  {filename} - Fichier introuvable")
            continue
        
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()
        
        modified = remove_cache_blocks(original)
        
        if original != modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(modified)
            
            changes = original.count('getCached') + original.count('setCache')
            remaining = modified.count('getCached') + modified.count('setCache')
            removed = changes - remaining
            
            total_changes += removed
            print(f"✅ {filename} - {removed} blocs de cache supprimés")
        else:
            print(f"⏭️  {filename} - Aucun changement")
    
    print(f"\n🎉 Total: {total_changes} blocs de cache supprimés dans {len(PROVIDERS)} fichiers")

if __name__ == "__main__":
    main()
