// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! GUI event bridge — methods on AgentRuntime that emit events to the desktop UI.
//!
//! All methods are gated behind `#[cfg(feature = "gui")]`.

#[cfg(feature = "gui")]
use crate::AgentRuntime;
#[cfg(feature = "gui")]
use agent_common::constants::AGENT_VERSION;
#[cfg(feature = "gui")]
use agent_common::types::CheckSeverity;
#[cfg(feature = "gui")]
use agent_gui::dto::{
    AgentSummary, GuiAgentStatus, GuiCheckResult, GuiCheckStatus, GuiExploitIntelStatus,
    GuiNetworkAlert, GuiNetworkConnection, GuiNetworkInterface, GuiNotification, GuiPolicySummary,
    GuiResourceUsage, GuiSoftwarePackage, GuiVulnerabilityFinding,
    PatchPriority as GuiPatchPriority, Severity as GuiSeverity,
};
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
#[cfg(feature = "gui")]
use agent_scanner::{CheckExecutionResult, VulnerabilityScanResult};
#[cfg(feature = "gui")]
use std::sync::atomic::Ordering;
#[cfg(feature = "gui")]
use tracing::warn;

/// What a file integrity alert changed besides the contents, as shown in the
/// interface: `permissions 440 → 666 · propriétaire 0:0 → 501:20`.
#[cfg(feature = "gui")]
pub(crate) fn fim_change_detail(alert: &agent_common::types::FimAlert) -> Option<String> {
    use agent_common::types::PERMISSION_BITS;
    let mut parts = Vec::new();
    if let (Some(old), Some(new)) = (alert.old_permissions, alert.new_permissions) {
        parts.push(format!(
            "permissions {:o} \u{2192} {:o}",
            old & PERMISSION_BITS,
            new & PERMISSION_BITS
        ));
    }
    if let (Some(old), Some(new)) = (alert.old_owner, alert.new_owner) {
        parts.push(format!(
            "propri\u{00e9}taire {}:{} \u{2192} {}:{}",
            old.uid, old.gid, new.uid, new.gid
        ));
    }
    if alert.widens_access() {
        parts.push("acc\u{00e8}s \u{00e9}largi".to_string());
    }
    (!parts.is_empty()).then(|| parts.join(" \u{00b7} "))
}

/// The alert rules and the webhooks of the local database as the interface
/// lists them, each webhook with the outcome of the last alert sent to it.
///
/// Sent at start-up and after every delivery: the "dernier envoi" and the
/// error of a webhook used to stay empty until a rule or a webhook was
/// edited, the only moment the delivery status was read.
#[cfg(feature = "gui")]
pub async fn alerting_loaded_event(db: &agent_storage::Database) -> AgentEvent {
    let alert_repo = agent_storage::repositories::grc::AlertRuleRepository::new(db);
    let webhook_repo = agent_storage::repositories::grc::WebhookRepository::new(db);
    let stored_rules = alert_repo.get_all().await.unwrap_or_default();
    let stored_webhooks = webhook_repo.get_all().await.unwrap_or_default();
    let deliveries = webhook_repo.delivery_status().await.unwrap_or_default();

    let rules = stored_rules
        .iter()
        .map(|s| agent_gui::dto::AlertRule {
            id: s.id.clone(),
            name: s.name.clone(),
            rule_type: match s.rule_type.as_str() {
                "TypeFilter" | "DetectionType" => agent_gui::dto::AlertRuleType::TypeFilter,
                "EscalationDelay" | "Escalation" => agent_gui::dto::AlertRuleType::EscalationDelay,
                _ => agent_gui::dto::AlertRuleType::SeverityThreshold,
            },
            severity_threshold: s.severity_threshold.as_deref().map(|sev| match sev {
                "critical" | "Critical" => GuiSeverity::Critical,
                "high" | "High" => GuiSeverity::High,
                "low" | "Low" => GuiSeverity::Low,
                "info" | "Info" => GuiSeverity::Info,
                _ => GuiSeverity::Medium,
            }),
            detection_types: serde_json::from_str(&s.detection_types).unwrap_or_default(),
            escalation_minutes: s.escalation_minutes.map(|v| v as u32),
            enabled: s.enabled,
            created_at: chrono::DateTime::parse_from_rfc3339(&s.created_at)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now()),
        })
        .collect();

    let webhooks = stored_webhooks
        .iter()
        .map(|s| {
            let delivery = deliveries.get(&s.id);
            agent_gui::dto::WebhookConfig {
                id: s.id.clone(),
                name: s.name.clone(),
                url: s.url.clone(),
                // The stored `events` column carries the format.
                format: s.events.clone(),
                enabled: s.enabled,
                last_sent: delivery
                    .and_then(|d| d.last_sent.as_deref())
                    .and_then(|at| chrono::DateTime::parse_from_rfc3339(at).ok())
                    .map(|at| at.with_timezone(&chrono::Utc)),
                error: delivery.and_then(|d| d.last_error.clone()),
            }
        })
        .collect();

    AgentEvent::AlertingLoaded { rules, webhooks }
}

