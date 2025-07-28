-- Sample Analytics Data для тестирования
-- Этот файл создает тестовые данные для демонстрации аналитики

-- Тестовые tenant_id (должны совпадать с реальными из CRM)
DO $$
DECLARE
    test_tenant_id UUID := '12345678-1234-5678-9012-123456789012';
    test_user_id UUID := '87654321-4321-8765-2109-876543210987';
    test_session_id VARCHAR := 'session_' || extract(epoch from now())::text;
    i INTEGER;
BEGIN
    -- Очищаем старые тестовые данные если есть
    DELETE FROM analytics_events WHERE tenant_id = test_tenant_id;
    DELETE FROM analytics_metrics WHERE tenant_id = test_tenant_id;
    DELETE FROM user_sessions WHERE tenant_id = test_tenant_id;
    
    -- 1. Создаем тестовые сессии (последние 30 дней)
    FOR i IN 1..50 LOOP
        INSERT INTO user_sessions (
            tenant_id, user_id, session_id,
            started_at, last_activity, page_views, events_count,
            duration_seconds, ip_address, user_agent,
            device_type, browser, os, country, city
        ) VALUES (
            test_tenant_id,
            (ARRAY[test_user_id, gen_random_uuid(), gen_random_uuid()])[1 + (i % 3)],
            'session_' || i::text,
            CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'),
            CURRENT_TIMESTAMP - (random() * INTERVAL '1 day'),
            (random() * 20)::INTEGER + 1,
            (random() * 50)::INTEGER + 5,
            (random() * 3600)::INTEGER + 60,
            ('192.168.1.' || (1 + random() * 254)::INTEGER)::INET,
            (ARRAY[
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
            ])[1 + (random() * 3)::INTEGER],
            (ARRAY['desktop', 'mobile', 'tablet'])[1 + (random() * 3)::INTEGER],
            (ARRAY['Chrome', 'Safari', 'Firefox', 'Edge'])[1 + (random() * 4)::INTEGER],
            (ARRAY['Windows', 'macOS', 'Linux', 'iOS', 'Android'])[1 + (random() * 5)::INTEGER],
            (ARRAY['US', 'RU', 'DE', 'UK', 'FR'])[1 + (random() * 5)::INTEGER],
            (ARRAY['New York', 'Moscow', 'Berlin', 'London', 'Paris'])[1 + (random() * 5)::INTEGER]
        );
    END LOOP;

    -- 2. Создаем события для последних 30 дней
    FOR i IN 1..1000 LOOP
        -- Случайные события
        INSERT INTO analytics_events (
            tenant_id, user_id, event_name, properties, 
            timestamp, session_id, ip_address
        ) VALUES (
            test_tenant_id,
            (ARRAY[test_user_id, gen_random_uuid(), gen_random_uuid()])[1 + (i % 3)],
            (ARRAY[
                'Page Viewed', 'Feature Used', 'Lead Generated', 'Lead Qualified',
                'Company Created', 'Contact Created', 'Opportunity Created',
                'Opportunity Stage Changed', 'Opportunity Won', 'Opportunity Lost',
                'User Login', 'Dashboard Viewed', 'Report Generated'
            ])[1 + (random() * 13)::INTEGER],
            jsonb_build_object(
                'page', (ARRAY['/dashboard', '/companies', '/contacts', '/opportunities', '/reports'])[1 + (random() * 5)::INTEGER],
                'feature', (ARRAY['export', 'filter', 'search', 'create', 'edit'])[1 + (random() * 5)::INTEGER],
                'amount', (random() * 50000)::NUMERIC(10,2),
                'stage', (ARRAY['PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON'])[1 + (random() * 5)::INTEGER]
            ),
            CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'),
            'session_' || (1 + (random() * 50)::INTEGER)::text,
            ('192.168.1.' || (1 + random() * 254)::INTEGER)::INET
        );
    END LOOP;

    -- 3. Создаем специфические бизнес-события (sales funnel)
    -- Lead Generated события
    FOR i IN 1..100 LOOP
        INSERT INTO analytics_events (
            tenant_id, user_id, event_name, properties, 
            timestamp, session_id
        ) VALUES (
            test_tenant_id,
            test_user_id,
            'Lead Generated',
            jsonb_build_object(
                'source', (ARRAY['website', 'referral', 'cold_call', 'email', 'social_media'])[1 + (random() * 5)::INTEGER],
                'lead_id', gen_random_uuid()::text,
                'potential_value', (random() * 10000 + 1000)::NUMERIC(10,2)
            ),
            CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'),
            test_session_id
        );
    END LOOP;

    -- Opportunity Won события с revenue
    FOR i IN 1..30 LOOP
        INSERT INTO analytics_events (
            tenant_id, user_id, event_name, properties, 
            timestamp, session_id
        ) VALUES (
            test_tenant_id,
            test_user_id,
            'Opportunity Won',
            jsonb_build_object(
                'opportunity_id', gen_random_uuid()::text,
                'opportunity_name', 'Big Deal #' || i::text,
                'amount', (random() * 25000 + 5000)::NUMERIC(10,2),
                'stage', 'CLOSED_WON',
                'close_date', (CURRENT_DATE - (random() * 30)::INTEGER)::text,
                'company_id', gen_random_uuid()::text
            ),
            CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'),
            test_session_id
        );
    END LOOP;

    -- 4. Создаем предрассчитанные метрики для дашборда
    -- Дневные метрики за последние 30 дней
    FOR i IN 0..29 LOOP
        INSERT INTO analytics_metrics (
            tenant_id, metric_name, metric_value, 
            period_start, period_end
        ) VALUES 
        (
            test_tenant_id, 'total_revenue',
            (random() * 5000 + 1000)::NUMERIC(10,2),
            (CURRENT_DATE - i)::TIMESTAMP,
            (CURRENT_DATE - i + 1)::TIMESTAMP
        ),
        (
            test_tenant_id, 'deals_count',
            (random() * 10 + 1)::INTEGER,
            (CURRENT_DATE - i)::TIMESTAMP,
            (CURRENT_DATE - i + 1)::TIMESTAMP
        ),
        (
            test_tenant_id, 'active_users',
            (random() * 20 + 5)::INTEGER,
            (CURRENT_DATE - i)::TIMESTAMP,
            (CURRENT_DATE - i + 1)::TIMESTAMP
        ),
        (
            test_tenant_id, 'page_views',
            (random() * 200 + 50)::INTEGER,
            (CURRENT_DATE - i)::TIMESTAMP,
            (CURRENT_DATE - i + 1)::TIMESTAMP
        ),
        (
            test_tenant_id, 'leads_generated',
            (random() * 15 + 2)::INTEGER,
            (CURRENT_DATE - i)::TIMESTAMP,
            (CURRENT_DATE - i + 1)::TIMESTAMP
        );
    END LOOP;

    -- 5. Создаем поведенческие паттерны пользователей
    INSERT INTO user_behavior_patterns (
        tenant_id, user_id, pattern_type, pattern_data, 
        confidence_score, valid_until
    ) VALUES 
    (
        test_tenant_id, test_user_id, 'frequent_pages',
        jsonb_build_object(
            'pages', jsonb_build_array('/dashboard', '/companies', '/opportunities'),
            'frequency', jsonb_build_object('/dashboard', 0.4, '/companies', 0.35, '/opportunities', 0.25),
            'avg_time_spent', jsonb_build_object('/dashboard', 180, '/companies', 240, '/opportunities', 300)
        ),
        0.85, CURRENT_TIMESTAMP + INTERVAL '7 days'
    ),
    (
        test_tenant_id, test_user_id, 'preferred_features',
        jsonb_build_object(
            'features', jsonb_build_array('export', 'search', 'filter'),
            'usage_frequency', jsonb_build_object('export', 0.3, 'search', 0.45, 'filter', 0.25),
            'success_rate', jsonb_build_object('export', 0.95, 'search', 0.88, 'filter', 0.92)
        ),
        0.78, CURRENT_TIMESTAMP + INTERVAL '14 days'
    );

    -- 6. Создаем кэш дашборда
    INSERT INTO dashboard_cache (
        tenant_id, dashboard_type, dashboard_data, 
        expires_at
    ) VALUES (
        test_tenant_id, 'sales_overview',
        jsonb_build_object(
            'total_revenue', 125000,
            'deals_count', 45,
            'conversion_rate', 0.23,
            'top_performers', jsonb_build_array(
                jsonb_build_object('name', 'John Doe', 'revenue', 35000),
                jsonb_build_object('name', 'Jane Smith', 'revenue', 28000)
            ),
            'revenue_by_month', jsonb_build_array(
                jsonb_build_object('month', '2024-01', 'revenue', 42000),
                jsonb_build_object('month', '2024-02', 'revenue', 38000),
                jsonb_build_object('month', '2024-03', 'revenue', 45000)
            )
        ),
        CURRENT_TIMESTAMP + INTERVAL '1 hour'
    );

    RAISE NOTICE 'Sample analytics data created for tenant: %', test_tenant_id;
    RAISE NOTICE 'Total events inserted: %', (SELECT COUNT(*) FROM analytics_events WHERE tenant_id = test_tenant_id);
    RAISE NOTICE 'Total metrics inserted: %', (SELECT COUNT(*) FROM analytics_metrics WHERE tenant_id = test_tenant_id);
    RAISE NOTICE 'Total sessions inserted: %', (SELECT COUNT(*) FROM user_sessions WHERE tenant_id = test_tenant_id);

END $$;