//! USB device monitoring module.
//!
//! Periodically polls connected USB devices and detects connections/disconnections.
//! Supports an allowlist-based policy for device control.

use agent_common::types::{UsbDevice, UsbDeviceClass, UsbEvent, UsbEventType, UsbPolicy};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, info, warn};

/// USB device monitor that tracks connected devices.
pub struct UsbMonitor {
    /// Current policy.
    policy: UsbPolicy,

    /// Previously seen devices (vendor_id:product_id -> device).
    known_devices: HashMap<String, UsbDevice>,
}

impl UsbMonitor {
    /// Create a new USB monitor with default policy.
    pub fn new() -> Self {
        Self {
            policy: UsbPolicy::default(),
            known_devices: HashMap::new(),
        }
    }

    /// Create with a specific policy.
    pub fn with_policy(policy: UsbPolicy) -> Self {
        Self {
            policy,
            known_devices: HashMap::new(),
        }
    }

    /// Scan for connected USB devices and return change events.
    ///
    /// Compares current devices with previous scan to detect connections/disconnections.
    pub fn scan(&mut self) -> Vec<UsbEvent> {
        let current_devices = self.enumerate_devices();
        let mut events = Vec::new();

        // Build a map of current devices
        let mut current_map: HashMap<String, UsbDevice> = HashMap::new();
        for device in &current_devices {
            let key = device_key(device);
            current_map.insert(key, device.clone());
        }

        // Detect new connections
        for (key, device) in &current_map {
            if !self.known_devices.contains_key(key) {
                let allowed = self.is_device_allowed(device);
                info!(
                    "USB device connected: {} ({}:{:04X}:{:04X}) - {}",
                    device.description,
                    device.class.label(),
                    device.vendor_id,
                    device.product_id,
                    if allowed { "allowed" } else { "BLOCKED" }
                );

                events.push(UsbEvent {
                    device: device.clone(),
                    event_type: UsbEventType::Connected,
                    timestamp: Utc::now(),
                    allowed,
                });
            }
        }

        // Detect disconnections
        for (key, device) in &self.known_devices {
            if !current_map.contains_key(key) {
                debug!(
                    "USB device disconnected: {} ({:04X}:{:04X})",
                    device.description, device.vendor_id, device.product_id
                );

                events.push(UsbEvent {
                    device: device.clone(),
                    event_type: UsbEventType::Disconnected,
                    timestamp: Utc::now(),
                    allowed: true,
                });
            }
        }

        // Update known devices
        self.known_devices = current_map;

        events
    }

    /// Check if a device is allowed by policy.
    pub fn is_device_allowed(&self, device: &UsbDevice) -> bool {
        // Check explicit allowlist
        if self
            .policy
            .allowlist
            .contains(&(device.vendor_id, device.product_id))
        {
            return true;
        }

        // Block mass storage if policy says so
        if self.policy.block_mass_storage && device.class == UsbDeviceClass::MassStorage {
            return false;
        }

        // Allow everything else
        true
    }

    /// Get currently connected devices.
    pub fn current_devices(&self) -> Vec<&UsbDevice> {
        self.known_devices.values().collect()
    }

    /// Update the USB policy.
    pub fn update_policy(&mut self, policy: UsbPolicy) {
        self.policy = policy;
    }

    /// Enumerate connected USB devices using platform-specific methods.
    fn enumerate_devices(&self) -> Vec<UsbDevice> {
        #[cfg(target_os = "linux")]
        {
            self.enumerate_linux()
        }
        #[cfg(target_os = "macos")]
        {
            self.enumerate_macos()
        }
        #[cfg(target_os = "windows")]
        {
            self.enumerate_windows()
        }
        #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
        {
            vec![]
        }
    }