/// The risk register of the local database as the interface lists it:
/// sent at start-up, and again when a change asked for from the interface
/// could not be written, so the page shows what is really kept. `None`
/// when the register cannot be read.
#[cfg(feature = "gui")]
pub async fn risks_snapshot_event(db: &agent_storage::Database) -> Option<AgentEvent> {
    let stored = agent_storage::repositories::grc::RiskRepository::new(db)
        .get_all()
        .await
        .ok()?;
    let risks = stored
        .iter()
        .map(|s| agent_gui::dto::RiskEntry {
            id: s.id.clone(),
            title: s.title.clone(),
            description: s.description.clone(),
            probability: s.probability.clamp(1, 5) as u8,
            impact: s.impact.clamp(1, 5) as u8,
            owner: s.owner.clone(),
            status: match s.status.as_str() {
                "mitigating" => agent_gui::dto::RiskStatus::Mitigating,
                "accepted" => agent_gui::dto::RiskStatus::Accepted,
                "closed" => agent_gui::dto::RiskStatus::Closed,
                _ => agent_gui::dto::RiskStatus::Open,
            },
            mitigation: s.mitigation.clone(),
            source: s.source.clone(),
            created_at: chrono::DateTime::parse_from_rfc3339(&s.created_at)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now()),
            updated_at: chrono::DateTime::parse_from_rfc3339(&s.updated_at)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now()),
            sla_target_days: s.sla_target_days.map(|v| v as u32),
        })
        .collect();
    Some(AgentEvent::RisksSnapshot { risks })
}

/// The statistics of the SIEM forwarder as the interface shows them.
/// "Connected" needs both the forwarding switched on and a last delivery
/// that went through; how long the forwarder has been up is not measured,
/// and stays at zero (the interface then leaves it out).
#[cfg(feature = "gui")]
pub(crate) fn siem_stats_to_gui(
    forwarder: &agent_siem::SiemStats,
    events_buffered: usize,
    enabled: bool,
    events_per_minute: f32,
    category_counts: Vec<(String, u32)>,
) -> agent_gui::dto::GuiSiemStats {
    agent_gui::dto::GuiSiemStats {
        events_sent: forwarder.events_sent,
        events_dropped: forwarder.events_dropped,
        events_buffered: u32::try_from(events_buffered).unwrap_or(u32::MAX),
        connected: enabled && forwarder.is_connected,
        last_sent_at: forwarder.last_success,
        uptime_secs: 0,
        events_per_minute,
        category_counts,
    }
}

#[cfg(feature = "gui")]
impl AgentRuntime {
    /// Emit a GUI event (no-op if no sender set).
    pub(crate) fn emit_gui_event(&self, event: AgentEvent) {
        if let Some(ref tx) = self.gui_event_tx
            && let Err(e) = tx.send(event)
        {
            warn!("Failed to emit GUI event: {}", e);
        }
    }

    /// Build and emit the current agent summary to the GUI.
    pub(crate) fn emit_status_update(
        &self,
        last_check_at: Option<chrono::DateTime<chrono::Utc>>,
        compliance_score: Option<f64>,
        pending_sync_count: u32,
        policy_summary: Option<GuiPolicySummary>,
    ) {
        let usage = self.resource_monitor.get_usage();
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        let status = if self.is_paused() {
            GuiAgentStatus::Paused
        } else if self.state.scanning.load(Ordering::Acquire) {
            GuiAgentStatus::Scanning
        } else if self.config.standalone {
            GuiAgentStatus::Standalone
        } else if self.authenticated_client.is_none() {
            GuiAgentStatus::Disconnected
        } else {
            GuiAgentStatus::Connected
        };

        let last_sync_at = self.last_sync_at.try_read().ok().and_then(|g| *g);

        let summary = AgentSummary {
            status,
            version: AGENT_VERSION.to_string(),
            hostname,
            agent_id: self.config.agent_id.clone(),
            organization: self
                .organization_name
                .try_read()
                .ok()
                .and_then(|g| g.clone()),
            compliance_score: compliance_score.map(|s| s as f32),
            last_check_at,
            last_sync_at,
            pending_sync_count,
            uptime_secs: usage.uptime_ms / 1000,
            active_frameworks: self
                .active_frameworks
                .read()
                .unwrap_or_else(|e| e.into_inner())
                .clone(),
            policy_summary,
            standalone: self.config.standalone,
            ransomware_canaries: self.state.ransomware_canaries.load(Ordering::Acquire),
            host_isolated: crate::host_isolation::is_isolated(),
            detection: self.gui_detection_options(),
            connection: Some(self.gui_connection_settings()),
        };

        self.emit_gui_event(AgentEvent::StatusChanged { summary });
    }

