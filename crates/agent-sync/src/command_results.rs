//! Command Execution Results Reporting Service.
//!
//! This service handles reporting the outcome of commands received from the SaaS.

use crate::authenticated_client::AuthenticatedClient;
use crate::error::SyncResult;
use crate::types::{CommandResultRequest, CommandStatus};
use chrono::Utc;
use std::sync::Arc;
use tracing::{debug, error, info};

/// Service for reporting command execution results.
pub struct CommandResultsService {
    client: Arc<AuthenticatedClient>,
}

impl CommandResultsService {
    /// Create a new command results service.
    pub fn new(client: Arc<AuthenticatedClient>) -> Self {
        Self { client }
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
        debug!("Reporting result for command {}: {:?}", command_id, result.status);
        
        if let Err(e) = self.client.report_command_result(command_id, result).await {
            error!("Failed to report result for command {}: {}", command_id, e);
            return Err(e);
        }

        info!("Command {} result reported successfully", command_id);
        Ok(())
    }
}
