// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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
    ScanStarted {
        scan_type: String,
    },
    ScanFinished {
        scan_type: String,
        score: f32,
    },
    RemediationApplied {
        check_id: String,
    },
    ConfigChanged {
        component: String,
    },
    PlaybookActionExecuted {
        playbook_name: String,
        action: String,
        success: bool,
    },
    AgentStarted,
    AgentShutdown,
    UpdateChecked {
        version_found: Option<String>,
    },
    AIInteraction {
        prompt_preview: String,
    },
    VoiceActivity {
        activity: String,
    },
}

/// A recorded audit log entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub timestamp: DateTime<Utc>,
    pub action: AuditAction,
    pub actor: String, // "user", "system", or "server"
    pub details: Option<String>,
}

/// What to keep when reading the trail. Every criterion set must match.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AuditFilter {
    /// Stored kind of action: `scan_started`, `config_changed`,
    /// `playbook_action`...
    pub action_type: Option<String>,
    /// `user`, `system` or `server`.
    pub actor: Option<String>,
    /// Entries recorded at this time or later.
    pub since: Option<DateTime<Utc>>,
    /// Text looked for, whatever the case, in the kind, the action, the
    /// actor and the details.
    pub search: Option<String>,
}

/// One entry read back from the trail.
#[derive(Debug, Clone)]
pub struct AuditRecord {
    /// Row of the entry in the database.
    pub id: i64,
    pub timestamp: DateTime<Utc>,
    /// Stored kind of action (`scan_started`, `playbook_action`...).
    pub action_type: String,
    /// The action, when this version of the agent can still read it.
    pub action: Option<AuditAction>,
    pub actor: String,
    /// What was recorded with the action, without the integrity field.
    pub details: Option<String>,
    /// Whether the row still matches the hash written with it. `false`
    /// means it was changed after the fact, or written by something else.
    pub intact: bool,
}

impl AuditRecord {
    fn from_stored(entry: agent_storage::StoredAuditEntry) -> Self {
        let intact = agent_storage::AuditTrailRepository::verify_integrity(&entry);
        // The repository stores the hash inside the details, as JSON: what
        // is left once it is taken out is what the writer recorded.
        let details = entry.details.as_deref().and_then(|raw| {
            match serde_json::from_str::<serde_json::Value>(raw) {
                Ok(serde_json::Value::Object(mut fields)) => {
                    fields.remove("_integrity");
                    (!fields.is_empty()).then(|| serde_json::Value::Object(fields).to_string())
                }
                _ => Some(raw.to_string()).filter(|raw| !raw.trim().is_empty()),
            }
        });
        Self {
            id: entry.id.unwrap_or_default(),
            timestamp: entry.timestamp,
            action: serde_json::from_str(&entry.action_data).ok(),
            action_type: entry.action_type,
            actor: entry.actor,
            details,
            intact,
        }
    }

    /// Whether the action is one that did not succeed.
    pub fn is_failure(&self) -> bool {
        matches!(
            self.action,
            Some(AuditAction::PlaybookActionExecuted { success: false, .. })
        )
    }

    /// The entry in one sentence, for the operator (the interface is in
    /// French).
    pub fn summary(&self) -> String {
        let Some(action) = &self.action else {
            return format!(
                "\u{c9}v\u{e9}nement \u{ab}\u{a0}{}\u{a0}\u{bb}",
                self.action_type
            );
        };
        match action {
            AuditAction::ScanStarted { scan_type } => {
                format!("Analyse d\u{e9}marr\u{e9}e\u{a0}: {scan_type}")
            }
            AuditAction::ScanFinished { scan_type, score } => {
                format!("Analyse termin\u{e9}e\u{a0}: {scan_type} (score {score:.0}\u{202f}%)")
            }
            AuditAction::RemediationApplied { check_id } => {
                format!("Rem\u{e9}diation appliqu\u{e9}e\u{a0}: {check_id}")
            }
            AuditAction::ConfigChanged { component } => {
                format!("Configuration modifi\u{e9}e\u{a0}: {component}")
            }
            AuditAction::PlaybookActionExecuted {
                playbook_name,
                action,
                success,
            } => format!(
                "Playbook \u{ab}\u{a0}{playbook_name}\u{a0}\u{bb}\u{a0}: action {action} {}",
                if *success {
                    "ex\u{e9}cut\u{e9}e"
                } else {
                    "en \u{e9}chec"
                }
            ),
            AuditAction::AgentStarted => "Agent d\u{e9}marr\u{e9}".to_string(),
            AuditAction::AgentShutdown => "Agent arr\u{ea}t\u{e9}".to_string(),
            AuditAction::UpdateChecked { version_found } => match version_found {
                Some(version) => {
                    format!(
                        "Mise \u{e0} jour v\u{e9}rifi\u{e9}e\u{a0}: version {version} disponible"
                    )
                }
                None => "Mise \u{e0} jour v\u{e9}rifi\u{e9}e\u{a0}: agent \u{e0} jour".to_string(),
            },
            AuditAction::AIInteraction { prompt_preview } => {
                format!("Requ\u{ea}te \u{e0} l'assistant IA\u{a0}: {prompt_preview}")
            }
            AuditAction::VoiceActivity { activity } => {
                format!("Activit\u{e9} vocale\u{a0}: {activity}")
            }
        }
    }

