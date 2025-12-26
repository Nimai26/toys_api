#!/bin/bash
# sync-env.sh - Synchronise le .env depuis Docker_Compose
# Usage: ./scripts/sync-env.sh

SOURCE="/Docker_Compose/.env"
TARGET="$(dirname "$0")/../.env"

if [ -f "$SOURCE" ]; then
    cp "$SOURCE" "$TARGET"
    echo "✅ .env synchronisé depuis $SOURCE"
else
    echo "❌ Source introuvable: $SOURCE"
    exit 1
fi
