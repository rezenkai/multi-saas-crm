#!/bin/bash

# PostgreSQL Automated Backup Script
# Создает ежедневные бэкапы с ротацией (хранит последние 7 дней)

set -e

# Configuration
BACKUP_DIR="/app/backups/postgres"
CONTAINER_NAME="analytics-postgres-2025"
DB_NAME="salesforce_clone"
DB_USER="postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="postgres_${DB_NAME}_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=7

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

log "Starting PostgreSQL backup process..."

# Check if container is running
if ! docker ps --format "table {{.Names}}" | grep -q "${CONTAINER_NAME}"; then
    error "PostgreSQL container '${CONTAINER_NAME}' is not running"
    exit 1
fi

# Create backup
log "Creating backup: ${BACKUP_FILE}"
if docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --verbose --clean --create | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"; then
    log "Backup created successfully: ${BACKUP_DIR}/${BACKUP_FILE}"
    
    # Get backup size
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    log "Backup size: ${BACKUP_SIZE}"
    
    # Verify backup integrity
    log "Verifying backup integrity..."
    if gunzip -t "${BACKUP_DIR}/${BACKUP_FILE}"; then
        log "Backup integrity verified successfully"
    else
        error "Backup integrity check failed"
        exit 1
    fi
else
    error "Failed to create backup"
    exit 1
fi

# Cleanup old backups (keep last 7 days)
log "Cleaning up old backups (keeping last ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "postgres_${DB_NAME}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# List current backups
log "Current backups:"
ls -lah "${BACKUP_DIR}/" | grep "postgres_${DB_NAME}_"

# Create backup metadata
cat > "${BACKUP_DIR}/${BACKUP_FILE}.meta" << EOF
{
  "backup_date": "$(date -Iseconds)",
  "database": "${DB_NAME}",
  "container": "${CONTAINER_NAME}",
  "size": "${BACKUP_SIZE}",
  "retention_days": ${RETENTION_DAYS},
  "backup_type": "full",
  "compression": "gzip"
}
EOF

log "PostgreSQL backup completed successfully!"

# Send notification (webhook example)
if [ -n "${BACKUP_WEBHOOK_URL}" ]; then
    curl -X POST "${BACKUP_WEBHOOK_URL}" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"PostgreSQL backup completed: ${BACKUP_FILE}\", \"status\": \"success\", \"size\": \"${BACKUP_SIZE}\"}" \
        > /dev/null 2>&1 || warn "Failed to send webhook notification"
fi

exit 0