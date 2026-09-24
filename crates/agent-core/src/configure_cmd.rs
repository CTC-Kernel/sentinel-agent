// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! `configure` server command (signed MDM policy push).
//!
//! Payload (platform `commandSigning.js` schema, built by
//! `mdmCommands.js` `handleConfigureCommand`):
//! `{ policyId, policy: { settings, rules } | null, action: "enforce" | "audit" | "remove" }`.
//!
//! Policy entries naming a setting the agent already takes from its
//! configuration (`GET /v1/agents/:id/config` keys, see
//! [`CONFIGURABLE_KEYS`]) are stored and applied through the same path as a
//! configuration download. Anything else cannot be enforced by the agent:
//! it is reported as unsupported and, when nothing is applicable, the agent
//! refreshes its configuration from the platform instead. The command
//! result `output` is a JSON object read by the platform
//! (`processConfigureResult`: `complianceStatus`, `violations`).

use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use tracing::info;

use super::AgentRuntime;

/// Configuration keys a `configure` policy may set (the keys applied by
/// `AgentRuntime::apply_stored_config`).
pub(crate) const CONFIGURABLE_KEYS: &[&str] = &[
    agent_sync::config_keys::HEARTBEAT_INTERVAL_SECS,
    agent_sync::config_keys::CHECK_INTERVAL_SECS,
    agent_sync::config_keys::LOG_LEVEL,
    agent_sync::config_keys::ACTIVE_FRAMEWORKS,
    agent_sync::config_keys::FIM_CONFIG,
    agent_sync::config_keys::USB_POLICY,
    agent_sync::config_keys::SIEM_CONFIG,
    agent_sync::config_keys::THREAT_INTEL,
    agent_sync::config_keys::ENABLE_NETWORK_MONITORING,
];

/// Requested policy action.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ConfigureAction {
    Enforce,
    Audit,
    Remove,
}

/// What the agent does with a `configure` command.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ConfigureDecision {
    /// Store and apply the supported settings.
    Apply,
    /// Compare the supported settings with the stored configuration only.
    Audit,
    /// Nothing the agent can apply itself (policy removed, or no supported
    /// setting): refresh the configuration from the platform.
    RefreshConfig,
}

/// Parsed and validated `configure` command.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ConfigurePlan {
    pub action: ConfigureAction,
    /// Supported settings with a valid value (last one wins per key).
    pub settings: Vec<(String, Value)>,
    /// Supported settings with an invalid value (`"key: reason"`).
    pub invalid: Vec<String>,
    /// Policy entries the agent cannot apply (setting keys or rule names).
    pub unsupported: Vec<String>,
}

impl ConfigurePlan {
    /// Parse the command payload. `Err` for an unknown action.
    pub fn from_payload(payload: &Value) -> Result<Self, String> {
        let action = match payload.get("action").and_then(Value::as_str) {
            None | Some("enforce") => ConfigureAction::Enforce,
            Some("audit") => ConfigureAction::Audit,
            Some("remove") => ConfigureAction::Remove,
            Some(other) => return Err(format!("unsupported action '{other}'")),
        };
        let mut plan = Self {
            action,
            settings: Vec::new(),
            invalid: Vec::new(),
            unsupported: Vec::new(),
        };

        let policy = payload.get("policy").filter(|p| !p.is_null());
        match policy.and_then(|p| p.get("settings")) {
            None | Some(Value::Null) => {}
            Some(Value::Object(settings)) => {
                for (key, value) in settings {
                    plan.add_setting(key, value);
                }
            }
            Some(_) => plan
                .invalid
                .push("settings: expected an object".to_string()),
        }
        match policy.and_then(|p| p.get("rules")) {
            None | Some(Value::Null) => {}
            Some(Value::Array(rules)) => {
                for (index, rule) in rules.iter().enumerate() {
                    plan.add_rule(index, rule);
                }
            }
            Some(_) => plan.invalid.push("rules: expected an array".to_string()),
        }
        Ok(plan)
    }

