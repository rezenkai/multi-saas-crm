import { Pool, PoolClient } from 'pg';

/**
 * Сервис для работы с PostgreSQL
 * Используется для запросов к основной CRM базе данных
 */
export class PostgresService {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'postgres-analytics-fresh',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'salesforce_clone',
            user: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }

    /**
     * Выполнить запрос к PostgreSQL
     */
    async query(sql: string, params?: any[]): Promise<{ rows: any[], rowCount: number }> {
        const client = await this.pool.connect();
        try {
            console.log(`Executing PostgreSQL query: ${sql}`);
            
            const result = await client.query(sql, params);
            
            console.log(`PostgreSQL query returned ${result.rowCount} rows`);
            
            return {
                rows: result.rows,
                rowCount: result.rowCount || 0
            };
        } catch (error) {
            console.error('PostgreSQL query error:', error);
            throw new Error(`PostgreSQL query failed: ${error}`);
        } finally {
            client.release();
        }
    }

    /**
     * Получить список пользователей (менеджеров)
     */
    async getManagers(): Promise<any[]> {
        const query = `
            SELECT 
                id,
                name,
                email,
                role,
                department_id,
                created_at
            FROM users 
            WHERE role IN ('manager', 'sales_manager', 'admin')
            ORDER BY name
        `;
        
        const result = await this.query(query);
        return result.rows;
    }

    /**
     * Получить информацию о сделках для синхронизации с ClickHouse
     */
    async getDealsForSync(lastSyncDate?: string): Promise<any[]> {
        let query = `
            SELECT 
                d.id,
                d.name,
                d.amount,
                d.stage,
                CASE 
                    WHEN d.stage = 'prospecting' THEN 1
                    WHEN d.stage = 'qualification' THEN 2
                    WHEN d.stage = 'needs_analysis' THEN 3
                    WHEN d.stage = 'value_proposition' THEN 4
                    WHEN d.stage = 'decision_makers' THEN 5
                    WHEN d.stage = 'proposal' THEN 6
                    WHEN d.stage = 'negotiation' THEN 7
                    WHEN d.stage = 'closed_won' THEN 8
                    WHEN d.stage = 'closed_lost' THEN 9
                    ELSE 0
                END as stage_order,
                d.status,
                d.owner_id as manager_id,
                u.name as manager_name,
                d.lead_id,
                d.created_at as created_date,
                d.closed_date,
                EXTRACT(EPOCH FROM (COALESCE(d.closed_date, NOW()) - d.created_at)) / 86400 as days_in_stage,
                d.tenant_id
            FROM opportunities d
            LEFT JOIN users u ON d.owner_id = u.id
            WHERE 1=1
        `;

        const params = [];
        if (lastSyncDate) {
            query += ` AND d.updated_at > $1`;
            params.push(lastSyncDate);
        }

        query += ` ORDER BY d.updated_at DESC`;

        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Получить информацию о лидах для синхронизации с ClickHouse
     */
    async getLeadsForSync(lastSyncDate?: string): Promise<any[]> {
        let query = `
            SELECT 
                l.id,
                l.name,
                l.email,
                l.source_type,
                l.source_name,
                l.status,
                l.estimated_value,
                l.owner_id as manager_id,
                u.name as manager_name,
                l.created_at as created_date,
                l.qualified_date,
                l.converted_date,
                l.tenant_id
            FROM leads l
            LEFT JOIN users u ON l.owner_id = u.id
            WHERE 1=1
        `;

        const params = [];
        if (lastSyncDate) {
            query += ` AND l.updated_at > $1`;
            params.push(lastSyncDate);
        }

        query += ` ORDER BY l.updated_at DESC`;

        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Получить информацию об активности для синхронизации с ClickHouse
     */
    async getActivitiesForSync(lastSyncDate?: string): Promise<any[]> {
        let query = `
            SELECT 
                t.id,
                t.task_type,
                t.subject,
                t.status,
                t.assigned_to_id as manager_id,
                u.name as manager_name,
                u.department_id,
                d.name as department_name,
                EXTRACT(EPOCH FROM (t.completed_date - t.created_at)) / 60 as task_duration_minutes,
                t.created_at as created_date,
                t.completed_date,
                t.related_entity_type,
                t.related_entity_id,
                t.tenant_id
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to_id = u.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE 1=1
        `;

        const params = [];
        if (lastSyncDate) {
            query += ` AND t.updated_at > $1`;
            params.push(lastSyncDate);
        }

        query += ` ORDER BY t.updated_at DESC`;

        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Проверить подключение к PostgreSQL
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.query('SELECT 1 as health');
            return true;
        } catch (error) {
            console.error('PostgreSQL health check failed:', error);
            return false;
        }
    }

    /**
     * Закрыть пул подключений
     */
    async close(): Promise<void> {
        await this.pool.end();
    }
}