// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Domain-specific sub-states for AppState.
//!
//! Each struct groups related fields by functional domain (network, discovery,
//! terminal, etc.) to keep `AppState` maintainable.

use eframe::egui;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

/// Stable local identity, independent of triage and asynchronous AI enrichment.
/// Only its digest is persisted, never command lines or alert contents.
pub fn event_identity(kind: &str, event: &impl Serialize) -> String {
    use sha2::{Digest, Sha256};
    let mut value = serde_json::to_value(event).expect("GUI event must serialize");
    if let Some(object) = value.as_object_mut() {
        if kind == "fim" {
            object.remove("id");
        } // The runtime recreates this presentation UUID.
        if is_recurring_kind(kind) {
            // Periodic scanners re-report a persistent condition with a fresh
            // timestamp (and sometimes a re-computed confidence). Those fields
            // must not create a new alert, otherwise an acknowledgment only
            // lasts until the next scan.
            object.remove("detected_at");
            object.remove("confidence");
        }
        object.retain(|key, _| {
            !key.starts_with("ai_")
                && !matches!(
                    key.as_str(),
                    "acknowledged" | "allowlisted" | "is_false_positive"
                )
        });
    }
    format!("{kind}:{:x}", Sha256::digest(value.to_string().as_bytes()))
}

/// Detections produced by periodic scans of a persistent condition. They are
/// deduplicated on arrival and their acknowledgment survives re-detection.
fn is_recurring_kind(kind: &str) -> bool {
    matches!(kind, "process" | "system" | "network")
}

/// Recurring detection that can be merged with its previous occurrence.
pub(crate) trait RecurringEvent: Serialize {
    fn acknowledged_mut(&mut self) -> &mut bool;
    fn detected_at(&self) -> chrono::DateTime<chrono::Utc>;
    /// Keep AI enrichment computed for the previous occurrence of the same condition.
    fn inherit_enrichment(&mut self, previous: Self);
}

macro_rules! recurring_event {
    ($($ty:ty),*) => {$(
        impl RecurringEvent for $ty {
            fn acknowledged_mut(&mut self) -> &mut bool {
                &mut self.acknowledged
            }
            fn detected_at(&self) -> chrono::DateTime<chrono::Utc> {
                self.detected_at
            }
            fn inherit_enrichment(&mut self, previous: Self) {
                self.ai_confidence = self.ai_confidence.or(previous.ai_confidence);
                self.is_false_positive = self.is_false_positive.or(previous.is_false_positive);
                if self.ai_analysis.is_none() {
                    self.ai_analysis = previous.ai_analysis;
                }
            }
        }
    )*};
}
recurring_event!(
    crate::dto::GuiSuspiciousProcess,
    crate::dto::GuiSystemIncident,
    crate::dto::GuiNetworkAlert
);

/// Silence after which a re-detected condition is a new occurrence: longer
/// than several scan periods (5 min) and than the network alert cooldown (1 h).
fn reopen_after(kind: &str) -> chrono::Duration {
    if kind == "network" {
        chrono::Duration::hours(3)
    } else {
        chrono::Duration::minutes(20)
    }
}

/// Insert a detection at the front of its feed. A re-detection of an already
/// listed condition replaces it (refreshing its timestamp) instead of adding a
/// duplicate, and keeps the operator's acknowledgment. If the condition had
/// disappeared for longer than `reopen_after`, it comes back to triage.
pub(crate) fn upsert_recurring<T: RecurringEvent>(
    events: &mut VecDeque<T>,
    kind: &str,
    mut event: T,
    acknowledged_keys: &mut VecDeque<String>,
    capacity: usize,
) {
    let key = event_identity(kind, &event);
    if let Some(position) = events.iter().position(|e| event_identity(kind, e) == key)
        && let Some(mut previous) = events.remove(position)
    {
        if event.detected_at() - previous.detected_at() > reopen_after(kind) {
            acknowledged_keys.retain(|k| k != &key);
        } else {
            *event.acknowledged_mut() |= *previous.acknowledged_mut();
        }
        event.inherit_enrichment(previous);
    }
    *event.acknowledged_mut() |= acknowledged_keys.contains(&key);
    events.push_front(event);
    events.truncate(capacity);
}

pub fn vulnerability_identity(finding: &crate::dto::GuiVulnerabilityFinding) -> String {
    event_identity(
        "finding",
        &(
            &finding.cve_id,
            &finding.affected_software,
            &finding.affected_version,
            &finding.source,
            finding.discovered_at,
        ),
    )
}

// ---------------------------------------------------------------------------
// Persisted GUI Preferences
// ---------------------------------------------------------------------------

/// GUI preferences that are persisted across restarts via eframe storage.
///
/// Only contains settings the user explicitly configures -- not runtime state.
/// All fields have `#[serde(default)]` for backward compatibility when new
/// fields are added — otherwise deserialization of old stored JSON silently
/// fails and resets everything to defaults.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct GuiPreferences {
    pub acknowledged_event_keys: VecDeque<String>,
    pub allowlist_rules: Vec<crate::dto::AllowlistRule>,
    pub dark_mode: bool,
    pub check_interval_secs: u64,
    pub log_level: u8,
    pub siem_enabled: bool,
    pub siem_format: String,
    pub siem_transport: String,
    pub siem_destination: String,
    pub log_collector_enabled: bool,
    pub log_collector_sources: Vec<String>,
    pub log_collector_poll_secs: u64,
    pub discovery_enabled: bool,
    pub architecture_url: String,
    pub admin_password_sha256: String,
    #[serde(default)]
    pub sidebar_collapsed: bool,
    #[serde(default)]
    pub voice_alerts_enabled: bool,
    /// Kept for backward compatibility of stored preferences; not restored.
    #[serde(default)]
    pub voice_conversation_enabled: bool,
    #[serde(default)]
    pub voice_settings: crate::dto::VoiceSettings,
    #[serde(default)]
    pub voice_alert_threshold: crate::dto::VoiceAlertThreshold,
}

impl Default for GuiPreferences {
    fn default() -> Self {
        Self {
            acknowledged_event_keys: VecDeque::new(),
            allowlist_rules: Vec::new(),
            dark_mode: true,
            check_interval_secs: agent_common::constants::DEFAULT_CHECK_INTERVAL_SECS,
            log_level: 2, // Info
            siem_enabled: false,
            siem_format: "CEF".to_string(),
            siem_transport: "Syslog".to_string(),
            siem_destination: String::new(),
            log_collector_enabled: true,
            log_collector_sources: vec![
                "system".to_string(),
                "auth".to_string(),
                "application".to_string(),
                "firewall".to_string(),
            ],
            log_collector_poll_secs: 60,
            discovery_enabled: false,
            architecture_url: String::new(),
            admin_password_sha256: String::new(),
            sidebar_collapsed: false,
            voice_alerts_enabled: false,
            voice_conversation_enabled: false,
            voice_settings: crate::dto::VoiceSettings::default(),
            voice_alert_threshold: crate::dto::VoiceAlertThreshold::default(),
        }
    }
}

impl GuiPreferences {
    /// Snapshot current settings into a persistable struct.
    pub fn from_state(state: &AppState) -> Self {
        Self {
            acknowledged_event_keys: state.acknowledgment_snapshot(),
            allowlist_rules: state.threats.allowlist_rules.clone(),
            dark_mode: state.settings.dark_mode,
            check_interval_secs: state.settings.check_interval_secs,
            log_level: state.settings.log_level.index() as u8,
            siem_enabled: state.settings.siem_enabled,
            siem_format: state.settings.siem_format.clone(),
            siem_transport: state.settings.siem_transport.clone(),
            siem_destination: state.settings.siem_destination.clone(),
            log_collector_enabled: state.settings.log_collector_enabled,
            log_collector_sources: state.settings.log_collector_sources.clone(),
            log_collector_poll_secs: state.settings.log_collector_poll_secs,
            discovery_enabled: state.discovery.enabled,
            architecture_url: state.settings.architecture_url.clone(),
            admin_password_sha256: state.settings.admin_password_sha256.clone(),
            sidebar_collapsed: state.settings.sidebar_collapsed,
            voice_alerts_enabled: state.ai.voice_alerts_enabled,
            voice_conversation_enabled: state.ai.voice_conversation_enabled,
            voice_settings: state.ai.voice_settings.clone(),
            voice_alert_threshold: state.ai.voice_alert_threshold,
        }
    }

