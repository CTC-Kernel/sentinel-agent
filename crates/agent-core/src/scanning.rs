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
    fn emit_sync_status(&self, last_sync_at: Option<chrono::DateTime<chrono::Utc>>, error: Option<String>) {
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

        let sent = vuln_upload::send_pages(&pages, &vuln_upload::UPLOAD_BACKOFF, |page| {
            let client = &client;
            let url = &url;
            async move {
                match client.post_status(url, page).await {
                    Ok((status, body)) => vuln_upload::classify_status(status, &body),
                    Err(e) => Err(vuln_upload::PageError::Retryable(e.to_string())),
                }
            }
        })
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
            })
            .collect();

        let Some(client) = self.api_client.read().await.clone() else {
            return;
        };
        match client.upload_software_inventory(&software).await {
            Ok(_) => {
                info!("Uploaded software inventory: {} packages", software.len());
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

/// Automatically analyze high/critical vulnerabilities using the local LLM.
#[cfg(feature = "llm")]
async fn auto_analyze_vulnerabilities(
    llm: &crate::llm_service::LLMService,
    scan_result: &mut VulnerabilityScanResult,
) {
    use agent_scanner::Severity;

    if !llm.is_available().await {
        debug!("LLM service not available for automated analysis");
        return;
    }

    info!("Starting automated AI analysis of high/critical findings...");

    for finding in &mut scan_result.vulnerabilities {
        // Only auto-analyze Critical or High findings that haven't been analyzed yet
        if (finding.severity == Severity::Critical || finding.severity == Severity::High)
            && finding.ai_analysis.is_none()
        {
            debug!(
                "Analyzing finding: {} ({})",
                finding.package_name,
                finding.cve_id.as_deref().unwrap_or("no-cve")
            );

            match llm.analyze_vulnerability(finding).await {
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
