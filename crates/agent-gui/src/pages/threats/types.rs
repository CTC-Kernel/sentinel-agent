//! Shared types and helpers for the EDR threats module.

use chrono::{DateTime, Utc};
use egui::Color32;

use crate::app::AppState;
use crate::dto::{FimChangeType, Severity, UsbEventType};
use crate::icons;
use crate::theme;

/// A unified representation of any security threat, regardless of source.
#[derive(Clone, Default)]
pub(super) struct ThreatEvent {
    /// Source type: "process", "usb", "fim", "network", "system", or "vulnerability".
    pub kind: &'static str,
    /// Severity level: "critical", "high", "medium", or "low".
    pub severity: &'static str,
    /// Display title (e.g. process name, device name, or file path).
    pub title: String,
    /// Descriptive subtitle / detail line.
    pub description: String,
    /// When the event occurred.
    pub timestamp: DateTime<Utc>,
    /// Confidence score (only relevant for suspicious process events).
    pub confidence: Option<u8>,
    /// Full command line (only relevant for suspicious process events).
    pub command_line: Option<String>,
    /// Index into the original source collection.
    pub source_index: usize,
}

/// Compute a risk score (0-100) that prioritizes critical threats across all 6 sources.
pub(super) fn compute_risk_score(
    state: &AppState,
    processes: usize,
    usb: usize,
    fim_unack: usize,
    network_alerts: usize,
    system_incidents: usize,
    vuln_count: usize,
) -> u32 {
    let critical_processes = state
        .threats
        .suspicious_processes
        .iter()
        .filter(|p| p.confidence > 80)
        .count();

    let regular_processes = processes.saturating_sub(critical_processes);

    let critical_net = state
        .network
        .alerts
        .iter()
        .filter(|a| matches!(a.severity, Severity::Critical))
        .count();
    let regular_net = network_alerts.saturating_sub(critical_net);

    let critical_sys = state
        .threats
        .system_incidents
        .iter()
        .filter(|i| matches!(i.severity, Severity::Critical))
        .count();
    let regular_sys = system_incidents.saturating_sub(critical_sys);

    let critical_vulns = state
        .vulnerability_findings
        .iter()
        .filter(|v| matches!(v.severity, Severity::Critical))
        .count();
    let high_vulns = state
        .vulnerability_findings
        .iter()
        .filter(|v| matches!(v.severity, Severity::High))
        .count();
    let _regular_vulns = vuln_count
        .saturating_sub(critical_vulns)
        .saturating_sub(high_vulns);

    let raw = (critical_processes as u32)
        .saturating_mul(40)
        .saturating_add((critical_net as u32).saturating_mul(35))
        .saturating_add((critical_sys as u32).saturating_mul(30))
        .saturating_add((critical_vulns as u32).saturating_mul(25))
        .saturating_add((high_vulns as u32).saturating_mul(10))
        .saturating_add((regular_processes as u32).saturating_mul(10))
        .saturating_add((regular_net as u32).saturating_mul(12))
        .saturating_add((regular_sys as u32).saturating_mul(8))
        .saturating_add((fim_unack as u32).saturating_mul(15))
        .saturating_add((usb as u32).saturating_mul(5));

    raw.min(100)
}

/// Map risk score to a color.
pub(super) fn risk_score_color(score: u32) -> Color32 {
    if score == 0 {
        theme::SUCCESS
    } else if score < 30 {
        theme::INFO
    } else if score < 60 {
        theme::WARNING
    } else {
        theme::ERROR
    }
}

