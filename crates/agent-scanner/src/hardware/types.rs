//! Hardware Inventory Types
//!
//! Types for detailed hardware information collection.
//! Used for CMDB enrichment and reconciliation.
//!
//! # CMDB Integration
//!
//! These types map to CMDB CI attributes:
//! - `HardwareInventory` → `HardwareCIAttributes`
//! - Used for fingerprint generation and reconciliation matching

use serde::{Deserialize, Serialize};

/// Complete hardware inventory for a device
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HardwareInventory {
    /// CPU information
    pub cpu: CpuInfo,
    /// Memory information
    pub memory: MemoryInfo,
    /// Storage devices
    pub storage: Vec<StorageDevice>,
    /// BIOS/UEFI information
    pub bios: BiosInfo,
    /// Network adapters (beyond basic interfaces)
    pub network_adapters: Vec<NetworkAdapterInfo>,
    /// GPU/Graphics information
    pub gpu: Option<GpuInfo>,
    /// Motherboard information
    pub motherboard: Option<MotherboardInfo>,
    /// Collection timestamp (ISO 8601)
    pub collected_at: String,
    /// Collection duration in milliseconds
    pub collection_duration_ms: u64,
}

/// CPU/Processor information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CpuInfo {
    /// Processor model name (e.g., "Intel Core i7-12700K")
    pub model: String,
    /// Vendor/Manufacturer (Intel, AMD, Apple)
    pub vendor: String,
    /// Number of physical cores
    pub cores: u32,
    /// Number of logical threads
    pub threads: u32,
    /// Base frequency in MHz
    pub base_frequency_mhz: u32,
    /// Max turbo frequency in MHz (if available)
    pub max_frequency_mhz: Option<u32>,
    /// CPU architecture (x86_64, aarch64)
    pub architecture: String,
    /// CPU family
    pub family: Option<String>,
    /// Stepping
    pub stepping: Option<String>,
    /// Cache sizes
    pub cache: Option<CpuCache>,
    /// CPU flags/features
    pub features: Vec<String>,
}

/// CPU cache information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CpuCache {
    /// L1 data cache size in KB
    pub l1d_kb: Option<u32>,
    /// L1 instruction cache size in KB
    pub l1i_kb: Option<u32>,
    /// L2 cache size in KB
    pub l2_kb: Option<u32>,
    /// L3 cache size in KB
    pub l3_kb: Option<u32>,
}

/// Memory/RAM information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MemoryInfo {
    /// Total physical memory in GB
    pub total_gb: f32,
    /// Memory type (DDR4, DDR5, LPDDR4, etc.)
    pub memory_type: String,
    /// Memory speed in MHz
    pub speed_mhz: Option<u32>,
    /// Number of slots used
    pub slots_used: u32,
    /// Total number of slots
    pub slots_total: u32,
    /// Individual memory modules
    pub modules: Vec<MemoryModule>,
    /// ECC support
    pub ecc_supported: bool,
}

/// Individual memory module/DIMM
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MemoryModule {
    /// Slot/bank location
    pub slot: String,
    /// Module size in GB
    pub size_gb: f32,
    /// Module type (DDR4, DDR5)
    pub memory_type: String,
    /// Speed in MHz
    pub speed_mhz: Option<u32>,
    /// Manufacturer
    pub manufacturer: Option<String>,
    /// Part number
    pub part_number: Option<String>,
    /// Serial number
    pub serial_number: Option<String>,
}

/// Storage device information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StorageDevice {
    /// Device name/path (e.g., "/dev/sda", "PhysicalDrive0")
    pub device: String,
    /// Device model
    pub model: String,
    /// Manufacturer/Vendor
    pub vendor: Option<String>,
    /// Serial number (important for CMDB fingerprint)
    pub serial_number: String,
    /// Storage type
    pub device_type: StorageType,
    /// Capacity in GB
    pub capacity_gb: u64,
    /// Interface type (SATA, NVMe, USB)
    pub interface: String,
    /// Health status
    pub health: StorageHealth,
    /// SMART data available
    pub smart_supported: bool,
    /// Firmware version
    pub firmware_version: Option<String>,
    /// Temperature in Celsius (if available)
    pub temperature_celsius: Option<i32>,
    /// Power on hours (if available)
    pub power_on_hours: Option<u64>,
}

/// Storage device type
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum StorageType {
    #[default]
    HDD,
    SSD,
    NVMe,
    Hybrid,
    USB,
    Network,
    Virtual,
    Unknown,
}

/// Storage health status
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum StorageHealth {
    #[default]
    Good,
    Warning,
    Critical,
    Unknown,
}

/// BIOS/UEFI firmware information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BiosInfo {
    /// BIOS vendor (e.g., "American Megatrends", "Phoenix")
    pub vendor: String,
    /// BIOS version
    pub version: String,
    /// Release date (YYYY-MM-DD if available)
    pub release_date: Option<String>,
    /// System serial number (often the machine serial)
    pub serial_number: String,
    /// System UUID
    pub uuid: Option<String>,
    /// UEFI mode
    pub uefi_mode: bool,
    /// Secure Boot enabled
    pub secure_boot: Option<bool>,
}

