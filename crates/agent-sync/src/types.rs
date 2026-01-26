//! API types for SaaS communication.
//!
//! This module defines the request/response types for the Sentinel GRC API.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Enrollment request sent to the SaaS.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct EnrollmentRequest {
    /// The registration token provided by the administrator.
    pub enrollment_token: String,

    /// Hostname of the machine.
    pub hostname: String,

    /// Operating system name (linux, darwin, windows).
    pub os: String,

    /// Operating system version.
    pub os_version: String,

    /// Agent version string.
    pub agent_version: String,

    /// Machine identifier (for detecting re-enrollment).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub machine_id: Option<String>,
}

/// Enrollment response from the SaaS.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct EnrollmentResponse {
    /// Unique agent identifier assigned by the SaaS.
    pub agent_id: Uuid,

    /// Organization/tenant identifier.
    pub organization_id: Uuid,

    /// PEM-encoded client certificate for mTLS.
    pub client_certificate: String,

    /// PEM-encoded private key for mTLS.
    /// Accepts both 'client_key' (from Cloud Function) and 'client_private_key'.
    #[serde(alias = "client_key")]
    pub client_private_key: String,

    /// Certificate expiration timestamp.
    pub certificate_expires_at: DateTime<Utc>,

    /// Server certificate for validation (optional).
    #[serde(default)]
    pub server_certificate: Option<String>,

    /// Server certificate fingerprint for pinning.
    #[serde(default)]
    pub server_fingerprints: Vec<String>,

    /// Initial configuration from the SaaS.
    /// Accepts both 'config' (from Cloud Function) and 'initial_config'.
    #[serde(default, alias = "config")]
    pub initial_config: Option<InitialConfig>,
}

/// Initial configuration provided during enrollment.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct InitialConfig {
    /// Check interval in seconds.
    #[serde(default)]
    pub check_interval_secs: Option<u64>,

    /// Heartbeat interval in seconds.
    #[serde(default)]
    pub heartbeat_interval_secs: Option<u64>,

    /// Enabled check IDs.
    #[serde(default)]
    pub enabled_checks: Vec<String>,
}

/// Stored credentials after successful enrollment.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct StoredCredentials {
    /// Unique agent identifier.
    pub agent_id: Uuid,

    /// Organization/tenant identifier.
    pub organization_id: Uuid,

    /// PEM-encoded client certificate for mTLS.
    pub client_certificate: String,

    /// PEM-encoded private key for mTLS.
    pub client_private_key: String,

    /// Certificate expiration timestamp.
    pub certificate_expires_at: DateTime<Utc>,

    /// Server certificate fingerprints for pinning.
    pub server_fingerprints: Vec<String>,

    /// Timestamp of enrollment.
    pub enrolled_at: DateTime<Utc>,
}

impl StoredCredentials {
    /// Create stored credentials from enrollment response.
    pub fn from_enrollment(response: EnrollmentResponse) -> Self {
        Self {
            agent_id: response.agent_id,
            organization_id: response.organization_id,
            client_certificate: response.client_certificate,
            client_private_key: response.client_private_key,
            certificate_expires_at: response.certificate_expires_at,
            server_fingerprints: response.server_fingerprints,
            enrolled_at: Utc::now(),
        }
    }

    /// Check if the certificate is expired.
    pub fn is_certificate_expired(&self) -> bool {
        Utc::now() >= self.certificate_expires_at
    }

    /// Check if the certificate will expire within the given duration.
    pub fn certificate_expires_within(&self, days: i64) -> bool {
        let threshold = Utc::now() + chrono::Duration::days(days);
        threshold >= self.certificate_expires_at
    }
}

/// API error response from the SaaS.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ApiErrorResponse {
    /// Error code.
    pub code: String,

    /// Human-readable error message.
    pub message: String,

    /// Additional error details.
    #[serde(default)]
    pub details: Option<serde_json::Value>,
}

/// Certificate renewal request.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct CertificateRenewalRequest {
    /// Agent ID requesting renewal.
    pub agent_id: Uuid,

    /// Reason for renewal.
    pub reason: String,
}

/// Certificate renewal response.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CertificateRenewalResponse {
    /// New PEM-encoded client certificate.
    pub client_certificate: String,

    /// New PEM-encoded private key.
    pub client_private_key: String,

    /// New certificate expiration timestamp.
    pub certificate_expires_at: DateTime<Utc>,

    /// Updated server fingerprints (if rotated).
    #[serde(default)]
    pub server_fingerprints: Vec<String>,
}

/// Heartbeat request sent to the SaaS.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct HeartbeatRequest {
    /// Agent timestamp.
    pub timestamp: DateTime<Utc>,

    /// Agent version.
    pub agent_version: String,

    /// Current agent status.
    pub status: String,

    /// Hostname.
    pub hostname: String,

    /// OS information.
    pub os_info: String,

    /// CPU usage percentage.
    pub cpu_percent: f32,

    /// Memory usage in bytes.
    pub memory_bytes: u64,

    /// Last check execution timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_check_at: Option<DateTime<Utc>>,

    /// Current compliance score.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub compliance_score: Option<f32>,

    /// Number of pending sync items.
    pub pending_sync_count: u32,

    /// Self-check result (first heartbeat after startup).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub self_check_result: Option<SelfCheckResult>,

    /// Memory usage percentage.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_percent: Option<f32>,

    /// Total memory in bytes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_total_bytes: Option<u64>,

    /// Disk usage percentage.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_percent: Option<f32>,

    /// Disk used bytes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_used_bytes: Option<u64>,

    /// Disk total bytes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_total_bytes: Option<u64>,

    /// System uptime in seconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime_seconds: Option<u64>,
}

