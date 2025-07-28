#!/bin/bash

# ClickHouse Automated Backup Script
# Создает ежедневные бэкапы с ротацией (хранит последние 7 дней)

set -e

# Configuration
BACKUP_DIR="/app/backups/clickhouse"
CONTAINER_NAME="crm-clickhouse"
DB_NAME="crm_analytics"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="clickhouse_${DB_NAME}_${TIMESTAMP}.tar.gz"
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

log "Starting ClickHouse backup process..."

# Check if container is running
if ! docker ps --format "table {{.Names}}" | grep -q "${CONTAINER_NAME}"; then
    error "ClickHouse container '${CONTAINER_NAME}' is not running"
    exit 1
fi

# Get list of tables to backup
log "Getting list of tables in database '${DB_NAME}'..."
TABLES=$(docker exec "${CONTAINER_NAME}" clickhouse-client --query "SHOW TABLES FROM ${DB_NAME}" 2>/dev/null || echo "")

if [ -z "${TABLES}" ]; then
    warn "No tables found in database '${DB_NAME}' or database doesn't exist"
    TABLES=""
fi

# Create backup directory for this backup
BACKUP_WORK_DIR="${BACKUP_DIR}/tmp_${TIMESTAMP}"
mkdir -p "${BACKUP_WORK_DIR}"

log "Creating ClickHouse backup: ${BACKUP_FILE}"

# Backup database schema
log "Backing up database schema..."
docker exec "${CONTAINER_NAME}" clickhouse-client --query "SHOW CREATE DATABASE ${DB_NAME}" > "${BACKUP_WORK_DIR}/schema.sql" 2>/dev/null || echo "-- Database ${DB_NAME} schema" > "${BACKUP_WORK_DIR}/schema.sql"

# Backup each table
if [ -n "${TABLES}" ]; then
    echo "${TABLES}" | while read -r table; do
        if [ -n "${table}" ]; then
            log "Backing up table: ${table}"
            
            # Table schema
            docker exec "${CONTAINER_NAME}" clickhouse-client --query "SHOW CREATE TABLE ${DB_NAME}.${table}" > "${BACKUP_WORK_DIR}/${table}_schema.sql"
            
            # Table data
            docker exec "${CONTAINER_NAME}" clickhouse-client --query "SELECT * FROM ${DB_NAME}.${table} FORMAT TabSeparated" > "${BACKUP_WORK_DIR}/${table}_data.tsv" 2>/dev/null || touch "${BACKUP_WORK_DIR}/${table}_data.tsv"
            
            # Table row count
            ROW_COUNT=$(docker exec "${CONTAINER_NAME}" clickhouse-client --query "SELECT COUNT(*) FROM ${DB_NAME}.${table}" 2>/dev/null || echo "0")
            echo "Rows: ${ROW_COUNT}" > "${BACKUP_WORK_DIR}/${table}_info.txt"
        fi
    done
else
    log "No tables to backup"
fi

# Create restore script
cat > "${BACKUP_WORK_DIR}/restore.sh" << 'EOF'
#!/bin/bash
# ClickHouse Restore Script
# Usage: ./restore.sh [container_name] [database_name]

CONTAINER_NAME=${1:-"crm-clickhouse"}
DB_NAME=${2:-"crm_analytics"}

echo "Restoring ClickHouse database: ${DB_NAME}"

# Create database
echo "Creating database..."
docker exec "${CONTAINER_NAME}" clickhouse-client --query "$(cat schema.sql)" || echo "Database might already exist"

# Restore tables
for schema_file in *_schema.sql; do
    if [ -f "${schema_file}" ]; then
        table_name=$(basename "${schema_file}" _schema.sql)
        echo "Restoring table: ${table_name}"
        
        # Create table
        docker exec "${CONTAINER_NAME}" clickhouse-client --query "$(cat ${schema_file})" || echo "Table ${table_name} might already exist"
        
        # Insert data if exists
        if [ -s "${table_name}_data.tsv" ]; then
            echo "Inserting data into ${table_name}..."
            docker exec -i "${CONTAINER_NAME}" clickhouse-client --query "INSERT INTO ${DB_NAME}.${table_name} FORMAT TabSeparated" < "${table_name}_data.tsv"
        fi
    fi
done

echo "Restore completed!"
EOF

chmod +x "${BACKUP_WORK_DIR}/restore.sh"

# Create backup archive
log "Creating compressed backup archive..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_FILE}" -C "tmp_${TIMESTAMP}" .

# Remove temporary directory
rm -rf "${BACKUP_WORK_DIR}"

if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    log "Backup created successfully: ${BACKUP_DIR}/${BACKUP_FILE}"
    
    # Get backup size
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    log "Backup size: ${BACKUP_SIZE}"
    
    # Verify backup archive
    log "Verifying backup archive integrity..."
    if tar -tzf "${BACKUP_DIR}/${BACKUP_FILE}" > /dev/null; then
        log "Backup archive integrity verified successfully"
    else
        error "Backup archive integrity check failed"
        exit 1
    fi
else
    error "Failed to create backup archive"
    exit 1
fi

# Cleanup old backups (keep last 7 days)
log "Cleaning up old backups (keeping last ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "clickhouse_${DB_NAME}_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

# List current backups
log "Current backups:"
ls -lah "${BACKUP_DIR}/" | grep "clickhouse_${DB_NAME}_" || echo "No previous backups found"

# Create backup metadata
cat > "${BACKUP_DIR}/${BACKUP_FILE}.meta" << EOF
{
  "backup_date": "$(date -Iseconds)",
  "database": "${DB_NAME}",
  "container": "${CONTAINER_NAME}",
  "size": "${BACKUP_SIZE}",
  "retention_days": ${RETENTION_DAYS},
  "backup_type": "full",
  "compression": "gzip",
  "tables": [$(echo "${TABLES}" | tr '\n' ',' | sed 's/,$//' | sed 's/^,//' | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/' || echo '')]
}
EOF

log "ClickHouse backup completed successfully!"

# Send notification (webhook example)
if [ -n "${BACKUP_WEBHOOK_URL}" ]; then
    curl -X POST "${BACKUP_WEBHOOK_URL}" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"ClickHouse backup completed: ${BACKUP_FILE}\", \"status\": \"success\", \"size\": \"${BACKUP_SIZE}\"}" \
        > /dev/null 2>&1 || warn "Failed to send webhook notification"
fi

exit 0