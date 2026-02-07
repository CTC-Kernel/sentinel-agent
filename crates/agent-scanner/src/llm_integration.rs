//! LLM integration for intelligent scan result analysis.

#[cfg(feature = "llm")]
use {
    agent_llm::{LLMManager, AnalysisContext, AnalysisResult, ScanResult, RemediationRequest, SecurityIssue},
    anyhow::Result,
    std::sync::Arc,
    tracing::{debug, info, warn},
};

use crate::check::CheckOutput;
use agent_common::types::{CheckResult, CheckStatus};
use serde_json::Value;

/// LLM integration service for the scanner.
#[cfg(feature = "llm")]
pub struct LLMIntegration {
    llm_manager: Arc<LLMManager>,
    enabled: bool,
}

#[cfg(feature = "llm")]
impl LLMIntegration {
    /// Create new LLM integration service.
    pub async fn new(llm_manager: Arc<LLMManager>) -> Result<Self> {
        let is_ready = llm_manager.is_ready().await;
        
        if !is_ready {
            warn!("LLM manager not ready - LLM features will be disabled");
        }

        Ok(Self {
            llm_manager,
            enabled: is_ready,
        })
    }

    /// Check if LLM integration is enabled.
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Analyze scan results using LLM.
    pub async fn analyze_results(&self, 
        check_results: &[CheckResult], 
        system_info: &str,
        compliance_framework: &str,
        asset_type: &str
    ) -> Result<Option<AnalysisResult>> {
        if !self.enabled {
            debug!("LLM integration disabled - skipping analysis");
            return Ok(None);
        }

        info!("Analyzing {} scan results with LLM", check_results.len());

        // Convert check results to scan results format
        let scan_results: Vec<ScanResult> = check_results.iter()
            .map(|cr| self.convert_check_result(cr))
            .collect();

        // Create analysis context
        let context = AnalysisContext {
            system_info: system_info.to_string(),
            scan_results,
            compliance_framework: compliance_framework.to_string(),
            asset_type: asset_type.to_string(),
            timestamp: chrono::Utc::now(),
            metadata: std::collections::HashMap::new(),
        };

        // Perform analysis
        let analysis = self.llm_manager.analyzer().analyze(context).await?;
        
        info!("LLM analysis completed - risk level: {:?}", 
              analysis.risk_assessment.risk_level);

        Ok(Some(analysis))
    }

    /// Generate remediation plan for failed checks.
    pub async fn generate_remediation_plan(&self, 
        failed_checks: &[CheckResult],
        system_info: &str,
        compliance_framework: &str
    ) -> Result<Option<agent_llm::RemediationPlan>> {
        if !self.enabled {
            debug!("LLM integration disabled - skipping remediation");
            return Ok(None);
        }

        info!("Generating remediation plan for {} failed checks", failed_checks.len());

        // Convert failed checks to security issues
        let issues: Vec<SecurityIssue> = failed_checks.iter()
            .filter(|cr| cr.status == CheckStatus::Failed)
            .map(|cr| self.convert_to_security_issue(cr))
            .collect();

        if issues.is_empty() {
            debug!("No failed checks - no remediation needed");
            return Ok(None);
        }

        // Create remediation request
        let request = RemediationRequest {
            request_id: uuid::Uuid::new_v4().to_string(),
            issues,
            system_context: agent_llm::SystemContext {
                platform: std::env::consts::OS.to_string(),
                os: system_info.to_string(),
                environment: "Production".to_string(),
                compliance_framework: compliance_framework.to_string(),
                critical_systems: vec![],
            },
            compliance_requirements: vec![compliance_framework.to_string()],
            urgency_level: "Medium".to_string(),
        };

        // Generate remediation plan
        let plan = self.llm_manager.remediation().generate_remediation_plan(request).await?;
        
        info!("Generated remediation plan with {} actions", plan.actions.len());
        Ok(Some(plan))
    }

    /// Classify security events from scan results.
    pub async fn classify_security_events(&self, 
        check_results: &[CheckResult]
    ) -> Result<Vec<agent_llm::SecurityClassification>> {
        if !self.enabled {
            debug!("LLM integration disabled - skipping classification");
            return Ok(vec![]);
        }

        info!("Classifying security events from {} results", check_results.len());

        let mut classifications = Vec::new();

        for result in check_results {
            // Only classify failed or high-severity checks
            if result.status == CheckStatus::Failed || 
               result.severity.to_lowercase().contains("high") ||
               result.severity.to_lowercase().contains("critical") {
                
                let event = agent_llm::SecurityEvent {
                    id: result.id.clone(),
                    event_type: "Compliance Failure".to_string(),
                    description: result.message.clone(),
                    system_info: "System scan".to_string(),
                    historical_context: "Compliance monitoring".to_string(),
                    timestamp: chrono::Utc::now(),
                    source: "Sentinel Agent".to_string(),
                    severity: result.severity.clone(),
                    raw_data: result.raw_data.clone(),
                };

                if let Ok(classification) = self.llm_manager.classifier().classify_event(&event).await {
                    classifications.push(classification);
                }
            }
        }

        info!("Classified {} security events", classifications.len());
        Ok(classifications)
    }