/// Network adapter detailed information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NetworkAdapterInfo {
    /// Adapter name
    pub name: String,
    /// MAC address (normalized: lowercase, colons)
    pub mac_address: String,
    /// Adapter type
    pub adapter_type: NetworkAdapterType,
    /// Manufacturer
    pub manufacturer: Option<String>,
    /// Model/Product name
    pub model: Option<String>,
    /// Driver name
    pub driver: Option<String>,
    /// Driver version
    pub driver_version: Option<String>,
    /// Link speed in Mbps
    pub speed_mbps: Option<u32>,
    /// Is this the primary adapter?
    pub is_primary: bool,
}

/// Network adapter type
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum NetworkAdapterType {
    #[default]
    Ethernet,
    WiFi,
    Bluetooth,
    Virtual,
    VPN,
    Loopback,
    Unknown,
}

/// GPU/Graphics information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GpuInfo {
    /// GPU name/model
    pub name: String,
    /// Manufacturer (NVIDIA, AMD, Intel, Apple)
    pub vendor: String,
    /// VRAM in MB
    pub vram_mb: Option<u32>,
    /// Driver version
    pub driver_version: Option<String>,
    /// Is this a discrete GPU?
    pub discrete: bool,
}

/// Motherboard information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MotherboardInfo {
    /// Manufacturer
    pub manufacturer: String,
    /// Product/Model name
    pub product: String,
    /// Serial number
    pub serial_number: Option<String>,
    /// BIOS version (redundant with BiosInfo but sometimes different source)
    pub version: Option<String>,
}

// =============================================================================
// IMPLEMENTATIONS
// =============================================================================

impl HardwareInventory {
    /// Create a new empty inventory
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if inventory has meaningful data
    pub fn is_populated(&self) -> bool {
        !self.cpu.model.is_empty() ||
        self.memory.total_gb > 0.0 ||
        !self.storage.is_empty()
    }

    /// Get the primary storage device (usually first non-USB)
    pub fn primary_storage(&self) -> Option<&StorageDevice> {
        self.storage.iter().find(|s| s.device_type != StorageType::USB)
    }

    /// Get the primary network adapter
    pub fn primary_network_adapter(&self) -> Option<&NetworkAdapterInfo> {
        self.network_adapters.iter().find(|a| a.is_primary)
            .or_else(|| self.network_adapters.first())
    }

    /// Get total storage capacity in GB
    pub fn total_storage_gb(&self) -> u64 {
        self.storage.iter()
            .filter(|s| s.device_type != StorageType::USB && s.device_type != StorageType::Network)
            .map(|s| s.capacity_gb)
            .sum()
    }
}

impl CpuInfo {
    /// Get a display string for the CPU
    pub fn display_name(&self) -> String {
        if self.model.is_empty() {
            format!("{} {} cores", self.vendor, self.cores)
        } else {
            self.model.clone()
        }
    }
}

impl MemoryInfo {
    /// Get a summary string
    pub fn summary(&self) -> String {
        format!("{:.1} GB {} ({}/{})",
            self.total_gb,
            self.memory_type,
            self.slots_used,
            self.slots_total
        )
    }
}

impl StorageDevice {
    /// Check if device is healthy
    pub fn is_healthy(&self) -> bool {
        self.health == StorageHealth::Good
    }

    /// Get display type string
    pub fn type_string(&self) -> &'static str {
        match self.device_type {
            StorageType::HDD => "HDD",
            StorageType::SSD => "SSD",
            StorageType::NVMe => "NVMe",
            StorageType::Hybrid => "Hybrid",
            StorageType::USB => "USB",
            StorageType::Network => "Network",
            StorageType::Virtual => "Virtual",
            StorageType::Unknown => "Unknown",
        }
    }
}

impl BiosInfo {
    /// Check if this is a server-grade system (heuristic)
    pub fn is_likely_server(&self) -> bool {
        let vendor_lower = self.vendor.to_lowercase();
        vendor_lower.contains("dell") ||
        vendor_lower.contains("hp") ||
        vendor_lower.contains("supermicro") ||
        vendor_lower.contains("lenovo")
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hardware_inventory_new() {
        let inv = HardwareInventory::new();
        assert!(!inv.is_populated());
    }

    #[test]
    fn test_cpu_display_name() {
        let cpu = CpuInfo {
            model: "Intel Core i7-12700K".to_string(),
            vendor: "Intel".to_string(),
            cores: 12,
            ..Default::default()
        };
        assert_eq!(cpu.display_name(), "Intel Core i7-12700K");
    }

    #[test]
    fn test_cpu_display_name_empty_model() {
        let cpu = CpuInfo {
            model: String::new(),
            vendor: "AMD".to_string(),
            cores: 8,
            ..Default::default()
        };
        assert_eq!(cpu.display_name(), "AMD 8 cores");
    }

    #[test]
    fn test_storage_health() {
        let healthy = StorageDevice {
            health: StorageHealth::Good,
            ..Default::default()
        };
        assert!(healthy.is_healthy());

        let warning = StorageDevice {
            health: StorageHealth::Warning,
            ..Default::default()
        };
        assert!(!warning.is_healthy());
    }

    #[test]
    fn test_total_storage_excludes_usb() {
        let inv = HardwareInventory {
            storage: vec![
                StorageDevice {
                    device_type: StorageType::SSD,
                    capacity_gb: 500,
                    ..Default::default()
                },
                StorageDevice {
                    device_type: StorageType::USB,
                    capacity_gb: 32,
                    ..Default::default()
                },
            ],
            ..Default::default()
        };
        assert_eq!(inv.total_storage_gb(), 500);
    }
}
