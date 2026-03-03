// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Application pages.

pub(crate) mod about;
mod assets;
mod audit_trail;
pub mod cartography;
mod compliance;
mod dashboard;
mod discovery;
mod fim;
mod monitoring;
mod network;
mod notifications;
mod reports;
mod risks;
mod settings;
mod software;
mod sync;
mod terminal;
mod threats;
mod vulnerabilities;

pub use about::AboutPage;
pub use assets::AssetsPage;
pub use audit_trail::AuditTrailPage;
pub use cartography::CartographyPage;
pub use compliance::CompliancePage;
pub use dashboard::{DashboardAction, DashboardPage};
pub use discovery::DiscoveryPage;
pub use fim::FimPage;
pub use monitoring::MonitoringPage;
pub use network::NetworkPage;
pub use notifications::NotificationsPage;
pub use reports::ReportsPage;
pub use risks::RisksPage;
pub use settings::SettingsPage;
pub use software::SoftwarePage;
pub use sync::SyncPage;
pub use terminal::TerminalPage;
pub use threats::ThreatsPage;
pub use vulnerabilities::VulnerabilitiesPage;
