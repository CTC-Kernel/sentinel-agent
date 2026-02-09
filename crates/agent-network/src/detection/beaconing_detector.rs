//! Beaconing detector for C2 callback patterns.
//!
//! Detects periodic callback patterns indicative of C2 communication:
//! - Regular interval analysis
//! - Jitter calculation
//! - Time-series pattern matching
//! - Statistical periodicity detection

use super::rules::DetectionRules;
use crate::types::{
    AlertSeverity, ConnectionState, NetworkAlertType, NetworkConnection, NetworkSecurityAlert,
};
use chrono::{DateTime, Duration, Utc};
use serde_json::json;
use std::collections::HashMap;

/// Configuration for beaconing detection.
#[derive(Debug, Clone)]
pub struct BeaconingConfig {
    /// Minimum number of connections to analyze for beaconing.
    pub min_connections: usize,
    /// Maximum allowed jitter percentage for beaconing detection.
    pub max_jitter_percent: f64,
    /// Minimum confidence to generate alert.
    pub min_confidence: u8,
    /// Time window for analysis in seconds.
    pub analysis_window_secs: i64,
    /// Minimum interval between beacons in seconds.
    pub min_beacon_interval_secs: i64,
    /// Maximum interval between beacons in seconds.
    pub max_beacon_interval_secs: i64,
    /// Maximum number of tracked destinations to prevent unbounded memory growth.
    pub max_tracked_destinations: usize,
    /// Maximum events stored per destination to prevent unbounded memory growth.
    pub max_events_per_destination: usize,
}

impl Default for BeaconingConfig {
    fn default() -> Self {
        Self {
            min_connections: 5,
            max_jitter_percent: 15.0,
            min_confidence: 70,
            analysis_window_secs: 3600, // 1 hour
            min_beacon_interval_secs: 30,
            max_beacon_interval_secs: 3600,
            max_tracked_destinations: 10_000,
            max_events_per_destination: 1_000,
        }
    }
}

/// A connection event with timestamp for beaconing analysis.
#[derive(Debug, Clone)]
pub struct ConnectionEvent {
    /// Remote address and port tuple.
    pub destination: String,
    /// Connection timestamp.
    pub timestamp: DateTime<Utc>,
    /// Process name if available.
    pub process_name: Option<String>,
    /// Process ID if available.
    pub pid: Option<u32>,
}

/// Beaconing analysis result.
#[derive(Debug, Clone)]
pub struct BeaconingAnalysis {
    /// The destination being analyzed.
    pub destination: String,
    /// Average interval between connections in seconds.
    pub avg_interval_secs: f64,
    /// Standard deviation of intervals.
    pub std_dev_secs: f64,
    /// Calculated jitter percentage.
    pub jitter_percent: f64,
    /// Number of connections analyzed.
    pub connection_count: usize,
    /// Confidence score (0-100).
    pub confidence: u8,
    /// Whether beaconing pattern was detected.
    pub is_beaconing: bool,
}

/// Detector for beaconing patterns in network connections.
pub struct BeaconingDetector {
    config: BeaconingConfig,
    /// Historical connection events for analysis.
    connection_history: HashMap<String, Vec<ConnectionEvent>>,
    /// Whitelist of destinations to ignore.
    whitelist: Vec<String>,
}

impl BeaconingDetector {
    /// Create a new beaconing detector with rules.
    pub fn new(_rules: &DetectionRules) -> Self {
        Self::with_config(BeaconingConfig::default())
    }

    /// Create a new beaconing detector with custom configuration.
    pub fn with_config(config: BeaconingConfig) -> Self {
        Self {
            config,
            connection_history: HashMap::new(),
            whitelist: Self::default_whitelist(),
        }
    }

