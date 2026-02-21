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

/// Result of enrollment request, handling both success and already_enrolled cases.
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum EnrollmentResult {
    /// Successful enrollment with credentials.
    Success(EnrollmentResponse),
    /// Agent already enrolled.
    AlreadyEnrolled {
        status: String,
        message: String,
        agent_id: Uuid,
        organization_id: Uuid,
    },
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
///
/// This is the canonical heartbeat type. The `api_client.rs` version should
/// be deprecated in favor of this one.
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

    /// Disk I/O throughput in kilobytes per second.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_io_kbps: Option<u32>,

    /// System uptime in seconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime_seconds: Option<u64>,

    /// IP address of the agent.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,

    /// Network bytes sent since last heartbeat.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network_bytes_sent: Option<u64>,

    /// Network bytes received since last heartbeat.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network_bytes_recv: Option<u64>,

    /// List of running processes (optional, for detailed monitoring).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub processes: Vec<AgentProcess>,

    /// List of network connections (optional, for detailed monitoring).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub connections: Vec<AgentConnection>,
}

/// Running process information.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AgentProcess {
    /// Process ID.
    pub pid: u32,
    /// Process name.
    pub name: String,
    /// CPU usage percentage.
    pub cpu_percent: f64,
    /// Memory usage in bytes.
    pub memory_bytes: u64,
    /// Memory usage percentage.
    pub memory_percent: f64,
    /// User running the process.
    pub user: String,
    /// Full command line (optional).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command_line: Option<String>,
}

/// Network connection information.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AgentConnection {
    /// Local address.
    pub local_address: String,
    /// Local port.
    pub local_port: u16,
    /// Remote address.
    pub remote_address: String,
    /// Remote port.
    pub remote_port: u16,
    /// Protocol (tcp/udp).
    pub protocol: String,
    /// Connection state.
    pub state: String,
    /// Process name (if known).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub process_name: Option<String>,
    /// Process ID (if known).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
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
    /// Accepts both 'timestamp' and 'server_time' (from Cloud Function).
    #[serde(alias = "server_time")]
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

    /// Organization name (for sync).
    #[serde(default)]
    pub organization_name: Option<String>,
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

// ============================================================================
// Command Result and Audit Sync Types
// ============================================================================

/// Status of a command execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CommandStatus {
    Success,
    Failed,
}

/// Request to report a command execution result.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct CommandResultRequest {
    /// Status of the execution.
    pub status: CommandStatus,
    /// Output from the command (stdout/stderr).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    /// Error message if failed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// When the command was completed.
    pub completed_at: DateTime<Utc>,
}

/// A single audit trail entry to sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AuditTrailEntry {
    /// Action performed.
    pub action: String,
    /// Who performed the action.
    pub actor: String,
    /// Detailed description.
    pub details: Option<String>,
    /// When the action occurred.
    pub timestamp: DateTime<Utc>,
    /// Additional metadata.
    #[serde(default)]
    pub metadata: serde_json::Value,
}

/// Request to sync multiple audit trail entries.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct AuditTrailSyncRequest {
    /// List of audit entries to sync.
    pub entries: Vec<AuditTrailEntry>,
}

// ============================================================================
// Playbook Sync Types
// ============================================================================

/// Playbook condition for sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PlaybookConditionPayload {
    pub condition_type: String,
    pub operator: String,
    pub value: String,
}

/// Playbook action for sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PlaybookActionPayload {
    pub action_type: String,
    pub parameters: String,
}

/// Playbook definition for sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PlaybookPayload {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub conditions: Vec<PlaybookConditionPayload>,
    pub actions: Vec<PlaybookActionPayload>,
    pub created_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_triggered: Option<DateTime<Utc>>,
    #[serde(default)]
    pub trigger_count: u32,
}

/// Request to sync playbooks.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct PlaybookSyncRequest {
    pub playbooks: Vec<PlaybookPayload>,
}

/// Playbook sync response.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PlaybookSyncResponse {
    pub received_count: u32,
    pub created_count: u32,
    pub updated_count: u32,
}

/// Playbook execution log entry for sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PlaybookLogPayload {
    pub id: String,
    pub playbook_id: String,
    pub playbook_name: String,
    pub triggered_at: DateTime<Utc>,
    pub trigger_event: String,
    pub actions_executed: Vec<String>,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Request to sync playbook execution logs.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct PlaybookLogSyncRequest {
    pub entries: Vec<PlaybookLogPayload>,
}

