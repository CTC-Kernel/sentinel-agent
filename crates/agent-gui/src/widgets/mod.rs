//! Reusable UI widgets for the Sentinel Agent GUI.

mod card;
mod compliance_gauge;
mod header;
mod resource_bar;
mod sidebar;
mod status_badge;

pub use card::card;
pub use compliance_gauge::compliance_gauge;
pub use header::page_header;
pub use resource_bar::resource_bar;
pub use sidebar::Sidebar;
pub use status_badge::status_badge;
