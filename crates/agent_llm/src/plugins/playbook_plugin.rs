// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

use super::AIPlugin;
use anyhow::{Result, anyhow};
use async_trait::async_trait;
use serde_json::{Value, json};

/// Autonomous Remediation Playbook Generator Plugin.
/// Generates structured Sentinel remediation actions based on threat assessment.
pub struct RemediationPlaybookPlugin;

#[async_trait]
impl AIPlugin for RemediationPlaybookPlugin {
    fn name(&self) -> &'static str {
        "remediation_playbook_generator"
    }

    fn description(&self) -> &'static str {
        "Generates structured autonomous Sentinel SOC remediation playbooks. Input accepts 'threat_type' ('ransomware', 'lateral_movement', 'c2_beacon', 'phishing', 'privilege_escalation') and optional 'target' (host name, IP, or process name)."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "threat_type": {
                    "type": "string",
                    "description": "Category of threat: 'ransomware', 'lateral_movement', 'c2_beacon', 'phishing', 'privilege_escalation'"
                },
                "target": {
                    "type": "string",
                    "description": "Target identifier (e.g. host name, IP address, or user account)"
                }
            },
            "required": ["threat_type"]
        })
    }

    async fn execute(&self, input: Value) -> Result<Value> {
        let threat_type = input["threat_type"]
            .as_str()
            .ok_or_else(|| anyhow!("Missing 'threat_type' field"))?
            .to_lowercase();
        let target = input["target"].as_str().unwrap_or("target-system");

        let (name, risk, sla, actions) = match threat_type.as_str() {
            "ransomware" => (
                "Isolation & Confinement Immédiat Ransomware",
                "HIGH",
                "3s",
                vec![
                    json!({ "type": "KillProcess", "target": "offending_binary", "description": "Terminer le processus responsable du chiffrement suspect" }),
                    json!({ "type": "IsolateHost", "target": target, "description": "Isoler la carte réseau de l'hôte via l'EDR Sentinel" }),
                    json!({ "type": "QuarantineFile", "target": "suspicious_payload", "description": "Déplacer le binaire malveillant vers le coffre-fort chiffré" }),
                    json!({ "type": "AlertSOC", "severity": "CRITICAL", "description": "Alerte d'astreinte SOC P1 avec corrélation MITRE T1486" }),
                ],
            ),
            "lateral_movement" => (
                "Révocation & Rupture Mouvement Latéral",
                "HIGH",
                "5s",
                vec![
                    json!({ "type": "RevokeSession", "target": target, "description": "Révoquer immédiatement les tokens Kerberos / JWT de l'identité compromise" }),
                    json!({ "type": "BlockPort", "port": 3389, "target": target, "description": "Fermer les flux RDP et SMB non autorisés sur le segment réseau" }),
                    json!({ "type": "AuditLogon", "target": target, "description": "Capturer les événements d'authentification des 6 dernières heures" }),
                ],
            ),
            "c2_beacon" => (
                "Neutralisation Balise C2 & Blocage Passerelle",
                "MEDIUM",
                "2s",
                vec![
                    json!({ "type": "BlockIp", "ip": target, "duration_secs": 86400, "description": "Injecter la règle de blocage IP sur le firewall de bordure et DNS Sinkhole" }),
                    json!({ "type": "KillProcess", "target": "beacon_process", "description": "Tuer le processus à l'origine du socket réseau anormal" }),
                    json!({ "type": "Notify", "channel": "slack:soc-critical", "description": "Notifier les analystes de garde de la neutralisation" }),
                ],
            ),
            "phishing" => (
                "Purge de Campagne Phishing & Révocation Identité",
                "MEDIUM",
                "15s",
                vec![
                    json!({ "type": "PurgeMailboxes", "target": target, "description": "Supprimer l'email suspect de toutes les boîtes de réception de l'organisation" }),
                    json!({ "type": "ResetPasswordMFA", "target": target, "description": "Forcer le renouvellement du mot de passe et réinitialiser les sessions MFA" }),
                    json!({ "type": "BlockDomain", "target": target, "description": "Ajouter le domaine de phishing sur les proxies web et serveurs DNS" }),
                ],
            ),
            _ => (
                "Plan de Remédiation Standard Sentinel",
                "LOW",
                "30s",
                vec![
                    json!({ "type": "CollectEvidence", "target": target, "description": "Collecter la télémétrie système, mémoire et logs récents" }),
                    json!({ "type": "Notify", "channel": "soc-dashboard", "description": "Créer un ticket d'investigation niveau 1" }),
                ],
            ),
        };

        Ok(json!({
            "status": "success",
            "playbook": {
                "name": name,
                "threat_type": threat_type,
                "target": target,
                "risk_level": risk,
                "execution_sla": sla,
                "total_actions": actions.len(),
                "actions": actions,
                "requires_four_eyes_approval": risk == "HIGH"
            }
        }))
    }
}
