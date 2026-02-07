//! Custom tracing layer that captures log events and forwards them to the GUI.
//!
//! The [`GuiTracingLayer`] implements `tracing_subscriber::Layer` and sends
//! every tracing event as an [`AgentEvent::TerminalLog`] through a shared
//! bridge.  The bridge uses non-blocking access (`try_lock` / `try_send`) to
//! avoid any impact on the agent runtime if the GUI channel is slow or full.

#[cfg(feature = "gui")]
use std::sync::{Arc, Mutex};

#[cfg(feature = "gui")]
use agent_gui::events::{AgentEvent, TerminalLogEntry};

/// Shared bridge that holds an optional sender.
///
/// The sender is `None` until the GUI channel is created, then set via
/// [`set_sender`].  The layer silently drops events if the sender is not
/// yet available.
#[cfg(feature = "gui")]
pub struct GuiTracingBridge {
    sender: Arc<Mutex<Option<std::sync::mpsc::Sender<AgentEvent>>>>,
}

#[cfg(feature = "gui")]
impl Default for GuiTracingBridge {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(feature = "gui")]
impl GuiTracingBridge {
    /// Create a new bridge with no sender.
    pub fn new() -> Self {
        Self {
            sender: Arc::new(Mutex::new(None)),
        }
    }

    /// Install the GUI event sender.
    pub fn set_sender(&self, tx: std::sync::mpsc::Sender<AgentEvent>) {
        if let Ok(mut guard) = self.sender.try_lock() {
            *guard = Some(tx);
        }
    }

    /// Get a clone of the inner `Arc` (for sharing with the layer).
    pub fn shared(&self) -> Arc<Mutex<Option<std::sync::mpsc::Sender<AgentEvent>>>> {
        self.sender.clone()
    }
}

/// A [`tracing_subscriber::Layer`] that forwards events to the GUI.
#[cfg(feature = "gui")]
pub struct GuiTracingLayer {
    sender: Arc<Mutex<Option<std::sync::mpsc::Sender<AgentEvent>>>>,
}

#[cfg(feature = "gui")]
impl GuiTracingLayer {
    /// Create a new layer using the shared sender from a bridge.
    pub fn new(bridge: &GuiTracingBridge) -> Self {
        Self {
            sender: bridge.shared(),
        }
    }
}

// Visitor to extract the `message` field from a tracing event.
#[cfg(feature = "gui")]
struct MessageVisitor {
    message: String,
}

#[cfg(feature = "gui")]
impl MessageVisitor {
    fn new() -> Self {
        Self {
            message: String::new(),
        }
    }
}

#[cfg(feature = "gui")]
impl tracing::field::Visit for MessageVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        let should_set_message = field.name() == "message" || self.message.is_empty();
        if should_set_message {
            self.message = format!("{:?}", value);
            // Remove surrounding quotes if present
            if self.message.starts_with('"')
                && self.message.ends_with('"')
                && self.message.len() >= 2
            {
                self.message = self.message[1..self.message.len() - 1].to_string();
            }
        }
    }

    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" || self.message.is_empty() {
            self.message = value.to_string();
        }
    }
}

#[cfg(feature = "gui")]
impl<S> tracing_subscriber::Layer<S> for GuiTracingLayer
where
    S: tracing::Subscriber,
{
    fn on_event(
        &self,
        event: &tracing::Event<'_>,
        _ctx: tracing_subscriber::layer::Context<'_, S>,
    ) {
        // Non-blocking: skip if we can't acquire the lock immediately.
        let guard = match self.sender.try_lock() {
            Ok(g) => g,
            Err(_) => return,
        };

        let tx = match guard.as_ref() {
            Some(tx) => tx,
            None => return,
        };

        let metadata = event.metadata();
        let level = format!("{}", metadata.level()).to_uppercase();
        let target = metadata.target().to_string();

        let mut visitor = MessageVisitor::new();
        event.record(&mut visitor);

        let entry = TerminalLogEntry {
            timestamp: chrono::Utc::now(),
            level,
            target,
            message: visitor.message,
        };

        // Non-blocking send — intentionally fire-and-forget.
        // Cannot use tracing macros here (would cause infinite recursion in the tracing layer).
        // Dropped log entries on a full channel are acceptable behavior.
        let _ = tx.send(AgentEvent::TerminalLog { entry });
    }
}
