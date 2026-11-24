// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! USB device monitoring module.
//!
//! Periodically polls connected USB devices and detects connections/disconnections.
//! Supports an allowlist-based policy for device control, enforced with what
//! the system offers (see [`super::usb_block`]).

#[cfg(any(target_os = "macos", target_os = "windows"))]
use agent_common::process::silent_command;
use agent_common::types::{UsbDevice, UsbDeviceClass, UsbEvent, UsbEventType, UsbPolicy};
use chrono::Utc;
use std::collections::HashMap;
use tracing::{debug, info, warn};

use super::usb_block::{self, EnforcementState, SeenDevice, UsbEnforcement};

/// USB device monitor that tracks connected devices.
pub struct UsbMonitor {
    /// Current policy.
    policy: UsbPolicy,

    /// Previously seen devices (vendor_id:product_id -> device).
    known_devices: HashMap<String, UsbDevice>,

    /// Whether USB monitoring is turned on (`usb_monitoring`).
    enabled: bool,

    /// Whether what the agent put in place was withdrawn since monitoring
    /// was turned off.
    released: bool,

    /// What the enforcement remembers between scans.
    enforcement_state: EnforcementState,

    /// What is in force, as of the last scan.
    enforcement: UsbEnforcement,
}

impl UsbMonitor {
    /// Create a new USB monitor with default policy.
    pub fn new() -> Self {
        Self::with_policy(UsbPolicy::default())
    }

    /// Create from the agent configuration: `usb_monitoring` turns the
    /// monitor on or off, `usb_block_mass_storage` is the policy until the
    /// platform sends one.
    pub fn from_config(monitoring: bool, block_mass_storage: bool) -> Self {
        let mut monitor = Self::with_policy(UsbPolicy {
            block_mass_storage,
            ..UsbPolicy::default()
        });
        monitor.set_enabled(monitoring);
        monitor
    }

    /// Create with a specific policy.
    pub fn with_policy(policy: UsbPolicy) -> Self {
        Self {
            policy,
            known_devices: HashMap::new(),
            enabled: true,
            released: false,
            enforcement_state: EnforcementState::default(),
            enforcement: UsbEnforcement::default(),
        }
    }

    /// Turn USB monitoring on or off. Off, nothing is enumerated, reported
    /// or blocked, and what the agent had put in place is withdrawn at the
    /// next scan.
    pub fn set_enabled(&mut self, enabled: bool) {
        if self.enabled != enabled {
            info!(
                "USB monitoring {}",
                if enabled { "enabled" } else { "disabled" }
            );
        }
        self.enabled = enabled;
        if !enabled {
            self.enforcement = UsbEnforcement::disabled();
        }
    }

    /// Whether USB monitoring is turned on.
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// What the agent does about USB mass storage on this host, as of the
    /// last scan: blocking, ejecting, or detecting only.
    pub fn enforcement(&self) -> UsbEnforcement {
        self.enforcement.clone()
    }

