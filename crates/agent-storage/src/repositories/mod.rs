//! Repository modules for database access.
//!
//! This module provides repository patterns for CRUD operations on database entities.

pub mod check_results;
pub mod check_rules;
pub mod config;
pub mod discovered_devices;
pub mod proofs;
pub mod sync_queue;

pub use check_results::CheckResultsRepository;
pub use check_rules::CheckRulesRepository;
pub use config::ConfigRepository;
pub use discovered_devices::{DiscoveredDevicesRepository, StoredDevice};
pub use proofs::ProofsRepository;
pub use sync_queue::SyncQueueRepository;

