// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

use super::AIPlugin;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::{json, Value};
use std::time::Duration;

/// Plugin for querying Open Source Vulnerabilities (OSV).
pub struct OsvPlugin;

#[async_trait]
impl AIPlugin for OsvPlugin {
    fn name(&self) -> &'static str {
        "osv_lookup"
    }

    fn description(&self) -> &'static str {
        "Queries the OSV.dev database for vulnerabilities affecting a specific package and version. \
         Input should be a JSON object with 'package', 'version', and 'ecosystem' (e.g., 'Debian', 'npm', 'crates.io', 'PyPI')."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "package": { "type": "string", "description": "The name of the package" },
                "version": { "type": "string", "description": "The version of the package" },
                "ecosystem": { "type": "string", "description": "The ecosystem (e.g. Debian, npm, PyPI)" }
            },
            "required": ["package", "version", "ecosystem"]
        })
    }

    async fn execute(&self, input: Value) -> Result<Value> {
        let package = input["package"].as_str().ok_or_else(|| anyhow!("Missing package"))?;
        let version = input["version"].as_str().ok_or_else(|| anyhow!("Missing version"))?;
        let ecosystem = input["ecosystem"].as_str().ok_or_else(|| anyhow!("Missing ecosystem"))?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()?;

        let query = json!({
            "version": version,
            "package": {
                "name": package,
                "ecosystem": ecosystem
            }
        });

        let response = client
            .post("https://api.osv.dev/v1/query")
            .json(&query)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("OSV API returned error: {}", response.status()));
        }

        let result: Value = response.json().await?;
        Ok(result)
    }
}
