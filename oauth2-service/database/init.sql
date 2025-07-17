-- OAuth2 Service Database Schema
-- Multi-SaaS платформа - OAuth2 Authorization Server

-- Создание расширений PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Таблица OAuth2 клиентов
CREATE TABLE IF NOT EXISTS oauth_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(255) UNIQUE NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tenant_id VARCHAR(255) NOT NULL,
    redirect_uris TEXT[] NOT NULL DEFAULT '{}',
    allowed_grants TEXT[] NOT NULL DEFAULT '{"authorization_code","refresh_token"}',
    allowed_scopes TEXT[] NOT NULL DEFAULT '{"read","write"}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_confidential BOOLEAN NOT NULL DEFAULT true,
    pkce_required BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- Таблица пользователей OAuth2
CREATE TABLE IF NOT EXISTS oauth_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    tenant_id VARCHAR(255) NOT NULL,
    profile JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица токенов доступа
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(255) UNIQUE NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_id UUID,
    tenant_id VARCHAR(255) NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES oauth_users(id) ON DELETE CASCADE
);

-- Таблица refresh токенов
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(255) UNIQUE NOT NULL,
    access_token_id UUID NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_id UUID,
    tenant_id VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (access_token_id) REFERENCES oauth_access_tokens(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES oauth_users(id) ON DELETE CASCADE
);

-- Таблица кодов авторизации
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(255) UNIQUE NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    redirect_uri VARCHAR(512) NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    code_challenge VARCHAR(255),
    code_challenge_method VARCHAR(10),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES oauth_users(id) ON DELETE CASCADE
);

-- Таблица внешних провайдеров OAuth
CREATE TABLE IF NOT EXISTS external_oauth_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL, -- google, github, microsoft, slack
    display_name VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}', -- scopes, endpoints, etc.
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, tenant_id)
);

-- Таблица токенов от внешних провайдеров
CREATE TABLE IF NOT EXISTS external_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    provider_name VARCHAR(100) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    scopes TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES oauth_users(id) ON DELETE CASCADE,
    UNIQUE(user_id, provider_name)
);

-- Таблица сессий OAuth2
CREATE TABLE IF NOT EXISTS oauth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID,
    tenant_id VARCHAR(255) NOT NULL,
    client_id VARCHAR(255),
    data JSONB NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES oauth_users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
);

-- Таблица scope разрешений
CREATE TABLE IF NOT EXISTS oauth_scopes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица аудита OAuth событий
CREATE TABLE IF NOT EXISTS oauth_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    user_id UUID,
    client_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL, -- login, token_issued, token_revoked, etc.
    event_data JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES oauth_users(id) ON DELETE SET NULL,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE SET NULL
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_oauth_clients_tenant_id ON oauth_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_users_tenant_id ON oauth_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oauth_users_email ON oauth_users(email);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_token ON oauth_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_tenant_id ON oauth_access_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_expires_at ON oauth_access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_token ON oauth_refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_code ON oauth_authorization_codes(code);
CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_expires_at ON oauth_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_external_oauth_tokens_user_provider ON external_oauth_tokens(user_id, provider_name);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_session_id ON oauth_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_log_tenant_id ON oauth_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_log_created_at ON oauth_audit_log(created_at);

-- Триггеры для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_oauth_clients_updated_at BEFORE UPDATE ON oauth_clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_oauth_users_updated_at BEFORE UPDATE ON oauth_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_external_oauth_providers_updated_at BEFORE UPDATE ON external_oauth_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_external_oauth_tokens_updated_at BEFORE UPDATE ON external_oauth_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_oauth_sessions_updated_at BEFORE UPDATE ON oauth_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Функция для очистки просроченных токенов
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Удаление просроченных access tokens
    DELETE FROM oauth_access_tokens WHERE expires_at < CURRENT_TIMESTAMP AND is_revoked = false;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Удаление просроченных refresh tokens
    DELETE FROM oauth_refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP AND is_revoked = false;
    
    -- Удаление просроченных authorization codes
    DELETE FROM oauth_authorization_codes WHERE expires_at < CURRENT_TIMESTAMP AND is_used = false;
    
    -- Удаление просроченных сессий
    DELETE FROM oauth_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Вставка базовых scope'ов
