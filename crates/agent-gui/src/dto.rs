//! Data transfer objects for the GUI layer.
//!
//! These types represent the data presented to the user in the desktop interface.
//! They are intentionally decoupled from internal domain types so the GUI can
//! evolve independently of the core runtime.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub use agent_common::types::UpdateStatus;

// ============================================================================
// Type-safe enums (replacing String-based fields)
// ============================================================================

/// Severity level for compliance checks and vulnerabilities.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

impl Severity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Severity::Critical => "critical",
            Severity::High => "high",
            Severity::Medium => "medium",
            Severity::Low => "low",
            Severity::Info => "info",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Severity::Critical => "CRITIQUE",
            Severity::High => "ÉLEVÉ",
            Severity::Medium => "MOYEN",
            Severity::Low => "FAIBLE",
            Severity::Info => "INFO",
        }
    }

    /// Severity weight for compliance score calculation.
    /// Matches `ScoreCalculator` weights in agent-scanner/src/score.rs.
    pub fn weight(&self) -> f32 {
        match self {
            Severity::Critical => 4.0,
            Severity::High => 3.0,
            Severity::Medium => 2.0,
            Severity::Low => 1.0,
            Severity::Info => 0.5,
        }
    }
}

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Log level for terminal and log filtering.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogLevel {
    Trace = 0,
    Debug = 1,
    Info = 2,
    Warn = 3,
    Error = 4,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Trace => "TRACE",
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }

    pub fn from_index(idx: usize) -> Self {
        match idx {
            0 => LogLevel::Trace,
            1 => LogLevel::Debug,
            2 => LogLevel::Info,
            3 => LogLevel::Warn,
            4 => LogLevel::Error,
            _ => LogLevel::Info,
        }
    }

    pub fn index(&self) -> usize {
        *self as usize
    }
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Compliance grouping mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ComplianceGroupBy {
    #[default]
    None,
    Category,
    Framework,
}

impl ComplianceGroupBy {
    pub fn index(&self) -> u8 {
        match self {
            ComplianceGroupBy::None => 0,
            ComplianceGroupBy::Category => 1,
            ComplianceGroupBy::Framework => 2,
        }
    }

    pub fn from_index(idx: u8) -> Self {
        match idx {
            1 => ComplianceGroupBy::Category,
            2 => ComplianceGroupBy::Framework,
            _ => ComplianceGroupBy::None,
        }
    }
}

/// Software page tab selection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SoftwareTab {
    #[default]
    Packages,
    Applications,
}

impl SoftwareTab {
    pub fn index(&self) -> u8 {
        match self {
            SoftwareTab::Packages => 0,
            SoftwareTab::Applications => 1,
        }
    }

    pub fn from_index(idx: u8) -> Self {
        match idx {
            1 => SoftwareTab::Applications,
            _ => SoftwareTab::Packages,
        }
    }
}

/// FIM change type.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FimChangeType {
    Created,
    Modified,
    Deleted,
    PermissionChanged,
    Renamed,
}

impl FimChangeType {
    pub fn as_str(&self) -> &'static str {
        match self {
            FimChangeType::Created => "created",
            FimChangeType::Modified => "modified",
            FimChangeType::Deleted => "deleted",
            FimChangeType::PermissionChanged => "permission_changed",
            FimChangeType::Renamed => "renamed",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            FimChangeType::Created => "Créé",
            FimChangeType::Modified => "Modifié",
            FimChangeType::Deleted => "Supprimé",
            FimChangeType::PermissionChanged => "Permissions",
            FimChangeType::Renamed => "Renommé",
        }
    }
}

impl std::fmt::Display for FimChangeType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// USB event type.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UsbEventType {
    Connected,
    Disconnected,
}

impl UsbEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            UsbEventType::Connected => "connected",
            UsbEventType::Disconnected => "disconnected",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            UsbEventType::Connected => "Connecté",
            UsbEventType::Disconnected => "Déconnecté",
        }
    }
}

impl std::fmt::Display for UsbEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct GuiPolicySummary {
    pub total_policies: u32,
    pub passing: u32,
    pub failing: u32,
    pub errors: u32,
    pub pending: u32,
}

