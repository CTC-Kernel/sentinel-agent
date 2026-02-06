//! SIEM event formatters.
//!
//! Supports multiple output formats:
//! - CEF (Common Event Format)
//! - LEEF (Log Event Extended Format)
//! - JSON (Generic JSON)

mod cef;
mod json;
mod leef;

pub use cef::CefFormatter;
pub use json::JsonFormatter;
pub use leef::LeefFormatter;

use crate::{SiemEvent, SiemResult};

/// Trait for SIEM event formatters.
pub trait SiemFormatter: Send + Sync {
    /// Format an event into a string.
    fn format(&self, event: &SiemEvent) -> SiemResult<String>;

    /// Get the format name.
    fn name(&self) -> &'static str;
}