INSERT INTO oauth_scopes (name, display_name, description, is_default) VALUES
('read', 'Read Access', 'Read access to user data', true),
('write', 'Write Access', 'Write access to user data', false),
('admin', 'Admin Access', 'Administrative access', false),
('contacts:read', 'Read Contacts', 'Read access to contacts', false),
('contacts:write', 'Write Contacts', 'Write access to contacts', false),
('companies:read', 'Read Companies', 'Read access to companies', false),
('companies:write', 'Write Companies', 'Write access to companies', false),
('opportunities:read', 'Read Opportunities', 'Read access to opportunities', false),
('opportunities:write', 'Write Opportunities', 'Write access to opportunities', false),
('profile', 'Profile Access', 'Access to user profile information', true),
('email', 'Email Access', 'Access to user email address', true),
('openid', 'OpenID Connect', 'OpenID Connect authentication', true)
ON CONFLICT (name) DO NOTHING;

-- Вставка тестового клиента для разработки
INSERT INTO oauth_clients (
    client_id, 
    client_secret, 
    name, 
    description, 
    tenant_id, 
    redirect_uris, 
    allowed_grants, 
    allowed_scopes,
    pkce_required
) VALUES (
    'test-client-id',
    'test-client-secret',
    'Test OAuth2 Client',
    'Test client for development and testing',
    'default',
    ARRAY['http://localhost:3000/auth/callback', 'http://localhost:3001/auth/callback'],
    ARRAY['authorization_code', 'refresh_token', 'client_credentials'],
    ARRAY['read', 'write', 'profile', 'email', 'contacts:read', 'contacts:write'],
    true
) ON CONFLICT (client_id) DO NOTHING;

-- Вставка тестового пользователя
INSERT INTO oauth_users (
    email,
    password_hash,
    tenant_id,
    profile,
    email_verified
) VALUES (
    'test@example.com',
    '$2b$10$rRV.qGYQmOI/K.yJ8qY.quQI6M.VjGzl7g.Wt.KG8D.8K.YqY.qGYQ', -- password: 'password'
    'default',
    '{"name": "Test User", "avatar": "https://via.placeholder.com/150"}',
    true
) ON CONFLICT (email) DO NOTHING;

-- Комментарии к таблицам
COMMENT ON TABLE oauth_clients IS 'OAuth2 client applications registered in the system';
COMMENT ON TABLE oauth_users IS 'Users who can authenticate via OAuth2';
COMMENT ON TABLE oauth_access_tokens IS 'Issued OAuth2 access tokens';
COMMENT ON TABLE oauth_refresh_tokens IS 'Issued OAuth2 refresh tokens';
COMMENT ON TABLE oauth_authorization_codes IS 'Temporary authorization codes for OAuth2 flow';
COMMENT ON TABLE external_oauth_providers IS 'External OAuth providers configuration per tenant';
COMMENT ON TABLE external_oauth_tokens IS 'Tokens from external OAuth providers (Google, GitHub, etc.)';
COMMENT ON TABLE oauth_sessions IS 'OAuth2 session management';
COMMENT ON TABLE oauth_scopes IS 'Available OAuth2 scopes and permissions';
COMMENT ON TABLE oauth_audit_log IS 'Audit log for OAuth2 events and security monitoring';

-- Создание представления для активных токенов
CREATE OR REPLACE VIEW active_oauth_tokens AS
SELECT 
    t.id,
    t.token,
    t.client_id,
    c.name as client_name,
    t.user_id,
    u.email as user_email,
    t.tenant_id,
    t.scopes,
    t.expires_at,
    t.created_at
FROM oauth_access_tokens t
JOIN oauth_clients c ON t.client_id = c.client_id
LEFT JOIN oauth_users u ON t.user_id = u.id
WHERE t.is_revoked = false 
  AND t.expires_at > CURRENT_TIMESTAMP;

COMMENT ON VIEW active_oauth_tokens IS 'View of currently active (non-revoked, non-expired) OAuth2 access tokens';