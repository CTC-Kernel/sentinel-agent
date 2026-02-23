//! LLM-powered analysis of compliance and security results.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use anyhow::Result;
use tracing::{info, warn};

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

// ---------------------------------------------------------------------------
// Raw deserialization structs for LLM JSON responses
// ---------------------------------------------------------------------------

/// Raw JSON structure expected from LLM for analysis responses.
#[derive(Debug, Clone, Deserialize)]
struct RawAnalysisResponse {
    risk_level: String,
    risk_score: u8,
    #[serde(default)]
    risk_categories: Vec<String>,
    #[serde(default)]
    risk_description: String,
    #[serde(default)]
    priority_issues: Vec<RawPriorityIssue>,
    #[serde(default)]
    compliance_impact: Option<RawComplianceImpact>,
    #[serde(default)]
    recommendations: Vec<RawRecommendation>,
}

#[derive(Debug, Clone, Deserialize)]
struct RawPriorityIssue {
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    severity: String,
    #[serde(default)]
    urgency: String,
    #[serde(default)]
    business_impact: String,
}

#[derive(Debug, Clone, Deserialize)]
struct RawComplianceImpact {
    #[serde(default)]
    impact_level: String,
    #[serde(default)]
    affected_requirements: Vec<String>,
    #[serde(default)]
    gap_description: String,
}

#[derive(Debug, Clone, Deserialize)]
struct RawRecommendation {
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default, rename = "type")]
    recommendation_type: String,
    #[serde(default)]
    priority: String,
    #[serde(default)]
    effort: String,
}

/// Raw JSON structure expected from LLM for security event analysis.
#[derive(Debug, Clone, Deserialize)]
struct RawSecurityAnalysis {
    #[serde(default)]
    threat_type: String,
    #[serde(default)]
    severity: String,
    #[serde(default)]
    confidence: Option<u8>,
    #[serde(default)]
    recommendations: Vec<String>,
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/// Parse a risk level string into the `RiskLevel` enum.
fn parse_risk_level(s: &str) -> RiskLevel {
    match s.to_lowercase().trim() {
        "low" => RiskLevel::Low,
        "medium" | "moderate" => RiskLevel::Medium,
        "high" => RiskLevel::High,
        "critical" | "severe" => RiskLevel::Critical,
        _ => RiskLevel::Medium,
    }
}

/// Parse an urgency string into the `UrgencyLevel` enum.
fn parse_urgency_level(s: &str) -> UrgencyLevel {
    match s.to_lowercase().trim() {
        "immediate" | "urgent" => UrgencyLevel::Immediate,
        "high" => UrgencyLevel::High,
        "medium" | "moderate" => UrgencyLevel::Medium,
        "low" => UrgencyLevel::Low,
        _ => UrgencyLevel::Medium,
    }
}

/// Parse an impact level string into the `ImpactLevel` enum.
fn parse_impact_level(s: &str) -> ImpactLevel {
    match s.to_lowercase().trim() {
        "none" => ImpactLevel::None,
        "minor" | "low" => ImpactLevel::Minor,
        "significant" | "moderate" | "medium" => ImpactLevel::Significant,
        "major" | "high" => ImpactLevel::Major,
        "critical" | "severe" => ImpactLevel::Critical,
        _ => ImpactLevel::Significant,
    }
}

/// Parse a recommendation type string into the `RecommendationType` enum.
fn parse_recommendation_type(s: &str) -> RecommendationType {
    match s.to_lowercase().trim() {
        "configuration" | "config" => RecommendationType::Configuration,
        "process" => RecommendationType::Process,
        "technical" => RecommendationType::Technical,
        "training" => RecommendationType::Training,
        "policy" => RecommendationType::Policy,
        _ => RecommendationType::Technical,
    }
}

/// Try to extract a JSON object from a string that may contain surrounding text.
/// Finds the first `{` and the last `}` and attempts to parse the substring.
fn extract_json_block(text: &str) -> Option<String> {
    let first_brace = text.find('{')?;
    let last_brace = text.rfind('}')?;
    if last_brace <= first_brace {
        return None;
    }
    Some(text[first_brace..=last_brace].to_string())
}

/// The JSON schema instruction appended to analysis prompts so the LLM
/// returns machine-parseable output.
const ANALYSIS_JSON_SCHEMA: &str = r#"

Respond ONLY with valid JSON matching this schema:
{
  "risk_level": "low|medium|high|critical",
  "risk_score": 0-100,
  "risk_categories": ["string"],
  "risk_description": "string",
  "priority_issues": [{"title": "string", "description": "string", "severity": "string", "urgency": "immediate|high|medium|low", "business_impact": "string"}],
  "compliance_impact": {"impact_level": "none|minor|significant|major|critical", "affected_requirements": ["string"], "gap_description": "string"},
  "recommendations": [{"title": "string", "description": "string", "type": "configuration|process|technical|training|policy", "priority": "string", "effort": "string"}]
}"#;

/// The JSON schema instruction appended to security event analysis prompts.
const SECURITY_EVENT_JSON_SCHEMA: &str = r#"

Respond ONLY with valid JSON matching this schema:
{
  "threat_type": "string",
  "severity": "Critical|High|Medium|Low",
  "confidence": 0-100,
  "recommendations": ["string"]
}"#;

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
        let (system_prompt, prompt) = self.build_analysis_prompt(&context)?;

