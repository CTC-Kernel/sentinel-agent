//! Agent Common - Shared types and utilities for the Sentinel GRC Agent.
//!
//! This crate provides common types, error handling, and configuration
//! structures used across all agent crates.
//!
//! # Modules
//!
//! - [`config`] - Agent configuration types
//! - [`error`] - Error types and result aliases
//! - [`types`] - Domain types (checks, proofs, agent status)
//! - [`constants`] - Common constants
//!
//! # Example
//!
//! ```
//! use agent_common::{config::AgentConfig, types::CheckStatus};
//!
//! let config = AgentConfig::default();
//! assert_eq!(config.offline_mode_days, 7);
//!
//! let status = CheckStatus::Pass;
//! ```

pub mod config;
pub mod constants;
pub mod error;
pub mod frameworks;
#[cfg(target_os = "macos")]
pub mod macos;
pub mod sensitive_filter;
pub mod types;

// Re-export commonly used items at crate root
pub use config::AgentConfig;
pub use error::{CommonError, Result};
pub use sensitive_filter::{
    contains_sensitive_data, filter_json_sensitive_data, filter_sensitive_data,
};
pub use types::{AgentStatus, CheckResult, CheckStatus, Proof};
pub use types::{RuntimeEvent, RuntimeEventKind, Severity};
