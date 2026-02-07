//! LLM integration for intelligent scan result analysis.
//!
//! This module provides a no-op LLM integration stub. When the `llm` feature
//! is implemented and enabled, it will provide actual LLM-based analysis.
//! Currently gated behind the `llm_simple` feature for forward-compatibility.

use agent_common::types::{CheckResult, CheckStatus};
use anyhow::Result;
use serde_json::Value;
use tracing::{debug, info};

/// LLM integration service for the scanner (stub implementation).
pub struct LLMIntegration {
    enabled: bool,
}

impl LLMIntegration {
    pub async fn new() -> Result<Self> {
        Ok(Self { enabled: false })
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub async fn analyze_results(
        &self,
        _check_results: &[&CheckResult],
        _system_info: &str,
        _compliance_framework: &str,
        _asset_type: &str,
    ) -> Result<Option<Value>> {
        if !self.enabled {
            debug!("LLM integration disabled - skipping analysis");
        }
        Ok(None)
    }

    pub async fn generate_remediation_plan(
        &self,
        _failed_checks: &[&CheckResult],
        _system_info: &str,
        _compliance_framework: &str,
    ) -> Result<Option<Value>> {
        if !self.enabled {
            debug!("LLM integration disabled - skipping remediation");
        }
        Ok(None)
    }

    pub async fn classify_security_events(
        &self,
        _check_results: &[&CheckResult],
    ) -> Result<Vec<Value>> {
        if !self.enabled {
            debug!("LLM integration disabled - skipping classification");
        }
        Ok(vec![])
    }
}

/// Enhanced check runner with LLM integration.
pub struct IntelligentCheckRunner {
    base_runner: crate::runner::CheckRunner,
    llm_integration: LLMIntegration,
}

impl IntelligentCheckRunner {
    /// Create new intelligent check runner.
    pub async fn new(base_runner: crate::runner::CheckRunner) -> Result<Self> {
        Ok(Self {
            base_runner,
            llm_integration: LLMIntegration::new().await?,
        })
    }

    /// Run checks with intelligent analysis.
    pub async fn run_with_analysis(
        &self,
        system_info: &str,
        compliance_framework: &str,
        asset_type: &str,
    ) -> Result<IntelligentScanResult> {
        info!("Starting intelligent scan with LLM analysis");

        // Run base checks
        let base_results = self.base_runner.run_all().await;

        // Perform LLM analysis if enabled
        let analysis = if self.llm_integration.is_enabled() {
            let refs: Vec<&CheckResult> = base_results.iter().map(|r| &r.result).collect();
            self.llm_integration
                .analyze_results(&refs, system_info, compliance_framework, asset_type)
                .await?
        } else {
            None
        };

        // Generate remediation plan if enabled
        let remediation_plan = if self.llm_integration.is_enabled() {
            let failed_refs: Vec<&CheckResult> = base_results
                .iter()
                .filter(|r| r.result.status == CheckStatus::Fail)
                .map(|r| &r.result)
                .collect();
            self.llm_integration
                .generate_remediation_plan(&failed_refs, system_info, compliance_framework)
                .await?
        } else {
            None
        };

        // Classify security events if enabled
        let security_classifications = if self.llm_integration.is_enabled() {
            let refs: Vec<&CheckResult> = base_results.iter().map(|r| &r.result).collect();
            self.llm_integration.classify_security_events(&refs).await?
        } else {
            vec![]
        };

        let total_checks = base_results.len();
        let failed_checks = base_results
            .iter()
            .filter(|r| r.result.status == CheckStatus::Fail)
            .count();

        Ok(IntelligentScanResult {
            base_results,
            llm_analysis: analysis,
            remediation_plan,
            security_classifications,
            scan_metadata: ScanMetadata {
                timestamp: chrono::Utc::now(),
                llm_enabled: self.llm_integration.is_enabled(),
                total_checks,
                failed_checks,
            },
        })
    }

    /// Get the base runner.
    pub fn base_runner(&self) -> &crate::runner::CheckRunner {
        &self.base_runner
    }

    /// Get LLM integration status.
    pub fn llm_enabled(&self) -> bool {
        self.llm_integration.is_enabled()
    }
}

/// Result of intelligent scan with LLM analysis.
#[derive(Debug)]
pub struct IntelligentScanResult {
    pub base_results: Vec<crate::runner::CheckExecutionResult>,
    pub llm_analysis: Option<Value>,
    pub remediation_plan: Option<Value>,
    pub security_classifications: Vec<Value>,
    pub scan_metadata: ScanMetadata,
}

/// Metadata about the intelligent scan.
#[derive(Debug, Clone)]
pub struct ScanMetadata {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub llm_enabled: bool,
    pub total_checks: usize,
    pub failed_checks: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_llm_integration_disabled() {
        // LLM integration is currently a stub — verify it reports disabled
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let integration = LLMIntegration::new().await.unwrap();
            assert!(!integration.is_enabled());
        });
    }
}