        // Create inference request
        let mut request = InferenceRequest::new(prompt)
            .with_max_tokens(self.config.inference.max_tokens)
            .with_temperature(self.config.inference.temperature)
            .with_top_p(self.config.inference.top_p);
        if let Some(sys) = system_prompt {
            request = request.with_system_prompt(sys);
        }

        // Perform inference
        let response = self.engine.infer(request).await?;

        // Parse the response
        let result = self.parse_analysis_response(&response.text, &context, start_time.elapsed())?;

        info!("Analysis completed in {}ms", result.metadata.processing_time_ms);
        Ok(result)
    }

    /// Analyze a single security event.
    pub async fn analyze_security_event(&self, event: &SecurityEvent) -> Result<SecurityAnalysis> {
        let (system_prompt, prompt) = self.build_security_event_prompt(event)?;

        let mut request = InferenceRequest::new(prompt)
            .with_max_tokens(1024)
            .with_temperature(0.3); // Lower temperature for security analysis
        if let Some(sys) = system_prompt {
            request = request.with_system_prompt(sys);
        }

        let response = self.engine.infer(request).await?;
        self.parse_security_analysis(&response.text, event)
    }

    /// Summarize multiple analysis results.
    pub async fn summarize_results(&self, results: &[AnalysisResult]) -> Result<AnalysisSummary> {
        let (system_prompt, prompt) = self.build_summary_prompt(results)?;

        let mut request = InferenceRequest::new(prompt)
            .with_max_tokens(2048)
            .with_temperature(0.5);
        if let Some(sys) = system_prompt {
            request = request.with_system_prompt(sys);
        }

        let response = self.engine.infer(request).await?;
        self.parse_summary_response(&response.text)
    }

    /// Build analysis prompt from context, returning (system_prompt, user_prompt).
    fn build_analysis_prompt(&self, context: &AnalysisContext) -> Result<(Option<String>, String)> {
        let template = PromptTemplates::get("security_analysis")
            .ok_or_else(|| anyhow::anyhow!("Security analysis template not found"))?;

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

        let (system_prompt, user_prompt) = SecurityPromptBuilder::new(template)
            .security_context(&security_context)
            .scan_results(&scan_results_obj)
            .build_parts();

        // Append the JSON schema instruction so the LLM returns structured output
        Ok((system_prompt, format!("{}{}", user_prompt, ANALYSIS_JSON_SCHEMA)))
    }

    /// Format scan results for prompt.
    #[allow(dead_code)] // Will be used when LLM response parsing is implemented
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
    ///
    /// Attempts three strategies in order:
    /// 1. Direct JSON deserialization of the full response.
    /// 2. Extract a JSON block (first `{` to last `}`) and deserialize that.
    /// 3. Heuristic fallback derived from the scan context itself.
    fn parse_analysis_response(
        &self,
        response: &str,
        context: &AnalysisContext,
        duration: std::time::Duration,
    ) -> Result<AnalysisResult> {
        let build_metadata = |confidence: u8, tokens: u32| AnalysisMetadata {
            timestamp: chrono::Utc::now(),
            model_name: self.config.model.name.clone(),
            confidence_score: confidence,
            processing_time_ms: duration.as_millis() as u64,
            tokens_processed: tokens,
        };

        // --- Strategy 1: direct deserialization ---
        if let Ok(raw) = serde_json::from_str::<RawAnalysisResponse>(response) {
            info!("Parsed LLM analysis response via direct JSON deserialization");
            return Ok(self.raw_to_analysis_result(raw, context, build_metadata(85, response.len() as u32)));
        }

        // --- Strategy 2: extract JSON block from surrounding text ---
        if let Some(json_block) = extract_json_block(response)
            && let Ok(raw) = serde_json::from_str::<RawAnalysisResponse>(&json_block)
        {
            warn!("LLM response contained extra text around JSON; extracted JSON block successfully");
            return Ok(self.raw_to_analysis_result(raw, context, build_metadata(75, response.len() as u32)));
        }

        // --- Strategy 3: heuristic fallback from context ---
        warn!(
            "Failed to parse LLM analysis response as JSON; falling back to heuristic analysis. \
             Response length: {} chars, first 200 chars: {:?}",
            response.len(),
            &response[..response.len().min(200)]
        );
        Ok(self.heuristic_analysis_result(response, context, build_metadata(40, response.len() as u32)))
    }

    /// Convert a successfully parsed `RawAnalysisResponse` into the domain `AnalysisResult`.
    fn raw_to_analysis_result(
        &self,
        raw: RawAnalysisResponse,
        context: &AnalysisContext,
        metadata: AnalysisMetadata,
    ) -> AnalysisResult {
        let risk_assessment = RiskAssessment {
            risk_level: parse_risk_level(&raw.risk_level),
            risk_categories: if raw.risk_categories.is_empty() {
                vec!["General".to_string()]
            } else {
                raw.risk_categories
            },
            risk_score: raw.risk_score.min(100),
            description: if raw.risk_description.is_empty() {
                "Risk assessment from automated analysis".to_string()
            } else {
                raw.risk_description
            },
        };

        let priority_issues: Vec<PriorityIssue> = raw.priority_issues
            .into_iter()
            .enumerate()
            .map(|(i, issue)| PriorityIssue {
                id: format!("issue-{}", i + 1),
                title: issue.title,
                description: issue.description,
                affected_systems: vec![context.asset_type.clone()],
                severity: if issue.severity.is_empty() { "Medium".to_string() } else { issue.severity },
                urgency: parse_urgency_level(&issue.urgency),
                business_impact: if issue.business_impact.is_empty() {
                    "See issue description".to_string()
                } else {
                    issue.business_impact
                },
            })
            .collect();

        let compliance_impact = match raw.compliance_impact {
            Some(ci) => ComplianceImpact {
                framework: context.compliance_framework.clone(),
                impact_level: parse_impact_level(&ci.impact_level),
                affected_requirements: ci.affected_requirements,
                potential_penalties: vec!["Non-compliance findings".to_string()],
                gap_description: if ci.gap_description.is_empty() {
                    "See analysis details".to_string()
                } else {
                    ci.gap_description
                },
            },
            None => ComplianceImpact {
                framework: context.compliance_framework.clone(),
                impact_level: ImpactLevel::Significant,
                affected_requirements: vec![],
                potential_penalties: vec!["Non-compliance findings".to_string()],
                gap_description: "Compliance impact could not be determined from LLM response".to_string(),
            },
        };

        let recommendations: Vec<Recommendation> = raw.recommendations
            .into_iter()
            .enumerate()
            .map(|(i, rec)| Recommendation {
                id: format!("rec-{}", i + 1),
                title: rec.title,
                description: rec.description,
                recommendation_type: parse_recommendation_type(&rec.recommendation_type),
                priority: if rec.priority.is_empty() { "Medium".to_string() } else { rec.priority },
                estimated_effort: if rec.effort.is_empty() { "To be estimated".to_string() } else { rec.effort },
                dependencies: vec![],
            })
            .collect();

        AnalysisResult {
            id: uuid::Uuid::new_v4().to_string(),
            risk_assessment,
            priority_issues,
            compliance_impact,
            recommendations,
            metadata,
        }
    }

    /// Build a heuristic `AnalysisResult` when JSON parsing fails entirely.
    /// Uses keywords from the LLM text and scan context data to produce a
    /// best-effort result.
    fn heuristic_analysis_result(
        &self,
        response: &str,
        context: &AnalysisContext,
        metadata: AnalysisMetadata,
    ) -> AnalysisResult {
        let response_lower = response.to_lowercase();

        // --- Heuristic risk level ---
        let risk_level = if response_lower.contains("critical") {
            RiskLevel::Critical
        } else if response_lower.contains("high risk") || response_lower.contains("high severity") {
            RiskLevel::High
        } else if response_lower.contains("low risk") || response_lower.contains("minimal") {
            RiskLevel::Low
        } else {
            // Default: derive from scan results
            self.risk_level_from_scan_results(&context.scan_results)
        };

        let risk_score = match &risk_level {
            RiskLevel::Critical => 90,
            RiskLevel::High => 75,
            RiskLevel::Medium => 50,
            RiskLevel::Low => 25,
        };

        // --- Heuristic risk categories from keywords ---
        let mut risk_categories = Vec::new();
        let keyword_category_map = [
            ("access control", "Access Control"),
            ("authentication", "Authentication"),
            ("authorization", "Authorization"),
            ("encryption", "Encryption"),
            ("firewall", "Network Security"),
            ("network", "Network Security"),
            ("password", "Password Policy"),
            ("patch", "Patch Management"),
            ("logging", "Logging & Monitoring"),
            ("audit", "Audit"),
            ("configuration", "Configuration"),
            ("vulnerability", "Vulnerability Management"),
            ("malware", "Malware Protection"),
        ];
        for (keyword, category) in &keyword_category_map {
            if response_lower.contains(keyword) {
                risk_categories.push(category.to_string());
            }
        }
        if risk_categories.is_empty() {
            risk_categories.push("General Security".to_string());
        }

        // --- Heuristic priority issues from failed scan results ---
        let priority_issues: Vec<PriorityIssue> = context.scan_results.iter()
            .filter(|r| !r.passed)
            .take(10) // Cap at 10 most relevant
            .enumerate()
            .map(|(i, r)| PriorityIssue {
                id: format!("issue-{}", i + 1),
                title: r.check_name.clone(),
                description: r.message.clone(),
                affected_systems: vec![context.asset_type.clone()],
                severity: r.severity.clone(),
                urgency: match r.severity.to_lowercase().as_str() {
                    "critical" => UrgencyLevel::Immediate,
                    "high" => UrgencyLevel::High,
                    "medium" => UrgencyLevel::Medium,
                    _ => UrgencyLevel::Low,
                },
                business_impact: format!("Failed check in category: {}", r.category),
            })
            .collect();

        // --- Heuristic compliance impact ---
        let failed_count = context.scan_results.iter().filter(|r| !r.passed).count();
        let total_count = context.scan_results.len();
        let impact_level = if total_count == 0 {
            ImpactLevel::None
        } else {
            let failure_rate = failed_count as f32 / total_count as f32;
            if failure_rate > 0.5 {
                ImpactLevel::Critical
            } else if failure_rate > 0.3 {
                ImpactLevel::Major
            } else if failure_rate > 0.15 {
                ImpactLevel::Significant
            } else if failure_rate > 0.0 {
                ImpactLevel::Minor
            } else {
                ImpactLevel::None
            }
        };

        let compliance_impact = ComplianceImpact {
            framework: context.compliance_framework.clone(),
            impact_level,
            affected_requirements: context.scan_results.iter()
                .filter(|r| !r.passed)
                .map(|r| r.check_id.clone())
                .collect(),
            potential_penalties: vec!["Non-compliance findings (heuristic assessment)".to_string()],
            gap_description: format!(
                "Heuristic assessment: {} of {} checks failed. LLM response could not be parsed as structured JSON.",
                failed_count, total_count
            ),
        };

        // --- Heuristic recommendations ---
        let mut recommendations = Vec::new();
        let mut rec_idx = 1;

        // Generate a recommendation for each distinct category of failed checks
        let mut seen_categories = std::collections::HashSet::new();
        for r in context.scan_results.iter().filter(|r| !r.passed) {
            if seen_categories.insert(r.category.clone()) {
                recommendations.push(Recommendation {
                    id: format!("rec-{}", rec_idx),
                    title: format!("Address {} issues", r.category),
                    description: format!("Review and remediate failed checks in the {} category", r.category),
                    recommendation_type: RecommendationType::Technical,
                    priority: r.severity.clone(),
                    estimated_effort: "To be estimated".to_string(),
                    dependencies: vec![],
                });
                rec_idx += 1;
            }
        }

        if recommendations.is_empty() {
            recommendations.push(Recommendation {
                id: "rec-1".to_string(),
                title: "Review scan results".to_string(),
                description: "Manually review the scan results as automated analysis could not produce structured recommendations".to_string(),
                recommendation_type: RecommendationType::Process,
                priority: "Medium".to_string(),
                estimated_effort: "1-2 hours".to_string(),
                dependencies: vec![],
            });
        }

        AnalysisResult {
            id: uuid::Uuid::new_v4().to_string(),
            risk_assessment: RiskAssessment {
                risk_level,
                risk_categories,
                risk_score,
                description: format!(
                    "Heuristic risk assessment based on {} scan results ({} failed). LLM structured parsing failed.",
                    total_count, failed_count
                ),
            },
            priority_issues,
            compliance_impact,
            recommendations,
            metadata,
        }
    }

    /// Derive a `RiskLevel` from scan results when no LLM signal is available.
    fn risk_level_from_scan_results(&self, results: &[ScanResult]) -> RiskLevel {
        let critical = results.iter()
            .filter(|r| !r.passed && r.severity.to_lowercase().contains("critical"))
            .count();
        let high = results.iter()
            .filter(|r| !r.passed && r.severity.to_lowercase().contains("high"))
            .count();

        if critical > 0 {
            RiskLevel::Critical
        } else if high > 3 {
            RiskLevel::High
        } else if high > 0 || results.iter().filter(|r| !r.passed).count() > 5 {
            RiskLevel::Medium
        } else {
            RiskLevel::Low
        }
    }

    /// Build security event analysis prompt, returning (system_prompt, user_prompt).
    fn build_security_event_prompt(&self, event: &SecurityEvent) -> Result<(Option<String>, String)> {
        let template = PromptTemplates::get("threat_classification")
            .ok_or_else(|| anyhow::anyhow!("Threat classification template not found"))?;

        let mut variables = std::collections::HashMap::new();
        variables.insert("event_details".to_string(), serde_json::to_string_pretty(event)?);
        variables.insert("system_info".to_string(), event.system_info.clone());
        variables.insert("historical_context".to_string(), event.historical_context.clone());

        let (system_prompt, user_prompt) = template.render_parts(&variables);

        // Append the JSON schema instruction for structured output
        Ok((system_prompt, format!("{}{}", user_prompt, SECURITY_EVENT_JSON_SCHEMA)))
    }

    /// Parse security analysis response from LLM.
    ///
    /// Attempts three strategies in order:
    /// 1. Direct JSON deserialization of the full response.
    /// 2. Extract a JSON block (first `{` to last `}`) and deserialize that.
    /// 3. Heuristic fallback based on keyword extraction from the response text.
    fn parse_security_analysis(&self, response: &str, event: &SecurityEvent) -> Result<SecurityAnalysis> {
        // --- Strategy 1: direct deserialization ---
        if let Ok(raw) = serde_json::from_str::<RawSecurityAnalysis>(response) {
            info!("Parsed LLM security analysis response via direct JSON deserialization");
            return Ok(self.raw_to_security_analysis(raw, event));
        }

        // --- Strategy 2: extract JSON block ---
        if let Some(json_block) = extract_json_block(response)
            && let Ok(raw) = serde_json::from_str::<RawSecurityAnalysis>(&json_block)
        {
            warn!("LLM security response contained extra text around JSON; extracted JSON block successfully");
            return Ok(self.raw_to_security_analysis(raw, event));
        }

        // --- Strategy 3: heuristic fallback ---
        warn!(
            "Failed to parse LLM security analysis response as JSON; falling back to heuristics. \
             Response length: {} chars, first 200 chars: {:?}",
            response.len(),
            &response[..response.len().min(200)]
        );
        Ok(self.heuristic_security_analysis(response, event))
    }

    /// Convert a parsed `RawSecurityAnalysis` into the domain `SecurityAnalysis`.
    fn raw_to_security_analysis(&self, raw: RawSecurityAnalysis, event: &SecurityEvent) -> SecurityAnalysis {
        SecurityAnalysis {
            event_id: event.id.clone(),
            threat_type: if raw.threat_type.is_empty() { "Unknown".to_string() } else { raw.threat_type },
            severity: if raw.severity.is_empty() { "Medium".to_string() } else { raw.severity },
            confidence: raw.confidence.unwrap_or(70),
            recommendations: if raw.recommendations.is_empty() {
                vec!["Review the security event manually".to_string()]
            } else {
                raw.recommendations
            },
            analysis_timestamp: chrono::Utc::now(),
        }
    }

    /// Build a heuristic `SecurityAnalysis` when JSON parsing fails entirely.
    fn heuristic_security_analysis(&self, response: &str, event: &SecurityEvent) -> SecurityAnalysis {
        let response_lower = response.to_lowercase();

        // --- Heuristic threat type ---
        let threat_type_keywords = [
            ("malware", "Malware"),
            ("ransomware", "Ransomware"),
            ("phishing", "Phishing"),
            ("brute force", "Brute Force"),
            ("denial of service", "Denial of Service"),
            ("dos", "Denial of Service"),
            ("ddos", "Distributed Denial of Service"),
            ("injection", "Injection Attack"),
            ("sql injection", "SQL Injection"),
            ("xss", "Cross-Site Scripting"),
            ("cross-site", "Cross-Site Attack"),
            ("privilege escalation", "Privilege Escalation"),
            ("lateral movement", "Lateral Movement"),
            ("exfiltration", "Data Exfiltration"),
            ("unauthorized access", "Unauthorized Access"),
            ("intrusion", "Intrusion"),
        ];

        let threat_type = threat_type_keywords
            .iter()
            .find(|(keyword, _)| response_lower.contains(keyword))
            .map(|(_, tt)| tt.to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        // --- Heuristic severity ---
        let severity = if response_lower.contains("critical") {
            "Critical".to_string()
        } else if response_lower.contains("high") {
            "High".to_string()
        } else if response_lower.contains("low") {
            "Low".to_string()
        } else {
            "Medium".to_string()
        };

        // --- Heuristic recommendations ---
        let mut recommendations = Vec::new();
        if response_lower.contains("isolat") {
            recommendations.push("Isolate affected system".to_string());
        }
        if response_lower.contains("scan") || response_lower.contains("malware") {
            recommendations.push("Run comprehensive malware scan".to_string());
        }
        if response_lower.contains("patch") || response_lower.contains("update") {
            recommendations.push("Apply relevant security patches".to_string());
        }
        if response_lower.contains("monitor") || response_lower.contains("log") {
            recommendations.push("Increase monitoring and review logs".to_string());
        }
        if response_lower.contains("password") || response_lower.contains("credential") {
            recommendations.push("Reset potentially compromised credentials".to_string());
        }
        if recommendations.is_empty() {
            recommendations.push("Investigate the security event manually".to_string());
            recommendations.push("Review system logs for related activity".to_string());
        }

        SecurityAnalysis {
            event_id: event.id.clone(),
            threat_type,
            severity,
            confidence: 30, // Low confidence for heuristic fallback
            recommendations,
            analysis_timestamp: chrono::Utc::now(),
        }
    }

    /// Build summary prompt for multiple results, returning (system_prompt, user_prompt).
    fn build_summary_prompt(&self, results: &[AnalysisResult]) -> Result<(Option<String>, String)> {
        let summary_text = results.iter()
            .map(|r| format!("Analysis {}: Risk Level {:?}, {} priority issues",
                r.id, r.risk_assessment.risk_level, r.priority_issues.len()))
            .collect::<Vec<_>>()
            .join("\n");

        Ok((
            Some("You are a senior security analyst. Provide concise executive summaries highlighting key risks and recommended actions.".to_string()),
            format!(
                "Summarize the following security analysis results:\n\n{}\n\nProvide a concise executive summary highlighting key risks and recommended actions.",
                summary_text
            ),
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

    // -----------------------------------------------------------------------
    // Tests for parse helpers
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_risk_level() {
        assert!(matches!(parse_risk_level("low"), RiskLevel::Low));
        assert!(matches!(parse_risk_level("Medium"), RiskLevel::Medium));
        assert!(matches!(parse_risk_level("HIGH"), RiskLevel::High));
        assert!(matches!(parse_risk_level("critical"), RiskLevel::Critical));
        assert!(matches!(parse_risk_level("severe"), RiskLevel::Critical));
        assert!(matches!(parse_risk_level("moderate"), RiskLevel::Medium));
        assert!(matches!(parse_risk_level("unknown"), RiskLevel::Medium)); // default
    }

    #[test]
    fn test_parse_urgency_level() {
        assert!(matches!(parse_urgency_level("immediate"), UrgencyLevel::Immediate));
        assert!(matches!(parse_urgency_level("High"), UrgencyLevel::High));
        assert!(matches!(parse_urgency_level("medium"), UrgencyLevel::Medium));
        assert!(matches!(parse_urgency_level("low"), UrgencyLevel::Low));
        assert!(matches!(parse_urgency_level("garbage"), UrgencyLevel::Medium)); // default
    }

    #[test]
    fn test_parse_impact_level() {
        assert!(matches!(parse_impact_level("none"), ImpactLevel::None));
        assert!(matches!(parse_impact_level("minor"), ImpactLevel::Minor));
        assert!(matches!(parse_impact_level("significant"), ImpactLevel::Significant));
        assert!(matches!(parse_impact_level("major"), ImpactLevel::Major));
        assert!(matches!(parse_impact_level("critical"), ImpactLevel::Critical));
    }

    #[test]
    fn test_parse_recommendation_type() {
        assert!(matches!(parse_recommendation_type("configuration"), RecommendationType::Configuration));
        assert!(matches!(parse_recommendation_type("process"), RecommendationType::Process));
        assert!(matches!(parse_recommendation_type("technical"), RecommendationType::Technical));
        assert!(matches!(parse_recommendation_type("training"), RecommendationType::Training));
        assert!(matches!(parse_recommendation_type("policy"), RecommendationType::Policy));
        assert!(matches!(parse_recommendation_type("config"), RecommendationType::Configuration));
    }

    #[test]
    fn test_extract_json_block_clean() {
        let input = r#"{"risk_level": "high"}"#;
        let result = extract_json_block(input);
        assert_eq!(result, Some(r#"{"risk_level": "high"}"#.to_string()));
    }

    #[test]
    fn test_extract_json_block_with_surrounding_text() {
        let input = r#"Here is my analysis:
{"risk_level": "high", "risk_score": 80}
Hope this helps!"#;
        let result = extract_json_block(input);
        assert_eq!(result, Some(r#"{"risk_level": "high", "risk_score": 80}"#.to_string()));
    }

    #[test]
    fn test_extract_json_block_no_json() {
        let result = extract_json_block("no json here at all");
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_json_block_malformed() {
        // Only closing brace, no opening
        let result = extract_json_block("}");
        // find '{' returns None so overall None
        assert!(result.is_none());
    }

    // -----------------------------------------------------------------------
    // Tests for parse_analysis_response
    // -----------------------------------------------------------------------

    fn make_test_context() -> AnalysisContext {
        AnalysisContext {
            system_info: "Test Linux Server".to_string(),
            scan_results: vec![
                ScanResult {
                    check_id: "CHK-001".to_string(),
                    check_name: "SSH Root Login".to_string(),
                    category: "Security".to_string(),
                    severity: "High".to_string(),
                    passed: false,
                    message: "Root login is enabled".to_string(),
                    raw_data: serde_json::json!({}),
                },
                ScanResult {
                    check_id: "CHK-002".to_string(),
                    check_name: "Firewall Status".to_string(),
                    category: "Network".to_string(),
                    severity: "Critical".to_string(),
                    passed: false,
                    message: "Firewall is disabled".to_string(),
                    raw_data: serde_json::json!({}),
                },
                ScanResult {
                    check_id: "CHK-003".to_string(),
                    check_name: "Disk Encryption".to_string(),
                    category: "Security".to_string(),
                    severity: "Medium".to_string(),
                    passed: true,
                    message: "Disk encryption is enabled".to_string(),
                    raw_data: serde_json::json!({}),
                },
            ],
            compliance_framework: "ISO 27001".to_string(),
            asset_type: "Server".to_string(),
            timestamp: chrono::Utc::now(),
            metadata: std::collections::HashMap::new(),
        }
    }

    fn make_test_analyzer() -> LLMAnalyzer {
        use super::super::config::LLMConfig;
        use std::sync::Arc;

        // We need a dummy engine for the analyzer; we only call parse methods
        // which don't use the engine.
        struct DummyEngine;

        #[async_trait::async_trait]
        impl super::super::engine::ModelEngine for DummyEngine {
            async fn status(&self) -> super::super::engine::ModelStatus {
                super::super::engine::ModelStatus::Unloaded
            }
            async fn infer(&self, _req: InferenceRequest) -> Result<super::super::engine::InferenceResponse> {
                Ok(super::super::engine::InferenceResponse::new(""))
            }
            async fn memory_usage(&self) -> super::super::engine::MemoryUsage {
                super::super::engine::MemoryUsage { allocated_mb: 0, peak_mb: 0, available_mb: 0 }
            }
            async fn inference_count(&self) -> u64 { 0 }
            async fn reload(&self) -> Result<()> { Ok(()) }
            async fn unload(&self) -> Result<()> { Ok(()) }
        }

        let config = LLMConfig::default();
        LLMAnalyzer::new(Arc::new(DummyEngine), &config)
    }

    #[test]
    fn test_parse_analysis_response_valid_json() {
        let analyzer = make_test_analyzer();
        let context = make_test_context();
        let duration = std::time::Duration::from_millis(100);

        let response = r#"{
            "risk_level": "high",
            "risk_score": 82,
            "risk_categories": ["Access Control", "Network Security"],
            "risk_description": "Multiple critical security gaps found",
            "priority_issues": [
                {
                    "title": "Root SSH Access",
                    "description": "Root login via SSH is enabled",
                    "severity": "High",
                    "urgency": "immediate",
                    "business_impact": "Full system compromise possible"
                }
            ],
            "compliance_impact": {
                "impact_level": "major",
                "affected_requirements": ["A.9.3.1"],
                "gap_description": "Access control requirements not met"
            },
            "recommendations": [
                {
                    "title": "Disable Root SSH",
                    "description": "Disable root login in sshd_config",
                    "type": "configuration",
                    "priority": "High",
                    "effort": "30 minutes"
                }
            ]
        }"#;

        let result = analyzer.parse_analysis_response(response, &context, duration).unwrap();

        assert!(matches!(result.risk_assessment.risk_level, RiskLevel::High));
        assert_eq!(result.risk_assessment.risk_score, 82);
        assert_eq!(result.risk_assessment.risk_categories.len(), 2);
        assert_eq!(result.priority_issues.len(), 1);
        assert_eq!(result.priority_issues[0].title, "Root SSH Access");
        assert!(matches!(result.priority_issues[0].urgency, UrgencyLevel::Immediate));
        assert!(matches!(result.compliance_impact.impact_level, ImpactLevel::Major));
        assert_eq!(result.recommendations.len(), 1);
        assert!(matches!(result.recommendations[0].recommendation_type, RecommendationType::Configuration));
        assert_eq!(result.metadata.confidence_score, 85);
    }

    #[test]
    fn test_parse_analysis_response_json_with_surrounding_text() {
        let analyzer = make_test_analyzer();
        let context = make_test_context();
        let duration = std::time::Duration::from_millis(150);

        let response = r#"Here is my analysis of the scan results:

{
    "risk_level": "critical",
    "risk_score": 95,
    "risk_categories": ["Firewall"],
    "risk_description": "Firewall disabled on production server",
    "priority_issues": [],
    "compliance_impact": {
        "impact_level": "critical",
        "affected_requirements": [],
        "gap_description": "Major compliance gap"
    },
    "recommendations": []
}

Let me know if you need more details."#;

        let result = analyzer.parse_analysis_response(response, &context, duration).unwrap();

        assert!(matches!(result.risk_assessment.risk_level, RiskLevel::Critical));
        assert_eq!(result.risk_assessment.risk_score, 95);
        // Confidence is lower because we had to extract JSON
        assert_eq!(result.metadata.confidence_score, 75);
    }

    #[test]
    fn test_parse_analysis_response_heuristic_fallback() {
        let analyzer = make_test_analyzer();
        let context = make_test_context();
        let duration = std::time::Duration::from_millis(200);

        let response = "The system has critical vulnerabilities related to access control and network security. \
                         The firewall being disabled is a high risk issue that needs immediate attention. \
                         Password policies should be reviewed.";

        let result = analyzer.parse_analysis_response(response, &context, duration).unwrap();

        // Should detect "critical" keyword
        assert!(matches!(result.risk_assessment.risk_level, RiskLevel::Critical));
        // Should find risk categories from keywords
        assert!(result.risk_assessment.risk_categories.contains(&"Access Control".to_string()));
        assert!(result.risk_assessment.risk_categories.contains(&"Network Security".to_string()));
        assert!(result.risk_assessment.risk_categories.contains(&"Password Policy".to_string()));
        // Priority issues should come from failed scan results
        assert_eq!(result.priority_issues.len(), 2); // 2 failed checks
        assert_eq!(result.metadata.confidence_score, 40);
    }

    // -----------------------------------------------------------------------
    // Tests for parse_security_analysis
    // -----------------------------------------------------------------------

    fn make_test_event() -> SecurityEvent {
        SecurityEvent {
            id: "evt-001".to_string(),
            event_type: "intrusion_attempt".to_string(),
            description: "Multiple failed SSH login attempts detected".to_string(),
            system_info: "Production Linux Server".to_string(),
            historical_context: "No prior incidents".to_string(),
        }
    }

    #[test]
    fn test_parse_security_analysis_valid_json() {
        let analyzer = make_test_analyzer();
        let event = make_test_event();

        let response = r#"{
            "threat_type": "Brute Force",
            "severity": "High",
            "confidence": 88,
            "recommendations": ["Block source IP", "Enable account lockout", "Review SSH configuration"]
        }"#;

        let result = analyzer.parse_security_analysis(response, &event).unwrap();

        assert_eq!(result.event_id, "evt-001");
        assert_eq!(result.threat_type, "Brute Force");
        assert_eq!(result.severity, "High");
        assert_eq!(result.confidence, 88);
        assert_eq!(result.recommendations.len(), 3);
    }

    #[test]
    fn test_parse_security_analysis_json_with_text() {
        let analyzer = make_test_analyzer();
        let event = make_test_event();

        let response = r#"Based on my analysis:
{"threat_type": "Unauthorized Access", "severity": "Critical", "confidence": 92, "recommendations": ["Isolate system"]}
End of analysis."#;

        let result = analyzer.parse_security_analysis(response, &event).unwrap();

        assert_eq!(result.threat_type, "Unauthorized Access");
        assert_eq!(result.severity, "Critical");
        assert_eq!(result.confidence, 92);
    }

    #[test]
    fn test_parse_security_analysis_heuristic_fallback() {
        let analyzer = make_test_analyzer();
        let event = make_test_event();

        let response = "This appears to be a brute force attack with high severity. \
                         The attacker is attempting to gain unauthorized access. \
                         Recommend isolating the affected system and monitoring logs.";

        let result = analyzer.parse_security_analysis(response, &event).unwrap();

        assert_eq!(result.event_id, "evt-001");
        assert_eq!(result.threat_type, "Brute Force");
        assert_eq!(result.severity, "High");
        assert_eq!(result.confidence, 30); // Low confidence for heuristic
        assert!(!result.recommendations.is_empty());
    }

    #[test]
    fn test_parse_security_analysis_empty_fields_defaults() {
        let analyzer = make_test_analyzer();
        let event = make_test_event();

        // Valid JSON but with empty / missing optional fields
        let response = r#"{"threat_type": "", "severity": "", "recommendations": []}"#;

        let result = analyzer.parse_security_analysis(response, &event).unwrap();

        // Should use defaults for empty strings
        assert_eq!(result.threat_type, "Unknown");
        assert_eq!(result.severity, "Medium");
        assert_eq!(result.confidence, 70); // default when confidence is None
        assert_eq!(result.recommendations, vec!["Review the security event manually"]);
    }

    #[test]
    fn test_parse_analysis_response_minimal_json() {
        let analyzer = make_test_analyzer();
        let context = make_test_context();
        let duration = std::time::Duration::from_millis(50);

        // Minimal valid JSON with only required fields
        let response = r#"{"risk_level": "low", "risk_score": 15}"#;

        let result = analyzer.parse_analysis_response(response, &context, duration).unwrap();

        assert!(matches!(result.risk_assessment.risk_level, RiskLevel::Low));
        assert_eq!(result.risk_assessment.risk_score, 15);
        // Default risk categories when empty
        assert_eq!(result.risk_assessment.risk_categories, vec!["General".to_string()]);
        assert!(result.priority_issues.is_empty());
        assert!(result.recommendations.is_empty());
    }

    #[test]
    fn test_risk_level_from_scan_results() {
        let analyzer = make_test_analyzer();

        // Test with critical failures
        let results = vec![ScanResult {
            check_id: "C1".to_string(),
            check_name: "Test".to_string(),
            category: "Security".to_string(),
            severity: "Critical".to_string(),
            passed: false,
            message: "Failed".to_string(),
            raw_data: serde_json::json!({}),
        }];
        assert!(matches!(analyzer.risk_level_from_scan_results(&results), RiskLevel::Critical));

        // Test with no failures
        let results = vec![ScanResult {
            check_id: "C1".to_string(),
            check_name: "Test".to_string(),
            category: "Security".to_string(),
            severity: "Low".to_string(),
            passed: true,
            message: "Passed".to_string(),
            raw_data: serde_json::json!({}),
        }];
        assert!(matches!(analyzer.risk_level_from_scan_results(&results), RiskLevel::Low));
    }
}