/// Overall agent status displayed in the GUI dashboard.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum GuiAgentStatus {
    /// Agent is running and connected to the server.
    Connected,
    /// Agent is running but not connected to the server.
    Disconnected,
    /// Agent is paused by the user.
    Paused,
    /// Agent is performing a scan.
    Scanning,
    /// Agent is synchronizing data with the server.
    Syncing,
    /// Agent encountered an error.
    Error,
    /// Agent is starting up.
    #[default]
    Starting,
}

/// Summary view of the agent state for the GUI main panel.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub struct AgentSummary {
    /// Current agent status.
    pub status: GuiAgentStatus,
    /// Agent version string.
    pub version: String,
    /// Current hostname.
    pub hostname: String,
    /// Agent unique identifier (if enrolled).
    pub agent_id: Option<String>,
    /// Organization name (if enrolled).
    pub organization: Option<String>,
    /// Overall compliance score (0-100), if available.
    pub compliance_score: Option<f32>,
    /// Timestamp of last successful compliance check.
    pub last_check_at: Option<DateTime<Utc>>,
    /// Timestamp of last successful server sync.
    pub last_sync_at: Option<DateTime<Utc>>,
    /// Number of items pending sync.
    pub pending_sync_count: u32,
    /// Uptime in seconds.
    pub uptime_secs: u64,
    /// Active compliance frameworks.
    pub active_frameworks: Option<Vec<String>>,
    /// Summary of compliance policy status.
    pub policy_summary: Option<GuiPolicySummary>,
}

/// A single compliance check result for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiCheckResult {
    /// Check rule identifier.
    pub check_id: String,
    /// Human-readable check name.
    pub name: String,
    /// Check category.
    pub category: String,
    /// Result status.
    pub status: GuiCheckStatus,
    /// Severity level (typed).
    pub severity: Severity,
    /// Compliance score (0-100).
    pub score: Option<i32>,
    /// Summary message.
    pub message: Option<String>,
    /// Detailed results as JSON.
    pub details: Option<serde_json::Value>,
    /// When the check was last executed.
    pub executed_at: Option<DateTime<Utc>>,
    /// Applicable frameworks (e.g., "NIS2", "DORA").
    pub frameworks: Vec<String>,
}

/// Check status for GUI display.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GuiCheckStatus {
    /// Check passed.
    Pass,
    /// Check failed.
    Fail,
    /// Check encountered an error.
    Error,
    /// Check was skipped.
    Skipped,
    /// Check is pending.
    Pending,
    /// Check is currently running.
    Running,
}

/// Resource usage snapshot for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub struct GuiResourceUsage {
    /// CPU usage percentage.
    pub cpu_percent: f64,
    /// Memory usage percentage (0-100).
    pub memory_percent: f64,
    /// Memory currently used in megabytes.
    pub memory_used_mb: u64,
    /// Total memory available in megabytes.
    pub memory_total_mb: u64,
    /// Disk I/O throughput (kilobytes per second).
    pub disk_kbps: u32,
    /// Uptime in seconds.
    pub uptime_secs: u64,
    /// Disk usage percentage (0-100).
    pub disk_percent: f64,
    /// Network I/O throughput (bytes per second).
    pub network_io_bytes: u64,
}

/// Vulnerability scan summary for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub struct GuiVulnerabilitySummary {
    /// Number of critical vulnerabilities.
    pub critical: u32,
    /// Number of high-severity vulnerabilities.
    pub high: u32,
    /// Number of medium-severity vulnerabilities.
    pub medium: u32,
    /// Number of low-severity vulnerabilities.
    pub low: u32,
    /// Timestamp of last vulnerability scan.
    pub last_scan_at: Option<DateTime<Utc>>,
}

/// A log entry for GUI display (recent activity).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiLogEntry {
    /// Unique identifier.
    pub id: Uuid,
    /// Timestamp.
    pub timestamp: DateTime<Utc>,
    /// Log level (info, warn, error).
    pub level: String,
    /// Log message.
    pub message: String,
    /// Optional source module.
    pub source: Option<String>,
}

