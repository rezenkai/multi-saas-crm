-- Analytics Database Schema
-- Создание таблиц для аналитической системы

-- Таблица для хранения всех событий
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    event_name VARCHAR(255) NOT NULL,
    properties JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    
    -- Indexes для быстрых запросов
    CONSTRAINT analytics_events_tenant_id_check CHECK (tenant_id IS NOT NULL)
);

-- Индексы для таблицы событий
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_time ON analytics_events(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name_time ON analytics_events(event_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time ON analytics_events(user_id, timestamp DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id, timestamp DESC) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_properties ON analytics_events USING GIN(properties);

-- Таблица для pre-calculated метрик
CREATE TABLE IF NOT EXISTS analytics_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    metric_value NUMERIC(15,2) NOT NULL,
    dimensions JSONB DEFAULT '{}',
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Уникальность по метрике и периоду
    CONSTRAINT unique_metric_period UNIQUE(tenant_id, metric_name, period_start, period_end),
    
    -- Проверки
    CONSTRAINT analytics_metrics_period_check CHECK (period_end > period_start),
    CONSTRAINT analytics_metrics_value_check CHECK (metric_value >= 0)
);

-- Индексы для метрик
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_tenant_name ON analytics_metrics(tenant_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_period ON analytics_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_dimensions ON analytics_metrics USING GIN(dimensions);

-- Таблица для user sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    page_views INTEGER DEFAULT 0,
    events_count INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    device_type VARCHAR(50),
    browser VARCHAR(100),
    os VARCHAR(100),
    country VARCHAR(100),
    city VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    
    CONSTRAINT user_sessions_duration_check CHECK (duration_seconds >= 0),
    CONSTRAINT user_sessions_page_views_check CHECK (page_views >= 0),
    CONSTRAINT user_sessions_events_check CHECK (events_count >= 0)
);

-- Индексы для сессий
CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_user ON user_sessions(tenant_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON user_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active, last_activity DESC) WHERE is_active = true;

-- Таблица для dashboard configurations (кэш дашбордов)
CREATE TABLE IF NOT EXISTS dashboard_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    dashboard_type VARCHAR(100) NOT NULL,
    dashboard_data JSONB NOT NULL,
    filters JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    CONSTRAINT unique_dashboard_cache UNIQUE(tenant_id, dashboard_type, filters)
);

-- Индексы для dashboard cache
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_tenant_type ON dashboard_cache(tenant_id, dashboard_type);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_expires ON dashboard_cache(expires_at);

-- Таблица для user behavior patterns (ML features)
CREATE TABLE IF NOT EXISTS user_behavior_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    pattern_type VARCHAR(100) NOT NULL, -- 'frequent_pages', 'preferred_features', 'usage_times'
    pattern_data JSONB NOT NULL,
    confidence_score NUMERIC(3,2) DEFAULT 0.50, -- 0.00 to 1.00
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    
    CONSTRAINT unique_user_pattern UNIQUE(tenant_id, user_id, pattern_type),
    CONSTRAINT confidence_score_check CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

-- Индексы для поведенческих паттернов
CREATE INDEX IF NOT EXISTS idx_user_patterns_tenant_user ON user_behavior_patterns(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_patterns_type ON user_behavior_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_user_patterns_valid_until ON user_behavior_patterns(valid_until);

-- Таблица для A/B testing (future use)
CREATE TABLE IF NOT EXISTS ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    test_description TEXT,
    variants JSONB NOT NULL, -- ['A', 'B'] or more complex variants
    allocation JSONB NOT NULL, -- {"A": 50, "B": 50}
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    success_metric VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_active_test UNIQUE(tenant_id, test_name, is_active) 
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT ab_tests_dates_check CHECK (end_date IS NULL OR end_date > start_date)
);

-- User assignments для A/B тестов
CREATE TABLE IF NOT EXISTS ab_test_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    variant VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_test_user UNIQUE(test_id, user_id)
);

-- Views для быстрых запросов
-- Представление для ежедневной активности
CREATE OR REPLACE VIEW daily_activity AS
SELECT 
    tenant_id,
    DATE(timestamp) as activity_date,
    COUNT(*) as total_events,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(*) FILTER (WHERE event_name = 'Page Viewed') as page_views,
    COUNT(*) FILTER (WHERE event_name LIKE '%Created%') as creation_events,
    COUNT(*) FILTER (WHERE event_name LIKE '%Updated%') as update_events