    /// Scan for connected USB devices and return change events.
    ///
    /// Compares current devices with previous scan to detect
    /// connections/disconnections, then applies the mass-storage policy:
    /// every device blocked (or ejected) by this scan gets a `Blocked` event.
    pub fn scan(&mut self) -> Vec<UsbEvent> {
        if !self.enabled {
            if !self.released {
                // Withdraw the rule or the driver policy, and give back
                // the devices that were blocked.
                let seen = self.enumerate_devices();
                usb_block::enforce(
                    &self.policy,
                    false,
                    &seen,
                    device_key,
                    &mut self.enforcement_state,
                );
                self.released = true;
            }
            self.known_devices.clear();
            self.enforcement = UsbEnforcement::disabled();
            return Vec::new();
        }
        self.released = false;

        let seen = self.enumerate_devices();
        let mut events = Vec::new();

        // Build a map of current devices
        let mut current_map: HashMap<String, UsbDevice> = HashMap::new();
        for SeenDevice { device, .. } in &seen {
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
                    if allowed {
                        "allowed"
                    } else {
                        "not allowed by policy"
                    }
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

        // Apply the policy to what is connected now.
        let (enforcement, blocked) = usb_block::enforce(
            &self.policy,
            self.policy.block_mass_storage,
            &seen,
            device_key,
            &mut self.enforcement_state,
        );
        if enforcement != self.enforcement {
            info!(
                "USB mass-storage enforcement: {} ({})",
                enforcement.mode.code(),
                enforcement.detail
            );
        }
        self.enforcement = enforcement;
        for device in blocked {
            warn!(
                "USB mass-storage device blocked by policy ({}): {} ({:04X}:{:04X})",
                self.enforcement.mode.code(),
                device.description,
                device.vendor_id,
                device.product_id
            );
            events.push(UsbEvent {
                device,
                event_type: UsbEventType::Blocked,
                timestamp: Utc::now(),
                allowed: false,
            });
        }

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
    fn enumerate_devices(&self) -> Vec<SeenDevice> {
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
    fn enumerate_linux(&self) -> Vec<SeenDevice> {
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
                // Storage devices declare their class on the interface
                // (the device class is 00): look there.
                let class = if usb_block::storage_interfaces(&path).is_empty() {
                    UsbDeviceClass::from_class_code(class_code)
                } else {
                    UsbDeviceClass::MassStorage
                };

                devices.push(SeenDevice {
                    device: UsbDevice {
                        vendor_id: vid,
                        product_id: pid,
                        serial,
                        description,
                        class,
                    },
                    handle: Some(path.to_string_lossy().to_string()),
                });
            }
        }

        devices
    }

    /// Enumerate USB devices on macOS from the I/O Registry, which gives
    /// the interface classes and the disks of each device. `system_profiler`
    /// is the fallback: its `SPUSBDataType` is empty since macOS 26, and it
    /// never said which device is a storage device.
    #[cfg(target_os = "macos")]
    fn enumerate_macos(&self) -> Vec<SeenDevice> {
        let registry = silent_command("ioreg")
            .args(["-r", "-c", "IOUSBHostDevice", "-l", "-w", "0"])
            .output()
            .map(|o| parse_ioreg_usb(&String::from_utf8_lossy(&o.stdout)))
            .unwrap_or_default();
        if !registry.is_empty() {
            return registry;
        }

        let output = match silent_command("system_profiler")
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
            .into_iter()
            .map(|device| SeenDevice {
                device,
                handle: None,
            })
            .collect()
    }

    /// Enumerate USB devices on Windows using PowerShell.
    #[cfg(target_os = "windows")]
    fn enumerate_windows(&self) -> Vec<SeenDevice> {
        let output = match silent_command("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-PnpDevice -Class USB -PresentOnly | Select-Object FriendlyName, InstanceId, Status, Service | ConvertTo-Json",
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

            devices.push(SeenDevice {
                device: UsbDevice {
                    vendor_id: vid,
                    product_id: pid,
                    serial: None,
                    description: name.to_string(),
                    class: windows_class(item["Service"].as_str().unwrap_or_default()),
                },
                handle: Some(instance_id.to_string()),
            });
        }

        devices
    }
}

/// The class of a Windows USB device, from the driver serving it: only
/// storage is told apart, which is what the policy needs.
#[cfg(any(target_os = "windows", test))]
fn windows_class(service: &str) -> UsbDeviceClass {
    if usb_block::STORAGE_SERVICES
        .iter()
        .any(|storage| storage.eq_ignore_ascii_case(service))
    {
        UsbDeviceClass::MassStorage
    } else {
        UsbDeviceClass::Other
    }
}

/// USB devices in the output of `ioreg -r -c IOUSBHostDevice -l`.
///
/// Each `+-o` line opens a registry entry, indented by its depth; the
/// properties that follow belong to it. A device is an entry of class
/// `IOUSBHostDevice`; what is below it and says `"bInterfaceClass" = 8`
/// makes it a storage device, and the whole disks below it (`"BSD Name"`
/// with `"Whole" = Yes`) are what the policy ejects.
#[cfg(any(target_os = "macos", test))]
fn parse_ioreg_usb(output: &str) -> Vec<SeenDevice> {
    struct Entry {
        depth: usize,
        /// The device this entry is, or is below.
        device: Option<usize>,
        /// Whether this entry is the device itself.
        is_device: bool,
        bsd_name: Option<String>,
        whole: bool,
    }
    let mut devices: Vec<(SeenDevice, Vec<String>)> = Vec::new();
    let mut stack: Vec<Entry> = Vec::new();

    for line in output.lines() {
        if let Some(depth) = line.find("+-o ") {
            while stack.last().is_some_and(|entry| entry.depth >= depth) {
                stack.pop();
            }
            let is_device = line.contains("<class IOUSBHostDevice,");
            let device = if is_device {
                let name = line[depth + 4..]
                    .split(['@', '<'])
                    .next()
                    .unwrap_or_default()
                    .trim();
                devices.push((
                    SeenDevice {
                        device: UsbDevice {
                            vendor_id: 0,
                            product_id: 0,
                            serial: None,
                            description: name.to_string(),
                            class: UsbDeviceClass::Other,
                        },
                        handle: None,
                    },
                    Vec::new(),
                ));
                Some(devices.len() - 1)
            } else {
                stack.last().and_then(|parent| parent.device)
            };
            stack.push(Entry {
                depth,
                device,
                is_device,
                bsd_name: None,
                whole: false,
            });
            continue;
        }
        let Some((key, value)) = line.split_once(" = ") else {
            continue;
        };
        let Some(key) = key.rsplit('"').nth(1) else {
            continue;
        };
        let value = value.trim();
        let text = value.trim_matches('"');
        let Some(entry) = stack.last_mut() else {
            continue;
        };
        let own = entry.is_device;
        let Some((seen, disks)) = entry.device.and_then(|index| devices.get_mut(index)) else {
            continue;
        };
        match key {
            "idVendor" if own => seen.device.vendor_id = value.parse().unwrap_or(0),
            "idProduct" if own => seen.device.product_id = value.parse().unwrap_or(0),
            "USB Product Name" | "kUSBProductString" if own && !text.is_empty() => {
                seen.device.description = text.to_string();
            }
            "USB Serial Number" | "kUSBSerialNumberString" if own && !text.is_empty() => {
                seen.device.serial = Some(text.to_string());
            }
            "bDeviceClass" if own && seen.device.class == UsbDeviceClass::Other => {
                seen.device.class = UsbDeviceClass::from_class_code(value.parse().unwrap_or(0));
            }
            "bInterfaceClass" if value == "8" => seen.device.class = UsbDeviceClass::MassStorage,
            "BSD Name" => entry.bsd_name = Some(text.to_string()),
            "Whole" => entry.whole = value == "Yes",
            _ => {}
        }
        // The properties of an entry come in no particular order.
        if entry.whole
            && let Some(disk) = &entry.bsd_name
            && !disks.contains(disk)
        {
            disks.push(disk.clone());
        }
    }

    devices
        .into_iter()
        .filter(|(seen, _)| seen.device.vendor_id != 0 || seen.device.product_id != 0)
        .map(|(mut seen, disks)| {
            seen.handle = (!disks.is_empty()).then(|| disks.join(" "));
            seen
        })
        .collect()
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
        if (part_upper.starts_with("VID_") || part_upper.contains("\\VID_"))
            && let Some(hex) = part_upper.split("VID_").nth(1)
        {
            vid = u16::from_str_radix(&hex[..4.min(hex.len())], 16).unwrap_or(0);
        }
        if part_upper.starts_with("PID_")
            && let Some(hex) = part_upper.split("PID_").nth(1)
        {
            pid = u16::from_str_radix(&hex[..4.min(hex.len())], 16).unwrap_or(0);
        }
    }