    /// The platform address this agent was configured with and the
    /// heartbeat interval in effect (the platform may have changed it).
    pub(crate) fn gui_connection_settings(&self) -> agent_gui::dto::GuiConnectionSettings {
        agent_gui::dto::GuiConnectionSettings {
            server_url: self.config.server_url.clone(),
            heartbeat_interval_secs: self
                .heartbeat_interval_secs
                .try_read()
                .map(|interval| *interval)
                .unwrap_or(self.config.heartbeat_interval_secs),
            // What the agent runs with, whoever set it last (configuration,
            // platform or settings page): the page shows this, not what
            // the interface remembered from a previous session.
            check_interval_secs: Some(self.state.get_check_interval()),
            log_level: Some(
                crate::logging::tracing_level_index().unwrap_or(self.state.get_log_level()),
            ),
        }
    }

    /// The detection engines this agent was started with.
    pub(crate) fn gui_detection_options(&self) -> agent_gui::dto::GuiDetectionOptions {
        agent_gui::dto::GuiDetectionOptions {
            log_analysis: self.config.log_analysis,
            rootkit_detection: self.config.rootkit_detection,
            system_inventory: self.config.system_inventory,
            hardening_benchmark: self.config.hardening_benchmark,
            fim_report_changes: self.config.fim_report_changes,
            fim_whodata: self.config.fim_whodata,
            process_events: self.config.process_event_telemetry,
            usb_storage_blocking: self.config.usb_block_mass_storage,
            log_rules: self.log_rules_summary.clone(),
        }
    }

    /// Emit resource usage update to the GUI.
    pub(crate) fn emit_resource_update(&self, usage: Option<crate::resources::ResourceUsage>) {
        let usage = usage.unwrap_or_else(|| self.resource_monitor.get_usage());
        let sys = crate::resources::get_system_resources();
        self.emit_gui_event(AgentEvent::ResourceUpdate {
            usage: GuiResourceUsage {
                cpu_percent: sys.cpu_percent,
                memory_percent: sys.memory_percent,
                memory_used_mb: sys.memory_used_bytes / (1024 * 1024),
                memory_total_mb: sys.memory_total_bytes / (1024 * 1024),
                disk_kbps: usage.disk_kbps,
                uptime_secs: usage.uptime_ms / 1000,
                disk_percent: sys.disk_percent,
                network_io_bytes: usage.network_io_bytes,
            },
        });
    }

    /// Emit a notification to the GUI.
    pub(crate) fn emit_notification(&self, title: &str, body: &str, severity: &str) {
        self.emit_gui_event(AgentEvent::Notification {
            notification: GuiNotification {
                id: uuid::Uuid::new_v4(),
                title: title.to_string(),
                body: body.to_string(),
                severity: severity.to_string(),
                timestamp: chrono::Utc::now(),
                read: false,
                action: None,
            },
        });
    }

    /// Convert a `VulnerabilityScanResult` into a `Vec<GuiSoftwarePackage>` for the GUI.
    pub(crate) fn build_software_packages(
        &self,
        scan_result: &VulnerabilityScanResult,
    ) -> Vec<GuiSoftwarePackage> {
        let mut vuln_counts: std::collections::HashMap<String, usize> =
            std::collections::HashMap::new();
        for v in &scan_result.vulnerabilities {
            *vuln_counts.entry(v.package_name.clone()).or_insert(0) += 1;
        }

        scan_result
            .packages
            .iter()
            .map(|pkg| {
                // Debian/Ubuntu findings are reported on the source package.
                let has_vulns = vuln_counts.contains_key(&pkg.name)
                    || pkg
                        .source_name
                        .as_ref()
                        .is_some_and(|source| vuln_counts.contains_key(source));
                GuiSoftwarePackage {
                    name: pkg.name.clone(),
                    version: pkg.version.clone(),
                    publisher: None,
                    installed_at: None,
                    up_to_date: !has_vulns,
                    latest_version: None,
                }
            })
            .collect()
    }