// ============================================================================
// Detection Rule Sync Types
// ============================================================================

/// Detection rule condition for sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DetectionConditionPayload {
    pub condition_type: String,
    pub value: String,
}

/// Detection rule for sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DetectionRulePayload {
    pub id: String,
    pub name: String,
    pub description: String,
    pub severity: String,
    pub conditions: Vec<DetectionConditionPayload>,
    pub actions: Vec<String>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_match: Option<DateTime<Utc>>,
    #[serde(default)]
    pub match_count: u32,
}

/// Request to sync detection rules.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct DetectionRuleSyncRequest {
    pub rules: Vec<DetectionRulePayload>,
}

/// Detection rule match event for sync.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct DetectionMatchPayload {
    pub rule_id: String,
    pub rule_name: String,
    pub matched_at: DateTime<Utc>,
    pub trigger_details: String,
    pub severity: String,
}

/// Request to sync detection matches.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct DetectionMatchSyncRequest {
    pub matches: Vec<DetectionMatchPayload>,
}

/// Generic sync response with count.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct GenericSyncResponse {
    pub received_count: u32,
}

// ============================================================================
// Risk Sync Types
// ============================================================================

/// Risk entry for sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct RiskPayload {
    pub id: String,
    pub title: String,
    pub description: String,
    pub probability: u8,
    pub impact: u8,
    pub owner: String,
    pub status: String,
    pub mitigation: String,
    pub source: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sla_target_days: Option<u32>,
}

/// Request to sync risks.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct RiskSyncRequest {
    pub risks: Vec<RiskPayload>,
}

/// Risk sync response.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct RiskSyncResponse {
    pub received_count: u32,
    pub created_count: u32,
    pub updated_count: u32,
}

// ============================================================================
// Asset Sync Types
// ============================================================================

/// Managed asset for sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AssetPayload {
    pub id: String,
    pub ip: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mac: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,
    pub device_type: String,
    pub criticality: String,
    pub lifecycle: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub risk_score: f64,
    pub vulnerability_count: u32,
    #[serde(default)]
    pub open_ports: Vec<u16>,
    #[serde(default)]
    pub software: Vec<String>,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}

/// Request to sync assets.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct AssetSyncRequest {
    pub assets: Vec<AssetPayload>,
}

/// Asset sync response.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AssetSyncResponse {
    pub received_count: u32,
    pub created_count: u32,
    pub updated_count: u32,
}

// ============================================================================
// KPI Sync Types
// ============================================================================

/// KPI snapshot for sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct KpiSnapshotPayload {
    pub timestamp: DateTime<Utc>,
    pub compliance_score: f64,
    pub incident_count: u32,
    pub open_vulns: u32,
    pub closed_vulns: u32,
    pub remediation_sla_pct: f64,
}

/// Request to sync KPI snapshots.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct KpiSyncRequest {
    pub snapshots: Vec<KpiSnapshotPayload>,
}

// ============================================================================
// Alert Rule Sync Types
// ============================================================================

/// Alert rule for sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AlertRulePayload {
    pub id: String,
    pub name: String,
    pub rule_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity_threshold: Option<String>,
    #[serde(default)]
    pub detection_types: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub escalation_minutes: Option<u32>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}

/// Request to sync alert rules.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct AlertRuleSyncRequest {
    pub rules: Vec<AlertRulePayload>,
}

// ============================================================================
// Webhook Sync Types
// ============================================================================

/// Webhook configuration for sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct WebhookPayload {
    pub id: String,
    pub name: String,
    pub url: String,
    pub format: String,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sent: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Request to sync webhooks.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct WebhookSyncRequest {
    pub webhooks: Vec<WebhookPayload>,
}

// ============================================================================
// FIM Alert Sync Types
// ============================================================================

/// FIM alert payload for sync.
///
/// Maps from `agent_common::types::FimAlert` to the backend API contract.
/// Field renames: `change` → `change_type`, `old_hash` → `baseline_hash`,
/// `new_hash` → `actual_hash`.
#[derive(Debug, Clone, Serialize)]
pub struct FimAlertPayload {
    /// Path of the affected file.
    pub path: String,

