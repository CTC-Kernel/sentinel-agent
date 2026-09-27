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