/// Notification displayed in the GUI notification panel.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiNotification {
    /// Unique identifier.
    pub id: Uuid,
    /// Notification title.
    pub title: String,
    /// Notification body.
    pub body: String,
    /// Severity (info, warning, error, critical).
    pub severity: String,
    /// Timestamp.
    pub timestamp: DateTime<Utc>,
    /// Whether the notification has been read.
    pub read: bool,
    /// Optional action URL or command.
    pub action: Option<String>,
}

impl GuiNotification {
    /// Create a new info notification.
    pub fn info(title: impl Into<String>, body: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4(),
            title: title.into(),
            body: body.into(),
            severity: "info".to_string(),
            timestamp: chrono::Utc::now(),
            read: false,
            action: None,
        }
    }

    /// Create a new error notification.
    pub fn error(title: impl Into<String>, body: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4(),
            title: title.into(),
            body: body.into(),
            severity: "error".to_string(),
            timestamp: chrono::Utc::now(),
            read: false,
            action: None,
        }
    }
}


/// A software package entry for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiSoftwarePackage {
    /// Package name.
    pub name: String,
    /// Installed version.
    pub version: String,
    /// Publisher / vendor.
    pub publisher: Option<String>,
    /// Installation date.
    pub installed_at: Option<DateTime<Utc>>,
    /// Whether the package is up to date.
    pub up_to_date: bool,
    /// Latest available version (if known).
    pub latest_version: Option<String>,
}

/// A macOS native application entry for GUI display.
#[derive(Debug, Clone, PartialEq)]
pub struct GuiMacOsApp {
    /// Application name (from Info.plist or folder name).
    pub name: String,
    /// Bundle version string.
    pub version: String,
    /// Bundle identifier (e.g. com.apple.Safari).
    pub bundle_id: String,
    /// Publisher / developer.
    pub publisher: String,
    /// Path on disk.
    pub path: String,
}

/// A vulnerability finding for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiVulnerabilityFinding {
    /// Vulnerability identifier (CVE if known, otherwise source-based).
    pub cve_id: String,
    /// Affected software name.
    pub affected_software: String,
    /// Affected version.
    pub affected_version: String,
    /// Severity level (typed).
    pub severity: Severity,
    /// CVSS score (0.0 - 10.0).
    pub cvss_score: Option<f32>,
    /// Short description.
    pub description: String,
    /// Whether a fix is available.
    pub fix_available: bool,
    /// Timestamp of discovery.
    pub discovered_at: Option<DateTime<Utc>>,
}

/// Discovered network device for display in the Discovery and Cartography pages.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct GuiDiscoveredDevice {
    /// IP address.
    pub ip: String,
    /// MAC address.
    pub mac: Option<String>,
    /// Hostname (reverse DNS).
    pub hostname: Option<String>,
    /// Hardware vendor (OUI lookup).
    pub vendor: Option<String>,
    /// Device type classification.
    pub device_type: String,
    /// Open TCP ports.
    pub open_ports: Vec<u16>,
    /// When first seen.
    pub first_seen: chrono::DateTime<chrono::Utc>,
    /// When last seen.
    pub last_seen: chrono::DateTime<chrono::Utc>,
    /// Whether device is a gateway.
    pub is_gateway: bool,
    /// Subnet this device belongs to.
    pub subnet: String,
}

/// A network interface for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiNetworkInterface {
    /// Interface name (e.g. "en0").
    pub name: String,
    /// MAC address.
    pub mac_address: Option<String>,
    /// IPv4 addresses assigned.
    pub ipv4_addresses: Vec<String>,
    /// Interface status (up/down).
    pub status: String,
    /// Interface type (ethernet, wifi, loopback, etc.).
    pub interface_type: String,
}

/// A network connection for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiNetworkConnection {
    /// Protocol (TCP/UDP).
    pub protocol: String,
    /// Local address.
    pub local_address: String,
    /// Local port.
    pub local_port: u16,
    /// Remote address.
    pub remote_address: Option<String>,
    /// Remote port.
    pub remote_port: Option<u16>,
    /// Connection state (ESTABLISHED, LISTEN, etc.).
    pub state: String,
    /// Process name.
    pub process_name: Option<String>,
}

