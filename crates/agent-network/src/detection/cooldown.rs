// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Re-upload cooldown for network security alerts.
//!
//! Detectors are stateless: a lasting suspicious connection raises the same
//! alert on every security scan (about once a minute). [`AlertCooldown`]
//! remembers when an alert was last reported, per (alert type, remote
//! address, remote port, process name), so the same alert is reported again
//! only once the cooldown has elapsed.

use crate::types::{NetworkAlertType, NetworkSecurityAlert};
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// Default delay before the same alert is reported again.
pub const DEFAULT_ALERT_COOLDOWN: Duration = Duration::from_secs(3600);

/// Bound on remembered alerts (oldest entries are dropped beyond it).
const MAX_TRACKED_ALERTS: usize = 10_000;

/// Identity of an alert for the cooldown.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct AlertKey {
    alert_type: NetworkAlertType,
    remote_address: Option<String>,
    remote_port: Option<u16>,
    process_name: Option<String>,
    /// Local port when there is no remote endpoint (listening sockets), so
    /// two suspicious listeners of one process stay distinct.
    local_port: Option<u16>,
    /// Title of alerts carrying no connection (aggregated detections).
    title: Option<String>,
}

impl AlertKey {
    /// Build the cooldown key of an alert.
    pub fn of(alert: &NetworkSecurityAlert) -> Self {
        match &alert.connection {
            Some(conn) => Self {
                alert_type: alert.alert_type,
                remote_address: conn.remote_address.clone(),
                remote_port: conn.remote_port,
                process_name: conn.process_name.clone(),
                local_port: conn.remote_port.is_none().then_some(conn.local_port),
                title: None,
            },
            None => Self {
                alert_type: alert.alert_type,
                remote_address: None,
                remote_port: None,
                process_name: None,
                local_port: None,
                title: Some(alert.title.clone()),
            },
        }
    }
}

/// Remembers recently reported alerts.
#[derive(Debug)]
pub struct AlertCooldown {
    window: Duration,
    last_reported: HashMap<AlertKey, Instant>,
}

impl AlertCooldown {
    /// Create a cooldown with the given window.
    pub fn new(window: Duration) -> Self {
        Self {
            window,
            last_reported: HashMap::new(),
        }
    }

    /// Whether `alert` should be reported at `now` (never reported, or last
    /// reported at least one window ago).
    pub fn should_report(&self, alert: &NetworkSecurityAlert, now: Instant) -> bool {
        match self.last_reported.get(&AlertKey::of(alert)) {
            Some(last) => now.saturating_duration_since(*last) >= self.window,
            None => true,
        }
    }

    /// Record that `alert` was reported at `now`.
    pub fn mark_reported(&mut self, alert: &NetworkSecurityAlert, now: Instant) {
        self.prune(now);
        if self.last_reported.len() >= MAX_TRACKED_ALERTS
            && let Some(oldest) = self
                .last_reported
                .iter()
                .min_by_key(|(_, at)| **at)
                .map(|(key, _)| key.clone())
        {
            self.last_reported.remove(&oldest);
        }
        self.last_reported.insert(AlertKey::of(alert), now);
    }

    /// Forget alerts whose cooldown has elapsed.
    pub fn prune(&mut self, now: Instant) {
        let window = self.window;
        self.last_reported
            .retain(|_, at| now.saturating_duration_since(*at) < window);
    }

    /// Number of alerts currently in cooldown.
    pub fn len(&self) -> usize {
        self.last_reported.len()
    }

    /// Whether no alert is in cooldown.
    pub fn is_empty(&self) -> bool {
        self.last_reported.is_empty()
    }
}

