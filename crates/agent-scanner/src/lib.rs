//! Agent Scanner - Compliance check engine and proof generation.
//!
//! This crate provides the compliance checking framework for the Sentinel
//! GRC Agent, including:
//!
//! - Pluggable check trait for compliance checks
//! - Check runner with parallel execution and timeout
//! - Scheduler for periodic check execution
//! - Proof generation with SHA-256 integrity
//! - Local compliance score calculator
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
//! │  Scheduler  │────▶│ CheckRunner │────▶│   Checks    │
//! └─────────────┘     └─────────────┘     └─────────────┘
//!                            │
//!                            ▼
//!                     ┌─────────────┐
//!                     │ProofGenerator│
//!                     └─────────────┘
//!                            │
//!                            ▼
//!                     ┌─────────────┐
//!                     │ScoreCalculator│
//!                     └─────────────┘
//! ```
//!
//! # Example
//!
//! ```no_run
//! use agent_scanner::{CheckRunner, CheckRegistry, RunnerConfig};
//! use std::sync::Arc;
//!
//! # async fn example() {
//! // Create a registry and register checks
//! let registry = Arc::new(CheckRegistry::new());
//!
//! // Create a runner
//! let runner = CheckRunner::with_defaults(registry);
//!
//! // Run all enabled checks
//! let results = runner.run_all().await;
//!
//! println!("Executed {} checks", results.len());
//! # }
//! ```

pub mod check;
pub mod checks;
pub mod error;
pub mod proof;
pub mod runner;
pub mod scheduler;
pub mod score;
pub mod security;
pub mod vulnerability;

// Re-export commonly used types
pub use check::{Check, CheckDefinitionBuilder, CheckOutput, CheckRegistry};
pub use error::{ScannerError, ScannerResult};
pub use proof::{compute_sha256, verify_sha256, ProofGenerator};
pub use runner::{CheckExecutionResult, CheckRunner, RunnerConfig, ScanSummary};
pub use scheduler::{Scheduler, SchedulerConfig, SchedulerEvent, SchedulerState, SchedulerStatus};
pub use score::{CheckScoreInput, ComplianceScore, ScoreCalculator, ScoringConfig};
pub use security::{SecurityIncident, SecurityMonitor, SecurityScanResult, IncidentType, IncidentSeverity};
pub use vulnerability::{VulnerabilityFinding, VulnerabilityScanner, VulnerabilityScanResult, Severity, ScanType};
