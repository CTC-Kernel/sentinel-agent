//! Security monitoring module.
//!
//! This module provides real-time security incident detection by monitoring:
//! - Running processes for suspicious activity (crypto miners, reverse shells)
//! - System changes (new admin accounts, firewall disabled)
//! - Antivirus status integration
//!
//! # Architecture
//!
//! ```text
//! ┌──────────────────┐
//! │  SecurityMonitor │
//! └────────┬─────────┘
//!          │
//!          ├──▶ ProcessMonitor
//!          │    └── Detects suspicious processes
//!          │
//!          ├──▶ SystemMonitor
//!          │    └── Detects system changes
//!          │
//!          └──▶ AntivirusIntegration (optional)
//!               └── Queries local AV status
//! ```

pub mod process_monitor;
pub mod system_monitor;

use crate::error::ScannerResult;
use chrono::{DateTime, Utc};
use process_monitor::ProcessMonitor;
use serde::{Deserialize, Serialize};
use system_monitor::SystemMonitor;
use tracing::{debug, info, warn};

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

impl std::fmt::Display for IncidentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Malware => write!(f, "malware"),
            Self::SuspiciousProcess => write!(f, "suspicious_process"),
            Self::UnauthorizedChange => write!(f, "unauthorized_change"),
            Self::DataExfiltration => write!(f, "data_exfiltration"),
            Self::CryptoMiner => write!(f, "crypto_miner"),
            Self::ReverseShell => write!(f, "reverse_shell"),
            Self::CredentialTheft => write!(f, "credential_theft"),
            Self::PrivilegeEscalation => write!(f, "privilege_escalation"),
            Self::FirewallDisabled => write!(f, "firewall_disabled"),
            Self::AntivirusDisabled => write!(f, "antivirus_disabled"),
        }
    }
}

/// Severity levels for incidents.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum IncidentSeverity {
    Critical,
    High,
    Medium,
    Low,
}

impl Default for IncidentSeverity {
    fn default() -> Self {
        Self::Medium
    }
}

impl std::fmt::Display for IncidentSeverity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Critical => write!(f, "Critical"),
            Self::High => write!(f, "High"),
            Self::Medium => write!(f, "Medium"),
            Self::Low => write!(f, "Low"),
        }
    }
}

/// A detected security incident.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SecurityIncident {
    /// Type of incident.
    pub incident_type: IncidentType,

    /// Severity level.
    pub severity: IncidentSeverity,

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

impl SecurityIncident {
    /// Create a new security incident.
    pub fn new(
        incident_type: IncidentType,
        severity: IncidentSeverity,
        title: impl Into<String>,
        description: impl Into<String>,
    ) -> Self {
        Self {
            incident_type,
            severity,
            title: title.into(),
            description: description.into(),
            evidence: serde_json::json!({}),
            confidence: 50,
            detected_at: Utc::now(),
        }
    }

    /// Set evidence data.
    pub fn with_evidence(mut self, evidence: serde_json::Value) -> Self {
        self.evidence = evidence;
        self
    }

    /// Set confidence level.
    pub fn with_confidence(mut self, confidence: u8) -> Self {
        self.confidence = confidence.min(100);
        self
    }

    /// Create a suspicious process incident.
    pub fn suspicious_process(
        process_name: &str,
        pid: u32,
        path: Option<&str>,
        reason: &str,
        confidence: u8,
    ) -> Self {
        let severity = if confidence >= 80 {
            IncidentSeverity::High
        } else if confidence >= 50 {
            IncidentSeverity::Medium
        } else {
            IncidentSeverity::Low
        };

        Self::new(
            IncidentType::SuspiciousProcess,
            severity,
            format!("Suspicious process detected: {}", process_name),
            format!(
                "Process {} (PID: {}) flagged: {}",
                process_name, pid, reason
            ),
        )
        .with_evidence(serde_json::json!({
            "process_name": process_name,
            "pid": pid,
            "path": path,
            "reason": reason,
        }))
        .with_confidence(confidence)
    }

    /// Create a crypto miner incident.
    pub fn crypto_miner(process_name: &str, pid: u32, path: Option<&str>) -> Self {
        Self::new(
            IncidentType::CryptoMiner,
            IncidentSeverity::High,
            format!("Crypto miner detected: {}", process_name),
            format!(
                "Process {} (PID: {}) matches known crypto miner signature",
                process_name, pid
            ),
        )
        .with_evidence(serde_json::json!({
            "process_name": process_name,
            "pid": pid,
            "path": path,
            "miner_type": "cryptocurrency",
        }))
        .with_confidence(90)
    }

    /// Create a system change incident.
    pub fn system_change(
        change_type: &str,
        description: &str,
        severity: IncidentSeverity,
        details: serde_json::Value,
    ) -> Self {
        Self::new(
            IncidentType::UnauthorizedChange,
            severity,
            format!("System change detected: {}", change_type),
            description.to_string(),
        )
        .with_evidence(serde_json::json!({
            "change_type": change_type,
            "details": details,
        }))
        .with_confidence(80)
    }

    /// Create a firewall disabled incident.
    pub fn firewall_disabled(details: serde_json::Value) -> Self {
        Self::new(
            IncidentType::FirewallDisabled,
            IncidentSeverity::High,
            "Firewall protection disabled",
            "System firewall has been disabled, reducing security protection",
        )
        .with_evidence(details)
        .with_confidence(95)
    }

