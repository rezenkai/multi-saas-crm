use crate::{CrmEvent, processors::event_processor::ProcessedEvent};
use serde_json::Value;
use std::collections::HashMap;
use tracing::{debug, warn};

pub struct DataTransformer {
    // Add any transformation rules or configuration here
}

impl DataTransformer {
    pub fn new() -> Self {
        DataTransformer {}
    }

    pub async fn transform_event(&self, event: CrmEvent) -> Result<ProcessedEvent, Box<dyn std::error::Error>> {
        debug!("Transforming event: {}", event.event_type);

        let mut properties = HashMap::new();
        let mut metrics = HashMap::new();

        // Extract properties from payload
        if let Value::Object(payload_map) = &event.payload {
            for (key, value) in payload_map {
                match value {
                    Value::Number(n) => {
                        if let Some(float_val) = n.as_f64() {
                            metrics.insert(key.clone(), float_val);
                        }
                    }
                    _ => {
                        properties.insert(key.clone(), value.clone());
                    }
                }
            }
        }

        // Event-specific transformations
        match event.event_type.as_str() {
            "user_login" => self.transform_user_login(&event, &mut properties, &mut metrics)?,
            "lead_created" => self.transform_lead_created(&event, &mut properties, &mut metrics)?,
            "deal_updated" => self.transform_deal_updated(&event, &mut properties, &mut metrics)?,
            "email_sent" => self.transform_email_sent(&event, &mut properties, &mut metrics)?,
            "page_view" => self.transform_page_view(&event, &mut properties, &mut metrics)?,
            _ => {
                warn!("Unknown event type: {}", event.event_type);
                // Default transformation - just copy payload
            }
        }

        Ok(ProcessedEvent {
            tenant_id: event.tenant_id,
            event_type: event.event_type,
            user_id: event.user_id,
            timestamp: event.timestamp,
            properties,
            metrics,
        })
    }

    fn transform_user_login(
        &self,
        event: &CrmEvent,
        properties: &mut HashMap<String, Value>,
        metrics: &mut HashMap<String, f64>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Extract login-specific data
        if let Some(ip_address) = event.payload.get("ip_address") {
            properties.insert("ip_address".to_string(), ip_address.clone());
        }

        if let Some(user_agent) = event.payload.get("user_agent") {
            properties.insert("user_agent".to_string(), user_agent.clone());
        }

        // Add login success metric
        metrics.insert("login_success".to_string(), 1.0);

        Ok(())
    }

    fn transform_lead_created(
        &self,
        event: &CrmEvent,
        properties: &mut HashMap<String, Value>,
        metrics: &mut HashMap<String, f64>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Extract lead data
        if let Some(lead_source) = event.payload.get("source") {
            properties.insert("lead_source".to_string(), lead_source.clone());
        }

        if let Some(lead_score) = event.payload.get("score").and_then(|v| v.as_f64()) {
            metrics.insert("lead_score".to_string(), lead_score);
        }

        // Standard lead metrics
        metrics.insert("leads_created".to_string(), 1.0);

        Ok(())
    }

    fn transform_deal_updated(
        &self,
        event: &CrmEvent,
        properties: &mut HashMap<String, Value>,
        metrics: &mut HashMap<String, f64>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Extract deal data
        if let Some(stage) = event.payload.get("stage") {
            properties.insert("deal_stage".to_string(), stage.clone());
        }

        if let Some(amount) = event.payload.get("amount").and_then(|v| v.as_f64()) {
            metrics.insert("deal_amount".to_string(), amount);
        }

        if let Some(probability) = event.payload.get("probability").and_then(|v| v.as_f64()) {
            metrics.insert("deal_probability".to_string(), probability);
        }

        // Calculate expected value
        if let (Some(amount), Some(probability)) = (
            metrics.get("deal_amount"),
            metrics.get("deal_probability")
        ) {
            metrics.insert("expected_value".to_string(), amount * (probability / 100.0));
        }

        Ok(())
    }

    fn transform_email_sent(
        &self,
        event: &CrmEvent,
        properties: &mut HashMap<String, Value>,
        metrics: &mut HashMap<String, f64>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Extract email data
        if let Some(campaign_id) = event.payload.get("campaign_id") {
            properties.insert("campaign_id".to_string(), campaign_id.clone());
        }

        if let Some(template_id) = event.payload.get("template_id") {
            properties.insert("template_id".to_string(), template_id.clone());
        }

        // Email metrics
        metrics.insert("emails_sent".to_string(), 1.0);

        Ok(())
    }

    fn transform_page_view(
        &self,
        event: &CrmEvent,
        properties: &mut HashMap<String, Value>,
        metrics: &mut HashMap<String, f64>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Extract page view data
        if let Some(page_url) = event.payload.get("page_url") {
            properties.insert("page_url".to_string(), page_url.clone());
        }

        if let Some(referrer) = event.payload.get("referrer") {
            properties.insert("referrer".to_string(), referrer.clone());
        }

        if let Some(session_duration) = event.payload.get("session_duration").and_then(|v| v.as_f64()) {
            metrics.insert("session_duration".to_string(), session_duration);
        }

        // Page view metrics
        metrics.insert("page_views".to_string(), 1.0);

        Ok(())
    }
}