    /// Record a connection event for future analysis.
    pub fn record_connection(&mut self, conn: &NetworkConnection) {
        if conn.state != ConnectionState::Established {
            return;
        }

        if let (Some(remote_addr), Some(remote_port)) = (&conn.remote_address, conn.remote_port) {
            let destination = format!("{}:{}", remote_addr, remote_port);

            // Skip whitelisted destinations
            if self.is_whitelisted(&destination) || self.is_whitelisted(remote_addr) {
                return;
            }

            let event = ConnectionEvent {
                destination: destination.clone(),
                timestamp: Utc::now(),
                process_name: conn.process_name.clone(),
                pid: conn.pid,
            };

            // Enforce maximum tracked destinations to prevent unbounded memory growth
            if !self.connection_history.contains_key(&destination)
                && self.connection_history.len() >= self.config.max_tracked_destinations
            {
                // Evict the destination with the fewest events
                if let Some(evict_key) = self
                    .connection_history
                    .iter()
                    .min_by_key(|(_, v)| v.len())
                    .map(|(k, _)| k.clone())
                {
                    self.connection_history.remove(&evict_key);
                }
            }

            let events = self.connection_history.entry(destination).or_default();
            events.push(event);

            // Enforce max events per destination to prevent unbounded memory growth
            if events.len() > self.config.max_events_per_destination {
                let excess = events.len() - self.config.max_events_per_destination;
                events.drain(..excess);
            }

            // Cleanup old entries
            self.cleanup_old_events();
        }
    }

    /// Detect beaconing patterns in current connections.
    pub fn detect(&self, connections: &[NetworkConnection]) -> Vec<NetworkSecurityAlert> {
        let mut alerts = Vec::new();

        // Build a temporary history from current connections if we have timestamps
        // In a real scenario, this would use persistent history
        let mut temp_history: HashMap<String, Vec<ConnectionEvent>> = HashMap::new();

        for conn in connections {
            if conn.state != ConnectionState::Established {
                continue;
            }

            if let (Some(remote_addr), Some(remote_port)) = (&conn.remote_address, conn.remote_port)
            {
                let destination = format!("{}:{}", remote_addr, remote_port);

                if self.is_whitelisted(&destination) || self.is_whitelisted(remote_addr) {
                    continue;
                }

                let event = ConnectionEvent {
                    destination: destination.clone(),
                    timestamp: Utc::now(),
                    process_name: conn.process_name.clone(),
                    pid: conn.pid,
                };

                temp_history.entry(destination).or_default().push(event);
            }
        }

        // Analyze combined history without cloning — iterate by reference and merge only overlapping keys
        for (destination, history_events) in &self.connection_history {
            let events_to_analyze: std::borrow::Cow<'_, [ConnectionEvent]> =
                if let Some(temp_events) = temp_history.get(destination) {
                    let mut merged = history_events.clone();
                    merged.extend(temp_events.iter().cloned());
                    std::borrow::Cow::Owned(merged)
                } else {
                    std::borrow::Cow::Borrowed(history_events.as_slice())
                };

            if let Some(analysis) = self.analyze_destination(destination, &events_to_analyze)
                && analysis.is_beaconing
                && let Some(conn) = connections.iter().find(|c| {
                    c.remote_address
                        .as_ref()
                        .map(|a| destination.starts_with(a))
                        == Some(true)
                })
            {
                alerts.push(self.create_alert(conn, &analysis));
            }
        }

        // Analyze destinations only in temp_history (not already in connection_history)
        for (destination, events) in &temp_history {
            if self.connection_history.contains_key(destination) {
                continue; // Already analyzed above
            }
            if let Some(analysis) = self.analyze_destination(destination, events)
                && analysis.is_beaconing
                && let Some(conn) = connections.iter().find(|c| {
                    c.remote_address
                        .as_ref()
                        .map(|a| destination.starts_with(a))
                        == Some(true)
                })
            {
                alerts.push(self.create_alert(conn, &analysis));
            }
        }

        alerts
    }