/// Self-check result sent in first heartbeat.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SelfCheckResult {
    /// Whether the self-check passed.
    pub passed: bool,

    /// Binary hash (SHA-256).
    pub binary_hash: String,

    /// Error message if self-check failed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Heartbeat response from the SaaS.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct HeartbeatResponse {
    /// Server timestamp.
    pub timestamp: DateTime<Utc>,

    /// Commands for the agent to execute.
    #[serde(default)]
    pub commands: Vec<AgentCommand>,

    /// Whether configuration has changed.
    #[serde(default)]
    pub config_changed: bool,

    /// Whether rules have changed.
    #[serde(default)]
    pub rules_changed: bool,
}

/// Command sent to the agent via heartbeat response.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
#[serde(tag = "type")]
pub enum AgentCommand {
    /// Force immediate sync.
    #[serde(rename = "force_sync")]
    ForceSync,

    /// Run specific checks immediately.
    #[serde(rename = "run_checks")]
    RunChecks { check_ids: Vec<String> },

    /// Update agent to specific version.
    #[serde(rename = "update")]
    Update { version: String, url: String },

    /// Run diagnostics and report.
    #[serde(rename = "diagnostics")]
    Diagnostics,

    /// Revoke agent (stop operations).
    #[serde(rename = "revoke")]
    Revoke { reason: String },
}

// ============================================================================
// Vulnerability Upload Types
// ============================================================================

/// Severity levels for vulnerabilities and incidents.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum Severity {
    Critical,
    High,
    #[default]
    Medium,
    Low,
}

/// Vulnerability finding to upload to the SaaS.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct VulnerabilityFinding {
    /// Package name.
    pub package_name: String,

    /// Currently installed version.
    pub installed_version: String,

    /// Available version (if update available).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_version: Option<String>,

    /// CVE identifier if known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cve_id: Option<String>,

    /// CVSS score if known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cvss_score: Option<f32>,

    /// Severity level.
    pub severity: Severity,

    /// Human-readable description.
    pub description: String,

    /// Remediation instructions.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remediation: Option<String>,

    /// When the vulnerability was detected.
    pub detected_at: DateTime<Utc>,
}

/// Vulnerability upload request.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct VulnerabilityUploadRequest {
    /// List of vulnerabilities to upload.
    pub vulnerabilities: Vec<VulnerabilityFinding>,

    /// Type of scan performed.
    pub scan_type: String,
}

/// Vulnerability upload response.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct VulnerabilityUploadResponse {
    /// Number of vulnerabilities received.
    pub received_count: u32,

    /// Number of new vulnerabilities created.
    pub created_count: u32,

    /// Number of existing vulnerabilities updated.
    pub updated_count: u32,

    /// Number of vulnerabilities skipped (duplicates).
    #[serde(default)]
    pub skipped_count: u32,
}

// ============================================================================
// Incident Report Types
// ============================================================================

/// Types of security incidents.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IncidentType {
    /// Malware detected.
    Malware,
    /// Suspicious process running.
    SuspiciousProcess,
    /// Unauthorized system change.
    UnauthorizedChange,
    /// Potential data exfiltration.
    DataExfiltration,
    /// Crypto miner detected.
    CryptoMiner,
    /// Reverse shell detected.
    ReverseShell,
    /// Credential theft attempt.
    CredentialTheft,
    /// Privilege escalation attempt.
    PrivilegeEscalation,
    /// Firewall disabled.
    FirewallDisabled,
    /// Antivirus disabled.
    AntivirusDisabled,
}

/// Security incident to report to the SaaS.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct SecurityIncidentReport {
    /// Type of incident.
    pub incident_type: IncidentType,

    /// Severity level.
    pub severity: Severity,

    /// Incident title.
    pub title: String,

    /// Detailed description.
    pub description: String,

    /// Evidence data (varies by incident type).
    pub evidence: serde_json::Value,

    /// Confidence level (0-100).
    pub confidence: u8,

    /// When the incident was detected.
    pub detected_at: DateTime<Utc>,
}