    /// Group-policy style rule `{ key, value, enabled }` maps to a setting;
    /// any other rule (MDM software rule) cannot be enforced by the agent.
    fn add_rule(&mut self, index: usize, rule: &Value) {
        if let Some(key) = rule.get("key").and_then(Value::as_str) {
            if rule.get("enabled").and_then(Value::as_bool) != Some(false) {
                self.add_setting(key, rule.get("value").unwrap_or(&Value::Null));
            }
            return;
        }
        let label = ["name", "id"]
            .iter()
            .find_map(|k| rule.get(*k).and_then(Value::as_str))
            .map(|name| format!("rule '{name}'"))
            .unwrap_or_else(|| format!("rule #{}", index + 1));
        self.unsupported.push(label);
    }

    fn add_setting(&mut self, key: &str, value: &Value) {
        if !CONFIGURABLE_KEYS.contains(&key) {
            self.unsupported.push(key.to_string());
            return;
        }
        match validate_setting(key, value) {
            Ok(()) => {
                self.settings.retain(|(k, _)| k != key);
                self.settings.push((key.to_string(), value.clone()));
            }
            Err(reason) => self.invalid.push(format!("{key}: {reason}")),
        }
    }

    /// What to do with this command.
    pub fn decision(&self) -> ConfigureDecision {
        match self.action {
            ConfigureAction::Remove => ConfigureDecision::RefreshConfig,
            _ if self.settings.is_empty() => ConfigureDecision::RefreshConfig,
            ConfigureAction::Audit => ConfigureDecision::Audit,
            ConfigureAction::Enforce => ConfigureDecision::Apply,
        }
    }

    /// Keys of the supported settings.
    fn setting_keys(&self) -> Vec<String> {
        self.settings.iter().map(|(k, _)| k.clone()).collect()
    }
}

/// Check that a supported setting carries a value the agent can apply.
fn validate_setting(key: &str, value: &Value) -> Result<(), String> {
    use agent_sync::config_keys as keys;
    fn typed<T: serde::de::DeserializeOwned>(value: &Value) -> Result<(), String> {
        serde_json::from_value::<T>(value.clone())
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    match key {
        keys::HEARTBEAT_INTERVAL_SECS | keys::CHECK_INTERVAL_SECS => match value.as_u64() {
            Some(secs) if secs > 0 => Ok(()),
            _ => Err("expected a positive integer (seconds)".to_string()),
        },
        keys::LOG_LEVEL => match value.as_str() {
            Some("trace" | "debug" | "info" | "warn" | "error") => Ok(()),
            _ => Err("expected trace, debug, info, warn or error".to_string()),
        },
        keys::ACTIVE_FRAMEWORKS => typed::<Vec<String>>(value),
        keys::ENABLE_NETWORK_MONITORING => typed::<bool>(value),
        keys::FIM_CONFIG => typed::<agent_fim::FimConfig>(value),
        keys::USB_POLICY => typed::<agent_common::types::UsbPolicy>(value),
        keys::SIEM_CONFIG => typed::<agent_siem::SiemConfig>(value),
        keys::THREAT_INTEL => typed::<agent_network::ThreatIntelligence>(value),
        _ => Err("not configurable".to_string()),
    }
}

/// Result reported to the platform (command `output`, JSON).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub(crate) struct ConfigureReport {
    #[serde(rename = "commandType")]
    pub command_type: &'static str,
    pub action: ConfigureAction,
    /// Settings stored and applied (enforce) or compared (audit).
    pub applied: Vec<String>,
    /// Audit only: settings whose stored value differs from the policy.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub drift: Vec<String>,
    /// Settings kept at a local override.
    #[serde(rename = "localOverrides", skip_serializing_if = "Vec::is_empty")]
    pub local_overrides: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub unsupported: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub invalid: Vec<String>,
    /// Whether the configuration was refreshed from the platform.
    #[serde(rename = "configRefreshed")]
    pub config_refreshed: bool,
    /// `compliant`, `non_compliant` or `partial`; absent when nothing was
    /// evaluated (policy removed or empty).
    #[serde(rename = "complianceStatus", skip_serializing_if = "Option::is_none")]
    pub compliance_status: Option<&'static str>,
    pub violations: Vec<String>,
    pub message: String,
}

