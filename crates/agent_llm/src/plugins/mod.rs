// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Plugin system for LLM-powered security analysis.
//!
//! This module allows the LLM to call "tools" or plugins to gather
//! deeper information or perform specialized tasks.

pub mod mitre_plugin;
pub mod playbook_plugin;
pub mod sigma_plugin;
pub mod vuln_plugin;

pub use mitre_plugin::MitreAttackPlugin;
pub use playbook_plugin::RemediationPlaybookPlugin;
pub use sigma_plugin::SigmaRulePlugin;
pub use vuln_plugin::OsvPlugin;

use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

/// An AI plugin that provide "tools" to the LLM.
#[async_trait]
pub trait AIPlugin: Send + Sync {
    /// Unique name of the plugin.
    fn name(&self) -> &'static str;

    /// Description of what the plugin does and its input schema.
    fn description(&self) -> &'static str;

    /// Input schema (JSON) for the plugin.
    fn input_schema(&self) -> Value;

    /// Execute the plugin with provided input.
    async fn execute(&self, input: Value) -> Result<Value>;
}

/// Registry of available AI plugins.
pub struct PluginRegistry {
    plugins: HashMap<&'static str, Arc<dyn AIPlugin>>,
}

impl PluginRegistry {
    pub fn new() -> Self {
        Self {
            plugins: HashMap::new(),
        }
    }

    pub fn register(&mut self, plugin: Arc<dyn AIPlugin>) {
        self.plugins.insert(plugin.name(), plugin);
    }

    pub fn get(&self, name: &str) -> Option<&Arc<dyn AIPlugin>> {
        self.plugins.get(name)
    }

    pub fn list(&self) -> Vec<Arc<dyn AIPlugin>> {
        self.plugins.values().cloned().collect()
    }
}

impl Default for PluginRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn test_mitre_plugin_execution() {
        let plugin = MitreAttackPlugin;
        assert_eq!(plugin.name(), "mitre_attack_lookup");

        let res = plugin.execute(json!({ "query": "T1059" })).await.unwrap();
        assert_eq!(res["status"], "success");
        assert!(res["total_matched"].as_u64().unwrap() >= 1);
    }

    #[tokio::test]
    async fn test_sigma_plugin_execution() {
        let plugin = SigmaRulePlugin;
        assert_eq!(plugin.name(), "sigma_rule_matcher");

        let res = plugin
            .execute(json!({ "command_line": "powershell.exe -enc AAAA" }))
            .await
            .unwrap();
        assert_eq!(res["status"], "alert");
        assert_eq!(res["matched_rules_count"], 1);
    }

    #[tokio::test]
    async fn test_playbook_plugin_execution() {
        let plugin = RemediationPlaybookPlugin;
        assert_eq!(plugin.name(), "remediation_playbook_generator");

        let res = plugin
            .execute(json!({ "threat_type": "ransomware", "target": "FIN-SRV-01" }))
            .await
            .unwrap();
        assert_eq!(res["status"], "success");
        assert_eq!(res["playbook"]["risk_level"], "HIGH");
    }
}