/// Incident report response.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct IncidentReportResponse {
    /// Created incident ID.
    pub incident_id: String,

    /// Whether the report was acknowledged.
    pub acknowledged: bool,

    /// Mapped category in the app.
    #[serde(default)]
    pub category: Option<String>,

    /// Whether an automatic playbook was triggered.
    #[serde(default)]
    pub playbook_triggered: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_enrollment_request_serialization() {
        let request = EnrollmentRequest {
            enrollment_token: "token-123".to_string(),
            hostname: "test-host".to_string(),
            os: "linux".to_string(),
            os_version: "5.15 (x86_64)".to_string(),
            agent_version: "0.1.0".to_string(),
            machine_id: Some("machine-id".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("enrollment_token"));
        assert!(json.contains("hostname"));
        assert!(json.contains("\"os\":"));
        assert!(json.contains("os_version"));
        assert!(json.contains("machine_id"));
    }

    #[test]
    fn test_enrollment_response_deserialization() {
        // Test with standard field names
        let json = r#"{
            "agent_id": "550e8400-e29b-41d4-a716-446655440000",
            "organization_id": "550e8400-e29b-41d4-a716-446655440001",
            "client_certificate": "-----BEGIN CERTIFICATE-----\nMIIB...",
            "client_private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...",
            "certificate_expires_at": "2027-01-23T00:00:00Z",
            "server_fingerprints": ["sha256:abc123"]
        }"#;

        let response: EnrollmentResponse = serde_json::from_str(json).unwrap();
        assert_eq!(
            response.agent_id.to_string(),
            "550e8400-e29b-41d4-a716-446655440000"
        );
        assert!(!response.server_fingerprints.is_empty());
    }

    #[test]
    fn test_enrollment_response_deserialization_with_aliases() {
        // Test with Cloud Function field names (client_key instead of client_private_key)
        let json = r#"{
            "agent_id": "550e8400-e29b-41d4-a716-446655440000",
            "organization_id": "550e8400-e29b-41d4-a716-446655440001",
            "client_certificate": "-----BEGIN CERTIFICATE-----\nMIIB...",
            "client_key": "-----BEGIN PRIVATE KEY-----\nMIIE...",
            "certificate_expires_at": "2027-01-23T00:00:00Z",
            "server_certificate": "-----BEGIN CERTIFICATE-----\nSERVER...",
            "config": {
                "check_interval_secs": 3600,
                "heartbeat_interval_secs": 60
            }
        }"#;

        let response: EnrollmentResponse = serde_json::from_str(json).unwrap();
        assert_eq!(
            response.agent_id.to_string(),
            "550e8400-e29b-41d4-a716-446655440000"
        );
        assert_eq!(
            response.client_private_key,
            "-----BEGIN PRIVATE KEY-----\nMIIE..."
        );
        assert!(response.server_certificate.is_some());
        assert!(response.initial_config.is_some());
    }

    #[test]
    fn test_stored_credentials_from_enrollment() {
        let response = EnrollmentResponse {
            agent_id: Uuid::new_v4(),
            organization_id: Uuid::new_v4(),
            client_certificate: "cert".to_string(),
            client_private_key: "key".to_string(),
            certificate_expires_at: Utc::now() + chrono::Duration::days(365),
            server_certificate: Some("server_cert".to_string()),
            server_fingerprints: vec!["sha256:test".to_string()],
            initial_config: None,
        };

        let credentials = StoredCredentials::from_enrollment(response.clone());
        assert_eq!(credentials.agent_id, response.agent_id);
        assert!(!credentials.is_certificate_expired());
    }

    #[test]
    fn test_certificate_expiration_check() {
        let credentials = StoredCredentials {
            agent_id: Uuid::new_v4(),
            organization_id: Uuid::new_v4(),
            client_certificate: "cert".to_string(),
            client_private_key: "key".to_string(),
            certificate_expires_at: Utc::now() + chrono::Duration::days(30),
            server_fingerprints: vec![],
            enrolled_at: Utc::now(),
        };

        assert!(!credentials.is_certificate_expired());
        assert!(credentials.certificate_expires_within(60)); // expires within 60 days
        assert!(!credentials.certificate_expires_within(15)); // doesn't expire within 15 days
    }

    #[test]
    fn test_api_error_response() {
        let json = r#"{
            "code": "INVALID_TOKEN",
            "message": "The enrollment token is invalid or expired"
        }"#;

        let error: ApiErrorResponse = serde_json::from_str(json).unwrap();
        assert_eq!(error.code, "INVALID_TOKEN");
    }

    #[test]
    fn test_agent_command_deserialization() {
        let json = r#"{"type": "force_sync"}"#;
        let cmd: AgentCommand = serde_json::from_str(json).unwrap();
        assert!(matches!(cmd, AgentCommand::ForceSync));

        let json = r#"{"type": "run_checks", "check_ids": ["disk_encryption", "antivirus"]}"#;
        let cmd: AgentCommand = serde_json::from_str(json).unwrap();
        if let AgentCommand::RunChecks { check_ids } = cmd {
            assert_eq!(check_ids.len(), 2);
        } else {
            panic!("Expected RunChecks");
        }
    }

    #[test]
    fn test_heartbeat_response_with_commands() {
        let json = r#"{
            "timestamp": "2026-01-23T12:00:00Z",
            "commands": [
                {"type": "force_sync"},
                {"type": "run_checks", "check_ids": ["disk"]}
            ],
            "config_changed": true,
            "rules_changed": false
        }"#;

        let response: HeartbeatResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.commands.len(), 2);
        assert!(response.config_changed);
        assert!(!response.rules_changed);
    }
}
