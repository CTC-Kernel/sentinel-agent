//! LLM-powered remediation recommendations and guidance.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use anyhow::Result;
use tracing::{info, warn};

use super::engine::{ModelEngine, InferenceRequest};
use super::config::LLMConfig;
use super::prompts::{PromptTemplates, PromptBuilder};
pub use crate::analyzer::RiskLevel;

// ---------------------------------------------------------------------------
// Intermediate serde structs for tolerant JSON parsing
// ---------------------------------------------------------------------------

/// Intermediate struct for deserializing a remediation plan from LLM JSON.
/// All fields are optional / defaulted so partial JSON still deserializes.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct RawRemediationPlan {
    title: Option<String>,
    description: Option<String>,
    actions: Vec<RawRemediationAction>,
    estimated_total_duration: Option<String>,
    overall_risk: Option<String>,
}

/// Intermediate struct for a single remediation action.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct RawRemediationAction {
    id: Option<String>,
    title: Option<String>,
    description: Option<String>,
    action_type: Option<String>,
    priority: Option<String>,
    estimated_duration: Option<String>,
    dependencies: Vec<String>,
    commands: Vec<String>,
    verification_steps: Vec<String>,
    rollback_steps: Vec<String>,
    risk_level: Option<String>,
    prerequisites: Vec<String>,
}

/// Intermediate struct for issue-specific remediation.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct RawIssueRemediation {
    immediate_actions: Vec<String>,
    detailed_steps: Vec<String>,
    verification_commands: Vec<String>,
    rollback_procedure: Vec<String>,
    estimated_time: Option<String>,
    risk_assessment: Option<String>,
}

/// Intermediate struct for remediation validation.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
struct RawRemediationValidation {
    is_valid: Option<bool>,
    safety_concerns: Vec<String>,
    missing_dependencies: Vec<String>,
    recommendations: Vec<String>,
}

// ---------------------------------------------------------------------------
// Helper: extract JSON from LLM output
// ---------------------------------------------------------------------------

/// Try to extract a JSON object from free-form LLM text by locating the first
/// `{` and the last `}`.  Returns `None` when no braces are found or the slice
/// would be empty.
fn extract_json_block(text: &str) -> Option<&str> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if end > start {
        Some(&text[start..=end])
    } else {
        None
    }
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

fn parse_action_type(s: &str) -> ActionType {
    match s.to_lowercase().as_str() {
        "configuration" | "config" => ActionType::Configuration,
        "patch" | "update" => ActionType::Patch,
        "service" | "restart" => ActionType::Service,
        "network" | "firewall" => ActionType::Network,
        "access" | "iam" | "permission" => ActionType::Access,
        "monitoring" | "logging" | "alert" => ActionType::Monitoring,
        "policy" | "compliance" => ActionType::Policy,
        _ => ActionType::Configuration, // safe default
    }
}

fn parse_priority(s: &str) -> Priority {
    match s.to_lowercase().as_str() {
        "critical" => Priority::Critical,
        "high" => Priority::High,
        "medium" => Priority::Medium,
        "low" => Priority::Low,
        "info" | "informational" => Priority::Info,
        _ => Priority::Medium,
    }
}

fn parse_risk_level(s: &str) -> RiskLevel {
    match s.to_lowercase().as_str() {
        "low" => RiskLevel::Low,
        "medium" | "moderate" => RiskLevel::Medium,
        "high" => RiskLevel::High,
        "critical" | "severe" => RiskLevel::Critical,
        _ => RiskLevel::Medium,
    }
}

// ---------------------------------------------------------------------------
// RemediationAdvisor
// ---------------------------------------------------------------------------

/// Remediation advisor that provides actionable fix recommendations.
pub struct RemediationAdvisor {
    engine: Arc<dyn ModelEngine>,
    config: LLMConfig,
}

impl RemediationAdvisor {
    /// Create a new remediation advisor.
    pub fn new(engine: Arc<dyn ModelEngine>, config: &LLMConfig) -> Self {
        Self {
            engine,
            config: config.clone(),
        }
    }

