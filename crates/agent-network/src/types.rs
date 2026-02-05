//! Network data types for collection and detection.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ============================================================================
// Network Interface Types
// ============================================================================

/// Network interface information.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInterface {
    /// Interface name (e.g., eth0, en0, Ethernet).
    pub name: String,

    /// MAC address (if available).
    pub mac_address: Option<String>,

    /// IPv4 addresses assigned.
    pub ipv4_addresses: Vec<String>,

    /// IPv6 addresses assigned.
    pub ipv6_addresses: Vec<String>,

    /// Interface status.
    pub status: InterfaceStatus,

    /// Link speed in Mbps (if available).
    pub speed_mbps: Option<u32>,

    /// MTU size.
    pub mtu: Option<u32>,

    /// Is this a virtual/loopback interface.
    pub is_virtual: bool,

    /// Interface type.
    pub interface_type: InterfaceType,
}

/// Network interface status.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum InterfaceStatus {
    Up,
    Down,
    Unknown,
}

/// Network interface type.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum InterfaceType {
    Ethernet,
    WiFi,
    Loopback,
    Virtual,
    Vpn,
    Bridge,
    Unknown,
}

// ============================================================================
// Network Connection Types
// ============================================================================

/// Active network connection.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConnection {
    /// Protocol (TCP/UDP).
    pub protocol: ConnectionProtocol,

    /// Local address.
    pub local_address: String,

    /// Local port.
    pub local_port: u16,

    /// Remote address (for established connections).
    pub remote_address: Option<String>,

    /// Remote port (for established connections).
    pub remote_port: Option<u16>,

    /// Connection state.
    pub state: ConnectionState,

    /// Process ID owning the connection.
    pub pid: Option<u32>,

    /// Process name (if resolvable).
    pub process_name: Option<String>,

    /// Process executable path.
    pub process_path: Option<String>,
}

/// Connection protocol.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionProtocol {
    Tcp,
    Udp,
    Tcp6,
    Udp6,
}

/// TCP connection state.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionState {
    Established,
    Listen,
    TimeWait,
    CloseWait,
    SynSent,
    SynReceived,
    FinWait1,
    FinWait2,
    Closing,
    LastAck,
    Closed,
    Unknown,
}

// ============================================================================
// Routing Types
// ============================================================================

/// Routing table entry.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RouteEntry {
    /// Destination network.
    pub destination: String,

    /// Gateway address.
    pub gateway: Option<String>,

    /// Network mask or prefix length.
    pub netmask: String,

    /// Interface name.
    pub interface: String,

    /// Route metric.
    pub metric: Option<u32>,

    /// Route flags.
    pub flags: Vec<String>,

    /// Is this the default route.
    pub is_default: bool,
}

// ============================================================================
// DNS Types
// ============================================================================

/// DNS configuration.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DnsConfiguration {
    /// DNS server addresses.
    pub servers: Vec<String>,

    /// Search domains.
    pub search_domains: Vec<String>,

    /// DNS suffix.
    pub suffix: Option<String>,
}

// ============================================================================
// Network Snapshot
// ============================================================================

/// Complete network snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSnapshot {
    /// Collection timestamp.
    pub timestamp: DateTime<Utc>,

    /// Network interfaces.
    pub interfaces: Vec<NetworkInterface>,

    /// Active connections.
    pub connections: Vec<NetworkConnection>,

    /// Routing table.
    pub routes: Vec<RouteEntry>,

    /// DNS configuration.
    pub dns: DnsConfiguration,

    /// Primary IP address (first non-loopback IPv4).
    pub primary_ip: Option<String>,

    /// Primary MAC address.
    pub primary_mac: Option<String>,

    /// Snapshot hash for delta comparison.
    pub hash: String,
}

/// Network segment classification (for voxel cartography).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NetworkSegment {
    It,
    Ot,
    Dmz,
    Unknown,
}

// ============================================================================
// Security Alert Types
// ============================================================================

/// Network security alert.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSecurityAlert {
    /// Alert type.
    pub alert_type: NetworkAlertType,

    /// Severity level.
    pub severity: AlertSeverity,

    /// Alert title.
    pub title: String,

    /// Detailed description.
    pub description: String,

    /// Related connection (if applicable).
    pub connection: Option<NetworkConnection>,

    /// Evidence data.
    pub evidence: serde_json::Value,

    /// Confidence level (0-100).
    pub confidence: u8,

    /// Detection timestamp.
    pub detected_at: DateTime<Utc>,

    /// IOC indicators matched.
    pub iocs_matched: Vec<String>,
}

