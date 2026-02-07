//! Compliance framework mappings.
//!
//! Maps agent checks to regulatory frameworks:
//! - NIS2 (Network and Information Security Directive)
//! - DORA (Digital Operational Resilience Act)
//! - NIST CSF (Cybersecurity Framework)
//! - CIS Controls v8
//! - PCI DSS v4.0
//! - ISO 27001:2022
//! - ANSSI Guide d'Hygiène Informatique

mod anssi;
mod cis_v8;
mod iso27001;
mod nist_csf;
mod pci_dss;

pub use anssi::AnssiMapping;
pub use cis_v8::CisV8Mapping;
pub use iso27001::Iso27001Mapping;
pub use nist_csf::NistCsfMapping;
pub use pci_dss::PciDssMapping;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A mapping between an agent check and a framework control.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlMapping {
    /// The framework identifier (e.g., "NIST_CSF", "CIS_V8").
    pub framework_id: String,
    /// The specific control ID within the framework.
    pub control_id: String,
    /// Human-readable control name.
    pub control_name: String,
    /// The control category/function.
    pub category: String,
    /// Description of the control.
    pub description: String,
    /// Weight for compliance scoring (0.0 - 1.0).
    pub weight: f32,
    /// Whether this control is considered critical.
    pub is_critical: bool,
}

/// Framework metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkInfo {
    /// Unique framework identifier.
    pub id: String,
    /// Full framework name.
    pub name: String,
    /// Framework version.
    pub version: String,
    /// Brief description.
    pub description: String,
    /// Applicable industries/regions.
    pub applicability: Vec<String>,
    /// URL for more information.
    pub reference_url: String,
}

/// Registry of all framework mappings.
#[derive(Debug, Default)]
pub struct FrameworkRegistry {
    /// Framework metadata by ID.
    frameworks: HashMap<String, FrameworkInfo>,
    /// Control mappings: check_id -> Vec<ControlMapping>.
    mappings: HashMap<String, Vec<ControlMapping>>,
}

impl FrameworkRegistry {
    /// Create a new registry with all built-in frameworks.
    pub fn new() -> Self {
        let mut registry = Self::default();
        registry.register_builtin_frameworks();
        registry
    }

    /// Register all built-in framework mappings.
    fn register_builtin_frameworks(&mut self) {
        // Register NIST CSF
        self.register_framework(NistCsfMapping::framework_info());
        for (check_id, mappings) in NistCsfMapping::mappings() {
            for mapping in mappings {
                self.add_mapping(&check_id, mapping);
            }
        }

        // Register CIS Controls v8
        self.register_framework(CisV8Mapping::framework_info());
        for (check_id, mappings) in CisV8Mapping::mappings() {
            for mapping in mappings {
                self.add_mapping(&check_id, mapping);
            }
        }

        // Register PCI DSS
        self.register_framework(PciDssMapping::framework_info());
        for (check_id, mappings) in PciDssMapping::mappings() {
            for mapping in mappings {
                self.add_mapping(&check_id, mapping);
            }
        }

        // Register ISO 27001
        self.register_framework(Iso27001Mapping::framework_info());
        for (check_id, mappings) in Iso27001Mapping::mappings() {
            for mapping in mappings {
                self.add_mapping(&check_id, mapping);
            }
        }

        // Register ANSSI Guide d'Hygiène Informatique
        self.register_framework(AnssiMapping::framework_info());
        for (check_id, mappings) in AnssiMapping::mappings() {
            for mapping in mappings {
                self.add_mapping(&check_id, mapping);
            }
        }
    }

    /// Register a new framework.
    pub fn register_framework(&mut self, info: FrameworkInfo) {
        self.frameworks.insert(info.id.clone(), info);
    }

    /// Add a control mapping for a check.
    pub fn add_mapping(&mut self, check_id: &str, mapping: ControlMapping) {
        self.mappings
            .entry(check_id.to_string())
            .or_default()
            .push(mapping);
    }

    /// Get all mappings for a specific check.
    pub fn get_mappings(&self, check_id: &str) -> Vec<&ControlMapping> {
        self.mappings
            .get(check_id)
            .map(|m| m.iter().collect())
            .unwrap_or_default()
    }