    /// Analyze a specific destination for beaconing patterns.
    pub fn analyze_destination(
        &self,
        destination: &str,
        events: &[ConnectionEvent],
    ) -> Option<BeaconingAnalysis> {
        if events.len() < self.config.min_connections {
            return None;
        }

        // Sort events by timestamp
        let mut sorted_events = events.to_vec();
        sorted_events.sort_by_key(|e| e.timestamp);

        // Calculate intervals between consecutive connections
        let intervals: Vec<f64> = sorted_events
            .windows(2)
            .map(|w| (w[1].timestamp - w[0].timestamp).num_seconds() as f64)
            .filter(|&i| {
                i >= self.config.min_beacon_interval_secs as f64
                    && i <= self.config.max_beacon_interval_secs as f64
            })
            .collect();

        if intervals.len() < self.config.min_connections - 1 {
            return None;
        }

        // Calculate statistics
        let avg_interval = intervals.iter().sum::<f64>() / intervals.len() as f64;

        let variance = intervals
            .iter()
            .map(|&i| (i - avg_interval).powi(2))
            .sum::<f64>()
            / intervals.len() as f64;

        let std_dev = variance.sqrt();
        let jitter_percent = if avg_interval > 0.0 {
            (std_dev / avg_interval) * 100.0
        } else {
            100.0
        };

        // Calculate confidence based on pattern consistency
        let confidence = self.calculate_confidence(
            intervals.len(),
            jitter_percent,
            avg_interval,
            &sorted_events,
        );

        let is_beaconing = jitter_percent <= self.config.max_jitter_percent
            && confidence >= self.config.min_confidence;

        Some(BeaconingAnalysis {
            destination: destination.to_string(),
            avg_interval_secs: avg_interval,
            std_dev_secs: std_dev,
            jitter_percent,
            connection_count: events.len(),
            confidence,
            is_beaconing,
        })
    }

    /// Calculate confidence score for beaconing detection.
    fn calculate_confidence(
        &self,
        interval_count: usize,
        jitter_percent: f64,
        avg_interval: f64,
        events: &[ConnectionEvent],
    ) -> u8 {
        let mut score = 0.0;

        // More consistent intervals = higher confidence (weight: 40%)
        if jitter_percent < 5.0 {
            score += 40.0;
        } else if jitter_percent < 10.0 {
            score += 30.0;
        } else if jitter_percent < 15.0 {
            score += 20.0;
        } else if jitter_percent < 20.0 {
            score += 10.0;
        }

        // More data points = higher confidence (weight: 30%)
        let data_score = ((interval_count as f64 / 20.0).min(1.0)) * 30.0;
        score += data_score;

        // Typical C2 intervals (1-15 minutes) = higher confidence (weight: 20%)
        if (60.0..=900.0).contains(&avg_interval) {
            score += 20.0;
        } else if (30.0..=1800.0).contains(&avg_interval) {
            score += 10.0;
        }

        // Same process consistently = higher confidence (weight: 10%)
        if !events.is_empty() {
            let first_process = &events[0].process_name;
            let same_process = events.iter().all(|e| &e.process_name == first_process);
            if same_process && first_process.is_some() {
                score += 10.0;
            }
        }

        (score.min(100.0) as u8).min(100)
    }