/// Build a unified threat list from all state sources.
pub(super) fn build_threat_list(state: &AppState) -> Vec<ThreatEvent> {
    let mut events = Vec::new();

    // Suspicious processes
    for (i, p) in state.threats.suspicious_processes.iter().enumerate() {
        let severity = if p.confidence >= 90 {
            "critical"
        } else if p.confidence >= 70 {
            "high"
        } else if p.confidence >= 40 {
            "medium"
        } else {
            "low"
        };
        events.push(ThreatEvent {
            kind: "process",
            severity,
            title: p.process_name.clone(),
            description: p.reason.clone(),
            timestamp: p.detected_at,
            confidence: Some(p.confidence),
            command_line: Some(p.command_line.clone()),
            source_index: i,
        });
    }

    // USB events
    for (i, u) in state.threats.usb_events.iter().enumerate() {
        let severity = match u.event_type {
            UsbEventType::Connected => "medium",
            UsbEventType::Disconnected => "low",
        };
        events.push(ThreatEvent {
            kind: "usb",
            severity,
            title: u.device_name.clone(),
            description: format!(
                "{} \u{2014} VID:{:04X} PID:{:04X}",
                u.event_type, u.vendor_id, u.product_id,
            ),
            timestamp: u.timestamp,
            confidence: None,
            command_line: None,
            source_index: i,
        });
    }

    // FIM alerts
    for (i, f) in state.fim.alerts.iter().enumerate() {
        let severity = match f.change_type {
            FimChangeType::Deleted | FimChangeType::PermissionChanged => "high",
            FimChangeType::Created => "medium",
            FimChangeType::Modified => "medium",
            FimChangeType::Renamed => "low",
        };
        events.push(ThreatEvent {
            kind: "fim",
            severity,
            title: f.path.clone(),
            description: format!(
                "Changement d\u{00e9}tect\u{00e9} : {}{}",
                change_type_label(f.change_type),
                if f.acknowledged {
                    " (acquitt\u{00e9})"
                } else {
                    ""
                },
            ),
            timestamp: f.timestamp,
            confidence: None,
            command_line: None,
            source_index: i,
        });
    }

    // Network security alerts
    for (i, alert) in state.network.alerts.iter().enumerate() {
        let severity = alert.severity.as_str();
        let title = network_alert_type_label(&alert.alert_type);
        let mut desc_parts = vec![alert.description.clone()];
        if let Some(ref src) = alert.source_ip {
            desc_parts.push(format!("SRC: {}", src));
        }
        if let Some(ref dst) = alert.destination_ip {
            if let Some(port) = alert.destination_port {
                desc_parts.push(format!("DST: {}:{}", dst, port));
            } else {
                desc_parts.push(format!("DST: {}", dst));
            }
        }
        events.push(ThreatEvent {
            kind: "network",
            severity,
            title,
            description: desc_parts.join(" \u{2014} "),
            timestamp: alert.detected_at,
            confidence: Some(alert.confidence),
            command_line: None,
            source_index: i,
        });
    }

    // System security incidents
    for (i, inc) in state.threats.system_incidents.iter().enumerate() {
        events.push(ThreatEvent {
            kind: "system",
            severity: inc.severity.as_str(),
            title: inc.title.clone(),
            description: inc.description.clone(),
            timestamp: inc.detected_at,
            confidence: Some(inc.confidence),
            command_line: None,
            source_index: i,
        });
    }

    // Vulnerability findings
    for (i, v) in state.vulnerability_findings.iter().enumerate() {
        events.push(ThreatEvent {
            kind: "vulnerability",
            severity: v.severity.as_str(),
            title: format!("{} \u{2014} {}", v.cve_id, v.affected_software),
            description: v.description.clone(),
            timestamp: v.discovered_at.unwrap_or_else(Utc::now),
            confidence: v.cvss_score.map(|s| (s * 10.0).min(100.0) as u8),
            command_line: None,
            source_index: i,
        });
    }

    events
}

/// French label for a FIM change type.
pub(super) fn change_type_label(change_type: FimChangeType) -> &'static str {
    match change_type {
        FimChangeType::Created => "cr\u{00e9}ation",
        FimChangeType::Modified => "modification",
        FimChangeType::Deleted => "suppression",
        FimChangeType::PermissionChanged => "permissions modifi\u{00e9}es",
        FimChangeType::Renamed => "renommage",
    }
}