/// A FIM alert for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiFimAlert {
    /// Unique identifier.
    pub id: String,
    /// File path that changed.
    pub path: String,
    /// Change type (typed).
    pub change_type: FimChangeType,
    /// Previous file hash.
    pub old_hash: Option<String>,
    /// New file hash.
    pub new_hash: Option<String>,
    /// When the change was detected.
    pub timestamp: DateTime<Utc>,
    /// Whether the alert has been acknowledged.
    pub acknowledged: bool,
}

/// A suspicious process event for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiSuspiciousProcess {
    /// Process name.
    pub process_name: String,
    /// Full command line.
    pub command_line: String,
    /// Why this process was flagged.
    pub reason: String,
    /// Confidence score (0-100).
    pub confidence: u8,
    /// When detected.
    pub detected_at: DateTime<Utc>,
}

/// A system security incident for GUI display (firewall, AV, privilege escalation, etc.).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiSystemIncident {
    /// Incident type (e.g. "firewall_disabled", "antivirus_disabled", "privilege_escalation").
    pub incident_type: String,
    /// Severity level (typed).
    pub severity: Severity,
    /// Incident title.
    pub title: String,
    /// Detailed description.
    pub description: String,
    /// Confidence score (0-100).
    pub confidence: u8,
    /// When detected.
    pub detected_at: DateTime<Utc>,
}

/// A USB device event for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiUsbEvent {
    /// Device description.
    pub device_name: String,
    /// USB vendor ID.
    pub vendor_id: u16,
    /// USB product ID.
    pub product_id: u16,
    /// Event type (typed).
    pub event_type: UsbEventType,
    /// When the event occurred.
    pub timestamp: DateTime<Utc>,
}

/// A network security alert for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiNetworkAlert {
    /// Alert type (c2, mining, exfiltration, dga, beaconing, port_scan, suspicious_port, dns_tunneling).
    pub alert_type: String,
    /// Severity level.
    pub severity: Severity,
    /// Human-readable description.
    pub description: String,
    /// Source IP address.
    pub source_ip: Option<String>,
    /// Destination IP address.
    pub destination_ip: Option<String>,
    /// Destination port.
    pub destination_port: Option<u16>,
    /// Confidence score (0-100).
    pub confidence: u8,
    /// When detected.
    pub detected_at: DateTime<Utc>,
}

// ============================================================================
// EDR module types
// ============================================================================

/// EDR page tab selection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum EdrTab {
    #[default]
    Overview,
    Events,
    Investigation,
    Response,
    Playbooks,
    DetectionRules,
    ForensicTimeline,
}

impl EdrTab {
    pub fn index(&self) -> u8 {
        match self {
            EdrTab::Overview => 0,
            EdrTab::Events => 1,
            EdrTab::Investigation => 2,
            EdrTab::Response => 3,
            EdrTab::Playbooks => 4,
            EdrTab::DetectionRules => 5,
            EdrTab::ForensicTimeline => 6,
        }
    }

    pub fn from_index(idx: u8) -> Self {
        match idx {
            1 => EdrTab::Events,
            2 => EdrTab::Investigation,
            3 => EdrTab::Response,
            4 => EdrTab::Playbooks,
            5 => EdrTab::DetectionRules,
            6 => EdrTab::ForensicTimeline,
            _ => EdrTab::Overview,
        }
    }
}

/// Type of IOC being searched in the investigation tab.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum IocSearchType {
    #[default]
    Ip,
    Domain,
    Hash,
    Process,
    Cve,
}

impl IocSearchType {
    pub fn label_fr(&self) -> &'static str {
        match self {
            IocSearchType::Ip => "Adresse IP",
            IocSearchType::Domain => "Domaine",
            IocSearchType::Hash => "Hash (SHA-256)",
            IocSearchType::Process => "Processus",
            IocSearchType::Cve => "CVE",
        }
    }
}

/// MITRE ATT&CK tactic categories.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum MitreTactic {
    InitialAccess,
    Execution,
    Persistence,
    PrivilegeEscalation,
    DefenseEvasion,
    CredentialAccess,
    Discovery,
    LateralMovement,
    Collection,
    CommandAndControl,
    Exfiltration,
    Impact,
}

