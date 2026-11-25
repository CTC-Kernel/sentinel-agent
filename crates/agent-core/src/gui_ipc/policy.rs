// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! What the service decides by itself about events and commands.

use agent_gui::events::{AgentEvent, GuiCommand};

/// How an event is replayed to an interface that connects.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Replay {
    /// The event carries a whole state: only the latest one per key is kept
    /// and replayed.
    Latest(String),
    /// One item of a stream (an alert, an action): the most recent ones are
    /// kept and replayed once per interface.
    Recent,
    /// Only meaningful when it happens (a progress, a log line).
    Transient,
    /// Never leaves the service process.
    Private,
}

/// How `event` is replayed. The match is exhaustive: a new event does not
/// compile until this is decided for it.
pub fn replay(event: &AgentEvent) -> Replay {
    use AgentEvent as E;
    let latest = |key: &str| Replay::Latest(key.to_string());
    match event {
        E::StatusChanged { .. } => latest("status"),
        E::CheckCompleted { result } => Replay::Latest(format!("check:{}", result.check_id)),
        E::ResourceUpdate { .. } => latest("resources"),
        E::SyncStatus { .. } => latest("sync"),
        E::NetworkUpdate { .. } => latest("network"),
        E::NetworkDetailUpdate { .. } => latest("network_detail"),
        E::VulnerabilityUpdate { .. } => latest("vulnerability_summary"),
        E::SoftwareUpdate { .. } => latest("software"),
        E::SystemInventory { .. } => latest("system_inventory"),
        E::BrowserExtensions { .. } => latest("browser_extensions"),
        E::MdmDeployments { .. } => latest("mdm"),
        E::VulnerabilityFindings { .. } => latest("vulnerability_findings"),
        E::VulnerabilityCoverage { .. } => latest("vulnerability_coverage"),
        E::DiscoveryUpdate { .. } => latest("discovery"),
        E::UsbProtection { .. } => latest("usb_protection"),
        E::FimStats { .. } => latest("fim_stats"),
        E::UpdateStatusChanged { .. } => latest("update_status"),
        E::SiemConfigUpdate { .. } => latest("siem_config"),
        E::KpiSnapshot { .. } => latest("kpi"),
        E::SiemStatsUpdate { .. } => latest("siem_stats"),
        E::RisksSnapshot { .. } => latest("risks_snapshot"),
        E::RisksLoaded { .. } => latest("risks"),
        E::AssetsLoaded { .. } => latest("assets"),
        E::PlaybooksLoaded { .. } => latest("playbooks"),
        E::DetectionRulesLoaded { .. } => latest("detection_rules"),
        E::AlertingLoaded { .. } => latest("alerting"),
        E::QuarantineLoaded { .. } => latest("quarantine"),
        E::BlockedIpsLoaded { .. } => latest("blocked_ips"),
        E::AuditTrailLoaded { .. } => latest("audit_trail"),
        E::NotificationsLoaded { .. } => latest("notifications"),

        E::Notification { .. }
        | E::NetworkSecurityAlert { .. }
        | E::FimAlert { .. }
        | E::UsbEvent { .. }
        | E::SuspiciousProcess { .. }
        | E::SystemIncident { .. }
        | E::PlaybookTriggered { .. }
        | E::ResponseActionSubmitted { .. }
        | E::ResponseActionResult { .. }
        | E::FileQuarantined { .. }
        | E::DetectionRuleMatched { .. } => Replay::Recent,

        E::TerminalLog { .. }
        | E::DiscoveryProgress { .. }
        | E::DiscoveryFailed { .. }
        // The answer to a request of one interface, at that moment.
        | E::RemediationPreview { .. }
        | E::ShuttingDown
        | E::SiemLogBatch { .. } => Replay::Transient,

        // The hash of the administrator password stays in the service.
        E::AdminPasswordSet { .. }
        // Enrollment, the assistant and the voice belong to the interface's
        // own session; the service has none of them.
        | E::EnrollmentResult { .. }
        | E::AiProviderConfigured { .. }
        | E::AiProviderFeedback { .. }
        | E::LlmChatDelta { .. }
        | E::LlmChatResponse { .. }
        | E::LlmAnalysisComplete { .. }
        | E::LlmStatusUpdate { .. }
        | E::LlmAcceleration { .. }
        | E::LlmDownloadProgress { .. }
        | E::LlmDownloadComplete { .. }
        | E::LlmDownloadFailed { .. }
        | E::LlmVoiceState { .. }
        | E::LlmRiskAnalysis { .. }
        | E::AudioLevel { .. }
        | E::VoiceTranscription { .. }
        | E::VoiceError { .. }
        | E::VoiceTranscribing
        | E::VoiceNoSpeech
        | E::VoiceEngineStatus { .. }
        | E::VoiceModelInstall { .. }
        | E::VoiceStatus { .. }
        | E::ToggleJarvisWidget { .. }
        // Produced by the interface's own bridge, never by the service.
        | E::ServiceLink { .. }
        | E::ServiceAdmin { .. }
        | E::ServiceCommandRefused { .. } => Replay::Private,
    }
}

