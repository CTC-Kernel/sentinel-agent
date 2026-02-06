//! LEEF (Log Event Extended Format) formatter.
//!
//! Format: LEEF:Version|Vendor|Product|Version|EventID|Key1=Value1<tab>Key2=Value2...
//!
//! Used by: IBM QRadar.

use super::SiemFormatter;
use crate::{SiemEvent, SiemResult};

/// LEEF (Log Event Extended Format) event formatter.
pub struct LeefFormatter {
    vendor: String,
    product: String,
    version: String,
}

impl LeefFormatter {
    /// Create a new LEEF formatter with default vendor info.
    pub fn new() -> Self {
        Self {
            vendor: "Sentinel".to_string(),
            product: "GRC Agent".to_string(),
            version: "2.0".to_string(),
        }
    }

    /// Create a LEEF formatter with custom vendor info.
    pub fn with_vendor(vendor: String, product: String, version: String) -> Self {
        Self { vendor, product, version }
    }

    /// Escape special characters in LEEF header fields.
    fn escape_header(s: &str) -> String {
        s.replace('|', "\\|")
            .replace('\n', "\\n")
            .replace('\r', "\\r")
    }

    /// Escape special characters in LEEF attribute values.
    fn escape_value(s: &str) -> String {
        s.replace('\t', " ")
            .replace('\n', "\\n")
            .replace('\r', "\\r")
            .replace('=', "\\=")
    }

    /// Map severity (0-10) to LEEF severity.
    fn map_severity(severity: u8) -> &'static str {
        match severity {
            0..=2 => "Low",
            3..=4 => "Medium",
            5..=7 => "High",
            8..=10 => "Critical",
            _ => "Unknown",
        }
    }
}

impl Default for LeefFormatter {
    fn default() -> Self {
        Self::new()
    }
}

impl SiemFormatter for LeefFormatter {
    fn format(&self, event: &SiemEvent) -> SiemResult<String> {
        // LEEF header fields
        let leef_version = "2.0";
        let vendor = Self::escape_header(&self.vendor);
        let product = Self::escape_header(&self.product);
        let version = Self::escape_header(&self.version);
        let event_id = Self::escape_header(&event.name);

        // Build attributes (tab-separated key=value pairs)
        let mut attrs = Vec::new();

        // Standard LEEF attributes
        attrs.push(format!("devTime={}", event.timestamp.format("%b %d %Y %H:%M:%S %Z")));
        attrs.push("devTimeFormat=MMM dd yyyy HH:mm:ss z".to_string());
        attrs.push(format!("cat={}", Self::escape_value(&event.category.to_string())));
        attrs.push(format!("sev={}", Self::map_severity(event.severity)));
        attrs.push(format!("src={}", Self::escape_value(&event.source_host)));

        if let Some(ref src_ip) = event.source_ip {
            attrs.push(format!("srcIP={}", Self::escape_value(src_ip)));
        }

        if let Some(ref dst_ip) = event.destination_ip {
            attrs.push(format!("dstIP={}", Self::escape_value(dst_ip)));
        }

        if let Some(dst_port) = event.destination_port {
            attrs.push(format!("dstPort={}", dst_port));
        }

        if let Some(ref user) = event.user {
            attrs.push(format!("usrName={}", Self::escape_value(user)));
        }

        if let Some(ref process) = event.process_name {
            attrs.push(format!("procName={}", Self::escape_value(process)));
        }

        if let Some(pid) = event.process_id {
            attrs.push(format!("procId={}", pid));
        }

        if let Some(ref file_path) = event.file_path {
            attrs.push(format!("fileName={}", Self::escape_value(file_path)));
        }

        attrs.push(format!("msg={}", Self::escape_value(&event.description)));
        attrs.push(format!("eventId={}", Self::escape_value(&event.event_id)));
        attrs.push(format!("agentVersion={}", Self::escape_value(&event.agent_version)));

        // Add custom fields
        if let Some(obj) = event.custom_fields.as_object() {
            for (key, value) in obj {
                attrs.push(format!(
                    "{}={}",
                    Self::escape_value(key),
                    Self::escape_value(value.to_string().trim_matches('"'))
                ));
            }
        }

        // Build final LEEF message (attributes separated by tabs)
        let leef = format!(
            "LEEF:{}|{}|{}|{}|{}|{}",
            leef_version,
            vendor,
            product,
            version,
            event_id,
            attrs.join("\t")
        );

        Ok(leef)
    }

    fn name(&self) -> &'static str {
        "LEEF"
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
            destination_ip: Some("10.0.0.1".to_string()),
            destination_port: Some(443),
            user: Some("john.doe".to_string()),
            process_name: Some("suspicious.exe".to_string()),
            process_id: Some(1234),
            file_path: None,
            custom_fields: serde_json::json!({}),
            event_id: "evt-123".to_string(),
            agent_version: "2.0.0".to_string(),
        }
    }

    #[test]
    fn test_leef_format() {
        let formatter = LeefFormatter::new();
        let event = create_test_event();

        let result = formatter.format(&event).unwrap();

        assert!(result.starts_with("LEEF:2.0|Sentinel|GRC Agent|2.0|"));
        assert!(result.contains("srcIP=192.168.1.100"));
        assert!(result.contains("dstIP=10.0.0.1"));
        assert!(result.contains("sev=High"));
    }

    #[test]
    fn test_leef_severity_mapping() {
        assert_eq!(LeefFormatter::map_severity(0), "Low");
        assert_eq!(LeefFormatter::map_severity(2), "Low");
        assert_eq!(LeefFormatter::map_severity(4), "Medium");
        assert_eq!(LeefFormatter::map_severity(7), "High");
        assert_eq!(LeefFormatter::map_severity(10), "Critical");
    }

    #[test]
    fn test_leef_escape() {
        assert_eq!(LeefFormatter::escape_header("test|pipe"), "test\\|pipe");
        assert_eq!(LeefFormatter::escape_value("key=value"), "key\\=value");
    }
}