    /// Generate remediation plan for identified issues.
    pub async fn generate_remediation_plan(&self, request: RemediationRequest) -> Result<RemediationPlan> {
        info!("Generating remediation plan for {} issues", request.issues.len());
        let start_time = std::time::Instant::now();

        // Build the remediation prompt
        let (system_prompt, prompt) = self.build_remediation_prompt(&request)?;

        // Create inference request
        let mut inference_request = InferenceRequest::new(prompt)
            .with_max_tokens(self.config.inference.max_tokens)
            .with_temperature(0.3) // Lower temperature for technical accuracy
            .with_top_p(self.config.inference.top_p);
        if let Some(sys) = system_prompt {
            inference_request = inference_request.with_system_prompt(sys);
        }

        // Perform inference
        let response = self.engine.infer(inference_request).await?;

        // Parse the response
        let plan = self.parse_remediation_response(&response.text, &request, start_time.elapsed())?;

        info!("Remediation plan generated with {} actions", plan.actions.len());
        Ok(plan)
    }

    /// Get specific remediation steps for a single issue.
    pub async fn get_issue_remediation(&self, issue: &SecurityIssue) -> Result<IssueRemediation> {
        let (system_prompt, prompt) = self.build_issue_remediation_prompt(issue)?;

        let mut request = InferenceRequest::new(prompt)
            .with_max_tokens(1024)
            .with_temperature(0.2);
        if let Some(sys) = system_prompt {
            request = request.with_system_prompt(sys);
        }

        let response = self.engine.infer(request).await?;
        self.parse_issue_remediation(&response.text, issue)
    }

    /// Validate remediation steps before execution.
    pub async fn validate_remediation(&self, plan: &RemediationPlan) -> Result<RemediationValidation> {
        let (system_prompt, prompt) = self.build_validation_prompt(plan)?;

        let mut request = InferenceRequest::new(prompt)
            .with_max_tokens(512)
            .with_temperature(0.1);
        if let Some(sys) = system_prompt {
            request = request.with_system_prompt(sys);
        }

        let response = self.engine.infer(request).await?;
        self.parse_validation_response(&response.text, plan)
    }

    /// Build remediation prompt from request, returning (system_prompt, user_prompt).
    fn build_remediation_prompt(&self, request: &RemediationRequest) -> Result<(Option<String>, String)> {
        let template = PromptTemplates::get("remediation")
            .ok_or_else(|| anyhow::anyhow!("Remediation template not found"))?;

        // Format issues for the prompt
        let issues_text = request.issues.iter()
            .map(|issue| format!("{} [{}]: {}",
                issue.title,
                issue.severity,
                issue.description))
            .collect::<Vec<_>>()
            .join("\n");

        // Format system context
        let system_context = format!(
            "Platform: {}\nOS: {}\nEnvironment: {}\nCompliance: {}",
            request.system_context.platform,
            request.system_context.os,
            request.system_context.environment,
            request.system_context.compliance_framework
        );

        // Format compliance requirements
        let compliance_reqs = request.compliance_requirements.join("\n");

        Ok(PromptBuilder::new(template)
            .set("issues", &issues_text)
            .set("system_context", &system_context)
            .set("compliance_requirements", &compliance_reqs)
            .build_parts())
    }

    /// Build issue-specific remediation prompt, returning (system_prompt, user_prompt).
    fn build_issue_remediation_prompt(&self, issue: &SecurityIssue) -> Result<(Option<String>, String)> {
        let user_prompt = format!(
            r#"Provide detailed remediation steps for the following security issue:

Issue: {}
Severity: {}
Category: {}
Description: {}
Affected Systems: {}
Compliance Impact: {}

Provide:
1. Immediate containment steps
2. Detailed fix procedure
3. Verification commands
4. Rollback procedure
5. Risk assessment during fix

Be specific and include actual commands where applicable.

IMPORTANT: You MUST respond with a single JSON object conforming to this schema:
{{
  "immediate_actions": ["<string>", ...],
  "detailed_steps": ["<string>", ...],
  "verification_commands": ["<string>", ...],
  "rollback_procedure": ["<string>", ...],
  "estimated_time": "<string>",
  "risk_assessment": "<string>"
}}

Respond ONLY with valid JSON. No markdown fences, no commentary."#,
            issue.title,
            issue.severity,
            issue.category,
            issue.description,
            issue.affected_systems.join(", "),
            issue.compliance_impact
        );

        Ok((
            Some("You are a cybersecurity remediation specialist. Provide specific, actionable remediation steps with exact commands.".to_string()),
            user_prompt,
        ))
    }

