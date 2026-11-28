// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Time synchronization compliance check.
//!
//! Verifies that NTP/chrony is configured and synchronized:
//! - Windows: W32Time service status via w32tm
//! - Linux: chronyc tracking or timedatectl
//! - macOS: sntp or systemsetup network time

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
#[cfg(any(target_os = "windows", target_os = "macos"))]
use crate::error::ScannerError;
use crate::error::ScannerResult;
use agent_common::process::silent_command;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tracing::debug;

/// Check ID for time synchronization.
pub const CHECK_ID: &str = "time_sync";

/// Time synchronization status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSyncStatus {
    /// Whether time synchronization is enabled and working.
    pub synchronized: bool,

    /// Time synchronization method (NTP, chrony, W32Time, etc.).
    pub sync_method: String,

    /// NTP source/server being used.
    pub ntp_source: Option<String>,

    /// Leap indicator status.
    pub leap_status: Option<String>,

    /// Whether the NTP service is running.
    pub service_running: bool,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Time synchronization compliance check.
pub struct TimeSyncCheck {
    definition: CheckDefinition,
}

impl TimeSyncCheck {
    /// Create a new time synchronization check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Time Synchronization")
            .description("Verify NTP/chrony is configured and synchronized")
            .category(CheckCategory::TimeSync)
            .severity(CheckSeverity::Medium)
            .framework("NIS2")
            .framework("DORA")
            .framework("CIS_V8")
            .framework("PCI_DSS")
            .framework("NIST_CSF")
            .framework("ISO_27001")
            .framework("HDS")
            .framework("ANSSI_HYGIENE")
            .platforms(vec![
                "windows".to_string(),
                "linux".to_string(),
                "macos".to_string(),
            ])
            .build();