    /// Apply persisted preferences to the app state.
    pub fn apply_to(&self, state: &mut AppState) {
        state.acknowledged_event_keys = self
            .acknowledged_event_keys
            .iter()
            .rev()
            .take(2000)
            .cloned()
            .collect::<VecDeque<_>>()
            .into_iter()
            .rev()
            .collect();
        state.restore_acknowledgments();
        state
            .threats
            .allowlist_rules
            .clone_from(&self.allowlist_rules);
        state.threats.allowlist_sync_pending = true;
        state.refresh_authorizations();
        state.settings.dark_mode = self.dark_mode;
        state.settings.check_interval_secs = self.check_interval_secs;
        state.settings.log_level = crate::dto::LogLevel::from_index(self.log_level as usize);
        state.settings.siem_enabled = self.siem_enabled;
        state.settings.siem_format.clone_from(&self.siem_format);
        state
            .settings
            .siem_transport
            .clone_from(&self.siem_transport);
        state
            .settings
            .siem_destination
            .clone_from(&self.siem_destination);
        state.settings.log_collector_enabled = self.log_collector_enabled;
        state.settings.log_collector_sources = self.log_collector_sources.clone();
        state.settings.log_collector_poll_secs = self.log_collector_poll_secs;
        state.settings.sidebar_collapsed = self.sidebar_collapsed;
        state.ai.voice_alerts_enabled = self.voice_alerts_enabled;
        // Hands-free conversation is a session, never resumed silently at
        // start-up: the microphone only opens after an explicit action.
        state.ai.voice_conversation_enabled = false;
        state.ai.voice_settings = self.voice_settings.clone().sanitized();
        state.ai.voice_alert_threshold = self.voice_alert_threshold;
        state.ai.voice_config_sync_pending = true;
        state.discovery.enabled = self.discovery_enabled;
        state
            .settings
            .architecture_url
            .clone_from(&self.architecture_url);
        if !self.admin_password_sha256.is_empty() {
            state
                .settings
                .admin_password_sha256
                .clone_from(&self.admin_password_sha256);
        }
    }
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

/// Network interfaces, connections, and alert data.
pub struct NetworkState {
    /// Selected workspace section; independent of backend configuration.
    pub active_section: usize,
    pub interface_count: u32,
    pub connection_count: u32,
    pub alert_count: u32,
    pub primary_ip: Option<String>,
    pub primary_mac: Option<String>,
    pub last_scan: Option<chrono::DateTime<chrono::Utc>>,
    pub interfaces: Vec<crate::dto::GuiNetworkInterface>,
    pub connections: Vec<crate::dto::GuiNetworkConnection>,
    pub alerts: VecDeque<crate::dto::GuiNetworkAlert>,
    pub search: String,
    pub selected_connection: Option<usize>,
    pub selected_alert: Option<usize>,
    pub detail_open: bool,
    /// Current page for connections table (0-indexed).
    pub connections_page: usize,
}

impl Default for NetworkState {
    fn default() -> Self {
        Self {
            active_section: 0,
            interface_count: 0,
            connection_count: 0,
            alert_count: 0,
            primary_ip: None,
            primary_mac: None,
            last_scan: None,
            interfaces: Vec::new(),
            connections: Vec::new(),
            alerts: VecDeque::with_capacity(200),
            search: String::new(),
            selected_connection: None,
            selected_alert: None,
            detail_open: false,
            connections_page: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/// Network discovery scan state.
#[derive(Default)]
pub struct DiscoveryState {
    pub devices: Vec<crate::dto::GuiDiscoveredDevice>,
    pub in_progress: bool,
    pub progress: f32,
    pub phase: String,
    pub enabled: bool,
    pub search: String,
    pub selected_device: Option<usize>,
    pub detail_open: bool,
}

// ---------------------------------------------------------------------------
// Cartography
// ---------------------------------------------------------------------------

/// Graph viewport state for the network cartography page.
pub struct CartographyState {
    pub layout: Option<crate::pages::cartography::GraphLayout>,
    pub zoom: f32,
    pub pan: egui::Vec2,
    pub selected_device: Option<String>,
}

impl Default for CartographyState {
    fn default() -> Self {
        Self {
            layout: None,
            zoom: 1.0,
            pan: egui::Vec2::ZERO,
            selected_device: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Terminal
// ---------------------------------------------------------------------------

/// Real-time terminal / log viewer state.
pub struct TerminalState {
    pub lines: VecDeque<crate::events::TerminalLogEntry>,
    pub auto_scroll: bool,
    pub filter_level: crate::dto::LogLevel,
    pub search: String,
    pub event_count: u64,
    pub error_count: u64,
    pub selected_log: Option<usize>,
    pub detail_open: bool,
}

impl Default for TerminalState {
    fn default() -> Self {
        Self {
            lines: VecDeque::with_capacity(500),
            auto_scroll: true,
            filter_level: crate::dto::LogLevel::Info,
            search: String::new(),
            event_count: 0,
            error_count: 0,
            selected_log: None,
            detail_open: false,
        }
    }
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

/// Synchronisation state.
pub struct SyncState {
    pub in_progress: bool,
    pub error: Option<String>,
    // Removed: pub history: VecDeque<super::app::SyncHistoryEntry>,
    pub history: VecDeque<SyncHistoryEntry>,
}

impl Default for SyncState {
    fn default() -> Self {
        Self {
            in_progress: false,
            error: None,
            history: VecDeque::with_capacity(50),
        }
    }
}

// ---------------------------------------------------------------------------
// FIM (File Integrity Monitoring)
// ---------------------------------------------------------------------------

/// FIM alerts and counters.
pub struct FimState {
    pub monitored_count: u32,
    pub changes_today: u32,
    pub alerts: VecDeque<crate::dto::GuiFimAlert>,
    pub search: String,
    pub filter: Option<String>,
    pub selected_alert: Option<usize>,
    pub detail_open: bool,
    /// Current page (0-indexed) of the paginated alerts table.
    pub page: usize,
}

impl Default for FimState {
    fn default() -> Self {
        Self {
            monitored_count: 0,
            changes_today: 0,
            alerts: VecDeque::with_capacity(500),
            search: String::new(),
            filter: None,
            selected_alert: None,
            detail_open: false,
            page: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Threats
// ---------------------------------------------------------------------------

/// The events table opens newest first, and says so in its header.
pub fn default_events_sort() -> crate::widgets::data_table::TableSort {
    crate::widgets::data_table::TableSort::by(
        "date",
        crate::widgets::data_table::SortDirection::Descending,
    )
}

/// EDR detection & response state.
pub struct ThreatsState {
    pub suspicious_processes: VecDeque<crate::dto::GuiSuspiciousProcess>,
    pub usb_events: VecDeque<crate::dto::GuiUsbEvent>,
    pub system_incidents: VecDeque<crate::dto::GuiSystemIncident>,
    pub search: String,
    pub filter: Option<String>,
    pub selected_threat: Option<usize>,
    pub detail_open: bool,
    pub overview_page: usize,

    // EDR tab navigation
    pub active_tab: crate::dto::EdrTab,

    // Events tab
    pub events_page: usize,
    /// Events table order; newest first until the operator picks a column.
    pub events_sort: crate::widgets::data_table::TableSort,
    /// 0 = all, 1 = to triage (default), 2 = acknowledged, 3 = authorized.
    pub events_status_filter: usize,
    /// Overview feed also lists acknowledged / authorized events.
    pub overview_show_triaged: bool,
    pub events_severity_filter: Option<crate::dto::Severity>,

    // Investigation tab
    pub ioc_search: String,
    pub ioc_type: crate::dto::IocSearchType,
    pub ioc_results_count: usize,

    // Response tab
    pub pending_actions: VecDeque<crate::dto::ResponseAction>,
    pub quarantine_queue: VecDeque<crate::dto::QuarantinedFile>,
    pub response_log: VecDeque<crate::dto::ResponseLogEntry>,
    pub response_page: usize,
    pub confirm_action: Option<crate::dto::PendingConfirmation>,

    // Playbooks tab
    pub playbooks: Vec<crate::dto::Playbook>,
    pub playbook_log: VecDeque<crate::dto::PlaybookLogEntry>,
    pub playbook_editing: bool,
    pub playbook_log_page: usize,

    // Detection rules tab
    pub detection_rules: Vec<crate::dto::DetectionRule>,
    pub detection_rule_editing: bool,

    // Forensic timeline tab
    pub forensic_time_range: crate::dto::TimelineRange,
    pub forensic_source_filter: Option<String>,
    pub forensic_severity_filter: Option<crate::dto::Severity>,
    pub forensic_selected_event: Option<usize>,
    pub forensic_detail_open: bool,
    pub forensic_page: usize,

    // Exclusions & Authorization rules (IP, Process, Pattern, USB, FIM)
    pub allowlist_rules: Vec<crate::dto::AllowlistRule>,
    /// Rules changed (or were loaded) and must be pushed to the agent core,
    /// which applies them to notifications, detection rules and playbooks.
    pub allowlist_sync_pending: bool,
}

impl ThreatsState {
    /// Command pushing the current rules to the agent core, once per change.
    pub fn take_allowlist_sync(&mut self) -> Option<crate::events::GuiCommand> {
        std::mem::take(&mut self.allowlist_sync_pending).then(|| {
            crate::events::GuiCommand::UpdateAllowlist {
                rules: self.allowlist_rules.clone(),
            }
        })
    }

    /// Acknowledge a threat by its kind and index in the respective source collection.
    pub fn acknowledge_threat(&mut self, kind: &str, source_index: usize) -> bool {
        match kind {
            "process" => {
                if let Some(p) = self.suspicious_processes.get_mut(source_index) {
                    p.acknowledged = true;
                    return true;
                }
            }
            "system" => {
                if let Some(inc) = self.system_incidents.get_mut(source_index) {
                    inc.acknowledged = true;
                    return true;
                }
            }
            "usb" => {
                if let Some(u) = self.usb_events.get_mut(source_index) {
                    u.acknowledged = true;
                    return true;
                }
            }
            _ => {}
        }
        false
    }

    /// Add an authorization rule and retroactively mark matching threats as allowlisted.
    pub fn add_allowlist_rule(
        &mut self,
        rule_type: crate::dto::AllowlistRuleType,
        pattern: String,
        description: String,
        created_by: String,
    ) -> uuid::Uuid {
        let id = uuid::Uuid::new_v4();
        self.allowlist_sync_pending = true;
        self.allowlist_rules.push(crate::dto::AllowlistRule {
            id,
            rule_type,
            pattern: pattern.clone(),
            description,
            created_at: chrono::Utc::now(),
            created_by,
        });

        id
    }

    /// Check if a process, IP or pattern is covered by an active authorization rule.
    pub fn is_allowlisted(&self, rule_type: crate::dto::AllowlistRuleType, value: &str) -> bool {
        self.allowlist_rules
            .iter()
            .any(|r| r.rule_type == rule_type && r.matches(value))
    }

    /// Remove an authorization rule by ID.
    pub fn remove_allowlist_rule(&mut self, id: uuid::Uuid) -> bool {
        if let Some(pos) = self.allowlist_rules.iter().position(|r| r.id == id) {
            self.allowlist_rules.remove(pos);
            self.allowlist_sync_pending = true;
            true
        } else {
            false
        }
    }
}

impl Default for ThreatsState {
    fn default() -> Self {
        Self {
            suspicious_processes: VecDeque::with_capacity(200),
            usb_events: VecDeque::with_capacity(200),
            system_incidents: VecDeque::with_capacity(200),
            search: String::new(),
            filter: None,
            selected_threat: None,
            detail_open: false,
            overview_page: 0,

            active_tab: crate::dto::EdrTab::default(),
            events_page: 0,
            events_sort: default_events_sort(),
            events_status_filter: 1,
            overview_show_triaged: false,
            events_severity_filter: None,
            ioc_search: String::new(),
            ioc_type: crate::dto::IocSearchType::default(),
            ioc_results_count: 0,
            pending_actions: VecDeque::with_capacity(20),
            quarantine_queue: VecDeque::with_capacity(100),
            response_log: VecDeque::with_capacity(500),
            response_page: 0,
            confirm_action: None,

            playbooks: Vec::new(),
            playbook_log: VecDeque::with_capacity(200),
            playbook_editing: false,
            playbook_log_page: 0,
            detection_rules: Vec::new(),
            detection_rule_editing: false,
            forensic_time_range: crate::dto::TimelineRange::default(),
            forensic_source_filter: None,
            forensic_severity_filter: None,
            forensic_selected_event: None,
            forensic_detail_open: false,
            forensic_page: 0,
            allowlist_rules: Vec::new(),
            allowlist_sync_pending: true,
        }
    }
}

// ---------------------------------------------------------------------------
// Monitoring history
// ---------------------------------------------------------------------------

/// Time-series history for the monitoring page charts.
pub struct MonitoringHistory {
    pub cpu_history: VecDeque<[f64; 2]>,
    pub memory_history: VecDeque<[f64; 2]>,
    pub disk_io_history: VecDeque<[f64; 2]>,
    pub network_io_history: VecDeque<[f64; 2]>,
    /// Active tab on the surveillance page (0=Resources, 1=SIEM Logs, 2=Stats).
    pub active_tab: usize,
}

impl Default for MonitoringHistory {
    fn default() -> Self {
        Self {
            cpu_history: VecDeque::with_capacity(300),
            memory_history: VecDeque::with_capacity(300),
            disk_io_history: VecDeque::with_capacity(300),
            network_io_history: VecDeque::with_capacity(300),
            active_tab: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// SIEM View
// ---------------------------------------------------------------------------

/// SIEM log viewer state for the surveillance page.
pub struct SiemViewState {
    /// Recent SIEM log entries displayed in the log well.
    pub log_entries: VecDeque<crate::dto::GuiSiemLogEntry>,
    /// SIEM forwarder statistics.
    pub stats: crate::dto::GuiSiemStats,
    /// Search query for log filtering.
    pub search: String,
    /// Severity filter.
    pub severity_filter: Option<crate::dto::SiemLogSeverity>,
    /// Source filter.
    pub source_filter: Option<crate::dto::SiemLogSource>,
    /// Selected log entry index.
    pub selected_log: Option<usize>,
    /// Detail drawer open.
    pub detail_open: bool,
    /// Auto-scroll to latest entries.
    pub auto_scroll: bool,
    /// Current page for log table pagination.
    pub logs_page: usize,
}

impl Default for SiemViewState {
    fn default() -> Self {
        Self {
            log_entries: VecDeque::with_capacity(1000),
            stats: crate::dto::GuiSiemStats::default(),
            search: String::new(),
            severity_filter: None,
            source_filter: None,
            selected_log: None,
            detail_open: false,
            auto_scroll: true,
            logs_page: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Compliance filter
// ---------------------------------------------------------------------------

/// Compliance page filter/search state.
#[derive(Default)]
pub struct ComplianceFilter {
    pub search: String,
    pub status_filter: Option<crate::dto::GuiCheckStatus>,
    pub group_by: crate::dto::ComplianceGroupBy,
    pub selected_check: Option<usize>,
    pub detail_open: bool,
    pub view_mode: crate::dto::ComplianceViewMode,
    /// Whether an AI analysis is in progress for the selected check.
    pub ai_analyzing: bool,
    /// Last AI analysis result text for the selected check.
    pub ai_analysis_result: Option<String>,
    /// Current page for paginated table view (0-indexed).
    pub current_page: usize,
}

// ---------------------------------------------------------------------------
// AI / Intelligence Artificielle
// ---------------------------------------------------------------------------

/// AI analysis page state.
#[derive(Default)]
pub struct AiState {
    pub selected_recommendation: Option<usize>,
    pub detail_open: bool,
    pub filter: Option<String>,
    pub search: String,
    /// Active tab in the LLM panel.
    pub active_tab: crate::dto::LlmTab,
    /// Chat conversation history.
    pub chat_history: Vec<crate::dto::LlmChatMessage>,
    /// Current input text in the chat input field.
    pub input_text: String,
    /// Conversation presets: SOC, RSSI/GRC, MSP/IT. This does not change permissions.
    pub work_mode: usize,
    pub prompt_context: Option<crate::dto::LlmPromptContext>,
    pub confirm_clear_chat: bool,
    pub model_search: String,
    pub voice_error: Option<String>,
    /// Whether the LLM is currently processing a prompt.
    pub is_processing: bool,
    /// Current model status.
    pub model_status: crate::dto::LlmModelStatus,
    /// Compute backend of the loaded model, chosen for this machine.
    pub acceleration: Option<String>,
    /// LLM model download progress.
    pub download: crate::dto::LlmDownloadState,
    /// Cached count of recommendations (updated when recommendations tab is shown).
    pub recommendations_count: usize,
    /// Whether the voice interface is actively listening.
    pub is_listening: bool,
    /// Whether the voice interface is currently speaking.
    pub is_speaking: bool,
    /// Set to true when a voice transcription has arrived and should be auto-submitted as a prompt.
    pub pending_voice_send: bool,
    /// Normalized microphone level in [0.0, 1.0], updated at ~10 Hz while listening.
    /// Drives the Jarvis core visualization so the user can see their voice being captured.
    pub mic_level: f32,
    /// Speak warning/critical system notifications through native TTS.
    pub voice_alerts_enabled: bool,
    /// Speak assistant replies and reopen the microphone after TTS completes.
    pub voice_conversation_enabled: bool,
    /// A spoken assistant response should hand back to microphone capture.
    pub voice_reply_pending: bool,
    /// Important alerts waiting for a safe moment to be spoken. Alerts never
    /// interrupt microphone capture or an active assistant answer.
    pub pending_voice_alerts: VecDeque<String>,
    /// Operator voice preferences (voice, rate, dictation, reading mode).
    pub voice_settings: crate::dto::VoiceSettings,
    /// Minimum severity of alerts read aloud.
    pub voice_alert_threshold: crate::dto::VoiceAlertThreshold,
    /// Capabilities published by the runtime (`None` until first report).
    pub voice_engine: Option<crate::dto::VoiceEngineInfo>,
    /// Whisper model installation in progress or last result.
    pub voice_install: Option<crate::dto::VoiceInstallProgress>,
    /// Capture ended; Whisper is transcribing.
    pub is_transcribing: bool,
    /// Consecutive hands-free rounds without speech.
    pub voice_empty_rounds: u8,
    /// Reopen the microphone after a silent hands-free round.
    pub voice_relisten_pending: bool,
    /// Informational voice message (not an error).
    pub voice_notice: Option<String>,
    /// Voice settings window visibility.
    pub voice_settings_open: bool,
    /// Voice settings must be pushed to the runtime.
    pub voice_config_sync_pending: bool,
    /// Index of the assistant message currently being streamed.
    pub streaming_index: Option<usize>,
    /// The operator asked to stop the answer being generated.
    pub cancel_requested: bool,
    /// The model was asked to load ahead of the first question.
    pub warm_up_requested: bool,
}

/// Silent hands-free rounds tolerated before the conversation pauses.
pub const VOICE_MAX_EMPTY_ROUNDS: u8 = 2;

impl AiState {
    /// Assistant message receiving the streamed answer, if any.
    pub fn streaming_message(&mut self) -> Option<&mut crate::dto::LlmChatMessage> {
        let index = self.streaming_index?;
        self.chat_history
            .get_mut(index)
            .filter(|message| message.role == crate::dto::ChatRole::Assistant)
    }

    /// Load the model once per session, when the assistant is first shown.
    pub fn take_warm_up(&mut self) -> bool {
        !std::mem::replace(&mut self.warm_up_requested, true)
    }

    /// Dictation can start: unknown capabilities are optimistic (the runtime
    /// reports a precise error), a known missing model is not.
    pub fn dictation_available(&self) -> bool {
        self.voice_engine
            .as_ref()
            .is_none_or(|engine| engine.stt_ready)
    }

    pub fn voice_install_active(&self) -> bool {
        self.voice_install
            .as_ref()
            .is_some_and(|install| install.phase.is_active())
    }

    /// Commands that push voice preferences to the runtime, once per change.
    pub fn take_voice_config_sync(&mut self) -> Option<crate::events::GuiCommand> {
        std::mem::take(&mut self.voice_config_sync_pending).then(|| {
            crate::events::GuiCommand::ConfigureVoice {
                settings: self.voice_settings.clone().sanitized(),
            }
        })
    }

    /// Reopen the microphone after a silent hands-free round.
    pub fn take_voice_relisten(&mut self) -> bool {
        std::mem::take(&mut self.voice_relisten_pending)
            && self.voice_conversation_enabled
            && !self.is_processing
            && !self.is_listening
            && !self.is_speaking
    }
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/// Reports page state.
pub struct ReportsState {
    pub reports: VecDeque<crate::dto::GeneratedReport>,
    pub selected_report: Option<usize>,
    pub detail_open: bool,
    pub generating: bool,
    pub selected_type: crate::dto::ReportType,
    pub selected_framework: Option<String>,
    pub active_tab: usize,
}

impl Default for ReportsState {
    fn default() -> Self {
        Self {
            reports: VecDeque::with_capacity(50),
            selected_report: None,
            detail_open: false,
            generating: false,
            selected_type: crate::dto::ReportType::default(),
            selected_framework: None,
            active_tab: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Risk management
// ---------------------------------------------------------------------------

/// Risk management page state.
#[derive(Default)]
pub struct RisksState {
    /// Current page (0-indexed) of the paginated risk table.
    pub page: usize,
    pub entries: Vec<crate::dto::RiskEntry>,
    pub search: String,
    pub status_filter: Option<crate::dto::RiskStatus>,
    pub selected_risk: Option<usize>,
    pub detail_open: bool,
    pub editing: bool,
    /// Timestamp until the fake "saving" state ends (for double-click prevention UX)
    pub saving_until: Option<chrono::DateTime<chrono::Utc>>,
    /// Opaque ID of the risk currently being analyzed by AI (None = idle).
    pub ai_analyzing: Option<String>,
    /// Last AI analysis result text for the selected risk.
    pub ai_analysis_result: Option<String>,
    /// Mitigation suggestions from the last AI analysis.
    pub ai_mitigation_suggestions: Vec<String>,
}

// ---------------------------------------------------------------------------
// Asset management
// ---------------------------------------------------------------------------

/// Asset management page state.
#[derive(Default)]
pub struct AssetsState {
    pub assets: Vec<crate::dto::ManagedAsset>,
    pub search: String,
    pub criticality_filter: Option<crate::dto::AssetCriticality>,
    pub lifecycle_filter: Option<crate::dto::AssetLifecycle>,
    pub selected_asset: Option<usize>,
    pub detail_open: bool,
    /// Whether the inline asset creation form is open.
    pub asset_editing: bool,
    /// Current page (0-indexed) of the paginated asset table.
    pub page: usize,
    /// Assets waiting to be persisted via `SaveAsset` commands.
    ///
    /// Pages push new assets here; the app update loop drains them and sends
    /// one `SaveAsset` command per entry so they are written to SQLite.
    pub pending_asset_saves: Vec<crate::dto::ManagedAsset>,
}

// ---------------------------------------------------------------------------
// KPI & trends
// ---------------------------------------------------------------------------

/// KPI trends state.
pub struct KpiState {
    pub snapshots: VecDeque<crate::dto::KpiSnapshot>,
    pub period: crate::dto::KpiPeriod,
}

impl Default for KpiState {
    fn default() -> Self {
        Self {
            snapshots: VecDeque::with_capacity(365),
            period: crate::dto::KpiPeriod::default(),
        }
    }
}

// ---------------------------------------------------------------------------
// Advanced alerting
// ---------------------------------------------------------------------------

/// Advanced alerting state.
#[derive(Default)]
pub struct AlertingState {
    pub rules: Vec<crate::dto::AlertRule>,
    pub webhooks: Vec<crate::dto::WebhookConfig>,
    pub selected_rule: Option<usize>,
    pub selected_webhook: Option<usize>,
    pub detail_open: bool,
    pub editing_rule: bool,
    pub editing_webhook: bool,
}

// ---------------------------------------------------------------------------
// Vulnerability filter
// ---------------------------------------------------------------------------

/// Vulnerability page filter/search state.
#[derive(Default)]
pub struct VulnerabilityFilter {
    pub search: String,
    pub severity_filter: Option<crate::dto::Severity>,
    pub selected_vuln: Option<usize>,
    pub detail_open: bool,
    /// Current page (0-indexed) of the paginated findings table.
    pub page: usize,
}

// ---------------------------------------------------------------------------
// Software
// ---------------------------------------------------------------------------

/// Software inventory state.
#[derive(Default)]
pub struct SoftwareState {
    pub packages: Vec<crate::dto::GuiSoftwarePackage>,
    pub native_apps: Vec<crate::dto::GuiNativeApp>,
    pub active_tab: crate::dto::SoftwareTab,
    pub search: String,
    pub selected_package: Option<usize>,
    pub detail_open: bool,
    /// Current page (0-indexed) of the packages table.
    pub packages_page: usize,
    /// Current page (0-indexed) of the native-apps table.
    pub native_page: usize,
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/// Agent configuration / settings state.
pub struct SettingsState {
    /// Selected workspace section; independent of backend configuration.
    pub active_section: usize,
    pub is_paused: bool,
    pub server_url: String,
    pub architecture_url: String,
    pub check_interval_secs: u64,
    pub heartbeat_interval_secs: u64,
    pub log_level: crate::dto::LogLevel,
    pub dark_mode: bool,
    pub update_status: crate::dto::UpdateStatus,
    /// SHA-256 hash of the admin password for danger zone access.
    pub admin_password_sha256: String,
    /// Whether the SIEM forwarder is enabled.
    pub siem_enabled: bool,
    /// SIEM output format (CEF, LEEF, JSON).
    pub siem_format: String,
    /// SIEM transport protocol (Syslog, HTTP).
    pub siem_transport: String,
    /// SIEM destination address (host:port or URL).
    pub siem_destination: String,
    /// Whether the SIEM log collector is enabled.
    pub log_collector_enabled: bool,
    /// Active log sources for the collector.
    pub log_collector_sources: Vec<String>,
    /// Log collector polling interval in seconds.
    pub log_collector_poll_secs: u64,
    /// Navigation sidebar is collapsed to an icon rail.
    pub sidebar_collapsed: bool,
}

impl Default for SettingsState {
    fn default() -> Self {
        Self {
            active_section: 0,
            is_paused: false,
            server_url: agent_common::constants::DEFAULT_SERVER_URL.to_string(),
            architecture_url: format!("{}/voxel", crate::pages::about::branding::CONSOLE),
            check_interval_secs: agent_common::constants::DEFAULT_CHECK_INTERVAL_SECS,
            heartbeat_interval_secs: agent_common::constants::DEFAULT_HEARTBEAT_INTERVAL_SECS,
            log_level: crate::dto::LogLevel::Info,
            dark_mode: true,
            update_status: crate::dto::UpdateStatus::Idle,
            // SHA-256 of "admin" — should be changed on first deployment
            // SECURITY: No default password. Must be set via enrollment or secure storage.
            admin_password_sha256: String::new(),
            siem_enabled: false,
            siem_format: "CEF".to_string(),
            siem_transport: "Syslog".to_string(),
            siem_destination: String::new(),
            log_collector_enabled: true,
            log_collector_sources: vec![
                "system".to_string(),
                "auth".to_string(),
                "application".to_string(),
                "firewall".to_string(),
            ],
            log_collector_poll_secs: 60,
            sidebar_collapsed: false,
        }
    }
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

/// Security state (RBAC / Auth lock).
#[derive(Default)]
pub struct SecurityState {
    /// Is the admin mode currently unlocked?
    pub admin_unlocked: bool,
    /// Timestamp of last unlock (for auto-lock timeouts).
    pub last_unlock: Option<chrono::DateTime<chrono::Utc>>,
}

// ---------------------------------------------------------------------------
// Main AppState
// ---------------------------------------------------------------------------

/// Sync history entry for the sync page.
#[derive(Debug, Clone)]
pub struct SyncHistoryEntry {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub success: bool,
    pub message: String,
}

/// Shared application state consumed by all pages.
///
/// Fields are grouped into domain sub-structs to keep the struct manageable.
pub struct AppState {
    pub acknowledged_event_keys: VecDeque<String>,
    pub summary: crate::dto::AgentSummary,
    pub checks: Vec<crate::dto::GuiCheckResult>,
    pub policy: crate::dto::GuiPolicySummary,
    pub resources: crate::dto::GuiResourceUsage,
    pub vulnerability_summary: Option<crate::dto::GuiVulnerabilitySummary>,
    pub vulnerability_findings: Vec<crate::dto::GuiVulnerabilityFinding>,
    pub logs: VecDeque<crate::dto::GuiLogEntry>,
    pub toasts: Vec<crate::widgets::toast::Toast>,
    pub unread_notification_count: u32,

    // Channel to send async task results back to the main thread
    pub async_task_tx: Option<std::sync::mpsc::SyncSender<super::app::AsyncTaskResult>>,

    pub monitoring: MonitoringHistory,
    pub siem: SiemViewState,
    pub network: NetworkState,
    pub discovery: DiscoveryState,
    pub cartography: CartographyState,
    pub terminal: TerminalState,
    pub sync: SyncState,
    pub fim: FimState,
    pub threats: ThreatsState,
    pub software: SoftwareState,
    pub settings: SettingsState,
    pub security: SecurityState,
    pub compliance: ComplianceFilter,
    pub vulnerability: VulnerabilityFilter,
    pub ai: AiState,
    pub reports: ReportsState,
    pub risks: RisksState,
    pub assets: AssetsState,
    pub kpi: KpiState,
    pub alerting: AlertingState,

    pub notifications: Vec<crate::dto::GuiNotification>,
    pub notifications_active_tab: usize,
    pub selected_notification: Option<usize>,
    pub notification_detail_open: bool,
    /// Current page (0-indexed) of the paginated notification feed.
    pub notifications_page: usize,
    pub previous_compliance_score: Option<f32>,
    pub audit_trail_search: String,
    pub audit_trail_filter: Option<String>,
    pub selected_audit_entry: Option<usize>,
    /// Current page (0-indexed) of the paginated audit log.
    pub audit_trail_page: usize,
    pub audit_detail_open: bool,
    pub reduced_motion: bool,
    /// Page navigation request (consumed by app.rs each frame).
    #[cfg(feature = "render")]
    pub pending_navigation: Option<crate::app::Page>,
    /// Whether the voice recognition (Jarvis) is currently active/listening.
    pub voice_active: bool,
    /// Whether the standalone Jarvis widget (viewport) is currently visible.
    pub jarvis_visible: bool,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            acknowledged_event_keys: VecDeque::new(),
            summary: crate::dto::AgentSummary::default(),
            checks: Vec::new(),
            policy: crate::dto::GuiPolicySummary::default(),
            resources: crate::dto::GuiResourceUsage::default(),
            vulnerability_summary: None,
            vulnerability_findings: Vec::new(),
            logs: VecDeque::with_capacity(1000),
            toasts: Vec::new(),
            unread_notification_count: 0,
            async_task_tx: None,

            monitoring: MonitoringHistory::default(),
            siem: SiemViewState::default(),
            network: NetworkState::default(),
            discovery: DiscoveryState::default(),
            cartography: CartographyState::default(),
            terminal: TerminalState::default(),
            sync: SyncState::default(),
            fim: FimState::default(),
            threats: ThreatsState::default(),
            software: SoftwareState::default(),
            settings: SettingsState::default(),
            security: SecurityState::default(),
            compliance: ComplianceFilter::default(),
            vulnerability: VulnerabilityFilter::default(),
            ai: AiState {
                voice_config_sync_pending: true,
                ..AiState::default()
            },
            reports: ReportsState::default(),
            risks: RisksState::default(),
            assets: AssetsState::default(),
            kpi: KpiState::default(),
            alerting: AlertingState::default(),

            notifications: Vec::new(),
            notifications_active_tab: 0,
            selected_notification: None,
            notification_detail_open: false,
            notifications_page: 0,
            previous_compliance_score: None,
            audit_trail_search: String::new(),
            audit_trail_filter: None,
            selected_audit_entry: None,
            audit_trail_page: 0,
            audit_detail_open: false,
            reduced_motion: false,
            #[cfg(feature = "render")]
            pending_navigation: None,
            voice_active: false,
            jarvis_visible: false,
        }
    }
}

impl AppState {
    /// Push a toast notification with the current egui time.
    pub fn push_toast(&mut self, toast: crate::widgets::toast::Toast, ctx: &egui::Context) {
        let time = ctx.input(|i| i.time);
        self.toasts.push(toast.with_time(time));
    }

    /// Acknowledge a threat item across any subsystem (process, system, usb, fim, network).
    pub fn acknowledge_threat_item(&mut self, kind: &str, source_index: usize) -> bool {
        macro_rules! acknowledge {
            ($events:expr) => {
                if let Some(event) = $events.get_mut(source_index) {
                    event.acknowledged = true;
                    let key = event_identity(kind, event);
                    if !self.acknowledged_event_keys.contains(&key) {
                        self.acknowledged_event_keys.push_back(key);
                    }
                    while self.acknowledged_event_keys.len() > 2000 {
                        self.acknowledged_event_keys.pop_front();
                    }
                    return true;
                }
            };
        }
        match kind {
            "process" => {
                acknowledge!(self.threats.suspicious_processes);
            }
            "system" => {
                acknowledge!(self.threats.system_incidents);
            }
            "usb" => {
                acknowledge!(self.threats.usb_events);
            }
            "fim" => {
                acknowledge!(self.fim.alerts);
            }
            "network" => {
                acknowledge!(self.network.alerts);
            }
            _ => {}
        }
        false
    }

    fn acknowledgment_snapshot(&self) -> VecDeque<String> {
        let mut keys = self.acknowledged_event_keys.clone();
        macro_rules! collect {
            ($kind:literal, $events:expr) => {
                for event in $events.iter().rev().filter(|e| e.acknowledged) {
                    let key = event_identity($kind, event);
                    if !keys.contains(&key) {
                        keys.push_back(key);
                    }
                }
            };
        }
        collect!("process", self.threats.suspicious_processes);
        collect!("system", self.threats.system_incidents);
        collect!("usb", self.threats.usb_events);
        collect!("fim", self.fim.alerts);
        collect!("network", self.network.alerts);
        while keys.len() > 2000 {
            keys.pop_front();
        }
        keys
    }

    fn restore_acknowledgments(&mut self) {
        let keys: std::collections::HashSet<_> = self.acknowledged_event_keys.iter().collect();
        macro_rules! restore {
            ($kind:literal, $events:expr) => {
                for event in &mut $events {
                    event.acknowledged |= keys.contains(&event_identity($kind, event));
                }
            };
        }
        restore!("process", self.threats.suspicious_processes);
        restore!("system", self.threats.system_incidents);
        restore!("usb", self.threats.usb_events);
        restore!("fim", self.fim.alerts);
        restore!("network", self.network.alerts);
    }

    /// Add an authorization allowlist rule and apply it across all subsystems.
    pub fn add_allowlist_rule_global(
        &mut self,
        rule_type: crate::dto::AllowlistRuleType,
        pattern: String,
        description: String,
        created_by: String,
    ) -> uuid::Uuid {
        let id = self
            .threats
            .add_allowlist_rule(rule_type, pattern, description, created_by);
        self.refresh_authorizations();
        id
    }

    /// Recompute derived authorization flags after adding/removing a rule or receiving telemetry.
    /// Manual acknowledgments stay independent: revoking an exception restores visibility.
    pub fn refresh_authorizations(&mut self) {
        let rules = &self.threats.allowlist_rules;
        let covered = |kind, value: &str| crate::dto::allowlist_covers(rules, kind, value);
        use crate::dto::AllowlistRuleType as Kind;
        for p in &mut self.threats.suspicious_processes {
            p.allowlisted = covered(Kind::ProcessPattern, &p.process_name);
        }
        for i in &mut self.threats.system_incidents {
            i.allowlisted = covered(Kind::SystemIncident, &i.incident_type)
                || covered(Kind::SystemIncident, &i.title);
        }
        for u in &mut self.threats.usb_events {
            u.allowlisted = covered(
                Kind::UsbDevice,
                &crate::dto::usb_rule_value(u.vendor_id, u.product_id),
            ) || covered(Kind::UsbDevice, &u.device_name);
        }
        for f in &mut self.fim.alerts {
            f.allowlisted = covered(Kind::FilePath, &f.path);
        }
        for a in &mut self.network.alerts {
            // Only the remote peer is authorizable: `source_ip` is this host's
            // own address, and matching it would silence every network alert.
            a.allowlisted = covered(Kind::IpAddress, a.destination_ip.as_deref().unwrap_or(""));
        }
    }

    /// Per-source events still awaiting triage (neither acknowledged nor
    /// authorized): (processes, system incidents, network alerts, FIM alerts).
    pub fn open_threat_counts(&self) -> (usize, usize, usize, usize) {
        let open = |acknowledged: bool, allowlisted: bool| !acknowledged && !allowlisted;
        (
            self.threats
                .suspicious_processes
                .iter()
                .filter(|e| open(e.acknowledged, e.allowlisted))
                .count(),
            self.threats
                .system_incidents
                .iter()
                .filter(|e| open(e.acknowledged, e.allowlisted))
                .count(),
            self.network
                .alerts
                .iter()
                .filter(|e| open(e.acknowledged, e.allowlisted))
                .count(),
            self.fim
                .alerts
                .iter()
                .filter(|e| open(e.acknowledged, e.allowlisted))
                .count(),
        )
    }

    /// Events still awaiting triage and their actual critical subset. A normal USB
    /// connection/disconnection is inventory activity, not a security incident.
    pub fn security_attention_counts(&self) -> (usize, usize) {
        let processes = self
            .threats
            .suspicious_processes
            .iter()
            .filter(|p| !p.acknowledged && !p.allowlisted);
        let network = self
            .network
            .alerts
            .iter()
            .filter(|a| !a.acknowledged && !a.allowlisted);
        let system = self
            .threats
            .system_incidents
            .iter()
            .filter(|a| !a.acknowledged && !a.allowlisted);
        let critical = processes.clone().filter(|p| p.confidence >= 90).count()
            + network
                .clone()
                .filter(|a| a.severity == crate::dto::Severity::Critical)
                .count()
            + system
                .clone()
                .filter(|a| a.severity == crate::dto::Severity::Critical)
                .count();
        let total = processes.count()
            + network.count()
            + system.count()
            + self
                .fim
                .alerts
                .iter()
                .filter(|a| !a.acknowledged && !a.allowlisted)
                .count()
            + self
                .threats
                .usb_events
                .iter()
                .filter(|a| {
                    !a.acknowledged
                        && !a.allowlisted
                        && a.event_type == crate::dto::UsbEventType::Blocked
                })
                .count();
        (total, critical)
    }

    /// Compute radar chart scores (compliance, threats, vulns, resources, network).
    /// Each score is normalized to 0.0..=1.0 where 1.0 is best.
    /// Maximum thresholds for radar score normalization.
    const RADAR_MAX_THREATS: f32 = 10.0;
    const RADAR_MAX_VULNS: f32 = 20.0;
    const RADAR_MAX_ALERTS: f32 = 5.0;

    pub fn radar_scores(&self) -> (f32, f32, f32, f32, f32) {
        let compliance = self.summary.compliance_score.unwrap_or(0.0) / 100.0;
        let threats = 1.0
            - (self.threats.suspicious_processes.len() as f32 / Self::RADAR_MAX_THREATS).min(1.0);
        let vulns =
            1.0 - (self.vulnerability_findings.len() as f32 / Self::RADAR_MAX_VULNS).min(1.0);
        let resources = 1.0 - (self.resources.cpu_percent as f32 / 100.0).min(1.0);
        let network = 1.0 - (self.network.alert_count as f32 / Self::RADAR_MAX_ALERTS).min(1.0);
        (compliance, threats, vulns, resources, network)
    }

    /// Process an event from the agent runtime.
    ///
    /// This method centralizes all state updates and ensures reactive computation
    /// of summary statistics. Each event handler updates the appropriate sub-state
    /// and triggers necessary recomputations.
    pub fn apply_event(&mut self, event: crate::events::AgentEvent) {
        use crate::events::AgentEvent;

        let security_feed_changed = matches!(
            &event,
            AgentEvent::NetworkSecurityAlert { .. }
                | AgentEvent::FimAlert { .. }
                | AgentEvent::UsbEvent { .. }
                | AgentEvent::SuspiciousProcess { .. }
                | AgentEvent::SystemIncident { .. }
                | AgentEvent::VulnerabilityFindings { .. }
        );
        if security_feed_changed {
            // Unified lists are sorted across sources: any insertion can move the
            // selected row. Never leave a drawer targeting a different event.
            self.threats.selected_threat = None;
            self.threats.detail_open = false;
            self.threats.forensic_selected_event = None;
            self.threats.forensic_detail_open = false;
        }
        match event {
            AgentEvent::StatusChanged { summary } => {
                // Preserve previous score for dashboard trend indicators
                self.previous_compliance_score = self.summary.compliance_score;
                self.summary = summary;
            }
            AgentEvent::CheckCompleted { result } => {
                self.update_check_result(result);
                self.recompute_policy();
                self.summary.last_check_at = Some(chrono::Utc::now());
            }
            AgentEvent::ResourceUpdate { usage } => {
                self.update_resource_usage(usage);
            }
            AgentEvent::Notification { notification } => {
                self.add_notification(notification);
            }
            AgentEvent::SyncStatus {
                syncing,
                pending_count,
                last_sync_at,
                error,
            } => {
                self.update_sync_status(syncing, pending_count, last_sync_at, error);
            }
            AgentEvent::NetworkUpdate {
                interfaces_count,
                connections_count,
                alerts_count,
                primary_ip,
                primary_mac,
            } => {
                self.update_network_summary(
                    interfaces_count,
                    connections_count,
                    alerts_count,
                    primary_ip,
                    primary_mac,
                );
            }
            AgentEvent::NetworkDetailUpdate {
                interfaces,
                connections,
            } => {
                self.network.interfaces = interfaces;
                self.network.connections = connections;
                // Invalidate selection — data was fully replaced
                self.network.selected_connection = None;
                self.network.detail_open = false;
            }
            AgentEvent::NetworkSecurityAlert { alert } => {
                upsert_recurring(
                    &mut self.network.alerts,
                    "network",
                    alert,
                    &mut self.acknowledged_event_keys,
                    200,
                );
                // Invalidate alert selection — push_front shifted all indices
                self.network.selected_alert = None;
            }
            AgentEvent::VulnerabilityUpdate { summary } => {
                self.vulnerability_summary = Some(summary);
            }
            AgentEvent::SoftwareUpdate { packages } => {
                self.software.packages = packages;
                self.software.selected_package = None;
                self.software.detail_open = false;
            }
            AgentEvent::VulnerabilityFindings { findings } => {
                self.vulnerability_findings = findings;
                self.vulnerability.selected_vuln = None;
                self.vulnerability.detail_open = false;
            }
            AgentEvent::TerminalLog { entry } => {
                self.add_terminal_log(entry);
            }
            AgentEvent::DiscoveryUpdate { devices } => {
                self.discovery.devices = devices;
                self.discovery.in_progress = false;
                self.discovery.progress = 1.0;
                self.discovery.phase = "Terminée".to_string();
                self.discovery.selected_device = None;
                self.discovery.detail_open = false;
                self.cartography.layout = None;
            }
            AgentEvent::DiscoveryProgress {
                phase, progress, ..
            } => {
                self.discovery.in_progress = true;
                self.discovery.phase = phase;
                self.discovery.progress = progress;
            }
            AgentEvent::EnrollmentResult {
                success,
                message: _,
                agent_id,
            } => {
                if success && let Some(id) = agent_id {
                    self.summary.agent_id = Some(id);
                }
            }
            AgentEvent::FimAlert { mut alert } => {
                alert.acknowledged |= self
                    .acknowledged_event_keys
                    .contains(&event_identity("fim", &alert));
                self.fim.alerts.push_front(alert);
                self.fim.alerts.truncate(500);
                // Invalidate selection — push_front shifted indices
                self.fim.selected_alert = None;
            }
            AgentEvent::UsbEvent { mut event } => {
                event.acknowledged |= self
                    .acknowledged_event_keys
                    .contains(&event_identity("usb", &event));
                self.threats.usb_events.push_front(event);
                self.threats.usb_events.truncate(200);
                // Invalidate threat selection — push_front shifted source indices
                self.threats.selected_threat = None;
            }
            AgentEvent::SuspiciousProcess { process } => {
                upsert_recurring(
                    &mut self.threats.suspicious_processes,
                    "process",
                    process,
                    &mut self.acknowledged_event_keys,
                    200,
                );
                self.threats.selected_threat = None;
            }
            AgentEvent::SystemIncident { incident } => {
                upsert_recurring(
                    &mut self.threats.system_incidents,
                    "system",
                    incident,
                    &mut self.acknowledged_event_keys,
                    200,
                );
                self.threats.selected_threat = None;
            }
            AgentEvent::FimStats {
                monitored_count,
                changes_today,
            } => {
                self.fim.monitored_count = monitored_count;
                self.fim.changes_today = changes_today;
            }
            AgentEvent::ShuttingDown => {
                self.summary.status = crate::dto::GuiAgentStatus::Disconnected;
            }
            AgentEvent::UpdateStatusChanged { status } => {
                self.settings.update_status = status;
            }
            AgentEvent::SiemConfigUpdate {
                enabled,
                format,
                transport,
                destination,
            } => {
                self.settings.siem_enabled = enabled;
                self.settings.siem_format = format;
                self.settings.siem_transport = transport;
                self.settings.siem_destination = destination;
            }
            AgentEvent::SiemLogBatch { entries } => {
                const MAX_SIEM_LOGS: usize = 1000;
                for entry in entries {
                    self.siem.log_entries.push_front(entry);
                }
                self.siem.log_entries.truncate(MAX_SIEM_LOGS);
            }
            AgentEvent::SiemStatsUpdate { stats } => {
                self.siem.stats = stats;
            }
            AgentEvent::ResponseActionResult {
                action_id,
                success,
                error,
            } => {
                // Find the matching pending action and update its status
                if let Some(action) = self
                    .threats
                    .pending_actions
                    .iter_mut()
                    .find(|a| a.id == action_id)
                {
                    action.status = if success {
                        crate::dto::ResponseStatus::Success
                    } else {
                        crate::dto::ResponseStatus::Failed
                    };
                    action.completed_at = Some(chrono::Utc::now());
                    action.error = error.clone();

                    // Log the result
                    let log_entry = crate::dto::ResponseLogEntry {
                        id: uuid::Uuid::new_v4(),
                        action_type: action.action_type.clone(),
                        target: action.target.clone(),
                        status: action.status,
                        timestamp: chrono::Utc::now(),
                        operator: "Agent".to_string(),
                        details: error,
                    };
                    self.threats.response_log.push_front(log_entry);
                    if self.threats.response_log.len() > 500 {
                        self.threats.response_log.pop_back();
                    }
                }
            }
            AgentEvent::ReportGenerated { report } => {
                self.reports.reports.push_front(*report);
                if self.reports.reports.len() > 50 {
                    self.reports.reports.pop_back();
                }
                self.reports.generating = false;
                // push_front shifts all indices — invalidate report selection
                self.reports.selected_report = None;
                self.reports.detail_open = false;
            }
            AgentEvent::PlaybookTriggered { log_entry } => {
                // Update playbook last_triggered / trigger_count
                if let Some(pb) = self
                    .threats
                    .playbooks
                    .iter_mut()
                    .find(|p| p.id == log_entry.playbook_id)
                {
                    pb.last_triggered = Some(log_entry.triggered_at);
                    pb.trigger_count = pb.trigger_count.saturating_add(1);
                }
                self.threats.playbook_log.push_front(*log_entry);
                if self.threats.playbook_log.len() > 200 {
                    self.threats.playbook_log.pop_back();
                }
            }
            AgentEvent::KpiSnapshot { snapshot } => {
                self.kpi.snapshots.push_back(*snapshot);
                if self.kpi.snapshots.len() > 365 {
                    self.kpi.snapshots.pop_front();
                }
            }
            AgentEvent::VoiceError { message } => {
                self.ai.voice_error = Some(message);
                self.ai.voice_notice = None;
                self.ai.is_transcribing = false;
                self.ai.voice_relisten_pending = false;
                self.ai.is_listening = false;
                self.ai.is_speaking = false;
                self.ai.pending_voice_send = false;
                self.ai.voice_reply_pending = false;
                self.ai.voice_conversation_enabled = false;
                self.ai.mic_level = 0.0;
                self.voice_active = false;
            }
            AgentEvent::VoiceTranscription { text } => {
                let text = text.trim();
                if !text.is_empty() {
                    let had_draft = !self.ai.input_text.trim().is_empty();
                    if had_draft {
                        self.ai.input_text.push(' ');
                    }
                    self.ai.input_text.push_str(text);
                    // Dictation stays editable. Never auto-submit a pre-existing draft.
                    self.ai.pending_voice_send =
                        self.ai.voice_conversation_enabled && !had_draft && !self.ai.is_processing;
                    self.ai.voice_error = None;
                    self.ai.voice_notice = None;
                }
                self.ai.is_transcribing = false;
                self.ai.voice_empty_rounds = 0;
            }
            AgentEvent::VoiceTranscribing => {
                self.ai.is_transcribing = true;
            }
            AgentEvent::VoiceNoSpeech => {
                self.ai.is_transcribing = false;
                if self.ai.voice_conversation_enabled && !self.ai.is_processing {
                    self.ai.voice_empty_rounds = self.ai.voice_empty_rounds.saturating_add(1);
                    if self.ai.voice_empty_rounds <= VOICE_MAX_EMPTY_ROUNDS {
                        self.ai.voice_relisten_pending = true;
                    } else {
                        self.ai.voice_empty_rounds = 0;
                        self.ai.voice_notice = Some(
                            "Conversation en pause : aucune parole détectée. Appuyez sur « Parler » pour reprendre.".to_string(),
                        );
                    }
                } else {
                    self.ai.voice_notice = Some(
                        "Aucune parole détectée. Rapprochez-vous du micro et réessayez."
                            .to_string(),
                    );
                }
            }
            AgentEvent::VoiceEngineStatus { info } => {
                self.ai.voice_engine = Some(*info);
            }
            AgentEvent::VoiceModelInstall { progress } => {
                if progress.phase == crate::dto::VoiceInstallPhase::Ready {
                    self.ai.voice_settings.whisper_model = progress.model_key.clone();
                    self.ai.voice_error = None;
                    self.ai.voice_notice = Some(
                        "Dictée installée : appuyez sur « Parler » ou « Dicter ».".to_string(),
                    );
                    if let Some(engine) = self.ai.voice_engine.as_mut() {
                        engine.stt_ready = true;
                        engine.stt_model = Some(progress.model_key.clone());
                        if !engine.installed_models.contains(&progress.model_key) {
                            engine.installed_models.push(progress.model_key.clone());
                        }
                    }
                }
                self.ai.voice_install = Some(progress);
            }

            AgentEvent::VoiceStatus { speaking } => {
                self.ai.is_speaking = speaking;
                if speaking {
                    self.ai.is_listening = false;
                }
            }
            AgentEvent::LlmChatDelta { text } => {
                // Late fragments after completion or cancellation are ignored.
                if self.ai.is_processing && !text.is_empty() {
                    match self.ai.streaming_message() {
                        Some(message) => message.content.push_str(&text),
                        None => {
                            self.ai.chat_history.push(crate::dto::LlmChatMessage {
                                role: crate::dto::ChatRole::Assistant,
                                content: text,
                                timestamp: chrono::Utc::now(),
                                processing_time_ms: None,
                            });
                            self.ai.streaming_index = Some(self.ai.chat_history.len() - 1);
                        }
                    }
                }
            }
            AgentEvent::LlmChatResponse {
                message,
                processing_time_ms,
            } => {
                // The complete answer replaces the text streamed so far.
                match self.ai.streaming_message() {
                    Some(streamed) => {
                        streamed.content.clone_from(&message);
                        streamed.processing_time_ms = Some(processing_time_ms);
                    }
                    None => self.ai.chat_history.push(crate::dto::LlmChatMessage {
                        role: crate::dto::ChatRole::Assistant,
                        content: message.clone(),
                        timestamp: chrono::Utc::now(),
                        processing_time_ms: Some(processing_time_ms),
                    }),
                }
                self.ai.streaming_index = None;
                self.ai.is_processing = false;
                self.ai.cancel_requested = false;

                // If compliance was waiting for AI analysis, update its state too
                if self.compliance.ai_analyzing {
                    self.compliance.ai_analyzing = false;
                    self.compliance.ai_analysis_result = Some(message);
                }
            }
            AgentEvent::LlmAnalysisComplete {
                target,
                analysis,
                severity_override: _,
                is_false_positive,
                confidence,
                ai_remediation_script,
                ai_remediation_explanation,
            } => {
                // Add analysis result as a system message in chat
                let summary = if let Some(fp) = is_false_positive {
                    let conf = confidence.unwrap_or(0);
                    if fp {
                        format!(
                            "[Analyse: {}] Faux positif probable (confiance: {}%)\n\n{}",
                            target, conf, analysis
                        )
                    } else {
                        format!(
                            "[Analyse: {}] Menace confirmée (confiance: {}%)\n\n{}",
                            target, conf, analysis
                        )
                    }
                } else {
                    format!("[Analyse: {}]\n\n{}", target, analysis)
                };
                self.ai.chat_history.push(crate::dto::LlmChatMessage {
                    role: crate::dto::ChatRole::Assistant,
                    content: summary,
                    timestamp: chrono::Utc::now(),
                    processing_time_ms: None,
                });
                self.ai.is_processing = false;

                // Update the source DTO with AI analysis results
                if target.starts_with("finding:") {
                    // Vulnerability finding
                    if let Some(idx) = self
                        .vulnerability_findings
                        .iter()
                        .position(|finding| vulnerability_identity(finding) == target)
                    {
                        self.vulnerability_findings[idx].ai_analysis = Some(analysis);
                        self.vulnerability_findings[idx].ai_confidence = confidence;
                        self.vulnerability_findings[idx].is_false_positive = is_false_positive;
                        self.vulnerability_findings[idx].ai_remediation_script =
                            ai_remediation_script;
                        self.vulnerability_findings[idx].ai_remediation_explanation =
                            ai_remediation_explanation;
                    }
                } else if target.starts_with("process:") {
                    // Suspicious process
                    if let Some(idx) = self
                        .threats
                        .suspicious_processes
                        .iter()
                        .position(|event| event_identity("process", event) == target)
                    {
                        self.threats.suspicious_processes[idx].ai_analysis = Some(analysis);
                        self.threats.suspicious_processes[idx].ai_confidence = confidence;
                        self.threats.suspicious_processes[idx].is_false_positive =
                            is_false_positive;
                    }
                } else if target.starts_with("system:") {
                    // System incident
                    if let Some(idx) = self
                        .threats
                        .system_incidents
                        .iter()
                        .position(|event| event_identity("system", event) == target)
                    {
                        self.threats.system_incidents[idx].ai_analysis = Some(analysis);
                        self.threats.system_incidents[idx].ai_confidence = confidence;
                        self.threats.system_incidents[idx].is_false_positive = is_false_positive;
                    }
                } else if target.starts_with("network:") {
                    // Network alert
                    if let Some(idx) = self
                        .network
                        .alerts
                        .iter()
                        .position(|event| event_identity("network", event) == target)
                    {
                        self.network.alerts[idx].ai_analysis = Some(analysis);
                        self.network.alerts[idx].ai_confidence = confidence;
                        self.network.alerts[idx].is_false_positive = is_false_positive;
                    }
                }
            }
            AgentEvent::LlmStatusUpdate {
                model_name,
                status,
                inference_count,
                memory_mb,
            } => {
                let is_ready = status == "ready";
                self.ai.model_status = crate::dto::LlmModelStatus {
                    model_name,
                    status,
                    inference_count,
                    memory_mb,
                    is_ready,
                };
            }
            AgentEvent::LlmAcceleration { label } => {
                self.ai.acceleration = Some(label);
            }
            AgentEvent::LlmDownloadProgress {
                model_name,
                progress_percent,
                downloaded_bytes,
                total_bytes,
                speed_bps,
            } => {
                self.ai.download.phase = crate::dto::DownloadPhase::Downloading;
                self.ai.download.model_name = model_name;
                self.ai.download.progress_percent = progress_percent;
                self.ai.download.downloaded_bytes = downloaded_bytes;
                self.ai.download.total_bytes = total_bytes;
                self.ai.download.speed_bps = speed_bps;
                self.ai.download.error = None;
                self.ai.model_status.status = "downloading".to_string();
            }
            AgentEvent::LlmDownloadComplete {
                model_name,
                total_bytes,
            } => {
                self.ai.download.phase = crate::dto::DownloadPhase::Completed;
                self.ai.download.model_name = model_name;
                self.ai.download.progress_percent = 100;
                self.ai.download.downloaded_bytes = total_bytes;
                self.ai.download.total_bytes = total_bytes;
                self.ai.download.speed_bps = 0;
                self.ai.download.error = None;
            }
            AgentEvent::LlmDownloadFailed { model_name, error } => {
                // Don't override user-initiated cancel (already set to Idle by GUI)
                if self.ai.download.phase != crate::dto::DownloadPhase::Idle {
                    self.ai.download.phase = crate::dto::DownloadPhase::Failed;
                    self.ai.download.model_name = model_name;
                    self.ai.download.speed_bps = 0;
                    self.ai.download.error = Some(error);
                    self.ai.model_status.status = "error".to_string();
                }
            }
            AgentEvent::LlmVoiceState { active } => {
                self.voice_active = active;
                // Keep the Jarvis widget's listening flag in sync with the voice
                // backend lifecycle so the indicator falls back to idle when the
                // capture loop finishes (e.g. silence timeout).
                self.ai.is_listening = active;
                if active {
                    self.ai.is_speaking = false;
                    self.ai.voice_notice = None;
                }
                if !active {
                    self.ai.mic_level = 0.0;
                    self.ai.is_transcribing = false;
                }
            }
            AgentEvent::AudioLevel { rms } => {
                // Asymmetric EMA: follow rising edges almost instantly so speech onsets
                // are visible, but decay slowly so the VU bar doesn't flicker between
                // syllables.
                let target = rms.clamp(0.0, 1.0);
                let prev = self.ai.mic_level;
                self.ai.mic_level = if target >= prev {
                    prev + (target - prev) * 0.6
                } else {
                    prev + (target - prev) * 0.2
                };
            }
            AgentEvent::LlmRiskAnalysis {
                risk_id,
                suggested_probability,
                suggested_impact,
                analysis,
                mitigation_suggestions,
            } => {
                // Clear the analyzing spinner
                if self.risks.ai_analyzing.as_ref().cloned() == Some(risk_id.clone()) {
                    self.risks.ai_analyzing = None;
                }
                // Store the analysis result for display
                self.risks.ai_analysis_result = Some(analysis.clone());
                self.risks.ai_mitigation_suggestions = mitigation_suggestions;

                // Optionally apply AI-suggested scores to the risk entry
                if let Some(entry) = self.risks.entries.iter_mut().find(|r| r.id == risk_id) {
                    if let Some(prob) = suggested_probability {
                        entry.probability = prob.clamp(1, 5);
                    }
                    if let Some(impact) = suggested_impact {
                        entry.impact = impact.clamp(1, 5);
                    }
                    entry.updated_at = chrono::Utc::now();
                }

                // Also log in the AI chat for traceability
                self.ai.chat_history.push(crate::dto::LlmChatMessage {
                    role: crate::dto::ChatRole::Assistant,
                    content: format!("[Analyse de risque]\n\n{}", analysis),
                    timestamp: chrono::Utc::now(),
                    processing_time_ms: None,
                });
            }
            AgentEvent::RisksSnapshot { risks } => {
                let selected = self
                    .risks
                    .selected_risk
                    .and_then(|i| self.risks.entries.get(i))
                    .map(|r| r.id.clone());
                self.risks.selected_risk =
                    selected.and_then(|id| risks.iter().position(|r| r.id == id));
                self.risks.entries = risks;
            }
            AgentEvent::RisksLoaded { risks } => {
                for risk in risks {
                    if let Some(existing) = self.risks.entries.iter_mut().find(|r| r.id == risk.id)
                    {
                        *existing = risk;
                    } else {
                        self.risks.entries.push(risk);
                    }
                }
            }
            AgentEvent::AdminPasswordSet { hash } => {
                self.settings.admin_password_sha256 = hash;
            }
            AgentEvent::AssetsLoaded { assets } => {
                let selected = self
                    .assets
                    .selected_asset
                    .and_then(|i| self.assets.assets.get(i))
                    .map(|a| a.id.clone());
                self.assets.selected_asset =
                    selected.and_then(|id| assets.iter().position(|a| a.id == id));
                self.assets.assets = assets;
            }
            AgentEvent::PlaybooksLoaded { playbooks } => {
                self.threats.playbooks = playbooks;
            }
            AgentEvent::DetectionRulesLoaded { rules } => {
                self.threats.detection_rules = rules;
            }
            AgentEvent::AlertingLoaded { rules, webhooks } => {
                self.alerting.rules = rules;
                self.alerting.webhooks = webhooks;
            }
            AgentEvent::ResponseActionSubmitted { action } => {
                self.threats.pending_actions.push_front(action);
                self.threats.pending_actions.truncate(200);
            }
            AgentEvent::FileQuarantined { entry } => {
                self.threats.quarantine_queue.push_front(entry);
                self.threats.quarantine_queue.truncate(200);
            }
            AgentEvent::ToggleJarvisWidget { visible } => {
                self.jarvis_visible = visible;
            }
        }

        if security_feed_changed {
            self.refresh_authorizations();
        }
        // Single recompute at end of every event
        self.recompute_summary_stats();
    }

    /// Update check results and maintain history
    fn update_check_result(&mut self, result: crate::dto::GuiCheckResult) {
        if let Some(existing) = self
            .checks
            .iter_mut()
            .find(|c| c.check_id == result.check_id)
        {
            *existing = result;
        } else {
            self.checks.push(result);
        }
    }

    /// Update resource usage with history management
    fn update_resource_usage(&mut self, usage: crate::dto::GuiResourceUsage) {
        const MAX_HISTORY: usize = 300;
        let t = usage.uptime_secs as f64;

        {
            self.monitoring
                .cpu_history
                .push_back([t, usage.cpu_percent]);
            while self.monitoring.cpu_history.len() > MAX_HISTORY {
                self.monitoring.cpu_history.pop_front();
            }
        }
        {
            self.monitoring
                .memory_history
                .push_back([t, usage.memory_percent]);
            while self.monitoring.memory_history.len() > MAX_HISTORY {
                self.monitoring.memory_history.pop_front();
            }
        }
        {
            self.monitoring
                .disk_io_history
                .push_back([t, usage.disk_kbps as f64]);
            while self.monitoring.disk_io_history.len() > MAX_HISTORY {
                self.monitoring.disk_io_history.pop_front();
            }
        }
        {
            self.monitoring
                .network_io_history
                .push_back([t, usage.network_io_bytes as f64 / 1024.0]);
            while self.monitoring.network_io_history.len() > MAX_HISTORY {
                self.monitoring.network_io_history.pop_front();
            }
        }

        self.resources = usage;
    }

    /// Add notification and maintain log history
    fn add_notification(&mut self, notification: crate::dto::GuiNotification) {
        self.logs.push_front(crate::dto::GuiLogEntry {
            id: notification.id,
            timestamp: notification.timestamp,
            level: notification.severity.clone(),
            message: notification.title.clone(),
            source: None,
        });
        self.logs.truncate(1000);
        // push_front shifts all indices — invalidate audit trail selection
        self.selected_audit_entry = None;
        self.audit_detail_open = false;

        self.notifications.push(notification);
        if self.notifications.len() > 100 {
            // Evict oldest notification (FIFO), not newest
            self.notifications.remove(0);
            // remove(0) shifts all indices — invalidate selection
            self.selected_notification = None;
            self.notification_detail_open = false;
        }
    }

    /// Update synchronization status with history
    fn update_sync_status(
        &mut self,
        syncing: bool,
        pending_count: u32,
        last_sync_at: Option<chrono::DateTime<chrono::Utc>>,
        error: Option<String>,
    ) {
        self.sync.in_progress = syncing;
        self.summary.pending_sync_count = pending_count;

        if let Some(ts) = last_sync_at {
            self.summary.last_sync_at = Some(ts);
            self.sync.history.push_front(SyncHistoryEntry {
                timestamp: ts,
                success: error.is_none(),
                message: error
                    .clone()
                    .unwrap_or_else(|| "Synchronisation terminée".to_string()),
            });
            self.sync.history.truncate(50);
        }
        self.sync.error = error;
    }

    /// Update network summary information
    fn update_network_summary(
        &mut self,
        interfaces_count: u32,
        connections_count: u32,
        alerts_count: u32,
        primary_ip: Option<String>,
        primary_mac: Option<String>,
    ) {
        self.network.interface_count = interfaces_count;
        self.network.connection_count = connections_count;
        self.network.alert_count = alerts_count;
        self.network.primary_ip = primary_ip;
        self.network.primary_mac = primary_mac;
        self.network.last_scan = Some(chrono::Utc::now());
    }

    /// Add terminal log entry with statistics
    fn add_terminal_log(&mut self, entry: crate::events::TerminalLogEntry) {
        self.terminal.event_count += 1;
        if entry.level == "ERROR" {
            self.terminal.error_count += 1;
        }
        self.terminal.lines.push_back(entry);
        while self.terminal.lines.len() > 500 {
            self.terminal.lines.pop_front();
            // pop_front shifts all indices — invalidate terminal selection
            self.terminal.selected_log = None;
            self.terminal.detail_open = false;
        }
    }

    /// Close all detail drawers (called on page navigation).
    pub fn close_all_drawers(&mut self) {
        self.network.detail_open = false;
        self.network.selected_connection = None;
        self.network.selected_alert = None;
        self.discovery.detail_open = false;
        self.discovery.selected_device = None;
        self.cartography.selected_device = None;
        self.terminal.detail_open = false;
        self.terminal.selected_log = None;
        self.software.detail_open = false;
        self.software.selected_package = None;
        self.vulnerability.detail_open = false;
        self.vulnerability.selected_vuln = None;
        self.threats.detail_open = false;
        self.threats.selected_threat = None;
        self.threats.confirm_action = None;
        self.threats.forensic_detail_open = false;
        self.threats.forensic_selected_event = None;
        self.threats.playbook_editing = false;
        self.threats.detection_rule_editing = false;
        self.fim.detail_open = false;
        self.fim.selected_alert = None;
        self.compliance.detail_open = false;
        self.compliance.selected_check = None;
        self.ai.detail_open = false;
        self.ai.selected_recommendation = None;
        self.reports.detail_open = false;
        self.reports.selected_report = None;
        self.risks.detail_open = false;
        self.risks.selected_risk = None;
        self.risks.editing = false;
        self.assets.detail_open = false;
        self.assets.selected_asset = None;
        self.alerting.detail_open = false;
        self.alerting.selected_rule = None;
        self.alerting.selected_webhook = None;
        self.alerting.editing_rule = false;
        self.alerting.editing_webhook = false;
        self.notification_detail_open = false;
        self.selected_notification = None;
        self.audit_detail_open = false;
        self.selected_audit_entry = None;
    }

    /// Recompute summary statistics reactively
    fn recompute_summary_stats(&mut self) {
        // Note: compliance_score is already computed with severity weights
        // by recompute_policy(). Do NOT overwrite it with an unweighted ratio.

        // Update counts that exist in AgentSummary
        // Note: Some fields like vulnerability_count, software_count, etc.
        // may need to be added to the AgentSummary struct in the future
        // For now, we'll skip the non-existent fields

        // Update notification count (count only unread notifications)
        self.unread_notification_count =
            self.notifications.iter().filter(|n| !n.read).count() as u32;
    }

    fn recompute_policy(&mut self) {
        use crate::dto::{GuiCheckStatus, GuiPolicySummary};
        let total = self.checks.len() as u32;
        let (mut passing, mut failing, mut errors) = (0u32, 0u32, 0u32);
        let mut weighted_pass = 0.0_f32;
        let mut weighted_total = 0.0_f32;
        for c in &self.checks {
            let w = c.severity.weight();
            match c.status {
                GuiCheckStatus::Pass => {
                    passing += 1;
                    weighted_pass += w;
                    weighted_total += w;
                }
                GuiCheckStatus::Fail => {
                    failing += 1;
                    weighted_total += w;
                }
                GuiCheckStatus::Error => {
                    errors += 1;
                    weighted_pass += w * 0.5;
                    weighted_total += w;
                }
                _ => {} // Skipped/Pending excluded from score
            }
        }
        let pending = total - passing - failing - errors;

        self.summary.compliance_score = if weighted_total > 0.0 {
            Some((weighted_pass / weighted_total) * 100.0)
        } else {
            None
        };

        let summary = GuiPolicySummary {
            total_policies: total,
            passing,
            failing,
            errors,
            pending,
        };

        self.policy = summary;
        self.summary.policy_summary = Some(summary);
    }
}

#[cfg(test)]
mod voice_workflow_tests {
    use crate::{app::AppState, events::AgentEvent};
    #[test]
    fn dictation_preserves_draft_and_requires_review() {
        let mut state = AppState::default();
        state.ai.input_text = "Analyse".into();
        state.apply_event(AgentEvent::VoiceTranscription {
            text: " les alertes ".into(),
        });
        assert_eq!(state.ai.input_text, "Analyse les alertes");
        assert!(!state.ai.pending_voice_send);
    }
    #[test]
    fn continuous_voice_only_submits_an_idle_empty_draft() {
        let mut state = AppState::default();
        state.ai.voice_conversation_enabled = true;
        state.apply_event(AgentEvent::VoiceTranscription {
            text: "Analyse les alertes".into(),
        });
        assert!(state.ai.pending_voice_send);
        state.apply_event(AgentEvent::VoiceTranscription {
            text: "et les risques".into(),
        });
        assert!(!state.ai.pending_voice_send);
        state.ai.input_text.clear();
        state.ai.is_processing = true;
        state.apply_event(AgentEvent::VoiceTranscription {
            text: "Question suivante".into(),
        });
        assert!(!state.ai.pending_voice_send);
    }
    #[test]
    fn voice_failure_preserves_draft_and_cancels_automatic_restart() {
        let mut state = AppState::default();
        state.ai.input_text = "Brouillon".into();
        state.ai.voice_conversation_enabled = true;
        state.ai.voice_reply_pending = true;
        state.ai.pending_voice_send = true;
        state.apply_event(AgentEvent::VoiceError {
            message: "Microphone indisponible".into(),
        });
        assert_eq!(state.ai.input_text, "Brouillon");
        assert!(state.ai.chat_history.is_empty());
        assert!(
            !state.ai.pending_voice_send
                && !state.ai.voice_reply_pending
                && !state.ai.voice_conversation_enabled
        );
        assert!(state.ai.voice_error.is_some());
    }

    #[test]
    fn streamed_answer_is_shown_progressively_then_finalized() {
        let mut state = AppState::default();
        state.ai.is_processing = true;
        state.ai.chat_history.push(crate::dto::LlmChatMessage {
            role: crate::dto::ChatRole::User,
            content: "Risques ?".into(),
            timestamp: chrono::Utc::now(),
            processing_time_ms: None,
        });
        state.apply_event(AgentEvent::LlmChatDelta {
            text: "Trois ".into(),
        });
        state.apply_event(AgentEvent::LlmChatDelta {
            text: "risques".into(),
        });
        assert_eq!(state.ai.chat_history.len(), 2);
        assert_eq!(state.ai.chat_history[1].content, "Trois risques");
        assert!(state.ai.is_processing);
        state.apply_event(AgentEvent::LlmChatResponse {
            message: "Trois risques majeurs.".into(),
            processing_time_ms: 1200,
        });
        assert_eq!(state.ai.chat_history.len(), 2, "no duplicate answer");
        assert_eq!(state.ai.chat_history[1].content, "Trois risques majeurs.");
        assert_eq!(state.ai.chat_history[1].processing_time_ms, Some(1200));
        assert!(!state.ai.is_processing && state.ai.streaming_index.is_none());
        // A late fragment after completion never creates a ghost message.
        state.apply_event(AgentEvent::LlmChatDelta { text: "x".into() });
        assert_eq!(state.ai.chat_history.len(), 2);
    }

    #[test]
    fn warm_up_is_requested_once() {
        let mut state = AppState::default();
        assert!(state.ai.take_warm_up());
        assert!(!state.ai.take_warm_up());
        let prefix = crate::llm_panel::LLMPanel::warm_up_context(&state);
        let prompt = crate::llm_panel::LLMPanel::grounded_prompt(&state, "Risques ?");
        assert!(!prefix.is_empty() && prompt.starts_with(&prefix));
        assert!(!prefix.contains("QUESTION"));
    }

    #[test]
    fn silent_hands_free_rounds_relisten_then_pause() {
        let mut state = AppState::default();
        state.ai.voice_conversation_enabled = true;
        for _ in 0..super::VOICE_MAX_EMPTY_ROUNDS {
            state.apply_event(AgentEvent::LlmVoiceState { active: false });
            state.apply_event(AgentEvent::VoiceNoSpeech);
            assert!(state.ai.take_voice_relisten());
            assert!(!state.ai.take_voice_relisten(), "one reopening per round");
        }
        state.apply_event(AgentEvent::VoiceNoSpeech);
        assert!(!state.ai.take_voice_relisten());
        assert!(
            state
                .ai
                .voice_notice
                .as_deref()
                .is_some_and(|n| n.contains("pause"))
        );
    }

    #[test]
    fn speech_resets_the_silent_round_counter() {
        let mut state = AppState::default();
        state.ai.voice_conversation_enabled = true;
        state.apply_event(AgentEvent::VoiceNoSpeech);
        state.apply_event(AgentEvent::VoiceTranscribing);
        assert!(state.ai.is_transcribing);
        state.apply_event(AgentEvent::VoiceTranscription {
            text: "Quelles alertes ?".into(),
        });
        assert_eq!(state.ai.voice_empty_rounds, 0);
        assert!(!state.ai.is_transcribing);
        assert!(state.ai.pending_voice_send);
    }

    #[test]
    fn missing_dictation_model_opens_settings_instead_of_the_microphone() {
        let mut state = AppState::default();
        state.apply_event(AgentEvent::VoiceEngineStatus {
            info: Box::new(crate::dto::VoiceEngineInfo::default()),
        });
        assert!(crate::llm_panel::LLMPanel::toggle_dictation(&mut state).is_none());
        assert!(crate::llm_panel::LLMPanel::start_conversation(&mut state).is_none());
        assert!(!state.ai.is_listening && !state.ai.voice_conversation_enabled);
        assert!(state.ai.voice_settings_open && state.ai.voice_error.is_some());

        state.apply_event(AgentEvent::VoiceModelInstall {
            progress: crate::dto::VoiceInstallProgress {
                model_key: "small-q5_1".into(),
                phase: crate::dto::VoiceInstallPhase::Ready,
                downloaded_bytes: 1,
                total_bytes: 1,
                error: None,
            },
        });
        assert!(state.ai.dictation_available());
        assert!(state.ai.voice_error.is_none());
        assert_eq!(state.ai.voice_settings.whisper_model, "small-q5_1");
        assert!(matches!(
            crate::llm_panel::LLMPanel::start_conversation(&mut state),
            Some(crate::events::GuiCommand::SetVoiceListening { enabled: true })
        ));
        assert!(state.ai.voice_conversation_enabled && state.ai.is_listening);
        // Ending a dictation asks the runtime to transcribe, not to discard.
        assert!(matches!(
            crate::llm_panel::LLMPanel::toggle_dictation(&mut state),
            Some(crate::events::GuiCommand::SetVoiceListening { enabled: false })
        ));
    }

    #[test]
    fn voice_preferences_persist_without_reopening_the_microphone() {
        let mut state = AppState::default();
        state.ai.voice_conversation_enabled = true;
        state.ai.voice_settings.rate = 1.4;
        state.ai.voice_settings.reply_mode = crate::dto::SpokenReplyMode::Summary;
        state.ai.voice_alert_threshold = crate::dto::VoiceAlertThreshold::Critical;
        let json = serde_json::to_string(&super::GuiPreferences::from_state(&state)).unwrap();
        let prefs: super::GuiPreferences = serde_json::from_str(&json).unwrap();
        let mut restarted = AppState::default();
        restarted.ai.voice_config_sync_pending = false;
        prefs.apply_to(&mut restarted);
        assert!(!restarted.ai.voice_conversation_enabled);
        assert_eq!(restarted.ai.voice_settings.rate, 1.4);
        assert_eq!(
            restarted.ai.voice_alert_threshold,
            crate::dto::VoiceAlertThreshold::Critical
        );
        assert!(matches!(
            restarted.ai.take_voice_config_sync(),
            Some(crate::events::GuiCommand::ConfigureVoice { settings })
                if settings.reply_mode == crate::dto::SpokenReplyMode::Summary
        ));
        assert!(restarted.ai.take_voice_config_sync().is_none());
        // Older preference files without the new fields still load.
        let legacy: super::GuiPreferences =
            serde_json::from_str(r#"{"voice_alerts_enabled":true}"#).unwrap();
        assert_eq!(legacy.voice_settings, crate::dto::VoiceSettings::default());
    }
    #[test]
    fn incoming_fim_event_cannot_retarget_open_security_drawer() {
        let mut state = AppState::default();
        state.threats.selected_threat = Some(0);
        state.threats.detail_open = true;
        state.threats.forensic_selected_event = Some(0);
        state.threats.forensic_detail_open = true;
        state.apply_event(crate::events::AgentEvent::FimAlert {
            alert: crate::dto::GuiFimAlert {
                id: "new".into(),
                path: "/tmp/test".into(),
                change_type: crate::dto::FimChangeType::Modified,
                old_hash: None,
                new_hash: None,
                timestamp: chrono::Utc::now(),
                acknowledged: false,
                allowlisted: false,
            },
        });
        assert!(state.threats.selected_threat.is_none());
        assert!(!state.threats.detail_open);
        assert!(state.threats.forensic_selected_event.is_none());
        assert!(!state.threats.forensic_detail_open);
    }
}

#[cfg(test)]
mod triage_persistence_tests {
    use super::*;
    use crate::{dto::GuiSuspiciousProcess, events::AgentEvent};

    fn process() -> GuiSuspiciousProcess {
        GuiSuspiciousProcess {
            process_name: "example".into(),
            pid: 42,
            command_line: "example --local".into(),
            reason: "test".into(),
            confidence: 70,
            detected_at: chrono::Utc::now(),
            ai_confidence: None,
            is_false_positive: None,
            ai_analysis: None,
            acknowledged: false,
            allowlisted: false,
        }
    }

    #[test]
    fn acknowledgment_survives_preferences_roundtrip_and_event_replay_only() {
        let event = process();
        let mut state = AppState::default();
        state.apply_event(AgentEvent::SuspiciousProcess {
            process: event.clone(),
        });
        assert!(state.acknowledge_threat_item("process", 0));
        let json = serde_json::to_string(&GuiPreferences::from_state(&state)).unwrap();
        assert!(!json.contains("example --local"));
        let prefs: GuiPreferences = serde_json::from_str(&json).unwrap();
        let mut restarted = AppState::default();
        prefs.apply_to(&mut restarted);
        restarted.apply_event(AgentEvent::SuspiciousProcess {
            process: event.clone(),
        });
        assert!(restarted.threats.suspicious_processes[0].acknowledged);
        // The next periodic scan re-detects the same condition: it refreshes the
        // existing entry and stays acknowledged instead of reappearing.
        let mut recurrence = event.clone();
        recurrence.detected_at += chrono::Duration::minutes(5);
        recurrence.confidence = 75;
        restarted.apply_event(AgentEvent::SuspiciousProcess {
            process: recurrence,
        });
        assert_eq!(restarted.threats.suspicious_processes.len(), 1);
        assert!(restarted.threats.suspicious_processes[0].acknowledged);
        // A different process instance is a new alert.
        let mut other = event;
        other.pid += 1;
        restarted.apply_event(AgentEvent::SuspiciousProcess { process: other });
        assert_eq!(restarted.threats.suspicious_processes.len(), 2);
        assert!(!restarted.threats.suspicious_processes[0].acknowledged);
    }

    #[test]
    fn recurring_detection_keeps_triage_and_ai_enrichment_without_duplicates() {
        let mut state = AppState::default();
        let incident = crate::dto::GuiSystemIncident {
            incident_type: "firewall_disabled".into(),
            severity: crate::dto::Severity::High,
            title: "Pare-feu désactivé".into(),
            description: "Profil public".into(),
            confidence: 90,
            detected_at: chrono::Utc::now(),
            ai_confidence: None,
            is_false_positive: None,
            ai_analysis: None,
            acknowledged: false,
            allowlisted: false,
        };
        state.apply_event(AgentEvent::SystemIncident {
            incident: incident.clone(),
        });
        state.threats.system_incidents[0].ai_analysis = Some("analyse".into());
        assert!(state.acknowledge_threat_item("system", 0));
        for minutes in 1..=3 {
            let mut again = incident.clone();
            again.detected_at += chrono::Duration::minutes(5 * minutes);
            state.apply_event(AgentEvent::SystemIncident { incident: again });
        }
        assert_eq!(state.threats.system_incidents.len(), 1);
        let current = &state.threats.system_incidents[0];
        assert!(current.acknowledged);
        assert_eq!(current.ai_analysis.as_deref(), Some("analyse"));
        assert!(current.detected_at > incident.detected_at);
        assert_eq!(state.security_attention_counts().0, 0);
    }

    fn firewall_incident() -> crate::dto::GuiSystemIncident {
        crate::dto::GuiSystemIncident {
            incident_type: "firewall_disabled".into(),
            severity: crate::dto::Severity::High,
            title: "Pare-feu désactivé".into(),
            description: "Profil public".into(),
            confidence: 90,
            detected_at: chrono::Utc::now(),
            ai_confidence: None,
            is_false_positive: None,
            ai_analysis: None,
            acknowledged: false,
            allowlisted: false,
        }
    }

    #[test]
    fn condition_back_after_a_long_absence_returns_to_triage() {
        let mut state = AppState::default();
        let incident = firewall_incident();
        state.apply_event(AgentEvent::SystemIncident {
            incident: incident.clone(),
        });
        state.acknowledge_threat_item("system", 0);
        let mut back = incident;
        back.detected_at += chrono::Duration::hours(2);
        state.apply_event(AgentEvent::SystemIncident { incident: back });
        assert_eq!(state.threats.system_incidents.len(), 1);
        assert!(!state.threats.system_incidents[0].acknowledged);
        assert!(state.acknowledged_event_keys.is_empty());
    }

    #[test]
    fn system_incident_authorization_covers_type_and_is_revocable() {
        let mut state = AppState::default();
        state.apply_event(AgentEvent::SystemIncident {
            incident: firewall_incident(),
        });
        let id = state.add_allowlist_rule_global(
            crate::dto::AllowlistRuleType::SystemIncident,
            "firewall_disabled".into(),
            "Poste de laboratoire".into(),
            "Test".into(),
        );
        assert!(state.threats.system_incidents[0].allowlisted);
        assert_eq!(state.security_attention_counts().0, 0);
        state.threats.remove_allowlist_rule(id);
        state.refresh_authorizations();
        assert!(!state.threats.system_incidents[0].allowlisted);
    }

    #[test]
    fn every_rule_change_is_pushed_once_to_the_agent_core() {
        let mut state = AppState::default();
        // Initial state is always pushed so the core never keeps stale rules.
        assert!(matches!(
            state.threats.take_allowlist_sync(),
            Some(crate::events::GuiCommand::UpdateAllowlist { rules }) if rules.is_empty()
        ));
        assert!(state.threats.take_allowlist_sync().is_none());
        let id = state.add_allowlist_rule_global(
            crate::dto::AllowlistRuleType::ProcessPattern,
            "backup-*".into(),
            "Sauvegarde".into(),
            "Test".into(),
        );
        assert!(matches!(
            state.threats.take_allowlist_sync(),
            Some(crate::events::GuiCommand::UpdateAllowlist { rules }) if rules.len() == 1
        ));
        // Telemetry refreshes do not resend the rules.
        state.refresh_authorizations();
        assert!(state.threats.take_allowlist_sync().is_none());
        state.threats.remove_allowlist_rule(id);
        assert!(matches!(
            state.threats.take_allowlist_sync(),
            Some(crate::events::GuiCommand::UpdateAllowlist { rules }) if rules.is_empty()
        ));
    }

    #[test]
    fn process_authorization_covers_new_detections_of_the_pattern() {
        let mut state = AppState::default();
        state.add_allowlist_rule_global(
            crate::dto::AllowlistRuleType::ProcessPattern,
            "example".into(),
            "Outil interne".into(),
            "Test".into(),
        );
        let mut later = process();
        later.pid = 777;
        state.apply_event(AgentEvent::SuspiciousProcess { process: later });
        assert!(state.threats.suspicious_processes[0].allowlisted);
        assert_eq!(state.security_attention_counts().0, 0);
    }

    #[test]
    fn network_authorization_never_matches_the_local_address() {
        let mut state = AppState::default();
        state.add_allowlist_rule_global(
            crate::dto::AllowlistRuleType::IpAddress,
            "192.168.1.10".into(),
            "Poste local".into(),
            "Test".into(),
        );
        let alert = |remote: &str| crate::dto::GuiNetworkAlert {
            alert_type: "c2".into(),
            severity: crate::dto::Severity::Critical,
            description: "test".into(),
            source_ip: Some("192.168.1.10".into()),
            destination_ip: Some(remote.into()),
            destination_port: Some(443),
            confidence: 90,
            detected_at: chrono::Utc::now(),
            ai_confidence: None,
            is_false_positive: None,
            ai_analysis: None,
            acknowledged: false,
            allowlisted: false,
        };
        state.apply_event(AgentEvent::NetworkSecurityAlert {
            alert: alert("203.0.113.5"),
        });
        assert!(!state.network.alerts[0].allowlisted);
        state.add_allowlist_rule_global(
            crate::dto::AllowlistRuleType::IpAddress,
            "203.0.113.0/24".into(),
            "Partenaire".into(),
            "Test".into(),
        );
        assert!(state.network.alerts[0].allowlisted);
    }

    #[test]
    fn ai_result_follows_identity_after_new_event_and_triage() {
        let event = process();
        let target = event_identity("process", &event);
        let mut state = AppState::default();
        state.apply_event(AgentEvent::SuspiciousProcess {
            process: event.clone(),
        });
        state.acknowledge_threat_item("process", 0);
        let mut other = event;
        other.pid += 1;
        state.apply_event(AgentEvent::SuspiciousProcess { process: other });
        state.apply_event(AgentEvent::LlmAnalysisComplete {
            target,
            analysis: "Result for original event".into(),
            severity_override: None,
            confidence: Some(80),
            is_false_positive: Some(false),
            ai_remediation_script: None,
            ai_remediation_explanation: None,
        });
        assert!(state.threats.suspicious_processes[0].ai_analysis.is_none());
        assert_eq!(
            state.threats.suspicious_processes[1].ai_analysis.as_deref(),
            Some("Result for original event")
        );
        assert!(state.threats.suspicious_processes[1].acknowledged);
    }

    #[test]
    fn vulnerability_analysis_stays_with_selected_software_after_reordering() {
        let finding: crate::dto::GuiVulnerabilityFinding = serde_json::from_value(serde_json::json!({
            "cve_id": "CVE-test", "affected_software": "package-a", "affected_version": "1",
            "severity": "high", "cvss_score": null, "description": "test", "fix_available": false,
            "discovered_at": null, "source": "test"
        })).unwrap();
        let target = vulnerability_identity(&finding);
        let mut other = finding.clone();
        other.affected_software = "package-b".into();
        let mut state = AppState {
            vulnerability_findings: vec![other, finding],
            ..Default::default()
        };
        state.apply_event(AgentEvent::LlmAnalysisComplete {
            target,
            analysis: "Only package-a".into(),
            severity_override: None,
            confidence: None,
            is_false_positive: None,
            ai_remediation_script: None,
            ai_remediation_explanation: None,
        });
        assert!(state.vulnerability_findings[0].ai_analysis.is_none());
        assert_eq!(
            state.vulnerability_findings[1].ai_analysis.as_deref(),
            Some("Only package-a")
        );
        assert!(state.vulnerability_findings[1].ai_confidence.is_none());
    }

    #[test]
    fn fim_acknowledgment_uses_event_content_not_recreated_display_uuid() {
        let mut event: crate::dto::GuiFimAlert = serde_json::from_value(serde_json::json!({
            "id": "first-ui-id", "path": "/tmp/test", "change_type": "modified",
            "old_hash": "old", "new_hash": "new", "timestamp": "2026-09-27T10:00:00Z",
            "acknowledged": false
        }))
        .unwrap();
        let mut state = AppState::default();
        state.apply_event(AgentEvent::FimAlert {
            alert: event.clone(),
        });
        state.acknowledge_threat_item("fim", 0);
        let prefs = GuiPreferences::from_state(&state);
        let mut restarted = AppState::default();
        prefs.apply_to(&mut restarted);
        event.id = "new-ui-id".into();
        restarted.apply_event(AgentEvent::FimAlert { alert: event });
        assert!(restarted.fim.alerts[0].acknowledged);
    }

    #[test]
    fn old_preferences_remain_compatible_and_history_is_bounded() {
        let old: GuiPreferences = serde_json::from_str("{}").unwrap();
        assert!(old.acknowledged_event_keys.is_empty());
        let state = AppState {
            acknowledged_event_keys: (0..3000).map(|n| n.to_string()).collect(),
            ..Default::default()
        };
        let prefs = GuiPreferences::from_state(&state);
        assert_eq!(prefs.acknowledged_event_keys.len(), 2000);
        assert_eq!(prefs.acknowledged_event_keys.front().unwrap(), "1000");
    }
}

#[cfg(test)]
mod opaque_grc_identity_tests {
    use super::*;
    use crate::dto::*;
    use crate::events::AgentEvent;
    #[test]
    fn remote_risk_id_and_updates_survive_gui_and_json() {
        let now = chrono::Utc::now();
        let risk = RiskEntry {
            id: "firestore-risk-opaque".into(),
            title: "initial".into(),
            description: String::new(),
            probability: 2,
            impact: 3,
            owner: String::new(),
            status: RiskStatus::Open,
            mitigation: String::new(),
            source: "platform".into(),
            created_at: now,
            updated_at: now,
            sla_target_days: Some(0),
        };
        let mut state = AppState::default();
        state.apply_event(AgentEvent::RisksLoaded {
            risks: vec![risk.clone()],
        });
        let mut updated = risk;
        updated.title = "updated".into();
        updated.impact = 5;
        state.apply_event(AgentEvent::RisksLoaded {
            risks: vec![updated],
        });
        assert_eq!(state.risks.entries.len(), 1);
        assert_eq!(state.risks.entries[0].title, "updated");
        let reloaded: RiskEntry =
            serde_json::from_str(&serde_json::to_string(&state.risks.entries[0]).unwrap()).unwrap();
        assert_eq!(reloaded.id, "firestore-risk-opaque");
        assert_eq!(reloaded.impact, 5);
        state.risks.selected_risk = Some(0);
        state.apply_event(AgentEvent::RisksSnapshot { risks: vec![] });
        assert!(state.risks.entries.is_empty());
        assert!(state.risks.selected_risk.is_none());
    }
    #[test]
    fn alert_snapshot_keeps_opaque_ids_then_clears_deleted_objects() {
        let mut state = AppState::default();
        state.apply_event(AgentEvent::AlertingLoaded {
            rules: vec![AlertRule {
                id: "opaque-rule".into(),
                name: "rule".into(),
                rule_type: AlertRuleType::SeverityThreshold,
                severity_threshold: Some(Severity::Info),
                detection_types: vec![],
                escalation_minutes: Some(0),
                enabled: false,
                created_at: chrono::Utc::now(),
            }],
            webhooks: vec![WebhookConfig {
                id: "opaque-hook".into(),
                name: "hook".into(),
                url: "https://example.test".into(),
                format: "generic".into(),
                enabled: false,
                last_sent: None,
                error: None,
            }],
        });
        assert_eq!(state.alerting.rules[0].id, "opaque-rule");
        assert_eq!(state.alerting.webhooks[0].id, "opaque-hook");
        state.apply_event(AgentEvent::AlertingLoaded {
            rules: vec![],
            webhooks: vec![],
        });
        assert!(state.alerting.rules.is_empty());
        assert!(state.alerting.webhooks.is_empty());
    }
}
