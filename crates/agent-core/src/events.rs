//! Event and command handling for the Sentinel GRC Agent.
//!
//! This module centralizes the dispatching of events to the GUI and other
//! interested parties, and provides handlers for various commands.

use crate::audit_trail::{AuditAction, LocalAuditTrail};
use std::sync::Arc;

#[cfg_attr(not(feature = "gui"), allow(dead_code))]

#[cfg(feature = "gui")]
pub use agent_gui::{
    dto::GuiNotification,
    events::{AgentEvent, GuiCommand},
};

#[cfg(not(feature = "gui"))]
#[derive(Debug, Clone)]
pub enum AgentEvent {
    Dummy,
}

#[cfg(not(feature = "gui"))]
#[derive(Debug, Clone)]
pub enum GuiCommand {
    Dummy,
}

#[cfg(not(feature = "gui"))]
#[derive(Debug, Clone)]
pub struct GuiNotification {
    pub dummy: bool,
}

/// Manages event dispatching and command processing.
pub struct EventManager {
    #[cfg(feature = "gui")]
    gui_event_tx: tokio::sync::broadcast::Sender<AgentEvent>,
    audit_trail: Option<Arc<LocalAuditTrail>>,
}

impl EventManager {
    pub fn new(
        audit_trail: Option<Arc<LocalAuditTrail>>,
    ) -> (Self, tokio::sync::broadcast::Receiver<AgentEvent>) {
        let (gui_event_tx, gui_event_rx) = tokio::sync::broadcast::channel(100);

        // gui_event_tx only stored when gui feature is enabled
        #[cfg(not(feature = "gui"))]
        let _ = gui_event_tx;

        (
            Self {
                #[cfg(feature = "gui")]
                gui_event_tx,
                audit_trail,
            },
            gui_event_rx,
        )
    }

    /// Emit an event to the GUI.
    #[cfg(feature = "gui")]
    pub fn emit_gui(&self, event: AgentEvent) {
        let _ = self.gui_event_tx.send(event);
    }

    /// Emit a notification to the GUI.
    #[cfg(feature = "gui")]
    pub fn notify(&self, title: &str, message: &str, severity: &str) {
        let notification = if severity.to_lowercase() == "error" {
            GuiNotification::error(title, message)
        } else {
            GuiNotification::info(title, message)
        };

        self.emit_gui(AgentEvent::Notification { notification });
    }

    /// Log an action to the audit trail and optionally notify the GUI.
    pub async fn audit_log(&self, action: AuditAction, actor: &str, details: Option<String>) {
        if let Some(ref audit) = self.audit_trail {
            audit.log(action, actor, details).await;
        }
    }
}
