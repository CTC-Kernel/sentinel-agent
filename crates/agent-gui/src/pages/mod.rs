//! Application pages.

mod about;
mod compliance;
mod dashboard;
mod logs;
mod network;
mod settings;
mod software;
mod sync;
mod vulnerabilities;

pub use about::AboutPage;
pub use compliance::CompliancePage;
pub use dashboard::DashboardPage;
pub use logs::LogsPage;
pub use network::NetworkPage;
pub use settings::SettingsPage;
pub use software::SoftwarePage;
pub use sync::SyncPage;
pub use vulnerabilities::VulnerabilitiesPage;
