-- Custom Fields Service Database Schema
-- Multi-SaaS платформа - поддержка настраиваемых полей

-- Создание расширений PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Таблица определений кастомных полей
CREATE TABLE IF NOT EXISTS custom_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    entity_type VARCHAR(100) NOT NULL, -- 'contact', 'company', 'opportunity', etc.
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL, -- 'text', 'number', 'date', 'select', etc.
    label VARCHAR(255),
    description TEXT,
    required BOOLEAN DEFAULT FALSE,
    default_value JSONB,
    options JSONB, -- Конфигурация для каждого типа поля
    validation_rules JSONB, -- Правила валидации
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    -- Ограничения
    CONSTRAINT unique_field_per_entity UNIQUE (tenant_id, entity_type, field_name),
    CONSTRAINT valid_field_type CHECK (field_type IN (
        'text', 'textarea', 'number', 'date', 'datetime', 
        'email', 'url', 'select', 'multiselect', 'boolean', 'json'
    )),
    CONSTRAINT valid_entity_type CHECK (entity_type IN (
        'contact', 'company', 'opportunity', 'lead', 'user', 'project', 'task'
    ))
);

-- Таблица значений кастомных полей
CREATE TABLE IF NOT EXISTS custom_field_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL, -- ID записи в основной таблице (contact.id, company.id, etc.)
    value_text TEXT,
    value_number DECIMAL(20,6),
    value_date DATE,
    value_datetime TIMESTAMP WITH TIME ZONE,
    value_boolean BOOLEAN,
    value_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения
    CONSTRAINT unique_field_value_per_entity UNIQUE (tenant_id, field_id, entity_id),
    
    -- Проверка что только одно поле значения заполнено
    CONSTRAINT single_value_constraint CHECK (
        (value_text IS NOT NULL)::int + 
        (value_number IS NOT NULL)::int + 
        (value_date IS NOT NULL)::int + 
        (value_datetime IS NOT NULL)::int + 
        (value_boolean IS NOT NULL)::int + 
        (value_json IS NOT NULL)::int = 1
    )
);

-- Таблица схем сущностей (кэш метаданных)
CREATE TABLE IF NOT EXISTS entity_schemas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    schema_version INTEGER DEFAULT 1,
    base_fields JSONB NOT NULL,
    custom_fields JSONB NOT NULL,
    relationships JSONB,
    indexes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения
    CONSTRAINT unique_schema_per_entity UNIQUE (tenant_id, entity_type)
);

-- Таблица аудита изменений кастомных полей
CREATE TABLE IF NOT EXISTS custom_fields_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    field_id UUID, -- может быть NULL если поле удалено
    entity_type VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    old_values JSONB,
    new_values JSONB,
    changed_by UUID,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Индексы для производительности

