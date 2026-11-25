// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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
    /// Whether this threat has been acknowledged by an operator.
    pub acknowledged: bool,
    /// Whether this threat is authorized/allowlisted by an explicit rule.
    pub allowlisted: bool,
}

impl ThreatEvent {
    /// Still awaiting operator triage. Vulnerabilities are handled in their own
    /// module (patching lifecycle) and never block this queue.
    pub fn needs_triage(&self) -> bool {
        !self.acknowledged && !self.allowlisted && self.kind != "vulnerability"
    }
}

/// Compute a risk score (0-100) that prioritizes critical threats across all 6 sources.
pub(super) fn compute_risk_score(
    state: &AppState,
    processes: usize,
    usb: usize,
    fim_unack: usize,
    network_alerts: usize,
    system_incidents: usize,
    _vuln_count: usize,
) -> u32 {
    let critical_processes = state
        .threats
        .suspicious_processes
        .iter()
        .filter(|p| !p.acknowledged && !p.allowlisted && p.confidence > 80)
        .count();

    let regular_processes = processes.saturating_sub(critical_processes);

    let critical_net = state
        .network
        .alerts
        .iter()
        .filter(|a| !a.acknowledged && !a.allowlisted && matches!(a.severity, Severity::Critical))
        .count();
    let regular_net = network_alerts.saturating_sub(critical_net);

    let critical_sys = state
        .threats
        .system_incidents
        .iter()
        .filter(|i| !i.acknowledged && !i.allowlisted && matches!(i.severity, Severity::Critical))
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
        let allowlisted = p.allowlisted
            || state.threats.is_allowlisted(
                crate::dto::AllowlistRuleType::ProcessPattern,
                &p.process_name,
            );
        events.push(ThreatEvent {
            kind: "process",
            severity,
            title: p.process_name.clone(),
            description: p.reason.clone(),
            timestamp: p.detected_at,
            confidence: Some(p.confidence),
            command_line: Some(p.command_line.clone()),
            source_index: i,
            acknowledged: p.acknowledged || allowlisted,
            allowlisted,
        });
    }

    // USB events
    for (i, u) in state.threats.usb_events.iter().enumerate() {
        let severity = match u.event_type {
            UsbEventType::Connected => "medium",
            UsbEventType::Disconnected => "low",
            UsbEventType::Blocked => "high",
        };
        let usb_id = format!("0x{:04x}:0x{:04x}", u.vendor_id, u.product_id);
        let allowlisted = u.allowlisted
            || state
                .threats
                .is_allowlisted(crate::dto::AllowlistRuleType::UsbDevice, &usb_id)
            || state
                .threats
                .is_allowlisted(crate::dto::AllowlistRuleType::UsbDevice, &u.device_name);
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
            acknowledged: u.acknowledged || allowlisted,
            allowlisted,
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
        let allowlisted = state
            .threats
            .is_allowlisted(crate::dto::AllowlistRuleType::FilePath, &f.path);
        events.push(ThreatEvent {
            kind: "fim",
            severity,
            title: f.path.clone(),
            description: format!(
                "Changement d\u{00e9}tect\u{00e9} : {}{}",
                change_type_label(f.change_type),
                if f.acknowledged || allowlisted {
                    " (acquitt\u{00e9})"
                } else {
                    ""
                },
            ),
            timestamp: f.timestamp,
            confidence: None,
            command_line: None,
            source_index: i,
            acknowledged: f.acknowledged || allowlisted,
            allowlisted,
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
        // Only the remote peer can be authorized (see `refresh_authorizations`).
        let target_ip = alert.destination_ip.as_deref().unwrap_or("");
        let allowlisted = alert.allowlisted
            || state
                .threats
                .is_allowlisted(crate::dto::AllowlistRuleType::IpAddress, target_ip);
        events.push(ThreatEvent {
            kind: "network",
            severity,
            title,
            description: desc_parts.join(" \u{2014} "),
            timestamp: alert.detected_at,
            confidence: Some(alert.confidence),
            command_line: None,
            source_index: i,
            acknowledged: alert.acknowledged || allowlisted,
            allowlisted,
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
            acknowledged: inc.acknowledged,
            allowlisted: inc.allowlisted,
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
            acknowledged: false,
            allowlisted: false,
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
        "medium" => (icons::SEVERITY_MEDIUM, theme::SEVERITY_MEDIUM),
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
        "vulnerability" => ("CVE", theme::ERROR),
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

/// French label of a severity key ("critical"), as the tables say it.
pub(super) fn severity_label_fr(severity: &str) -> &'static str {
    match severity {
        "critical" => "Critique",
        "high" => "\u{00c9}lev\u{00e9}e",
        "medium" => "Moyenne",
        _ => "Faible",
    }
}

/// Whether an event matches a search typed by the operator: its title, its
/// description, or its kind as the interface names it ("réseau", "processus").
pub(super) fn matches_search(threat: &ThreatEvent, search_lower: &str) -> bool {
    threat.title.to_lowercase().contains(search_lower)
        || threat.description.to_lowercase().contains(search_lower)
        || kind_badge(threat.kind)
            .0
            .to_lowercase()
            .contains(search_lower)
        || threat.kind.contains(search_lower)
}

/// An event another tab asks the overview to open in its detail modal: the
/// source collection and the index in it.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(super) struct OpenRequest {
    pub kind: &'static str,
    pub source_index: usize,
}

fn open_request_id() -> egui::Id {
    egui::Id::new("threats_open_event_request")
}

/// Ask the overview to open the detail of an event. The caller switches to
/// the overview tab; the feed's filters are lifted there if they hide it.
pub(super) fn request_open(ctx: &egui::Context, kind: &'static str, source_index: usize) {
    ctx.data_mut(|d| d.insert_temp(open_request_id(), OpenRequest { kind, source_index }));
}

/// The pending request, left in place until [`clear_open_request`].
pub(super) fn open_request(ctx: &egui::Context) -> Option<OpenRequest> {
    ctx.data(|d| d.get_temp(open_request_id()))
}

pub(super) fn clear_open_request(ctx: &egui::Context) {
    ctx.data_mut(|d| d.remove::<OpenRequest>(open_request_id()));
}

/// The `&'static` source key of a kind named by another module.
pub(super) fn static_kind(kind: &str) -> Option<&'static str> {
    [
        "process",
        "usb",
        "fim",
        "network",
        "system",
        "vulnerability",
    ]
    .into_iter()
    .find(|known| *known == kind)
}

/// A row of sort chips for a list that has no header row (cards, journal
/// lines). The order is kept like a table's, under `table`: read it back
/// with `widgets::table::sort_of`. A click cycles ascending, descending,
/// then the list's own order. Returns true when the order changed.
pub(crate) fn sort_bar(ui: &mut egui::Ui, table: &'static str, columns: &[(&str, &str)]) -> bool {
    use crate::widgets::data_table::{SortDirection, TableSort};
    use crate::widgets::table;

    let mut sort = table::sort_of(ui.ctx(), table);
    let mut changed = false;
    ui.horizontal_wrapped(|ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new("TRIER PAR")
                .font(theme::font_label())
                .color(theme::text_tertiary()),
        );
        ui.add_space(theme::SPACE_XS);
        for (key, label) in columns {
            let active = table::sort_key(&sort) == Some(*key);
            let icon = match (active, sort.direction) {
                (true, SortDirection::Ascending) => icons::SORT_UP,
                (true, SortDirection::Descending) => icons::SORT_DOWN,
                _ => icons::SORT,
            };
            if crate::widgets::chip_button(ui, &format!("{label}  {icon}"), active, theme::ACCENT)
                .on_hover_text(format!("Trier par {}", label.to_lowercase()))
                .clicked()
            {
                sort = match (active, sort.direction) {
                    (true, SortDirection::Ascending) => {
                        TableSort::by(key, SortDirection::Descending)
                    }
                    (true, SortDirection::Descending) => TableSort::default(),
                    _ => TableSort::by(key, SortDirection::Ascending),
                };
                changed = true;
            }
        }
    });
    if changed {
        ui.data_mut(|d| d.insert_temp(egui::Id::new(("table_sort", table)), sort));
        ui.ctx().request_repaint();
    }
    changed
}

