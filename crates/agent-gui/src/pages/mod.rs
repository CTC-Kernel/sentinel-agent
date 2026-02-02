//! Application pages.

mod about;
pub mod cartography;
mod compliance;
mod dashboard;
mod discovery;
mod fim;
mod monitoring;
mod network;
mod notifications;
mod settings;
mod software;
mod sync;
mod terminal;
mod threats;
mod vulnerabilities;

pub use about::AboutPage;
pub use cartography::CartographyPage;
pub use compliance::CompliancePage;
pub use dashboard::DashboardPage;
pub use discovery::DiscoveryPage;
pub use fim::FimPage;
pub use monitoring::MonitoringPage;
pub use network::NetworkPage;
pub use notifications::NotificationsPage;
pub use settings::SettingsPage;
pub use software::SoftwarePage;
pub use sync::SyncPage;
pub use terminal::TerminalPage;
pub use threats::ThreatsPage;
pub use vulnerabilities::VulnerabilitiesPage;
