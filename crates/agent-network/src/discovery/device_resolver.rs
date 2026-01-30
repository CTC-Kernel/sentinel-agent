//! Device resolver and classifier.
//!
//! Resolves hostnames via reverse DNS, maps MAC OUI prefixes to vendors,
//! and classifies devices by type based on vendor, ports, and IP heuristics.

use crate::types::DeviceType;
use std::collections::HashMap;
use tokio::process::Command;
use tracing::{debug, trace};

/// Resolves hostnames and classifies discovered devices.
pub struct DeviceResolver {
    oui_table: HashMap<&'static str, &'static str>,
}

impl DeviceResolver {
    /// Create a new resolver with the embedded OUI vendor table.
    pub fn new() -> Self {
        Self {
            oui_table: Self::build_oui_table(),
        }
    }

    /// Attempt reverse DNS lookup for an IP address.
    pub async fn resolve_hostname(&self, ip: &str) -> Option<String> {
        // Try the system `host` command for reverse DNS
        let result = Command::new("host")
            .arg(ip)
            .output()
            .await;

        match result {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                // Output format: "1.168.192.in-addr.arpa domain name pointer hostname.local."
                Self::parse_host_output(&stdout)
            }
            _ => {
                trace!("Reverse DNS lookup failed for {}", ip);
                None
            }
        }
    }

    /// Parse the output of the `host` command to extract the hostname.
    fn parse_host_output(output: &str) -> Option<String> {
        for line in output.lines() {
            if let Some(idx) = line.find("domain name pointer ") {
                let hostname = line[idx + 20..].trim().trim_end_matches('.');
                if !hostname.is_empty() {
                    return Some(hostname.to_string());
                }
            }
        }
        None
    }

    /// Look up the vendor name for a MAC address via OUI prefix.
    pub fn lookup_vendor(&self, mac: &str) -> Option<String> {
        // Normalize MAC to uppercase and extract first 3 octets
        let normalized = mac.to_uppercase().replace('-', ":");
        let prefix = Self::mac_prefix(&normalized)?;
        self.oui_table.get(prefix.as_str()).map(|v| v.to_string())
    }

    /// Extract the first 3 octets of a MAC address as "XX:XX:XX".
    fn mac_prefix(mac: &str) -> Option<String> {
        let parts: Vec<&str> = mac.split(':').collect();
        if parts.len() >= 3 {
            // Normalize each octet to 2 uppercase hex digits
            let p0 = format!("{:0>2}", parts[0]).to_uppercase();
            let p1 = format!("{:0>2}", parts[1]).to_uppercase();
            let p2 = format!("{:0>2}", parts[2]).to_uppercase();
            Some(format!("{}:{}:{}", p0, p1, p2))
        } else {
            None
        }
    }

    /// Classify a device based on IP, vendor, and open ports.
    pub fn classify_device(
        &self,
        ip: &str,
        vendor: Option<&str>,
        open_ports: &[u16],
        hostname: Option<&str>,
    ) -> DeviceType {
        let vendor_lower = vendor.map(|v| v.to_lowercase()).unwrap_or_default();
        let hostname_lower = hostname.map(|h| h.to_lowercase()).unwrap_or_default();

        // Gateway heuristic: IPs ending in .1 or .254
        if Self::is_likely_gateway(ip) {
            return DeviceType::Router;
        }

        // Vendor-based router detection
        let router_vendors = ["cisco", "ubiquiti", "netgear", "tp-link", "mikrotik", "juniper", "aruba"];
        if router_vendors.iter().any(|v| vendor_lower.contains(v)) {
            return DeviceType::Router;
        }

        // Printer detection: vendor + printer ports
        let printer_ports = [9100, 515, 631];
        if (vendor_lower.contains("hp") || vendor_lower.contains("canon")
            || vendor_lower.contains("epson") || vendor_lower.contains("brother")
            || vendor_lower.contains("xerox") || vendor_lower.contains("lexmark"))
            && open_ports.iter().any(|p| printer_ports.contains(p))
        {
            return DeviceType::Printer;
        }

        // Port-only printer detection
        if open_ports.contains(&9100) {
            return DeviceType::Printer;
        }

        // Server detection: common server ports
        let server_ports = [22, 80, 443, 8080, 8443, 3306, 5432, 6379, 27017];
        let server_port_count = open_ports.iter().filter(|p| server_ports.contains(p)).count();
        if server_port_count >= 2 {
            return DeviceType::Server;
        }

        // Hostname-based hints
        if hostname_lower.contains("server") || hostname_lower.contains("srv") {
            return DeviceType::Server;
        }
        if hostname_lower.contains("printer") || hostname_lower.contains("prn") {
            return DeviceType::Printer;
        }

        // Workstation detection: common desktop/laptop vendors
        let workstation_vendors = [
            "apple", "dell", "lenovo", "microsoft", "asus", "acer", "samsung", "intel",
        ];
        if workstation_vendors.iter().any(|v| vendor_lower.contains(v)) {
            return DeviceType::Workstation;
        }

        // IoT detection
        let iot_vendors = [
            "raspberry", "espressif", "arduino", "nest", "ring", "sonos",
            "philips", "tuya", "shelly", "wyze",
        ];
        if iot_vendors.iter().any(|v| vendor_lower.contains(v)) {
            return DeviceType::IoT;
        }

        // Phone detection
        let phone_vendors = ["oneplus", "xiaomi", "huawei", "google", "motorola"];
        if phone_vendors.iter().any(|v| vendor_lower.contains(v)) {
            return DeviceType::Phone;
        }

        // Single server port still hints at server
        if server_port_count == 1 {
            return DeviceType::Server;
        }

        DeviceType::Unknown
    }

    /// Check if an IP looks like a gateway address (.1 or .254).
    fn is_likely_gateway(ip: &str) -> bool {
        if let Some(last_octet) = ip.rsplit('.').next() {
            matches!(last_octet, "1" | "254")
        } else {
            false
        }
    }

    /// Build the embedded OUI prefix-to-vendor lookup table.
    fn build_oui_table() -> HashMap<&'static str, &'static str> {
        let mut m = HashMap::new();

        // Apple
        m.insert("AC:DE:48", "Apple");
        m.insert("A4:83:E7", "Apple");
        m.insert("F0:18:98", "Apple");
        m.insert("3C:22:FB", "Apple");
        m.insert("D0:03:4B", "Apple");
        m.insert("78:7B:8A", "Apple");
        m.insert("88:66:A5", "Apple");
        m.insert("F8:FF:C2", "Apple");
        m.insert("14:7D:DA", "Apple");
        m.insert("A8:5C:2C", "Apple");
        m.insert("00:1C:B3", "Apple");

        // Dell
        m.insert("00:1A:A0", "Dell");
        m.insert("F8:BC:12", "Dell");
        m.insert("18:03:73", "Dell");
        m.insert("D4:BE:D9", "Dell");
        m.insert("B0:83:FE", "Dell");
        m.insert("00:14:22", "Dell");
        m.insert("24:B6:FD", "Dell");

        // HP / Hewlett-Packard
        m.insert("3C:D9:2B", "HP");
        m.insert("00:1E:0B", "HP");
        m.insert("10:60:4B", "HP");
        m.insert("D4:C9:EF", "HP");
        m.insert("94:57:A5", "HP");
        m.insert("00:21:5A", "HP");
        m.insert("EC:B1:D7", "HP");
        m.insert("2C:27:D7", "HP");

        // Cisco
        m.insert("00:1B:44", "Cisco");
        m.insert("00:26:0B", "Cisco");
        m.insert("00:1D:45", "Cisco");
        m.insert("F4:CF:E2", "Cisco");
        m.insert("00:0C:85", "Cisco");
        m.insert("58:AC:78", "Cisco");
        m.insert("00:17:94", "Cisco");
        m.insert("68:86:A7", "Cisco");

        // VMware
        m.insert("00:50:56", "VMware");
        m.insert("00:0C:29", "VMware");
        m.insert("00:05:69", "VMware");

        // Lenovo
        m.insert("98:FA:9B", "Lenovo");
        m.insert("54:EE:75", "Lenovo");
        m.insert("50:7B:9D", "Lenovo");
        m.insert("C8:5B:76", "Lenovo");

        // Microsoft
        m.insert("00:15:5D", "Microsoft");
        m.insert("00:50:F2", "Microsoft");
        m.insert("28:18:78", "Microsoft");
        m.insert("7C:1E:52", "Microsoft");

        // Samsung
        m.insert("00:15:99", "Samsung");
        m.insert("E4:7C:F9", "Samsung");
        m.insert("BC:72:B1", "Samsung");
        m.insert("94:35:0A", "Samsung");
        m.insert("D0:22:BE", "Samsung");

        // Intel
        m.insert("00:1B:21", "Intel");
        m.insert("3C:97:0E", "Intel");
        m.insert("68:05:CA", "Intel");
        m.insert("F8:63:3F", "Intel");

        // Raspberry Pi Foundation
        m.insert("B8:27:EB", "Raspberry Pi");
        m.insert("DC:A6:32", "Raspberry Pi");
        m.insert("E4:5F:01", "Raspberry Pi");
        m.insert("28:CD:C1", "Raspberry Pi");

        // Ubiquiti
        m.insert("00:27:22", "Ubiquiti");
        m.insert("04:18:D6", "Ubiquiti");
        m.insert("24:A4:3C", "Ubiquiti");
        m.insert("68:72:51", "Ubiquiti");
        m.insert("78:8A:20", "Ubiquiti");
        m.insert("B4:FB:E4", "Ubiquiti");
        m.insert("F0:9F:C2", "Ubiquiti");

        // Netgear
        m.insert("00:1F:33", "Netgear");
        m.insert("C4:3D:C7", "Netgear");
        m.insert("20:E5:2A", "Netgear");
        m.insert("A4:2B:8C", "Netgear");

        // TP-Link
        m.insert("50:C7:BF", "TP-Link");
        m.insert("C0:25:E9", "TP-Link");
        m.insert("EC:08:6B", "TP-Link");
        m.insert("14:CC:20", "TP-Link");
        m.insert("F4:F2:6D", "TP-Link");

        // Asus
        m.insert("00:1A:92", "ASUS");
        m.insert("04:92:26", "ASUS");
        m.insert("AC:9E:17", "ASUS");
        m.insert("2C:FD:A1", "ASUS");

        // Google / Nest
        m.insert("F4:F5:D8", "Google");
        m.insert("54:60:09", "Google");
        m.insert("18:D6:C7", "Google Nest");
        m.insert("A4:77:33", "Google");

        // Amazon / Ring
        m.insert("44:65:0D", "Amazon");
        m.insert("F0:F0:A4", "Amazon");
        m.insert("40:B4:CD", "Amazon Ring");

        // Sonos
        m.insert("00:0E:58", "Sonos");
        m.insert("78:28:CA", "Sonos");
        m.insert("B8:E9:37", "Sonos");

        // Espressif (ESP32/ESP8266 IoT)
        m.insert("24:6F:28", "Espressif");
        m.insert("AC:67:B2", "Espressif");
        m.insert("30:AE:A4", "Espressif");
        m.insert("A4:CF:12", "Espressif");

        // Juniper
        m.insert("00:05:85", "Juniper");
        m.insert("28:C0:DA", "Juniper");
        m.insert("88:E0:F3", "Juniper");

        // Aruba
        m.insert("00:0B:86", "Aruba");
        m.insert("24:DE:C6", "Aruba");
        m.insert("AC:A3:1E", "Aruba");

        // Xerox
        m.insert("00:00:AA", "Xerox");
        m.insert("64:00:F1", "Xerox");

        // Canon
        m.insert("00:1E:8F", "Canon");
        m.insert("18:0C:AC", "Canon");

        // Epson
        m.insert("00:26:AB", "Epson");
        m.insert("AC:18:26", "Epson");

        // Brother
        m.insert("00:80:77", "Brother");
        m.insert("30:05:5C", "Brother");

        // Huawei
        m.insert("00:E0:FC", "Huawei");
        m.insert("48:46:FB", "Huawei");
        m.insert("88:28:B3", "Huawei");

        // Xiaomi
        m.insert("64:CC:2E", "Xiaomi");
        m.insert("28:6C:07", "Xiaomi");
        m.insert("78:11:DC", "Xiaomi");

        // MikroTik
        m.insert("00:0C:42", "MikroTik");
        m.insert("48:8F:5A", "MikroTik");
        m.insert("E4:8D:8C", "MikroTik");

        debug!("OUI vendor table loaded with {} entries", m.len());
        m
    }
}

