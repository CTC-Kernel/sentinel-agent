//! Prompt templates and builders for different LLM use cases.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Base prompt template.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptTemplate {
    /// Template name
    pub name: String,
    /// Template content with placeholders
    pub template: String,
    /// Variable descriptions
    pub variables: HashMap<String, String>,
    /// System prompt (if any)
    pub system_prompt: Option<String>,
}

impl PromptTemplate {
    /// Create a new prompt template.
    pub fn new(name: impl Into<String>, template: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            template: template.into(),
            variables: HashMap::new(),
            system_prompt: None,
        }
    }

    /// Add a variable description.
    pub fn variable(mut self, name: impl Into<String>, description: impl Into<String>) -> Self {
        self.variables.insert(name.into(), description.into());
        self
    }

    /// Set system prompt.
    pub fn system_prompt(mut self, prompt: impl Into<String>) -> Self {
        self.system_prompt = Some(prompt.into());
        self
    }

    /// Render the template with given variables.
    pub fn render(&self, variables: &HashMap<String, String>) -> String {
        let mut result = self.template.clone();
        
        for (key, value) in variables {
            let placeholder = format!("{{{}}}", key);
            result = result.replace(&placeholder, value);
        }

        // Remove any unreplaced placeholders
        result = regex::Regex::new(r"\{[^}]*\}")
            .expect("valid regex literal")
            .replace_all(&result, "")
            .to_string();

        result
    }

    /// Get full prompt including system prompt if present.
    pub fn full_prompt(&self, variables: &HashMap<String, String>) -> String {
        let rendered = self.render(variables);
        
        match &self.system_prompt {
            Some(system) => format!("{}\n\n{}", system, rendered),
            None => rendered,
        }
    }
}

/// Builder for creating prompts.
pub struct PromptBuilder {
    template: PromptTemplate,
    variables: HashMap<String, String>,
}

impl PromptBuilder {
    /// Create a new prompt builder from template.
    pub fn new(template: PromptTemplate) -> Self {
        Self {
            template,
            variables: HashMap::new(),
        }
    }

    /// Set a variable value.
    pub fn set(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.variables.insert(key.into(), value.into());
        self
    }

    /// Set multiple variables.
    pub fn set_all<I, K, V>(mut self, vars: I) -> Self 
    where
        I: IntoIterator<Item = (K, V)>,
        K: Into<String>,
        V: Into<String>,
    {
        for (k, v) in vars {
            self.variables.insert(k.into(), v.into());
        }
        self
    }

    /// Build the final prompt.
    pub fn build(self) -> String {
        self.template.full_prompt(&self.variables)
    }
}

/// Security-focused prompt builder.
pub struct SecurityPromptBuilder {
    builder: PromptBuilder,
}

impl SecurityPromptBuilder {
    /// Create a new security prompt builder.
    pub fn new(template: PromptTemplate) -> Self {
        Self {
            builder: PromptBuilder::new(template),
        }
    }

    /// Set security context.
    pub fn security_context(mut self, context: &SecurityContext) -> Self {
        self.builder = self.builder
            .set("system_info", &context.system_info)
            .set("threat_level", context.threat_level.to_string())
            .set("compliance_framework", &context.compliance_framework)
            .set("asset_type", &context.asset_type);
        self
    }

    /// Set scan results.
    pub fn scan_results(mut self, results: &ScanResults) -> Self {
        self.builder = self.builder
            .set("scan_summary", &results.summary)
            .set("failed_checks", &results.failed_checks)
            .set("security_findings", &results.security_findings)
            .set("compliance_score", results.compliance_score.to_string());
        self
    }

    /// Build the security prompt.
    pub fn build(self) -> String {
        self.builder.build()
    }
}

/// Security context for prompts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityContext {
    pub system_info: String,
    pub threat_level: ThreatLevel,
    pub compliance_framework: String,
    pub asset_type: String,
}

/// Threat level enumeration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThreatLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl std::fmt::Display for ThreatLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ThreatLevel::Low => write!(f, "Low"),
            ThreatLevel::Medium => write!(f, "Medium"),
            ThreatLevel::High => write!(f, "High"),
            ThreatLevel::Critical => write!(f, "Critical"),
        }
    }
}

/// Scan results for prompts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResults {
    pub summary: String,
    pub failed_checks: String,
    pub security_findings: String,
    pub compliance_score: f32,
}

/// Predefined prompt templates.
pub struct PromptTemplates;