impl MitreTactic {
    pub fn label_fr(&self) -> &'static str {
        match self {
            MitreTactic::InitialAccess => "Acc\u{00e8}s initial",
            MitreTactic::Execution => "Ex\u{00e9}cution",
            MitreTactic::Persistence => "Persistance",
            MitreTactic::PrivilegeEscalation => "Escalade de privil\u{00e8}ges",
            MitreTactic::DefenseEvasion => "\u{00c9}vasion de d\u{00e9}fense",
            MitreTactic::CredentialAccess => "Acc\u{00e8}s aux identifiants",
            MitreTactic::Discovery => "D\u{00e9}couverte",
            MitreTactic::LateralMovement => "Mouvement lat\u{00e9}ral",
            MitreTactic::Collection => "Collecte",
            MitreTactic::CommandAndControl => "Commande & Contr\u{00f4}le",
            MitreTactic::Exfiltration => "Exfiltration",
            MitreTactic::Impact => "Impact",
        }
    }

    /// All tactics in display order.
    pub fn all() -> &'static [MitreTactic] {
        &[
            MitreTactic::InitialAccess,
            MitreTactic::Execution,
            MitreTactic::Persistence,
            MitreTactic::PrivilegeEscalation,
            MitreTactic::DefenseEvasion,
            MitreTactic::CredentialAccess,
            MitreTactic::Discovery,
            MitreTactic::LateralMovement,
            MitreTactic::Collection,
            MitreTactic::CommandAndControl,
            MitreTactic::Exfiltration,
            MitreTactic::Impact,
        ]
    }
}

/// A MITRE ATT&CK technique reference.
#[derive(Debug, Clone, PartialEq)]
pub struct MitreTechnique {
    /// Technique ID (e.g. "T1059.001").
    pub id: &'static str,
    /// French name.
    pub name_fr: &'static str,
    /// Tactic category.
    pub tactic: MitreTactic,
}

/// Type of EDR response action.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResponseActionType {
    KillProcess,
    QuarantineFile,
    BlockIp,
    RestoreFile,
}

impl ResponseActionType {
    pub fn label_fr(&self) -> &'static str {
        match self {
            ResponseActionType::KillProcess => "Terminer le processus",
            ResponseActionType::QuarantineFile => "Quarantaine fichier",
            ResponseActionType::BlockIp => "Bloquer IP",
            ResponseActionType::RestoreFile => "Restaurer fichier",
        }
    }
}

/// Status of a response action.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResponseStatus {
    Pending,
    InProgress,
    Success,
    Failed,
}

impl ResponseStatus {
    pub fn label_fr(&self) -> &'static str {
        match self {
            ResponseStatus::Pending => "En attente",
            ResponseStatus::InProgress => "En cours",
            ResponseStatus::Success => "Succ\u{00e8}s",
            ResponseStatus::Failed => "\u{00c9}chec",
        }
    }
}

/// A response action (pending or completed).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseAction {
    pub id: Uuid,
    pub action_type: ResponseActionType,
    pub target: String,
    pub target_detail: String,
    pub status: ResponseStatus,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

/// A quarantined file entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarantinedFile {
    pub id: Uuid,
    pub original_path: String,
    pub sha256: String,
    pub size_bytes: u64,
    pub quarantined_at: DateTime<Utc>,
    pub reason: String,
    pub restored: bool,
}

/// An entry in the response action log.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseLogEntry {
    pub id: Uuid,
    pub action_type: ResponseActionType,
    pub target: String,
    pub status: ResponseStatus,
    pub timestamp: DateTime<Utc>,
    pub operator: String,
    pub details: Option<String>,
}

/// Modal confirmation for dangerous response actions.
#[derive(Debug, Clone)]
pub struct PendingConfirmation {
    pub action_type: ResponseActionType,
    pub target: String,
    pub detail: String,
}

// ============================================================================
// Reports module types
// ============================================================================

/// Type of generated report.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReportType {
    #[default]
    Executive,
    ComplianceAudit,
    Incident,
}

impl ReportType {
    pub fn label_fr(&self) -> &'static str {
        match self {
            ReportType::Executive => "Synth\u{00e8}se ex\u{00e9}cutive",
            ReportType::ComplianceAudit => "Audit de conformit\u{00e9}",
            ReportType::Incident => "Rapport d'incidents",
        }
    }
}

