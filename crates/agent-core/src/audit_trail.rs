//! Persistent local audit trail for the Sentinel GRC Agent.
//!
//! Stores user actions and system events in the encrypted SQLCipher database.

use agent_storage::Database;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};

/// Type of audit event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditAction {
    ScanStarted { scan_type: String },
    ScanFinished { scan_type: String, score: f32 },
    RemediationApplied { check_id: String },
    ConfigChanged { component: String },
    AgentStarted,
    AgentShutdown,
    UpdateChecked { version_found: Option<String> },
}

/// A recorded audit log entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub timestamp: DateTime<Utc>,
    pub action: AuditAction,
    pub actor: String, // "user", "system", or "server"
    pub details: Option<String>,
}

pub struct LocalAuditTrail {
    #[allow(dead_code)]
    db: Arc<Database>,
}

impl LocalAuditTrail {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// Log an action to the local audit trail.
    pub async fn log(&self, action: AuditAction, actor: &str, details: Option<String>) {
        let entry = AuditEntry {
            timestamp: Utc::now(),
            action: action.clone(),
            actor: actor.to_string(),
            details: details.clone(),
        };

        info!("Local Audit: {:?} by {} - {:?}", action, actor, details);

        // Store in DB
        if let Err(e) = self.store_entry(&entry).await {
            error!("Failed to store local audit entry: {}", e);
        }
    }

    async fn store_entry(
        &self,
        entry: &AuditEntry,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        use agent_storage::{AuditTrailRepository, StoredAuditEntry};

        let repo = AuditTrailRepository::new(&self.db);
        let action_data = serde_json::to_string(&entry.action).unwrap_or_default();
        let action_type = match &entry.action {
            AuditAction::ScanStarted { .. } => "scan_started",
            AuditAction::ScanFinished { .. } => "scan_finished",
            AuditAction::RemediationApplied { .. } => "remediation_applied",
            AuditAction::ConfigChanged { .. } => "config_changed",
            AuditAction::AgentStarted => "agent_started",
            AuditAction::AgentShutdown => "agent_shutdown",
            AuditAction::UpdateChecked { .. } => "update_checked",
        };

        let stored_entry = StoredAuditEntry {
            id: None,
            timestamp: entry.timestamp,
            action_type: action_type.to_string(),
            action_data,
            actor: entry.actor.clone(),
            details: entry.details.clone(),
        };

        repo.insert(&stored_entry).await?;
        Ok(())
    }
}
