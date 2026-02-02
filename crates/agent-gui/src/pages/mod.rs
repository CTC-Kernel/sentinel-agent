//! Application pages.

mod about;
mod compliance;
mod dashboard;
mod terminal;
mod discovery;
pub mod cartography;
mod network;
mod notifications;
mod settings;
mod software;
mod sync;
mod fim;
mod monitoring;
mod threats;
mod vulnerabilities;

pub use about::AboutPage;
pub use compliance::CompliancePage;
pub use dashboard::DashboardPage;
pub use terminal::TerminalPage;
pub use discovery::DiscoveryPage;
pub use cartography::CartographyPage;
pub use fim::FimPage;
pub use monitoring::MonitoringPage;
pub use threats::ThreatsPage;
pub use network::NetworkPage;
pub use notifications::NotificationsPage;
pub use settings::SettingsPage;
pub use software::SoftwarePage;
pub use sync::SyncPage;
pub use vulnerabilities::VulnerabilitiesPage;