/// A generated report entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedReport {
    pub id: Uuid,
    pub report_type: ReportType,
    pub title: String,
    pub generated_at: DateTime<Utc>,
    pub html_content: String,
    pub summary: String,
    pub compliance_score: Option<f32>,
    pub framework: Option<String>,
}

// ============================================================================
// Playbook types
// ============================================================================

/// Condition type for playbook rules.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlaybookConditionType {
    ProcessNameMatch,
    NetworkAlertType,
    FimChange,
    SeverityThreshold,
    CvssScore,
}

impl PlaybookConditionType {
    pub fn label_fr(&self) -> &'static str {
        match self {
            Self::ProcessNameMatch => "Nom de processus",
            Self::NetworkAlertType => "Type d'alerte r\u{00e9}seau",
            Self::FimChange => "Changement FIM",
            Self::SeverityThreshold => "Seuil de s\u{00e9}v\u{00e9}rit\u{00e9}",
            Self::CvssScore => "Score CVSS",
        }
    }

    pub fn all() -> &'static [Self] {
        &[
            Self::ProcessNameMatch,
            Self::NetworkAlertType,
            Self::FimChange,
            Self::SeverityThreshold,
            Self::CvssScore,
        ]
    }
}

/// Action type for playbook rules.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlaybookActionType {
    KillProcess,
    QuarantineFile,
    BlockIp,
    SendSiemAlert,
    CreateNotification,
}

impl PlaybookActionType {
    pub fn label_fr(&self) -> &'static str {
        match self {
            Self::KillProcess => "Terminer le processus",
            Self::QuarantineFile => "Quarantaine fichier",
            Self::BlockIp => "Bloquer IP",
            Self::SendSiemAlert => "Alerte SIEM",
            Self::CreateNotification => "Notification",
        }
    }

    pub fn all() -> &'static [Self] {
        &[
            Self::KillProcess,
            Self::QuarantineFile,
            Self::BlockIp,
            Self::SendSiemAlert,
            Self::CreateNotification,
        ]
    }
}

/// A condition within a playbook.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybookCondition {
    pub condition_type: PlaybookConditionType,
    pub operator: String,
    pub value: String,
}

/// An action within a playbook.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybookAction {
    pub action_type: PlaybookActionType,
    pub parameters: String,
}

/// An automated response playbook.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playbook {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub conditions: Vec<PlaybookCondition>,
    pub actions: Vec<PlaybookAction>,
    pub created_at: DateTime<Utc>,
    pub last_triggered: Option<DateTime<Utc>>,
    pub trigger_count: u32,
    pub is_template: bool,
}

/// An entry in the playbook execution log.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybookLogEntry {
    pub id: Uuid,
    pub playbook_id: Uuid,
    pub playbook_name: String,
    pub triggered_at: DateTime<Utc>,
    pub trigger_event: String,
    pub actions_executed: Vec<String>,
    pub success: bool,
    pub error: Option<String>,
}

// ============================================================================
// Risk management types
// ============================================================================

/// Status of a risk entry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskStatus {
    #[default]
    Open,
    Mitigating,
    Accepted,
    Closed,
}

impl RiskStatus {
    pub fn label_fr(&self) -> &'static str {
        match self {
            Self::Open => "Ouvert",
            Self::Mitigating => "En att\u{00e9}nuation",
            Self::Accepted => "Accept\u{00e9}",
            Self::Closed => "Cl\u{00f4}tur\u{00e9}",
        }
    }

    pub fn all() -> &'static [Self] {
        &[Self::Open, Self::Mitigating, Self::Accepted, Self::Closed]
    }
}

/// A risk register entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskEntry {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    /// Probability (1-5).
    pub probability: u8,
    /// Impact (1-5).
    pub impact: u8,
    pub owner: String,
    pub status: RiskStatus,
    pub mitigation: String,
    /// Source: "manual", "compliance", "vulnerability", "threat".
    pub source: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// SLA target in days (None = no SLA).
    pub sla_target_days: Option<u32>,
}

impl RiskEntry {
    /// Risk score = probability × impact (1-25).
    pub fn score(&self) -> u8 {
        self.probability.saturating_mul(self.impact)
    }
}

