//! Agent Persistence - Extended persistence layer for Sentinel GRC Agent v2 features.
//!
//! This crate provides additional database repositories, migration support,
//! and data management features for v2 including:
//! - GUI notification storage
//! - Agent event log
//! - Policy snapshot history
//! - Database backup and restore
//! - Database recovery and integrity checking
//! - Identity migration across machines
//! - Encryption key rotation
//! - Clean uninstall and reinstall preparation
//!
//! It builds on top of `agent-storage` and shares the same encrypted database.
//!
//! # Modules
//!
//! - [`migration_v2`] - Schema migration for v2 tables
//! - [`repositories`] - Repository implementations for v2 entities
//! - [`backup`] - Database backup and restore
//! - [`recovery`] - Integrity checking and repair
//! - [`migration`] - Identity export/import for machine migration
//! - [`key_rotation`] - Database encryption key rotation
//! - [`cleanup`] - Clean uninstall and reinstall preparation

pub mod backup;
pub mod cleanup;
pub mod error;
pub mod key_rotation;
pub mod migration;
pub mod migration_v2;
pub mod recovery;
pub mod repositories;

pub use backup::{BackupManager, BackupMetadata, BackupReason};
pub use cleanup::{CleanupManager, CleanupResult};
pub use error::{PersistenceError, PersistenceResult};
pub use key_rotation::{KeyRotationManager, KeyRotationResult, KeyRotationSchedule};
pub use migration::{HardwareChangeResult, IdentityExport, MigrationManager};
pub use migration_v2::run_v2_migrations;
pub use recovery::{IntegrityCheck, IntegrityReport, RecoveryAction, RecoveryManager};
pub use repositories::events::EventsRepository;
pub use repositories::notifications::NotificationsRepository;
pub use repositories::policy_snapshots::PolicySnapshotsRepository;
