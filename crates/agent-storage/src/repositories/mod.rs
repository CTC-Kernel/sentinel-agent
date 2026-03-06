// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Repository modules for database access.
//!
//! This module provides repository patterns for CRUD operations on database entities.

pub mod audit_trail;
pub mod check_results;
pub mod check_rules;
pub mod config;
pub mod discovered_devices;
pub mod grc;
pub mod proofs;
pub mod sync_queue;

pub use audit_trail::{AuditTrailRepository, StoredAuditEntry};
pub use check_results::CheckResultsRepository;
pub use check_rules::CheckRulesRepository;
pub use config::ConfigRepository;
pub use discovered_devices::{DiscoveredDevicesRepository, StoredDevice};
pub use grc::{
    AlertRuleRepository, DetectionRuleRepository, KpiSnapshotRepository, ManagedAssetRepository,
    PlaybookRepository, RiskRepository, SoftwareInventoryRepository, StoredAlertRule,
    StoredDetectionRule, StoredKpiSnapshot, StoredManagedAsset, StoredPlaybook, StoredRisk,
    StoredSoftwareInventory, StoredWebhook, WebhookRepository,
};
pub use proofs::ProofsRepository;
pub use sync_queue::SyncQueueRepository;