impl ConfigureReport {
    /// Build the report of an executed plan.
    pub fn new(
        plan: &ConfigurePlan,
        decision: ConfigureDecision,
        drift: Vec<String>,
        local_overrides: Vec<String>,
    ) -> Self {
        let mut violations: Vec<String> = Vec::new();
        violations.extend(
            drift
                .iter()
                .map(|k| format!("{k}: differs from the policy")),
        );
        violations.extend(
            local_overrides
                .iter()
                .map(|k| format!("{k}: local override kept")),
        );
        violations.extend(
            plan.unsupported
                .iter()
                .map(|k| format!("{k}: not supported by the agent")),
        );
        violations.extend(plan.invalid.iter().map(|e| format!("invalid value: {e}")));

        let applied = match decision {
            ConfigureDecision::RefreshConfig => Vec::new(),
            _ => plan.setting_keys(),
        };
        let compliance_status = if plan.action == ConfigureAction::Remove {
            None
        } else if !drift.is_empty() {
            Some("non_compliant")
        } else if !violations.is_empty() {
            Some("partial")
        } else if applied.is_empty() {
            None
        } else {
            Some("compliant")
        };

        let mut parts: Vec<String> = Vec::new();
        match decision {
            ConfigureDecision::Apply => parts.push(format!(
                "applied {} setting(s): {}",
                applied.len(),
                applied.join(", ")
            )),
            ConfigureDecision::Audit => parts.push(format!(
                "audited {} setting(s), {} differ(s)",
                applied.len(),
                drift.len()
            )),
            ConfigureDecision::RefreshConfig if plan.action == ConfigureAction::Remove => {
                parts.push("policy removed: configuration refreshed from the platform".to_string())
            }
            ConfigureDecision::RefreshConfig => parts.push(
                "no setting applicable by the agent: configuration refreshed from the platform"
                    .to_string(),
            ),
        }
        if !local_overrides.is_empty() {
            parts.push(format!(
                "local override kept for {}",
                local_overrides.join(", ")
            ));
        }
        if !plan.unsupported.is_empty() {
            parts.push(format!(
                "not supported by the agent: {}",
                plan.unsupported.join(", ")
            ));
        }
        if !plan.invalid.is_empty() {
            parts.push(format!("invalid: {}", plan.invalid.join("; ")));
        }

        Self {
            command_type: "configure",
            action: plan.action,
            applied,
            drift,
            local_overrides,
            unsupported: plan.unsupported.clone(),
            invalid: plan.invalid.clone(),
            config_refreshed: decision == ConfigureDecision::RefreshConfig,
            compliance_status,
            violations,
            message: parts.join("; "),
        }
    }

    /// Serialize to the JSON string carried in the command `output` field.
    pub fn to_output(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| {
            format!(
                "{{\"commandType\":\"configure\",\"message\":{}}}",
                Value::String(self.message.clone())
            )
        })
    }
}

/// Settings whose stored value (JSON text, as kept by the config store)
/// differs from the policy value.
fn config_drift(settings: &[(String, Value)], stored: &HashMap<String, String>) -> Vec<String> {
    settings
        .iter()
        .filter(|(key, wanted)| {
            stored
                .get(key)
                .and_then(|text| serde_json::from_str::<Value>(text).ok())
                .as_ref()
                != Some(wanted)
        })
        .map(|(key, _)| key.clone())
        .collect()
}