FROM analytics_events
WHERE timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY tenant_id, DATE(timestamp)
ORDER BY activity_date DESC;

-- Представление для sales funnel
CREATE OR REPLACE VIEW sales_funnel_view AS
SELECT 
    tenant_id,
    DATE_TRUNC('day', timestamp) as funnel_date,
    COUNT(*) FILTER (WHERE event_name = 'Lead Generated') as leads_generated,
    COUNT(*) FILTER (WHERE event_name = 'Lead Qualified') as leads_qualified,
    COUNT(*) FILTER (WHERE event_name = 'Meeting Scheduled') as meetings_scheduled,
    COUNT(*) FILTER (WHERE event_name = 'Proposal Sent') as proposals_sent,
    COUNT(*) FILTER (WHERE event_name = 'Contract Signed') as contracts_signed,
    COUNT(*) FILTER (WHERE event_name = 'Opportunity Won') as opportunities_won,
    COUNT(*) FILTER (WHERE event_name = 'Opportunity Lost') as opportunities_lost
FROM analytics_events
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
    AND event_name IN ('Lead Generated', 'Lead Qualified', 'Meeting Scheduled', 
                       'Proposal Sent', 'Contract Signed', 'Opportunity Won', 'Opportunity Lost')
GROUP BY tenant_id, DATE_TRUNC('day', timestamp)
ORDER BY funnel_date DESC;

-- Представление для популярных страниц
CREATE OR REPLACE VIEW popular_pages_view AS
SELECT 
    tenant_id,
    properties->>'page' as page,
    COUNT(*) as views,
    COUNT(DISTINCT user_id) as unique_viewers,
    COUNT(DISTINCT session_id) as unique_sessions,
    AVG((properties->>'load_time')::numeric) as avg_load_time,
    DATE_TRUNC('day', MIN(timestamp)) as first_view,
    DATE_TRUNC('day', MAX(timestamp)) as last_view
FROM analytics_events
WHERE event_name = 'Page Viewed'
    AND properties->>'page' IS NOT NULL
    AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tenant_id, properties->>'page'
HAVING COUNT(*) >= 5  -- Минимум 5 просмотров
ORDER BY views DESC;

-- Функция для очистки старых данных
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS void AS $$
BEGIN
    -- Удаляем события старше 1 года (кроме важных бизнес-событий)
    DELETE FROM analytics_events 
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '1 year'
        AND event_name NOT IN ('Opportunity Won', 'Opportunity Lost', 'Contract Signed', 'Payment Received');
    
    -- Удаляем старые сессии
    DELETE FROM user_sessions 
    WHERE started_at < CURRENT_TIMESTAMP - INTERVAL '6 months';
    
    -- Удаляем просроченные кэш записи
    DELETE FROM dashboard_cache 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Удаляем просроченные поведенческие паттерны
    DELETE FROM user_behavior_patterns 
    WHERE valid_until < CURRENT_TIMESTAMP;
    
    RAISE NOTICE 'Analytics cleanup completed at %', CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Создаем индекс для cleanup функции
CREATE INDEX IF NOT EXISTS idx_analytics_events_cleanup ON analytics_events(timestamp) 
WHERE event_name NOT IN ('Opportunity Won', 'Opportunity Lost', 'Contract Signed', 'Payment Received');

-- Комментарии к таблицам
COMMENT ON TABLE analytics_events IS 'Хранение всех пользовательских событий для аналитики';
COMMENT ON TABLE analytics_metrics IS 'Предрассчитанные метрики для быстрого доступа';
COMMENT ON TABLE user_sessions IS 'Информация о пользовательских сессиях';
COMMENT ON TABLE dashboard_cache IS 'Кэш данных для дашбордов';
COMMENT ON TABLE user_behavior_patterns IS 'ML-модели поведенческих паттернов пользователей';
COMMENT ON TABLE ab_tests IS 'Конфигурация A/B тестов';

-- Настройка разрешений (будет настроено при деплое)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO analytics_service;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO analytics_service;

COMMIT;