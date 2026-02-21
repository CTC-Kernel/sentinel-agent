//! Agent-related types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Agent operational status.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    /// Agent is connected and operating normally.
    Online,
    /// Agent is disconnected from the server.
    Offline,
    /// Agent is synchronizing data with the server.
    Syncing,
    /// Agent encountered an error.
    Error,
    /// Agent is starting up.
    #[default]
    Starting,
    /// Agent is shutting down.
    ShuttingDown,
}

/// Agent information reported in heartbeats.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct AgentInfo {
    /// Unique agent identifier.
    pub agent_id: Uuid,

    /// Agent version string.
    pub version: String,

    /// Current operational status.
    pub status: AgentStatus,

    /// Hostname of the machine.
    pub hostname: String,

    /// Operating system name and version.
    pub os_info: String,

    /// Last successful sync timestamp.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_sync_at: Option<DateTime<Utc>>,

    /// Last check execution timestamp.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_check_at: Option<DateTime<Utc>>,

    /// Number of pending sync items.
    #[serde(default)]
    pub pending_sync_count: u32,

    /// Current compliance score (0-100).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub compliance_score: Option<f32>,
}

/// Heartbeat message sent to the server.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct Heartbeat {
    /// Agent information.
    pub agent: AgentInfo,

    /// Timestamp of this heartbeat.
    pub timestamp: DateTime<Utc>,

    /// System metrics.
    pub metrics: SystemMetrics,
}

/// System resource metrics.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct SystemMetrics {
    /// CPU usage percentage (0-100).
    pub cpu_percent: f32,

    /// Memory usage in bytes.
    pub memory_bytes: u64,

    /// Memory usage percentage (0-100).
    #[serde(default)]
    pub memory_percent: f32,

    /// Total memory in bytes.
    #[serde(default)]
    pub memory_total_bytes: u64,

    /// Disk usage percentage (0-100).
    #[serde(default)]
    pub disk_percent: f32,

    /// Disk used bytes.
    #[serde(default)]
    pub disk_used_bytes: u64,

    /// Disk total bytes.
    #[serde(default)]
    pub disk_total_bytes: u64,

    /// Disk I/O throughput in kilobytes per second.
    #[serde(default)]
    pub disk_io_kbps: u32,

    /// Network bytes sent since last heartbeat.
    #[serde(default)]
    pub network_bytes_sent: u64,

    /// Network bytes received since last heartbeat.
    #[serde(default)]
    pub network_bytes_recv: u64,

    /// System uptime in seconds.
    #[serde(default)]
    pub uptime_seconds: u64,
}

impl Default for SystemMetrics {
    fn default() -> Self {
        Self {
            cpu_percent: 0.0,
            memory_bytes: 0,
            memory_percent: 0.0,
            memory_total_bytes: 0,
            disk_percent: 0.0,
            disk_used_bytes: 0,
            disk_total_bytes: 0,
            disk_io_kbps: 0,
            network_bytes_sent: 0,
            network_bytes_recv: 0,
            uptime_seconds: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_status_serialization() {
        let status = AgentStatus::Online;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"online\"");

        let parsed: AgentStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, AgentStatus::Online);
    }

    #[test]
    fn test_agent_status_all_variants() {
        let variants = vec![
            (AgentStatus::Online, "\"online\""),
            (AgentStatus::Offline, "\"offline\""),
            (AgentStatus::Syncing, "\"syncing\""),
            (AgentStatus::Error, "\"error\""),
            (AgentStatus::Starting, "\"starting\""),
            (AgentStatus::ShuttingDown, "\"shutting_down\""),
        ];

        for (status, expected) in variants {
            let json = serde_json::to_string(&status).unwrap();
            assert_eq!(json, expected, "Failed for {:?}", status);
        }
    }

    #[test]
    fn test_agent_info_serialization() {
        let info = AgentInfo {
            agent_id: Uuid::nil(),
            version: "0.1.0".to_string(),
            status: AgentStatus::Online,
            hostname: "test-host".to_string(),
            os_info: "Linux 5.15".to_string(),
            last_sync_at: None,
            last_check_at: None,
            pending_sync_count: 0,
            compliance_score: Some(85.5),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("agent_id"));
        assert!(json.contains("compliance_score"));

        let parsed: AgentInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.hostname, "test-host");
    }

    #[test]
    fn test_heartbeat_serialization() {
        let heartbeat = Heartbeat {
            agent: AgentInfo {
                agent_id: Uuid::nil(),
                version: "0.1.0".to_string(),
                status: AgentStatus::Online,
                hostname: "test".to_string(),
                os_info: "Linux".to_string(),
                last_sync_at: None,
                last_check_at: None,
                pending_sync_count: 0,
                compliance_score: None,
            },
            timestamp: Utc::now(),
            metrics: SystemMetrics::default(),
        };

        let json = serde_json::to_string(&heartbeat).unwrap();
        let parsed: Heartbeat = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.agent.hostname, "test");
    }
}
