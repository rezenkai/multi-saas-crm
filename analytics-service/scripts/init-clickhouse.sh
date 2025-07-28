#!/bin/bash
# ClickHouse initialization script for CRM Analytics
# This script sets up users, databases, and tables required for the ML service

set -e

CLICKHOUSE_HOST=${CLICKHOUSE_HOST:-clickhouse-analytics}
CLICKHOUSE_HTTP_PORT=${CLICKHOUSE_HTTP_PORT:-8123}
CLICKHOUSE_TCP_PORT=${CLICKHOUSE_TCP_PORT:-9000}

echo "🔧 Initializing ClickHouse for CRM Analytics..."
echo "   Host: $CLICKHOUSE_HOST"
echo "   HTTP Port: $CLICKHOUSE_HTTP_PORT"
echo "   TCP Port: $CLICKHOUSE_TCP_PORT"

# Wait for ClickHouse to be ready
echo "⏳ Waiting for ClickHouse to be ready..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -s "http://$CLICKHOUSE_HOST:$CLICKHOUSE_HTTP_PORT/ping" > /dev/null 2>&1; then
        echo "✅ ClickHouse is ready!"
        break
    fi
    
    echo "   Attempt $attempt/$max_attempts - waiting for ClickHouse..."
    sleep 2
    attempt=$((attempt + 1))
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ ClickHouse did not start within expected time"
    exit 1
fi

# Create analytics user
echo "👤 Creating analytics user..."
curl -s "http://$CLICKHOUSE_HOST:$CLICKHOUSE_HTTP_PORT/" --data-binary "
CREATE USER IF NOT EXISTS analytics IDENTIFIED WITH plaintext_password BY 'analytics_password';
GRANT ALL ON *.* TO analytics;
" || echo "   User creation may have failed, continuing..."

# Create database and tables
echo "🗄️  Creating database and tables..."
curl -s "http://$CLICKHOUSE_HOST:$CLICKHOUSE_HTTP_PORT/" \
    -H "X-ClickHouse-User: analytics" \
    -H "X-ClickHouse-Key: analytics_password" \
    --data-binary @/docker-entrypoint-initdb.d/002_clickhouse_crm_tables.sql || echo "   Table creation may have failed, continuing..."

# Create sample data for testing
echo "📊 Creating sample test data..."
curl -s "http://$CLICKHOUSE_HOST:$CLICKHOUSE_HTTP_PORT/" \
    -H "X-ClickHouse-User: analytics" \
    -H "X-ClickHouse-Key: analytics_password" \
    --data-binary "
INSERT INTO crm_analytics.deals 
(id, name, amount, stage, stage_order, status, manager_id, manager_name, created_date, closed_date, days_in_stage, tenant_id)
VALUES
('deal-1', 'Test Deal 1', 10000.0, 'closed', 5, 'won', 'mgr-1', 'John Doe', '2024-01-15', '2024-01-20', 5, 'tenant-1'),
('deal-2', 'Test Deal 2', 15000.0, 'closed', 5, 'won', 'mgr-1', 'John Doe', '2024-02-10', '2024-02-15', 5, 'tenant-1'),
('deal-3', 'Test Deal 3', 20000.0, 'closed', 5, 'won', 'mgr-2', 'Jane Smith', '2024-03-05', '2024-03-10', 5, 'tenant-1'),
('deal-4', 'Test Deal 4', 8000.0, 'closed', 5, 'won', 'mgr-1', 'John Doe', '2024-04-01', '2024-04-05', 4, 'tenant-1'),
('deal-5', 'Test Deal 5', 25000.0, 'closed', 5, 'won', 'mgr-2', 'Jane Smith', '2024-05-12', '2024-05-18', 6, 'tenant-1');
" || echo "   Sample data insertion may have failed, continuing..."

echo "✅ ClickHouse initialization completed!"
echo "🔍 Testing connection..."

# Test the connection
curl -s "http://$CLICKHOUSE_HOST:$CLICKHOUSE_HTTP_PORT/" \
    -H "X-ClickHouse-User: analytics" \
    -H "X-ClickHouse-Key: analytics_password" \
    --data-binary "SELECT count() FROM crm_analytics.deals" && echo " deals found in test database"

echo "🎯 ClickHouse is ready for ML service!"