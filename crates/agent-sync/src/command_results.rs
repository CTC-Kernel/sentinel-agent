// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Command Execution Results Reporting Service.
//!
//! This service handles reporting the outcome of commands received from the SaaS.

use crate::authenticated_client::AuthenticatedClient;
use crate::error::SyncResult;
use crate::types::{CommandResultRequest, CommandStatus};
use agent_storage::{Database, repositories::command_results::CommandResultRepository};
use chrono::Utc;
use std::sync::Arc;
use tracing::{debug, error, info};

/// Service for reporting command execution results.
pub struct CommandResultsService {
    client: Arc<AuthenticatedClient>,
    db: Arc<Database>,
}

impl CommandResultsService {
    /// Create a new command results service.
    pub fn new(client: Arc<AuthenticatedClient>, db: Arc<Database>) -> Self {
        Self { client, db }
    }

    /// Report a successful command execution.
    pub async fn report_success(&self, command_id: &str, output: Option<String>) -> SyncResult<()> {
        let result = CommandResultRequest {
            status: CommandStatus::Success,
            output,
            error: None,
            completed_at: Utc::now(),
        };

        self.report(command_id, result).await
    }

    /// Report a failed command execution.
    pub async fn report_failure(&self, command_id: &str, error: String) -> SyncResult<()> {
        let result = CommandResultRequest {
            status: CommandStatus::Failed,
            output: None,
            error: Some(error),
            completed_at: Utc::now(),
        };

        self.report(command_id, result).await
    }

    /// Send the command result to the SaaS.
    async fn report(&self, command_id: &str, result: CommandResultRequest) -> SyncResult<()> {
        let agent_id = self.client.agent_id().await?.to_string();
        let repo = CommandResultRepository::new(&self.db, &agent_id);
        let payload = serde_json::to_string(&result)?;
        repo.store(command_id, &payload).await?;
        self.send_stored(command_id, &payload).await
    }

    pub async fn pending_count(&self) -> SyncResult<i64> {
        let id = self.client.agent_id().await?.to_string();
        Ok(CommandResultRepository::new(&self.db, &id).count().await?)
    }

    /// Replay persisted results, including after a process restart. Never execute commands here.
    pub async fn flush_pending(&self) -> SyncResult<()> {
        let agent_id = self.client.agent_id().await?.to_string();
        let mut first_error = None;
        for (id, payload) in CommandResultRepository::new(&self.db, &agent_id)
            .pending(50)
            .await?
        {
            if let Err(error) = self.send_stored(&id, &payload).await {
                if error.is_retryable() {
                    return Err(error);
                }
                if first_error.is_none() {
                    first_error = Some(error);
                }
            }
        }
        match first_error {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }

    async fn send_stored(&self, command_id: &str, payload: &str) -> SyncResult<()> {
        let agent_id = self.client.agent_id().await?.to_string();
        CommandResultRepository::new(&self.db, &agent_id)
            .mark_attempt(command_id)
            .await?;
        let result: CommandResultRequest = serde_json::from_str(payload)?;
        debug!(
            "Reporting result for command {}: {:?}",
            command_id, result.status
        );

        if let Err(e) = self.client.report_command_result(command_id, result).await {
            error!("Failed to report result for command {}: {}", command_id, e);
            return Err(e);
        }

        let agent_id = self.client.agent_id().await?.to_string();
        CommandResultRepository::new(&self.db, &agent_id)
            .acknowledge(command_id, payload)
            .await?;
        info!("Command {} result reported successfully", command_id);
        Ok(())
    }
}