/// Network alert types.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NetworkAlertType {
    /// C2 communication detected.
    C2Communication,
    /// Crypto mining traffic detected.
    CryptoMining,
    /// Potential data exfiltration.
    DataExfiltration,
    /// Suspicious outbound port.
    SuspiciousPort,
    /// Connection to known malicious IP.
    MaliciousDestination,
    /// DNS tunneling detected.
    DnsTunneling,
    /// Tor/proxy usage detected.
    AnonymizationNetwork,
    /// Unusual connection volume.
    ConnectionAnomaly,
}

/// Alert severity levels.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub enum AlertSeverity {
    Low,
    Medium,
    High,
    Critical,
}

// ============================================================================
// Delta Sync Types
// ============================================================================

/// Delta payload for efficient sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkDelta {
    /// Timestamp.
    pub timestamp: DateTime<Utc>,

    /// Added interfaces.
    pub added_interfaces: Vec<NetworkInterface>,

    /// Removed interface names.
    pub removed_interfaces: Vec<String>,

    /// Changed interfaces.
    pub changed_interfaces: Vec<NetworkInterface>,

    /// Full connections snapshot (always full).
    pub connections: Vec<NetworkConnection>,

    /// DNS changed (if changed).
    pub dns_changed: Option<DnsConfiguration>,

    /// Routes changed.
    pub routes_changed: bool,

    /// New routes (if changed).
    pub routes: Option<Vec<RouteEntry>>,

    /// Delta hash.
    pub hash: String,
}

// ============================================================================
// Scheduler Types
// ============================================================================

/// Scheduling configuration for network collection.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSchedulerConfig {
    /// Interval for static info collection (interfaces, routes, DNS) in seconds.
    pub static_info_interval_secs: u64,

    /// Interval for connection scanning in seconds.
    pub connection_scan_interval_secs: u64,

    /// Interval for security detection in seconds.
    pub security_scan_interval_secs: u64,

    /// Maximum jitter percentage (0-100).
    pub jitter_percent: u8,

    /// Agent deployment group (for staggered sync, 0-9).
    pub deployment_group: u8,
}

impl Default for NetworkSchedulerConfig {
    fn default() -> Self {
        Self {
            static_info_interval_secs: 15 * 60,    // 15 minutes
            connection_scan_interval_secs: 5 * 60, // 5 minutes
            security_scan_interval_secs: 60,       // 1 minute
            jitter_percent: 20,
            deployment_group: 0,
        }
    }
}

// ============================================================================
// Threat Intelligence Types
// ============================================================================

/// Threat intelligence data.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreatIntelligence {
    /// Known malicious IPs.
    pub malicious_ips: Vec<String>,

    /// Known malicious domains.
    pub malicious_domains: Vec<String>,

    /// Known C2 ports.
    pub c2_ports: Vec<u16>,

    /// Known mining pool domains.
    pub mining_pools: Vec<String>,

    /// Last update timestamp.
    pub last_updated: Option<DateTime<Utc>>,
}

// ============================================================================
// Discovery Types
// ============================================================================

/// A device discovered on the local network.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredDevice {
    /// IP address of the device.
    pub ip: String,

    /// MAC address (if resolved via ARP).
    pub mac: Option<String>,

    /// Hostname (if resolved via reverse DNS).
    pub hostname: Option<String>,

    /// Hardware vendor (resolved from MAC OUI).
    pub vendor: Option<String>,

    /// Classified device type.
    pub device_type: DeviceType,

    /// Open TCP ports found during probe.
    pub open_ports: Vec<u16>,

    /// When this device was first seen.
    pub first_seen: DateTime<Utc>,

    /// When this device was last seen.
    pub last_seen: DateTime<Utc>,

    /// Whether this device appears to be a gateway.
    pub is_gateway: bool,

    /// The subnet this device belongs to.
    pub subnet: String,
}

/// Classification of a discovered network device.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DeviceType {
    Router,
    Switch,
    Server,
    Workstation,
    Printer,
    IoT,
    Phone,
    Unknown,
}

impl std::fmt::Display for DeviceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Router => write!(f, "router"),
            Self::Switch => write!(f, "switch"),
            Self::Server => write!(f, "server"),
            Self::Workstation => write!(f, "workstation"),
            Self::Printer => write!(f, "printer"),
            Self::IoT => write!(f, "iot"),
            Self::Phone => write!(f, "phone"),
            Self::Unknown => write!(f, "unknown"),
        }
    }
}

