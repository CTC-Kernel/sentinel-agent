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
    AgentSummary, GuiAgentStatus, GuiCheckResult, GuiCheckStatus, GuiNetworkConnection,
    GuiNetworkInterface, GuiNotification, GuiPolicySummary, GuiResourceUsage, GuiSoftwarePackage,
    GuiVulnerabilityFinding, Severity as GuiSeverity,
};
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
#[cfg(feature = "gui")]
use agent_scanner::{CheckExecutionResult, VulnerabilityScanResult};
#[cfg(feature = "gui")]
use std::sync::atomic::Ordering;
#[cfg(feature = "gui")]
use tracing::warn;

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
            organization: self.organization_name.try_read().ok().and_then(|g| g.clone()),
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
        };

        self.emit_gui_event(AgentEvent::StatusChanged { summary });
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
                let has_vulns = vuln_counts.contains_key(&pkg.name);
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
                    .unwrap_or_else(|| format!("OUTDATED-{}", v.package_name.to_uppercase())),
                affected_software: v.package_name.clone(),
                affected_version: v.installed_version.clone(),
                severity: self.scanner_severity_to_gui(v.severity),
                cvss_score: v.cvss_score.or(Some(v.severity.default_score())),
                description: v.description.clone(),
                fix_available: v.available_version.is_some(),
                discovered_at: Some(v.detected_at),
            })
            .collect()
    }

    /// Convert a `CheckExecutionResult` into a `GuiCheckResult` for display in the GUI.
    pub(crate) fn execution_result_to_gui(&self, exec_result: &CheckExecutionResult) -> GuiCheckResult {
        let common_result = &exec_result.result;
        let check_id = &common_result.check_id;

        let (name, category, severity, frameworks) =
            if let Some(check) = self.check_registry.get(check_id) {
                let def = check.definition();
                (
                    def.name.clone(),
                    format!("{:?}", def.category).to_lowercase(),
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
}
