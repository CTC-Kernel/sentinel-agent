//! SIEM event enrichment with AI classification.
//!
//! When the `llm` feature is enabled, this module enriches SIEM events with
//! AI-driven classification metadata before they are forwarded to external
//! SIEM platforms. The enrichment adds MITRE ATT&CK context, threat-level
//! assessment, and confidence scores to the event's `custom_fields`.

use agent_siem::SiemEvent;
#[cfg(feature = "llm")]
use tracing::debug;

/// Enrich a SIEM event with AI classification data.
///
/// Adds `ai_classification`, `ai_confidence`, `threat_level`, `mitre_tactic`,
/// and `mitre_technique` to the event's `custom_fields`.
/// Existing custom fields are preserved and merged.
///
/// This is a no-op if the LLM service is unavailable or classification fails.
#[cfg(feature = "llm")]
pub async fn enrich_siem_event(
    event: &mut SiemEvent,
    llm_service: &crate::llm_service::LLMService,
) {
    if !llm_service.is_available().await {
        return;
    }

    let manager = match llm_service.get_manager().await {
        Some(m) => m,
        None => return,
    };

    let sec_event = agent_llm::SecurityEvent {
        id: event.event_id.clone(),
        event_type: format!("{:?}", event.category),
        description: event.description.clone(),
        system_info: event.source_host.clone(),
        historical_context: String::new(),
        timestamp: event.timestamp,
        source: "siem_forwarder".to_string(),
        severity: event.severity.to_string(),
        raw_data: event.custom_fields.clone(),
    };

    match manager.classifier().classify_event(&sec_event).await {
        Ok(classification) => {
            // Merge AI fields into existing custom_fields
            let mut fields = match &event.custom_fields {
                serde_json::Value::Object(map) => map.clone(),
                _ => serde_json::Map::new(),
            };
            fields.insert(
                "ai_classification".to_string(),
                serde_json::json!(format!("{:?}", classification.threat_type)),
            );
            fields.insert(
                "ai_confidence".to_string(),
                serde_json::json!(classification.confidence),
            );
            fields.insert(
                "threat_level".to_string(),
                serde_json::json!(format!("{:?}", classification.threat_level)),
            );
            if !classification.tactics.is_empty() {
                fields.insert(
                    "mitre_tactic".to_string(),
                    serde_json::json!(classification.tactics.join(", ")),
                );
            }
            if !classification.techniques.is_empty() {
                fields.insert(
                    "mitre_technique".to_string(),
                    serde_json::json!(classification.techniques.join(", ")),
                );
            }

            event.custom_fields = serde_json::Value::Object(fields);
            debug!(
                "SIEM event {} enriched with AI classification: {:?} (confidence: {}%)",
                event.event_id, classification.threat_type, classification.confidence
            );
        }
        Err(e) => {
            debug!("SIEM AI enrichment failed for event {}: {}", event.event_id, e);
        }
    }
}

/// No-op enrichment when LLM feature is disabled.
#[cfg(not(feature = "llm"))]
pub async fn enrich_siem_event(_event: &mut SiemEvent) {
    // No-op: AI enrichment requires the `llm` feature.
}
