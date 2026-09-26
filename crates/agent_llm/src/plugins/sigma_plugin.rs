// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

use super::AIPlugin;
use anyhow::{Result, anyhow};
use async_trait::async_trait;
use serde_json::{Value, json};

/// Sovereign Sigma Rules Matching Plugin.
/// Analyzes suspicious process command lines and telemetry offline.
pub struct SigmaRulePlugin;

struct SigmaRule {
    id: &'static str,
    title: &'static str,
    severity: &'static str,
    mitre_technique: &'static str,
    patterns: &'static [&'static str],
    description: &'static str,
    recommended_action: &'static str,
}

static SIGMA_RULES: &[SigmaRule] = &[
    SigmaRule {
        id: "SIGMA-WIN-001",
        title: "Mimikatz / LSASS Memory Dumping Command Line",
        severity: "CRITICAL",
        mitre_technique: "T1003.001",
        patterns: &[
            "sekurlsa",
            "logonpasswords",
            "lsadump",
            "procdump -ma lsass",
            "comsvcs.dll #24",
        ],
        description: "Detects well-known LSASS memory dumping utilities and commands aimed at harvesting plaintext credentials or hashes.",
        recommended_action: "Immediately terminate the parent process, isolate host, and trigger enterprise credential reset.",
    },
    SigmaRule {
        id: "SIGMA-WIN-002",
        title: "Suspicious Encoded or Hidden PowerShell Execution",
        severity: "HIGH",
        mitre_technique: "T1059.001",
        patterns: &[
            "-enc ",
            "-encodedcommand",
            "downloadstring",
            "invoke-expression",
            "iex(",
            "bypass -nop -w hidden",
        ],
        description: "Detects hidden, obfuscated, or encoded PowerShell commands commonly used by initial access droppers and memory loaders.",
        recommended_action: "Capture parent process memory dump, terminate process tree, and inspect origin network connection.",
    },
    SigmaRule {
        id: "SIGMA-WIN-003",
        title: "Shadow Copy Deletion / Ransomware Defense Evasion",
        severity: "CRITICAL",
        mitre_technique: "T1490",
        patterns: &[
            "vssadmin delete shadows",
            "resize shadowstorage",
            "wmic shadowcopy delete",
            "wbadmin delete catalog",
        ],
        description: "Detects destruction of Volume Shadow Copies, a standard precursor step to ransomware encryption.",
        recommended_action: "Trigger immediate emergency network quarantine of the host to halt ransomware spread.",
    },
    SigmaRule {
        id: "SIGMA-LNX-001",
        title: "Linux Reverse Shell via Bash or Netcat",
        severity: "CRITICAL",
        mitre_technique: "T1059.004",
        patterns: &[
            "/dev/tcp/",
            "bash -i >&",
            "nc -e /bin/",
            "ncat -e /bin/sh",
            "mkfifo /tmp/",
        ],
        description: "Detects interactive reverse shell commands redirected through network sockets or named pipes.",
        recommended_action: "Kill offending process and child sessions, drop connection via iptables, and inspect web server logs.",
    },
    SigmaRule {
        id: "SIGMA-WIN-004",
        title: "LOLBIN Abuse: CertUtil Remote Download",
        severity: "MEDIUM",
        mitre_technique: "T1105",
        patterns: &[
            "certutil -urlcache",
            "certutil.exe -urlcache -split -f",
            "bitsadmin /transfer",
        ],
        description: "Detects abuse of built-in legitimate utilities to download malicious payloads from remote infrastructure.",
        recommended_action: "Block the download destination IP/domain on gateway firewall and quarantine downloaded file artifact.",
    },
];

#[async_trait]
impl AIPlugin for SigmaRulePlugin {
    fn name(&self) -> &'static str {
        "sigma_rule_matcher"
    }

    fn description(&self) -> &'static str {
        "Evaluates telemetry, process execution command-lines, and network events against Sigma detection rules. Input should contain 'command_line' or 'telemetry'."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "command_line": {
                    "type": "string",
                    "description": "The command line or telemetry string to evaluate against detection rules"
                }
            },
            "required": ["command_line"]
        })
    }

    async fn execute(&self, input: Value) -> Result<Value> {
        let cmd = input["command_line"]
            .as_str()
            .ok_or_else(|| anyhow!("Missing 'command_line' field"))?
            .to_lowercase();

        let mut matches = Vec::new();
        for rule in SIGMA_RULES {
            for pattern in rule.patterns {
                if cmd.contains(&pattern.to_lowercase()) {
                    matches.push(json!({
                        "rule_id": rule.id,
                        "title": rule.title,
                        "severity": rule.severity,
                        "mitre_technique": rule.mitre_technique,
                        "matched_pattern": pattern,
                        "description": rule.description,
                        "recommended_action": rule.recommended_action
                    }));
                    break;
                }
            }
        }

        if matches.is_empty() {
            Ok(json!({
                "status": "clean",
                "matched_rules_count": 0,
                "message": "No high-severity Sigma detection rules triggered for this command line."
            }))
        } else {
            Ok(json!({
                "status": "alert",
                "matched_rules_count": matches.len(),
                "highest_severity": matches.iter().any(|m| m["severity"] == "CRITICAL").then_some("CRITICAL").unwrap_or("HIGH"),
                "detections": matches
            }))
        }
    }
}
