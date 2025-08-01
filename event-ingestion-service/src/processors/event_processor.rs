use crate::{CrmEvent, config::Config};
use crate::transformers::data_transformer::DataTransformer;
use clickhouse::Client;
use redis::aio::Connection;
use redis::AsyncCommands;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};
use tracing::{info, error, debug};

pub struct EventProcessor {
    clickhouse_client: Client,
    redis_connection: Arc<Mutex<Connection>>,
    transformer: DataTransformer,
    batch_buffer: Arc<Mutex<Vec<ProcessedEvent>>>,
    config: Config,
}

#[derive(Debug, Clone)]
pub struct ProcessedEvent {
    pub tenant_id: String,
    pub event_type: String,
    pub user_id: Option<String>,
    pub timestamp: i64,
    pub properties: HashMap<String, Value>,
    pub metrics: HashMap<String, f64>,
}

impl EventProcessor {
    pub async fn new(config: &Config) -> Result<Self, Box<dyn std::error::Error>> {
        // Initialize ClickHouse client
        let clickhouse_client = Client::default()
            .with_url(&config.clickhouse_url)
            .with_user(&config.clickhouse_user)
            .with_password(&config.clickhouse_password)
            .with_database(&config.clickhouse_database);

        // Test ClickHouse connection
        clickhouse_client.query("SELECT 1").fetch_all::<u8>().await?;
        info!("Connected to ClickHouse");

        // Initialize Redis connection
        let redis_client = redis::Client::open(config.redis_url.as_str())?;
        let redis_connection = Arc::new(Mutex::new(redis_client.get_async_connection().await?));
        info!("Connected to Redis");

        let processor = EventProcessor {
            clickhouse_client,
            redis_connection,
            transformer: DataTransformer::new(),
            batch_buffer: Arc::new(Mutex::new(Vec::new())),
            config: config.clone(),
        };

        // Start batch flush task
        processor.start_batch_flush_task().await;

        Ok(processor)
    }

    pub async fn process_event(&self, event: CrmEvent) -> Result<(), Box<dyn std::error::Error>> {
        debug!("Processing event: {:?}", event);

        // Transform the event
        let processed_event = self.transformer.transform_event(event).await?;

        // Add to batch buffer
        {
            let mut buffer = self.batch_buffer.lock().await;
            buffer.push(processed_event.clone());

            // Flush if batch is full
            if buffer.len() >= self.config.batch_size {
                let events_to_flush = buffer.drain(..).collect();
                drop(buffer); // Release lock early
                self.flush_events(events_to_flush).await?;
            }
        }

        // Update real-time metrics in Redis
        self.update_real_time_metrics(&processed_event).await?;

        Ok(())
    }

    async fn flush_events(&self, events: Vec<ProcessedEvent>) -> Result<(), Box<dyn std::error::Error>> {
        if events.is_empty() {
            return Ok(());
        }

        info!("Flushing {} events to ClickHouse", events.len());

        // Prepare bulk insert query
        let mut insert = self.clickhouse_client.insert("events")?;

        for event in events {
            insert.write(&ClickHouseEvent {
                tenant_id: event.tenant_id,
                event_type: event.event_type,
                user_id: event.user_id.unwrap_or_default(),
                timestamp: event.timestamp,
                properties: serde_json::to_string(&event.properties)?,
                metrics: serde_json::to_string(&event.metrics)?,
            }).await?;
        }

        insert.end().await?;
        info!("Successfully flushed events to ClickHouse");

        Ok(())
    }

    async fn update_real_time_metrics(&self, event: &ProcessedEvent) -> Result<(), Box<dyn std::error::Error>> {
        let mut conn = self.redis_connection.lock().await;
        
        // Update event counters
        let key = format!("metrics:{}:{}", event.tenant_id, event.event_type);
        let _: () = conn.incr(&key, 1).await?;
        let _: () = conn.expire(&key, 3600).await?; // 1 hour TTL

        // Update user activity
        if let Some(user_id) = &event.user_id {
            let user_key = format!("activity:{}:{}", event.tenant_id, user_id);
            let _: () = conn.set(&user_key, event.timestamp).await?;
            let _: () = conn.expire(&user_key, 86400).await?; // 24 hours TTL
        }

        Ok(())
    }

    async fn start_batch_flush_task(&self) {
        let batch_buffer = Arc::clone(&self.batch_buffer);
        let flush_interval = Duration::from_millis(self.config.flush_interval_ms);
        let clickhouse_client = self.clickhouse_client.clone();

        tokio::spawn(async move {
            let mut interval = interval(flush_interval);
            
            loop {
                interval.tick().await;
                
                let events_to_flush = {
                    let mut buffer = batch_buffer.lock().await;
                    if buffer.is_empty() {
                        continue;
                    }
                    buffer.drain(..).collect()
                };

                if let Err(e) = Self::flush_events_static(&clickhouse_client, events_to_flush).await {
                    error!("Error in batch flush task: {}", e);
                }
            }
        });
    }

    async fn flush_events_static(
        clickhouse_client: &Client,
        events: Vec<ProcessedEvent>
    ) -> Result<(), Box<dyn std::error::Error>> {
        if events.is_empty() {
            return Ok(());
        }

        let mut insert = clickhouse_client.insert("events")?;

        for event in events {
            insert.write(&ClickHouseEvent {
                tenant_id: event.tenant_id,
                event_type: event.event_type,
                user_id: event.user_id.unwrap_or_default(),
                timestamp: event.timestamp,
                properties: serde_json::to_string(&event.properties)?,
                metrics: serde_json::to_string(&event.metrics)?,
            }).await?;
        }

        insert.end().await?;
        Ok(())
    }
}

#[derive(Debug, serde::Serialize, clickhouse::Row)]
struct ClickHouseEvent {
    tenant_id: String,
    event_type: String,
    user_id: String,
    timestamp: i64,
    properties: String,
    metrics: String,
}