    /// Build validation prompt for remediation plan, returning (system_prompt, user_prompt).
    fn build_validation_prompt(&self, plan: &RemediationPlan) -> Result<(Option<String>, String)> {
        let actions_text = plan.actions.iter()
            .map(|action| format!("{} [{}]: {}",
                action.title,
                action.priority,
                action.description))
            .collect::<Vec<_>>()
            .join("\n");

        let user_prompt = format!(
            r#"Review the following remediation plan for safety and effectiveness:

Actions:
{}

System Context: {}

Check for:
1. Safety risks or potential system damage
2. Missing prerequisites or dependencies
3. Incomplete rollback procedures
4. Potential compliance violations
5. Resource availability requirements

Provide validation status and any concerns.

IMPORTANT: You MUST respond with a single JSON object conforming to this schema:
{{
  "is_valid": true|false,
  "safety_concerns": ["<string>", ...],
  "missing_dependencies": ["<string>", ...],
  "recommendations": ["<string>", ...]
}}

Respond ONLY with valid JSON. No markdown fences, no commentary."#,
            actions_text,
            plan.system_context
        );

        Ok((
            Some("You are a security remediation validator. Assess remediation plans for safety, completeness, and effectiveness.".to_string()),
            user_prompt,
        ))
    }

    /// Parse remediation response from LLM.
    fn parse_remediation_response(&self, response: &str, request: &RemediationRequest, duration: std::time::Duration) -> Result<RemediationPlan> {
        let now = chrono::Utc::now();
        let generation_time_ms = duration.as_millis() as u64;

        // Strategy 1: direct JSON parse
        if let Ok(raw) = serde_json::from_str::<RawRemediationPlan>(response) {
            return Ok(self.raw_to_remediation_plan(raw, request, now, generation_time_ms));
        }

        // Strategy 2: extract JSON block between first '{' and last '}'
        if let Some(json_block) = extract_json_block(response)
            && let Ok(raw) = serde_json::from_str::<RawRemediationPlan>(json_block)
        {
            warn!("Remediation plan: fell back to JSON block extraction");
            return Ok(self.raw_to_remediation_plan(raw, request, now, generation_time_ms));
        }

        // Strategy 3: build a reasonable fallback from raw text
        warn!("Remediation plan: JSON parsing failed, building fallback from raw text");
        let plan = RemediationPlan {
            id: uuid::Uuid::new_v4().to_string(),
            title: format!("Remediation Plan for {}", request.request_id),
            description: response.chars().take(500).collect::<String>(),
            actions: vec![
                RemediationAction {
                    id: "action-1".to_string(),
                    title: "Review LLM Output".to_string(),
                    description: response.to_string(),
                    action_type: ActionType::Configuration,
                    priority: Priority::High,
                    estimated_duration: "Unknown".to_string(),
                    dependencies: vec![],
                    commands: vec![],
                    verification_steps: vec!["Manually review the raw LLM response".to_string()],
                    rollback_steps: vec![],
                    risk_level: RiskLevel::Medium,
                    prerequisites: vec![],
                }
            ],
            system_context: format!("{:?}", request.system_context),
            estimated_total_duration: "Unknown".to_string(),
            overall_risk: RiskLevel::Medium,
            created_at: now,
            generation_time_ms,
        };

        Ok(plan)
    }

