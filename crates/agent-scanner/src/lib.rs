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
pub mod directory;
pub mod error;
pub mod proof;
pub mod runner;
pub mod scheduler;
pub mod score;
pub mod security;
pub mod vulnerability;

#[cfg(feature = "llm_simple")]
pub mod llm_integration;

// Re-export commonly used types
pub use check::{Check, CheckDefinitionBuilder, CheckOutput, CheckRegistry};
pub use error::{ScannerError, ScannerResult};
pub use proof::{ProofGenerator, compute_sha256, verify_sha256};
pub use runner::{CheckExecutionResult, CheckRunner, RunnerConfig, ScanSummary};
pub use scheduler::{Scheduler, SchedulerConfig, SchedulerEvent, SchedulerState, SchedulerStatus};
pub use score::{CheckScoreInput, ComplianceScore, ScoreCalculator, ScoringConfig};
pub use security::process_tree::{ProcessTreeAnalyzer, SuspiciousProcessEvent};
pub use security::usb_monitor::UsbMonitor;
pub use security::{
    IncidentSeverity, IncidentType, SecurityIncident, SecurityMonitor, SecurityScanResult,
};
pub use vulnerability::package_scanner::InstalledPackage;
pub use vulnerability::{
    ScanType, Severity, VulnerabilityFinding, VulnerabilityScanResult, VulnerabilityScanner,
};

// Directory services auditing
pub use directory::{
    AclFinding, AuditPolicy, AuditSetting, ComplianceStatus, DirectoryAuditResult,
    DirectoryAuditor, DirectoryCategory, DirectoryCheck, DirectoryCheckResult,
    DirectoryComplianceSummary, DirectoryFinding, DirectorySeverity, DirectoryType, GpoAuditor,
    GpoSecuritySettings, GpoSetting, LdapAuditor, LdapConfigFinding, LdapPasswordPolicy,
    LdapSecurityConfig, PrivilegedGroupInfo, TlsConfiguration, check_privileged_groups,
    run_ldap_checks, run_policy_checks,
};

pub mod remediation;

#[cfg(feature = "llm_simple")]
pub use llm_integration::{
    IntelligentCheckRunner, IntelligentScanResult, LLMIntegration, ScanMetadata,
};

pub use remediation::RemediationEngine;
