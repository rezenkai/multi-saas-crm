-- ClickHouse user initialization for analytics
-- This script creates the analytics user with proper permissions

-- Create the analytics user if it doesn't exist
CREATE USER IF NOT EXISTS analytics IDENTIFIED WITH plaintext_password BY 'analytics_password';

-- Grant full permissions on crm_analytics database
GRANT ALL ON crm_analytics.* TO analytics;

-- Grant system permissions needed for ML service
GRANT SELECT ON system.* TO analytics;

-- Grant access to default database for basic operations
GRANT ALL ON default.* TO analytics;

-- Make sure the user can create databases and tables
GRANT CREATE DATABASE ON *.* TO analytics;
GRANT CREATE TABLE ON *.* TO analytics;

-- Set default database for the analytics user
ALTER USER analytics DEFAULT DATABASE crm_analytics;

-- Show user information
SHOW CREATE USER analytics;