    /// Convert a `VulnerabilityScanResult` into a `Vec<GuiVulnerabilityFinding>` for the GUI.
    pub(crate) fn build_vulnerability_findings(
        &self,
        scan_result: &VulnerabilityScanResult,
    ) -> Vec<GuiVulnerabilityFinding> {
        scan_result
            .vulnerabilities
            .iter()
            .map(|v| GuiVulnerabilityFinding {
                cve_id: v
                    .cve_id
                    .clone()
                    .or_else(|| v.advisory_id.clone())
                    .unwrap_or_else(|| {
                        format!(
                            "{}-{}",
                            v.source.to_uppercase(),
                            v.package_name.to_uppercase()
                        )
                    }),
                affected_software: v.package_name.clone(),
                affected_version: v.installed_version.clone(),
                severity: self.scanner_severity_to_gui(v.severity),
                // Only a real score: none is invented from the severity.
                cvss_score: v.cvss_score,
                description: v.description.clone(),
                fix_available: v.available_version.is_some(),
                discovered_at: Some(v.detected_at),
                source: v.source.clone(),
                fixed_version: v.available_version.clone(),
                remediation: v.remediation.clone(),
                ai_confidence: v.ai_confidence,
                is_false_positive: v.is_false_positive,
                ai_analysis: v.ai_analysis.clone(),
                ai_remediation_script: v.ai_remediation_script.clone(),
                ai_remediation_explanation: v.ai_remediation_explanation.clone(),
                priority: match v.priority {
                    agent_scanner::PatchPriority::Immediate => GuiPatchPriority::Immediate,
                    agent_scanner::PatchPriority::Urgent => GuiPatchPriority::Urgent,
                    agent_scanner::PatchPriority::Planned => GuiPatchPriority::Planned,
                    agent_scanner::PatchPriority::Routine => GuiPatchPriority::Routine,
                },
                known_exploited: v.kev.is_some(),
                ransomware_use: v.kev.as_ref().is_some_and(|kev| kev.ransomware_use),
                kev_date_added: v.kev.as_ref().and_then(|kev| kev.date_added),
                kev_due_date: v.kev.as_ref().and_then(|kev| kev.due_date),
                epss_probability: v.epss.map(|epss| epss.probability),
                epss_percentile: v.epss.map(|epss| epss.percentile),
            })
            .collect()
    }

    /// Convert the browser extension inventory for the GUI.
    pub(crate) fn build_browser_extensions(
        &self,
        extensions: &[agent_scanner::browser_extensions::BrowserExtension],
    ) -> Vec<agent_gui::dto::GuiBrowserExtension> {
        use agent_scanner::browser_extensions::{ExtensionRisk, RiskReason};

        extensions
            .iter()
            .map(|extension| agent_gui::dto::GuiBrowserExtension {
                browser: extension.browser.to_string(),
                user: extension.user.clone(),
                profile: extension.profile.clone(),
                id: extension.id.clone(),
                name: extension.name.clone(),
                version: extension.version.clone(),
                reach: match extension.risk {
                    ExtensionRisk::High => GuiSeverity::High,
                    ExtensionRisk::Medium => GuiSeverity::Medium,
                    ExtensionRisk::Low => GuiSeverity::Low,
                },
                reasons: extension
                    .reasons
                    .iter()
                    .map(|reason| {
                        match reason {
                            RiskReason::AllSitesAccess => {
                                "Lit et modifie le contenu de tous les sites"
                            }
                            RiskReason::InterceptsRequests => {
                                "Observe ou modifie les requêtes réseau"
                            }
                            RiskReason::ReadsCookies => "Lit les cookies (jetons de session)",
                            RiskReason::InjectsScripts => "Injecte des scripts dans les pages",
                            RiskReason::ReadsClipboard => "Lit le presse-papiers",
                            RiskReason::ReadsHistory => "Lit l'historique de navigation",
                            RiskReason::ManagesExtensions => "Gère les autres extensions",
                            RiskReason::NativeMessaging => {
                                "Communique avec un programme installé sur le poste"
                            }
                            RiskReason::Debugger => "Attache le débogueur du navigateur aux pages",
                            RiskReason::ControlsProxy => {
                                "Fait passer le trafic du navigateur par un proxy"
                            }
                            RiskReason::Sideloaded => "Installée hors du magasin du navigateur",
                        }
                        .to_string()
                    })
                    .collect(),
                enabled: extension.enabled,
                from_store: extension.from_store,
            })
            .collect()
    }

