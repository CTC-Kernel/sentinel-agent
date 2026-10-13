// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! File integrity stage of the main loop: the alerts of the FIM engine are
//! read on every pass (security-critical even when paused), shown, handed to
//! the threat pipeline and sent in one batch.

use agent_common::constants::AGENT_VERSION;
use agent_common::types::{FimAlert, FimChangeType, FimDetection};
#[cfg(feature = "gui")]
use agent_gui::dto::{FimChangeType as GuiFimChangeType, GuiFimAlert};
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
use agent_scanner::SecurityIncident;
use tracing::{error, info, warn};

use super::outbox::Outbound;
use super::{LoopPass, LoopState};
use crate::{AgentRuntime, api_client, siem_enrichment, threat_intel_feeds, yara_scan};

/// File changes of one pass, collected first and sent together: one request
/// per alert runs into the platform's rate limit (429).
#[derive(Default)]
pub(crate) struct FimBatch {
    /// Structured alerts for the platform.
    pub payloads: Vec<agent_sync::types::FimAlertPayload>,
    /// Files created or changed, to scan with the YARA rules.
    pub yara_candidates: Vec<String>,
    /// The same files with their SHA-256, to compare with the indicator feeds.
    pub hash_candidates: Vec<(String, String)>,
    /// One incident report per alert, summarized when there are several.
    pub reports: Vec<api_client::SecurityIncidentReport>,
    /// Changes made while the agent was stopped, found at this start.
    pub found_at_start: u32,
}

/// The incident reported to the platform for one file change.
fn fim_incident_report(alert: &FimAlert) -> api_client::SecurityIncidentReport {
    api_client::SecurityIncidentReport {
        incident_type: api_client::IncidentType::UnauthorizedChange,
        // A file opened to more accounts (write bit for all, set-user-ID,
        // another owner) is a step of an attack more often than an edit is.
        severity: if alert.widens_access() {
            api_client::Severity::High
        } else {
            api_client::Severity::Medium
        },
        title: format!("File Integrity Alert: {}", alert.path.display()),
        description: alert.description(),
        evidence: serde_json::json!({
            "path": alert.path,
            "change_type": alert.change,
            "old_hash": alert.old_hash,
            "new_hash": alert.new_hash,
            "timestamp": alert.timestamp,
            "details": alert.details(),
        }),
        confidence: 100,
        detected_at: chrono::Utc::now().to_rfc3339(),
    }
}

/// One incident for the whole batch: the report of the change when it is
/// alone, a count of the changes otherwise.
fn fim_summary_report(
    reports: Vec<api_client::SecurityIncidentReport>,
) -> Option<api_client::SecurityIncidentReport> {
    match reports.len() {
        0 => None,
        1 => reports.into_iter().next(),
        count => Some(api_client::SecurityIncidentReport {
            incident_type: api_client::IncidentType::UnauthorizedChange,
            severity: api_client::Severity::Medium,
            title: format!("File Integrity Alert: {} files changed", count),
            description: format!("{} file integrity changes detected in this cycle.", count),
            evidence: serde_json::json!({
                "change_count": count,
            }),
            confidence: 100,
            detected_at: chrono::Utc::now().to_rfc3339(),
        }),
    }
}

/// Whether the change left content on disk that the YARA rules can scan.
fn is_yara_candidate(change: &FimChangeType) -> bool {
    matches!(
        change,
        FimChangeType::Created | FimChangeType::Modified | FimChangeType::Renamed
    )
}

/// The SIEM event recorded for one file change.
fn fim_siem_event(alert: &FimAlert, description: String) -> agent_siem::SiemEvent {
    agent_siem::SiemEvent {
        timestamp: chrono::Utc::now(),
        severity: if alert.widens_access() { 8 } else { 5 },
        category: agent_siem::EventCategory::FileIntegrity,
        name: "File Integrity Change".to_string(),
        description,
        source_host: hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_default(),
        source_ip: None,
        destination_ip: None,
        destination_port: None,
        user: None,
        process_name: None,
        process_id: None,
        file_path: Some(alert.path.to_string_lossy().to_string()),
        custom_fields: alert.details(),
        event_id: uuid::Uuid::new_v4().to_string(),
        agent_version: AGENT_VERSION.to_string(),
    }
}

