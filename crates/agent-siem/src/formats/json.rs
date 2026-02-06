//! JSON formatter for SIEM integration.
//!
//! Produces structured JSON suitable for:
//! - Splunk (with sourcetype configuration)
//! - Elastic/ELK (with index template)
//! - Azure Sentinel (with data connector)
//! - Any JSON-capable SIEM

use super::SiemFormatter;
use crate::{SiemEvent, SiemResult};
use serde::Serialize;

/// JSON event formatter.
pub struct JsonFormatter {
    /// Whether to pretty-print JSON (default: false for production).
    pretty: bool,
    /// Include Splunk-specific fields.
    splunk_mode: bool,
    /// Include Elastic-specific fields.
    elastic_mode: bool,
}

impl JsonFormatter {
    /// Create a new JSON formatter.
    pub fn new() -> Self {
        Self {
            pretty: false,
            splunk_mode: false,
            elastic_mode: false,
        }
    }

    /// Enable pretty-printing.
    pub fn pretty(mut self) -> Self {
        self.pretty = true;
        self
    }

    /// Enable Splunk-specific fields.
    pub fn for_splunk(mut self) -> Self {
        self.splunk_mode = true;
        self
    }

    /// Enable Elastic-specific fields.
    pub fn for_elastic(mut self) -> Self {
        self.elastic_mode = true;
        self
    }
}

impl Default for JsonFormatter {
    fn default() -> Self {
        Self::new()
    }
}

/// Internal JSON structure for Splunk HEC.
#[derive(Serialize)]
struct SplunkEvent<'a> {
    time: i64,
    host: &'a str,
    source: &'static str,
    sourcetype: &'static str,
    event: &'a SiemEvent,
}

/// Internal JSON structure for Elastic.
#[derive(Serialize)]
struct ElasticEvent<'a> {
    #[serde(rename = "@timestamp")]
    timestamp: String,
    #[serde(flatten)]
    event: &'a SiemEvent,
    #[serde(rename = "ecs.version")]
    ecs_version: &'static str,
    #[serde(rename = "event.kind")]
    event_kind: &'static str,
    #[serde(rename = "event.module")]
    event_module: &'static str,
}

impl SiemFormatter for JsonFormatter {
    fn format(&self, event: &SiemEvent) -> SiemResult<String> {
        let json = if self.splunk_mode {
            // Splunk HEC format
            let splunk_event = SplunkEvent {
                time: event.timestamp.timestamp(),
                host: &event.source_host,
                source: "sentinel-agent",
                sourcetype: "sentinel:grc:event",
                event,
            };

            if self.pretty {
                serde_json::to_string_pretty(&splunk_event)?
            } else {
                serde_json::to_string(&splunk_event)?
            }
        } else if self.elastic_mode {
            // Elastic ECS format
            let elastic_event = ElasticEvent {
                timestamp: event.timestamp.to_rfc3339(),
                event,
                ecs_version: "8.0",
                event_kind: "event",
                event_module: "sentinel-grc",
            };

            if self.pretty {
                serde_json::to_string_pretty(&elastic_event)?
            } else {
                serde_json::to_string(&elastic_event)?
            }
        } else {
            // Generic JSON
            if self.pretty {
                serde_json::to_string_pretty(event)?
            } else {
                serde_json::to_string(event)?
            }
        };

        Ok(json)
    }

    fn name(&self) -> &'static str {
        "JSON"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::EventCategory;
    use chrono::Utc;

    fn create_test_event() -> SiemEvent {
        SiemEvent {
            timestamp: Utc::now(),
            severity: 7,
            category: EventCategory::Security,
            name: "Malware Detected".to_string(),
            description: "Suspicious process detected".to_string(),
            source_host: "workstation-01".to_string(),
            source_ip: Some("192.168.1.100".to_string()),
            destination_ip: None,
            destination_port: None,
            user: Some("john.doe".to_string()),
            process_name: Some("suspicious.exe".to_string()),
            process_id: Some(1234),
            file_path: None,
            custom_fields: serde_json::json!({"check_id": "antivirus"}),
            event_id: "evt-123".to_string(),
            agent_version: "2.0.0".to_string(),
        }
    }

    #[test]
    fn test_json_format_generic() {
        let formatter = JsonFormatter::new();
        let event = create_test_event();

        let result = formatter.format(&event).unwrap();

        assert!(result.contains("Malware Detected"));
        assert!(result.contains("workstation-01"));
        assert!(result.contains("security")); // category serialized as snake_case
    }

    #[test]
    fn test_json_format_splunk() {
        let formatter = JsonFormatter::new().for_splunk();
        let event = create_test_event();

        let result = formatter.format(&event).unwrap();

        assert!(result.contains("sourcetype"));
        assert!(result.contains("sentinel:grc:event"));
        assert!(result.contains("\"time\":"));
    }

    #[test]
    fn test_json_format_elastic() {
        let formatter = JsonFormatter::new().for_elastic();
        let event = create_test_event();

        let result = formatter.format(&event).unwrap();

        assert!(result.contains("@timestamp"));
        assert!(result.contains("ecs.version"));
        assert!(result.contains("event.module"));
    }

    #[test]
    fn test_json_pretty() {
        let formatter = JsonFormatter::new().pretty();
        let event = create_test_event();

        let result = formatter.format(&event).unwrap();

        // Pretty-printed JSON has newlines
        assert!(result.contains('\n'));
    }
}