    /// Convert the exploitation feed status of a scan for the GUI.
    pub(crate) fn build_exploit_intel_status(
        &self,
        scan_result: &VulnerabilityScanResult,
    ) -> Option<GuiExploitIntelStatus> {
        let status = scan_result.exploit_intel.as_ref()?;
        Some(GuiExploitIntelStatus {
            kev_available: status.kev.is_some(),
            kev_catalog_version: status
                .kev
                .as_ref()
                .and_then(|kev| kev.catalog_version.clone()),
            epss_available: status.epss.is_some(),
            epss_score_date: status
                .epss
                .as_ref()
                .and_then(|epss| epss.score_date.clone()),
            stale: status.kev.as_ref().is_some_and(|kev| kev.stale)
                || status.epss.as_ref().is_some_and(|epss| epss.stale),
        })
    }

    /// Convert a `CheckExecutionResult` into a `GuiCheckResult` for display in the GUI.
    pub(crate) fn execution_result_to_gui(
        &self,
        exec_result: &CheckExecutionResult,
    ) -> GuiCheckResult {
        let common_result = &exec_result.result;
        let check_id = &common_result.check_id;

        let (name, category, severity, frameworks) =
            if let Some(check) = self.check_registry.get(check_id) {
                let def = check.definition();
                (
                    def.name.clone(),
                    format!("{}", def.category),
                    self.check_severity_to_gui(&def.severity),
                    def.frameworks.clone(),
                )
            } else {
                (
                    check_id.clone(),
                    "general".to_string(),
                    GuiSeverity::Medium,
                    vec![],
                )
            };
        // What a policy check says beyond its name: its description, why it
        // matters and how to correct it (the SCA format carries all three).
        let (description, rationale, remediation) = match self.check_registry.get(check_id) {
            Some(check) => {
                let def = check.definition();
                let text = |value: &serde_json::Value| {
                    value
                        .as_str()
                        .map(str::trim)
                        .filter(|text| !text.is_empty())
                        .map(str::to_string)
                };
                (
                    Some(def.description.trim().to_string()).filter(|text| !text.is_empty()),
                    text(&def.parameters["rationale"]),
                    text(&def.parameters["remediation"]),
                )
            }
            None => (None, None, None),
        };

        let status = match common_result.status {
            agent_common::types::CheckStatus::Pass => GuiCheckStatus::Pass,
            agent_common::types::CheckStatus::Fail => GuiCheckStatus::Fail,
            agent_common::types::CheckStatus::Error => GuiCheckStatus::Error,
            agent_common::types::CheckStatus::Skipped => GuiCheckStatus::Skipped,
            agent_common::types::CheckStatus::Pending => GuiCheckStatus::Pending,
        };

        let score = match common_result.status {
            agent_common::types::CheckStatus::Pass => Some(100),
            agent_common::types::CheckStatus::Fail => Some(0),
            _ => None,
        };

        GuiCheckResult {
            check_id: check_id.clone(),
            name,
            category,
            status,
            severity,
            score,
            message: common_result.message.clone(),
            details: if common_result.details != serde_json::Value::Null {
                Some(common_result.details.clone())
            } else {
                None
            },
            executed_at: Some(common_result.executed_at),
            frameworks,
            description,
            rationale,
            remediation,
        }
    }

    /// Convert scanner Severity to GUI Severity.
    pub(crate) fn scanner_severity_to_gui(
        &self,
        severity: agent_scanner::vulnerability::Severity,
    ) -> GuiSeverity {
        match severity {
            agent_scanner::vulnerability::Severity::Critical => GuiSeverity::Critical,
            agent_scanner::vulnerability::Severity::High => GuiSeverity::High,
            agent_scanner::vulnerability::Severity::Medium => GuiSeverity::Medium,
            agent_scanner::vulnerability::Severity::Low => GuiSeverity::Low,
        }
    }

    /// Convert CheckSeverity to GUI Severity.
    pub(crate) fn check_severity_to_gui(&self, severity: &CheckSeverity) -> GuiSeverity {
        match severity {
            CheckSeverity::Critical => GuiSeverity::Critical,
            CheckSeverity::High => GuiSeverity::High,
            CheckSeverity::Medium => GuiSeverity::Medium,
            CheckSeverity::Low => GuiSeverity::Low,
            CheckSeverity::Info => GuiSeverity::Info,
        }
    }

