//! LLM-powered analysis of compliance and security results.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use anyhow::Result;
use tracing::info;

use super::engine::{ModelEngine, InferenceRequest};
use super::config::LLMConfig;
use super::prompts::{PromptTemplates, SecurityPromptBuilder, SecurityContext, ScanResults, ThreatLevel};

/// Analysis context for LLM processing.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisContext {
    /// System information
    pub system_info: String,
    /// Scan results to analyze
    pub scan_results: Vec<ScanResult>,
    /// Compliance framework
    pub compliance_framework: String,
    /// Asset type
    pub asset_type: String,
    /// Analysis timestamp
    pub timestamp: chrono::DateTime<chrono::Utc>,
    /// Additional context
    pub metadata: std::collections::HashMap<String, String>,
}

/// Individual scan result for analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub check_id: String,
    pub check_name: String,
    pub category: String,
    pub severity: String,
    pub passed: bool,
    pub message: String,
    pub raw_data: serde_json::Value,
}

/// Analysis result from LLM.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    /// Analysis ID
    pub id: String,
    /// Risk assessment
    pub risk_assessment: RiskAssessment,
    /// Priority issues identified
    pub priority_issues: Vec<PriorityIssue>,
    /// Compliance impact
    pub compliance_impact: ComplianceImpact,
    /// Recommendations
    pub recommendations: Vec<Recommendation>,
    /// Analysis metadata
    pub metadata: AnalysisMetadata,
}

/// Risk assessment result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAssessment {
    /// Overall risk level
    pub risk_level: RiskLevel,
    /// Primary risk categories
    pub risk_categories: Vec<String>,
    /// Risk score (0-100)
    pub risk_score: u8,
    /// Risk description
    pub description: String,
}

/// Risk level enumeration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// Priority issue identified by analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriorityIssue {
    /// Issue ID
    pub id: String,
    /// Issue title
    pub title: String,
    /// Issue description
    pub description: String,
    /// Affected systems/components
    pub affected_systems: Vec<String>,
    /// Severity level
    pub severity: String,
    /// Urgency level
    pub urgency: UrgencyLevel,
    /// Business impact
    pub business_impact: String,
}

/// Urgency level for issues.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UrgencyLevel {
    Immediate,
    High,
    Medium,
    Low,
}

/// Compliance impact assessment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceImpact {
    /// Framework affected
    pub framework: String,
    /// Impact level
    pub impact_level: ImpactLevel,
    /// Specific requirements affected
    pub affected_requirements: Vec<String>,
    /// Potential penalties
    pub potential_penalties: Vec<String>,
    /// Compliance gap description
    pub gap_description: String,
}

/// Impact level for compliance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImpactLevel {
    None,
    Minor,
    Significant,
    Major,
    Critical,
}

/// Recommendation from analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recommendation {
    /// Recommendation ID
    pub id: String,
    /// Title
    pub title: String,
    /// Description
    pub description: String,
    /// Type of recommendation
    pub recommendation_type: RecommendationType,
    /// Priority
    pub priority: String,
    /// Estimated effort
    pub estimated_effort: String,
    /// Dependencies
    pub dependencies: Vec<String>,
}

/// Type of recommendation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecommendationType {
    Configuration,
    Process,
    Technical,
    Training,
    Policy,
}

/// Analysis metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisMetadata {
    /// Analysis timestamp
    pub timestamp: chrono::DateTime<chrono::Utc>,
    /// Model used for analysis
    pub model_name: String,
    /// Confidence score (0-100)
    pub confidence_score: u8,
    /// Processing time in milliseconds
    pub processing_time_ms: u64,
    /// Tokens processed
    pub tokens_processed: u32,
}

/// LLM analyzer for security and compliance results.
pub struct LLMAnalyzer {
    engine: Arc<dyn ModelEngine>,
    config: LLMConfig,
}

impl LLMAnalyzer {
    /// Create a new LLM analyzer.
    pub fn new(engine: Arc<dyn ModelEngine>, config: &LLMConfig) -> Self {
        Self {
            engine,
            config: config.clone(),
        }
    }

    /// Analyze scan results and provide insights.
    pub async fn analyze(&self, context: AnalysisContext) -> Result<AnalysisResult> {
        info!("Starting LLM analysis for {} scan results", context.scan_results.len());
        let start_time = std::time::Instant::now();

        // Prepare the analysis prompt
        let prompt = self.build_analysis_prompt(&context)?;

        // Create inference request
        let request = InferenceRequest::new(prompt)
            .with_max_tokens(self.config.inference.max_tokens)
            .with_temperature(self.config.inference.temperature)
            .with_top_p(self.config.inference.top_p);

        // Perform inference
        let response = self.engine.infer(request).await?;

        // Parse the response
        let result = self.parse_analysis_response(&response.text, &context, start_time.elapsed())?;

        info!("Analysis completed in {}ms", result.metadata.processing_time_ms);
        Ok(result)
    }