    /// Convert a successfully-parsed intermediate plan into the domain type.
    fn raw_to_remediation_plan(
        &self,
        raw: RawRemediationPlan,
        request: &RemediationRequest,
        now: chrono::DateTime<chrono::Utc>,
        generation_time_ms: u64,
    ) -> RemediationPlan {
        let actions: Vec<RemediationAction> = if raw.actions.is_empty() {
            // If the LLM returned no actions, create a placeholder so the caller
            // always gets at least one item to iterate over.
            vec![RemediationAction {
                id: "action-1".to_string(),
                title: "No actions parsed".to_string(),
                description: "The LLM response contained no structured actions.".to_string(),
                action_type: ActionType::Configuration,
                priority: Priority::Medium,
                estimated_duration: "Unknown".to_string(),
                dependencies: vec![],
                commands: vec![],
                verification_steps: vec![],
                rollback_steps: vec![],
                risk_level: RiskLevel::Low,
                prerequisites: vec![],
            }]
        } else {
            raw.actions
                .into_iter()
                .enumerate()
                .map(|(i, a)| RemediationAction {
                    id: a.id.unwrap_or_else(|| format!("action-{}", i + 1)),
                    title: a.title.unwrap_or_else(|| format!("Action {}", i + 1)),
                    description: a.description.unwrap_or_default(),
                    action_type: a.action_type.as_deref().map(parse_action_type)
                        .unwrap_or(ActionType::Configuration),
                    priority: a.priority.as_deref().map(parse_priority)
                        .unwrap_or(Priority::Medium),
                    estimated_duration: a.estimated_duration.unwrap_or_else(|| "Unknown".to_string()),
                    dependencies: a.dependencies,
                    commands: a.commands,
                    verification_steps: a.verification_steps,
                    rollback_steps: a.rollback_steps,
                    risk_level: a.risk_level.as_deref().map(parse_risk_level)
                        .unwrap_or(RiskLevel::Medium),
                    prerequisites: a.prerequisites,
                })
                .collect()
        };

        RemediationPlan {
            id: uuid::Uuid::new_v4().to_string(),
            title: raw.title.unwrap_or_else(|| format!("Remediation Plan for {}", request.request_id)),
            description: raw.description.unwrap_or_else(|| "Automatically generated remediation plan".to_string()),
            actions,
            system_context: format!("{:?}", request.system_context),
            estimated_total_duration: raw.estimated_total_duration.unwrap_or_else(|| "Unknown".to_string()),
            overall_risk: raw.overall_risk.as_deref().map(parse_risk_level)
                .unwrap_or(RiskLevel::Medium),
            created_at: now,
            generation_time_ms,
        }
    }

    /// Parse issue-specific remediation response.
    fn parse_issue_remediation(&self, response: &str, issue: &SecurityIssue) -> Result<IssueRemediation> {
        // Strategy 1: direct JSON parse
        if let Ok(raw) = serde_json::from_str::<RawIssueRemediation>(response) {
            return Ok(self.raw_to_issue_remediation(raw, issue));
        }

        // Strategy 2: extract JSON block
        if let Some(json_block) = extract_json_block(response)
            && let Ok(raw) = serde_json::from_str::<RawIssueRemediation>(json_block)
        {
            warn!("Issue remediation: fell back to JSON block extraction");
            return Ok(self.raw_to_issue_remediation(raw, issue));
        }

        // Strategy 3: build a reasonable fallback from raw text
        warn!("Issue remediation: JSON parsing failed, building fallback from raw text");

        // Try to extract meaningful lines from the raw response
        let lines: Vec<String> = response
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect();

        Ok(IssueRemediation {
            issue_id: issue.id.clone(),
            immediate_actions: vec!["Review raw LLM response for immediate actions".to_string()],
            detailed_steps: if lines.is_empty() {
                vec!["No detailed steps could be parsed from the LLM response.".to_string()]
            } else {
                lines
            },
            verification_commands: vec![],
            rollback_procedure: vec!["Restore from pre-remediation backup".to_string()],
            estimated_time: "Unknown".to_string(),
            risk_assessment: response.chars().take(300).collect::<String>(),
        })
    }

    /// Convert intermediate issue remediation into the domain type.
    fn raw_to_issue_remediation(&self, raw: RawIssueRemediation, issue: &SecurityIssue) -> IssueRemediation {
        IssueRemediation {
            issue_id: issue.id.clone(),
            immediate_actions: if raw.immediate_actions.is_empty() {
                vec!["No immediate actions specified".to_string()]
            } else {
                raw.immediate_actions
            },
            detailed_steps: if raw.detailed_steps.is_empty() {
                vec!["No detailed steps specified".to_string()]
            } else {
                raw.detailed_steps
            },
            verification_commands: raw.verification_commands,
            rollback_procedure: if raw.rollback_procedure.is_empty() {
                vec!["Restore from pre-remediation backup".to_string()]
            } else {
                raw.rollback_procedure
            },
            estimated_time: raw.estimated_time.unwrap_or_else(|| "Unknown".to_string()),
            risk_assessment: raw.risk_assessment.unwrap_or_else(|| "No risk assessment provided".to_string()),
        }
    }