    /// Get mappings for a check filtered by framework.
    pub fn get_mappings_by_framework(
        &self,
        check_id: &str,
        framework_id: &str,
    ) -> Vec<&ControlMapping> {
        self.mappings
            .get(check_id)
            .map(|m| {
                m.iter()
                    .filter(|mapping| mapping.framework_id == framework_id)
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Get all checks mapped to a specific framework control.
    pub fn get_checks_for_control(&self, framework_id: &str, control_id: &str) -> Vec<String> {
        self.mappings
            .iter()
            .filter_map(|(check_id, mappings)| {
                if mappings
                    .iter()
                    .any(|m| m.framework_id == framework_id && m.control_id == control_id)
                {
                    Some(check_id.clone())
                } else {
                    None
                }
            })
            .collect()
    }

    /// Get framework info by ID.
    pub fn get_framework(&self, framework_id: &str) -> Option<&FrameworkInfo> {
        self.frameworks.get(framework_id)
    }

    /// Get all registered frameworks.
    pub fn frameworks(&self) -> Vec<&FrameworkInfo> {
        self.frameworks.values().collect()
    }

    /// Calculate compliance score for a framework based on check results.
    pub fn calculate_framework_score(
        &self,
        framework_id: &str,
        passed_checks: &[String],
        failed_checks: &[String],
    ) -> Option<FrameworkScore> {
        let framework = self.frameworks.get(framework_id)?;

        let mut total_weight = 0.0;
        let mut passed_weight = 0.0;
        let mut control_results: HashMap<String, ControlResult> = HashMap::new();

        // Process all checks that have mappings to this framework
        for (check_id, mappings) in &self.mappings {
            let framework_mappings: Vec<_> = mappings
                .iter()
                .filter(|m| m.framework_id == framework_id)
                .collect();

            if framework_mappings.is_empty() {
                continue;
            }

            let is_passed = passed_checks.contains(check_id);
            let is_failed = failed_checks.contains(check_id);

            for mapping in framework_mappings {
                total_weight += mapping.weight;

                if is_passed {
                    passed_weight += mapping.weight;
                }

                control_results
                    .entry(mapping.control_id.clone())
                    .or_insert_with(|| ControlResult {
                        control_id: mapping.control_id.clone(),
                        control_name: mapping.control_name.clone(),
                        category: mapping.category.clone(),
                        passed_checks: Vec::new(),
                        failed_checks: Vec::new(),
                        score: 0.0,
                    })
                    .add_check(check_id.clone(), is_passed, is_failed);
            }
        }

        // Calculate control-level scores
        for result in control_results.values_mut() {
            let total = result.passed_checks.len() + result.failed_checks.len();
            if total > 0 {
                result.score = result.passed_checks.len() as f32 / total as f32 * 100.0;
            }
        }

        let overall_score = if total_weight > 0.0 {
            (passed_weight / total_weight) * 100.0
        } else {
            0.0
        };

        let assessed_controls = control_results.len();
        let control_results_vec: Vec<ControlResult> = control_results.into_values().collect();

        Some(FrameworkScore {
            framework_id: framework_id.to_string(),
            framework_name: framework.name.clone(),
            overall_score,
            control_results: control_results_vec,
            total_controls: self.count_framework_controls(framework_id),
            assessed_controls,
        })
    }

    /// Count total unique controls for a framework.
    fn count_framework_controls(&self, framework_id: &str) -> usize {
        let mut controls: std::collections::HashSet<String> = std::collections::HashSet::new();

        for mappings in self.mappings.values() {
            for mapping in mappings {
                if mapping.framework_id == framework_id {
                    controls.insert(mapping.control_id.clone());
                }
            }
        }

        controls.len()
    }
}

/// Result of a single control assessment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlResult {
    /// Control ID.
    pub control_id: String,
    /// Control name.
    pub control_name: String,
    /// Control category.
    pub category: String,
    /// Checks that passed for this control.
    pub passed_checks: Vec<String>,
    /// Checks that failed for this control.
    pub failed_checks: Vec<String>,
    /// Score for this control (0-100).
    pub score: f32,
}

impl ControlResult {
    fn add_check(&mut self, check_id: String, is_passed: bool, is_failed: bool) {
        if is_passed {
            self.passed_checks.push(check_id);
        } else if is_failed {
            self.failed_checks.push(check_id);
        }
    }
}

/// Framework compliance score.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkScore {
    /// Framework ID.
    pub framework_id: String,
    /// Framework name.
    pub framework_name: String,
    /// Overall compliance score (0-100).
    pub overall_score: f32,
    /// Per-control results.
    pub control_results: Vec<ControlResult>,
    /// Total controls in framework.
    pub total_controls: usize,
    /// Controls that were assessed.
    pub assessed_controls: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_framework_registry_creation() {
        let registry = FrameworkRegistry::new();

        // Should have all built-in frameworks
        assert!(registry.get_framework("NIST_CSF").is_some());
        assert!(registry.get_framework("CIS_V8").is_some());
        assert!(registry.get_framework("PCI_DSS").is_some());
        assert!(registry.get_framework("ISO_27001").is_some());
        assert!(registry.get_framework("ANSSI_HYGIENE").is_some());
    }

    #[test]
    fn test_get_mappings() {
        let registry = FrameworkRegistry::new();

        // disk_encryption should have mappings
        let mappings = registry.get_mappings("disk_encryption");
        assert!(!mappings.is_empty());
    }

    #[test]
    fn test_framework_score_calculation() {
        let registry = FrameworkRegistry::new();

        let passed = vec!["disk_encryption".to_string(), "firewall".to_string()];
        let failed = vec!["antivirus".to_string()];

        let score = registry.calculate_framework_score("NIST_CSF", &passed, &failed);
        assert!(score.is_some());

        let score = score.unwrap();
        assert!(score.overall_score >= 0.0 && score.overall_score <= 100.0);
    }
}