    /// Who did it, in French.
    pub fn actor_label(&self) -> &str {
        match self.actor.as_str() {
            "user" => "Utilisateur",
            "system" => "Agent",
            "server" => "Plateforme",
            other => other,
        }
    }
}

impl AuditFilter {
    fn keeps(&self, entry: &agent_storage::StoredAuditEntry) -> bool {
        if self
            .action_type
            .as_deref()
            .is_some_and(|kind| !kind.eq_ignore_ascii_case(&entry.action_type))
        {
            return false;
        }
        if self
            .actor
            .as_deref()
            .is_some_and(|actor| !actor.eq_ignore_ascii_case(&entry.actor))
        {
            return false;
        }
        let Some(search) = self.search.as_deref().map(str::to_lowercase) else {
            return true;
        };
        search.trim().is_empty()
            || [
                Some(entry.action_type.as_str()),
                Some(entry.action_data.as_str()),
                Some(entry.actor.as_str()),
                entry.details.as_deref(),
            ]
            .into_iter()
            .flatten()
            .any(|field| field.to_lowercase().contains(search.trim()))
    }
}

pub struct LocalAuditTrail {
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

    /// The last `limit` entries that match `filter`, most recent first.
    ///
    /// The trail is read backwards, a page at a time, and the reading stops
    /// at `limit` matches, at the `since` bound, or after
    /// [`Self::MAX_SCANNED`] rows: a filter that matches nothing does not
    /// walk a trail of any size.
    pub async fn recent(
        &self,
        limit: usize,
        filter: &AuditFilter,
    ) -> Result<Vec<AuditRecord>, agent_storage::StorageError> {
        const PAGE: usize = 500;
        let repo = agent_storage::AuditTrailRepository::new(&self.db);
        let mut records = Vec::new();
        let mut offset = 0;
        while records.len() < limit && offset < Self::MAX_SCANNED {
            let page = repo.get_recent(PAGE, offset).await?;
            let read = page.len();
            for entry in page {
                if filter.since.is_some_and(|since| entry.timestamp < since) {
                    // Rows come newest first: everything after is older.
                    return Ok(records);
                }
                if filter.keeps(&entry) {
                    records.push(AuditRecord::from_stored(entry));
                    if records.len() == limit {
                        return Ok(records);
                    }
                }
            }
            if read < PAGE {
                break;
            }
            offset += read;
        }
        Ok(records)
    }