#[cfg(feature = "gui")]
fn gui_change_type(change: &FimChangeType) -> GuiFimChangeType {
    match change {
        FimChangeType::Created => GuiFimChangeType::Created,
        FimChangeType::Modified => GuiFimChangeType::Modified,
        FimChangeType::Deleted => GuiFimChangeType::Deleted,
        FimChangeType::PermissionChanged => GuiFimChangeType::PermissionChanged,
        FimChangeType::Renamed => GuiFimChangeType::Renamed,
    }
}

/// The alert as the interface shows it.
#[cfg(feature = "gui")]
fn gui_alert(alert: &FimAlert) -> GuiFimAlert {
    GuiFimAlert {
        id: uuid::Uuid::new_v4().to_string(),
        path: alert.path.to_string_lossy().to_string(),
        change_type: gui_change_type(&alert.change),
        old_hash: alert.old_hash.clone(),
        new_hash: alert.new_hash.clone(),
        timestamp: alert.timestamp,
        acknowledged: false,
        allowlisted: false,
        detection: alert.detection,
        sha256: alert.new_sha256.clone(),
        detail: crate::gui_bridge::fim_change_detail(alert),
        diff: alert.diff.clone(),
        actor: alert.actor.as_ref().map(|actor| {
            if actor.exact {
                actor.label()
            } else {
                format!("{} (probable)", actor.label())
            }
        }),
    }
}

/// Day number (UTC) used to restart the daily count of file changes.
#[cfg(feature = "gui")]
fn today() -> u64 {
    chrono::Utc::now().timestamp().max(0) as u64 / agent_common::constants::SECS_PER_DAY
}

#[cfg(feature = "gui")]
impl super::state::GuiLoopState {
    /// Restart the daily count of file changes when the day changed.
    pub(crate) fn roll_fim_day(&mut self, today: u64) {
        if today != self.fim_last_day {
            self.fim_changes_today = 0;
            self.fim_last_day = today;
        }
    }
}

impl AgentRuntime {
    /// Read every pending alert of the FIM engine: interface, threat
    /// pipeline of this pass, SIEM. What must be uploaded is returned as a
    /// batch.
    pub(crate) async fn drain_fim_alerts(
        &self,
        st: &mut LoopState,
        pass: &mut LoopPass,
    ) -> FimBatch {
        let mut batch = FimBatch::default();
        let mut rx_guard = self.fim_rx.lock().await;
        if let Some(rx) = rx_guard.as_mut() {
            while let Ok(alert) = rx.try_recv() {
                self.handle_fim_alert(st, pass, &mut batch, alert).await;
            }
        }
        self.announce_changes_found_at_start(batch.found_at_start);
        batch
    }

    /// Say once, in the log and in the interface, how many watched files
    /// changed while the agent was not running.
    fn announce_changes_found_at_start(&self, count: u32) {
        if count == 0 {
            return;
        }
        warn!(
            "FIM: {} watched file(s) changed while the agent was not running",
            count
        );
        #[cfg(feature = "gui")]
        self.emit_notification(
            "Fichiers modifiés pendant l'arrêt de l'agent",
            &format!(
                "{count} fichier(s) surveillé(s) ont changé alors que \
                 l'agent ne tournait pas. Détail dans Intégrité des fichiers."
            ),
            "warning",
        );
    }

