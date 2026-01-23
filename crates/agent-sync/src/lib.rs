//! Agent Sync - SaaS communication and data synchronization.
//!
//! This crate handles all communication between the Sentinel GRC Agent
//! and the SaaS platform, including:
//!
//! - Agent enrollment with registration tokens
//! - mTLS certificate management
//! - Heartbeat mechanism with metrics
//! - Data synchronization (check results, proofs)
//! - Offline mode and retry logic
//!
//! # Enrollment Flow
//!
//! ```no_run
//! use agent_sync::EnrollmentManager;
//! use agent_common::config::AgentConfig;
//! use agent_storage::{Database, DatabaseConfig, KeyManager};
//!
//! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
//! // Load configuration with enrollment token
//! let config = AgentConfig::load(None)?;
//!
//! // Open encrypted database
//! let key_manager = KeyManager::new()?;
//! let db_config = DatabaseConfig::default();
//! let db = Database::open(db_config, &key_manager)?;
//!
//! // Create enrollment manager
//! let enrollment = EnrollmentManager::new(&config, &db);
//!
//! // Ensure enrolled (uses stored credentials or performs enrollment)
//! let credentials = enrollment.ensure_enrolled().await?;
//! println!("Agent ID: {}", credentials.agent_id);
//! # Ok(())
//! # }
//! ```

pub mod authenticated_client;
pub mod client;
pub mod config_sync;
pub mod diagnostics;
pub mod credentials;
pub mod enrollment;
pub mod error;
pub mod heartbeat;
pub mod integrity;
pub mod offline;
pub mod pinning;
pub mod result_upload;
pub mod rules;
pub mod rollout;
pub mod security;
pub mod types;
pub mod update;
pub mod updater;

pub use authenticated_client::AuthenticatedClient;
pub use client::HttpClient;
pub use credentials::CredentialsRepository;
pub use enrollment::EnrollmentManager;
pub use error::{SyncError, SyncResult};
pub use heartbeat::HeartbeatService;
pub use integrity::{IntegrityChecker, verify_or_exit};
pub use pinning::{CertificatePinning, PinningResult};
pub use config_sync::{
    config_keys, ConfigChangeEvent, ConfigResponse, ConfigSyncResult, ConfigSyncService,
};
pub use offline::{
    CircuitBreaker, CircuitState, ConflictResolution, ConflictStrategy, OfflineStatus,
    OfflineTracker, SyncEntityType, SyncQueueItem, resolve_config_conflict, resolve_rule_conflict,
};
pub use result_upload::{
    CheckResultPayload, ResultUploadRequest, ResultUploadResponse, ResultUploader, UploadResult,
};
pub use rules::{ApiCheckRule, CacheMetadata, RuleSyncResult, RuleSyncService, RulesResponse};
pub use update::{
    AvailableUpdate, RolloutGroup, UpdateCheckRequest, UpdateCheckResponse, UpdateCheckResult,
    UpdatePolicy, UpdateService, UpdateState, DEFAULT_UPDATE_CHECK_INTERVAL_SECS, is_newer_version,
};
pub use updater::{HealthCheckResult, UpdateManager, UpdateMetadata, UpdateResult};
pub use rollout::{
    BlockedVersion, EmergencyRollbackCommand, ManualUpdateCommand, PolicyConfig, RolloutAssignment,
    RolloutService, RolloutStatus,
};
pub use security::{
    LogSigner, RevocationAction, RevocationService, RevocationStatus, SignatureType,
    SignatureValidator, SignatureVerificationResult, SignedLogEntry,
};
pub use diagnostics::{
    AgentHealth, ConnectionState, ConnectionStatus, ConnectionTracker, DiagnosticResult,
    DiagnosticService, ErrorEntry, ErrorTracker, LogBuffer, LogEntry, LogUploadRequest,
    LogUploadResponse, SystemInfo, upload_logs,
};
pub use types::{
    AgentCommand, ApiErrorResponse, CertificateRenewalRequest, CertificateRenewalResponse,
    EnrollmentRequest, EnrollmentResponse, HeartbeatRequest, HeartbeatResponse,
    IncidentReportResponse, IncidentType, InitialConfig, SecurityIncidentReport, SelfCheckResult,
    Severity, StoredCredentials, VulnerabilityFinding, VulnerabilityUploadRequest,
    VulnerabilityUploadResponse,
};