    /// Type of change (created, modified, deleted, permission_changed, renamed).
    #[serde(rename = "change_type")]
    pub change_type: String,

    /// Severity level (critical, high, medium, low).
    pub severity: String,

    /// Hash of the file before the change.
    #[serde(rename = "baseline_hash", skip_serializing_if = "Option::is_none")]
    pub baseline_hash: Option<String>,

    /// Hash of the file after the change.
    #[serde(rename = "actual_hash", skip_serializing_if = "Option::is_none")]
    pub actual_hash: Option<String>,

    /// When the change was detected (ISO 8601).
    pub timestamp: DateTime<Utc>,

    /// Optional metadata.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

impl From<agent_common::types::FimAlert> for FimAlertPayload {
    fn from(alert: agent_common::types::FimAlert) -> Self {
        use agent_common::types::FimChangeType;

        let change_type = match alert.change {
            FimChangeType::Created => "created",
            FimChangeType::Modified => "modified",
            FimChangeType::Deleted => "deleted",
            FimChangeType::PermissionChanged => "permission_changed",
            FimChangeType::Renamed => "renamed",
        }
        .to_string();

        // Default severity based on change type
        let severity = match alert.change {
            FimChangeType::Deleted | FimChangeType::PermissionChanged => "high",
            FimChangeType::Created | FimChangeType::Renamed => "medium",
            FimChangeType::Modified => "medium",
        }
        .to_string();

        Self {
            path: alert.path.to_string_lossy().to_string(),
            change_type,
            severity,
            baseline_hash: alert.old_hash,
            actual_hash: alert.new_hash,
            timestamp: alert.timestamp,
            metadata: None,
        }
    }
}

/// Request to upload FIM alerts.
#[derive(Debug, Clone, Serialize)]
pub struct FimAlertSyncRequest {
    pub alerts: Vec<FimAlertPayload>,
}

// ============================================================================
// USB Event Sync Types
// ============================================================================

/// USB event payload for sync.
///
/// Flattens the nested `UsbDevice` struct and renames fields to match
/// the backend API contract.
#[derive(Debug, Clone, Serialize)]
pub struct UsbEventPayload {
    /// Device description / product name.
    pub device_name: String,

    /// Device type (mass_storage, hid, audio, video, network, other).
    pub device_type: String,

    /// Event type (connected, disconnected).
    pub event_type: String,

    /// USB vendor ID as hex string.
    pub vendor_id: String,

    /// USB product ID as hex string.
    pub product_id: String,

    /// Device serial number.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub serial_number: Option<String>,

    /// Action taken (allowed, blocked).
    pub action: String,

    /// When the event occurred (ISO 8601).
    pub timestamp: DateTime<Utc>,

    /// Optional metadata.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

impl From<agent_common::types::UsbEvent> for UsbEventPayload {
    fn from(event: agent_common::types::UsbEvent) -> Self {
        use agent_common::types::usb::{UsbDeviceClass, UsbEventType};

        let device_type = match event.device.class {
            UsbDeviceClass::MassStorage => "mass_storage",
            UsbDeviceClass::Hid => "hid",
            UsbDeviceClass::Audio => "audio",
            UsbDeviceClass::Video => "video",
            UsbDeviceClass::Wireless | UsbDeviceClass::Communications => "network",
            _ => "other",
        }
        .to_string();

        let event_type = match event.event_type {
            UsbEventType::Connected => "connected",
            UsbEventType::Disconnected => "disconnected",
        }
        .to_string();

        Self {
            device_name: event.device.description,
            device_type,
            event_type,
            vendor_id: format!("{:04x}", event.device.vendor_id),
            product_id: format!("{:04x}", event.device.product_id),
            serial_number: event.device.serial,
            action: if event.allowed { "allowed" } else { "blocked" }.to_string(),
            timestamp: event.timestamp,
            metadata: None,
        }
    }
}

/// Request to upload USB events.
#[derive(Debug, Clone, Serialize)]
pub struct UsbEventSyncRequest {
    pub events: Vec<UsbEventPayload>,
}

// ============================================================================
// Software Inventory Sync Types
// ============================================================================

/// Software item for sync.
#[derive(Debug, Clone, Serialize)]
pub struct SoftwarePayload {
    /// Software name (required).
    pub name: String,