    /// Convert a network snapshot into GUI DTOs for the Network page.
    pub(crate) fn snapshot_to_gui_network(
        snapshot: &agent_network::types::NetworkSnapshot,
    ) -> (Vec<GuiNetworkInterface>, Vec<GuiNetworkConnection>) {
        use agent_network::types::{
            ConnectionProtocol, ConnectionState, InterfaceStatus, InterfaceType,
        };

        let interfaces = snapshot
            .interfaces
            .iter()
            .map(|iface| GuiNetworkInterface {
                name: iface.name.clone(),
                mac_address: iface.mac_address.clone(),
                ipv4_addresses: iface.ipv4_addresses.clone(),
                status: match iface.status {
                    InterfaceStatus::Up => "up".to_string(),
                    InterfaceStatus::Down => "down".to_string(),
                    InterfaceStatus::Unknown => "unknown".to_string(),
                },
                interface_type: match iface.interface_type {
                    InterfaceType::Ethernet => "Ethernet".to_string(),
                    InterfaceType::WiFi => "Wi-Fi".to_string(),
                    InterfaceType::Loopback => "Loopback".to_string(),
                    InterfaceType::Virtual => "Virtual".to_string(),
                    InterfaceType::Vpn => "VPN".to_string(),
                    InterfaceType::Bridge => "Bridge".to_string(),
                    InterfaceType::Unknown => "Inconnu".to_string(),
                },
            })
            .collect();

        let connections = snapshot
            .connections
            .iter()
            .map(|conn| GuiNetworkConnection {
                protocol: match conn.protocol {
                    ConnectionProtocol::Tcp | ConnectionProtocol::Tcp6 => "TCP".to_string(),
                    ConnectionProtocol::Udp | ConnectionProtocol::Udp6 => "UDP".to_string(),
                },
                local_address: conn.local_address.clone(),
                local_port: conn.local_port,
                remote_address: conn.remote_address.clone(),
                remote_port: conn.remote_port,
                state: match conn.state {
                    ConnectionState::Established => "ESTABLISHED".to_string(),
                    ConnectionState::Listen => "LISTEN".to_string(),
                    ConnectionState::TimeWait => "TIME_WAIT".to_string(),
                    ConnectionState::CloseWait => "CLOSE_WAIT".to_string(),
                    ConnectionState::SynSent => "SYN_SENT".to_string(),
                    ConnectionState::SynReceived => "SYN_RECV".to_string(),
                    ConnectionState::FinWait1 => "FIN_WAIT1".to_string(),
                    ConnectionState::FinWait2 => "FIN_WAIT2".to_string(),
                    ConnectionState::Closing => "CLOSING".to_string(),
                    ConnectionState::LastAck => "LAST_ACK".to_string(),
                    ConnectionState::Closed => "CLOSED".to_string(),
                    ConnectionState::Unknown => "UNKNOWN".to_string(),
                },
                process_name: conn.process_name.clone(),
            })
            .collect();

        (interfaces, connections)
    }

    /// Convert collected SIEM events into GUI log entries and emit them.
    pub(crate) fn emit_siem_log_batch(&self, events: Vec<agent_siem::SiemEvent>) {
        use agent_gui::dto::{GuiSiemLogEntry, SiemLogSeverity, SiemLogSource};

        if events.is_empty() {
            return;
        }

        let entries: Vec<GuiSiemLogEntry> = events
            .into_iter()
            .map(|e| {
                let source = match e.category {
                    agent_siem::EventCategory::Authentication => SiemLogSource::Auth,
                    agent_siem::EventCategory::Network
                    | agent_siem::EventCategory::FileIntegrity => SiemLogSource::System,
                    agent_siem::EventCategory::Compliance
                    | agent_siem::EventCategory::Security
                    | agent_siem::EventCategory::Configuration
                    | agent_siem::EventCategory::Vulnerability => SiemLogSource::Application,
                    agent_siem::EventCategory::System => SiemLogSource::System,
                };

                GuiSiemLogEntry {
                    id: e.event_id.clone(),
                    timestamp: e.timestamp,
                    severity: SiemLogSeverity::from_numeric(e.severity),
                    source,
                    category: format!("{:?}", e.category),
                    message: if e.description.is_empty() {
                        e.name.clone()
                    } else {
                        e.description.clone()
                    },
                    hostname: Some(e.source_host.clone()),
                    process: e.process_name.clone(),
                    pid: e.process_id,
                    user: e.user.clone(),
                }
            })
            .collect();

        self.emit_gui_event(AgentEvent::SiemLogBatch { entries });
    }

