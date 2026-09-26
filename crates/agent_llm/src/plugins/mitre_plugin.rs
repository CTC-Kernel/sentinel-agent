// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

use super::AIPlugin;
use anyhow::{Result, anyhow};
use async_trait::async_trait;
use serde_json::{Value, json};

/// Sovereign MITRE ATT&CK Knowledge Base Plugin.
/// Operates 100% locally with zero external network egress.
pub struct MitreAttackPlugin;

struct MitreTechnique {
    id: &'static str,
    name: &'static str,
    tactic: &'static str,
    description: &'static str,
    mitigation: &'static str,
    detection: &'static str,
}

static TECHNIQUES: &[MitreTechnique] = &[
    MitreTechnique {
        id: "T1059.001",
        name: "Command and Scripting Interpreter: PowerShell",
        tactic: "Execution",
        description: "Adversaries abuse PowerShell to execute arbitrary commands, scripts, or download secondary payloads in memory.",
        mitigation: "Enable PowerShell Script Block Logging (EID 4104), Constrained Language Mode, and execution policy Restricted.",
        detection: "Monitor process creation with command-line arguments like -enc, -nop, -w hidden, or Invoke-Expression.",
    },
    MitreTechnique {
        id: "T1078",
        name: "Valid Accounts",
        tactic: "Defense Evasion, Persistence, Privilege Escalation, Initial Access",
        description: "Adversaries obtain and abuse credentials of existing enterprise or cloud accounts to maintain undetected access.",
        mitigation: "Enforce multi-factor authentication (MFA/FIDO2), conditional access policies, and automated dormant account revocation.",
        detection: "Correlate anomalous login locations, impossible travel, and privilege usage outside normal operating hours.",
    },
    MitreTechnique {
        id: "T1003",
        name: "OS Credential Dumping",
        tactic: "Credential Access",
        description: "Adversaries dump credentials from the LSASS memory, SAM database, or shadow copies to obtain plaintext passwords or hashes.",
        mitigation: "Enable Windows Defender Credential Guard, LSA Protection (RunAsPPL), and restrict SeDebugPrivilege.",
        detection: "Detect OpenProcess calls targeting lsass.exe with PROCESS_VM_READ access mask (Sysmon EID 10).",
    },
    MitreTechnique {
        id: "T1021.001",
        name: "Remote Services: Remote Desktop Protocol",
        tactic: "Lateral Movement",
        description: "Adversaries log into systems using valid credentials over RDP to move laterally within the network.",
        mitigation: "Disable public RDP, require VPN + MFA, enable Network Level Authentication (NLA), and enforce jump hosts.",
        detection: "Monitor event ID 4624 (Logon Type 10) and outbound TCP port 3389 connections between internal workstations.",
    },
    MitreTechnique {
        id: "T1486",
        name: "Data Encrypted for Impact",
        tactic: "Impact",
        description: "Adversaries encrypt data on target systems to interrupt availability and demand ransom.",
        mitigation: "Maintain immutable offline backups, test restoration procedures regularly, and deploy Canary file traps.",
        detection: "Alert on rapid file rename/write bursts, creation of known ransom notes, or vssadmin delete shadows execution.",
    },
    MitreTechnique {
        id: "T1562.001",
        name: "Impair Defenses: Disable or Modify Tools",
        tactic: "Defense Evasion",
        description: "Adversaries disable security software, firewall rules, or logging agents to avoid detection.",
        mitigation: "Enable tamper protection on EDR agents, enforce signed policies, and alert on service stop attempts.",
        detection: "Monitor stopping of security services, sc.exe config changes, or PowerShell Set-MpPreference -DisableRealtimeMonitoring.",
    },
    MitreTechnique {
        id: "T1190",
        name: "Exploit Public-Facing Application",
        tactic: "Initial Access",
        description: "Adversaries exploit vulnerabilities in public-facing servers, web applications, or edge VPN appliances.",
        mitigation: "Implement continuous vulnerability scanning, automated patch management, and web application firewalls (WAF).",
        detection: "Correlate web server crash dumps, abnormal child processes spawning from httpd/nginx/iis, and suspicious inbound payloads.",
    },
    MitreTechnique {
        id: "T1566",
        name: "Phishing",
        tactic: "Initial Access",
        description: "Adversaries send malicious emails with attachments or links to compromise accounts or gain initial foothold.",
        mitigation: "Enforce strict SPF, DKIM, DMARC validation, user security awareness training, and sandbox attachment scanning.",
        detection: "Analyze high volumes of inbound external emails containing archive files, macro-enabled documents, or lookalike domains.",
    },
];

#[async_trait]
impl AIPlugin for MitreAttackPlugin {
    fn name(&self) -> &'static str {
        "mitre_attack_lookup"
    }

    fn description(&self) -> &'static str {
        "Provides sovereign offline MITRE ATT&CK intelligence: techniques, tactics, mitigations, and detection strategies. Input should contain 'query' (e.g. 'T1059', 'credential dumping', 'PowerShell', 'lateral movement')."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Technique ID (e.g. T1059.001) or threat keyword (e.g. rdp, lsass, phishing)"
                }
            },
            "required": ["query"]
        })
    }

    async fn execute(&self, input: Value) -> Result<Value> {
        let query = input["query"]
            .as_str()
            .ok_or_else(|| anyhow!("Missing 'query' field"))?
            .to_lowercase();

        let matches: Vec<Value> = TECHNIQUES
            .iter()
            .filter(|t| {
                t.id.to_lowercase().contains(&query)
                    || t.name.to_lowercase().contains(&query)
                    || t.tactic.to_lowercase().contains(&query)
                    || t.description.to_lowercase().contains(&query)
            })
            .map(|t| {
                json!({
                    "technique_id": t.id,
                    "name": t.name,
                    "tactic": t.tactic,
                    "description": t.description,
                    "mitigation": t.mitigation,
                    "detection": t.detection,
                })
            })
            .collect();

        if matches.is_empty() {
            Ok(json!({
                "status": "not_found",
                "message": format!("No exact MITRE ATT&CK technique found for '{}'. Review standard enterprise tactics.", query),
                "total_matched": 0
            }))
        } else {
            Ok(json!({
                "status": "success",
                "total_matched": matches.len(),
                "techniques": matches
            }))
        }
    }
}