/// Order `items` as `sort` asks, keeping the list's own order between equal
/// rows and when no column is chosen. `compare` gives the ascending order of
/// a column key; an unknown key leaves the list as it is.
pub(crate) fn sort_rows<T>(
    items: &mut [T],
    sort: &crate::widgets::data_table::TableSort,
    compare: impl Fn(&str, &T, &T) -> std::cmp::Ordering,
) {
    let Some(key) = crate::widgets::table::sort_key(sort) else {
        return;
    };
    items.sort_by(|a, b| crate::widgets::table::directed(sort, compare(key, a, b)));
}

/// Case-insensitive order of two texts.
pub(crate) fn text_order(a: &str, b: &str) -> std::cmp::Ordering {
    a.to_lowercase().cmp(&b.to_lowercase())
}

/// Rank of a severity key, lowest first.
pub(crate) fn severity_rank(severity: &str) -> u8 {
    match severity {
        "critical" => 3,
        "high" => 2,
        "medium" => 1,
        _ => 0,
    }
}

/// Export threats to CSV. Returns the file written.
pub(super) fn export_threats_csv(threats: &[ThreatEvent]) -> Option<std::path::PathBuf> {
    let headers = &[
        "type",
        "severite",
        "titre",
        "description",
        "date",
        "confiance",
    ];
    let rows: Vec<Vec<String>> = threats
        .iter()
        .map(|t| {
            vec![
                kind_badge(t.kind).0.to_string(),
                severity_label_fr(t.severity).to_string(),
                t.title.clone(),
                t.description.clone(),
                t.timestamp.to_rfc3339(),
                t.confidence.map(|c| c.to_string()).unwrap_or_default(),
            ]
        })
        .collect();
    match crate::export::export_csv_timestamped("menaces_export", headers, &rows) {
        Ok(path) => Some(path),
        Err(e) => {
            tracing::warn!("Export CSV failed: {}", e);
            None
        }
    }
}