/// Severity icon + color tuple.
pub(super) fn severity_display(severity: &str) -> (&'static str, Color32) {
    match severity {
        "critical" => (icons::SEVERITY_CRITICAL, theme::ERROR),
        "high" => (icons::SEVERITY_HIGH, theme::SEVERITY_HIGH),
        "medium" => (icons::SEVERITY_MEDIUM, theme::WARNING),
        "low" => (icons::SEVERITY_LOW, theme::INFO),
        _ => (icons::SEVERITY_LOW, theme::WARNING),
    }
}

/// French badge label for a threat kind.
pub(super) fn kind_badge(kind: &str) -> (&'static str, Color32) {
    match kind {
        "process" => ("PROCESSUS", theme::ERROR),
        "network" => ("R\u{00c9}SEAU", theme::SEVERITY_HIGH),
        "usb" => ("USB", theme::WARNING),
        "fim" => ("FIM", theme::INFO),
        "system" => ("SYST\u{00c8}ME", theme::SEVERITY_HIGH),
        "vulnerability" => ("VULN\u{00c9}RA.", theme::ERROR),
        _ => ("AUTRE", theme::WARNING),
    }
}

/// French label for a network alert type.
pub(super) fn network_alert_type_label(alert_type: &str) -> String {
    match alert_type {
        "c2" => "Commande & Contr\u{00f4}le (C2)".to_string(),
        "mining" => "Crypto-minage d\u{00e9}tect\u{00e9}".to_string(),
        "exfiltration" => "Exfiltration de donn\u{00e9}es".to_string(),
        "dga" => "Domaine DGA d\u{00e9}tect\u{00e9}".to_string(),
        "beaconing" => "Balise C2 d\u{00e9}tect\u{00e9}e".to_string(),
        "port_scan" => "Scan de ports".to_string(),
        "suspicious_port" => "Port suspect".to_string(),
        "dns_tunneling" => "Tunnel DNS d\u{00e9}tect\u{00e9}".to_string(),
        other => other.replace('_', " ").to_uppercase(),
    }
}

/// French label for a system incident type.
pub(super) fn system_incident_type_label(incident_type: &str) -> &'static str {
    match incident_type {
        "firewall_disabled" => "Pare-feu d\u{00e9}sactiv\u{00e9}",
        "antivirus_disabled" => "Antivirus d\u{00e9}sactiv\u{00e9}",
        "privilege_escalation" => "Escalade de privil\u{00e8}ges",
        "reverse_shell" => "Reverse shell d\u{00e9}tect\u{00e9}",
        "credential_theft" => "Vol d\u{2019}identifiants",
        "unauthorized_change" => "Changement non autoris\u{00e9}",
        "malware" => "Malware d\u{00e9}tect\u{00e9}",
        "crypto_miner" => "Crypto-mineur d\u{00e9}tect\u{00e9}",
        "data_exfiltration" => "Exfiltration de donn\u{00e9}es",
        "suspicious_process" => "Processus suspect",
        _ => "Incident syst\u{00e8}me",
    }
}

/// Export threats to CSV.
pub(super) fn export_threats_csv(threats: &[ThreatEvent]) -> bool {
    let headers = &[
        "kind",
        "severity",
        "title",
        "description",
        "timestamp",
        "confidence",
    ];
    let rows: Vec<Vec<String>> = threats
        .iter()
        .map(|t| {
            vec![
                t.kind.to_string(),
                t.severity.to_string(),
                t.title.clone(),
                t.description.clone(),
                t.timestamp.to_rfc3339(),
                t.confidence.map(|c| c.to_string()).unwrap_or_default(),
            ]
        })
        .collect();
    let path = crate::export::default_export_path("menaces_export.csv");
    match crate::export::export_csv(headers, &rows, &path) {
        Ok(_) => true,
        Err(e) => {
            tracing::warn!("Export CSV failed: {}", e);
            false
        }
    }
}