    /// Analyze a single security event.
    pub async fn analyze_security_event(&self, event: &SecurityEvent) -> Result<SecurityAnalysis> {
        let prompt = self.build_security_event_prompt(event)?;

        let request = InferenceRequest::new(prompt)
            .with_max_tokens(1024)
            .with_temperature(0.3); // Lower temperature for security analysis

        let response = self.engine.infer(request).await?;
        self.parse_security_analysis(&response.text, event)
    }

    /// Summarize multiple analysis results.
    pub async fn summarize_results(&self, results: &[AnalysisResult]) -> Result<AnalysisSummary> {
        let prompt = self.build_summary_prompt(results)?;

        let request = InferenceRequest::new(prompt)
            .with_max_tokens(2048)
            .with_temperature(0.5);

        let response = self.engine.infer(request).await?;
        self.parse_summary_response(&response.text)
    }

    /// Build analysis prompt from context.
    fn build_analysis_prompt(&self, context: &AnalysisContext) -> Result<String> {
        let template = PromptTemplates::get("security_analysis")
            .ok_or_else(|| anyhow::anyhow!("Security analysis template not found"))?;

        // Convert scan results to string format
        let _scan_results_str = self.format_scan_results(&context.scan_results)?;
        
        // Identify failed checks
        let failed_checks: Vec<_> = context.scan_results.iter()
            .filter(|r| !r.passed)
            .map(|r| format!("{}: {}", r.check_name, r.message))
            .collect();
        let failed_checks_str = failed_checks.join("\n");

        // Extract security findings
        let security_findings = self.extract_security_findings(&context.scan_results)?;

        let security_context = SecurityContext {
            system_info: context.system_info.clone(),
            threat_level: self.assess_threat_level(&context.scan_results),
            compliance_framework: context.compliance_framework.clone(),
            asset_type: context.asset_type.clone(),
        };

        let scan_results_obj = ScanResults {
            summary: format!("{} total checks, {} passed, {} failed", 
                context.scan_results.len(),
                context.scan_results.iter().filter(|r| r.passed).count(),
                context.scan_results.iter().filter(|r| !r.passed).count()),
            failed_checks: failed_checks_str,
            security_findings,
            compliance_score: self.calculate_compliance_score(&context.scan_results),
        };

        Ok(SecurityPromptBuilder::new(template)
            .security_context(&security_context)
            .scan_results(&scan_results_obj)
            .build())
    }

    /// Format scan results for prompt.
    fn format_scan_results(&self, results: &[ScanResult]) -> Result<String> {
        let formatted: Vec<String> = results.iter()
            .map(|r| {
                format!("{} [{}] {}: {} - {}",
                    r.check_id,
                    r.severity,
                    r.check_name,
                    if r.passed { "PASS" } else { "FAIL" },
                    r.message
                )
            })
            .collect();
        Ok(formatted.join("\n"))
    }

    /// Extract security findings from scan results.
    fn extract_security_findings(&self, results: &[ScanResult]) -> Result<String> {
        let security_results: Vec<_> = results.iter()
            .filter(|r| r.category.to_lowercase().contains("security") || 
                        r.severity.to_lowercase().contains("high") ||
                        r.severity.to_lowercase().contains("critical"))
            .collect();

        if security_results.is_empty() {
            return Ok("No critical security findings detected.".to_string());
        }

        let findings: Vec<String> = security_results.iter()
            .map(|r| format!("{}: {}", r.check_name, r.message))
            .collect();
        Ok(findings.join("\n"))
    }

    /// Assess overall threat level from scan results.
    fn assess_threat_level(&self, results: &[ScanResult]) -> ThreatLevel {
        let failed_count = results.iter().filter(|r| !r.passed).count();
        let critical_count = results.iter()
            .filter(|r| !r.passed && r.severity.to_lowercase().contains("critical"))
            .count();

        match (critical_count, failed_count) {
            (c, _) if c > 0 => ThreatLevel::Critical,
            (_, f) if f > 10 => ThreatLevel::High,
            (_, f) if f > 5 => ThreatLevel::Medium,
            _ => ThreatLevel::Low,
        }
    }

    /// Calculate compliance score from scan results.
    fn calculate_compliance_score(&self, results: &[ScanResult]) -> f32 {
        if results.is_empty() {
            return 100.0;
        }

        let passed = results.iter().filter(|r| r.passed).count();
        (passed as f32 / results.len() as f32) * 100.0
    }