impl PromptTemplates {
    /// Get all predefined templates.
    pub fn get_all() -> HashMap<String, PromptTemplate> {
        let mut templates = HashMap::new();

        // Security analysis template
        templates.insert("security_analysis".to_string(), PromptTemplate::new(
            "security_analysis",
            r#"Analyze the following security scan results and provide a comprehensive assessment.

System Information:
- System: {system_info}
- Threat Level: {threat_level}
- Compliance Framework: {compliance_framework}
- Asset Type: {asset_type}

Scan Results:
{scan_summary}

Failed Checks:
{failed_checks}

Security Findings:
{security_findings}

Compliance Score: {compliance_score}/100

Please provide:
1. Risk Assessment: What are the primary security risks?
2. Priority Issues: Which issues need immediate attention?
3. Compliance Impact: How do these findings affect compliance?
4. Recommendations: What specific actions should be taken?

Respond in a structured, actionable format suitable for security professionals."#
        )
        .variable("system_info", "Information about the scanned system")
        .variable("threat_level", "Current threat level assessment")
        .variable("compliance_framework", "Applicable compliance framework")
        .variable("asset_type", "Type of asset being scanned")
        .variable("scan_summary", "Summary of scan results")
        .variable("failed_checks", "List of failed compliance checks")
        .variable("security_findings", "Security-specific findings")
        .variable("compliance_score", "Overall compliance score")
        .system_prompt("You are a senior security analyst with expertise in compliance frameworks and threat assessment. Provide clear, actionable security recommendations."));

        // Remediation template
        templates.insert("remediation".to_string(), PromptTemplate::new(
            "remediation",
            r#"Based on the following security issues, provide detailed remediation steps.

Issues to Address:
{issues}

System Context:
{system_context}

Compliance Requirements:
{compliance_requirements}

For each issue, provide:
1. Immediate Action: What should be done right now
2. Long-term Fix: Permanent solution
3. Verification: How to confirm the fix works
4. Rollback Plan: How to undo if needed
5. Priority: Urgent/High/Medium/Low
6. Estimated Time: Time to complete

Format your response as a step-by-step remediation plan."#
        )
        .variable("issues", "Security issues to remediate")
        .variable("system_context", "Context about the affected system")
        .variable("compliance_requirements", "Relevant compliance requirements")
        .system_prompt("You are a cybersecurity incident response specialist. Provide practical, step-by-step remediation guidance."));

        // Code analysis template
        templates.insert("code_analysis".to_string(), PromptTemplate::new(
            "code_analysis",
            r#"Analyze the following code for security vulnerabilities and compliance issues.

Code Context:
{code_context}

Code to Analyze:
{code}

Review Criteria:
- Security vulnerabilities
- Compliance with {compliance_standard}
- Best practices adherence
- Potential improvements

Provide:
1. Vulnerability Assessment: List any security issues found
2. Compliance Status: How does this code comply with standards?
3. Recommendations: Specific improvements needed
4. Risk Level: Overall risk assessment

Be specific and provide line numbers where applicable."#
        )
        .variable("code_context", "Context about the code being analyzed")
        .variable("code", "The actual code to analyze")
        .variable("compliance_standard", "Applicable compliance standard")
        .system_prompt("You are a security code reviewer with deep expertise in secure coding practices and compliance standards."));

        // Threat classification template
        templates.insert("threat_classification".to_string(), PromptTemplate::new(
            "threat_classification",
            r#"Classify the following security event and assess its severity.

Event Details:
{event_details}

System Information:
{system_info}

Historical Context:
{historical_context}

Provide:
1. Threat Type: What type of threat is this?
2. Severity Level: Critical/High/Medium/Low
3. Impact Assessment: What systems/data are affected?
4. Likelihood: Probability of successful exploitation
5. Recommended Response: Immediate actions needed

Use standard threat classification frameworks (MITRE ATT&CK, CVSS, etc.)."#
        )
        .variable("event_details", "Details of the security event")
        .variable("system_info", "Information about affected systems")
        .variable("historical_context", "Historical threat intelligence")
        .system_prompt("You are a threat intelligence analyst specializing in security event classification and risk assessment."));

        templates
    }

    /// Get a specific template by name.
    pub fn get(name: &str) -> Option<PromptTemplate> {
        Self::get_all().get(name).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prompt_template() {
        let template = PromptTemplate::new("test", "Hello {name}, you are in {place}!")
            .variable("name", "Person's name")
            .variable("place", "Location");

        let mut vars = HashMap::new();
        vars.insert("name".to_string(), "Alice".to_string());
        vars.insert("place".to_string(), "Wonderland".to_string());

        let rendered = template.render(&vars);
        assert_eq!(rendered, "Hello Alice, you are in Wonderland!");
    }

    #[test]
    fn test_prompt_builder() {
        let template = PromptTemplate::new("test", "Value: {value}");
        let prompt = PromptBuilder::new(template)
            .set("value", "42")
            .build();

        assert_eq!(prompt, "Value: 42");
    }

    #[test]
    fn test_predefined_templates() {
        let templates = PromptTemplates::get_all();
        assert!(templates.contains_key("security_analysis"));
        assert!(templates.contains_key("remediation"));
        assert!(templates.contains_key("code_analysis"));
        assert!(templates.contains_key("threat_classification"));
    }

    #[test]
    fn test_security_prompt_builder() {
        let template = PromptTemplates::get("security_analysis").unwrap();
        let context = SecurityContext {
            system_info: "Linux Server".to_string(),
            threat_level: ThreatLevel::Medium,
            compliance_framework: "ISO 27001".to_string(),
            asset_type: "Server".to_string(),
        };

        let results = ScanResults {
            summary: "5 failed checks".to_string(),
            failed_checks: "Check A, Check B".to_string(),
            security_findings: "Vulnerability X".to_string(),
            compliance_score: 75.0,
        };

        let prompt = SecurityPromptBuilder::new(template)
            .security_context(&context)
            .scan_results(&results)
            .build();

        assert!(prompt.contains("Linux Server"));
        assert!(prompt.contains("Medium"));
        assert!(prompt.contains("ISO 27001"));
    }
}