impl Default for DeviceResolver {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lookup_vendor_apple() {
        let resolver = DeviceResolver::new();
        assert_eq!(resolver.lookup_vendor("AC:DE:48:11:22:33"), Some("Apple".to_string()));
    }

    #[test]
    fn test_lookup_vendor_vmware() {
        let resolver = DeviceResolver::new();
        assert_eq!(resolver.lookup_vendor("00:50:56:aa:bb:cc"), Some("VMware".to_string()));
    }

    #[test]
    fn test_lookup_vendor_cisco() {
        let resolver = DeviceResolver::new();
        assert_eq!(resolver.lookup_vendor("00:1B:44:aa:bb:cc"), Some("Cisco".to_string()));
    }

    #[test]
    fn test_lookup_vendor_raspberry_pi() {
        let resolver = DeviceResolver::new();
        assert_eq!(resolver.lookup_vendor("B8:27:EB:00:11:22"), Some("Raspberry Pi".to_string()));
    }

    #[test]
    fn test_lookup_vendor_unknown() {
        let resolver = DeviceResolver::new();
        assert_eq!(resolver.lookup_vendor("FF:FF:FF:FF:FF:FF"), None);
    }

    #[test]
    fn test_lookup_vendor_case_insensitive() {
        let resolver = DeviceResolver::new();
        assert_eq!(resolver.lookup_vendor("ac:de:48:11:22:33"), Some("Apple".to_string()));
    }

