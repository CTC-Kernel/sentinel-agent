//! USB device monitoring types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Represents a USB device detected on the system.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UsbDevice {
    /// USB vendor ID.
    pub vendor_id: u16,

    /// USB product ID.
    pub product_id: u16,

    /// Device serial number (if available).
    pub serial: Option<String>,

    /// Device description / product name.
    pub description: String,

    /// USB device class code.
    pub class: UsbDeviceClass,
}

/// USB device class codes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UsbDeviceClass {
    /// Mass storage device (USB drives, external HDDs).
    MassStorage,
    /// Human interface device (keyboard, mouse).
    Hid,
    /// Audio device.
    Audio,
    /// Video device (webcam).
    Video,
    /// Printer.
    Printer,
    /// Communications device (modem, serial adapter).
    Communications,
    /// Wireless controller (Bluetooth adapter).
    Wireless,
    /// Hub.
    Hub,
    /// Other / unknown class.
    Other,
}

impl UsbDeviceClass {
    /// Classify a USB device from its class code byte.
    pub fn from_class_code(code: u8) -> Self {
        match code {
            0x01 => UsbDeviceClass::Audio,
            0x03 => UsbDeviceClass::Hid,
            0x07 => UsbDeviceClass::Printer,
            0x08 => UsbDeviceClass::MassStorage,
            0x09 => UsbDeviceClass::Hub,
            0x0A => UsbDeviceClass::Communications,
            0x0E => UsbDeviceClass::Video,
            0xE0 => UsbDeviceClass::Wireless,
            _ => UsbDeviceClass::Other,
        }
    }

    /// Human-readable label.
    pub fn label(&self) -> &'static str {
        match self {
            UsbDeviceClass::MassStorage => "Mass Storage",
            UsbDeviceClass::Hid => "HID (Keyboard/Mouse)",
            UsbDeviceClass::Audio => "Audio",
            UsbDeviceClass::Video => "Video",
            UsbDeviceClass::Printer => "Printer",
            UsbDeviceClass::Communications => "Communications",
            UsbDeviceClass::Wireless => "Wireless",
            UsbDeviceClass::Hub => "Hub",
            UsbDeviceClass::Other => "Other",
        }
    }
}

/// Event type for USB device changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UsbEventType {
    /// A USB device was connected.
    Connected,
    /// A USB device was disconnected.
    Disconnected,
}

/// A USB device change event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbEvent {
    /// The device involved.
    pub device: UsbDevice,

    /// Type of event.
    pub event_type: UsbEventType,

    /// When the event was detected.
    pub timestamp: DateTime<Utc>,

    /// Whether this device is on the allowlist.
    pub allowed: bool,
}

/// Policy for USB device control.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbPolicy {
    /// Whether mass storage devices are blocked by default.
    #[serde(default = "default_block_mass_storage")]
    pub block_mass_storage: bool,

    /// Allowed devices by (vendor_id, product_id) pair.
    #[serde(default)]
    pub allowlist: Vec<(u16, u16)>,

    /// Poll interval in seconds.
    #[serde(default = "default_usb_poll_interval")]
    pub poll_interval_secs: u64,
}

fn default_block_mass_storage() -> bool {
    true
}

fn default_usb_poll_interval() -> u64 {
    10
}

impl Default for UsbPolicy {
    fn default() -> Self {
        Self {
            block_mass_storage: true,
            allowlist: Vec::new(),
            poll_interval_secs: 10,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_usb_device_class_from_code() {
        assert_eq!(
            UsbDeviceClass::from_class_code(0x08),
            UsbDeviceClass::MassStorage
        );
        assert_eq!(UsbDeviceClass::from_class_code(0x03), UsbDeviceClass::Hid);
        assert_eq!(UsbDeviceClass::from_class_code(0xFF), UsbDeviceClass::Other);
    }

    #[test]
    fn test_usb_event_serialization() {
        let event = UsbEvent {
            device: UsbDevice {
                vendor_id: 0x046D,
                product_id: 0xC52B,
                serial: Some("ABC123".to_string()),
                description: "Logitech Receiver".to_string(),
                class: UsbDeviceClass::Hid,
            },
            event_type: UsbEventType::Connected,
            timestamp: Utc::now(),
            allowed: true,
        };

        let json = serde_json::to_string(&event).unwrap();
        let parsed: UsbEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.device.vendor_id, 0x046D);
    }

    #[test]
    fn test_usb_policy_default() {
        let policy = UsbPolicy::default();
        assert!(policy.block_mass_storage);
        assert_eq!(policy.poll_interval_secs, 10);
    }
}
