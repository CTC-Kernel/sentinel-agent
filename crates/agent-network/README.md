# agent-network

Network monitoring and discovery for the Sentinel GRC Agent.

## Overview

This crate provides network visibility and security detection:

- **Network collection**: Interfaces, connections, routes, DNS
- **Security detection**: C2, crypto mining, data exfiltration
- **Device discovery**: ARP scanning, ping sweep, device classification
- **Delta sync**: Efficient network state synchronization

## Modules

### Collector

Collects network state information:

- `interfaces`: Network interface enumeration
- `connections`: Active TCP/UDP connections
- `routes`: Routing table entries
- `dns`: DNS server configuration

### Detection

Security threat detection:

- `c2_detector`: Command & control communication
- `miner_detector`: Cryptocurrency mining traffic
- `exfil_detector`: Data exfiltration patterns
- `port_scanner`: Suspicious port activity

### Discovery

Network device discovery:

- `arp_scanner`: ARP-based device discovery
- `ping_sweep`: ICMP-based host detection
- `device_resolver`: MAC vendor lookup and device classification

### Sync

Efficient synchronization:

- `delta`: Network state delta computation
- `scheduler`: Smart collection scheduling

## Usage

```rust
use agent_network::{NetworkManager, DiscoveryConfig};

let manager = NetworkManager::new();

// Collect network snapshot
let snapshot = manager.collect_snapshot().await?;

// Run security detection
let alerts = manager.detect_threats(&snapshot).await?;

// Discover devices
let config = DiscoveryConfig::default();
let devices = manager.discover_devices(&config).await?;
```

## Security Alerts

| Alert Type | Description |
|------------|-------------|
| C2Communication | Command & control traffic detected |
| CryptoMining | Cryptocurrency mining activity |
| DataExfiltration | Potential data theft |
| SuspiciousPort | Unusual outbound port usage |
| MaliciousDestination | Connection to known bad IP |
| DnsTunneling | DNS-based covert channel |
| AnonymizationNetwork | Tor/proxy usage |
| ConnectionAnomaly | Unusual connection patterns |

## Device Types

Discovered devices are classified as:

- Router, Switch, Server, Workstation
- Printer, IoT, Phone, Unknown