    /// One file change: interface, threat pipeline of this pass, batch to
    /// upload, SIEM.
    #[cfg_attr(not(feature = "gui"), allow(unused_variables))]
    async fn handle_fim_alert(
        &self,
        st: &mut LoopState,
        pass: &mut LoopPass,
        batch: &mut FimBatch,
        mut alert: FimAlert,
    ) {
        info!("FIM Alert: {:?} on {}", alert.change, alert.path.display());
        // Who changed the file, when the audit or a process start says so.
        alert.actor = self
            .fim_attribution
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .actor_for(&alert.path.to_string_lossy(), std::time::Instant::now());
        if alert.detection == FimDetection::Startup {
            batch.found_at_start = batch.found_at_start.saturating_add(1);
        }

        let report = fim_incident_report(&alert);

        #[cfg(feature = "gui")]
        {
            self.emit_gui_event(AgentEvent::FimAlert {
                alert: gui_alert(&alert),
            });
            st.gui.roll_fim_day(today());
            st.gui.fim_changes_today = st.gui.fim_changes_today.saturating_add(1);
        }

        pass.fim_alerts.push((
            alert.path.to_string_lossy().to_string(),
            format!("{}", alert.change),
        ));
        if is_yara_candidate(&alert.change) {
            let path = alert.path.to_string_lossy().to_string();
            if let Some(sha256) = &alert.new_sha256 {
                batch.hash_candidates.push((path.clone(), sha256.clone()));
            }
            batch.yara_candidates.push(path);
        }

        // Collect for batched uploads (avoid per-alert HTTP requests → 429)
        batch
            .payloads
            .push(agent_sync::types::FimAlertPayload::from(alert.clone()));

        // Forward to SIEM (always record for platform, optionally send to
        // external): queued, the AI classification of each event is slow
        let siem_description = report.description.clone();
        batch.reports.push(report);
        self.outbox
            .push(Outbound::SiemFileChange {
                alert: Box::new(alert),
                description: siem_description,
            })
            .await;
    }

    /// Record the file change for the platform's SIEM tab and, when an
    /// external SIEM is configured, forward it there.
    pub(crate) async fn record_fim_alert_in_siem(&self, alert: &FimAlert, description: String) {
        let siem_guard = self.siem_forwarder.read().await;
        if let Some(siem) = siem_guard.as_ref() {
            let mut event = fim_siem_event(alert, description);

            // Enrich with AI classification before forwarding
            #[cfg(feature = "llm")]
            {
                if let Some(ref llm_svc) = self.llm_service {
                    siem_enrichment::enrich_siem_event(&mut event, llm_svc).await;
                }
            }
            #[cfg(not(feature = "llm"))]
            {
                siem_enrichment::enrich_siem_event(&mut event).await;
            }

            // Always record for platform SIEM tab
            siem.record_event(event.clone()).await;

            // Optionally forward to external SIEM
            if siem.is_enabled()
                && let Err(e) = siem.send_event(&event).await
            {
                warn!("Failed to forward FIM event to external SIEM: {}", e);
            }
        }
    }

    /// Report the files matched by a YARA rule: platform, interface, then
    /// the threat pipeline of this pass, as an incident and a file change.
    pub(crate) async fn report_yara_matches(
        &self,
        pass: &mut LoopPass,
        matched: Vec<(String, SecurityIncident)>,
    ) {
        for (path, incident) in matched {
            warn!("{}: {}", incident.title, path);
            self.queue_incident(&incident, "YARA incident").await;
            #[cfg(feature = "gui")]
            {
                self.emit_system_incident(&incident);
                self.emit_notification(
                    "Fichier malveillant détecté (YARA)",
                    &incident.description,
                    "error",
                );
                pass.kpi_incident_count = pass.kpi_incident_count.saturating_add(1);
            }
            pass.fim_alerts
                .push((path, yara_scan::PLAYBOOK_CHANGE_TYPE.to_string()));
            pass.incidents.push(incident);
        }
    }

    /// Report the files just created or changed whose SHA-256 an indicator
    /// feed lists as malicious: platform, interface, then the threat
    /// pipeline of this pass, as an incident and a file change.
    pub(crate) async fn match_changed_files_with_feeds(
        &self,
        pass: &mut LoopPass,
        candidates: &[(String, String)],
    ) {
        if candidates.is_empty() {
            return;
        }
        let listed = self.malicious_file_hashes.read().await.clone();
        for (path, sha256) in candidates {
            if !listed.contains(sha256) {
                continue;
            }
            let incident = threat_intel_feeds::known_malware_incident(path, sha256);
            warn!("{}", incident.title);
            self.queue_incident(&incident, "known malware incident")
                .await;
            #[cfg(feature = "gui")]
            {
                self.emit_system_incident(&incident);
                self.emit_notification(
                    "Fichier malveillant connu détecté",
                    &incident.description,
                    "error",
                );
                pass.kpi_incident_count = pass.kpi_incident_count.saturating_add(1);
            }
            pass.fim_alerts.push((
                path.clone(),
                threat_intel_feeds::PLAYBOOK_CHANGE_TYPE.to_string(),
            ));
            pass.incidents.push(incident);
        }
    }

