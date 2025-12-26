#!/bin/bash
# toys_api v4.0.0 - Script de restauration PostgreSQL
#
# Usage: ./restore.sh [backup_file]
#
# Si aucun fichier n'est spécifié, liste les backups disponibles

set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
PG_HOST="${PG_HOST:-toys_api_postgres}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-toys_api}"
PG_DATABASE="${PG_DATABASE:-toys_api_cache}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

# Vérifier le mot de passe
if [ -z "$PG_PASSWORD" ] && [ -z "$PGPASSWORD" ]; then
    error "PG_PASSWORD ou PGPASSWORD requis"
fi

export PGPASSWORD="${PG_PASSWORD:-$PGPASSWORD}"

# Si pas d'argument, lister les backups
if [ -z "$1" ]; then
    echo "Backups disponibles dans $BACKUP_DIR:"
    echo ""
    ls -lh "$BACKUP_DIR"/toys_api_backup_*.sql.gz 2>/dev/null || echo "Aucun backup trouvé"
    echo ""
    echo "Usage: $0 <fichier_backup>"
    exit 0
fi

BACKUP_FILE="$1"

# Vérifier si le fichier existe
if [ ! -f "$BACKUP_FILE" ]; then
    # Essayer avec le chemin complet
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    else
        error "Fichier de backup non trouvé: $BACKUP_FILE"
    fi
fi

log "Restauration de: $BACKUP_FILE"
log "Base de données: $PG_DATABASE@$PG_HOST:$PG_PORT"

echo -e "${YELLOW}ATTENTION: Cette opération va écraser toutes les données existantes!${NC}"
read -p "Continuer? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Annulé."
    exit 0
fi

log "Restauration en cours..."

# Décompresser et restaurer
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -q
else
    psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -q < "$BACKUP_FILE"
fi

log "Restauration terminée avec succès!"

# Afficher les stats
log "Vérification des données..."
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -c "SELECT source, COUNT(*) as items FROM items GROUP BY source ORDER BY items DESC;"