/// Result of a network discovery scan.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryResult {
    /// Devices found during the scan.
    pub devices: Vec<DiscoveredDevice>,

    /// Total scan duration in milliseconds.
    pub scan_duration_ms: u64,

    /// The subnet that was scanned.
    pub subnet_scanned: String,

    /// When the scan was performed.
    pub timestamp: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_network_interface_serialization() {
        let interface = NetworkInterface {
            name: "eth0".to_string(),
            mac_address: Some("00:11:22:33:44:55".to_string()),
            ipv4_addresses: vec!["192.168.1.100".to_string()],
            ipv6_addresses: vec![],
            status: InterfaceStatus::Up,
            speed_mbps: Some(1000),
            mtu: Some(1500),
            is_virtual: false,
            interface_type: InterfaceType::Ethernet,
        };

        let json = serde_json::to_string(&interface).unwrap();
        assert!(json.contains("eth0"));
        assert!(json.contains("192.168.1.100"));

        let parsed: NetworkInterface = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.name, "eth0");
        assert_eq!(parsed.status, InterfaceStatus::Up);
    }

    #[test]
    fn test_interface_status_variants() {
        assert_eq!(
            serde_json::to_string(&InterfaceStatus::Up).unwrap(),
            "\"up\""
        );
        assert_eq!(
            serde_json::to_string(&InterfaceStatus::Down).unwrap(),
            "\"down\""
        );
        assert_eq!(
            serde_json::to_string(&InterfaceStatus::Unknown).unwrap(),
            "\"unknown\""
        );
    }

    #[test]
    fn test_interface_type_variants() {
        assert_eq!(
            serde_json::to_string(&InterfaceType::Ethernet).unwrap(),
            "\"ethernet\""
        );
        assert_eq!(
            serde_json::to_string(&InterfaceType::WiFi).unwrap(),
            "\"wiFi\""
        );
        assert_eq!(
            serde_json::to_string(&InterfaceType::Vpn).unwrap(),
            "\"vpn\""
        );
    }

    #[test]
    fn test_network_connection_serialization() {
        let connection = NetworkConnection {
            protocol: ConnectionProtocol::Tcp,
            local_address: "127.0.0.1".to_string(),
            local_port: 8080,
            remote_address: Some("93.184.216.34".to_string()),
            remote_port: Some(443),
            state: ConnectionState::Established,
            pid: Some(1234),
            process_name: Some("curl".to_string()),
            process_path: Some("/usr/bin/curl".to_string()),
        };

        let json = serde_json::to_string(&connection).unwrap();
        assert!(json.contains("127.0.0.1"));
        assert!(json.contains("established"));

        let parsed: NetworkConnection = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.local_port, 8080);
        assert_eq!(parsed.state, ConnectionState::Established);
    }

    #[test]
    fn test_connection_protocol_variants() {
        assert_eq!(
            serde_json::to_string(&ConnectionProtocol::Tcp).unwrap(),
            "\"tcp\""
        );
        assert_eq!(
            serde_json::to_string(&ConnectionProtocol::Udp).unwrap(),
            "\"udp\""
        );
        assert_eq!(
            serde_json::to_string(&ConnectionProtocol::Tcp6).unwrap(),
            "\"tcp6\""
        );
    }

    #[test]
    fn test_connection_state_variants() {
        assert_eq!(
            serde_json::to_string(&ConnectionState::Established).unwrap(),
            "\"established\""
        );
        assert_eq!(
            serde_json::to_string(&ConnectionState::Listen).unwrap(),
            "\"listen\""
        );
        assert_eq!(
            serde_json::to_string(&ConnectionState::TimeWait).unwrap(),
            "\"timeWait\""
        );
    }

    #[test]
    fn test_route_entry_serialization() {
        let route = RouteEntry {
            destination: "0.0.0.0".to_string(),
            gateway: Some("192.168.1.1".to_string()),
            netmask: "0.0.0.0".to_string(),
            interface: "eth0".to_string(),
            metric: Some(100),
            flags: vec!["UG".to_string()],
            is_default: true,
        };

        let json = serde_json::to_string(&route).unwrap();
        assert!(json.contains("isDefault"));
        assert!(json.contains("true"));

        let parsed: RouteEntry = serde_json::from_str(&json).unwrap();
        assert!(parsed.is_default);
    }

    #[test]
    fn test_dns_configuration_default() {
        let dns = DnsConfiguration::default();
        assert!(dns.servers.is_empty());
        assert!(dns.search_domains.is_empty());
        assert!(dns.suffix.is_none());
    }

    #[test]
    fn test_network_security_alert_serialization() {
        let alert = NetworkSecurityAlert {
            alert_type: NetworkAlertType::C2Communication,
            severity: AlertSeverity::Critical,
            title: "C2 detected".to_string(),
            description: "Suspicious outbound connection".to_string(),
            connection: None,
            evidence: serde_json::json!({"port": 4444}),
            confidence: 95,
            detected_at: Utc::now(),
            iocs_matched: vec!["malware.bad".to_string()],
        };

        let json = serde_json::to_string(&alert).unwrap();
        assert!(json.contains("c2Communication"));
        assert!(json.contains("critical"));

        let parsed: NetworkSecurityAlert = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.alert_type, NetworkAlertType::C2Communication);
        assert_eq!(parsed.severity, AlertSeverity::Critical);
    }

    #[test]
    fn test_alert_severity_ordering() {
        assert!(AlertSeverity::Low < AlertSeverity::Medium);
        assert!(AlertSeverity::Medium < AlertSeverity::High);
        assert!(AlertSeverity::High < AlertSeverity::Critical);
    }

    #[test]
    fn test_network_scheduler_config_default() {
        let config = NetworkSchedulerConfig::default();
        assert_eq!(config.static_info_interval_secs, 15 * 60);
        assert_eq!(config.connection_scan_interval_secs, 5 * 60);
        assert_eq!(config.security_scan_interval_secs, 60);
        assert_eq!(config.jitter_percent, 20);
    }

    #[test]
    fn test_discovered_device_serialization() {
        let device = DiscoveredDevice {
            ip: "192.168.1.50".to_string(),
            mac: Some("AA:BB:CC:DD:EE:FF".to_string()),
            hostname: Some("printer.local".to_string()),
            vendor: Some("HP Inc.".to_string()),
            device_type: DeviceType::Printer,
            open_ports: vec![80, 443, 9100],
            first_seen: Utc::now(),
            last_seen: Utc::now(),
            is_gateway: false,
            subnet: "192.168.1.0/24".to_string(),
        };

        let json = serde_json::to_string(&device).unwrap();
        assert!(json.contains("printer"));

        let parsed: DiscoveredDevice = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.device_type, DeviceType::Printer);
        assert_eq!(parsed.open_ports, vec![80, 443, 9100]);
    }

    #[test]
    fn test_device_type_display() {
        assert_eq!(format!("{}", DeviceType::Router), "router");
        assert_eq!(format!("{}", DeviceType::Server), "server");
        assert_eq!(format!("{}", DeviceType::IoT), "iot");
        assert_eq!(format!("{}", DeviceType::Unknown), "unknown");
    }

    #[test]
    fn test_threat_intelligence_default() {
        let ti = ThreatIntelligence::default();
        assert!(ti.malicious_ips.is_empty());
        assert!(ti.malicious_domains.is_empty());
        assert!(ti.c2_ports.is_empty());
        assert!(ti.last_updated.is_none());
    }

    #[test]
    fn test_network_delta_serialization() {
        let delta = NetworkDelta {
            timestamp: Utc::now(),
            added_interfaces: vec![],
            removed_interfaces: vec!["old_eth0".to_string()],
            changed_interfaces: vec![],
            connections: vec![],
            dns_changed: None,
            routes_changed: false,
            routes: None,
            hash: "abc123".to_string(),
        };

        let json = serde_json::to_string(&delta).unwrap();
        assert!(json.contains("removedInterfaces"));
        assert!(json.contains("old_eth0"));

        let parsed: NetworkDelta = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.removed_interfaces, vec!["old_eth0"]);
    }

    #[test]
    fn test_network_segment_variants() {
        assert_eq!(
            serde_json::to_string(&NetworkSegment::It).unwrap(),
            "\"it\""
        );
        assert_eq!(
            serde_json::to_string(&NetworkSegment::Ot).unwrap(),
            "\"ot\""
        );
        assert_eq!(
            serde_json::to_string(&NetworkSegment::Dmz).unwrap(),
            "\"dmz\""
        );
    }
}