    /// Parse validation response.
    fn parse_validation_response(&self, response: &str, plan: &RemediationPlan) -> Result<RemediationValidation> {
        // Strategy 1: direct JSON parse
        if let Ok(raw) = serde_json::from_str::<RawRemediationValidation>(response) {
            return Ok(self.raw_to_validation(raw, plan));
        }

        // Strategy 2: extract JSON block
        if let Some(json_block) = extract_json_block(response)
            && let Ok(raw) = serde_json::from_str::<RawRemediationValidation>(json_block)
        {
            warn!("Remediation validation: fell back to JSON block extraction");
            return Ok(self.raw_to_validation(raw, plan));
        }

        // Strategy 3: build a reasonable fallback from raw text
        warn!("Remediation validation: JSON parsing failed, building fallback from raw text");

        // Heuristic: if the raw text contains words like "unsafe", "risk", "concern",
        // mark as invalid to be safe.
        let lower = response.to_lowercase();
        let likely_invalid = lower.contains("unsafe")
            || lower.contains("not valid")
            || lower.contains("invalid")
            || lower.contains("dangerous")
            || lower.contains("do not proceed");

        Ok(RemediationValidation {
            plan_id: plan.id.clone(),
            is_valid: !likely_invalid,
            safety_concerns: if likely_invalid {
                vec!["Validation response could not be parsed; raw text suggests concerns".to_string()]
            } else {
                vec![]
            },
            missing_dependencies: vec![],
            recommendations: vec![
                "Review raw LLM validation output manually".to_string(),
                response.chars().take(300).collect::<String>(),
            ],
            validation_timestamp: chrono::Utc::now(),
        })
    }

    /// Convert intermediate validation result into the domain type.
    fn raw_to_validation(&self, raw: RawRemediationValidation, plan: &RemediationPlan) -> RemediationValidation {
        RemediationValidation {
            plan_id: plan.id.clone(),
            is_valid: raw.is_valid.unwrap_or(true),
            safety_concerns: raw.safety_concerns,
            missing_dependencies: raw.missing_dependencies,
            recommendations: if raw.recommendations.is_empty() {
                vec!["No additional recommendations".to_string()]
            } else {
                raw.recommendations
            },
            validation_timestamp: chrono::Utc::now(),
        }
    }
}

/// Request for remediation plan generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationRequest {
    pub request_id: String,
    pub issues: Vec<SecurityIssue>,
    pub system_context: SystemContext,
    pub compliance_requirements: Vec<String>,
    pub urgency_level: String,
}

/// Security issue requiring remediation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityIssue {
    pub id: String,
    pub title: String,
    pub description: String,
    pub severity: String,
    pub category: String,
    pub affected_systems: Vec<String>,
    pub compliance_impact: String,
    pub discovered_at: chrono::DateTime<chrono::Utc>,
}

/// System context for remediation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemContext {
    pub platform: String,
    pub os: String,
    pub environment: String,
    pub compliance_framework: String,
    pub critical_systems: Vec<String>,
}

/// Generated remediation plan.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationPlan {
    pub id: String,
    pub title: String,
    pub description: String,
    pub actions: Vec<RemediationAction>,
    pub system_context: String,
    pub estimated_total_duration: String,
    pub overall_risk: RiskLevel,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub generation_time_ms: u64,
}

/// Individual remediation action.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationAction {
    pub id: String,
    pub title: String,
    pub description: String,
    pub action_type: ActionType,
    pub priority: Priority,
    pub estimated_duration: String,
    pub dependencies: Vec<String>,
    pub commands: Vec<String>,
    pub verification_steps: Vec<String>,
    pub rollback_steps: Vec<String>,
    pub risk_level: RiskLevel,
    pub prerequisites: Vec<String>,
}

