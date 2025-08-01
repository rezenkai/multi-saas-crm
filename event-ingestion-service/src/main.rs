use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::{ClientConfig, Message};
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};

mod config;
mod processors;
mod transformers;

use config::Config;
use processors::event_processor::EventProcessor;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct CrmEvent {
    pub tenant_id: String,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub timestamp: i64,
    pub source: Option<String>,
    pub user_id: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();
    
    info!("Starting Event Ingestion Service");
    
    // Load configuration
    let config = Config::from_env()?;
    
    // Initialize event processor
    let processor = EventProcessor::new(&config).await?;
    
    // Create Kafka consumer
    let consumer = create_consumer(&config)?;
    let topics: Vec<&str> = config.kafka_topics.iter().map(|s| s.as_str()).collect();
    consumer.subscribe(&topics)?;
    
    info!("Connected to Kafka, starting message processing...");
    
    // Process messages
    loop {
        match consumer.recv().await {
            Ok(message) => {
                if let Err(e) = process_message(&processor, message).await {
                    error!("Error processing message: {}", e);
                }
            }
            Err(e) => {
                error!("Error receiving message: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        }
    }
}

fn create_consumer(config: &Config) -> Result<StreamConsumer, Box<dyn std::error::Error>> {
    let consumer: StreamConsumer = ClientConfig::new()
        .set("group.id", &config.kafka_group_id)
        .set("bootstrap.servers", &config.kafka_brokers)
        .set("enable.partition.eof", "false")
        .set("session.timeout.ms", "6000")
        .set("enable.auto.commit", "true")
        .set("auto.offset.reset", "latest")
        .create()?;
    
    Ok(consumer)
}

async fn process_message(
    processor: &EventProcessor,
    message: rdkafka::message::BorrowedMessage<'_>
) -> Result<(), Box<dyn std::error::Error>> {
    let payload = match message.payload() {
        Some(payload) => payload,
        None => {
            warn!("Received empty message");
            return Ok(());
        }
    };
    
    // Parse the event
    let event: CrmEvent = serde_json::from_slice(payload)?;
    
    info!("Processing event: {} for tenant: {}", event.event_type, event.tenant_id);
    
    // Process the event
    processor.process_event(event).await?;
    
    Ok(())
}