import { createClient } from '@clickhouse/client';

/**
 * Сервис для работы с ClickHouse
 * Используется для аналитических запросов по большим данным
 */
export class ClickHouseService {
    private client: any;

    constructor() {
        this.client = createClient({
            host: `http://${process.env.CLICKHOUSE_HOST || 'clickhouse-analytics'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
            database: process.env.CLICKHOUSE_DB || 'default',
            username: process.env.CLICKHOUSE_USER || 'default',
            password: process.env.CLICKHOUSE_PASSWORD || ''
        });
    }

    /**
     * Выполнить запрос к ClickHouse
     */
    async query(sql: string, params?: any[]): Promise<{ data: any[] }> {
        try {
            console.log(`Executing ClickHouse query: ${sql}`);
            
            const result = await this.client.query({
                query: sql,
                format: 'JSONEachRow'
            });

            const data = await result.json();
            
            console.log(`ClickHouse query returned ${data.length} rows`);
            
            return { data };
        } catch (error) {
            console.error('ClickHouse query error:', error);
            throw new Error(`ClickHouse query failed: ${error}`);
        }
    }

    /**
     * Выполнить запрос с агрегацией
     */
    async aggregateQuery(sql: string): Promise<{ data: any[], summary: any }> {
        const result = await this.query(sql);
        
        // Простая агрегация для summary
        const summary = {
            totalRows: result.data.length,
            queryExecutedAt: new Date().toISOString()
        };

        return {
            data: result.data,
            summary
        };
    }

    /**
     * Проверить подключение к ClickHouse
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.query('SELECT 1 as health');
            return true;
        } catch (error) {
            console.error('ClickHouse health check failed:', error);
            return false;
        }
    }

    /**
     * Создать таблицы для CRM аналитики если их нет
     */
    async initializeTables(): Promise<void> {
        const tables = [
            // Таблица сделок
            `
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
                tenant_id String
            ) ENGINE = MergeTree()
            ORDER BY (tenant_id, created_date, id)
            `,
            
            // Таблица лидов
            `
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
                tenant_id String
            ) ENGINE = MergeTree()
            ORDER BY (tenant_id, created_date, id)
            `,
            
            // Таблица активности
            `
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
                tenant_id String
            ) ENGINE = MergeTree()
            ORDER BY (tenant_id, created_date, id)
            `
        ];

        for (const table of tables) {
            try {
                await this.query(table);
                console.log('✅ ClickHouse table created/verified');
            } catch (error) {
                console.error('❌ Failed to create ClickHouse table:', error);
                throw error;
            }
        }
    }

    /**
     * Закрыть подключение
     */
    async close(): Promise<void> {
        await this.client.close();
    }
}