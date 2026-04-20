// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Vulnerability and security scanning operations.

use agent_common::error::CommonError;
use agent_scanner::{ScanType, SecurityScanResult, VulnerabilityScanResult};
use tracing::{debug, error, info, warn};

use super::AgentRuntime;

impl AgentRuntime {
    /// Run a vulnerability scan and upload results.
    pub(crate) async fn run_vulnerability_scan(
        &self,
    ) -> Result<VulnerabilityScanResult, CommonError> {
        info!("Starting vulnerability scan...");

        let result = self
            .vulnerability_scanner
            .scan(ScanType::CveCheck)
            .await
            .map_err(|e| CommonError::internal(format!("Vulnerability scan failed: {}", e)))?;

        info!(
            "Vulnerability scan complete: {} findings from {} packages",
            result.vulnerabilities.len(),
            result.packages_scanned
        );

        // Cache results for AI analysis and GUI context
        {
            let mut cache = self.state.last_vuln_findings.write().await;
            *cache = Some(result.clone());
        }

        // Perform automated AI analysis for high/critical findings
        let result = result;
        #[cfg(feature = "llm")]
        if self.config.llm.enabled {
            self.auto_analyze_vulnerabilities(&mut result).await;
        }

        // Upload results if we have findings
        if !result.vulnerabilities.is_empty()
            && let Err(e) = self.upload_vulnerabilities(&result).await
        {
            error!("Failed to upload vulnerability findings: {}", e);
        }

        Ok(result)
    }

    /// Automatically analyze high/critical vulnerabilities using the local LLM.
    #[cfg(feature = "llm")]
    pub(crate) async fn auto_analyze_vulnerabilities(&self, scan_result: &mut agent_scanner::VulnerabilityScanResult) {
        use agent_scanner::Severity;

        let llm = match &self.llm_service {
            Some(service) => service,
            None => return,
        };

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
                debug!("Analyzing finding: {} ({})", finding.package_name, finding.cve_id.as_deref().unwrap_or("no-cve"));
                
                match llm.analyze_vulnerability(finding).await {
                    Ok(analysis) => {
                        finding.ai_analysis = Some(analysis);
                        finding.ai_confidence = Some(85); // High confidence for auto-vetted
                        finding.is_false_positive = Some(false);
                    }
                    Err(e) => {
                        warn!("Failed to auto-analyze finding {}: {}", finding.package_name, e);
                    }
                }
            }
        }

        info!("Automated AI analysis complete");
    }


    /// Upload vulnerability findings to the server.
    pub(crate) async fn upload_vulnerabilities(
        &self,
        scan_result: &VulnerabilityScanResult,
    ) -> Result<(), CommonError> {
        let api_client = self.api_client.read().await;
        let client = api_client
            .as_ref()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        let agent_id = client
            .agent_id()
            .ok_or_else(|| CommonError::config("Agent not enrolled"))?;

        // Only upload vulnerabilities with a CVE ID to the platform.
        // Outdated-package-only findings (no CVE) stay local to the agent GUI.
        let vulnerabilities: Vec<serde_json::Value> = scan_result
            .vulnerabilities
            .iter()
            .filter(|v| v.cve_id.is_some())
            .map(|v| {
                serde_json::json!({
                    "package_name": v.package_name,
                    "installed_version": v.installed_version,
                    "available_version": v.available_version,
                    "cve_id": v.cve_id,
                    "cvss_score": v.cvss_score,
                    "severity": format!("{}", v.severity),
                    "description": v.description,
                    "remediation": v.remediation,
                    "detected_at": v.detected_at.to_rfc3339(),
                    "source": v.source,
                    "ai_confidence": v.ai_confidence.map(|c| f64::from(c) / 100.0),
                    "is_false_positive": v.is_false_positive,
                    "ai_analysis": v.ai_analysis,
                })
            })
            .collect();

        let payload = serde_json::json!({
            "vulnerabilities": vulnerabilities,
            "scan_type": format!("{}", scan_result.scan_type),
        });

        let url = format!("/v1/agents/{}/vulnerabilities", agent_id);
        let _response: serde_json::Value = client.post(&url, &payload).await?;

        info!("Uploaded {} vulnerability findings", vulnerabilities.len());

        #[cfg(feature = "gui")]
        self.emit_gui_event(agent_gui::events::AgentEvent::SyncStatus {
            syncing: false,
            pending_count: 0,
            last_sync_at: Some(chrono::Utc::now()),
            error: None,
        });

        Ok(())
    }

    /// Upload software inventory from a vulnerability scan result.
    pub(crate) async fn upload_software_from_scan(&self, scan_result: &VulnerabilityScanResult) {
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

        let api_client = self.api_client.read().await;
        if let Some(ref client) = *api_client {
            match client.upload_software_inventory(&software).await {
                Ok(_) => {
                    info!("Uploaded software inventory: {} packages", software.len());
                    #[cfg(feature = "gui")]
                    self.emit_gui_event(agent_gui::events::AgentEvent::SyncStatus {
                        syncing: false,
                        pending_count: 0,
                        last_sync_at: Some(chrono::Utc::now()),
                        error: None,
                    });
                }
                Err(e) => {
                    warn!("Failed to upload software inventory: {}", e);
                    #[cfg(feature = "gui")]
                    self.emit_gui_event(agent_gui::events::AgentEvent::SyncStatus {
                        syncing: false,
                        pending_count: 0,
                        last_sync_at: None,
                        error: Some(format!("Software upload failed: {}", e)),
                    });
                }
            }
        }
    }

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