// ============================================================================
// Custom detection rule types
// ============================================================================

/// Condition type for custom detection rules.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DetectionConditionType {
    ProcessNameContains,
    NetworkPort,
    FimPathMatch,
    CommandLineContains,
    SeverityLevel,
}

impl DetectionConditionType {
    pub fn label_fr(&self) -> &'static str {
        match self {
            Self::ProcessNameContains => "Nom processus contient",
            Self::NetworkPort => "Port r\u{00e9}seau",
            Self::FimPathMatch => "Chemin FIM correspond",
            Self::CommandLineContains => "Ligne de commande contient",
            Self::SeverityLevel => "Niveau de s\u{00e9}v\u{00e9}rit\u{00e9}",
        }
    }

    pub fn all() -> &'static [Self] {
        &[
            Self::ProcessNameContains,
            Self::NetworkPort,
            Self::FimPathMatch,
            Self::CommandLineContains,
            Self::SeverityLevel,
        ]
    }
}

/// A condition within a detection rule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionCondition {
    pub condition_type: DetectionConditionType,
    pub value: String,
}

/// A custom detection rule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionRule {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub severity: Severity,
    pub conditions: Vec<DetectionCondition>,
    pub actions: Vec<PlaybookActionType>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub last_match: Option<DateTime<Utc>>,
    pub match_count: u32,
}

// ============================================================================
// Forensic timeline types
// ============================================================================

/// Time range for forensic timeline filtering.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum TimelineRange {
    OneHour,
    SixHours,
    #[default]
    TwentyFourHours,
    SevenDays,
    ThirtyDays,
}

impl TimelineRange {
    pub fn label_fr(&self) -> &'static str {
        match self {
            Self::OneHour => "1H",
            Self::SixHours => "6H",
            Self::TwentyFourHours => "24H",
            Self::SevenDays => "7J",
            Self::ThirtyDays => "30J",
        }
    }

    pub fn seconds(&self) -> i64 {
        match self {
            Self::OneHour => 3_600,
            Self::SixHours => 21_600,
            Self::TwentyFourHours => 86_400,
            Self::SevenDays => 604_800,
            Self::ThirtyDays => 2_592_000,
        }
    }

    pub fn all() -> &'static [Self] {
        &[
            Self::OneHour,
            Self::SixHours,
            Self::TwentyFourHours,
            Self::SevenDays,
            Self::ThirtyDays,
        ]
    }
}

// ============================================================================
// Asset management types
// ============================================================================

/// Criticality level for managed assets.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetCriticality {
    Critical,
    High,
    #[default]
    Medium,
    Low,
}

impl AssetCriticality {
    pub fn label_fr(&self) -> &'static str {
        match self {
            Self::Critical => "Critique",
            Self::High => "\u{00c9}lev\u{00e9}e",
            Self::Medium => "Moyenne",
            Self::Low => "Faible",
        }
    }

    pub fn weight(&self) -> f32 {
        match self {
            Self::Critical => 4.0,
            Self::High => 3.0,
            Self::Medium => 2.0,
            Self::Low => 1.0,
        }
    }

    pub fn all() -> &'static [Self] {
        &[Self::Critical, Self::High, Self::Medium, Self::Low]
    }
}

/// Lifecycle state for managed assets.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetLifecycle {
    #[default]
    Discovered,
    Qualified,
    Monitored,
    Decommissioned,
}

impl AssetLifecycle {
    pub fn label_fr(&self) -> &'static str {
        match self {
            Self::Discovered => "D\u{00e9}couvert",
            Self::Qualified => "Qualifi\u{00e9}",
            Self::Monitored => "Surveill\u{00e9}",
            Self::Decommissioned => "D\u{00e9}commissionn\u{00e9}",
        }
    }

    pub fn all() -> &'static [Self] {
        &[Self::Discovered, Self::Qualified, Self::Monitored, Self::Decommissioned]
    }
}

/// A managed asset in the CMDB.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagedAsset {
    pub id: Uuid,
    pub ip: String,
    pub hostname: Option<String>,
    pub mac: Option<String>,
    pub vendor: Option<String>,
    pub device_type: String,
    pub criticality: AssetCriticality,
    pub lifecycle: AssetLifecycle,
    pub tags: Vec<String>,
    pub risk_score: f32,
    pub vulnerability_count: u32,
    pub open_ports: Vec<u16>,
    pub software: Vec<String>,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}