impl AgentRuntime {
    /// Execute a parsed `configure` command.
    pub(crate) async fn execute_configure(
        &self,
        plan: &ConfigurePlan,
    ) -> Result<ConfigureReport, String> {
        let decision = plan.decision();
        match decision {
            ConfigureDecision::RefreshConfig => {
                self.refresh_config()
                    .await
                    .map_err(|e| format!("configuration refresh failed: {e}"))?;
                Ok(ConfigureReport::new(plan, decision, Vec::new(), Vec::new()))
            }
            ConfigureDecision::Apply => {
                let guard = self.config_sync.read().await;
                let config_sync = guard
                    .as_ref()
                    .ok_or("config sync service not initialized (agent not enrolled)")?;
                let local_overrides = config_sync
                    .store_remote_values(&plan.settings)
                    .await
                    .map_err(|e| format!("failed to store the policy settings: {e}"))?;
                self.apply_stored_config(config_sync).await;
                info!(
                    "Configure command applied: {:?}",
                    plan.settings.iter().map(|(k, _)| k).collect::<Vec<_>>()
                );
                Ok(ConfigureReport::new(
                    plan,
                    decision,
                    Vec::new(),
                    local_overrides,
                ))
            }
            ConfigureDecision::Audit => {
                let guard = self.config_sync.read().await;
                let config_sync = guard
                    .as_ref()
                    .ok_or("config sync service not initialized (agent not enrolled)")?;
                let stored = config_sync
                    .get_all_config()
                    .await
                    .map_err(|e| format!("failed to read the configuration: {e}"))?;
                let drift = config_drift(&plan.settings, &stored);
                Ok(ConfigureReport::new(plan, decision, drift, Vec::new()))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn supported_settings_are_applied_others_reported() {
        let plan = ConfigurePlan::from_payload(&json!({
            "policyId": "p1",
            "action": "enforce",
            "policy": {
                "settings": {
                    "heartbeat_interval_secs": 120,
                    "log_level": "debug",
                    "enable_network_monitoring": false,
                    "enabled_checks": ["all"],
                    "check_interval_secs": "soon"
                },
                "rules": null
            }
        }))
        .unwrap();
        assert_eq!(plan.action, ConfigureAction::Enforce);
        let mut keys = plan.setting_keys();
        keys.sort();
        assert_eq!(
            keys,
            vec![
                "enable_network_monitoring",
                "heartbeat_interval_secs",
                "log_level"
            ]
        );
        assert_eq!(plan.unsupported, vec!["enabled_checks"]);
        assert_eq!(plan.invalid.len(), 1);
        assert!(plan.invalid[0].starts_with("check_interval_secs:"));
        assert_eq!(plan.decision(), ConfigureDecision::Apply);

        let report = ConfigureReport::new(&plan, plan.decision(), Vec::new(), Vec::new());
        assert_eq!(report.compliance_status, Some("partial"));
        assert_eq!(report.violations.len(), 2);
        let output: Value = serde_json::from_str(&report.to_output()).unwrap();
        assert_eq!(output["commandType"], "configure");
        assert_eq!(output["complianceStatus"], "partial");
        assert_eq!(output["configRefreshed"], false);
        assert!(output.get("policyId").is_none());
    }

    #[test]
    fn group_policy_rules_map_to_settings_and_mdm_rules_are_unsupported() {
        let plan = ConfigurePlan::from_payload(&json!({
            "policy": {
                "settings": null,
                "rules": [
                    {"key": "check_interval_secs", "value": 900, "enabled": true},
                    {"key": "log_level", "value": "warn", "enabled": false},
                    {"id": "r2", "name": "Block torrent clients",
                     "condition": {"field": "software.name", "operator": "contains", "value": "torrent"},
                     "action": {"type": "deny"}},
                    {"condition": {}}
                ]
            }
        }))
        .unwrap();
        assert_eq!(plan.action, ConfigureAction::Enforce);
        assert_eq!(
            plan.settings,
            vec![("check_interval_secs".to_string(), json!(900))]
        );
        assert_eq!(
            plan.unsupported,
            vec!["rule 'Block torrent clients'", "rule #4"]
        );
        assert_eq!(plan.decision(), ConfigureDecision::Apply);
    }

    #[test]
    fn nothing_applicable_or_removal_refreshes_the_config() {
        let only_software_rules = ConfigurePlan::from_payload(&json!({
            "policyId": "p",
            "policy": {"settings": null, "rules": [{"name": "Require antivirus"}]},
            "action": "enforce"
        }))
        .unwrap();
        assert_eq!(
            only_software_rules.decision(),
            ConfigureDecision::RefreshConfig
        );
        let report = ConfigureReport::new(
            &only_software_rules,
            ConfigureDecision::RefreshConfig,
            Vec::new(),
            Vec::new(),
        );
        assert!(report.config_refreshed);
        assert!(report.applied.is_empty());
        assert_eq!(report.compliance_status, Some("partial"));

        let null_policy =
            ConfigurePlan::from_payload(&json!({"policyId": "p", "policy": null})).unwrap();
        assert_eq!(null_policy.decision(), ConfigureDecision::RefreshConfig);
        let report =
            ConfigureReport::new(&null_policy, null_policy.decision(), Vec::new(), Vec::new());
        assert_eq!(report.compliance_status, None);

        let removal = ConfigurePlan::from_payload(&json!({
            "action": "remove",
            "policy": {"settings": {"log_level": "debug"}}
        }))
        .unwrap();
        assert_eq!(removal.decision(), ConfigureDecision::RefreshConfig);
        let report = ConfigureReport::new(&removal, removal.decision(), Vec::new(), Vec::new());
        assert_eq!(report.compliance_status, None);
        assert!(report.message.contains("policy removed"));
    }

    #[test]
    fn audit_compares_without_applying() {
        let plan = ConfigurePlan::from_payload(&json!({
            "action": "audit",
            "policy": {"settings": {"heartbeat_interval_secs": 300, "log_level": "info"}}
        }))
        .unwrap();
        assert_eq!(plan.decision(), ConfigureDecision::Audit);

        let stored: HashMap<String, String> = [
            ("heartbeat_interval_secs".to_string(), "60".to_string()),
            ("log_level".to_string(), "\"info\"".to_string()),
        ]
        .into_iter()
        .collect();
        let drift = config_drift(&plan.settings, &stored);
        assert_eq!(drift, vec!["heartbeat_interval_secs"]);
        let report = ConfigureReport::new(&plan, plan.decision(), drift, Vec::new());
        assert_eq!(report.compliance_status, Some("non_compliant"));

        let in_line: HashMap<String, String> = [
            ("heartbeat_interval_secs".to_string(), "300".to_string()),
            ("log_level".to_string(), "\"info\"".to_string()),
        ]
        .into_iter()
        .collect();
        let drift = config_drift(&plan.settings, &in_line);
        let report = ConfigureReport::new(&plan, plan.decision(), drift, Vec::new());
        assert_eq!(report.compliance_status, Some("compliant"));
    }

    #[test]
    fn unknown_action_is_rejected() {
        assert!(ConfigurePlan::from_payload(&json!({"action": "wipe"})).is_err());
    }

    #[test]
    fn complex_settings_are_type_checked() {
        let plan = ConfigurePlan::from_payload(&json!({
            "policy": {"settings": {
                "usb_policy": {"block_mass_storage": false, "allowlist": [[1, 2]]},
                "active_frameworks": "ISO27001",
                "fim_config": 42
            }}
        }))
        .unwrap();
        assert_eq!(plan.setting_keys(), vec!["usb_policy"]);
        let mut invalid = plan.invalid.clone();
        invalid.sort();
        assert!(invalid[0].starts_with("active_frameworks:"));
        assert!(invalid[1].starts_with("fim_config:"));
    }
}