    /// Create an alert for detected beaconing.
    fn create_alert(
        &self,
        conn: &NetworkConnection,
        analysis: &BeaconingAnalysis,
    ) -> NetworkSecurityAlert {
        let process_info = conn
            .process_name
            .as_ref()
            .map(|p| format!(" by process '{}'", p))
            .unwrap_or_default();

        let severity = if analysis.confidence >= 90 {
            AlertSeverity::Critical
        } else if analysis.confidence >= 80 {
            AlertSeverity::High
        } else {
            AlertSeverity::Medium
        };

        let interval_desc = if analysis.avg_interval_secs < 60.0 {
            format!("{:.0} seconds", analysis.avg_interval_secs)
        } else if analysis.avg_interval_secs < 3600.0 {
            format!("{:.1} minutes", analysis.avg_interval_secs / 60.0)
        } else {
            format!("{:.1} hours", analysis.avg_interval_secs / 3600.0)
        };

        NetworkSecurityAlert {
            alert_type: NetworkAlertType::C2Communication,
            severity,
            title: format!("Beaconing pattern detected to {}", analysis.destination),
            description: format!(
                "Regular callback pattern detected to '{}'{} with {}% confidence. \
                 Average interval: {}, jitter: {:.1}%. \
                 Beaconing is a common C2 communication pattern where malware \
                 periodically contacts its command server.",
                analysis.destination,
                process_info,
                analysis.confidence,
                interval_desc,
                analysis.jitter_percent
            ),
            connection: Some(conn.clone()),
            evidence: json!({
                "destination": analysis.destination,
                "confidence": analysis.confidence,
                "analysis": {
                    "avg_interval_secs": format!("{:.2}", analysis.avg_interval_secs),
                    "std_dev_secs": format!("{:.2}", analysis.std_dev_secs),
                    "jitter_percent": format!("{:.2}", analysis.jitter_percent),
                    "connection_count": analysis.connection_count,
                },
                "process_name": conn.process_name,
                "process_path": conn.process_path,
                "pid": conn.pid,
                "detection_reason": "periodic_beacon_pattern"
            }),
            confidence: analysis.confidence,
            detected_at: Utc::now(),
            iocs_matched: vec![format!("beacon:{}", analysis.destination)],
        }
    }

    /// Remove old events outside the analysis window.
    fn cleanup_old_events(&mut self) {
        let cutoff = Utc::now() - Duration::seconds(self.config.analysis_window_secs);

        for events in self.connection_history.values_mut() {
            events.retain(|e| e.timestamp > cutoff);
        }

        // Remove empty entries
        self.connection_history.retain(|_, v| !v.is_empty());
    }

    /// Check if a destination is whitelisted.
    fn is_whitelisted(&self, destination: &str) -> bool {
        for pattern in &self.whitelist {
            if destination.contains(pattern) {
                return true;
            }
        }
        false
    }

    fn default_whitelist() -> Vec<String> {
        vec![
            // Cloud providers (legitimate heartbeats)
            "googleapis.com".to_string(),
            "google.com".to_string(),
            "microsoft.com".to_string(),
            "azure.com".to_string(),
            "amazonaws.com".to_string(),
            "cloudflare.com".to_string(),
            // Common services
            "apple.com".to_string(),
            "icloud.com".to_string(),
            "dropbox.com".to_string(),
            "slack.com".to_string(),
            "zoom.us".to_string(),
            "teams.microsoft.com".to_string(),
            // NTP servers
            "time.".to_string(),
            "ntp.".to_string(),
            "pool.ntp.org".to_string(),
            // Update services
            "update.".to_string(),
            "download.".to_string(),
            // Local addresses
            "127.0.0.1".to_string(),
            "localhost".to_string(),
            "::1".to_string(),
        ]
    }

    /// Clear all connection history.
    pub fn clear_history(&mut self) {
        self.connection_history.clear();
    }

