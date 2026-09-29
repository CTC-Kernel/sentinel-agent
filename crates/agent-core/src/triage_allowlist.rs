// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Local triage authorizations pushed by the desktop GUI.
//!
//! An authorized event is still collected and forwarded (platform, SIEM, local
//! audit trail) so the security team keeps a complete record. What it no longer
//! does is interrupt the operator or act on the host: no notification, no
//! detection-rule match and no playbook execution.

use agent_gui::dto::{AllowlistRule, AllowlistRuleType as Kind, allowlist_covers};

/// Whether a security-scan incident is covered by an authorization.
pub fn incident_is_authorized(
    rules: &[AllowlistRule],
    incident: &agent_scanner::SecurityIncident,
) -> bool {
    if rules.is_empty() {
        return false;
    }
    let process = incident
        .evidence
        .get("process_name")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    allowlist_covers(rules, Kind::ProcessPattern, process)
        || allowlist_covers(
            rules,
            Kind::SystemIncident,
            &incident.incident_type.to_string(),
        )
        || allowlist_covers(rules, Kind::SystemIncident, &incident.title)
}

/// Whether a network alert is covered. Only the remote peer is compared: the
/// local address is this host and would cover every alert.
pub fn network_alert_is_authorized(
    rules: &[AllowlistRule],
    alert: &agent_network::NetworkSecurityAlert,
) -> bool {
    alert
        .connection
        .as_ref()
        .and_then(|c| c.remote_address.as_deref())
        .is_some_and(|remote| allowlist_covers(rules, Kind::IpAddress, remote))
}

/// Whether a FIM change on `path` is covered.
pub fn fim_path_is_authorized(rules: &[AllowlistRule], path: &str) -> bool {
    allowlist_covers(rules, Kind::FilePath, path)
}

/// Copies of the pipeline inputs without authorized events.
pub fn unauthorized_pipeline_inputs(
    rules: &[AllowlistRule],
    incidents: &[agent_scanner::SecurityIncident],
    network_alerts: &[agent_network::NetworkSecurityAlert],
    fim_alerts: &[(String, String)],
) -> (
    Vec<agent_scanner::SecurityIncident>,
    Vec<agent_network::NetworkSecurityAlert>,
    Vec<(String, String)>,
) {
    (
        incidents
            .iter()
            .filter(|i| !incident_is_authorized(rules, i))
            .cloned()
            .collect(),
        network_alerts
            .iter()
            .filter(|a| !network_alert_is_authorized(rules, a))
            .cloned()
            .collect(),
        fim_alerts
            .iter()
            .filter(|(path, _)| !fim_path_is_authorized(rules, path))
            .cloned()
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_scanner::{IncidentSeverity, IncidentType, SecurityIncident};

    fn rule(kind: Kind, pattern: &str) -> AllowlistRule {
        AllowlistRule {
            id: uuid::Uuid::new_v4(),
            rule_type: kind,
            pattern: pattern.into(),
            description: "test".into(),
            created_at: chrono::Utc::now(),
            created_by: "test".into(),
        }
    }

    fn process_incident(name: &str) -> SecurityIncident {
        SecurityIncident::new(
            IncidentType::SuspiciousProcess,
            IncidentSeverity::High,
            "Processus suspect",
            "test",
        )
        .with_evidence(serde_json::json!({ "process_name": name, "pid": 4242 }))
    }

    #[test]
    fn process_and_incident_type_rules_cover_scan_incidents() {
        let incident = process_incident("backup-daily");
        assert!(!incident_is_authorized(&[], &incident));
        let rules = [rule(Kind::ProcessPattern, "backup-*")];
        assert!(incident_is_authorized(&rules, &incident));
        assert!(!incident_is_authorized(
            &rules,
            &process_incident("evil-backup")
        ));

        let firewall = SecurityIncident::new(
            IncidentType::FirewallDisabled,
            IncidentSeverity::High,
            "Pare-feu désactivé",
            "Profil public",
        );
        assert!(!incident_is_authorized(&rules, &firewall));
        let rules = [rule(Kind::SystemIncident, "firewall_disabled")];
        assert!(incident_is_authorized(&rules, &firewall));
    }

    #[test]
    fn authorized_events_are_removed_from_pipeline_inputs_only_while_rule_exists() {
        let incidents = vec![process_incident("backup-daily"), process_incident("miner")];
        let fim = vec![
            ("/var/log/app/a.log".to_string(), "modified".to_string()),
            ("/etc/passwd".to_string(), "modified".to_string()),
        ];
        let rules = vec![
            rule(Kind::ProcessPattern, "backup-*"),
            rule(Kind::FilePath, "/var/log/app/*"),
        ];
        let (i, n, f) = unauthorized_pipeline_inputs(&rules, &incidents, &[], &fim);
        assert_eq!(i.len(), 1);
        assert_eq!(i[0].evidence["process_name"], "miner");
        assert!(n.is_empty());
        assert_eq!(f, vec![fim[1].clone()]);

        // Revoking the rules restores every event.
        let (i, _, f) = unauthorized_pipeline_inputs(&[], &incidents, &[], &fim);
        assert_eq!((i.len(), f.len()), (2, 2));
    }
}
