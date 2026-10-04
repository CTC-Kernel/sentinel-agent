// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Vulnerability and security scanning operations.

use agent_common::error::CommonError;
use agent_scanner::{ScanType, SecurityScanResult, VulnerabilityScanResult, VulnerabilityScanner};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use super::AgentRuntime;
use crate::api_client::ApiClient;
use crate::vuln_upload;

/// Everything a vulnerability scan needs, detached from [`AgentRuntime`] so
/// the scan (package inventory, OSV lookups, AI analysis, uploads — minutes on
/// a large host) runs in its own task instead of blocking the main loop and
/// its heartbeats. The main loop holds the task handle and never starts a
/// second scan while one is running.
pub(crate) struct VulnScanJob {
    scanner: Arc<VulnerabilityScanner>,
    api_client: Arc<RwLock<Option<ApiClient>>>,
    state: Arc<crate::state::RuntimeState>,
    standalone: bool,
    #[cfg(feature = "llm")]
    llm: Option<Arc<crate::llm_service::LLMService>>,
    #[cfg(feature = "voice")]
    voice: Option<Arc<crate::voice::VoiceService>>,
    #[cfg(feature = "gui")]
    gui_event_tx: Option<std::sync::mpsc::Sender<agent_gui::events::AgentEvent>>,
}

impl AgentRuntime {
    /// Snapshot what a vulnerability scan needs so it can run in a task.
    pub(crate) fn vuln_scan_job(&self) -> VulnScanJob {
        VulnScanJob {
            scanner: Arc::clone(&self.vulnerability_scanner),
            api_client: Arc::clone(&self.api_client),
            state: Arc::clone(&self.state),
            standalone: self.config.standalone,
            #[cfg(feature = "llm")]
            llm: if self.config.llm.enabled {
                self.llm_service.clone()
            } else {
                None
            },
            #[cfg(feature = "voice")]
            voice: self.voice_service.clone(),
            #[cfg(feature = "gui")]
            gui_event_tx: self.gui_event_tx.clone(),
        }
    }
}

impl VulnScanJob {
    #[cfg(feature = "gui")]
    fn emit_sync_status(
        &self,
        last_sync_at: Option<chrono::DateTime<chrono::Utc>>,
        error: Option<String>,
    ) {
        if let Some(ref tx) = self.gui_event_tx
            && let Err(e) = tx.send(agent_gui::events::AgentEvent::SyncStatus {
                syncing: false,
                pending_count: 0,
                last_sync_at,
                error,
            })
        {
            warn!("Failed to emit GUI event: {}", e);
        }
    }

    /// Run a vulnerability scan, then upload findings and software inventory.
    pub(crate) async fn run(self) -> Result<VulnerabilityScanResult, CommonError> {
        info!("Starting vulnerability scan...");

        #[cfg(feature = "voice")]
        if let Some(voice) = &self.voice {
            voice.play_scan_sound();
        }

        let result = self
            .scanner
            .scan(ScanType::CveCheck)
            .await
            .map_err(|e| CommonError::internal(format!("Vulnerability scan failed: {}", e)))?;

        info!(
            "Vulnerability scan complete: {} findings from {} packages (complete: {})",
            result.vulnerabilities.len(),
            result.packages_scanned,
            result.is_complete()
        );

        // Cache results for AI analysis and GUI context
        {
            let mut cache = self.state.last_vuln_findings.write().await;
            *cache = Some(result.clone());
        }

        // Perform automated AI analysis for high/critical findings
        #[cfg(feature = "llm")]
        let mut result = result;
        #[cfg(feature = "llm")]
        if let Some(llm) = &self.llm {
            auto_analyze_vulnerabilities(llm, &mut result).await;
        }

        // Always report the scan, even without findings: an empty complete
        // scan is what lets the platform resolve fixed vulnerabilities.
        if let Err(e) = self.upload_vulnerabilities(&result).await {
            error!("Failed to upload vulnerability findings: {}", e);
        }

        self.upload_software_from_scan(&result).await;

        Ok(result)
    }