    /// Emit the statistics of the SIEM forwarder to the GUI: its own
    /// counters, not figures made up from the last collection.
    pub(crate) fn emit_siem_stats(
        &self,
        forwarder: &agent_siem::SiemStats,
        events_buffered: usize,
        enabled: bool,
        events_per_minute: f32,
        category_counts: Vec<(String, u32)>,
    ) {
        self.emit_gui_event(AgentEvent::SiemStatsUpdate {
            stats: siem_stats_to_gui(
                forwarder,
                events_buffered,
                enabled,
                events_per_minute,
                category_counts,
            ),
        });
    }

    /// Convert an `agent_scanner::SecurityIncident` to a `GuiSystemIncident` and emit it.
    pub(crate) fn emit_system_incident(&self, incident: &agent_scanner::SecurityIncident) {
        use agent_gui::dto::GuiSystemIncident;

        let severity = match incident.severity {
            agent_scanner::IncidentSeverity::Critical => GuiSeverity::Critical,
            agent_scanner::IncidentSeverity::High => GuiSeverity::High,
            agent_scanner::IncidentSeverity::Medium => GuiSeverity::Medium,
            agent_scanner::IncidentSeverity::Low => GuiSeverity::Low,
        };

        self.emit_gui_event(AgentEvent::SystemIncident {
            incident: GuiSystemIncident {
                incident_type: format!("{}", incident.incident_type),
                severity,
                title: incident.title.clone(),
                description: incident.description.clone(),
                confidence: incident.confidence,
                detected_at: incident.detected_at,
                ai_confidence: None,
                is_false_positive: None,
                ai_analysis: None,
                acknowledged: false,
                allowlisted: false,
            },
        });
    }

    /// Show a process detection in the threats view, as the periodic scan does.
    pub(crate) fn emit_process_incident(&self, incident: &agent_scanner::SecurityIncident) {
        let text = |key: &str| {
            incident
                .evidence
                .get(key)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        };
        let process_name = match text("process_name") {
            name if name.is_empty() => "unknown".to_string(),
            name => name,
        };
        self.emit_gui_event(AgentEvent::SuspiciousProcess {
            process: agent_gui::dto::GuiSuspiciousProcess {
                process_name,
                pid: incident
                    .evidence
                    .get("pid")
                    .and_then(|v| v.as_u64())
                    .and_then(|v| v.try_into().ok())
                    .unwrap_or(0),
                command_line: text("path"),
                reason: incident.description.clone(),
                confidence: incident.confidence,
                detected_at: incident.detected_at,
                ai_confidence: None,
                is_false_positive: None,
                ai_analysis: None,
                acknowledged: false,
                allowlisted: false,
            },
        });
    }

    /// Build and emit a KPI snapshot from current state, and return it so
    /// the caller can store it. `remediation_sla_pct` is `None` when no risk
    /// carries an SLA target; the snapshot then holds a negative value.
    pub(crate) fn emit_kpi_snapshot(
        &self,
        compliance_score: Option<f64>,
        incident_count: u32,
        open_vulns: u32,
        closed_vulns: u32,
        remediation_sla_pct: Option<f32>,
    ) -> agent_gui::dto::KpiSnapshot {
        use agent_gui::dto::KpiSnapshot;

        let snapshot = KpiSnapshot {
            timestamp: chrono::Utc::now(),
            compliance_score: compliance_score.map(|s| s as f32).unwrap_or(0.0),
            incident_count,
            open_vulns,
            closed_vulns,
            remediation_sla_pct: remediation_sla_pct.unwrap_or(-1.0),
        };

        self.emit_gui_event(AgentEvent::KpiSnapshot {
            snapshot: Box::new(snapshot.clone()),
        });
        snapshot
    }