    /// Create an antivirus disabled incident.
    pub fn antivirus_disabled(av_name: &str, details: serde_json::Value) -> Self {
        Self::new(
            IncidentType::AntivirusDisabled,
            IncidentSeverity::High,
            format!("Antivirus protection disabled: {}", av_name),
            format!("{} real-time protection has been disabled", av_name),
        )
        .with_evidence(details)
        .with_confidence(95)
    }
}

/// Result of a security scan.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SecurityScanResult {
    /// Detected incidents.
    pub incidents: Vec<SecurityIncident>,

    /// When the scan started.
    pub started_at: DateTime<Utc>,

    /// When the scan completed.
    pub completed_at: DateTime<Utc>,

    /// Number of processes scanned.
    pub processes_scanned: u32,

    /// Number of system checks performed.
    pub system_checks_performed: u32,

    /// Any errors encountered (non-fatal).
    #[serde(default)]
    pub errors: Vec<String>,
}

/// Main security monitor that coordinates process and system monitoring.
pub struct SecurityMonitor {
    process_monitor: ProcessMonitor,
    system_monitor: SystemMonitor,
}

impl SecurityMonitor {
    /// Create a new security monitor.
    pub fn new() -> Self {
        Self {
            process_monitor: ProcessMonitor::new(),
            system_monitor: SystemMonitor::new(),
        }
    }

    /// Run a full security scan.
    pub async fn scan(&self) -> ScannerResult<SecurityScanResult> {
        let started_at = Utc::now();
        let mut all_incidents = Vec::new();
        let mut all_errors = Vec::new();
        let mut processes_scanned = 0u32;
        let mut system_checks = 0u32;

        // Scan running processes
        info!("Scanning running processes for suspicious activity...");
        match self.process_monitor.scan_processes().await {
            Ok((incidents, count)) => {
                processes_scanned = count;
                debug!(
                    "Found {} suspicious processes out of {} scanned",
                    incidents.len(),
                    count
                );
                all_incidents.extend(incidents);
            }
            Err(e) => {
                let error_msg = format!("Process scan failed: {}", e);
                warn!("{}", error_msg);
                all_errors.push(error_msg);
            }
        }

        // Perform system checks
        info!("Performing system security checks...");
        match self.system_monitor.check_system().await {
            Ok((incidents, count)) => {
                system_checks = count;
                debug!(
                    "Found {} system issues from {} checks",
                    incidents.len(),
                    count
                );
                all_incidents.extend(incidents);
            }
            Err(e) => {
                let error_msg = format!("System check failed: {}", e);
                warn!("{}", error_msg);
                all_errors.push(error_msg);
            }
        }

        let completed_at = Utc::now();

        info!(
            "Security scan complete: {} incidents detected",
            all_incidents.len()
        );

        Ok(SecurityScanResult {
            incidents: all_incidents,
            started_at,
            completed_at,
            processes_scanned,
            system_checks_performed: system_checks,
            errors: all_errors,
        })
    }

    /// Quick check for critical issues only.
    pub async fn quick_check(&self) -> ScannerResult<Vec<SecurityIncident>> {
        let mut incidents = Vec::new();

        // Only check for high-priority threats
        if let Ok((proc_incidents, _)) = self.process_monitor.scan_processes().await {
            incidents.extend(proc_incidents.into_iter().filter(|i| {
                matches!(
                    i.severity,
                    IncidentSeverity::Critical | IncidentSeverity::High
                )
            }));
        }

        if let Ok((sys_incidents, _)) = self.system_monitor.check_system().await {
            incidents.extend(sys_incidents.into_iter().filter(|i| {
                matches!(
                    i.severity,
                    IncidentSeverity::Critical | IncidentSeverity::High
                )
            }));
        }

        Ok(incidents)
    }
}

impl Default for SecurityMonitor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_incident_type_display() {
        assert_eq!(IncidentType::Malware.to_string(), "malware");
        assert_eq!(IncidentType::CryptoMiner.to_string(), "crypto_miner");
        assert_eq!(
            IncidentType::FirewallDisabled.to_string(),
            "firewall_disabled"
        );
    }

    #[test]
    fn test_security_incident_creation() {
        let incident = SecurityIncident::new(
            IncidentType::Malware,
            IncidentSeverity::Critical,
            "Malware detected",
            "Detected malware in system",
        );

        assert_eq!(incident.incident_type, IncidentType::Malware);
        assert_eq!(incident.severity, IncidentSeverity::Critical);
        assert_eq!(incident.confidence, 50);
    }

    #[test]
    fn test_suspicious_process_incident() {
        let incident = SecurityIncident::suspicious_process(
            "xmrig",
            1234,
            Some("/tmp/xmrig"),
            "Known crypto miner",
            90,
        );

        assert_eq!(incident.incident_type, IncidentType::SuspiciousProcess);
        assert_eq!(incident.severity, IncidentSeverity::High);
        assert_eq!(incident.confidence, 90);
    }

    #[test]
    fn test_crypto_miner_incident() {
        let incident = SecurityIncident::crypto_miner("minerd", 5678, None);

        assert_eq!(incident.incident_type, IncidentType::CryptoMiner);
        assert_eq!(incident.severity, IncidentSeverity::High);
        assert_eq!(incident.confidence, 90);
    }

    #[test]
    fn test_security_monitor_creation() {
        let monitor = SecurityMonitor::new();
        // Should not panic
        let _ = monitor;
    }
}