-- Основные индексы для custom_fields
CREATE INDEX IF NOT EXISTS idx_custom_fields_tenant_entity ON custom_fields(tenant_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_custom_fields_active ON custom_fields(tenant_id, entity_type, is_active);
CREATE INDEX IF NOT EXISTS idx_custom_fields_order ON custom_fields(tenant_id, entity_type, display_order);

-- Основные индексы для custom_field_values
CREATE INDEX IF NOT EXISTS idx_custom_field_values_tenant ON custom_field_values(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity ON custom_field_values(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field ON custom_field_values(field_id);

-- Индексы для поиска по значениям
CREATE INDEX IF NOT EXISTS idx_custom_field_values_text ON custom_field_values(tenant_id, entity_type, value_text) WHERE value_text IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_field_values_number ON custom_field_values(tenant_id, entity_type, value_number) WHERE value_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_field_values_date ON custom_field_values(tenant_id, entity_type, value_date) WHERE value_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_field_values_boolean ON custom_field_values(tenant_id, entity_type, value_boolean) WHERE value_boolean IS NOT NULL;

-- GIN индекс для JSON поиска
CREATE INDEX IF NOT EXISTS idx_custom_field_values_json ON custom_field_values USING GIN(value_json) WHERE value_json IS NOT NULL;

-- Индексы для entity_schemas
CREATE INDEX IF NOT EXISTS idx_entity_schemas_tenant ON entity_schemas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entity_schemas_version ON entity_schemas(tenant_id, entity_type, schema_version);

-- Индексы для аудита
CREATE INDEX IF NOT EXISTS idx_custom_fields_audit_tenant ON custom_fields_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_audit_field ON custom_fields_audit(field_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_audit_date ON custom_fields_audit(changed_at);

-- Триггеры для автоматического обновления updated_at

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_custom_fields_updated_at 
    BEFORE UPDATE ON custom_fields 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_field_values_updated_at 
    BEFORE UPDATE ON custom_field_values 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entity_schemas_updated_at 
    BEFORE UPDATE ON entity_schemas 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Функция аудита изменений кастомных полей
CREATE OR REPLACE FUNCTION audit_custom_fields_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO custom_fields_audit (
            tenant_id, field_id, entity_type, action, new_values, changed_by
        ) VALUES (
            NEW.tenant_id, NEW.id, NEW.entity_type, 'CREATE', 
            row_to_json(NEW), NEW.created_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO custom_fields_audit (
            tenant_id, field_id, entity_type, action, old_values, new_values, changed_by
        ) VALUES (
            NEW.tenant_id, NEW.id, NEW.entity_type, 'UPDATE', 
            row_to_json(OLD), row_to_json(NEW), NEW.updated_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO custom_fields_audit (
            tenant_id, field_id, entity_type, action, old_values
        ) VALUES (
            OLD.tenant_id, OLD.id, OLD.entity_type, 'DELETE', 
            row_to_json(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Триггер аудита для custom_fields
CREATE TRIGGER audit_custom_fields_trigger
    AFTER INSERT OR UPDATE OR DELETE ON custom_fields
    FOR EACH ROW EXECUTE FUNCTION audit_custom_fields_changes();

-- Представления для удобного доступа к данным

-- Представление с полной информацией о кастомных полях
CREATE OR REPLACE VIEW v_custom_fields_detailed AS
SELECT 
    cf.id,
    cf.tenant_id,
    cf.entity_type,
    cf.field_name,
    cf.field_type,
    cf.label,
    cf.description,
    cf.required,
    cf.default_value,
    cf.options,
    cf.validation_rules,
    cf.display_order,
    cf.is_active,
    cf.created_at,
    cf.updated_at,
    COUNT(cfv.id) as usage_count
FROM custom_fields cf
LEFT JOIN custom_field_values cfv ON cf.id = cfv.field_id
GROUP BY cf.id, cf.tenant_id, cf.entity_type, cf.field_name, cf.field_type, 
         cf.label, cf.description, cf.required, cf.default_value, cf.options, 
         cf.validation_rules, cf.display_order, cf.is_active, cf.created_at, cf.updated_at;

-- Представление значений кастомных полей с метаданными
CREATE OR REPLACE VIEW v_custom_field_values_with_metadata AS
SELECT 
    cfv.id,
    cfv.tenant_id,
    cfv.entity_type,
    cfv.entity_id,
    cf.field_name,
    cf.field_type,
    cf.label,
    CASE 
        WHEN cf.field_type IN ('text', 'textarea', 'email', 'url', 'select') THEN cfv.value_text
        WHEN cf.field_type = 'number' THEN cfv.value_number::text
        WHEN cf.field_type = 'date' THEN cfv.value_date::text
        WHEN cf.field_type = 'datetime' THEN cfv.value_datetime::text
        WHEN cf.field_type = 'boolean' THEN cfv.value_boolean::text
        WHEN cf.field_type IN ('json', 'multiselect') THEN cfv.value_json::text
        ELSE NULL
    END as display_value,
    cfv.value_text,
    cfv.value_number,
    cfv.value_date,
    cfv.value_datetime,
    cfv.value_boolean,
    cfv.value_json,
    cfv.created_at,
    cfv.updated_at
FROM custom_field_values cfv
JOIN custom_fields cf ON cfv.field_id = cf.id
WHERE cf.is_active = TRUE;

-- Функции для работы с кастомными полями

-- Функция получения значений кастомных полей для сущности
CREATE OR REPLACE FUNCTION get_entity_custom_fields(
    p_tenant_id UUID,
    p_entity_type VARCHAR,
    p_entity_id UUID
)
RETURNS TABLE (
    field_name VARCHAR,
    field_type VARCHAR,
    label VARCHAR,
    display_value TEXT,
    raw_value JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cf.field_name,
        cf.field_type,
        cf.label,
        CASE 
            WHEN cf.field_type IN ('text', 'textarea', 'email', 'url', 'select') THEN cfv.value_text
            WHEN cf.field_type = 'number' THEN cfv.value_number::text
            WHEN cf.field_type = 'date' THEN cfv.value_date::text
            WHEN cf.field_type = 'datetime' THEN cfv.value_datetime::text
            WHEN cf.field_type = 'boolean' THEN cfv.value_boolean::text
            WHEN cf.field_type IN ('json', 'multiselect') THEN cfv.value_json::text
            ELSE NULL
        END,
        CASE 
            WHEN cf.field_type IN ('text', 'textarea', 'email', 'url', 'select') THEN to_jsonb(cfv.value_text)
            WHEN cf.field_type = 'number' THEN to_jsonb(cfv.value_number)
            WHEN cf.field_type = 'date' THEN to_jsonb(cfv.value_date)
            WHEN cf.field_type = 'datetime' THEN to_jsonb(cfv.value_datetime)
            WHEN cf.field_type = 'boolean' THEN to_jsonb(cfv.value_boolean)
            WHEN cf.field_type IN ('json', 'multiselect') THEN cfv.value_json
            ELSE NULL
        END
    FROM custom_fields cf
    LEFT JOIN custom_field_values cfv ON cf.id = cfv.field_id AND cfv.entity_id = p_entity_id
    WHERE cf.tenant_id = p_tenant_id 
      AND cf.entity_type = p_entity_type 
      AND cf.is_active = TRUE
    ORDER BY cf.display_order, cf.field_name;
END;
$$ LANGUAGE plpgsql;

-- Функция поиска сущностей по кастомным полям
CREATE OR REPLACE FUNCTION search_entities_by_custom_fields(
    p_tenant_id UUID,
    p_entity_type VARCHAR,
    p_search_criteria JSONB
)
RETURNS TABLE (entity_id UUID) AS $$
DECLARE
    criteria_key TEXT;
    criteria_value TEXT;
    sql_query TEXT := '';
    first_condition BOOLEAN := TRUE;
BEGIN
    sql_query := 'SELECT DISTINCT cfv.entity_id FROM custom_field_values cfv 
                  JOIN custom_fields cf ON cfv.field_id = cf.id 
                  WHERE cfv.tenant_id = $1 AND cfv.entity_type = $2';
    
    -- Построение динамического запроса на основе критериев поиска
    FOR criteria_key, criteria_value IN SELECT * FROM jsonb_each_text(p_search_criteria)
    LOOP
        IF NOT first_condition THEN
            sql_query := sql_query || ' AND';
        ELSE
            sql_query := sql_query || ' AND';
            first_condition := FALSE;
        END IF;
        
        sql_query := sql_query || ' EXISTS (
            SELECT 1 FROM custom_field_values cfv2 
            JOIN custom_fields cf2 ON cfv2.field_id = cf2.id 
            WHERE cfv2.entity_id = cfv.entity_id 
              AND cf2.field_name = ''' || criteria_key || '''
              AND (cfv2.value_text ILIKE ''%' || criteria_value || '%'' 
                   OR cfv2.value_number::text = ''' || criteria_value || '''
                   OR cfv2.value_json::text ILIKE ''%' || criteria_value || '%'')
        )';
    END LOOP;
    
    RETURN QUERY EXECUTE sql_query USING p_tenant_id, p_entity_type;
END;
$$ LANGUAGE plpgsql;

-- Вставка тестовых данных (опционально, для разработки)
INSERT INTO custom_fields (tenant_id, entity_type, field_name, field_type, label, description, required, options)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'contact', 'linkedin_url', 'url', 'LinkedIn Profile', 'URL профиля LinkedIn контакта', false, '{"placeholder": "https://linkedin.com/in/username"}'),
    ('00000000-0000-0000-0000-000000000001', 'contact', 'lead_source', 'select', 'Lead Source', 'Источник привлечения лида', false, '{"choices": ["Website", "Referral", "Cold Call", "Social Media", "Event"]}'),
    ('00000000-0000-0000-0000-000000000001', 'company', 'annual_revenue', 'number', 'Annual Revenue', 'Годовой доход компании', false, '{"min": 0, "max": 999999999, "currency": "USD"}'),
    ('00000000-0000-0000-0000-000000000001', 'opportunity', 'competitor_info', 'json', 'Competitor Analysis', 'Информация о конкурентах', false, '{"schema": {"competitors": "array", "advantages": "string"}}')
ON CONFLICT (tenant_id, entity_type, field_name) DO NOTHING;