// ============================================================================
// KPI & trends types
// ============================================================================

/// A KPI snapshot for trend tracking.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct KpiSnapshot {
    pub timestamp: DateTime<Utc>,
    pub compliance_score: f32,
    pub incident_count: u32,
    pub open_vulns: u32,
    pub closed_vulns: u32,
    pub remediation_sla_pct: f32,
}

/// KPI display period.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum KpiPeriod {
    #[default]
    ThirtyDays,
    NinetyDays,
}

impl KpiPeriod {
    pub fn label_fr(&self) -> &'static str {
        match self {
            Self::ThirtyDays => "30J",
            Self::NinetyDays => "90J",
        }
    }

    pub fn days(&self) -> u32 {
        match self {
            Self::ThirtyDays => 30,
            Self::NinetyDays => 90,
        }
    }
}

// ============================================================================
// Compliance matrix types
// ============================================================================

/// View mode for the compliance page.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ComplianceViewMode {
    #[default]
    List,
    Matrix,
}

// ============================================================================
// Advanced alerting types
// ============================================================================

/// Type of alert rule.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AlertRuleType {
    SeverityThreshold,
    TypeFilter,
    EscalationDelay,
}

impl AlertRuleType {
    pub fn label_fr(&self) -> &'static str {
        match self {
            Self::SeverityThreshold => "Seuil de s\u{00e9}v\u{00e9}rit\u{00e9}",
            Self::TypeFilter => "Filtre par type",
            Self::EscalationDelay => "D\u{00e9}lai d'escalade",
        }
    }

    pub fn all() -> &'static [Self] {
        &[Self::SeverityThreshold, Self::TypeFilter, Self::EscalationDelay]
    }
}

/// An alert rule configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertRule {
    pub id: Uuid,
    pub name: String,
    pub rule_type: AlertRuleType,
    pub severity_threshold: Option<Severity>,
    pub detection_types: Vec<String>,
    pub escalation_minutes: Option<u32>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}

/// A webhook configuration for external alerting.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    /// Format: "slack", "teams", "generic".
    pub format: String,
    pub enabled: bool,
    pub last_sent: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_summary_serialization() {
        let summary = AgentSummary {
            status: GuiAgentStatus::Connected,
            version: "1.0.0".to_string(),
            hostname: "test-host".to_string(),
            agent_id: Some("agent-123".to_string()),
            organization: Some("Test Org".to_string()),
            compliance_score: Some(85.5),
            last_check_at: None,
            last_sync_at: None,
            pending_sync_count: 3,
            uptime_secs: 3600,
            active_frameworks: None,
            policy_summary: None,
        };

        let json = serde_json::to_string(&summary).unwrap();
        let parsed: AgentSummary = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.hostname, "test-host");
        assert_eq!(parsed.status, GuiAgentStatus::Connected);
    }

    #[test]
    fn test_gui_check_result_serialization() {
        let result = GuiCheckResult {
            check_id: "disk_encryption".to_string(),
            name: "Disk Encryption".to_string(),
            category: "encryption".to_string(),
            status: GuiCheckStatus::Pass,
            severity: Severity::High,
            score: Some(100),
            message: Some("BitLocker enabled".to_string()),
            details: None,
            executed_at: Some(Utc::now()),
            frameworks: vec!["NIS2".to_string(), "DORA".to_string()],
        };

        let json = serde_json::to_string(&result).unwrap();
        let parsed: GuiCheckResult = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.check_id, "disk_encryption");
        assert_eq!(parsed.status, GuiCheckStatus::Pass);
    }

    #[test]
    fn test_gui_notification_serialization() {
        let notification = GuiNotification {
            id: Uuid::new_v4(),
            title: "Check Failed".to_string(),
            body: "Firewall check has failed".to_string(),
            severity: "warning".to_string(),
            timestamp: Utc::now(),
            read: false,
            action: None,
        };

        let json = serde_json::to_string(&notification).unwrap();
        assert!(json.contains("Check Failed"));
    }
}