    /// Upload vulnerability findings to the server (paginated, see [`vuln_upload`]).
    async fn upload_vulnerabilities(
        &self,
        scan_result: &VulnerabilityScanResult,
    ) -> Result<(), CommonError> {
        if self.standalone {
            return Ok(());
        }
        // Clone the client so the lock is not held across retries/backoff.
        let client = self
            .api_client
            .read()
            .await
            .clone()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;
        let agent_id = client
            .agent_id()
            .ok_or_else(|| CommonError::config("Agent not enrolled"))?
            .to_string();

        let scan_id = uuid::Uuid::new_v4().to_string();
        let scan_complete = scan_result.is_complete();
        if !scan_complete {
            warn!(
                "Vulnerability scan {} is partial ({} errors): the platform will not resolve findings",
                scan_id,
                scan_result.errors.len()
            );
        }
        let pages = vuln_upload::build_pages(
            &scan_result.vulnerabilities,
            &scan_result.scan_type.to_string(),
            &scan_id,
            scan_complete,
        );
        let url = format!("/v1/agents/{}/vulnerabilities", agent_id);

        let sent = vuln_upload::send_pages(
            "Vulnerability",
            &pages,
            &vuln_upload::UPLOAD_BACKOFF,
            |page| vuln_upload::post_attempt(&client, &url, page),
        )
        .await;

        match sent {
            Ok(page_count) => {
                let items: usize = pages
                    .iter()
                    .filter_map(|p| p["vulnerabilities"].as_array().map(Vec::len))
                    .sum();
                info!(
                    "Uploaded vulnerability scan {}: {} findings in {} page(s), complete: {}",
                    scan_id, items, page_count, scan_complete
                );
                #[cfg(feature = "gui")]
                self.emit_sync_status(Some(chrono::Utc::now()), None);
                Ok(())
            }
            Err((sent_pages, e)) => {
                error!(
                    "Vulnerability upload of scan {} stopped after {}/{} pages: {}",
                    scan_id,
                    sent_pages,
                    pages.len(),
                    e
                );
                Err(CommonError::network(format!(
                    "Vulnerability upload failed: {}",
                    e
                )))
            }
        }
    }

    /// Upload software inventory from a vulnerability scan result.
    async fn upload_software_from_scan(&self, scan_result: &VulnerabilityScanResult) {
        if self.standalone {
            return;
        }
        if scan_result.packages.is_empty() {
            debug!("No packages to upload for software inventory");
            return;
        }

        let software: Vec<crate::api_client::SoftwareEntry> = scan_result
            .packages
            .iter()
            .map(|p| crate::api_client::SoftwareEntry {
                name: p.name.clone(),
                version: Some(p.version.clone()),
                vendor: p.publisher.clone(),
                source_name: p
                    .source_name
                    .as_deref()
                    .map(str::trim)
                    .filter(|source| !source.is_empty() && *source != p.name)
                    .map(str::to_string),
            })
            .collect();

        let Some(client) = self.api_client.read().await.clone() else {
            return;
        };
        match client.upload_software_inventory(&software).await {
            Ok(_) => {
                info!(
                    "Uploaded software inventory: {} packages",
                    software
                        .len()
                        .min(crate::api_client::MAX_SOFTWARE_ITEMS_PER_REQUEST)
                );
                #[cfg(feature = "gui")]
                self.emit_sync_status(Some(chrono::Utc::now()), None);
            }
            Err(e) => {
                warn!("Failed to upload software inventory: {}", e);
                #[cfg(feature = "gui")]
                self.emit_sync_status(None, Some(format!("Software upload failed: {}", e)));
            }
        }
    }
}

/// File name of an SBOM export: host name reduced to safe characters, and
/// the date.
#[cfg(any(feature = "gui", test))]
pub(crate) fn sbom_file_name(hostname: &str, date: chrono::NaiveDate) -> String {
    let host: String = hostname
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '-'
            }
        })
        .take(63)
        .collect();
    let host = host.trim_matches('-');
    let host = if host.is_empty() { "poste" } else { host };
    format!("sbom-{host}-{}.cdx.json", date.format("%Y-%m-%d"))
}

