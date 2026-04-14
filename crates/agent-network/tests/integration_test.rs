// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Integration tests for agent-network.
//!
//! Tests network data collection, connection parsing,
//! and threat detection capabilities.

use agent_network::{
    DiscoveryConfig, NetworkCollector, NetworkError, NetworkManager, NetworkSchedulerConfig,
};

// ---------------------------------------------------------------------------
// 1. NetworkManager creation
// ---------------------------------------------------------------------------

#[test]
fn test_network_manager_creation() {
    let manager = NetworkManager::new();
    // Verify the manager is functional by inspecting its scheduler config.
    let config = manager.scheduler().config();
    // Default static info interval is 15 minutes (900 s).
    assert_eq!(config.static_info_interval_secs, 15 * 60);
}

#[test]
fn test_network_manager_default_trait() {
    // NetworkManager implements Default — ensure it is equivalent to ::new().
    let _manager: NetworkManager = Default::default();
}

#[test]
fn test_network_manager_with_custom_scheduler() {
    let config = NetworkSchedulerConfig {
        static_info_interval_secs: 600,
        connection_scan_interval_secs: 120,
        security_scan_interval_secs: 30,
        jitter_percent: 10,
        deployment_group: 3,
    };
    let _manager = NetworkManager::with_scheduler_config(config);
}

// ---------------------------------------------------------------------------
// 2. NetworkCollector construction
// ---------------------------------------------------------------------------

#[test]
fn test_network_collector_creation() {
    let _collector = NetworkCollector::new();
}

#[test]
fn test_network_collector_default_trait() {
    let _collector: NetworkCollector = Default::default();
}

// ---------------------------------------------------------------------------
// 3. Network snapshot collection (live system)
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_collect_snapshot_returns_data() {
    let collector = NetworkCollector::new();
    let snapshot = collector.collect_snapshot().await;
    assert!(
        snapshot.is_ok(),
        "collect_snapshot should succeed on a live system"
    );

    let snapshot = snapshot.unwrap();
    // Every system has at least one network interface (loopback).
    assert!(
        !snapshot.interfaces.is_empty(),
        "snapshot should contain at least one interface"
    );
    // Hash should be a non-empty hex string.
    assert!(!snapshot.hash.is_empty(), "snapshot hash must not be empty");
}

// ---------------------------------------------------------------------------
// 4. Interface collection (at least one interface on any system)
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_collect_static_info_has_interfaces() {
    let collector = NetworkCollector::new();
    let result = collector.collect_static_info().await;
    assert!(result.is_ok(), "collect_static_info should succeed");

    let (interfaces, _routes, _dns) = result.unwrap();
    assert!(
        !interfaces.is_empty(),
        "there should be at least one network interface"
    );

    // At least one interface should have a name.
    let has_named = interfaces.iter().any(|iface| !iface.name.is_empty());
    assert!(
        has_named,
        "at least one interface should have a non-empty name"
    );
}

// ---------------------------------------------------------------------------
// 5. DNS info collection
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_dns_collection() {
    let collector = NetworkCollector::new();
    let result = collector.collect_static_info().await;
    assert!(result.is_ok(), "collect_static_info should succeed");

    let (_interfaces, _routes, dns) = result.unwrap();
    // On most configured systems there is at least one DNS server.
    // We only assert the struct is well-formed; an empty list is acceptable
    // in isolated CI environments.
    assert!(
        dns.servers.len() <= 100,
        "DNS server list should be reasonable in size"
    );
}

// ---------------------------------------------------------------------------
// 6. DiscoveryConfig defaults
// ---------------------------------------------------------------------------

#[test]
fn test_discovery_config_defaults() {
    let config = DiscoveryConfig::default();

    assert!(
        config.enable_ping_sweep,
        "ping sweep should be enabled by default"
    );
    assert_eq!(
        config.ping_timeout_ms, 500,
        "default ping timeout should be 500 ms"
    );
    assert!(
        !config.tcp_probe_ports.is_empty(),
        "default probe ports should not be empty"
    );
    assert!(
        config.tcp_probe_ports.contains(&80),
        "default probe ports should include HTTP (80)"
    );
    assert!(
        config.tcp_probe_ports.contains(&443),
        "default probe ports should include HTTPS (443)"
    );
    assert_eq!(
        config.max_concurrent, 50,
        "default max_concurrent should be 50"
    );
    assert!(
        config.enable_dns_resolve,
        "DNS resolve should be enabled by default"
    );
}

#[test]
fn test_discovery_config_serialization_roundtrip() {
    let config = DiscoveryConfig::default();
    let json = serde_json::to_string(&config).expect("serialize DiscoveryConfig");
    let parsed: DiscoveryConfig = serde_json::from_str(&json).expect("deserialize DiscoveryConfig");

    assert_eq!(config.enable_ping_sweep, parsed.enable_ping_sweep);
    assert_eq!(config.ping_timeout_ms, parsed.ping_timeout_ms);
    assert_eq!(config.tcp_probe_ports, parsed.tcp_probe_ports);
    assert_eq!(config.max_concurrent, parsed.max_concurrent);
    assert_eq!(config.enable_dns_resolve, parsed.enable_dns_resolve);
}

// ---------------------------------------------------------------------------
// Bonus: NetworkError is recoverable classification
// ---------------------------------------------------------------------------

#[test]
fn test_network_error_recoverability() {
    let io_err = NetworkError::Io(std::io::Error::new(
        std::io::ErrorKind::ConnectionRefused,
        "refused",
    ));
    assert!(io_err.is_recoverable(), "I/O errors should be recoverable");

    let parse_err = NetworkError::ParseError("bad data".to_string());
    assert!(
        !parse_err.is_recoverable(),
        "parse errors should not be recoverable"
    );
}
