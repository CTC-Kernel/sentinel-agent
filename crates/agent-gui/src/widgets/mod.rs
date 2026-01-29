//! Reusable UI widgets for the Sentinel Agent GUI.

mod compliance_gauge;
mod resource_bar;
mod status_badge;
mod card;
mod sidebar;
mod header;

pub use compliance_gauge::compliance_gauge;
pub use resource_bar::resource_bar;
pub use status_badge::status_badge;
pub use card::card;
pub use sidebar::Sidebar;
pub use header::page_header;