    /// Get the number of tracked destinations.
    pub fn tracked_destinations(&self) -> usize {
        self.connection_history.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ConnectionProtocol;

    fn create_test_connection(remote_addr: &str, remote_port: u16) -> NetworkConnection {
        NetworkConnection {
            protocol: ConnectionProtocol::Tcp,
            local_address: "192.168.1.100".to_string(),
            local_port: 54321,
            remote_address: Some(remote_addr.to_string()),
            remote_port: Some(remote_port),
            state: ConnectionState::Established,
            pid: Some(1234),
            process_name: Some("suspicious_process".to_string()),
            process_path: Some("/tmp/suspicious".to_string()),
        }
    }

    #[test]
    fn test_beaconing_config_default() {
        let config = BeaconingConfig::default();
        assert_eq!(config.min_connections, 5);
        assert_eq!(config.max_jitter_percent, 15.0);
        assert_eq!(config.min_confidence, 70);
    }

    #[test]
    fn test_record_connection() {
        let mut detector = BeaconingDetector::with_config(BeaconingConfig::default());
        let conn = create_test_connection("10.0.0.1", 4444);

        detector.record_connection(&conn);

        assert_eq!(detector.tracked_destinations(), 1);
    }

    #[test]
    fn test_whitelist_filtering() {
        let mut detector = BeaconingDetector::with_config(BeaconingConfig::default());

        // Whitelisted destination should not be recorded
        let conn = create_test_connection("api.google.com", 443);
        detector.record_connection(&conn);
        assert_eq!(detector.tracked_destinations(), 0);

        // Non-whitelisted should be recorded
        let conn = create_test_connection("suspicious.domain.com", 4444);
        detector.record_connection(&conn);
        assert_eq!(detector.tracked_destinations(), 1);
    }

    #[test]
    fn test_analyze_destination_insufficient_data() {
        let detector = BeaconingDetector::with_config(BeaconingConfig::default());
        let events = vec![ConnectionEvent {
            destination: "10.0.0.1:4444".to_string(),
            timestamp: Utc::now(),
            process_name: Some("test".to_string()),
            pid: Some(1234),
        }];

        let result = detector.analyze_destination("10.0.0.1:4444", &events);
        assert!(result.is_none()); // Not enough data points
    }

    #[test]
    fn test_analyze_beaconing_pattern() {
        let detector = BeaconingDetector::with_config(BeaconingConfig::default());
        let base_time = Utc::now();

        // Create events with regular 60-second intervals
        let events: Vec<ConnectionEvent> = (0..10)
            .map(|i| ConnectionEvent {
                destination: "10.0.0.1:4444".to_string(),
                timestamp: base_time + Duration::seconds(i * 60),
                process_name: Some("beacon".to_string()),
                pid: Some(1234),
            })
            .collect();

        let result = detector.analyze_destination("10.0.0.1:4444", &events);
        assert!(result.is_some());

        let analysis = result.unwrap();
        assert!((analysis.avg_interval_secs - 60.0).abs() < 1.0);
        assert!(analysis.jitter_percent < 5.0);
    }

    #[test]
    fn test_analyze_irregular_pattern() {
        let detector = BeaconingDetector::with_config(BeaconingConfig::default());
        let base_time = Utc::now();

        // Create events with irregular intervals
        let intervals = [30, 120, 45, 300, 60, 15, 180, 90, 240];
        let mut events = Vec::new();
        let mut current_time = base_time;

        for interval in &intervals {
            events.push(ConnectionEvent {
                destination: "10.0.0.1:4444".to_string(),
                timestamp: current_time,
                process_name: Some("random".to_string()),
                pid: Some(1234),
            });
            current_time += Duration::seconds(*interval);
        }

        let result = detector.analyze_destination("10.0.0.1:4444", &events);
        if let Some(analysis) = result {
            // High jitter should result in is_beaconing = false
            assert!(!analysis.is_beaconing || analysis.jitter_percent > 15.0);
        }
    }

    #[test]
    fn test_clear_history() {
        let mut detector = BeaconingDetector::with_config(BeaconingConfig::default());
        let conn = create_test_connection("10.0.0.1", 4444);

        detector.record_connection(&conn);
        assert_eq!(detector.tracked_destinations(), 1);

        detector.clear_history();
        assert_eq!(detector.tracked_destinations(), 0);
    }

    #[test]
    fn test_confidence_calculation() {
        let detector = BeaconingDetector::with_config(BeaconingConfig::default());
        let base_time = Utc::now();

        // Perfect beaconing pattern
        let events: Vec<ConnectionEvent> = (0..20)
            .map(|i| ConnectionEvent {
                destination: "10.0.0.1:4444".to_string(),
                timestamp: base_time + Duration::seconds(i * 300), // 5-minute intervals
                process_name: Some("beacon".to_string()),
                pid: Some(1234),
            })
            .collect();

        // Low jitter should give high confidence
        let confidence = detector.calculate_confidence(19, 2.0, 300.0, &events);
        assert!(confidence >= 80);
    }
}
