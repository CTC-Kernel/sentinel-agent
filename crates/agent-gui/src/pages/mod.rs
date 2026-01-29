//! Application pages.

mod dashboard;
mod compliance;
mod network;
mod sync;
mod logs;
mod settings;
mod about;

pub use dashboard::DashboardPage;
pub use compliance::CompliancePage;
pub use network::NetworkPage;
pub use sync::SyncPage;
pub use logs::LogsPage;
pub use settings::SettingsPage;
pub use about::AboutPage;