        Self { definition }
    }

    /// Check time synchronization on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<TimeSyncStatus> {
        debug!("Checking Windows time synchronization (W32Time)");

        let output = silent_command("w32tm")
            .args(["/query", "/status"])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run w32tm: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        let mut status = TimeSyncStatus {
            synchronized: false,
            sync_method: "W32Time".to_string(),
            ntp_source: None,
            leap_status: None,
            service_running: false,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        if !output.status.success() {
            if stderr.contains("not running") || stderr.contains("service is not started") {
                status
                    .issues
                    .push("W32Time service is not running".to_string());
                return Ok(status);
            }
            return Err(ScannerError::CheckExecution(format!(
                "w32tm query failed: {}",
                stderr
            )));
        }

        status.service_running = true;

        // Parse output for leap indicator and source
        for line in raw_output.lines() {
            let line_lower = line.to_lowercase();
            if (line_lower.contains("leap indicator:") || line_lower.contains("leap indicator :"))
                && let Some(value) = line.split(':').next_back()
            {
                let leap = value.trim().to_string();
                // "0(no warning)" means synchronized
                status.synchronized =
                    leap.contains("0") || leap.to_lowercase().contains("no warning");
                status.leap_status = Some(leap);
            }
            if (line_lower.contains("source:") || line_lower.contains("source :"))
                && let Some(value) = line.split(':').next_back()
            {
                let source = value.trim().to_string();
                if !source.is_empty() && source != "Local CMOS Clock" {
                    status.ntp_source = Some(source);
                }
            }
        }

        if !status.synchronized {
            status
                .issues
                .push("Time is not properly synchronized".to_string());
        }

        if status.ntp_source.is_none() {
            status
                .issues
                .push("No external NTP source configured".to_string());
        }

        Ok(status)
    }

    /// Check time synchronization on Linux: a time daemon (chrony,
    /// systemd-timesyncd, ntpd) must run and the clock must be synchronized.
    /// A clock the hypervisor keeps right, with no daemon, is not compliant.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<TimeSyncStatus> {
        debug!("Checking Linux time synchronization");

        let mut evidence = LinuxTimeEvidence::default();

        // chrony: `tracking` answers only when chronyd runs.
        if let Ok(output) = silent_command("chronyc").args(["tracking"]).output() {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            evidence
                .raw_output
                .push_str(&format!("=== chronyc tracking ===\n{}\n", stdout));
            if output.status.success() {
                evidence.chrony_tracking = Some(stdout);
            }
        }

        // The time daemons systemd runs, whatever their package calls them.
        if let Ok(output) = silent_command("systemctl")
            .arg("is-active")
            .args(TIME_DAEMON_UNITS)
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            evidence
                .raw_output
                .push_str(&format!("=== systemctl is-active ===\n{}\n", stdout));
            evidence.active_units = active_units(&stdout);
        }

        // ntpd without systemd: `ntpq` answers only when ntpd runs.
        if evidence.active_units.is_empty()
            && evidence.chrony_tracking.is_none()
            && let Ok(output) = silent_command("ntpq").args(["-pn"]).output()
            && output.status.success()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            evidence
                .raw_output
                .push_str(&format!("=== ntpq -pn ===\n{}\n", stdout));
            evidence.ntpq_peers = Some(stdout);
        }

        // The kernel's view: synchronized by whichever daemon.
        if let Ok(output) = silent_command("timedatectl")
            .args(["show", "-p", "NTP", "-p", "NTPSynchronized"])
            .output()
            && output.status.success()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            evidence
                .raw_output
                .push_str(&format!("=== timedatectl show ===\n{}\n", stdout));
            evidence.ntp_synchronized = show_property(&stdout, "NTPSynchronized");
        } else if let Ok(output) = silent_command("timedatectl").args(["status"]).output() {
            // systemd before 239 has no `show` for timedated.
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            evidence
                .raw_output
                .push_str(&format!("=== timedatectl ===\n{}\n", stdout));
            evidence.ntp_synchronized = status_synchronized(&stdout);
        }

        Ok(evaluate_linux(evidence))
    }

    /// Check time synchronization on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<TimeSyncStatus> {
        debug!("Checking macOS time synchronization");

        let mut status = TimeSyncStatus {
            synchronized: false,
            sync_method: "NTP".to_string(),
            ntp_source: None,
            leap_status: None,
            service_running: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check if network time is enabled
        // Note: systemsetup requires root on macOS — if not root, fall back to launchctl
        let mut systemsetup_failed = false;
        if let Ok(output) = silent_command("systemsetup")
            .args(["-getusingnetworktime"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            status
                .raw_output
                .push_str(&format!("Network Time: {}\n", result.trim()));

            if stderr.contains("administrator access") || result.contains("administrator access") {
                systemsetup_failed = true;
            } else {
                let network_time_on = result.to_lowercase().contains("on");
                status.service_running = network_time_on;

                if !network_time_on {
                    status
                        .issues
                        .push("Network time is not enabled".to_string());
                }
            }
        }

        // Fallback: check timed service via launchctl if systemsetup requires root
        if systemsetup_failed
            && let Ok(output) = silent_command("launchctl")
                .args(["list", "com.apple.timed"])
                .output()
        {
            status.service_running = output.status.success();
            status.raw_output.push_str(&format!(
                "timed via launchctl: {}\n",
                if output.status.success() {
                    "running"
                } else {
                    "not running"
                }
            ));
        }

        // Check NTP server
        if let Ok(output) = silent_command("systemsetup")
            .args(["-getnetworktimeserver"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("NTP Server: {}\n", result.trim()));

            // Parse "Network Time Server: time.apple.com"
            // Skip if the output contains error messages
            if !result.contains("administrator access")
                && let Some(server) = result.split(':').next_back()
            {
                let server = server.trim().to_string();
                if !server.is_empty() {
                    status.ntp_source = Some(server);
                }
            }
        }

        // Try sntp with a timeout (5 seconds) to verify actual synchronization
        // sntp can hang indefinitely if the NTP server is unreachable
        let ntp_server = status
            .ntp_source
            .clone()
            .unwrap_or_else(|| "time.apple.com".to_string());

        if let Ok(output) = silent_command("sntp")
            .args(["-t", "1", &ntp_server])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            status.raw_output.push_str(&format!(
                "=== sntp ===\nstdout: {}\nstderr: {}\n",
                result.trim(),
                stderr.trim()
            ));

            // sntp outputs to stderr typically; a successful query means NTP is reachable
            let combined = format!("{} {}", result, stderr);
            if ntp_response_verified(output.status.success(), &combined) {
                status.synchronized = true;
            }
        }

        if !status.synchronized {
            return Err(ScannerError::CheckExecution(
                "Time synchronization could not be verified".to_string(),
            ));
        }

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<TimeSyncStatus> {
        Ok(TimeSyncStatus {
            synchronized: false,
            sync_method: "Unknown".to_string(),
            ntp_source: None,
            leap_status: None,
            service_running: false,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

/// The systemd units of the time daemons: chrony (Debian, RHEL), systemd's
/// own client, ntpd (classic, NTPsec) and OpenNTPD.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const TIME_DAEMON_UNITS: [&str; 7] = [
    "chrony",
    "chronyd",
    "systemd-timesyncd",
    "ntp",
    "ntpd",
    "ntpsec",
    "openntpd",
];

/// What the Linux commands said about time synchronization.
#[derive(Debug, Default)]
#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
struct LinuxTimeEvidence {
    /// Output of `chronyc tracking`, when chronyd answered.
    chrony_tracking: Option<String>,
    /// The units of [`TIME_DAEMON_UNITS`] systemd reports active.
    active_units: Vec<String>,
    /// Output of `ntpq -pn`, when ntpd answered.
    ntpq_peers: Option<String>,
    /// `NTPSynchronized` of timedated (the kernel's synchronized flag).
    ntp_synchronized: Option<bool>,
    raw_output: String,
}

/// The units `systemctl is-active <units…>` reports active, in the order
/// asked (one state per line).
#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
fn active_units(stdout: &str) -> Vec<String> {
    TIME_DAEMON_UNITS
        .iter()
        .zip(stdout.lines())
        .filter(|(_, state)| state.trim() == "active")
        .map(|(unit, _)| unit.to_string())
        .collect()
}

/// A yes/no property of `timedatectl show` output.
#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
fn show_property(stdout: &str, name: &str) -> Option<bool> {
    stdout.lines().find_map(|line| {
        let (key, value) = line.split_once('=')?;
        (key.trim() == name).then(|| value.trim().eq_ignore_ascii_case("yes"))
    })
}

/// "System clock synchronized: yes" (or "NTP synchronized: yes" on older
/// systemd) of `timedatectl status`.
#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
fn status_synchronized(stdout: &str) -> Option<bool> {
    stdout.lines().find_map(|line| {
        let (key, value) = line.split_once(':')?;
        let key = key.trim().to_ascii_lowercase();
        (key == "system clock synchronized" || key == "ntp synchronized")
            .then(|| value.trim().eq_ignore_ascii_case("yes"))
    })
}

/// The verdict on Linux: synchronized only when a time daemon runs and the
/// clock is synchronized; every reason against it is in `issues`.
#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
fn evaluate_linux(evidence: LinuxTimeEvidence) -> TimeSyncStatus {
    let mut status = TimeSyncStatus {
        synchronized: false,
        sync_method: "None".to_string(),
        ntp_source: None,
        leap_status: None,
        service_running: false,
        issues: vec![],
        raw_output: evidence.raw_output,
    };

    let mut chrony_synchronized = false;
    if let Some(ref tracking) = evidence.chrony_tracking {
        status.sync_method = "chrony".to_string();
        status.service_running = true;
        for line in tracking.lines() {
            let Some((key, value)) = line.split_once(':') else {
                continue;
            };
            let key = key.trim().to_ascii_lowercase();
            let value = value.trim();
            if key == "leap status" {
                chrony_synchronized = value.eq_ignore_ascii_case("normal");
                status.leap_status = Some(value.to_string());
            } else if key == "reference id" && !value.is_empty() {
                status.ntp_source = Some(value.to_string());
            }
        }
    } else if let Some(unit) = evidence.active_units.first() {
        status.service_running = true;
        status.sync_method = match unit.as_str() {
            "chrony" | "chronyd" => "chrony",
            "systemd-timesyncd" => "systemd-timesyncd",
            _ => "ntpd",
        }
        .to_string();
    } else if evidence.ntpq_peers.is_some() {
        status.service_running = true;
        status.sync_method = "ntpd".to_string();
    }

    let clock_synchronized = chrony_synchronized || evidence.ntp_synchronized == Some(true);
    status.synchronized = status.service_running && clock_synchronized;

    if !status.service_running {
        status
            .issues
            .push("No NTP service is running (chrony, systemd-timesyncd or ntpd)".to_string());
    }
    if !clock_synchronized {
        status
            .issues
            .push("System clock is not synchronized".to_string());
    }
    status
}

#[cfg(any(target_os = "macos", test))]
fn ntp_response_verified(success: bool, response: &str) -> bool {
    success && (response.contains("+/-") || response.contains("offset"))
}

impl Default for TimeSyncCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for TimeSyncCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        let execution = async {
            #[cfg(target_os = "windows")]
            let status = self.check_windows().await?;

            #[cfg(target_os = "linux")]
            let status = self.check_linux().await?;

            #[cfg(target_os = "macos")]
            let status = self.check_macos().await?;

            #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
            let status = self.check_unsupported().await?;

            Ok::<TimeSyncStatus, crate::error::ScannerError>(status)
        };

        let status_result =
            tokio::time::timeout(std::time::Duration::from_millis(1900), execution).await;

        let status = match status_result {
            Ok(Ok(s)) => s,
            Ok(Err(e)) => return Err(e),
            Err(_) => {
                let status = TimeSyncStatus {
                    synchronized: false,
                    sync_method: "Timeout".to_string(),
                    ntp_source: None,
                    leap_status: None,
                    service_running: false,
                    issues: vec![
                        "Time synchronization check timed out (NFR limit protection)".to_string(),
                    ],
                    raw_output: "Execution timed out after 1900ms".to_string(),
                };
                return Ok(CheckOutput::fail(
                    "Time synchronization check timed out".to_string(),
                    serde_json::to_value(&status).unwrap_or_default(),
                ));
            }
        };

        let raw_data = serde_json::to_value(&status).unwrap_or_default();

        // The verdict never contradicts its proof: a reported issue fails.
        if status.synchronized && status.issues.is_empty() {
            let mut details = vec![format!("method={}", status.sync_method)];
            if let Some(source) = &status.ntp_source {
                details.push(format!("source={}", source));
            }
            if let Some(leap) = &status.leap_status {
                details.push(format!("leap={}", leap));
            }

            Ok(CheckOutput::pass(
                format!("Time is properly synchronized: {}", details.join(", ")),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("Time synchronization issues: {}", status.issues.join("; ")),
                raw_data,
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CHRONY_SYNCED: &str = "Reference ID    : C0A80001 (192.168.0.1)\n\
Stratum         : 3\n\
Leap status     : Normal\n";

    fn evidence() -> LinuxTimeEvidence {
        LinuxTimeEvidence::default()
    }

    /// The case seen on a Debian VM: the hypervisor keeps the clock right,
    /// no daemon runs. It passed with "No NTP service is running" in its proof.
    #[test]
    fn a_synchronized_clock_without_a_daemon_fails() {
        let status = evaluate_linux(LinuxTimeEvidence {
            ntp_synchronized: Some(true),
            ..evidence()
        });
        assert!(!status.synchronized);
        assert!(!status.service_running);
        assert_eq!(status.issues.len(), 1);
        assert!(status.issues[0].contains("No NTP service is running"));
    }

    #[test]
    fn chrony_in_sync_passes() {
        let status = evaluate_linux(LinuxTimeEvidence {
            chrony_tracking: Some(CHRONY_SYNCED.to_string()),
            active_units: vec!["chrony".to_string()],
            ..evidence()
        });
        assert!(status.synchronized, "{:?}", status.issues);
        assert!(status.issues.is_empty());
        assert_eq!(status.sync_method, "chrony");
        assert_eq!(status.leap_status.as_deref(), Some("Normal"));
        assert_eq!(status.ntp_source.as_deref(), Some("C0A80001 (192.168.0.1)"));
    }

    #[test]
    fn chrony_not_in_sync_fails() {
        let status = evaluate_linux(LinuxTimeEvidence {
            chrony_tracking: Some("Leap status     : Not synchronised\n".to_string()),
            ntp_synchronized: Some(false),
            ..evidence()
        });
        assert!(!status.synchronized);
        assert!(status.service_running);
        assert_eq!(status.issues, ["System clock is not synchronized"]);
    }

    #[test]
    fn timesyncd_and_ntpd_count_as_time_daemons() {
        for (unit, method) in [
            ("systemd-timesyncd", "systemd-timesyncd"),
            ("ntpsec", "ntpd"),
        ] {
            let status = evaluate_linux(LinuxTimeEvidence {
                active_units: vec![unit.to_string()],
                ntp_synchronized: Some(true),
                ..evidence()
            });
            assert!(status.synchronized, "{unit}");
            assert_eq!(status.sync_method, method);
        }
        let ntpq = evaluate_linux(LinuxTimeEvidence {
            ntpq_peers: Some("*192.168.0.1 ...".to_string()),
            ntp_synchronized: Some(true),
            ..evidence()
        });
        assert!(ntpq.synchronized);
        assert_eq!(ntpq.sync_method, "ntpd");
    }

    #[test]
    fn a_daemon_with_an_unsynchronized_clock_fails() {
        let status = evaluate_linux(LinuxTimeEvidence {
            active_units: vec!["systemd-timesyncd".to_string()],
            ntp_synchronized: Some(false),
            ..evidence()
        });
        assert!(!status.synchronized);
        assert_eq!(status.issues, ["System clock is not synchronized"]);
    }

    #[test]
    fn systemctl_and_timedatectl_outputs_are_read() {
        // One state per unit asked, in order.
        let states = "inactive\ninactive\nactive\ninactive\nunknown\ninactive\ninactive\n";
        assert_eq!(active_units(states), ["systemd-timesyncd"]);
        assert!(active_units("inactive\n").is_empty());

        assert_eq!(
            show_property("NTP=yes\nNTPSynchronized=no\n", "NTPSynchronized"),
            Some(false)
        );
        assert_eq!(
            show_property("NTP=no\nNTPSynchronized=yes\n", "NTPSynchronized"),
            Some(true)
        );
        assert_eq!(show_property("NTP=yes\n", "NTPSynchronized"), None);

        let status = "               Local time: Fri 2026-11-28 10:00:00 CET\n\
System clock synchronized: yes\n\
              NTP service: inactive\n";
        assert_eq!(status_synchronized(status), Some(true));
        assert_eq!(status_synchronized("NTP synchronized: no\n"), Some(false));
    }

    #[test]
    fn ntp_requires_successful_measurement() {
        assert!(!ntp_response_verified(false, "offset unavailable"));
        assert!(!ntp_response_verified(true, "service running"));
        assert!(!ntp_response_verified(true, ""));
        assert!(ntp_response_verified(true, "0.001 +/- 0.01"));
    }

    #[test]
    fn test_check_creation() {
        let check = TimeSyncCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::TimeSync);
        assert_eq!(check.definition().severity, CheckSeverity::Medium);
    }

    #[test]
    fn test_check_frameworks() {
        let check = TimeSyncCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"CIS_V8".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_time_sync_status_serialization() {
        let status = TimeSyncStatus {
            synchronized: true,
            sync_method: "chrony".to_string(),
            ntp_source: Some("ntp.ubuntu.com".to_string()),
            leap_status: Some("Normal".to_string()),
            service_running: true,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"synchronized\":true"));
        assert!(json.contains("\"sync_method\":\"chrony\""));
        assert!(json.contains("ntp.ubuntu.com"));

        let parsed: TimeSyncStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.synchronized);
        assert_eq!(parsed.ntp_source, Some("ntp.ubuntu.com".to_string()));
    }

    #[test]
    fn test_time_sync_not_synchronized() {
        let status = TimeSyncStatus {
            synchronized: false,
            sync_method: "Unknown".to_string(),
            ntp_source: None,
            leap_status: None,
            service_running: false,
            issues: vec!["No NTP service is running".to_string()],
            raw_output: String::new(),
        };

        assert!(!status.synchronized);
        assert!(!status.service_running);
        assert_eq!(status.issues.len(), 1);
    }

    #[test]
    fn test_w32time_status() {
        let status = TimeSyncStatus {
            synchronized: true,
            sync_method: "W32Time".to_string(),
            ntp_source: Some("time.windows.com".to_string()),
            leap_status: Some("0(no warning)".to_string()),
            service_running: true,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        let parsed: TimeSyncStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.synchronized);
        assert_eq!(parsed.sync_method, "W32Time");
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = TimeSyncCheck::new();
        let result = check.execute().await;

        // Network/privilege restrictions may prevent a measurement. That
        // must be explicit rather than converted into a passing result.
        match result {
            Ok(output) => assert!(!output.message.is_empty()),
            Err(crate::error::ScannerError::CheckExecution(message)) => {
                assert!(!message.is_empty())
            }
            Err(error) => panic!("Unexpected check error: {error}"),
        }
    }

    #[test]
    fn test_check_definition_builder() {
        let check = TimeSyncCheck::new();
        let def = check.definition();

        assert_eq!(def.name, "Time Synchronization");
        assert!(def.description.contains("NTP"));
        assert!(def.enabled);
    }
}
