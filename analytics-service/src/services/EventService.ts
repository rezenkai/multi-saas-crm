import { Pool, PoolClient } from 'pg';
import { Redis } from 'ioredis';
import { db } from '../config/database';
import { AnalyticsEvent, CRMEventType, EventBuilder } from '../models/Event';
import { config } from '../config';

export class EventService {
  private redis?: Redis;
  private batchQueue: AnalyticsEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Инициализируем Redis для буферизации событий
    if (config.redis.host) {
      this.redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.database,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.on('error', (err: any) => {
        console.error('❌ Redis connection error in EventService:', err);
      });

      this.redis.on('connect', () => {
        console.log('✅ EventService connected to Redis');
      });
    }

    // Запускаем периодическую обработку очереди
    this.startBatchProcessor();
  }

  /**
   * Трекинг одного события
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Валидация события
      this.validateEvent(event);

      // Добавляем timestamp если не задан
      if (!event.timestamp) {
        event.timestamp = new Date();
      }

      // Если батчинг отключен, сразу записываем в БД
      if (config.analytics.batchSize === 1) {
        await this.insertEvent(event);
        return;
      }

      // Добавляем в очередь для батчинга
      this.batchQueue.push(event);

      // Кэшируем в Redis для быстрого доступа
      if (this.redis) {
        const key = `event:${event.tenant_id}:${Date.now()}:${Math.random()}`;
        await this.redis.setex(key, 300, JSON.stringify(event)); // 5 минут TTL
      }

      // Если очередь достигла максимального размера, сбрасываем
      if (this.batchQueue.length >= config.analytics.batchSize) {
        await this.flushBatch();
      }

    } catch (error) {
      console.error('❌ Error tracking event:', error);
      // Не бросаем ошибку чтобы не сломать основной процесс
      
      // Пытаемся сохранить в Redis для повторной обработки
      if (this.redis && event.tenant_id) {
        const failedKey = `failed_event:${event.tenant_id}:${Date.now()}`;
        await this.redis.setex(failedKey, 3600, JSON.stringify(event)); // 1 час TTL
      }
    }
  }

  /**
   * Батчевый трекинг событий
   */
  async trackBatch(events: AnalyticsEvent[]): Promise<void> {
    if (!events || events.length === 0) return;

    try {
      // Валидируем все события
      events.forEach(event => this.validateEvent(event));

      // Добавляем timestamp для событий без него
      const eventsWithTimestamp = events.map(event => ({
        ...event,
        timestamp: event.timestamp || new Date()
      }));

      await this.insertBatch(eventsWithTimestamp);
      
      console.log(`✅ Batch tracked: ${events.length} events`);

    } catch (error) {
      console.error('❌ Error tracking batch:', error);
      
      // Пытаемся сохранить каждое событие индивидуально
      for (const event of events) {
        try {
          await this.trackEvent(event);
        } catch (individualError) {
          console.error('❌ Error tracking individual event from failed batch:', individualError);
        }
      }
    }
  }

  /**
   * Обновление сессии пользователя
   */
  async updateSession(sessionId: string, tenantId: string, userId?: string): Promise<void> {
    const client = await db.connect();
    
    try {
      const query = `
        INSERT INTO user_sessions (tenant_id, user_id, session_id, page_views, events_count, last_activity)
        VALUES ($1, $2, $3, 0, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (session_id) DO UPDATE SET
          last_activity = CURRENT_TIMESTAMP,
          events_count = user_sessions.events_count + 1,
          duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - user_sessions.started_at))::INTEGER
      `;
      
      await client.query(query, [tenantId, userId, sessionId]);

    } finally {
      client.release();
    }
  }

  /**
   * Создание события для CRM действий
   */
  createCRMEvent(tenantId: string, userId: string, eventType: CRMEventType, properties?: any): AnalyticsEvent {
    return EventBuilder.create()
      .tenantId(tenantId)
      .userId(userId)
      .eventName(eventType)
      .properties(properties || {})
      .build();
  }

  /**
   * Получение недавних событий пользователя
   */
  async getUserEvents(tenantId: string, userId: string, limit: number = 50): Promise<AnalyticsEvent[]> {
    const client = await db.connect();
    
    try {
      const query = `
        SELECT id, tenant_id, user_id, event_name, properties, timestamp, session_id, ip_address, user_agent
        FROM analytics_events 
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY timestamp DESC 
        LIMIT $3
      `;
      
      const result = await client.query(query, [tenantId, userId, limit]);
      return result.rows.map(row => ({
        ...row,
        properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties
      }));

    } finally {
      client.release();
    }
  }

  /**
   * Получение событий по сессии
   */
  async getSessionEvents(sessionId: string, tenantId: string): Promise<AnalyticsEvent[]> {
    const client = await db.connect();
    
    try {
      const query = `
        SELECT id, tenant_id, user_id, event_name, properties, timestamp, session_id, ip_address, user_agent
        FROM analytics_events 
        WHERE tenant_id = $1 AND session_id = $2
        ORDER BY timestamp ASC
      `;
      
      const result = await client.query(query, [tenantId, sessionId]);
      return result.rows.map(row => ({
        ...row,
        properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties
      }));

    } finally {
      client.release();
    }
  }

  /**
   * Получение популярных событий
   */
  async getTopEvents(tenantId: string, days: number = 7, limit: number = 20): Promise<Array<{event_name: string, count: number}>> {
    const client = await db.connect();
    
    try {
      const query = `
        SELECT event_name, COUNT(*) as count
        FROM analytics_events 
        WHERE tenant_id = $1 
          AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
        GROUP BY event_name
        ORDER BY count DESC 
        LIMIT $2
      `;
      
      const result = await client.query(query, [tenantId, limit]);
      return result.rows.map(row => ({
        event_name: row.event_name,
        count: parseInt(row.count)
      }));

    } finally {
      client.release();
    }
  }

  /**
   * Приватные методы
   */
  private validateEvent(event: AnalyticsEvent): void {
    if (!event.tenant_id) {
      throw new Error('tenant_id is required');
    }
    
    if (!event.event_name) {
      throw new Error('event_name is required');
    }

    if (event.event_name.length > 255) {
      throw new Error('event_name cannot exceed 255 characters');
    }

    // Валидация UUID для tenant_id и user_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(event.tenant_id)) {
      throw new Error('tenant_id must be a valid UUID');
    }

    if (event.user_id && !uuidRegex.test(event.user_id)) {
      throw new Error('user_id must be a valid UUID');
    }

    // Валидация properties размера (не более 64KB)
    if (event.properties) {
      const propertiesSize = JSON.stringify(event.properties).length;
      if (propertiesSize > 65536) {
        throw new Error('properties object is too large (max 64KB)');
      }
    }
  }

  private async insertEvent(event: AnalyticsEvent): Promise<void> {
    const client = await db.connect();
    
    try {
      const query = `
        INSERT INTO analytics_events 
        (tenant_id, user_id, event_name, properties, timestamp, session_id, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      await client.query(query, [
        event.tenant_id,
        event.user_id,
        event.event_name,
        JSON.stringify(event.properties || {}),
        event.timestamp || new Date(),
        event.session_id,
        event.ip_address,
        event.user_agent
      ]);

      // Обновляем сессию если есть session_id
      if (event.session_id) {
        await this.updateSession(event.session_id, event.tenant_id, event.user_id);
      }

    } finally {
      client.release();
    }
  }

  private async insertBatch(events: AnalyticsEvent[]): Promise<void> {
    if (events.length === 0) return;

    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      const values: any[] = [];
      const placeholders: string[] = [];
      
      events.forEach((event, index) => {
        const baseIndex = index * 8;
        placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`);
        
        values.push(
          event.tenant_id,
          event.user_id,
          event.event_name,
          JSON.stringify(event.properties || {}),
          event.timestamp || new Date(),
          event.session_id,
          event.ip_address,
          event.user_agent
        );
      });

      const query = `
        INSERT INTO analytics_events 
        (tenant_id, user_id, event_name, properties, timestamp, session_id, ip_address, user_agent)
        VALUES ${placeholders.join(', ')}
      `;

      await client.query(query, values);
      await client.query('COMMIT');

      // Обновляем сессии для событий с session_id
      const sessionUpdates = events
        .filter(event => event.session_id)
        .map(event => this.updateSession(event.session_id!, event.tenant_id, event.user_id));
      
      await Promise.allSettled(sessionUpdates);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private startBatchProcessor(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(async () => {
      if (this.batchQueue.length > 0) {
        await this.flushBatch();
      }
    }, config.analytics.flushInterval);
  }

  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const eventsToFlush = [...this.batchQueue];
    this.batchQueue = [];

    try {
      await this.insertBatch(eventsToFlush);
      console.log(`✅ Flushed ${eventsToFlush.length} events to database`);
      
      // Очищаем кэш Redis для успешно сохраненных событий
      if (this.redis) {
        const keys = await this.redis.keys('event:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

    } catch (error) {
      console.error('❌ Error flushing batch:', error);
      
      // Возвращаем события обратно в очередь для повторной попытки
      this.batchQueue.unshift(...eventsToFlush);
      
      // Ограничиваем размер очереди чтобы избежать переполнения памяти
      if (this.batchQueue.length > config.analytics.batchSize * 10) {
        const droppedEvents = this.batchQueue.splice(config.analytics.batchSize * 5);
        console.warn(`⚠️  Dropped ${droppedEvents.length} events due to queue overflow`);
      }
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🔄 EventService shutting down...');
    
    // Останавливаем batch processor
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Сбрасываем оставшиеся события
    if (this.batchQueue.length > 0) {
      console.log(`🔄 Flushing ${this.batchQueue.length} remaining events...`);
      await this.flushBatch();
    }

    // Закрываем Redis подключение
    if (this.redis) {
      await this.redis.quit();
    }

    console.log('✅ EventService shutdown complete');
  }
}