/// Write the CycloneDX SBOM of a vulnerability scan to the export folder
/// (the user's Desktop) and return its path.
#[cfg(feature = "gui")]
pub async fn export_sbom(
    scan: &VulnerabilityScanResult,
) -> Result<std::path::PathBuf, CommonError> {
    use agent_scanner::vulnerability::sbom;

    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_default();
    let now = chrono::Utc::now();
    let document = sbom::cyclonedx(
        scan,
        &sbom::SbomSubject {
            hostname: hostname.clone(),
            os: sysinfo::System::long_os_version(),
            agent_version: agent_common::constants::AGENT_VERSION.to_string(),
        },
        uuid::Uuid::new_v4(),
        now,
    );
    let path = agent_gui::export::default_export_path(&sbom_file_name(&hostname, now.date_naive()));
    let bytes = serde_json::to_vec_pretty(&document)
        .map_err(|e| CommonError::internal(format!("SBOM serialization failed: {e}")))?;
    tokio::fs::write(&path, bytes)
        .await
        .map_err(|e| CommonError::internal(format!("Cannot write {}: {e}", path.display())))?;
    info!("SBOM exported to {}", path.display());
    Ok(path)
}

/// Upper bound of automatic AI analyses after one vulnerability scan.
#[cfg(feature = "llm")]
const MAX_BACKGROUND_ANALYSES_PER_SCAN: usize = 5;

/// Order in which findings get an automatic AI analysis: patch priority,
/// then critical before the other severities.
#[cfg(any(feature = "llm", test))]
fn analysis_order(
    finding: &agent_scanner::VulnerabilityFinding,
) -> (agent_scanner::PatchPriority, bool) {
    (
        finding.priority,
        finding.severity != agent_scanner::Severity::Critical,
    )
}

/// Automatically analyze the findings to fix first (exploited, likely
/// exploited, high/critical) using the local LLM.
#[cfg(feature = "llm")]
async fn auto_analyze_vulnerabilities(
    llm: &crate::llm_service::LLMService,
    scan_result: &mut VulnerabilityScanResult,
) {
    use agent_scanner::PatchPriority;

    if !llm.is_available().await {
        debug!("LLM service not available for automated analysis");
        return;
    }

    info!("Starting automated AI analysis of high/critical findings...");

    // Background analysis is bounded: on a CPU-only endpoint each analysis
    // takes seconds, and the operator's questions always come first (the
    // engine pauses these requests while a question is being answered).
    // Findings to fix first are analysed first: known exploited, then likely
    // exploited, then critical before high.
    let mut candidates: Vec<usize> = scan_result
        .vulnerabilities
        .iter()
        .enumerate()
        .filter(|(_, finding)| {
            finding.priority <= PatchPriority::Planned && finding.ai_analysis.is_none()
        })
        .map(|(index, _)| index)
        .collect();
    candidates.sort_by_key(|&index| analysis_order(&scan_result.vulnerabilities[index]));
    candidates.truncate(MAX_BACKGROUND_ANALYSES_PER_SCAN);

    for index in candidates {
        let finding = &mut scan_result.vulnerabilities[index];
        {
            debug!(
                "Analyzing finding: {} ({})",
                finding.package_name,
                finding.cve_id.as_deref().unwrap_or("no-cve")
            );

            match llm.analyze_vulnerability_in_background(finding).await {
                Ok(analysis) => {
                    finding.ai_analysis = Some(analysis);
                    finding.ai_confidence = Some(85); // High confidence for auto-vetted
                    finding.is_false_positive = Some(false);
                }
                Err(e) => {
                    warn!(
                        "Failed to auto-analyze finding {}: {}",
                        finding.package_name, e
                    );
                }
            }
        }
    }

    info!("Automated AI analysis complete");
}

