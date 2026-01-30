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