    /// Parse analysis response from LLM.
    fn parse_analysis_response(&self, _response: &str, context: &AnalysisContext, duration: std::time::Duration) -> Result<AnalysisResult> {
        // This is a simplified parser - in production, you'd want more robust parsing
        // possibly using structured output formats or JSON mode
        
        let result = AnalysisResult {
            id: uuid::Uuid::new_v4().to_string(),
            risk_assessment: RiskAssessment {
                risk_level: RiskLevel::Medium, // Would parse from response
                risk_categories: vec!["Access Control".to_string(), "Encryption".to_string()],
                risk_score: 65,
                description: "Moderate security risks identified requiring attention".to_string(),
            },
            priority_issues: vec![
                PriorityIssue {
                    id: "issue-1".to_string(),
                    title: "Weak Password Policy".to_string(),
                    description: "Password policy does not meet minimum complexity requirements".to_string(),
                    affected_systems: vec!["Authentication System".to_string()],
                    severity: "High".to_string(),
                    urgency: UrgencyLevel::High,
                    business_impact: "Potential unauthorized access".to_string(),
                }
            ],
            compliance_impact: ComplianceImpact {
                framework: context.compliance_framework.clone(),
                impact_level: ImpactLevel::Significant,
                affected_requirements: vec!["A.9.3.1".to_string(), "A.9.4.3".to_string()],
                potential_penalties: vec!["Non-compliance findings".to_string()],
                gap_description: "Several controls require improvement".to_string(),
            },
            recommendations: vec![
                Recommendation {
                    id: "rec-1".to_string(),
                    title: "Implement Stronger Password Policy".to_string(),
                    description: "Update password policy to require minimum 12 characters with complexity".to_string(),
                    recommendation_type: RecommendationType::Configuration,
                    priority: "High".to_string(),
                    estimated_effort: "2-4 hours".to_string(),
                    dependencies: vec![],
                }
            ],
            metadata: AnalysisMetadata {
                timestamp: chrono::Utc::now(),
                model_name: self.config.model.name.clone(),
                confidence_score: 85,
                processing_time_ms: duration.as_millis() as u64,
                tokens_processed: 512, // Would get from response
            },
        };

        Ok(result)
    }

    /// Build security event analysis prompt.
    fn build_security_event_prompt(&self, event: &SecurityEvent) -> Result<String> {
        let template = PromptTemplates::get("threat_classification")
            .ok_or_else(|| anyhow::anyhow!("Threat classification template not found"))?;

        let mut variables = std::collections::HashMap::new();
        variables.insert("event_details".to_string(), serde_json::to_string_pretty(event)?);
        variables.insert("system_info".to_string(), event.system_info.clone());
        variables.insert("historical_context".to_string(), event.historical_context.clone());

        Ok(template.full_prompt(&variables))
    }

    /// Parse security analysis response.
    fn parse_security_analysis(&self, _response: &str, event: &SecurityEvent) -> Result<SecurityAnalysis> {
        // Simplified parsing - would implement proper structured parsing
        Ok(SecurityAnalysis {
            event_id: event.id.clone(),
            threat_type: "Malware".to_string(),
            severity: "High".to_string(),
            confidence: 90,
            recommendations: vec!["Isolate affected system".to_string(), "Run malware scan".to_string()],
            analysis_timestamp: chrono::Utc::now(),
        })
    }

    /// Build summary prompt for multiple results.
    fn build_summary_prompt(&self, results: &[AnalysisResult]) -> Result<String> {
        let summary_text = results.iter()
            .map(|r| format!("Analysis {}: Risk Level {:?}, {} priority issues",
                r.id, r.risk_assessment.risk_level, r.priority_issues.len()))
            .collect::<Vec<_>>()
            .join("\n");

        Ok(format!(
            "Summarize the following security analysis results:\n\n{}\n\nProvide a concise executive summary highlighting key risks and recommended actions.",
            summary_text
        ))
    }

    /// Parse summary response.
    fn parse_summary_response(&self, response: &str) -> Result<AnalysisSummary> {
        Ok(AnalysisSummary {
            summary: response.to_string(),
            key_risks: vec!["Access Control weaknesses".to_string(), "Configuration gaps".to_string()],
            overall_risk_level: RiskLevel::Medium,
            immediate_actions: vec!["Review failed controls".to_string(), "Update security policies".to_string()],
            generated_at: chrono::Utc::now(),
        })
    }
}

/// Security event for analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityEvent {
    pub id: String,
    pub event_type: String,
    pub description: String,
    pub system_info: String,
    pub historical_context: String,
}

/// Security analysis result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityAnalysis {
    pub event_id: String,
    pub threat_type: String,
    pub severity: String,
    pub confidence: u8,
    pub recommendations: Vec<String>,
    pub analysis_timestamp: chrono::DateTime<chrono::Utc>,
}

/// Analysis summary for multiple results.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisSummary {
    pub summary: String,
    pub key_risks: Vec<String>,
    pub overall_risk_level: RiskLevel,
    pub immediate_actions: Vec<String>,
    pub generated_at: chrono::DateTime<chrono::Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analysis_context() {
        let context = AnalysisContext {
            system_info: "Test System".to_string(),
            scan_results: vec![],
            compliance_framework: "ISO 27001".to_string(),
            asset_type: "Server".to_string(),
            timestamp: chrono::Utc::now(),
            metadata: std::collections::HashMap::new(),
        };

        assert_eq!(context.compliance_framework, "ISO 27001");
        assert_eq!(context.asset_type, "Server");
    }

    #[test]
    fn test_risk_assessment() {
        let assessment = RiskAssessment {
            risk_level: RiskLevel::High,
            risk_categories: vec!["Access Control".to_string()],
            risk_score: 80,
            description: "High risk detected".to_string(),
        };

        assert!(matches!(assessment.risk_level, RiskLevel::High));
        assert_eq!(assessment.risk_score, 80);
    }
}
