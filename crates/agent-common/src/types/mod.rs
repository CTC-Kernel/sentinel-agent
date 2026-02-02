//! Domain types for the Sentinel GRC Agent.
//!
//! This module contains the core domain types used across the agent.

mod agent;
mod check;
mod event;
pub mod fim;
mod proof;
pub mod remediation;
pub mod usb;

pub use agent::*;
pub use check::*;
pub use event::*;
pub use fim::*;
pub use proof::*;
pub use remediation::*;
pub use usb::*;