    /// How many rows [`Self::recent`] reads at most to find its matches.
    pub const MAX_SCANNED: usize = 20_000;

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
            AuditAction::PlaybookActionExecuted { .. } => "playbook_action",
            AuditAction::AgentStarted => "agent_started",
            AuditAction::AgentShutdown => "agent_shutdown",
            AuditAction::UpdateChecked { .. } => "update_checked",
            AuditAction::AIInteraction { .. } => "ai_interaction",
            AuditAction::VoiceActivity { .. } => "voice_activity",
        };

        let stored_entry = StoredAuditEntry {
            id: None,
            timestamp: entry.timestamp,
            action_type: action_type.to_string(),
            action_data,
            actor: entry.actor.clone(),
            details: entry.details.clone(),
            synced: false,
        };

        repo.insert(&stored_entry).await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn trail(dir: &tempfile::TempDir) -> LocalAuditTrail {
        let key_manager = agent_storage::KeyManager::new_with_key(&[9; 32]);
        let db = Database::open(
            agent_storage::DatabaseConfig::with_path(dir.path().join("audit.db")),
            &key_manager,
        )
        .unwrap();
        LocalAuditTrail::new(Arc::new(db))
    }

    /// The trail could only be written: what was recorded is read back,
    /// most recent first, with what it says and who did it.
    #[tokio::test]
    async fn the_trail_is_read_back_most_recent_first() {
        let dir = tempfile::tempdir().unwrap();
        let trail = trail(&dir);
        trail.log(AuditAction::AgentStarted, "system", None).await;
        trail
            .log(
                AuditAction::ConfigChanged {
                    component: "siem".into(),
                },
                "user",
                Some(r#"{"enabled":true}"#.into()),
            )
            .await;
        trail
            .log(
                AuditAction::PlaybookActionExecuted {
                    playbook_name: "Ransomware".into(),
                    action: "kill_process".into(),
                    success: false,
                },
                "system",
                None,
            )
            .await;

        let all = trail.recent(10, &AuditFilter::default()).await.unwrap();
        assert_eq!(all.len(), 3);
        assert_eq!(all[0].action_type, "playbook_action");
        assert!(all[0].is_failure());
        assert!(all[0].summary().contains("Ransomware"));
        assert!(all[0].summary().contains("en \u{e9}chec"));
        assert_eq!(all[1].summary(), "Configuration modifi\u{e9}e\u{a0}: siem");
        assert_eq!(all[1].actor_label(), "Utilisateur");
        assert_eq!(all[1].details.as_deref(), Some(r#"{"enabled":true}"#));
        assert_eq!(all[2].details, None, "the integrity field is not a detail");
        assert!(all.iter().all(|record| record.intact));

        let last = trail.recent(1, &AuditFilter::default()).await.unwrap();
        assert_eq!(last.len(), 1);
        assert_eq!(last[0].id, all[0].id);
    }

    #[tokio::test]
    async fn the_trail_is_filtered_by_kind_actor_text_and_date() {
        let dir = tempfile::tempdir().unwrap();
        let trail = trail(&dir);
        trail.log(AuditAction::AgentStarted, "system", None).await;
        trail
            .log(
                AuditAction::RemediationApplied {
                    check_id: "firewall_enabled".into(),
                },
                "user",
                None,
            )
            .await;

        let trail = &trail;
        let by = |filter: AuditFilter| async move { trail.recent(10, &filter).await.unwrap() };
        let kind = by(AuditFilter {
            action_type: Some("agent_started".into()),
            ..Default::default()
        })
        .await;
        assert_eq!(kind.len(), 1);
        assert!(matches!(kind[0].action, Some(AuditAction::AgentStarted)));

        let actor = by(AuditFilter {
            actor: Some("USER".into()),
            ..Default::default()
        })
        .await;
        assert_eq!(actor.len(), 1);
        assert_eq!(actor[0].action_type, "remediation_applied");

        let text = by(AuditFilter {
            search: Some("Firewall".into()),
            ..Default::default()
        })
        .await;
        assert_eq!(text.len(), 1);

        let future = by(AuditFilter {
            since: Some(Utc::now() + chrono::Duration::hours(1)),
            ..Default::default()
        })
        .await;
        assert!(future.is_empty());
        let past = by(AuditFilter {
            since: Some(Utc::now() - chrono::Duration::hours(1)),
            actor: Some("system".into()),
            ..Default::default()
        })
        .await;
        assert_eq!(past.len(), 1);
    }

    /// A row changed after it was written is still shown, and flagged.
    #[tokio::test]
    async fn a_row_altered_after_the_fact_is_flagged() {
        let dir = tempfile::tempdir().unwrap();
        let trail = trail(&dir);
        trail.log(AuditAction::AgentStarted, "system", None).await;
        trail
            .db
            .with_connection(|conn| {
                conn.execute("UPDATE audit_trail SET actor = 'user'", [])
                    .map_err(|e| agent_storage::StorageError::Query(e.to_string()))?;
                Ok(())
            })
            .await
            .unwrap();

        let all = trail.recent(10, &AuditFilter::default()).await.unwrap();
        assert_eq!(all.len(), 1);
        assert!(!all[0].intact);
    }
}
