-- ML/AI результаты таблицы для ClickHouse
-- Создание таблиц для хранения результатов машинного обучения

-- Таблица прогнозов продаж (Sales Forecasting)
CREATE TABLE IF NOT EXISTS ml_sales_forecasts (
    id UUID DEFAULT generateUUIDv4(),
    forecast_date Date,
    forecast_timestamp DateTime DEFAULT now(),
    forecast_horizon_days UInt32,
    predicted_sales_amount Decimal(15,2),
    predicted_deals_count UInt32,
    confidence_lower Decimal(15,2),
    confidence_upper Decimal(15,2),
    model_name String,
    model_version String,
    accuracy_score Float32,
    created_by String DEFAULT 'ml-service',
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (forecast_date, forecast_timestamp)
PARTITION BY toYYYYMM(forecast_date)
TTL created_at + INTERVAL 2 YEAR;

-- Таблица детекции аномалий (Anomaly Detection)
CREATE TABLE IF NOT EXISTS ml_anomalies (
    id UUID DEFAULT generateUUIDv4(),
    detected_at DateTime DEFAULT now(),
    anomaly_type Enum('sales_drop', 'unusual_activity', 'metric_spike', 'pattern_break'),
    entity_type Enum('manager', 'deal', 'lead', 'company', 'system'),
    entity_id String,
    anomaly_score Float32,
    severity Enum('low', 'medium', 'high', 'critical'),
    description String,
    metric_name String,
    actual_value Float32,
    expected_value Float32,
    deviation_percentage Float32,
    is_false_positive UInt8 DEFAULT 0,
    resolution_status Enum('new', 'investigating', 'resolved', 'ignored') DEFAULT 'new',
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (detected_at, severity, anomaly_type)
PARTITION BY toYYYYMM(detected_at)
TTL created_at + INTERVAL 1 YEAR;

-- Таблица предсказаний оттока клиентов (Churn Prediction)
CREATE TABLE IF NOT EXISTS ml_churn_predictions (
    id UUID DEFAULT generateUUIDv4(),
    customer_id String,
    company_name String,
    prediction_date Date DEFAULT today(),
    churn_probability Float32,
    churn_risk_level Enum('low', 'medium', 'high', 'critical'),
    days_to_churn UInt32,
    key_risk_factors Array(String),
    retention_recommendations Array(String),
    model_confidence Float32,
    last_activity_date Date,
    customer_lifetime_value Decimal(15,2),
    total_deals_count UInt32,
    avg_deal_size Decimal(15,2),
    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (customer_id, prediction_date)
PARTITION BY toYYYYMM(prediction_date)
TTL created_at + INTERVAL 1 YEAR;

-- Таблица анализа переговоров (Revenue Intelligence)
CREATE TABLE IF NOT EXISTS ml_conversation_analysis (
    id UUID DEFAULT generateUUIDv4(),
    conversation_id String,
    deal_id String,
    manager_id String,
    customer_id String,
    conversation_date DateTime,
    conversation_type Enum('call', 'meeting', 'email', 'chat'),
    duration_minutes UInt32,
    
    -- Результаты анализа настроения
    sentiment_score Float32,
    sentiment_label Enum('positive', 'neutral', 'negative'),
    emotional_intensity Float32,
    
    -- Ключевые темы и фразы
    key_topics Array(String),
    mentioned_competitors Array(String),
    price_objections UInt8,
    decision_makers Array(String),
    
    -- Прогнозы
    deal_close_probability Float32,
    recommended_next_actions Array(String),
    risk_factors Array(String),
    opportunity_signals Array(String),
    
    -- Метаданные
    transcription_accuracy Float32,
    analysis_confidence Float32,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (conversation_date, deal_id, manager_id)
PARTITION BY toYYYYMM(conversation_date)
TTL created_at + INTERVAL 3 YEARS;

-- Таблица производительности моделей ML
CREATE TABLE IF NOT EXISTS ml_model_performance (
    id UUID DEFAULT generateUUIDv4(),
    model_name String,
    model_type Enum('forecasting', 'anomaly_detection', 'churn_prediction', 'conversation_analysis'),
    model_version String,
    evaluation_date Date DEFAULT today(),
    
    -- Основные метрики
    accuracy Float32,
    precision_score Float32,
    recall Float32,
    f1_score Float32,
    mae Float32, -- Mean Absolute Error
    rmse Float32, -- Root Mean Square Error
    
    -- Training данные
    training_samples_count UInt32,
    validation_samples_count UInt32,
    test_samples_count UInt32,
    training_duration_minutes UInt32,
    
    -- Feature importance (top 10)
    feature_importance Map(String, Float32),
    
    -- Статус модели  
    model_status Enum('training', 'active', 'deprecated', 'failed'),
    deployment_date DateTime,
    last_retrain_date DateTime,
    next_retrain_date DateTime,
    
    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (model_name, model_version, evaluation_date)
PARTITION BY toYYYYMM(evaluation_date)
TTL created_at + INTERVAL 2 YEARS;

-- Создание индексов для оптимизации запросов
-- Для быстрого поиска аномалий по severity
ALTER TABLE ml_anomalies ADD INDEX idx_severity severity TYPE set(0) GRANULARITY 1;

-- Для поиска клиентов с высоким риском оттока
ALTER TABLE ml_churn_predictions ADD INDEX idx_risk_level churn_risk_level TYPE set(0) GRANULARITY 1;

-- Для анализа трендов по моделям
ALTER TABLE ml_model_performance ADD INDEX idx_model_type model_type TYPE set(0) GRANULARITY 1;