//! Hardware Inventory Module
//!
//! Collects detailed hardware information for CMDB enrichment.
//!
//! # Supported Platforms
//!
//! - Windows: WMI queries
//! - macOS: system_profiler, ioreg
//! - Linux: /sys, /proc, dmidecode (if available)

pub mod types;

pub use types::*;