/// Type of remediation action.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActionType {
    Configuration,
    Patch,
    Service,
    Network,
    Access,
    Monitoring,
    Policy,
}

/// Priority level for actions.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Priority {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

impl std::fmt::Display for Priority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

/// Issue-specific remediation details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueRemediation {
    pub issue_id: String,
    pub immediate_actions: Vec<String>,
    pub detailed_steps: Vec<String>,
    pub verification_commands: Vec<String>,
    pub rollback_procedure: Vec<String>,
    pub estimated_time: String,
    pub risk_assessment: String,
}

/// Validation result for remediation plan.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationValidation {
    pub plan_id: String,
    pub is_valid: bool,
    pub safety_concerns: Vec<String>,
    pub missing_dependencies: Vec<String>,
    pub recommendations: Vec<String>,
    pub validation_timestamp: chrono::DateTime<chrono::Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_remediation_request() {
        let request = RemediationRequest {
            request_id: "req-1".to_string(),
            issues: vec![],
            system_context: SystemContext {
                platform: "Linux".to_string(),
                os: "Ubuntu 20.04".to_string(),
                environment: "Production".to_string(),
                compliance_framework: "ISO 27001".to_string(),
                critical_systems: vec!["Database".to_string()],
            },
            compliance_requirements: vec!["A.9.1.1".to_string()],
            urgency_level: "High".to_string(),
        };

        assert_eq!(request.request_id, "req-1");
        assert_eq!(request.system_context.platform, "Linux");
    }

    #[test]
    fn test_remediation_action() {
        let action = RemediationAction {
            id: "action-1".to_string(),
            title: "Update Configuration".to_string(),
            description: "Update security configuration".to_string(),
            action_type: ActionType::Configuration,
            priority: Priority::High,
            estimated_duration: "30 minutes".to_string(),
            dependencies: vec![],
            commands: vec!["sudo config-update".to_string()],
            verification_steps: vec!["Check config".to_string()],
            rollback_steps: vec!["Restore backup".to_string()],
            risk_level: RiskLevel::Low,
            prerequisites: vec!["Backup".to_string()],
        };

        assert!(matches!(action.action_type, ActionType::Configuration));
        assert!(matches!(action.priority, Priority::High));
    }

    #[test]
    fn test_extract_json_block_valid() {
        let text = r#"Here is the plan: {"title": "Fix firewall", "actions": []} end."#;
        let block = extract_json_block(text).unwrap();
        assert!(block.starts_with('{'));
        assert!(block.ends_with('}'));
        assert!(block.contains("Fix firewall"));
    }

    #[test]
    fn test_extract_json_block_no_braces() {
        let text = "No JSON here, just plain text.";
        assert!(extract_json_block(text).is_none());
    }

    #[test]
    fn test_extract_json_block_only_open_brace() {
        let text = "Something { but no closing";
        assert!(extract_json_block(text).is_none());
    }

    #[test]
    fn test_parse_action_type_variants() {
        assert!(matches!(parse_action_type("configuration"), ActionType::Configuration));
        assert!(matches!(parse_action_type("Config"), ActionType::Configuration));
        assert!(matches!(parse_action_type("patch"), ActionType::Patch));
        assert!(matches!(parse_action_type("Update"), ActionType::Patch));
        assert!(matches!(parse_action_type("service"), ActionType::Service));
        assert!(matches!(parse_action_type("network"), ActionType::Network));
        assert!(matches!(parse_action_type("Firewall"), ActionType::Network));
        assert!(matches!(parse_action_type("access"), ActionType::Access));
        assert!(matches!(parse_action_type("IAM"), ActionType::Access));
        assert!(matches!(parse_action_type("monitoring"), ActionType::Monitoring));
        assert!(matches!(parse_action_type("policy"), ActionType::Policy));
        assert!(matches!(parse_action_type("unknown_thing"), ActionType::Configuration));
    }

    #[test]
    fn test_parse_priority_variants() {
        assert_eq!(parse_priority("critical"), Priority::Critical);
        assert_eq!(parse_priority("High"), Priority::High);
        assert_eq!(parse_priority("medium"), Priority::Medium);
        assert_eq!(parse_priority("Low"), Priority::Low);
        assert_eq!(parse_priority("info"), Priority::Info);
        assert_eq!(parse_priority("informational"), Priority::Info);
        assert_eq!(parse_priority("garbage"), Priority::Medium);
    }

    #[test]
    fn test_parse_risk_level_variants() {
        assert!(matches!(parse_risk_level("low"), RiskLevel::Low));
        assert!(matches!(parse_risk_level("medium"), RiskLevel::Medium));
        assert!(matches!(parse_risk_level("moderate"), RiskLevel::Medium));
        assert!(matches!(parse_risk_level("high"), RiskLevel::High));
        assert!(matches!(parse_risk_level("critical"), RiskLevel::Critical));
        assert!(matches!(parse_risk_level("severe"), RiskLevel::Critical));
        assert!(matches!(parse_risk_level("xyz"), RiskLevel::Medium));
    }

    #[test]
    fn test_parse_remediation_plan_from_json() {
        let json = r#"{
            "title": "Security Hardening Plan",
            "description": "Plan to harden the server",
            "actions": [
                {
                    "id": "a1",
                    "title": "Disable root SSH",
                    "description": "Disable root login via SSH",
                    "action_type": "configuration",
                    "priority": "critical",
                    "estimated_duration": "15 minutes",
                    "commands": ["sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config", "systemctl restart sshd"],
                    "verification_steps": ["ssh root@host should be denied"],
                    "rollback_steps": ["Re-enable PermitRootLogin yes"],
                    "risk_level": "low",
                    "prerequisites": ["Ensure non-root admin account exists"]
                }
            ],
            "estimated_total_duration": "1 hour",
            "overall_risk": "low"
        }"#;

        let raw: RawRemediationPlan = serde_json::from_str(json).unwrap();
        assert_eq!(raw.title.as_deref(), Some("Security Hardening Plan"));
        assert_eq!(raw.actions.len(), 1);
        assert_eq!(raw.actions[0].commands.len(), 2);
    }

    #[test]
    fn test_parse_issue_remediation_from_json() {
        let json = r#"{
            "immediate_actions": ["Block suspicious IP"],
            "detailed_steps": ["Step 1: Isolate", "Step 2: Patch"],
            "verification_commands": ["nmap -sV host"],
            "rollback_procedure": ["Revert firewall rule"],
            "estimated_time": "2 hours",
            "risk_assessment": "Medium risk"
        }"#;

        let raw: RawIssueRemediation = serde_json::from_str(json).unwrap();
        assert_eq!(raw.immediate_actions.len(), 1);
        assert_eq!(raw.detailed_steps.len(), 2);
        assert_eq!(raw.estimated_time.as_deref(), Some("2 hours"));
    }

    #[test]
    fn test_parse_validation_from_json() {
        let json = r#"{
            "is_valid": false,
            "safety_concerns": ["May disrupt active connections"],
            "missing_dependencies": ["Backup not configured"],
            "recommendations": ["Schedule during maintenance window"]
        }"#;

        let raw: RawRemediationValidation = serde_json::from_str(json).unwrap();
        assert_eq!(raw.is_valid, Some(false));
        assert_eq!(raw.safety_concerns.len(), 1);
        assert_eq!(raw.missing_dependencies.len(), 1);
    }

    #[test]
    fn test_partial_json_still_deserializes() {
        // Only some fields present — serde(default) should fill in the rest
        let json = r#"{"title": "Partial Plan"}"#;
        let raw: RawRemediationPlan = serde_json::from_str(json).unwrap();
        assert_eq!(raw.title.as_deref(), Some("Partial Plan"));
        assert!(raw.actions.is_empty());
        assert!(raw.overall_risk.is_none());
    }

    #[test]
    fn test_extract_json_block_with_markdown_fences() {
        let text = "Here is the response:\n```json\n{\"is_valid\": true, \"recommendations\": [\"All good\"]}\n```\nDone.";
        let block = extract_json_block(text).unwrap();
        let raw: RawRemediationValidation = serde_json::from_str(block).unwrap();
        assert_eq!(raw.is_valid, Some(true));
        assert_eq!(raw.recommendations.len(), 1);
    }
}
