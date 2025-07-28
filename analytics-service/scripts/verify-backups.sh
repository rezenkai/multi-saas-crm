#!/bin/bash

# Backup Verification Script
# Проверяет целостность и валидность бэкапов

set -e

# Configuration
BACKUP_DIR="/app/backups"
LOG_FILE="/app/logs/backup-verification.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "${LOG_FILE}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "${LOG_FILE}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "${LOG_FILE}"
}

log "Starting backup verification process..."

# Verification counters
TOTAL_BACKUPS=0
VALID_BACKUPS=0
FAILED_BACKUPS=0

# Verify PostgreSQL backups
log "Verifying PostgreSQL backups..."
POSTGRES_BACKUPS=$(find "${BACKUP_DIR}/postgres" -name "postgres_*.sql.gz" -type f 2>/dev/null || echo "")

if [ -n "${POSTGRES_BACKUPS}" ]; then
    echo "${POSTGRES_BACKUPS}" | while read -r backup_file; do
        if [ -f "${backup_file}" ]; then
            TOTAL_BACKUPS=$((TOTAL_BACKUPS + 1))
            backup_name=$(basename "${backup_file}")
            
            log "Verifying: ${backup_name}"
            
            # Check file size
            file_size=$(stat -f%z "${backup_file}" 2>/dev/null || stat -c%s "${backup_file}" 2>/dev/null || echo "0")
            if [ "${file_size}" -lt 100 ]; then
                error "Backup file too small: ${backup_name} (${file_size} bytes)"
                FAILED_BACKUPS=$((FAILED_BACKUPS + 1))
                continue
            fi
            
            # Check gzip integrity
            if gunzip -t "${backup_file}" 2>/dev/null; then
                log "✓ Gzip integrity: OK for ${backup_name}"
            else
                error "✗ Gzip integrity: FAILED for ${backup_name}"
                FAILED_BACKUPS=$((FAILED_BACKUPS + 1))
                continue
            fi
            
            # Check SQL content
            if zcat "${backup_file}" | head -10 | grep -q "PostgreSQL database dump"; then
                log "✓ Content validation: OK for ${backup_name}"
                VALID_BACKUPS=$((VALID_BACKUPS + 1))
            else
                error "✗ Content validation: FAILED for ${backup_name}"
                FAILED_BACKUPS=$((FAILED_BACKUPS + 1))
            fi
        fi
    done
else
    warn "No PostgreSQL backups found"
fi

# Verify ClickHouse backups
log "Verifying ClickHouse backups..."
CLICKHOUSE_BACKUPS=$(find "${BACKUP_DIR}/clickhouse" -name "clickhouse_*.tar.gz" -type f 2>/dev/null || echo "")

if [ -n "${CLICKHOUSE_BACKUPS}" ]; then
    echo "${CLICKHOUSE_BACKUPS}" | while read -r backup_file; do
        if [ -f "${backup_file}" ]; then
            TOTAL_BACKUPS=$((TOTAL_BACKUPS + 1))
            backup_name=$(basename "${backup_file}")
            
            log "Verifying: ${backup_name}"
            
            # Check file size
            file_size=$(stat -f%z "${backup_file}" 2>/dev/null || stat -c%s "${backup_file}" 2>/dev/null || echo "0")
            if [ "${file_size}" -lt 100 ]; then
                error "Backup file too small: ${backup_name} (${file_size} bytes)"
                FAILED_BACKUPS=$((FAILED_BACKUPS + 1))
                continue
            fi
            
            # Check tar.gz integrity
            if tar -tzf "${backup_file}" > /dev/null 2>&1; then
                log "✓ Archive integrity: OK for ${backup_name}"
            else
                error "✗ Archive integrity: FAILED for ${backup_name}"
                FAILED_BACKUPS=$((FAILED_BACKUPS + 1))
                continue
            fi
            
            # Check restore script presence
            if tar -tzf "${backup_file}" | grep -q "restore.sh"; then
                log "✓ Restore script: OK for ${backup_name}"
                VALID_BACKUPS=$((VALID_BACKUPS + 1))
            else
                warn "Restore script not found in ${backup_name}"
                VALID_BACKUPS=$((VALID_BACKUPS + 1))  # Still consider valid
            fi
        fi
    done
else
    warn "No ClickHouse backups found"
fi

# Check backup metadata
log "Checking backup metadata files..."
METADATA_FILES=$(find "${BACKUP_DIR}" -name "*.meta" -type f 2>/dev/null || echo "")

if [ -n "${METADATA_FILES}" ]; then
    echo "${METADATA_FILES}" | while read -r meta_file; do
        if [ -f "${meta_file}" ]; then
            meta_name=$(basename "${meta_file}")
            
            # Validate JSON format
            if python3 -m json.tool "${meta_file}" > /dev/null 2>&1; then
                log "✓ Metadata JSON valid: ${meta_name}"
            else
                warn "✗ Metadata JSON invalid: ${meta_name}"
            fi
        fi
    done
fi

# Generate summary report
log "=== BACKUP VERIFICATION SUMMARY ==="
log "Total backups checked: ${TOTAL_BACKUPS}"
log "Valid backups: ${VALID_BACKUPS}"
log "Failed backups: ${FAILED_BACKUPS}"

if [ "${FAILED_BACKUPS}" -eq 0 ]; then
    log "✅ All backups passed verification"
    VERIFICATION_STATUS="SUCCESS"
else
    error "❌ ${FAILED_BACKUPS} backup(s) failed verification"
    VERIFICATION_STATUS="FAILED"
fi

# Check backup retention policy
log "Checking backup retention policy..."

# PostgreSQL retention
POSTGRES_COUNT=$(find "${BACKUP_DIR}/postgres" -name "postgres_*.sql.gz" -type f 2>/dev/null | wc -l || echo "0")
if [ "${POSTGRES_COUNT}" -gt 10 ]; then
    warn "PostgreSQL backup count (${POSTGRES_COUNT}) exceeds recommended retention"
fi

# ClickHouse retention
CLICKHOUSE_COUNT=$(find "${BACKUP_DIR}/clickhouse" -name "clickhouse_*.tar.gz" -type f 2>/dev/null | wc -l || echo "0")
if [ "${CLICKHOUSE_COUNT}" -gt 10 ]; then
    warn "ClickHouse backup count (${CLICKHOUSE_COUNT}) exceeds recommended retention"
fi

# Check disk space
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1 || echo "Unknown")
log "Total backup size: ${BACKUP_SIZE}"

# Send notification if configured
if [ -n "${BACKUP_WEBHOOK_URL}" ]; then
    curl -X POST "${BACKUP_WEBHOOK_URL}" \
        -H "Content-Type: application/json" \
        -d "{
            \"message\": \"Backup verification completed\",
            \"status\": \"${VERIFICATION_STATUS}\",
            \"total_backups\": ${TOTAL_BACKUPS},
            \"valid_backups\": ${VALID_BACKUPS},
            \"failed_backups\": ${FAILED_BACKUPS},
            \"backup_size\": \"${BACKUP_SIZE}\"
        }" \
        > /dev/null 2>&1 || warn "Failed to send webhook notification"
fi

log "Backup verification completed"

# Exit with error code if any backups failed
if [ "${FAILED_BACKUPS}" -gt 0 ]; then
    exit 1
fi

exit 0