use agent_network::{detection::SecurityDetector, types::*};
fn connection(port: u16, name: &str) -> NetworkConnection {
    NetworkConnection {
        protocol: ConnectionProtocol::Tcp,
        local_address: "192.168.1.2".into(),
        local_port: 50000,
        remote_address: Some("203.0.113.8".into()),
        remote_port: Some(port),
        state: ConnectionState::Established,
        pid: Some(0),
        process_name: Some(name.into()),
        process_path: None,
    }
}
#[tokio::test]
async fn bare_ports_do_not_assert_mining_or_c2_and_tcp_dns_is_not_tunneling() {
    let detector = SecurityDetector::new();
    for port in [53, 3333, 4444, 5555] {
        let alerts = detector
            .analyze(&[connection(port, "legitimate-service")])
            .await
            .unwrap();
        assert!(
            alerts.iter().all(|a| !matches!(
                a.alert_type,
                NetworkAlertType::CryptoMining
                    | NetworkAlertType::C2Communication
                    | NetworkAlertType::DnsTunneling
            )),
            "port {port}: {alerts:?}"
        );
    }
}
#[tokio::test]
async fn known_miner_is_detected_but_name_substring_is_not() {
    let detector = SecurityDetector::new();
    assert!(
        detector
            .analyze(&[connection(443, "xmrig")])
            .await
            .unwrap()
            .iter()
            .any(|a| a.alert_type == NetworkAlertType::CryptoMining)
    );
    assert!(
        detector
            .analyze(&[connection(443, "xmrig-documentation-viewer")])
            .await
            .unwrap()
            .is_empty()
    );
}
#[tokio::test]
async fn malicious_ip_still_has_high_confidence_evidence() {
    let detector = SecurityDetector::with_threat_intel(ThreatIntelligence {
        malicious_ips: vec!["203.0.113.8".into()],
        ..Default::default()
    });
    assert!(
        detector
            .analyze(&[connection(443, "browser")])
            .await
            .unwrap()
            .iter()
            .any(|a| a.alert_type == NetworkAlertType::MaliciousDestination && a.confidence >= 90)
    );
}

fn resolved(name: &str, addresses: &[&str]) -> agent_network::collector::ObservedName {
    agent_network::collector::ObservedName {
        name: name.into(),
        addresses: addresses.iter().map(|a| a.to_string()).collect(),
    }
}

/// The detectors by name only ever saw addresses: a generated domain, a
/// mining pool or a malicious domain could not match. They are fed with the
/// names the machine resolved.
#[test]
fn resolved_names_feed_the_detections_by_name() {
    let detector = SecurityDetector::with_threat_intel(ThreatIntelligence {
        malicious_domains: vec!["evil-c2.example".into()],
        ..Default::default()
    });
    let names = [
        resolved("xkqzjvbwpmtrhd.com", &["198.51.100.4"]),
        resolved("pool.minexmr.com", &["203.0.113.8"]),
        resolved("cdn.evil-c2.example", &[]),
        resolved("www.wikipedia.org", &["198.51.100.9"]),
        resolved("documentation.example.com", &[]),
    ];
    let alerts = detector.analyze_names(&names, &[connection(443, "updater")]);

    let titled = |needle: &str| alerts.iter().find(|a| a.title.contains(needle));
    let dga = titled("xkqzjvbwpmtrhd.com").expect("generated domain");
    assert_eq!(dga.alert_type, NetworkAlertType::C2Communication);
    assert!(dga.connection.is_none());
    assert!(dga.description.starts_with("Résolution DNS de"));

    // The pool resolves to the address the connection goes to: the alert
    // names the process, and is as certain as a connection makes it.
    let pool = titled("pool.minexmr.com").expect("mining pool");
    assert_eq!(pool.alert_type, NetworkAlertType::CryptoMining);
    assert_eq!(
        pool.connection
            .as_ref()
            .and_then(|c| c.process_name.as_deref()),
        Some("updater")
    );
    assert_eq!(pool.severity, AlertSeverity::High);

    let malicious = titled("cdn.evil-c2.example").expect("malicious domain");
    assert_eq!(malicious.alert_type, NetworkAlertType::MaliciousDestination);
    assert_eq!(malicious.severity, AlertSeverity::Medium, "resolved only");

    assert_eq!(alerts.len(), 3, "ordinary names raise nothing: {alerts:#?}");
}
