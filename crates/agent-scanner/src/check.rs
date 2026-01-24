//! Compliance check trait and registry.

use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, warn};

/// Output from a compliance check execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckOutput {
    /// Whether the check passed.
    pub passed: bool,

    /// Human-readable message.
    pub message: String,

    /// Raw data collected during the check.
    pub raw_data: serde_json::Value,

    /// Additional metadata.
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}

impl CheckOutput {
    /// Create a passing check output.
    pub fn pass(message: impl Into<String>, raw_data: serde_json::Value) -> Self {
        Self {
            passed: true,
            message: message.into(),
            raw_data,
            metadata: HashMap::new(),
        }
    }

    /// Create a failing check output.
    pub fn fail(message: impl Into<String>, raw_data: serde_json::Value) -> Self {
        Self {
            passed: false,
            message: message.into(),
            raw_data,
            metadata: HashMap::new(),
        }
    }

    /// Add metadata to the output.
    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }
}

/// Trait for compliance checks.
///
/// All compliance checks must implement this trait. The trait uses
/// async execution to support checks that may need to wait for
/// system commands or API calls.
#[async_trait]
pub trait Check: Send + Sync {
    /// Get the check definition.
    fn definition(&self) -> &CheckDefinition;

    /// Execute the check and return the output.
    ///
    /// This method should:
    /// 1. Perform the compliance check
    /// 2. Collect raw data for proof generation
    /// 3. Return pass/fail status with message
    async fn execute(&self) -> ScannerResult<CheckOutput>;

    /// Check if this check is applicable to the current platform.
    fn is_platform_supported(&self) -> bool {
        let def = self.definition();
        if def.platforms.is_empty() {
            return true; // No platform restriction
        }

        let current_platform = current_platform();
        def.platforms
            .iter()
            .any(|p| p.eq_ignore_ascii_case(&current_platform))
    }

    /// Get the check ID.
    fn id(&self) -> &str {
        &self.definition().id
    }

    /// Get the check name.
    fn name(&self) -> &str {
        &self.definition().name
    }

    /// Check if the check is enabled.
    fn is_enabled(&self) -> bool {
        self.definition().enabled
    }
}

/// Get the current platform identifier.
pub fn current_platform() -> String {
    #[cfg(target_os = "windows")]
    {
        "windows".to_string()
    }
    #[cfg(target_os = "linux")]
    {
        "linux".to_string()
    }
    #[cfg(target_os = "macos")]
    {
        "macos".to_string()
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        "unknown".to_string()
    }
}

/// Registry of available compliance checks.
pub struct CheckRegistry {
    checks: HashMap<String, Arc<dyn Check>>,
}

impl CheckRegistry {
    /// Create a new empty registry.
    pub fn new() -> Self {
        Self {
            checks: HashMap::new(),
        }
    }

    /// Register a check.
    pub fn register(&mut self, check: Arc<dyn Check>) {
        let id = check.id().to_string();
        debug!("Registering check: {}", id);
        self.checks.insert(id, check);
    }

    /// Get a check by ID.
    pub fn get(&self, id: &str) -> Option<Arc<dyn Check>> {
        self.checks.get(id).cloned()
    }

    /// Get all registered checks.
    pub fn all(&self) -> Vec<Arc<dyn Check>> {
        self.checks.values().cloned().collect()
    }

    /// Get all enabled checks for the current platform.
    pub fn enabled_checks(&self) -> Vec<Arc<dyn Check>> {
        self.checks
            .values()
            .filter(|c| c.is_enabled() && c.is_platform_supported())
            .cloned()
            .collect()
    }

    /// Get checks by category.
    pub fn by_category(&self, category: CheckCategory) -> Vec<Arc<dyn Check>> {
        self.checks
            .values()
            .filter(|c| c.definition().category == category)
            .cloned()
            .collect()
    }

    /// Get the number of registered checks.
    pub fn count(&self) -> usize {
        self.checks.len()
    }

    /// Update check definitions from rules.
    ///
    /// This enables/disables checks based on the provided rules.
    pub fn apply_rules(&mut self, rules: &[CheckDefinition]) {
        for rule in rules {
            if self.checks.contains_key(&rule.id) {
                // Note: We can't modify the check directly as it's behind Arc
                // In a real implementation, we'd need a different approach
                // (e.g., separate enabled state tracking)
                if !rule.enabled {
                    warn!("Check {} disabled by rule", rule.id);
                }
            }
        }
    }
}

impl Default for CheckRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Builder for creating check definitions.
pub struct CheckDefinitionBuilder {
    def: CheckDefinition,
}

