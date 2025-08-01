-- ClickHouse schema for event ingestion service
CREATE DATABASE IF NOT EXISTS crm_analytics;

USE crm_analytics;

-- Events table for high-performance analytics
CREATE TABLE IF NOT EXISTS events (
    tenant_id String,
    event_type String,
    user_id String,
    timestamp Int64,
    properties String,
    metrics String,
    date Date DEFAULT toDate(timestamp)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(toDate(timestamp))
ORDER BY (tenant_id, event_type, timestamp)
SETTINGS index_granularity = 8192;

-- Materialized view for real-time aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS event_metrics_mv
TO event_metrics
AS SELECT
    tenant_id,
    event_type,
    toStartOfHour(toDateTime(timestamp)) as hour,
    count() as event_count,
    uniqExact(user_id) as unique_users
FROM events
GROUP BY tenant_id, event_type, hour;

-- Target table for materialized view
CREATE TABLE IF NOT EXISTS event_metrics (
    tenant_id String,
    event_type String,
    hour DateTime,
    event_count UInt64,
    unique_users UInt64
) ENGINE = SummingMergeTree()
ORDER BY (tenant_id, event_type, hour);

-- Daily aggregations table
CREATE TABLE IF NOT EXISTS daily_stats (
    tenant_id String,
    date Date,
    total_events UInt64,
    unique_users UInt64,
    avg_events_per_user Float64
) ENGINE = ReplacingMergeTree()
ORDER BY (tenant_id, date);