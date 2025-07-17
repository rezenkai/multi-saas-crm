-- Инициализация базы данных Salesforce Clone
-- Создание расширений для PostgreSQL

-- Создание расширения для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Создание расширения для полнотекстового поиска
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Создание схемы для приложения
CREATE SCHEMA IF NOT EXISTS app;

-- Логирование инициализации
DO $$
BEGIN
    RAISE NOTICE 'Salesforce Clone database extensions initialized successfully';
END $$; 