impl AgentRuntime {
    /// Run a security scan and upload incidents.
    pub(crate) async fn run_security_scan(&self) -> Result<SecurityScanResult, CommonError> {
        debug!("Running security scan...");

        let result = self
            .security_monitor
            .scan()
            .await
            .map_err(|e| CommonError::internal(format!("Security scan failed: {}", e)))?;

        if !result.incidents.is_empty() {
            info!(
                "Security scan detected {} incidents",
                result.incidents.len()
            );

            for incident in &result.incidents {
                if let Err(e) = self.upload_incident(incident).await {
                    error!("Failed to upload security incident: {}", e);
                }
            }
        } else {
            debug!("Security scan clean: no incidents detected");
        }

        Ok(result)
    }

    /// Upload a security incident to the server.
    pub(crate) async fn upload_incident(
        &self,
        incident: &agent_scanner::SecurityIncident,
    ) -> Result<(), CommonError> {
        if self.config.standalone {
            return Ok(());
        }
        let api_client = self.api_client.read().await;
        let client = api_client
            .as_ref()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        let agent_id = client
            .agent_id()
            .ok_or_else(|| CommonError::config("Agent not enrolled"))?;

        let payload = serde_json::json!({
            "incident_type": format!("{}", incident.incident_type),
            "severity": format!("{}", incident.severity),
            "title": incident.title,
            "description": incident.description,
            "evidence": incident.evidence,
            "confidence": incident.confidence,
            "detected_at": incident.detected_at.to_rfc3339(),
        });

        let url = format!("/v1/agents/{}/incidents", agent_id);
        let response: serde_json::Value = client.post(&url, &payload).await?;

        let incident_id = response
            .get("incident_id")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        info!(
            "Reported incident '{}' (type: {}, ID: {})",
            incident.title, incident.incident_type, incident_id
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::analysis_order;
    use agent_scanner::{KevEntry, PatchPriority, Severity, VulnerabilityFinding};

    fn finding(name: &str, severity: Severity, priority: PatchPriority) -> VulnerabilityFinding {
        let mut f = VulnerabilityFinding::outdated_package(name, "1", "2", "apt");
        f.severity = severity;
        f.priority = priority;
        if priority == PatchPriority::Immediate {
            f.kev = Some(KevEntry {
                date_added: None,
                due_date: None,
                ransomware_use: false,
                required_action: None,
            });
        }
        f
    }

    #[test]
    fn sbom_file_name_is_safe_for_any_host_name() {
        let date = chrono::NaiveDate::from_ymd_opt(2026, 10, 4).unwrap();
        assert_eq!(
            super::sbom_file_name("poste-compta-01", date),
            "sbom-poste-compta-01-2026-10-04.cdx.json"
        );
        assert_eq!(
            super::sbom_file_name("MacBook Pro de Zoé.local", date),
            "sbom-MacBook-Pro-de-Zo--local-2026-10-04.cdx.json"
        );
        assert_eq!(
            super::sbom_file_name("../../etc", date),
            "sbom-etc-2026-10-04.cdx.json"
        );
        assert_eq!(
            super::sbom_file_name("", date),
            "sbom-poste-2026-10-04.cdx.json"
        );
    }

    #[test]
    fn exploited_findings_are_analysed_before_critical_ones() {
        let mut findings = [
            finding("high", Severity::High, PatchPriority::Planned),
            finding("critical", Severity::Critical, PatchPriority::Planned),
            finding("likely", Severity::Medium, PatchPriority::Urgent),
            finding("exploited", Severity::Medium, PatchPriority::Immediate),
            finding(
                "exploited-critical",
                Severity::Critical,
                PatchPriority::Immediate,
            ),
        ];
        findings.sort_by_key(analysis_order);
        let order: Vec<&str> = findings.iter().map(|f| f.package_name.as_str()).collect();
        assert_eq!(
            order,
            [
                "exploited-critical",
                "exploited",
                "likely",
                "critical",
                "high"
            ]
        );
    }
}