impl Default for AlertCooldown {
    fn default() -> Self {
        Self::new(DEFAULT_ALERT_COOLDOWN)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{AlertSeverity, ConnectionProtocol, ConnectionState, NetworkConnection};

    fn alert(
        alert_type: NetworkAlertType,
        remote: Option<(&str, u16)>,
        local_port: u16,
        process: &str,
    ) -> NetworkSecurityAlert {
        NetworkSecurityAlert {
            alert_type,
            severity: AlertSeverity::High,
            title: "t".to_string(),
            description: "d".to_string(),
            connection: Some(NetworkConnection {
                protocol: ConnectionProtocol::Tcp,
                local_address: "10.0.0.2".to_string(),
                local_port,
                remote_address: remote.map(|(a, _)| a.to_string()),
                remote_port: remote.map(|(_, p)| p),
                state: ConnectionState::Established,
                pid: Some(42),
                process_name: Some(process.to_string()),
                process_path: None,
            }),
            evidence: serde_json::Value::Null,
            confidence: 80,
            detected_at: chrono::Utc::now(),
            iocs_matched: Vec::new(),
        }
    }

    #[test]
    fn same_alert_is_reported_once_per_window() {
        let mut cooldown = AlertCooldown::new(Duration::from_secs(3600));
        let t0 = Instant::now();
        let a = alert(
            NetworkAlertType::SuspiciousPort,
            Some(("198.51.100.7", 6667)),
            50000,
            "bot",
        );

        assert!(cooldown.should_report(&a, t0));
        cooldown.mark_reported(&a, t0);

        // Re-detected every minute: suppressed for the whole hour, even when
        // the ephemeral local port changes.
        let mut again = a.clone();
        again.connection.as_mut().unwrap().local_port = 50001;
        for minute in 1..60 {
            assert!(!cooldown.should_report(&again, t0 + Duration::from_secs(60 * minute)));
        }
        assert!(cooldown.should_report(&again, t0 + Duration::from_secs(3600)));
    }

    #[test]
    fn different_endpoint_type_or_process_are_distinct() {
        let mut cooldown = AlertCooldown::default();
        let t0 = Instant::now();
        let a = alert(
            NetworkAlertType::SuspiciousPort,
            Some(("198.51.100.7", 6667)),
            50000,
            "bot",
        );
        cooldown.mark_reported(&a, t0);

        let other_ip = alert(
            NetworkAlertType::SuspiciousPort,
            Some(("198.51.100.8", 6667)),
            50000,
            "bot",
        );
        let other_port = alert(
            NetworkAlertType::SuspiciousPort,
            Some(("198.51.100.7", 6668)),
            50000,
            "bot",
        );
        let other_type = alert(
            NetworkAlertType::C2Communication,
            Some(("198.51.100.7", 6667)),
            50000,
            "bot",
        );
        let other_process = alert(
            NetworkAlertType::SuspiciousPort,
            Some(("198.51.100.7", 6667)),
            50000,
            "curl",
        );
        for fresh in [&other_ip, &other_port, &other_type, &other_process] {
            assert!(cooldown.should_report(fresh, t0));
        }
    }

    #[test]
    fn listeners_are_keyed_by_local_port_and_connectionless_by_title() {
        let mut cooldown = AlertCooldown::default();
        let t0 = Instant::now();
        let listen_4444 = alert(NetworkAlertType::SuspiciousPort, None, 4444, "nc");
        let listen_5555 = alert(NetworkAlertType::SuspiciousPort, None, 5555, "nc");
        cooldown.mark_reported(&listen_4444, t0);
        assert!(!cooldown.should_report(&listen_4444, t0));
        assert!(cooldown.should_report(&listen_5555, t0));

        let mut beacon = alert(NetworkAlertType::ConnectionAnomaly, None, 0, "x");
        beacon.connection = None;
        beacon.title = "Beaconing to 203.0.113.9".to_string();
        let mut beacon_other = beacon.clone();
        beacon_other.title = "Beaconing to 203.0.113.10".to_string();
        cooldown.mark_reported(&beacon, t0);
        assert!(!cooldown.should_report(&beacon, t0));
        assert!(cooldown.should_report(&beacon_other, t0));
    }

    #[test]
    fn expired_entries_are_pruned() {
        let mut cooldown = AlertCooldown::new(Duration::from_secs(10));
        let t0 = Instant::now();
        cooldown.mark_reported(
            &alert(
                NetworkAlertType::SuspiciousPort,
                Some(("192.0.2.1", 1)),
                1,
                "p",
            ),
            t0,
        );
        assert_eq!(cooldown.len(), 1);
        cooldown.prune(t0 + Duration::from_secs(10));
        assert!(cooldown.is_empty());
    }
}
