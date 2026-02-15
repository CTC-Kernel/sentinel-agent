//! Network collection, security detection, and upload operations.

use agent_common::error::CommonError;
use agent_network::{NetworkSecurityAlert, NetworkSnapshot};
use tracing::{debug, info, warn};

use super::{AgentRuntime, ProposeAssetData};

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
    pub(crate) async fn upload_network_snapshot(&self, snapshot: &NetworkSnapshot) -> Result<(), CommonError> {
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

    /// Upload network security alert to the server.
    pub(crate) async fn upload_network_alert(&self, alert: &NetworkSecurityAlert) -> Result<(), CommonError> {
        let api_client = self.api_client.read().await;
        let client = api_client
            .as_ref()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        let agent_id = client
            .agent_id()
            .ok_or_else(|| CommonError::config("Agent not enrolled"))?;

        let payload = serde_json::json!({
            "alert_type": format!("{:?}", alert.alert_type),
            "severity": format!("{:?}", alert.severity),
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
    pub(crate) async fn upload_proposed_asset(&self, proposal: &ProposeAssetData) -> Result<(), CommonError> {
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