    /// Scan the files just created or changed with the YARA rules.
    pub(crate) async fn scan_changed_files_with_yara(
        &self,
        pass: &mut LoopPass,
        candidates: &[String],
    ) {
        if !candidates.is_empty() && self.yara_enabled() {
            let matched = tokio::task::block_in_place(|| self.yara_scan_files(candidates));
            self.report_yara_matches(pass, matched).await;
        }
    }

    /// Queue the file changes of the pass for upload, when there are any.
    pub(crate) async fn queue_fim_batch(&self, batch: FimBatch) {
        if !batch.payloads.is_empty() {
            self.outbox.push(Outbound::FimBatch(batch)).await;
        }
    }

    /// Upload the file changes of the pass in one request, and report one
    /// summary incident instead of one per change.
    pub(crate) async fn upload_fim_batch(&self, batch: FimBatch) {
        if !batch.payloads.is_empty() {
            let count = batch.payloads.len();

            // Upload structured FIM alerts (batched)
            if let Some(ref auth_client) = self.authenticated_client
                && let Err(e) = auth_client.upload_fim_alerts(batch.payloads).await
            {
                warn!("Failed to upload {} FIM alert(s) to SaaS: {}", count, e);
            }

            // Report a single summary incident instead of one per file change
            if let Some(client) = self.api_client.read().await.as_ref()
                && let Some(summary) = fim_summary_report(batch.reports)
                && let Err(e) = client.report_incident(summary).await
            {
                error!("Failed to report FIM incident summary to SaaS: {}", e);
            }
        }
    }

