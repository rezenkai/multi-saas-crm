#!/bin/bash

# Backup Service Entrypoint
set -e

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting Analytics Backup Service..."

# Verify Docker socket access
if [ -S /var/run/docker.sock ]; then
    log "Docker socket access: OK"
else
    log "WARNING: Docker socket not accessible. Backups may fail."
fi

# Create log files with proper permissions
touch /app/logs/postgres-backup.log
touch /app/logs/clickhouse-backup.log
touch /app/logs/backup-verification.log
touch /app/logs/health.log

log "Log files initialized"

# Test database connections
log "Testing database connections..."

# Test PostgreSQL connection
if docker exec analytics-postgres-2025 pg_isready -U postgres > /dev/null 2>&1; then
    log "PostgreSQL connection: OK"
else
    log "WARNING: PostgreSQL connection test failed"
fi

# Test ClickHouse connection
if docker exec crm-clickhouse clickhouse-client --query "SELECT 1" > /dev/null 2>&1; then
    log "ClickHouse connection: OK"
else
    log "WARNING: ClickHouse connection test failed"
fi

# Initialize backup directories
mkdir -p /app/backups/postgres /app/backups/clickhouse
log "Backup directories initialized"

# Show cron schedule
log "Backup schedule:"
log "- PostgreSQL: Daily at 02:00 UTC"
log "- ClickHouse: Daily at 03:00 UTC"
log "- Verification: Weekly on Sundays at 04:00 UTC"

log "Backup service initialization completed"

# Execute the command passed to the container
exec "$@"