/// Why the service runs `command` only for a connection in administrator
/// mode, or `None` when any interface may ask for it.
///
/// The interface's own rule ([`GuiCommand::admin_reason`]) guards what
/// lowers protection. The service is stricter, because it acts as SYSTEM
/// for a user process: everything is refused without the administrator
/// mode except the harmless requests listed here (read, refresh, scan,
/// raise protection). A command added later is therefore closed until it is
/// put on the list.
pub fn admin_reason(command: &GuiCommand) -> Option<&'static str> {
    use GuiCommand as C;
    if let Some(reason) = command.admin_reason() {
        return Some(reason);
    }
    match command {
        C::Resume
        | C::RunCheck
        | C::ForceSync
        | C::RunSync
        | C::GetSummary
        | C::GetCheckResults
        | C::CheckUpdate
        | C::StartDiscovery
        | C::StopDiscovery
        | C::RemediatePreview { .. }
        | C::MarkNotificationRead { .. }
        | C::MarkAllNotificationsRead
        | C::SaveNotification { .. }
        | C::LoadNotifications { .. }
        | C::DeleteNotification { .. }
        | C::RefreshMdmDeployments
        | C::AcknowledgeFimAlert { .. }
        | C::RefreshQuarantine
        | C::LoadAuditTrail { .. }
        // Written by the service to its own export folder.
        | C::ExportSbom => None,
        C::KillProcess { .. } => Some("Arrêter un processus"),
        C::QuarantineFile { .. } => Some("Mettre un fichier en quarantaine"),
        C::BlockIp { .. } => Some("Bloquer une adresse IP"),
        C::IsolateHost { .. } => Some("Isoler le poste du réseau"),
        C::Remediate { .. } => Some("Appliquer une correction sur le poste"),
        C::ExecutePlaybook { .. } => Some("Exécuter un playbook"),
        C::UpdateSiemConfig { .. } => Some("Modifier le transfert vers le SIEM"),
        C::UpdateAllowlist { .. } => Some("Modifier les autorisations de tri"),
        _ => Some("Modifier la configuration de l'agent"),
    }
}

/// The settings an interface pushes that the service keeps across its own
/// restarts: the key under which the last accepted value is journaled.
pub fn persistent_setting(command: &GuiCommand) -> Option<&'static str> {
    match command {
        // Not the check interval: the agent keeps it in its configuration.
        GuiCommand::SetLogLevel { .. } => Some("log_level"),
        GuiCommand::UpdateSiemConfig { .. } => Some("siem"),
        GuiCommand::UpdateLogCollectorConfig { .. } => Some("log_collector"),
        GuiCommand::UpdateAllowlist { .. } => Some("allowlist"),
        _ => None,
    }
}

/// The name of a command, without what it carries.
pub fn command_name(command: &GuiCommand) -> String {
    format!("{command:?}")
        .split(|c: char| !c.is_ascii_alphanumeric())
        .next()
        .unwrap_or_default()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn harmless_requests_are_open_and_everything_else_needs_the_administrator() {
        for open in [
            GuiCommand::RunCheck,
            GuiCommand::ForceSync,
            GuiCommand::Resume,
            GuiCommand::StartDiscovery,
            GuiCommand::RefreshQuarantine,
        ] {
            assert!(admin_reason(&open).is_none(), "{open:?}");
        }
        for closed in [
            GuiCommand::Pause,
            GuiCommand::ReleaseHost,
            // Protective for the interface, but run as SYSTEM here.
            GuiCommand::KillProcess {
                process_name: "System".into(),
                pid: 4,
            },
            GuiCommand::IsolateHost { duration_secs: 0 },
            GuiCommand::SetLogLevel { level: 4 },
            GuiCommand::UpdateSiemConfig {
                enabled: true,
                format: "CEF".into(),
                transport: "Syslog".into(),
                destination: "attacker.example.com:514".into(),
            },
            GuiCommand::RestoreDefaultDetectionRules,
        ] {
            assert!(admin_reason(&closed).is_some(), "{closed:?}");
        }
    }

    #[test]
    fn the_password_hash_and_the_session_events_never_leave_the_service() {
        assert_eq!(
            replay(&AgentEvent::AdminPasswordSet {
                hash: "$argon2id$...".into()
            }),
            Replay::Private
        );
        assert_eq!(
            replay(&AgentEvent::LlmChatDelta { text: "…".into() }),
            Replay::Private
        );
        assert_eq!(
            replay(&AgentEvent::FimStats {
                monitored_count: 1,
                changes_today: 0
            }),
            Replay::Latest("fim_stats".into())
        );
        assert_eq!(
            replay(&AgentEvent::DiscoveryFailed {
                reason: "refus".into()
            }),
            Replay::Transient
        );
    }

    #[test]
    fn a_command_name_carries_nothing_of_the_command() {
        assert_eq!(command_name(&GuiCommand::Pause), "Pause");
        assert_eq!(
            command_name(&GuiCommand::BlockIp {
                ip: "203.0.113.9".into(),
                duration_secs: 60
            }),
            "BlockIp"
        );
    }
}
