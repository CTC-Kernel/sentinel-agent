//! CEF (Common Event Format) formatter.
//!
//! Format: CEF:Version|Device Vendor|Device Product|Device Version|Signature ID|Name|Severity|Extension
//!
//! Used by: ArcSight, QRadar, and other SIEM solutions.

use super::SiemFormatter;
use crate::{SiemEvent, SiemResult};

/// CEF (Common Event Format) event formatter.
pub struct CefFormatter {
    vendor: String,
    product: String,
    version: String,
}

impl CefFormatter {
    /// Create a new CEF formatter with default vendor info.
    pub fn new() -> Self {
        Self {
            vendor: "Sentinel".to_string(),
            product: "GRC Agent".to_string(),
            version: "2.0".to_string(),
        }
    }

    /// Create a CEF formatter with custom vendor info.
    pub fn with_vendor(vendor: String, product: String, version: String) -> Self {
        Self {
            vendor,
            product,
            version,
        }
    }

    /// Escape special characters in CEF fields.
    fn escape_field(s: &str) -> String {
        s.replace('\\', "\\\\")
            .replace('|', "\\|")
            .replace('\n', "\\n")
            .replace('\r', "\\r")
    }

    /// Escape special characters in CEF extension values.
    fn escape_extension(s: &str) -> String {
        s.replace('\\', "\\\\")
            .replace('=', "\\=")
            .replace('\n', "\\n")
            .replace('\r', "\\r")
    }

    /// Map severity (0-10) to CEF severity (0-10).
    fn map_severity(severity: u8) -> u8 {
        severity.min(10)
    }
}

impl Default for CefFormatter {
    fn default() -> Self {
        Self::new()
    }
}

impl SiemFormatter for CefFormatter {
    fn format(&self, event: &SiemEvent) -> SiemResult<String> {
        // CEF header fields
        let cef_version = "0";
        let vendor = Self::escape_field(&self.vendor);
        let product = Self::escape_field(&self.product);
        let version = Self::escape_field(&self.version);
        let signature_id = Self::escape_field(&event.event_id);
        let name = Self::escape_field(&event.name);
        let severity = Self::map_severity(event.severity);

        // Build extension fields
        let mut extensions = Vec::new();

        // Standard CEF extension fields
        extensions.push(format!(
            "rt={}",
            event.timestamp.format("%b %d %Y %H:%M:%S")
        ));
        extensions.push(format!(
            "cat={}",
            Self::escape_extension(&event.category.to_string())
        ));
        extensions.push(format!(
            "msg={}",
            Self::escape_extension(&event.description)
        ));
        extensions.push(format!(
            "shost={}",
            Self::escape_extension(&event.source_host)
        ));

        if let Some(ref src_ip) = event.source_ip {
            extensions.push(format!("src={}", Self::escape_extension(src_ip)));
        }

        if let Some(ref dst_ip) = event.destination_ip {
            extensions.push(format!("dst={}", Self::escape_extension(dst_ip)));
        }

        if let Some(dst_port) = event.destination_port {
            extensions.push(format!("dpt={}", dst_port));
        }

        if let Some(ref user) = event.user {
            extensions.push(format!("suser={}", Self::escape_extension(user)));
        }

        if let Some(ref process) = event.process_name {
            extensions.push(format!("sproc={}", Self::escape_extension(process)));
        }

        if let Some(pid) = event.process_id {
            extensions.push(format!("spid={}", pid));
        }

        if let Some(ref file_path) = event.file_path {
            extensions.push(format!("filePath={}", Self::escape_extension(file_path)));
        }

        extensions.push(format!(
            "externalId={}",
            Self::escape_extension(&event.event_id)
        ));
        extensions.push(format!(
            "cs1Label=agentVersion cs1={}",
            Self::escape_extension(&event.agent_version)
        ));

        // Add custom fields
        if let Some(obj) = event.custom_fields.as_object() {
            for (i, (key, value)) in obj.iter().enumerate().take(6) {
                // CEF supports cs1-cs6 for custom strings
                let cs_num = i + 2; // cs2-cs6 (cs1 used for agent version)
                if cs_num <= 6 {
                    extensions.push(format!(
                        "cs{}Label={} cs{}={}",
                        cs_num,
                        Self::escape_extension(key),
                        cs_num,
                        Self::escape_extension(value.to_string().trim_matches('"'))
                    ));
                }
            }
        }

        // Build final CEF message
        let cef = format!(
            "CEF:{}|{}|{}|{}|{}|{}|{}|{}",
            cef_version,
            vendor,
            product,
            version,
            signature_id,
            name,
            severity,
            extensions.join(" ")
        );

        Ok(cef)
    }

    fn name(&self) -> &'static str {
        "CEF"
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
            description: "Suspicious process detected on system".to_string(),
            source_host: "workstation-01".to_string(),
            source_ip: Some("192.168.1.100".to_string()),
            destination_ip: Some("10.0.0.1".to_string()),
            destination_port: Some(443),
            user: Some("john.doe".to_string()),
            process_name: Some("suspicious.exe".to_string()),
            process_id: Some(1234),
            file_path: Some("C:\\Users\\john\\suspicious.exe".to_string()),
            custom_fields: serde_json::json!({"check_id": "antivirus", "framework": "NIS2"}),
            event_id: "evt-123-456".to_string(),
            agent_version: "2.0.0".to_string(),
        }
    }

    #[test]
    fn test_cef_format() {
        let formatter = CefFormatter::new();
        let event = create_test_event();

        let result = formatter.format(&event).unwrap();

        assert!(result.starts_with("CEF:0|Sentinel|GRC Agent|2.0|"));
        assert!(result.contains("Malware Detected"));
        assert!(result.contains("src=192.168.1.100"));
        assert!(result.contains("dst=10.0.0.1"));
        assert!(result.contains("dpt=443"));
        assert!(result.contains("suser=john.doe"));
    }

    #[test]
    fn test_cef_escape() {
        assert_eq!(CefFormatter::escape_field("test|pipe"), "test\\|pipe");
        assert_eq!(CefFormatter::escape_field("back\\slash"), "back\\\\slash");
        assert_eq!(CefFormatter::escape_extension("key=value"), "key\\=value");
    }

    #[test]
    fn test_cef_severity_mapping() {
        assert_eq!(CefFormatter::map_severity(0), 0);
        assert_eq!(CefFormatter::map_severity(10), 10);
        assert_eq!(CefFormatter::map_severity(15), 10); // Capped at 10
    }
}
