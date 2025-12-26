#!/bin/bash
# toys_api v4.0.0 - Script de backup PostgreSQL
# 
# Usage: ./backup.sh [options]
# Options:
#   -o, --output DIR    Répertoire de sortie (défaut: /backups)
#   -k, --keep N        Nombre de backups à conserver (défaut: 7)
#   -q, --quiet         Mode silencieux
#   -h, --help          Afficher l'aide
#
# Variables d'environnement:
#   PG_HOST             Hôte PostgreSQL (défaut: toys_api_postgres)
#   PG_PORT             Port PostgreSQL (défaut: 5432)
#   PG_USER             Utilisateur PostgreSQL (défaut: toys_api)
#   PG_PASSWORD         Mot de passe PostgreSQL (requis ou PGPASSWORD)
#   PG_DATABASE         Nom de la base (défaut: toys_api_cache)
#   BACKUP_DIR          Répertoire de backup (défaut: /backups)

set -e

# Valeurs par défaut
BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_BACKUPS="${KEEP_BACKUPS:-7}"
PG_HOST="${PG_HOST:-toys_api_postgres}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-toys_api}"
PG_DATABASE="${PG_DATABASE:-toys_api_cache}"
QUIET=false

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    if [ "$QUIET" = false ]; then
        echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
    fi
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

show_help() {
    echo "toys_api v4.0.0 - Script de backup PostgreSQL"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -o, --output DIR    Répertoire de sortie (défaut: $BACKUP_DIR)"
    echo "  -k, --keep N        Nombre de backups à conserver (défaut: $KEEP_BACKUPS)"
    echo "  -q, --quiet         Mode silencieux"
    echo "  -h, --help          Afficher l'aide"
    echo ""
    echo "Variables d'environnement:"
    echo "  PG_HOST             Hôte PostgreSQL (défaut: toys_api_postgres)"
    echo "  PG_PORT             Port PostgreSQL (défaut: 5432)"
    echo "  PG_USER             Utilisateur PostgreSQL (défaut: toys_api)"
    echo "  PG_PASSWORD         Mot de passe PostgreSQL"
    echo "  PG_DATABASE         Nom de la base (défaut: toys_api_cache)"
    exit 0
}

# Parser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -o|--output)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -k|--keep)
            KEEP_BACKUPS="$2"
            shift 2
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            error "Option inconnue: $1"
            ;;
    esac
done

# Vérifier le mot de passe
if [ -z "$PG_PASSWORD" ] && [ -z "$PGPASSWORD" ]; then
    error "PG_PASSWORD ou PGPASSWORD requis"
fi

# Exporter pour pg_dump
export PGPASSWORD="${PG_PASSWORD:-$PGPASSWORD}"

# Créer le répertoire si nécessaire
mkdir -p "$BACKUP_DIR"

# Nom du fichier de backup
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/toys_api_backup_${TIMESTAMP}.sql.gz"

log "Démarrage du backup de $PG_DATABASE..."
log "Host: $PG_HOST:$PG_PORT, User: $PG_USER"

# Effectuer le backup
if pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists | gzip > "$BACKUP_FILE"; then
    
    # Vérifier la taille
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "Backup créé: $BACKUP_FILE ($BACKUP_SIZE)"
    
    # Rotation des anciens backups
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/toys_api_backup_*.sql.gz 2>/dev/null | wc -l)
    if [ "$BACKUP_COUNT" -gt "$KEEP_BACKUPS" ]; then
        DELETE_COUNT=$((BACKUP_COUNT - KEEP_BACKUPS))
        log "Suppression de $DELETE_COUNT ancien(s) backup(s)..."
        ls -1t "$BACKUP_DIR"/toys_api_backup_*.sql.gz | tail -n "$DELETE_COUNT" | xargs rm -f
    fi
    
    log "Backup terminé avec succès!"
    
    # Afficher les stats
    if [ "$QUIET" = false ]; then
        echo ""
        echo "=== Backups disponibles ==="
        ls -lh "$BACKUP_DIR"/toys_api_backup_*.sql.gz 2>/dev/null | awk '{print $9, $5}'
        echo ""
    fi
else
    rm -f "$BACKUP_FILE"
    error "Échec du backup"
fi