    /// Enumerate USB devices on Linux using /sys/bus/usb/devices/.
    #[cfg(target_os = "linux")]
    fn enumerate_linux(&self) -> Vec<UsbDevice> {
        use std::fs;
        use std::path::Path;

        let mut devices = Vec::new();
        let usb_path = Path::new("/sys/bus/usb/devices");

        if !usb_path.exists() {
            return devices;
        }

        let entries = match fs::read_dir(usb_path) {
            Ok(e) => e,
            Err(_) => return devices,
        };

        for entry in entries.flatten() {
            let path = entry.path();

            // Read vendor and product IDs
            let vendor_id = read_sysfs_hex(&path.join("idVendor"));
            let product_id = read_sysfs_hex(&path.join("idProduct"));

            if let (Some(vid), Some(pid)) = (vendor_id, product_id) {
                if vid == 0 && pid == 0 {
                    continue; // Skip root hubs
                }

                let description = read_sysfs_string(&path.join("product"))
                    .unwrap_or_else(|| format!("USB Device {:04X}:{:04X}", vid, pid));

                let serial = read_sysfs_string(&path.join("serial"));

                let class_code = read_sysfs_hex(&path.join("bDeviceClass")).unwrap_or(0) as u8;

                devices.push(UsbDevice {
                    vendor_id: vid,
                    product_id: pid,
                    serial,
                    description,
                    class: UsbDeviceClass::from_class_code(class_code),
                });
            }
        }

        devices
    }

    /// Enumerate USB devices on macOS using system_profiler.
    #[cfg(target_os = "macos")]
    fn enumerate_macos(&self) -> Vec<UsbDevice> {
        use std::process::Command;

        let output = match Command::new("system_profiler")
            .args(["SPUSBDataType", "-json"])
            .output()
        {
            Ok(o) => o,
            Err(_) => return vec![],
        };

        let json_str = String::from_utf8_lossy(&output.stdout);
        let parsed: serde_json::Value = match serde_json::from_str(&json_str) {
            Ok(v) => v,
            Err(_) => return vec![],
        };

        let mut devices = Vec::new();
        if let Some(usb_data) = parsed.get("SPUSBDataType").and_then(|d| d.as_array()) {
            collect_macos_devices(usb_data, &mut devices);
        }

        devices
    }

    /// Enumerate USB devices on Windows using PowerShell.
    #[cfg(target_os = "windows")]
    fn enumerate_windows(&self) -> Vec<UsbDevice> {
        use std::process::Command;

        let output = match Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-PnpDevice -Class USB | Select-Object FriendlyName, InstanceId, Status | ConvertTo-Json",
            ])
            .output()
        {
            Ok(o) => o,
            Err(_) => return vec![],
        };

        let json_str = String::from_utf8_lossy(&output.stdout);
        let parsed: Vec<serde_json::Value> = match serde_json::from_str(&json_str) {
            Ok(v) => v,
            Err(_) => {
                // Try parsing as single object
                match serde_json::from_str::<serde_json::Value>(&json_str) {
                    Ok(v) => vec![v],
                    Err(_) => return vec![],
                }
            }
        };

        let mut devices = Vec::new();
        for item in &parsed {
            let name = item["FriendlyName"]
                .as_str()
                .unwrap_or("Unknown USB Device");
            let instance_id = item["InstanceId"].as_str().unwrap_or("");

            // Parse VID/PID from InstanceId (e.g., "USB\VID_046D&PID_C52B\...")
            let (vid, pid) = parse_windows_instance_id(instance_id);

            if vid == 0 && pid == 0 {
                continue;
            }

            devices.push(UsbDevice {
                vendor_id: vid,
                product_id: pid,
                serial: None,
                description: name.to_string(),
                class: UsbDeviceClass::Other,
            });
        }

        devices
    }
}

impl Default for UsbMonitor {
    fn default() -> Self {
        Self::new()
    }
}

/// Generate a unique key for a device.
fn device_key(device: &UsbDevice) -> String {
    format!(
        "{:04X}:{:04X}:{}",
        device.vendor_id,
        device.product_id,
        device.serial.as_deref().unwrap_or("none")
    )
}

/// Read a hex value from a sysfs file.
#[cfg(target_os = "linux")]
fn read_sysfs_hex(path: &std::path::Path) -> Option<u16> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| u16::from_str_radix(s.trim(), 16).ok())
}

