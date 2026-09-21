// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Network collection, security detection, and upload operations.

use agent_common::error::CommonError;
use agent_network::{NetworkSecurityAlert, NetworkSnapshot};
use std::time::Duration;
use tracing::{debug, info, warn};

use super::{AgentRuntime, ProposeAssetData};

/// Minimum spacing between two discovered-device uploads: the platform
/// allows 60 requests/min per agent, shared with all other agent traffic.
#[cfg_attr(not(feature = "gui"), allow(dead_code))] // LAN discovery is GUI-driven.
pub(crate) const DISCOVERY_UPLOAD_SPACING: Duration = Duration::from_secs(1);

/// The /24 subnet scanned by LAN discovery: the one of the primary IPv4
/// address, or `None` (discovery aborted) when there is none. A range is
/// never guessed.
#[cfg_attr(not(feature = "gui"), allow(dead_code))] // LAN discovery is GUI-driven.
pub(crate) fn discovery_subnet(primary_ip: Option<&str>) -> Option<String> {
    let addr = primary_ip?.trim().parse::<std::net::Ipv4Addr>().ok()?;
    if addr.is_unspecified() || addr.is_loopback() || addr.is_link_local() {
        return None;
    }
    let o = addr.octets();
    Some(format!("{}.{}.{}.0/24", o[0], o[1], o[2]))
}

/// Upload discovered devices, one request each, at most one per
/// [`DISCOVERY_UPLOAD_SPACING`], retrying network errors, 429 and 5xx.
#[cfg_attr(not(feature = "gui"), allow(dead_code))] // LAN discovery is GUI-driven.
pub(crate) async fn upload_discovered_devices(
    client: &agent_sync::AuthenticatedClient,
    payloads: &[agent_sync::DiscoveredAssetPayload],
) {
    if payloads.is_empty() {
        return;
    }
    let (sent, failed) = crate::vuln_upload::send_each_throttled(
        "Discovered device",
        payloads,
        DISCOVERY_UPLOAD_SPACING,
        &crate::vuln_upload::UPLOAD_BACKOFF,
        |payload| async move {
            client
                .report_discovered_asset(payload.clone())
                .await
                .map(|_| ())
                .map_err(|e| {
                    let message = format!("{} ({})", e, payload.ip);
                    if e.is_retryable() {
                        crate::vuln_upload::PageError::Retryable(message)
                    } else {
                        crate::vuln_upload::PageError::Fatal(message)
                    }
                })
        },
    )
    .await;
    if failed > 0 {
        warn!(
            "Synced {}/{} discovered devices to platform ({} failed)",
            sent,
            payloads.len(),
            failed
        );
    } else {
        info!(
            "Synced {}/{} discovered devices to platform",
            sent,
            payloads.len()
        );
    }
}

impl AgentRuntime {
    /// Collect network information.
    pub(crate) async fn run_network_collection(&self) -> Result<NetworkSnapshot, CommonError> {
        debug!("Collecting network information...");

        let network_manager = self.network_manager.read().await;
        let snapshot = network_manager
            .collect_snapshot()
            .await
            .map_err(|e| CommonError::internal(format!("Network collection failed: {}", e)))?;

        info!(
            "Network collection complete: {} interfaces, {} connections, {} routes",
            snapshot.interfaces.len(),
            snapshot.connections.len(),
            snapshot.routes.len()
        );

        Ok(snapshot)
    }

    /// Run network security detection.
    pub(crate) async fn run_network_security_detection(
        &self,
        snapshot: &NetworkSnapshot,
    ) -> Result<Vec<NetworkSecurityAlert>, CommonError> {
        debug!("Running network security detection...");

        // Feed connections to the beaconing detector before analysis
        {
            let mut network_manager = self.network_manager.write().await;
            network_manager.record_connections_for_beaconing(&snapshot.connections);
        }

        let network_manager = self.network_manager.read().await;
        let alerts = network_manager
            .detect_threats(&snapshot.connections)
            .await
            .map_err(|e| CommonError::internal(format!("Network detection failed: {}", e)))?;

        if !alerts.is_empty() {
            warn!("Network security detection found {} alerts", alerts.len());
            for alert in &alerts {
                info!(
                    "Network alert: {} (severity: {:?}, confidence: {}%)",
                    alert.title, alert.severity, alert.confidence
                );
            }
        } else {
            debug!("Network security detection clean");
        }

        Ok(alerts)
    }

