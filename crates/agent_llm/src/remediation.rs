//! LLM-powered remediation recommendations and guidance.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use anyhow::Result;
use tracing::info;

use super::engine::{ModelEngine, InferenceRequest};
use super::config::LLMConfig;
use super::prompts::{PromptTemplates, PromptBuilder};
pub use crate::analyzer::RiskLevel;

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
        let prompt = self.build_remediation_prompt(&request)?;

        // Create inference request
        let inference_request = InferenceRequest::new(prompt)
            .with_max_tokens(self.config.inference.max_tokens)
            .with_temperature(0.3) // Lower temperature for technical accuracy
            .with_top_p(self.config.inference.top_p);

        // Perform inference
        let response = self.engine.infer(inference_request).await?;

        // Parse the response
        let plan = self.parse_remediation_response(&response.text, &request, start_time.elapsed())?;

        info!("Remediation plan generated with {} actions", plan.actions.len());
        Ok(plan)
    }

    /// Get specific remediation steps for a single issue.
    pub async fn get_issue_remediation(&self, issue: &SecurityIssue) -> Result<IssueRemediation> {
        let prompt = self.build_issue_remediation_prompt(issue)?;

        let request = InferenceRequest::new(prompt)
            .with_max_tokens(1024)
            .with_temperature(0.2);

        let response = self.engine.infer(request).await?;
        self.parse_issue_remediation(&response.text, issue)
    }

    /// Validate remediation steps before execution.
    pub async fn validate_remediation(&self, plan: &RemediationPlan) -> Result<RemediationValidation> {
        let prompt = self.build_validation_prompt(plan)?;

        let request = InferenceRequest::new(prompt)
            .with_max_tokens(512)
            .with_temperature(0.1);

        let response = self.engine.infer(request).await?;
        self.parse_validation_response(&response.text, plan)
    }

    /// Build remediation prompt from request.
    fn build_remediation_prompt(&self, request: &RemediationRequest) -> Result<String> {
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
            .build())
    }

    /// Build issue-specific remediation prompt.
    fn build_issue_remediation_prompt(&self, issue: &SecurityIssue) -> Result<String> {
        let prompt = format!(
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

Be specific and include actual commands where applicable."#,
            issue.title,
            issue.severity,
            issue.category,
            issue.description,
            issue.affected_systems.join(", "),
            issue.compliance_impact
        );

        Ok(prompt)
    }

    /// Build validation prompt for remediation plan.
    fn build_validation_prompt(&self, plan: &RemediationPlan) -> Result<String> {
        let actions_text = plan.actions.iter()
            .map(|action| format!("{} [{}]: {}", 
                action.title, 
                action.priority, 
                action.description))
            .collect::<Vec<_>>()
            .join("\n");

        let prompt = format!(
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

Provide validation status and any concerns."#,
            actions_text,
            plan.system_context
        );

        Ok(prompt)
    }

    /// Parse remediation response from LLM.
    fn parse_remediation_response(&self, _response: &str, request: &RemediationRequest, duration: std::time::Duration) -> Result<RemediationPlan> {
        // TODO(llm): parse structured JSON response from LLM
        let plan = RemediationPlan {
            id: uuid::Uuid::new_v4().to_string(),
            title: format!("Remediation Plan for {}", request.request_id),
            description: "Automatically generated remediation plan".to_string(),
            actions: vec![
                RemediationAction {
                    id: "action-1".to_string(),
                    title: "Update Security Configuration".to_string(),
                    description: "Modify security settings to meet compliance requirements".to_string(),
                    action_type: ActionType::Configuration,
                    priority: Priority::High,
                    estimated_duration: "30 minutes".to_string(),
                    dependencies: vec![],
                    commands: vec!["sudo systemctl update-security".to_string()],
                    verification_steps: vec!["Verify configuration applied".to_string()],
                    rollback_steps: vec!["Restore backup configuration".to_string()],
                    risk_level: RiskLevel::Low,
                    prerequisites: vec!["System backup".to_string()],
                }
            ],
            system_context: format!("{:?}", request.system_context),
            estimated_total_duration: "2 hours".to_string(),
            overall_risk: RiskLevel::Medium,
            created_at: chrono::Utc::now(),
            generation_time_ms: duration.as_millis() as u64,
        };

        Ok(plan)
    }

    /// Parse issue-specific remediation response.
    fn parse_issue_remediation(&self, _response: &str, issue: &SecurityIssue) -> Result<IssueRemediation> {
        Ok(IssueRemediation {
            issue_id: issue.id.clone(),
            immediate_actions: vec!["Isolate affected system".to_string()],
            detailed_steps: vec![
                "1. Backup current configuration".to_string(),
                "2. Apply security patches".to_string(),
                "3. Update configuration files".to_string(),
                "4. Restart services".to_string(),
            ],
            verification_commands: vec!["sudo systemctl status".to_string()],
            rollback_procedure: vec!["Restore from backup".to_string()],
            estimated_time: "45 minutes".to_string(),
            risk_assessment: "Low risk with proper backup".to_string(),
        })
    }

    /// Parse validation response.
    fn parse_validation_response(&self, _response: &str, plan: &RemediationPlan) -> Result<RemediationValidation> {
        Ok(RemediationValidation {
            plan_id: plan.id.clone(),
            is_valid: true,
            safety_concerns: vec![],
            missing_dependencies: vec![],
            recommendations: vec!["Create system backup before proceeding".to_string()],
            validation_timestamp: chrono::Utc::now(),
        })
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
}