    /// Tell the interface how many files are watched and how many changed
    /// today.
    #[cfg(feature = "gui")]
    pub(crate) async fn emit_fim_stats(&self, st: &mut LoopState) {
        let fim_engine = self.fim_engine.read().await;
        if let Some(engine) = fim_engine.as_ref() {
            st.gui.roll_fim_day(today());
            self.emit_gui_event(AgentEvent::FimStats {
                monitored_count: u32::try_from(engine.baseline_count()).unwrap_or(u32::MAX),
                changes_today: st.gui.fim_changes_today,
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::standalone_runtime;
    use std::path::PathBuf;
    use std::time::Instant;

    fn alert(path: &str, change: FimChangeType) -> FimAlert {
        FimAlert {
            old_hash: Some("aa11".to_string()),
            new_hash: Some("bb22".to_string()),
            new_size: Some(128),
            ..FimAlert::new(PathBuf::from(path), change, FimDetection::Realtime)
        }
    }

    #[test]
    fn a_file_change_is_reported_as_an_unauthorized_change() {
        let report = fim_incident_report(&alert("/etc/hosts", FimChangeType::Modified));
        assert_eq!(report.title, "File Integrity Alert: /etc/hosts");
        assert_eq!(report.description, "File /etc/hosts was modified.");
        assert_eq!(report.confidence, 100);
        assert_eq!(report.evidence["old_hash"], "aa11");
        assert_eq!(report.evidence["new_hash"], "bb22");
        assert_eq!(report.evidence["details"]["detection"], "realtime");
    }

    /// A file opened to every account weighs more than an edit, for the
    /// platform and for the SIEM.
    #[test]
    fn a_change_that_widens_access_is_reported_higher() {
        let mut widened = alert("/etc/cron.d/job", FimChangeType::PermissionChanged);
        widened.old_permissions = Some(0o100644);
        widened.new_permissions = Some(0o100666);

        let report = fim_incident_report(&widened);
        assert!(matches!(report.severity, api_client::Severity::High));
        assert_eq!(
            report.description,
            "File /etc/cron.d/job had its permissions or owner changed \
             (permissions 644 -> 666)."
        );
        assert_eq!(fim_siem_event(&widened, String::new()).severity, 8);

        let edited = alert("/etc/hosts", FimChangeType::Modified);
        assert!(matches!(
            fim_incident_report(&edited).severity,
            api_client::Severity::Medium
        ));
    }

    #[test]
    fn a_single_change_is_reported_as_itself() {
        let report = fim_incident_report(&alert("/etc/hosts", FimChangeType::Modified));
        let summary = fim_summary_report(vec![report]).unwrap();
        assert_eq!(summary.title, "File Integrity Alert: /etc/hosts");
    }

    #[test]
    fn several_changes_are_reported_as_one_count() {
        let reports = ["/etc/hosts", "/etc/passwd", "/etc/shadow"]
            .iter()
            .map(|path| fim_incident_report(&alert(path, FimChangeType::Modified)))
            .collect();
        let summary = fim_summary_report(reports).unwrap();
        assert_eq!(summary.title, "File Integrity Alert: 3 files changed");
        assert_eq!(
            summary.description,
            "3 file integrity changes detected in this cycle."
        );
        assert_eq!(summary.evidence["change_count"], 3);
    }

    #[test]
    fn no_change_means_no_summary() {
        assert!(fim_summary_report(Vec::new()).is_none());
    }

    #[tokio::test]
    async fn only_a_batch_with_changes_is_queued() {
        let test = standalone_runtime();
        test.runtime.queue_fim_batch(FimBatch::default()).await;
        assert_eq!(test.runtime.outbox.unsent(), 0);

        let changed = alert("/etc/hosts", FimChangeType::Modified);
        let batch = FimBatch {
            payloads: vec![agent_sync::types::FimAlertPayload::from(changed.clone())],
            reports: vec![fim_incident_report(&changed)],
            ..FimBatch::default()
        };
        test.runtime.queue_fim_batch(batch).await;
        match test.runtime.outbox.take_queued().await.as_slice() {
            [Outbound::FimBatch(batch)] => assert_eq!(batch.payloads.len(), 1),
            other => panic!("expected the batch, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn an_empty_batch_is_not_uploaded() {
        let test = standalone_runtime();
        // Standalone: no client at all, the call must simply return.
        test.runtime.upload_fim_batch(FimBatch::default()).await;
    }

    #[test]
    fn only_changes_that_leave_content_are_scanned_with_yara() {
        assert!(is_yara_candidate(&FimChangeType::Created));
        assert!(is_yara_candidate(&FimChangeType::Modified));
        assert!(is_yara_candidate(&FimChangeType::Renamed));
        assert!(!is_yara_candidate(&FimChangeType::Deleted));
        assert!(!is_yara_candidate(&FimChangeType::PermissionChanged));
    }

    #[test]
    fn the_siem_event_names_the_file() {
        let event = fim_siem_event(
            &alert("/etc/sudoers", FimChangeType::Modified),
            "File /etc/sudoers was modified.".to_string(),
        );
        assert_eq!(event.severity, 5);
        assert_eq!(event.name, "File Integrity Change");
        assert_eq!(event.description, "File /etc/sudoers was modified.");
        assert_eq!(event.file_path.as_deref(), Some("/etc/sudoers"));
        assert_eq!(event.agent_version, AGENT_VERSION);
    }

    #[cfg(feature = "gui")]
    #[test]
    fn the_daily_count_restarts_on_a_new_day() {
        let mut st = LoopState::starting_at(Instant::now(), 3600, 3600);
        st.gui.fim_last_day = 20_000;
        st.gui.fim_changes_today = 12;

        st.gui.roll_fim_day(20_000);
        assert_eq!(st.gui.fim_changes_today, 12);

        st.gui.roll_fim_day(20_001);
        assert_eq!(st.gui.fim_changes_today, 0);
        assert_eq!(st.gui.fim_last_day, 20_001);
    }

    #[tokio::test]
    async fn pending_alerts_are_drained_into_the_pass_and_the_batch() {
        let test = standalone_runtime();
        test.runtime.init_siem_forwarder().await;
        let (tx, rx) = tokio::sync::mpsc::channel(8);
        *test.runtime.fim_rx.lock().await = Some(rx);
        tx.send(alert("/etc/hosts", FimChangeType::Modified))
            .await
            .unwrap();
        tx.send(alert("/etc/old.conf", FimChangeType::Deleted))
            .await
            .unwrap();
        let mut st = LoopState::starting_at(Instant::now(), 3600, 3600);
        let mut pass = LoopPass::new(true);

        let batch = test.runtime.drain_fim_alerts(&mut st, &mut pass).await;

        assert_eq!(
            pass.fim_alerts,
            vec![
                ("/etc/hosts".to_string(), "modified".to_string()),
                ("/etc/old.conf".to_string(), "deleted".to_string()),
            ]
        );
        assert_eq!(batch.yara_candidates, vec!["/etc/hosts".to_string()]);
        assert_eq!(batch.payloads.len(), 2);
        assert_eq!(batch.reports.len(), 2);
        // Both changes are queued for the SIEM, and kept for the platform's
        // SIEM tab once the queue is sent.
        let queued = test.runtime.outbox.take_queued().await;
        assert!(matches!(
            queued.as_slice(),
            [
                Outbound::SiemFileChange { .. },
                Outbound::SiemFileChange { .. }
            ]
        ));
        for item in queued {
            test.runtime.send_outbound(item).await;
        }
        let siem = test.runtime.siem_forwarder.read().await;
        let recorded = siem.as_ref().unwrap().take_recent_events().await;
        assert_eq!(recorded.len(), 2);
        assert_eq!(recorded[0].file_path.as_deref(), Some("/etc/hosts"));
        drop(siem);
        #[cfg(feature = "gui")]
        assert_eq!(st.gui.fim_changes_today, 2);
        // Nothing is left for the next pass.
        let again = test.runtime.drain_fim_alerts(&mut st, &mut pass).await;
        assert!(again.payloads.is_empty());
    }

    #[tokio::test]
    async fn a_yara_match_reaches_the_pipeline_as_incident_and_file_change() {
        let test = standalone_runtime();
        let mut pass = LoopPass::new(false);
        let incident = SecurityIncident {
            incident_type: agent_scanner::IncidentType::Malware,
            severity: agent_scanner::IncidentSeverity::Critical,
            title: "Règle YARA : Ransom_Note".to_string(),
            description: "/tmp/README_DECRYPT.txt correspond à Ransom_Note".to_string(),
            evidence: serde_json::json!({ "rule": "Ransom_Note" }),
            confidence: 90,
            detected_at: chrono::Utc::now(),
        };

        test.runtime
            .report_yara_matches(
                &mut pass,
                vec![("/tmp/README_DECRYPT.txt".to_string(), incident)],
            )
            .await;

        assert_eq!(pass.incidents.len(), 1);
        assert_eq!(
            pass.fim_alerts,
            vec![(
                "/tmp/README_DECRYPT.txt".to_string(),
                yara_scan::PLAYBOOK_CHANGE_TYPE.to_string()
            )]
        );
        #[cfg(feature = "gui")]
        {
            assert_eq!(pass.kpi_incident_count, 1);
            assert!(matches!(
                test.events.try_recv(),
                Ok(AgentEvent::SystemIncident { .. })
            ));
            match test.events.try_recv() {
                Ok(AgentEvent::Notification { notification }) => {
                    assert_eq!(notification.title, "Fichier malveillant détecté (YARA)");
                }
                other => panic!("expected a notification, got {:?}", other.map(|_| ())),
            }
        }
    }

    #[tokio::test]
    async fn a_changed_file_listed_by_a_feed_reaches_the_pipeline_as_known_malware() {
        let test = standalone_runtime();
        let mut pass = LoopPass::new(false);
        *test.runtime.malicious_file_hashes.write().await =
            std::sync::Arc::new(["ab12".to_string()].into());

        test.runtime
            .match_changed_files_with_feeds(
                &mut pass,
                &[
                    ("/tmp/dropper".to_string(), "ab12".to_string()),
                    ("/etc/hosts".to_string(), "cd34".to_string()),
                ],
            )
            .await;

        assert_eq!(pass.incidents.len(), 1);
        assert_eq!(
            pass.fim_alerts,
            vec![(
                "/tmp/dropper".to_string(),
                threat_intel_feeds::PLAYBOOK_CHANGE_TYPE.to_string()
            )]
        );
        match test.runtime.outbox.take_queued().await.as_slice() {
            [Outbound::Incident { what, .. }] => assert_eq!(*what, "known malware incident"),
            other => panic!("expected one queued incident, got {other:?}"),
        }
        #[cfg(feature = "gui")]
        assert_eq!(pass.kpi_incident_count, 1);
    }

    #[tokio::test]
    async fn a_change_found_at_start_is_counted_and_its_hash_kept_for_the_feeds() {
        let test = standalone_runtime();
        let (tx, rx) = tokio::sync::mpsc::channel(8);
        *test.runtime.fim_rx.lock().await = Some(rx);
        let mut found = alert("/etc/hosts", FimChangeType::Modified);
        found.detection = FimDetection::Startup;
        found.new_sha256 = Some("ab12".to_string());
        tx.send(found).await.unwrap();
        // A deleted file leaves nothing to compare with the feeds.
        tx.send(alert("/etc/old.conf", FimChangeType::Deleted))
            .await
            .unwrap();
        let mut st = LoopState::starting_at(Instant::now(), 3600, 3600);
        let mut pass = LoopPass::new(false);

        let batch = test.runtime.drain_fim_alerts(&mut st, &mut pass).await;

        assert_eq!(batch.found_at_start, 1);
        assert_eq!(
            batch.hash_candidates,
            vec![("/etc/hosts".to_string(), "ab12".to_string())]
        );
        #[cfg(feature = "gui")]
        {
            let notified = std::iter::from_fn(|| test.events.try_recv().ok())
                .filter_map(|event| match event {
                    AgentEvent::Notification { notification } => Some(notification.title),
                    _ => None,
                })
                .collect::<Vec<_>>();
            assert_eq!(notified, ["Fichiers modifiés pendant l'arrêt de l'agent"]);
        }
    }

    #[tokio::test]
    async fn the_author_of_a_change_is_named_when_the_audit_gave_one() {
        let test = standalone_runtime();
        test.runtime.fim_attribution.lock().unwrap().audited(
            "/etc/hosts",
            agent_common::types::FimActor {
                user: Some("alice".to_string()),
                process: Some("vim".to_string()),
                pid: Some(4242),
                command: None,
                exact: true,
                source: "audit".to_string(),
            },
            Instant::now(),
        );
        let (tx, rx) = tokio::sync::mpsc::channel(8);
        *test.runtime.fim_rx.lock().await = Some(rx);
        tx.send(alert("/etc/hosts", FimChangeType::Modified))
            .await
            .unwrap();
        let mut st = LoopState::starting_at(Instant::now(), 3600, 3600);
        let mut pass = LoopPass::new(false);

        let batch = test.runtime.drain_fim_alerts(&mut st, &mut pass).await;

        assert!(
            batch.reports[0].description.contains("By vim (alice)."),
            "{}",
            batch.reports[0].description
        );
    }

    #[tokio::test]
    async fn nothing_is_scanned_without_candidates_or_rules() {
        let test = standalone_runtime();
        let mut pass = LoopPass::new(false);

        test.runtime
            .scan_changed_files_with_yara(&mut pass, &[])
            .await;

        assert!(!pass.has_flagged_activity());
    }

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn fim_stats_count_the_changes_of_the_current_day_only() {
        let test = standalone_runtime();
        let (tx, _rx) = tokio::sync::mpsc::channel(1);
        *test.runtime.fim_engine.write().await = Some(agent_fim::FimEngine::with_defaults(tx));
        let mut st = LoopState::starting_at(Instant::now(), 3600, 3600);
        st.gui.fim_changes_today = 3;

        test.runtime.emit_fim_stats(&mut st).await;
        assert!(matches!(
            test.events.try_recv(),
            Ok(AgentEvent::FimStats {
                changes_today: 3,
                ..
            })
        ));

        // Yesterday's count is not carried over.
        st.gui.fim_last_day -= 1;
        test.runtime.emit_fim_stats(&mut st).await;
        assert!(matches!(
            test.events.try_recv(),
            Ok(AgentEvent::FimStats {
                changes_today: 0,
                ..
            })
        ));
    }

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn no_fim_stats_without_an_engine() {
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 3600, 3600);
        test.runtime.emit_fim_stats(&mut st).await;
        assert!(test.events.try_recv().is_err());
    }

    #[tokio::test]
    async fn without_a_fim_engine_the_batch_is_empty() {
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 3600, 3600);
        let mut pass = LoopPass::new(false);

        let batch = test.runtime.drain_fim_alerts(&mut st, &mut pass).await;

        assert!(batch.payloads.is_empty() && batch.yara_candidates.is_empty());
        assert!(pass.fim_alerts.is_empty());
    }
}
