// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Commands sent by the desktop interface to the agent, and what handles
//! them.

use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use agent_core::RuntimeHandle;
use agent_core::audit_trail::LocalAuditTrail;
use agent_core::remote_ai::RemoteAi;
use agent_gui::events::{AgentEvent, GuiCommand};
use agent_storage::Database;
use agent_sync::AuthenticatedClient;
use tracing::error;

pub(crate) mod ai;
pub(crate) mod grc;
pub(crate) mod playbooks;
pub(crate) mod reports;
pub(crate) mod response;
pub(crate) mod voice;

/// The local AI model service, when the agent is built with it.
#[cfg(feature = "llm")]
pub(crate) type LlmService = agent_core::llm_service::LLMService;
#[cfg(not(feature = "llm"))]
pub(crate) type LlmService = ();

/// What the command handlers share: the running agent, the channel back to
/// the interface, and the services a command may need.
pub(crate) struct CommandContext {
    /// The running agent.
    pub handle: RuntimeHandle,
    /// Events back to the interface.
    pub events: std::sync::mpsc::Sender<AgentEvent>,
    /// The encrypted database, when it could be opened.
    pub db: Option<Arc<Database>>,
    /// The platform client; `None` in standalone mode.
    pub sync_client: Option<Arc<AuthenticatedClient>>,
    pub llm_service: Option<Arc<LlmService>>,
    pub audit_trail: Option<Arc<LocalAuditTrail>>,
    #[cfg(feature = "voice")]
    pub voice_service: Option<Arc<agent_core::voice::VoiceService>>,
    /// Cancellation flag of the assistant answer being generated.
    pub llm_cancel: Arc<Mutex<Option<Arc<AtomicBool>>>>,
    /// The AI provider chosen in the settings.
    pub remote_ai: RemoteAi,
}

/// A command reached a group of handlers it does not belong to: the
/// dispatcher and the group disagree on who handles it. Nothing is done.
fn misrouted(group: &str, command: &GuiCommand) {
    error!(
        "GUI command {:?} was handed to the {} handlers, which do not know it",
        command, group
    );
}