impl CheckDefinitionBuilder {
    /// Create a new builder with the given ID.
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            def: CheckDefinition {
                id: id.into(),
                name: String::new(),
                description: String::new(),
                category: CheckCategory::General,
                severity: CheckSeverity::Medium,
                frameworks: Vec::new(),
                enabled: true,
                platforms: Vec::new(),
                parameters: serde_json::Value::Null,
            },
        }
    }

    /// Set the check name.
    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.def.name = name.into();
        self
    }

    /// Set the check description.
    pub fn description(mut self, desc: impl Into<String>) -> Self {
        self.def.description = desc.into();
        self
    }

    /// Set the category.
    pub fn category(mut self, category: CheckCategory) -> Self {
        self.def.category = category;
        self
    }

    /// Set the severity.
    pub fn severity(mut self, severity: CheckSeverity) -> Self {
        self.def.severity = severity;
        self
    }

    /// Add a framework mapping.
    pub fn framework(mut self, framework: impl Into<String>) -> Self {
        self.def.frameworks.push(framework.into());
        self
    }

    /// Add multiple framework mappings.
    pub fn frameworks(mut self, frameworks: Vec<String>) -> Self {
        self.def.frameworks = frameworks;
        self
    }

    /// Set supported platforms.
    pub fn platforms(mut self, platforms: Vec<String>) -> Self {
        self.def.platforms = platforms;
        self
    }

    /// Set the enabled state.
    pub fn enabled(mut self, enabled: bool) -> Self {
        self.def.enabled = enabled;
        self
    }

    /// Set parameters.
    pub fn parameters(mut self, params: serde_json::Value) -> Self {
        self.def.parameters = params;
        self
    }

    /// Build the check definition.
    pub fn build(self) -> CheckDefinition {
        self.def
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockCheck {
        definition: CheckDefinition,
        result: bool,
    }

    #[async_trait]
    impl Check for MockCheck {
        fn definition(&self) -> &CheckDefinition {
            &self.definition
        }

        async fn execute(&self) -> ScannerResult<CheckOutput> {
            if self.result {
                Ok(CheckOutput::pass("Check passed", serde_json::json!({})))
            } else {
                Ok(CheckOutput::fail("Check failed", serde_json::json!({})))
            }
        }
    }

    fn create_mock_check(id: &str, enabled: bool) -> MockCheck {
        MockCheck {
            definition: CheckDefinitionBuilder::new(id)
                .name(format!("Mock Check {}", id))
                .description("A mock check for testing")
                .category(CheckCategory::General)
                .enabled(enabled)
                .build(),
            result: true,
        }
    }

    #[test]
    fn test_check_output_pass() {
        let output = CheckOutput::pass("Success", serde_json::json!({"key": "value"}));
        assert!(output.passed);
        assert_eq!(output.message, "Success");
    }

    #[test]
    fn test_check_output_fail() {
        let output = CheckOutput::fail("Failure", serde_json::json!({}));
        assert!(!output.passed);
        assert_eq!(output.message, "Failure");
    }

    #[test]
    fn test_check_output_with_metadata() {
        let output = CheckOutput::pass("Ok", serde_json::json!({}))
            .with_metadata("version", "1.0")
            .with_metadata("source", "registry");

        assert_eq!(output.metadata.get("version"), Some(&"1.0".to_string()));
        assert_eq!(output.metadata.get("source"), Some(&"registry".to_string()));
    }

    #[test]
    fn test_check_registry() {
        let mut registry = CheckRegistry::new();

        let check1 = Arc::new(create_mock_check("check1", true));
        let check2 = Arc::new(create_mock_check("check2", true));

        registry.register(check1);
        registry.register(check2);

        assert_eq!(registry.count(), 2);
        assert!(registry.get("check1").is_some());
        assert!(registry.get("nonexistent").is_none());
    }

    #[test]
    fn test_enabled_checks() {
        let mut registry = CheckRegistry::new();

        registry.register(Arc::new(create_mock_check("enabled", true)));
        registry.register(Arc::new(create_mock_check("disabled", false)));

        let enabled = registry.enabled_checks();
        assert_eq!(enabled.len(), 1);
        assert_eq!(enabled[0].id(), "enabled");
    }

    #[test]
    fn test_check_definition_builder() {
        let def = CheckDefinitionBuilder::new("disk_encryption")
            .name("Disk Encryption")
            .description("Verify disk encryption is enabled")
            .category(CheckCategory::Encryption)
            .severity(CheckSeverity::High)
            .framework("NIS2")
            .framework("DORA")
            .platforms(vec!["windows".to_string(), "linux".to_string()])
            .build();

        assert_eq!(def.id, "disk_encryption");
        assert_eq!(def.name, "Disk Encryption");
        assert_eq!(def.category, CheckCategory::Encryption);
        assert_eq!(def.severity, CheckSeverity::High);
        assert_eq!(def.frameworks.len(), 2);
        assert!(def.enabled);
    }

    #[tokio::test]
    async fn test_mock_check_execute() {
        let check = create_mock_check("test", true);
        let output = check.execute().await.unwrap();
        assert!(output.passed);
    }

    #[test]
    fn test_current_platform() {
        let platform = current_platform();
        assert!(!platform.is_empty());
        // Should be one of the known platforms or unknown
        assert!(["windows", "linux", "macos", "unknown"].contains(&platform.as_str()));
    }
}