    /// Software vendor.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,

    /// Installed version.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}

/// Request to upload software inventory.
#[derive(Debug, Clone, Serialize)]
pub struct SoftwareSyncRequest {
    pub software: Vec<SoftwarePayload>,

    /// Optional scan timestamp (ISO 8601).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scan_timestamp: Option<DateTime<Utc>>,
}

/// Software sync response.
#[derive(Debug, Clone, Deserialize)]
pub struct SoftwareSyncResponse {
    pub received_count: u32,
    pub added_count: u32,
    pub updated_count: u32,
}

// ============================================================================
// Network Snapshot Sync Types
// ============================================================================

/// Network interface for sync.
#[derive(Debug, Clone, Serialize)]
pub struct NetworkInterfacePayload {
    pub name: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub mac_address: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ipv4_addresses: Vec<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ipv6_addresses: Vec<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub interface_type: Option<String>,
}

/// Request to upload a network snapshot.
#[derive(Debug, Clone, Serialize)]
pub struct NetworkSnapshotRequest {
    pub interfaces: Vec<NetworkInterfacePayload>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<DateTime<Utc>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_ip: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_mac: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
}

/// Network snapshot response.
#[derive(Debug, Clone, Deserialize)]
pub struct NetworkSnapshotResponse {
    pub acknowledged: bool,
    pub snapshot_id: String,
}

// ============================================================================
// Discovered Asset Sync Types
// ============================================================================

/// Discovered asset for sync.
#[derive(Debug, Clone, Serialize)]
pub struct DiscoveredAssetPayload {
    /// IP address (required).
    pub ip: String,

    /// Hostname, if resolved.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,

    /// Device type classification.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_type: Option<String>,

    /// Discovery source.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

/// Discovered asset response.
#[derive(Debug, Clone, Deserialize)]
pub struct DiscoveredAssetResponse {
    pub acknowledged: bool,
    pub validation_id: String,
}

// ============================================================================
// Log Upload Sync Types
// ============================================================================

/// Log entry for sync.
#[derive(Debug, Clone, Serialize)]
pub struct LogEntryPayload {
    pub level: String,
    pub message: String,
    pub timestamp: DateTime<Utc>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

/// Request to upload log entries.
#[derive(Debug, Clone, Serialize)]
pub struct LogUploadRequest {
    pub entries: Vec<LogEntryPayload>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub uploaded_at: Option<DateTime<Utc>>,
}

/// Log upload response.
#[derive(Debug, Clone, Deserialize)]
pub struct LogUploadResponse {
    pub received_count: u32,
    pub ack_id: String,
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

    #[test]
    fn test_heartbeat_response_server_time_alias() {
        // Cloud Function sends 'server_time' instead of 'timestamp'
        let json = r#"{
            "acknowledged": true,
            "server_time": "2026-01-23T12:00:00Z",
            "commands": [],
            "config_changed": false,
            "rules_changed": false
        }"#;

        let response: HeartbeatResponse = serde_json::from_str(json).unwrap();
        assert_eq!(
            response.timestamp,
            "2026-01-23T12:00:00Z".parse::<DateTime<Utc>>().unwrap()
        );
        assert!(response.commands.is_empty());
        assert!(!response.config_changed);
    }

    #[test]
    fn test_enrollment_response_reproduction() {
        // Exact structure from enrollment.js
        let json = r#"{
            "agent_id": "550e8400-e29b-41d4-a716-446655440000",
            "organization_id": "550e8400-e29b-41d4-a716-446655440001",
            "server_certificate": "base64encodedcert",
            "client_certificate": "base64encodedcert",
            "client_key": "base64encodedkey",
            "hmac_secret": "base64encodedsecret",
            "certificate_expires_at": "2027-02-02T22:47:00.000Z",
            "config": {
                "check_interval_secs": 3600,
                "heartbeat_interval_secs": 60,
                "log_level": "info",
                "enabled_checks": ["all"],
                "offline_mode_days": 7
            },
            "status": "enrolled"
        }"#;

        let response: EnrollmentResponse = serde_json::from_str(json).unwrap();
        assert_eq!(
            response.agent_id.to_string(),
            "550e8400-e29b-41d4-a716-446655440000"
        );
    }
}