    (vid, pid)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// What `ioreg -r -c IOUSBHostDevice -l -w 0` prints for a keyboard and
    /// a USB key behind a hub (trimmed to the properties read).
    const IOREG: &str = r#"+-o USB2.0 Hub@02100000  <class IOUSBHostDevice, id 0x100000a01, registered, matched, active, busy 0 (5 ms), retain 30>
  | {
  |   "idProduct" = 1544
  |   "bDeviceClass" = 9
  |   "USB Product Name" = "USB2.0 Hub"
  |   "idVendor" = 1507
  | }
  | 
  +-o AppleUSB20Hub@02100000  <class AppleUSB20Hub, id 0x100000a05, registered, matched, active, busy 0 (0 ms), retain 12>
  | | {
  | |   "IOClass" = "AppleUSB20Hub"
  | | }
  | | 
  | +-o Cruzer Blade@02110000  <class IOUSBHostDevice, id 0x100000a20, registered, matched, active, busy 0 (9 ms), retain 28>
  |   | {
  |   |   "USB Serial Number" = "4C530001230115110395"
  |   |   "idProduct" = 21863
  |   |   "bDeviceClass" = 0
  |   |   "USB Product Name" = "Cruzer Blade"
  |   |   "idVendor" = 1921
  |   | }
  |   | 
  |   +-o IOUSBHostInterface@0  <class IOUSBHostInterface, id 0x100000a25, registered, matched, active, busy 0 (7 ms), retain 9>
  |     | {
  |     |   "bInterfaceClass" = 8
  |     |   "idVendor" = 1921
  |     | }
  |     | 
  |     +-o SanDisk Cruzer Blade Media  <class IOMedia, id 0x100000a40, registered, matched, active, busy 0 (2 ms), retain 12>
  |       | {
  |       |   "Whole" = Yes
  |       |   "BSD Name" = "disk4"
  |       | }
  |       | 
  |       +-o Untitled 1@1  <class IOMedia, id 0x100000a44, registered, matched, active, busy 0 (0 ms), retain 11>
  |           {
  |             "BSD Name" = "disk4s1"
  |             "Whole" = No
  |           }
  |           
+-o Magic Keyboard@01100000  <class IOUSBHostDevice, id 0x100000b01, registered, matched, active, busy 0 (3 ms), retain 20>
  | {
  |   "idVendor" = 1452
  |   "idProduct" = 620
  |   "bDeviceClass" = 0
  |   "kUSBProductString" = "Magic Keyboard"
  | }
  | 
  +-o IOUSBHostInterface@0  <class IOUSBHostInterface, id 0x100000b05, registered, matched, active, busy 0 (2 ms), retain 8>
      {
        "bInterfaceClass" = 3
      }
"#;