    #[test]
    fn test_classify_gateway() {
        let resolver = DeviceResolver::new();
        assert_eq!(
            resolver.classify_device("192.168.1.1", None, &[], None),
            DeviceType::Router,
        );
        assert_eq!(
            resolver.classify_device("10.0.0.254", None, &[], None),
            DeviceType::Router,
        );
    }

    #[test]
    fn test_classify_cisco_router() {
        let resolver = DeviceResolver::new();
        assert_eq!(
            resolver.classify_device("192.168.1.50", Some("Cisco"), &[], None),
            DeviceType::Router,
        );
    }

    #[test]
    fn test_classify_printer_vendor_and_port() {
        let resolver = DeviceResolver::new();
        assert_eq!(
            resolver.classify_device("192.168.1.30", Some("HP"), &[9100], None),
            DeviceType::Printer,
        );
    }

    #[test]
    fn test_classify_printer_by_port() {
        let resolver = DeviceResolver::new();
        assert_eq!(
            resolver.classify_device("192.168.1.30", None, &[9100], None),
            DeviceType::Printer,
        );
    }

    #[test]
    fn test_classify_server() {
        let resolver = DeviceResolver::new();
        assert_eq!(
            resolver.classify_device("192.168.1.100", None, &[22, 443], None),
            DeviceType::Server,
        );
    }

    #[test]
    fn test_classify_workstation_apple() {
        let resolver = DeviceResolver::new();
        assert_eq!(
            resolver.classify_device("192.168.1.42", Some("Apple"), &[], None),
            DeviceType::Workstation,
        );
    }

    #[test]
    fn test_classify_iot_raspberry() {
        let resolver = DeviceResolver::new();
        assert_eq!(
            resolver.classify_device("192.168.1.200", Some("Raspberry Pi"), &[], None),
            DeviceType::IoT,
        );
    }

    #[test]
    fn test_classify_unknown() {
        let resolver = DeviceResolver::new();
        assert_eq!(
            resolver.classify_device("192.168.1.99", None, &[], None),
            DeviceType::Unknown,
        );
    }

    #[test]
    fn test_parse_host_output() {
        let output = "1.1.168.192.in-addr.arpa domain name pointer gateway.local.\n";
        assert_eq!(
            DeviceResolver::parse_host_output(output),
            Some("gateway.local".to_string())
        );
    }

    #[test]
    fn test_parse_host_output_not_found() {
        let output = "Host 192.168.1.99 not found: 3(NXDOMAIN)\n";
        assert_eq!(DeviceResolver::parse_host_output(output), None);
    }
}
