-- Миграция для создания CRM аналитических таблиц в ClickHouse

-- Создание базы данных
CREATE DATABASE IF NOT EXISTS crm_analytics;

-- Таблица сделок (Deals/Opportunities)
CREATE TABLE IF NOT EXISTS crm_analytics.deals (
    id String,
    name String,
    amount Float64,
    stage String,
    stage_order UInt8,
    status String,
    manager_id String,
    manager_name String,
    lead_id Nullable(String),
    created_date DateTime,
    closed_date Nullable(DateTime),
    days_in_stage UInt32,
    tenant_id String,
    updated_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (tenant_id, created_date, id)
PARTITION BY toYYYYMM(created_date);

-- Таблица лидов (Leads)
CREATE TABLE IF NOT EXISTS crm_analytics.leads (
    id String,
    name String,
    email String,
    source_type String,
    source_name String,
    status String,
    estimated_value Nullable(Float64),
    manager_id String,
    manager_name String,
    created_date DateTime,
    qualified_date Nullable(DateTime),
    converted_date Nullable(DateTime),
    tenant_id String,
    updated_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (tenant_id, created_date, id)
PARTITION BY toYYYYMM(created_date);

-- Таблица активности (Activities/Tasks)
CREATE TABLE IF NOT EXISTS crm_analytics.activities (
    id String,
    task_type String,
    subject String,
    status String,
    manager_id String,
    manager_name String,
    department_id String,
    department_name String,
    task_duration_minutes UInt32,
    created_date DateTime,
    completed_date Nullable(DateTime),
    related_entity_type String,
    related_entity_id String,
    tenant_id String,
    updated_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (tenant_id, created_date, id)
PARTITION BY toYYYYMM(created_date);

-- Таблица контактов (Contacts) - дополнительно
CREATE TABLE IF NOT EXISTS crm_analytics.contacts (
    id String,
    name String,
    email String,
    company_name String,
    position String,
    manager_id String,
    manager_name String,
    created_date DateTime,
    last_activity_date Nullable(DateTime),
    tenant_id String,
    updated_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (tenant_id, created_date, id)
PARTITION BY toYYYYMM(created_date);

-- Таблица компаний/аккаунтов (Accounts)
CREATE TABLE IF NOT EXISTS crm_analytics.accounts (
    id String,
    name String,
    industry String,
    company_size String,
    annual_revenue Nullable(Float64),
    manager_id String,
    manager_name String,
    created_date DateTime,
    last_activity_date Nullable(DateTime),
    tenant_id String,
    updated_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (tenant_id, created_date, id)
PARTITION BY toYYYYMM(created_date);

-- Материализованные представления для быстрых агрегаций

-- Ежемесячная статистика продаж
CREATE MATERIALIZED VIEW IF NOT EXISTS crm_analytics.mv_sales_monthly
ENGINE = SummingMergeTree()
ORDER BY (tenant_id, year_month, manager_id)
AS SELECT
    tenant_id,
    toYYYYMM(closed_date) as year_month,
    manager_id,
    manager_name,
    count() as deals_count,
    sum(amount) as total_amount,
    avg(amount) as avg_amount,
    countIf(status = 'closed_won') as won_deals,
    countIf(status = 'closed_lost') as lost_deals
FROM crm_analytics.deals
WHERE closed_date IS NOT NULL
GROUP BY tenant_id, year_month, manager_id, manager_name;

-- Ежедневная статистика по лидам
CREATE MATERIALIZED VIEW IF NOT EXISTS crm_analytics.mv_leads_daily
ENGINE = SummingMergeTree()
ORDER BY (tenant_id, date, source_type)
AS SELECT
    tenant_id,
    toDate(created_date) as date,
    source_type,
    source_name,
    count() as leads_count,
    countIf(status = 'qualified') as qualified_leads,
    countIf(status = 'converted') as converted_leads,
    sum(estimated_value) as total_estimated_value
FROM crm_analytics.leads
GROUP BY tenant_id, date, source_type, source_name;

-- Активность менеджеров по дням
CREATE MATERIALIZED VIEW IF NOT EXISTS crm_analytics.mv_manager_activity_daily
ENGINE = SummingMergeTree()
ORDER BY (tenant_id, date, manager_id)
AS SELECT
    tenant_id,
    toDate(completed_date) as date,
    manager_id,
    manager_name,
    department_id,
    department_name,
    count() as tasks_completed,
    countIf(task_type = 'call') as calls_made,
    countIf(task_type = 'meeting') as meetings_held,
    countIf(task_type = 'email') as emails_sent,
    sum(task_duration_minutes) as total_duration_minutes
FROM crm_analytics.activities
WHERE status = 'completed' AND completed_date IS NOT NULL
GROUP BY tenant_id, date, manager_id, manager_name, department_id, department_name;

-- Индексы для улучшения производительности запросов
-- ClickHouse автоматически создает индексы на ORDER BY колонки

-- Комментарии для документации
COMMENT TABLE crm_analytics.deals IS 'Сделки CRM системы для аналитики';
COMMENT TABLE crm_analytics.leads IS 'Лиды CRM системы для аналитики';
COMMENT TABLE crm_analytics.activities IS 'Активность пользователей CRM системы';
COMMENT TABLE crm_analytics.contacts IS 'Контакты из CRM системы';
COMMENT TABLE crm_analytics.accounts IS 'Компании/аккаунты из CRM системы';