    /// Convert CheckResult to ScanResult for LLM analysis.
    fn convert_check_result(&self, check_result: &CheckResult) -> ScanResult {
        ScanResult {
            check_id: check_result.id.clone(),
            check_name: check_result.name.clone(),
            category: check_result.category.clone(),
            severity: check_result.severity.clone(),
            passed: check_result.status == CheckStatus::Passed,
            message: check_result.message.clone(),
            raw_data: check_result.raw_data.clone(),
        }
    }

    /// Convert CheckResult to SecurityIssue for remediation.
    fn convert_to_security_issue(&self, check_result: &CheckResult) -> SecurityIssue {
        SecurityIssue {
            id: check_result.id.clone(),
            title: format!("{}: {}", check_result.name, check_result.message),
            description: check_result.message.clone(),
            severity: check_result.severity.clone(),
            category: check_result.category.clone(),
            affected_systems: vec!["Target System".to_string()],
            compliance_impact: format!("Non-compliance with {}", check_result.category),
            discovered_at: chrono::Utc::now(),
        }
    }
}

/// No-op implementation when LLM feature is disabled.
#[cfg(not(feature = "llm"))]
pub struct LLMIntegration;

#[cfg(not(feature = "llm"))]
impl LLMIntegration {
    pub async fn new() -> Result<Self> {
        Ok(Self)
    }

    pub fn is_enabled(&self) -> bool {
        false
    }

    pub async fn analyze_results(&self, 
        _check_results: &[CheckResult], 
        _system_info: &str,
        _compliance_framework: &str,
        _asset_type: &str
    ) -> Result<Option<()>> {
        Ok(None)
    }

    pub async fn generate_remediation_plan(&self, 
        _failed_checks: &[CheckResult],
        _system_info: &str,
        _compliance_framework: &str
    ) -> Result<Option<()>> {
        Ok(None)
    }

    pub async fn classify_security_events(&self, 
        _check_results: &[CheckResult]
    ) -> Result<Vec<()>> {
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
    #[cfg(feature = "llm")]
    pub async fn new(
        base_runner: crate::runner::CheckRunner,
        llm_manager: Option<Arc<LLMManager>>,
    ) -> Result<Self> {
        let llm_integration = if let Some(manager) = llm_manager {
            LLMIntegration::new(manager).await?
        } else {
            LLMIntegration::new().await?
        };

        Ok(Self {
            base_runner,
            llm_integration,
        })
    }

    /// Create new intelligent check runner without LLM.
    #[cfg(not(feature = "llm"))]
    pub async fn new(base_runner: crate::runner::CheckRunner) -> Result<Self> {
        Ok(Self {
            base_runner,
            llm_integration: LLMIntegration::new().await?,
        })
    }

    /// Run checks with intelligent analysis.
    pub async fn run_with_analysis(&self, 
        system_info: &str,
        compliance_framework: &str,
        asset_type: &str
    ) -> Result<IntelligentScanResult> {
        info!("Starting intelligent scan with LLM analysis");

        // Run base checks
        let base_results = self.base_runner.run_all().await?;
        
        // Perform LLM analysis if enabled
        let analysis = if self.llm_integration.is_enabled() {
            self.llm_integration.analyze_results(
                &base_results.iter().map(|r| &r.result).collect::<Vec<_>>(),
                system_info,
                compliance_framework,
                asset_type,
            ).await?
        } else {
            None
        };

        // Generate remediation plan if enabled
        let remediation_plan = if self.llm_integration.is_enabled() {
            let failed_checks: Vec<_> = base_results.iter()
                .filter(|r| r.result.status == CheckStatus::Failed)
                .map(|r| &r.result)
                .collect();

            self.llm_integration.generate_remediation_plan(
                &failed_checks,
                system_info,
                compliance_framework,
            ).await?
        } else {
            None
        };

        // Classify security events if enabled
        let security_classifications = if self.llm_integration.is_enabled() {
            self.llm_integration.classify_security_events(
                &base_results.iter().map(|r| &r.result).collect::<Vec<_>>(),
            ).await?
        } else {
            vec![]
        };

        Ok(IntelligentScanResult {
            base_results,
            llm_analysis: analysis,
            remediation_plan,
            security_classifications,
            scan_metadata: ScanMetadata {
                timestamp: chrono::Utc::now(),
                llm_enabled: self.llm_integration.is_enabled(),
                total_checks: base_results.len(),
                failed_checks: base_results.iter().filter(|r| r.result.status == CheckStatus::Failed).count(),
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
    pub llm_analysis: Option<AnalysisResult>,
    pub remediation_plan: Option<agent_llm::RemediationPlan>,
    pub security_classifications: Vec<agent_llm::SecurityClassification>,
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
    fn test_llm_integration_creation() {
        // Test that LLMIntegration can be created
        // Actual testing would require mocking the LLM manager
    }

    #[test]
    fn test_intelligent_check_runner() {
        // Test that IntelligentCheckRunner can be created
        // Actual testing would require setting up the full dependency chain
    }
}
