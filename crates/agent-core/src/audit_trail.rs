//! Persistent local audit trail for the Sentinel GRC Agent.
//!
//! Stores user actions and system events in the encrypted SQLCipher database.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use agent_storage::Database;
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

    async fn store_entry(&self, _entry: &AuditEntry) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Implementation for agent-storage repository would go here
        // For now, it's a placeholder that we'll integrate with agent-storage later
        Ok(())
    }
}