    /// On macOS every device was reported as "other": storage was never
    /// told apart, so the policy never applied to anything.
    #[test]
    fn macos_devices_come_with_their_class_and_their_disks() {
        let devices = parse_ioreg_usb(IOREG);
        assert_eq!(devices.len(), 3);

        let hub = &devices[0];
        assert_eq!(hub.device.class, UsbDeviceClass::Hub);
        assert_eq!((hub.device.vendor_id, hub.device.product_id), (1507, 1544));
        assert_eq!(hub.handle, None, "the key's disk is not the hub's");

        let key = &devices[1];
        assert_eq!(key.device.description, "Cruzer Blade");
        assert_eq!(
            (key.device.vendor_id, key.device.product_id),
            (0x0781, 0x5567)
        );
        assert_eq!(key.device.serial.as_deref(), Some("4C530001230115110395"));
        assert_eq!(key.device.class, UsbDeviceClass::MassStorage);
        assert_eq!(key.handle.as_deref(), Some("disk4"), "whole disks only");

        let keyboard = &devices[2];
        assert_eq!(keyboard.device.description, "Magic Keyboard");
        assert_eq!(keyboard.device.class, UsbDeviceClass::Other);
        assert_eq!(keyboard.handle, None);

        assert!(parse_ioreg_usb("").is_empty());
    }

    #[test]
    fn windows_storage_is_told_apart_by_its_driver() {
        assert_eq!(windows_class("USBSTOR"), UsbDeviceClass::MassStorage);
        assert_eq!(windows_class("uaspstor"), UsbDeviceClass::MassStorage);
        assert_eq!(windows_class("usbhub3"), UsbDeviceClass::Other);
        assert_eq!(windows_class(""), UsbDeviceClass::Other);
    }

    /// `usb_monitoring: false` was read nowhere: the monitor ran anyway.
    #[test]
    fn a_monitor_turned_off_reports_nothing_and_says_so() {
        let mut monitor = UsbMonitor::from_config(false, true);
        assert!(!monitor.is_enabled());
        // Nothing was put in place, so there is nothing to withdraw: the
        // scan must not touch the system.
        monitor.released = true;
        assert!(monitor.scan().is_empty());
        assert!(monitor.current_devices().is_empty());
        assert_eq!(
            monitor.enforcement().mode,
            usb_block::UsbEnforcementMode::Disabled
        );
    }

    /// `usb_block_mass_storage` is the policy until the platform sends one.
    #[test]
    fn the_configuration_sets_the_initial_policy() {
        let storage = UsbDevice {
            vendor_id: 0x0781,
            product_id: 0x5567,
            serial: None,
            description: "Key".to_string(),
            class: UsbDeviceClass::MassStorage,
        };
        assert!(!UsbMonitor::from_config(true, true).is_device_allowed(&storage));
        assert!(UsbMonitor::from_config(true, false).is_device_allowed(&storage));
    }

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
        // Reporting only: a test must not eject or block what is plugged
        // into the machine that runs it.
        let mut monitor = UsbMonitor::from_config(true, false);
        // First scan establishes baseline
        let _events = monitor.scan();
        // Subsequent scan with no changes should return no events
        let events2 = monitor.scan();
        assert!(events2.is_empty());
    }
}