    /// Upload network snapshot to the server.
    pub(crate) async fn upload_network_snapshot(
        &self,
        snapshot: &NetworkSnapshot,
    ) -> Result<(), CommonError> {
        if self.config.standalone || !self.state.network_monitoring_enabled() {
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
            "timestamp": snapshot.timestamp.to_rfc3339(),
            "interfaces": snapshot.interfaces,
            "connections": snapshot.connections,
            "routes": snapshot.routes,
            "dns": snapshot.dns,
            "primary_ip": snapshot.primary_ip,
            "primary_mac": snapshot.primary_mac,
            "hash": snapshot.hash,
        });

        let url = format!("/v1/agents/{}/network", agent_id);
        let _response: serde_json::Value = client.post(&url, &payload).await?;

        debug!("Uploaded network snapshot");
        Ok(())
    }

    /// Upload network security alerts, skipping any alert already reported
    /// less than the cooldown ago (detectors re-raise a lasting suspicious
    /// connection on every scan). An alert whose upload fails is retried on
    /// the next detection.
    pub(crate) async fn upload_network_alerts(&self, alerts: &[NetworkSecurityAlert]) {
        if alerts.is_empty() || self.config.standalone || !self.state.network_monitoring_enabled() {
            return;
        }
        let mut suppressed = 0usize;
        for alert in alerts {
            let now = std::time::Instant::now();
            let due = self
                .network_alert_cooldown
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .should_report(alert, now);
            if !due {
                suppressed += 1;
                continue;
            }
            match self.upload_network_alert(alert).await {
                Ok(()) => self
                    .network_alert_cooldown
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .mark_reported(alert, now),
                Err(e) => warn!("Failed to upload network alert: {}", e),
            }
        }
        if suppressed > 0 {
            debug!(
                "{} network alert(s) not re-uploaded (already reported within the cooldown)",
                suppressed
            );
        }
    }

    /// Upload network security alert to the server.
    pub(crate) async fn upload_network_alert(
        &self,
        alert: &NetworkSecurityAlert,
    ) -> Result<(), CommonError> {
        if self.config.standalone || !self.state.network_monitoring_enabled() {
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
            "alert_type": format!("{}", alert.alert_type),
            "severity": format!("{}", alert.severity),
            "title": alert.title,
            "description": alert.description,
            "connection": alert.connection,
            "evidence": alert.evidence,
            "confidence": alert.confidence,
            "detected_at": alert.detected_at.to_rfc3339(),
            "iocs_matched": alert.iocs_matched,
        });

        let url = format!("/v1/agents/{}/network/alerts", agent_id);
        let _response: serde_json::Value = client.post(&url, &payload).await?;

        info!(
            "Reported network alert '{}' (severity: {:?})",
            alert.title, alert.severity
        );

        Ok(())
    }

    /// Upload a proposed asset (discovered device) to the server.
    pub(crate) async fn upload_proposed_asset(
        &self,
        proposal: &ProposeAssetData,
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
            "ip": proposal.ip,
            "hostname": proposal.hostname,
            "device_type": proposal.device_type,
            "source": "agent_discovery",
        });

        let url = format!("/v1/agents/{}/discovered-assets", agent_id);
        let _response: serde_json::Value = client.post(&url, &payload).await?;

        info!("Proposed discovered device {} as asset", proposal.ip);

        #[cfg(feature = "gui")]
        self.emit_notification(
            "Actif proposé",
            &format!("Appareil {} proposé comme actif", proposal.ip),
            "info",
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discovery_subnet_uses_primary_ipv4_only() {
        assert_eq!(
            discovery_subnet(Some("10.20.30.40")).as_deref(),
            Some("10.20.30.0/24")
        );
        assert_eq!(
            discovery_subnet(Some(" 192.168.7.12 ")).as_deref(),
            Some("192.168.7.0/24")
        );
        // No primary IP, IPv6 or unusable addresses: no scan (never a
        // guessed 192.168.1.0/24).
        assert_eq!(discovery_subnet(None), None);
        assert_eq!(discovery_subnet(Some("")), None);
        assert_eq!(discovery_subnet(Some("fe80::1")), None);
        assert_eq!(discovery_subnet(Some("0.0.0.0")), None);
        assert_eq!(discovery_subnet(Some("127.0.0.1")), None);
        assert_eq!(discovery_subnet(Some("169.254.10.2")), None);
    }
}
