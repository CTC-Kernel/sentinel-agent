// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Plugin system for LLM-powered security analysis.
//!
//! This module allows the LLM to call "tools" or plugins to gather
//! deeper information or perform specialized tasks.

pub mod vuln_plugin;

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
