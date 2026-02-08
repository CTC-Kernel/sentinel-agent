//! Custom tracing layer that captures log events and forwards them to the GUI.
//!
//! The [`GuiTracingLayer`] implements `tracing_subscriber::Layer` and sends
//! every tracing event as an [`AgentEvent::TerminalLog`] through a shared
//! bridge.  The bridge uses non-blocking access (`try_lock` / `try_send`) to
//! avoid any impact on the agent runtime if the GUI channel is slow or full.

#[cfg(feature = "gui")]
use std::sync::{Arc, Mutex};

#[cfg(not(feature = "gui"))]
use std::sync::{Arc, Mutex};

#[cfg_attr(not(feature = "gui"), allow(dead_code))]
#[cfg(feature = "gui")]
use agent_gui::events::{AgentEvent, TerminalLogEntry};

#[cfg(not(feature = "gui"))]
#[derive(Debug, Clone)]
pub struct AgentEvent {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
#[derive(Debug, Clone)]
pub struct TerminalLogEntry {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub level: String,
    pub target: String,
    pub message: String,
}

/// Shared bridge that holds an optional sender.
///
/// The sender is `None` until the GUI channel is created, then set via
/// [`set_sender`].  The layer silently drops events if the sender is not
/// yet available.
#[cfg(feature = "gui")]
pub struct GuiTracingBridge {
    sender: Arc<Mutex<Option<std::sync::mpsc::Sender<AgentEvent>>>>,
}

#[cfg(not(feature = "gui"))]
pub struct GuiTracingBridge {
    // No-op when GUI feature is disabled
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

#[cfg(not(feature = "gui"))]
impl Default for GuiTracingBridge {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(not(feature = "gui"))]
impl GuiTracingBridge {
    /// Create a new bridge with no sender.
    pub fn new() -> Self {
        Self {}
    }

    /// Install the GUI event sender.
    pub fn set_sender(&self, _tx: std::sync::mpsc::Sender<AgentEvent>) {
        // No-op when GUI feature is disabled
    }

    /// Get a clone of the inner `Arc` (for sharing with the layer).
    pub fn shared(&self) -> Arc<Mutex<Option<std::sync::mpsc::Sender<AgentEvent>>>> {
        Arc::new(Mutex::new(None))
    }
}

/// A [`tracing_subscriber::Layer`] that forwards events to the GUI.
#[cfg(feature = "gui")]
pub struct GuiTracingLayer {
    sender: Arc<Mutex<Option<std::sync::mpsc::Sender<AgentEvent>>>>,
}

#[cfg(not(feature = "gui"))]
pub struct GuiTracingLayer {
    // No-op when GUI feature is disabled
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

#[cfg(not(feature = "gui"))]
impl GuiTracingLayer {
    /// Create a new layer using the shared sender from a bridge.
    pub fn new(_bridge: &GuiTracingBridge) -> Self {
        Self {}
    }
}

// Visitor to extract the `message` field from a tracing event.
#[cfg(feature = "gui")]
struct MessageVisitor {
    message: String,
}

#[cfg(not(feature = "gui"))]
#[allow(dead_code)] // Intentional: struct used only with "gui" feature; kept for feature parity
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

#[cfg(not(feature = "gui"))]
#[allow(dead_code)]
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
            if let Some(stripped) = self.message.strip_prefix('"').and_then(|s| s.strip_suffix('"')) {
                self.message = stripped.to_string();
            }
        }
    }

    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" || self.message.is_empty() {
            self.message = value.to_string();
        }
    }
}

#[cfg(not(feature = "gui"))]
impl tracing::field::Visit for MessageVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        let should_set_message = field.name() == "message" || self.message.is_empty();
        if should_set_message {
            self.message = format!("{:?}", value);
            // Remove surrounding quotes if present
            if let Some(stripped) = self.message.strip_prefix('"').and_then(|s| s.strip_suffix('"')) {
                self.message = stripped.to_string();
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
        let guard: std::sync::MutexGuard<Option<std::sync::mpsc::Sender<AgentEvent>>> =
            match self.sender.try_lock() {
                Ok(g) => g,
                Err(_) => return,
            };

        let tx: &std::sync::mpsc::Sender<AgentEvent> = match guard.as_ref() {
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

#[cfg(not(feature = "gui"))]
impl<S> tracing_subscriber::Layer<S> for GuiTracingLayer
where
    S: tracing::Subscriber,
{
    fn on_event(
        &self,
        _event: &tracing::Event<'_>,
        _ctx: tracing_subscriber::layer::Context<'_, S>,
    ) {
        // No-op when GUI feature is disabled
    }
}
