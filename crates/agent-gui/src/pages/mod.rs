//! Application pages.

mod about;
mod compliance;
mod dashboard;
mod terminal;
mod discovery;
pub mod cartography;
mod network;
mod settings;
mod software;
mod sync;
mod vulnerabilities;

pub use about::AboutPage;
pub use compliance::CompliancePage;
pub use dashboard::DashboardPage;
pub use terminal::TerminalPage;
pub use discovery::DiscoveryPage;
pub use cartography::CartographyPage;
pub use network::NetworkPage;
pub use settings::SettingsPage;
pub use software::SoftwarePage;
pub use sync::SyncPage;
pub use vulnerabilities::VulnerabilitiesPage;