    /// Emit a GUI alert from a `NetworkSecurityAlert`.
    pub(crate) fn emit_network_security_alert_to_gui(
        &self,
        alert: &agent_network::NetworkSecurityAlert,
    ) {
        use agent_network::types::{AlertSeverity, NetworkAlertType};

        let alert_type = match alert.alert_type {
            NetworkAlertType::C2Communication => "c2",
            NetworkAlertType::CryptoMining => "mining",
            NetworkAlertType::DataExfiltration => "exfiltration",
            NetworkAlertType::SuspiciousPort => "suspicious_port",
            NetworkAlertType::MaliciousDestination => "c2",
            NetworkAlertType::DnsTunneling => "dns_tunneling",
            NetworkAlertType::AnonymizationNetwork => "suspicious_port",
            NetworkAlertType::ConnectionAnomaly => "beaconing",
        };

        let severity = match alert.severity {
            AlertSeverity::Critical => GuiSeverity::Critical,
            AlertSeverity::High => GuiSeverity::High,
            AlertSeverity::Medium => GuiSeverity::Medium,
            AlertSeverity::Low => GuiSeverity::Low,
        };

        let (source_ip, destination_ip, destination_port) = if let Some(conn) = &alert.connection {
            (
                Some(conn.local_address.clone()),
                conn.remote_address.clone(),
                conn.remote_port,
            )
        } else {
            (None, None, None)
        };

        self.emit_gui_event(AgentEvent::NetworkSecurityAlert {
            alert: GuiNetworkAlert {
                alert_type: alert_type.to_string(),
                severity,
                description: alert.description.clone(),
                source_ip,
                destination_ip,
                destination_port,
                confidence: alert.confidence,
                detected_at: alert.detected_at,
                ai_confidence: None,
                is_false_positive: None,
                ai_analysis: None,
                acknowledged: false,
                allowlisted: false,
            },
        });
    }
}

#[cfg(all(test, feature = "gui"))]
mod tests {
    use super::siem_stats_to_gui;

    #[test]
    fn siem_statistics_are_the_counters_of_the_forwarder() {
        let sent_at = chrono::Utc::now();
        let forwarder = agent_siem::SiemStats {
            events_sent: 120,
            events_dropped: 7,
            bytes_sent: 4096,
            last_success: Some(sent_at),
            last_error: None,
            is_connected: true,
        };

        let shown = siem_stats_to_gui(&forwarder, 3, true, 2.5, Vec::new());
        assert_eq!(shown.events_sent, 120);
        assert_eq!(shown.events_dropped, 7);
        assert_eq!(shown.events_buffered, 3);
        assert_eq!(shown.last_sent_at, Some(sent_at));
        assert!(shown.connected);

        // Forwarding switched off: not connected, whatever the last delivery.
        assert!(!siem_stats_to_gui(&forwarder, 0, false, 0.0, Vec::new()).connected);
        // Switched on, but nothing delivered yet.
        let idle = agent_siem::SiemStats::default();
        let shown = siem_stats_to_gui(&idle, 0, true, 0.0, Vec::new());
        assert!(!shown.connected);
        assert_eq!(shown.last_sent_at, None);
    }

    /// The start-up list carried no delivery status: "dernier envoi" and
    /// the error stayed empty until something was edited.
    #[tokio::test]
    async fn the_webhooks_listed_carry_the_outcome_of_their_last_alert() {
        use agent_gui::events::AgentEvent;
        use agent_storage::repositories::grc::{StoredWebhook, WebhookRepository};

        let test = crate::main_loop::testing::standalone_runtime();
        let repo = WebhookRepository::new(&test.db);
        let now = chrono::Utc::now();
        for id in ["wh-ok", "wh-failed", "wh-never"] {
            repo.upsert(&StoredWebhook {
                id: id.to_string(),
                name: id.to_string(),
                url: "https://hooks.example.org/sentinel".to_string(),
                events: "generic".to_string(),
                secret: None,
                enabled: true,
                created_at: now.to_rfc3339(),
                updated_at: now.to_rfc3339(),
                synced: false,
            })
            .await
            .unwrap();
        }
        repo.record_delivery("wh-ok", now, None).await.unwrap();
        repo.record_delivery("wh-failed", now, Some("HTTP 500".to_string()))
            .await
            .unwrap();

        let AgentEvent::AlertingLoaded { webhooks, .. } =
            super::alerting_loaded_event(&test.db).await
        else {
            panic!("expected the alerting list");
        };
        let by_id = |id: &str| webhooks.iter().find(|w| w.id == id).unwrap();
        assert!(by_id("wh-ok").last_sent.is_some());
        assert_eq!(by_id("wh-ok").error, None);
        assert_eq!(by_id("wh-failed").last_sent, None);
        assert_eq!(by_id("wh-failed").error.as_deref(), Some("HTTP 500"));
        assert_eq!(by_id("wh-never").last_sent, None);
        assert_eq!(by_id("wh-never").error, None);
    }
}
