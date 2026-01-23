//! Process monitoring for suspicious activity detection.

use super::{IncidentSeverity, IncidentType, SecurityIncident};
use crate::error::ScannerResult;
use std::collections::HashSet;
use tracing::{debug, warn};

/// Known suspicious process names (lowercase).
const SUSPICIOUS_PROCESSES: &[(&str, &str, IncidentType)] = &[
    // Crypto miners
    ("xmrig", "XMRig crypto miner", IncidentType::CryptoMiner),
    ("minerd", "CPU miner", IncidentType::CryptoMiner),
    ("cgminer", "ASIC/GPU miner", IncidentType::CryptoMiner),
    ("bfgminer", "ASIC/GPU miner", IncidentType::CryptoMiner),
    ("cpuminer", "CPU miner", IncidentType::CryptoMiner),
    ("ethminer", "Ethereum miner", IncidentType::CryptoMiner),
    ("xmr-stak", "Monero miner", IncidentType::CryptoMiner),
    ("t-rex", "T-Rex GPU miner", IncidentType::CryptoMiner),
    ("nbminer", "NBMiner", IncidentType::CryptoMiner),
    ("phoenixminer", "Phoenix miner", IncidentType::CryptoMiner),
    ("lolminer", "lolMiner", IncidentType::CryptoMiner),
    ("gminer", "GMiner", IncidentType::CryptoMiner),
    // Reverse shells / network tools (in suspicious context)
    ("nc", "netcat - potential reverse shell", IncidentType::ReverseShell),
    ("ncat", "ncat - potential reverse shell", IncidentType::ReverseShell),
    ("netcat", "netcat - potential reverse shell", IncidentType::ReverseShell),
    ("socat", "socat - potential tunnel", IncidentType::ReverseShell),
    // Credential theft tools
    ("mimikatz", "Mimikatz credential stealer", IncidentType::CredentialTheft),
    ("lazagne", "LaZagne credential stealer", IncidentType::CredentialTheft),
    ("secretsdump", "Impacket secretsdump", IncidentType::CredentialTheft),
    ("procdump", "ProcDump (may dump credentials)", IncidentType::CredentialTheft),
    ("gsecdump", "Credential dump tool", IncidentType::CredentialTheft),
    ("wce", "Windows Credential Editor", IncidentType::CredentialTheft),
    // Post-exploitation
    ("meterpreter", "Metasploit payload", IncidentType::Malware),
    ("beacon", "Cobalt Strike beacon", IncidentType::Malware),
    ("empire", "PowerShell Empire", IncidentType::Malware),
    ("covenant", "Covenant C2", IncidentType::Malware),
    // Privilege escalation
    ("getsystem", "Privilege escalation", IncidentType::PrivilegeEscalation),
    ("pspy", "Process spy - enumeration tool", IncidentType::PrivilegeEscalation),
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
}

impl ProcessMonitor {
    /// Create a new process monitor.
    pub fn new() -> Self {
        Self {
            custom_patterns: HashSet::new(),
        }
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
                    if let Ok(pid) = name.parse::<u32>() {
                        if let Ok(proc_info) = self.read_proc_info(&path, pid) {
                            processes.push(proc_info);
                        }
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
        let path = fs::read_link(exe_path).ok().map(|p| p.to_string_lossy().to_string());

        // Read cmdline
        let cmdline_path = proc_path.join("cmdline");
        let cmdline = fs::read_to_string(cmdline_path)
            .ok()
            .map(|s| s.replace('\0', " ").trim().to_string())
            .filter(|s| !s.is_empty());

        // Read status for ppid
        let status_path = proc_path.join("status");
        let ppid = fs::read_to_string(status_path)
            .ok()
            .and_then(|s| {
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
        use std::process::Command;

        let output = Command::new("ps")
            .args(["-axo", "pid,ppid,user,comm"])
            .output()
            .map_err(|e| crate::error::ScannerError::Command(format!("Failed to run ps: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut processes = Vec::new();

        for line in stdout.lines().skip(1) {
            // Skip header
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                let pid: u32 = parts[0].parse().unwrap_or(0);
                let ppid: u32 = parts[1].parse().unwrap_or(0);
                let user = parts[2].to_string();
                let name = parts[3..].join(" ");

                processes.push(ProcessInfo {
                    pid,
                    name,
                    path: None,
                    cmdline: None,
                    ppid: Some(ppid),
                    user: Some(user),
                });
            }
        }

        Ok(processes)
    }

    #[cfg(target_os = "windows")]
    fn get_processes(&self) -> ScannerResult<Vec<ProcessInfo>> {
        use std::process::Command;

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-Process | Select-Object Id,ProcessName,Path | ConvertTo-Json",
            ])
            .output()
            .map_err(|e| {
                crate::error::ScannerError::Command(format!("Failed to run Get-Process: {}", e))
            })?;

        #[derive(serde::Deserialize)]
        #[serde(rename_all = "PascalCase")]
        struct WinProcess {
            id: u32,
            process_name: String,
            path: Option<String>,
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let processes: Vec<WinProcess> = serde_json::from_str(&stdout).unwrap_or_default();

        Ok(processes
            .into_iter()
            .map(|p| ProcessInfo {
                pid: p.id,
                name: p.process_name,
                path: p.path,
                cmdline: None,
                ppid: None,
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

        // Check against known suspicious processes
        for (pattern, description, incident_type) in SUSPICIOUS_PROCESSES {
            if name_lower.contains(pattern) {
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
            if cmdline_lower.contains("-encodedcommand")
                || cmdline_lower.contains("-enc ")
                || cmdline_lower.contains("frombase64")
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

    /// Scan all running processes for suspicious activity.
    pub async fn scan_processes(&self) -> ScannerResult<(Vec<SecurityIncident>, u32)> {
        let processes = self.get_processes()?;
        let count = processes.len() as u32;
        let mut incidents = Vec::new();

        debug!("Scanning {} processes", count);

        for proc in processes {
            if let Some(incident) = self.analyze_process(&proc) {
                warn!(
                    "Suspicious process detected: {} (PID: {})",
                    proc.name, proc.pid
                );
                incidents.push(incident);
            }
        }

        Ok((incidents, count))
    }
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
}