/// Read a string from a sysfs file.
#[cfg(target_os = "linux")]
fn read_sysfs_string(path: &std::path::Path) -> Option<String> {
    std::fs::read_to_string(path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Recursively collect USB devices from macOS system_profiler JSON.
#[cfg(target_os = "macos")]
fn collect_macos_devices(items: &[serde_json::Value], devices: &mut Vec<UsbDevice>) {
    for item in items {
        if let Some(name) = item.get("_name").and_then(|n| n.as_str()) {
            let vid_str = item
                .get("vendor_id")
                .and_then(|v| v.as_str())
                .unwrap_or("0x0000");
            let pid_str = item
                .get("product_id")
                .and_then(|v| v.as_str())
                .unwrap_or("0x0000");

            let vid = u16::from_str_radix(vid_str.trim_start_matches("0x"), 16).unwrap_or(0);
            let pid = u16::from_str_radix(pid_str.trim_start_matches("0x"), 16).unwrap_or(0);

            if vid != 0 || pid != 0 {
                let serial = item
                    .get("serial_num")
                    .and_then(|s| s.as_str())
                    .map(|s| s.to_string());

                devices.push(UsbDevice {
                    vendor_id: vid,
                    product_id: pid,
                    serial,
                    description: name.to_string(),
                    class: UsbDeviceClass::Other,
                });
            }
        }

        // Recurse into sub-items
        if let Some(sub_items) = item.get("_items").and_then(|i| i.as_array()) {
            collect_macos_devices(sub_items, devices);
        }
    }
}

/// Parse VID/PID from a Windows PnP instance ID.
#[cfg(target_os = "windows")]
fn parse_windows_instance_id(instance_id: &str) -> (u16, u16) {
    let mut vid = 0u16;
    let mut pid = 0u16;

    for part in instance_id.split('&') {
        let part_upper = part.to_uppercase();
        if part_upper.starts_with("VID_") || part_upper.contains("\\VID_") {
            if let Some(hex) = part_upper.split("VID_").nth(1) {
                vid = u16::from_str_radix(&hex[..4.min(hex.len())], 16).unwrap_or(0);
            }
        }
        if part_upper.starts_with("PID_") {
            if let Some(hex) = part_upper.split("PID_").nth(1) {
                pid = u16::from_str_radix(&hex[..4.min(hex.len())], 16).unwrap_or(0);
            }
        }
    }

    (vid, pid)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_usb_monitor_creation() {
        let monitor = UsbMonitor::new();
        assert!(monitor.current_devices().is_empty());
    }

    #[test]
    fn test_device_key() {
        let device = UsbDevice {
            vendor_id: 0x046D,
            product_id: 0xC52B,
            serial: Some("ABC".to_string()),
            description: "Test".to_string(),
            class: UsbDeviceClass::Hid,
        };

        let key = device_key(&device);
        assert_eq!(key, "046D:C52B:ABC");
    }

    #[test]
    fn test_is_device_allowed() {
        let monitor = UsbMonitor::new();

        // HID device should be allowed
        let hid = UsbDevice {
            vendor_id: 0x046D,
            product_id: 0xC52B,
            serial: None,
            description: "Mouse".to_string(),
            class: UsbDeviceClass::Hid,
        };
        assert!(monitor.is_device_allowed(&hid));

        // Mass storage should be blocked by default
        let storage = UsbDevice {
            vendor_id: 0x0781,
            product_id: 0x5567,
            serial: None,
            description: "USB Drive".to_string(),
            class: UsbDeviceClass::MassStorage,
        };
        assert!(!monitor.is_device_allowed(&storage));
    }

    #[test]
    fn test_allowlist() {
        let policy = UsbPolicy {
            block_mass_storage: true,
            allowlist: vec![(0x0781, 0x5567)],
            poll_interval_secs: 10,
        };
        let monitor = UsbMonitor::with_policy(policy);

        let storage = UsbDevice {
            vendor_id: 0x0781,
            product_id: 0x5567,
            serial: None,
            description: "Approved Drive".to_string(),
            class: UsbDeviceClass::MassStorage,
        };
        assert!(monitor.is_device_allowed(&storage)); // On allowlist
    }

    #[test]
    fn test_scan_detects_changes() {
        let mut monitor = UsbMonitor::new();
        // First scan establishes baseline
        let _events = monitor.scan();
        // Subsequent scan with no changes should return no events
        let events2 = monitor.scan();
        assert!(events2.is_empty());
    }
}
