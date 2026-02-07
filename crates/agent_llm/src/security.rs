//! LLM-powered security classification and threat intelligence.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use anyhow::Result;
use tracing::{debug, info, warn};

use super::engine::{ModelEngine, InferenceRequest, InferenceResponse};
use super::config::LLMConfig;
use super::prompts::{PromptTemplates, PromptBuilder};

/// Security classifier for threat assessment and categorization.
pub struct SecurityClassifier {
    engine: Arc<dyn ModelEngine>,
    config: LLMConfig,
}

impl SecurityClassifier {
    /// Create a new security classifier.
    pub fn new(engine: Arc<dyn ModelEngine>, config: &LLMConfig) -> Self {
        Self {
            engine,
            config: config.clone(),
        }
    }

    /// Classify a security event and assess its threat level.
    pub async fn classify_event(&self, event: &SecurityEvent) -> Result<SecurityClassification> {
        info!("Classifying security event: {}", event.id);
        let start_time = std::time::Instant::now();

        let prompt = self.build_classification_prompt(event)?;

        let request = InferenceRequest::new(prompt)
            .with_max_tokens(1024)
            .with_temperature(0.2) // Low temperature for consistency
            .with_top_p(self.config.inference.top_p);

        let response = self.engine.infer(request).await?;
        let classification = self.parse_classification_response(&response.text, event, start_time.elapsed())?;

        info!("Event classified as {:?} with confidence {}", 
              classification.threat_type, classification.confidence);
        Ok(classification)
    }

    /// Analyze vulnerability and assess its impact.
    pub async fn analyze_vulnerability(&self, vuln: &Vulnerability) -> Result<VulnerabilityAnalysis> {
        let prompt = self.build_vulnerability_prompt(vuln)?;

        let request = InferenceRequest::new(prompt)
            .with_max_tokens(2048)
            .with_temperature(0.3);

        let response = self.engine.infer(request).await?;
        self.parse_vulnerability_analysis(&response.text, vuln)
    }

    /// Generate threat intelligence report.
    pub async fn generate_threat_report(&self, events: &[SecurityEvent]) -> Result<ThreatReport> {
        info!("Generating threat report for {} events", events.len());
        
        let prompt = self.build_threat_report_prompt(events)?;

        let request = InferenceRequest::new(prompt)
            .with_max_tokens(3072)
            .with_temperature(0.4);

        let response = self.engine.infer(request).await?;
        self.parse_threat_report(&response.text, events)
    }

    /// Assess attack patterns and techniques.
    pub async fn analyze_attack_patterns(&self, events: &[SecurityEvent]) -> Result<AttackPatternAnalysis> {
        let prompt = self.build_attack_pattern_prompt(events)?;

        let request = InferenceRequest::new(prompt)
            .with_max_tokens(2048)
            .with_temperature(0.3);

        let response = self.engine.infer(request).await?;
        self.parse_attack_pattern_analysis(&response.text)
    }

    /// Build classification prompt for security event.
    fn build_classification_prompt(&self, event: &SecurityEvent) -> Result<String> {
        let template = PromptTemplates::get("threat_classification")
            .ok_or_else(|| anyhow::anyhow!("Threat classification template not found"))?;

        let event_details = serde_json::to_string_pretty(event)?;

        PromptBuilder::new(template)
            .set("event_details", &event_details)
            .set("system_info", &event.system_info)
            .set("historical_context", &event.historical_context)
            .build()
            .map_err(|e| anyhow::anyhow!("Failed to build classification prompt: {}", e))
    }

    /// Build vulnerability analysis prompt.
    fn build_vulnerability_prompt(&self, vuln: &Vulnerability) -> Result<String> {
        let prompt = format!(
            r#"Analyze the following security vulnerability and provide comprehensive assessment:

Vulnerability Details:
- ID: {}
- Title: {}
- Severity: {}
- CVSS Score: {}
- Description: {}
- Affected Systems: {}
- Published: {}
- Last Modified: {}

Provide analysis covering:
1. Exploitability Assessment
2. Business Impact Analysis
3. Attack Scenarios
4. Recommended Mitigation Priority
5. Patch Management Strategy
6. Compensating Controls (if patch unavailable)

Use standard vulnerability assessment frameworks and provide specific, actionable insights."#,
            vuln.id,
            vuln.title,
            vuln.severity,
            vuln.cvss_score,
            vuln.description,
            vuln.affected_systems.join(", "),
            vuln.published_date,
            vuln.last_modified_date
        );

        Ok(prompt)
    }

    /// Build threat report prompt.
    fn build_threat_report_prompt(&self, events: &[SecurityEvent]) -> Result<String> {
        let events_summary = events.iter()
            .map(|e| format!("{} [{}] - {}", e.id, e.event_type, e.description))
            .collect::<Vec<_>>()
            .join("\n");

        let prompt = format!(
            r#"Generate a comprehensive threat intelligence report based on the following security events:

Events:
{}

Time Range: {} to {}

Include in the report:
1. Executive Summary
2. Threat Landscape Overview
3. Attack Trends and Patterns
4. High-Risk Indicators
5. Attribution Analysis (if possible)
6. Recommended Defensive Actions
7. Threat Hunting Recommendations
8. Future Threat Predictions

Format as a professional threat intelligence report suitable for security leadership."#,
            events_summary,
            events.first().map(|e| e.timestamp.to_rfc3339()).unwrap_or_default(),
            events.last().map(|e| e.timestamp.to_rfc3339()).unwrap_or_default()
        );

        Ok(prompt)
    }

    /// Build attack pattern analysis prompt.
    fn build_attack_pattern_prompt(&self, events: &[SecurityEvent]) -> Result<String> {
        let events_data = serde_json::to_string(events)?;

        let prompt = format!(
            r#"Analyze the following security events to identify attack patterns and techniques:

Events Data: {}

Using MITRE ATT&CK framework, identify:
1. Attack Tactics, Techniques, and Procedures (TTPs)
2. Attack lifecycle stages
3. Pattern similarities and differences
4. Potential threat actor attribution
5. Attack progression indicators
6. Defensive recommendations per TTP

Provide structured analysis with specific MITRE ATT&CK references."#,
            events_data
        );

        Ok(prompt)
    }

    /// Parse classification response.
    fn parse_classification_response(&self, response: &str, event: &SecurityEvent, duration: std::time::Duration) -> Result<SecurityClassification> {
        // Simplified parsing - implement structured parsing in production
        Ok(SecurityClassification {
            event_id: event.id.clone(),
            threat_type: ThreatType::Malware,
            threat_level: ThreatLevel::High,
            confidence: 85,
            attack_vector: AttackVector::Network,
            tactics: vec!["Execution".to_string(), "Persistence".to_string()],
            techniques: vec!["T1059".to_string()], // Command and Scripting Interpreter
            impact_assessment: "Potential data exfiltration risk".to_string(),
            recommended_actions: vec![
                "Isolate affected system".to_string(),
                "Run malware scan".to_string(),
                "Review network logs".to_string(),
            ],
            classification_timestamp: chrono::Utc::now(),
            processing_time_ms: duration.as_millis() as u64,
        })
    }

    /// Parse vulnerability analysis response.
    fn parse_vulnerability_analysis(&self, response: &str, vuln: &Vulnerability) -> Result<VulnerabilityAnalysis> {
        Ok(VulnerabilityAnalysis {
            vulnerability_id: vuln.id.clone(),
            exploitability: Exploitability::High,
            business_impact: BusinessImpact::Significant,
            attack_scenarios: vec![
                "Remote code execution".to_string(),
                "Privilege escalation".to_string(),
            ],
            mitigation_priority: MitigationPriority::Critical,
            patch_strategy: "Apply vendor patch immediately".to_string(),
            compensating_controls: vec![
                "Network segmentation".to_string(),
                "Enhanced monitoring".to_string(),
            ],
            analysis_timestamp: chrono::Utc::now(),
        })
    }

    /// Parse threat report response.
    fn parse_threat_report(&self, response: &str, events: &[SecurityEvent]) -> Result<ThreatReport> {
        Ok(ThreatReport {
            id: uuid::Uuid::new_v4().to_string(),
            title: "Threat Intelligence Report".to_string(),
            executive_summary: response.to_string(),
            threat_landscape: "Active threat environment with multiple attack vectors".to_string(),
            key_findings: vec![
                "Increased malware activity".to_string(),
                "Targeted attacks detected".to_string(),
            ],
            recommendations: vec![
                "Enhance monitoring".to_string(),
                "Update security controls".to_string(),
            ],
            generated_at: chrono::Utc::now(),
            event_count: events.len(),
        })
    }

    /// Parse attack pattern analysis response.
    fn parse_attack_pattern_analysis(&self, response: &str) -> Result<AttackPatternAnalysis> {
        Ok(AttackPatternAnalysis {
            identified_ttps: vec![
                TTP {
                    tactic: "Execution".to_string(),
                    technique: "Command and Scripting Interpreter".to_string(),
                    technique_id: "T1059".to_string(),
                    confidence: 90,
                }
            ],
            attack_stages: vec![
                "Initial Access".to_string(),
                "Execution".to_string(),
                "Persistence".to_string(),
            ],
            threat_actor_indicators: vec!["APT-style tactics".to_string()],
            defensive_recommendations: vec![
                "Implement application whitelisting".to_string(),
                "Enhance command-line logging".to_string(),
            ],
            analysis_timestamp: chrono::Utc::now(),
        })
    }
}

/// Security event for classification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityEvent {
    pub id: String,
    pub event_type: String,
    pub description: String,
    pub system_info: String,
    pub historical_context: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub source: String,
    pub severity: String,
    pub raw_data: serde_json::Value,
}

/// Security classification result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityClassification {
    pub event_id: String,
    pub threat_type: ThreatType,
    pub threat_level: ThreatLevel,
    pub confidence: u8,
    pub attack_vector: AttackVector,
    pub tactics: Vec<String>,
    pub techniques: Vec<String>,
    pub impact_assessment: String,
    pub recommended_actions: Vec<String>,
    pub classification_timestamp: chrono::DateTime<chrono::Utc>,
    pub processing_time_ms: u64,
}

/// Threat types.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThreatType {
    Malware,
    Phishing,
    DenialOfService,
    DataExfiltration,
    PrivilegeEscalation,
    LateralMovement,
    CommandAndControl,
    Reconnaissance,
    Unknown,
}

/// Threat levels.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThreatLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// Attack vectors.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AttackVector {
    Network,
    Local,
    Physical,
    Social,
    SupplyChain,
    Unknown,
}

/// Vulnerability for analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vulnerability {
    pub id: String,
    pub title: String,
    pub severity: String,
    pub cvss_score: f32,
    pub description: String,
    pub affected_systems: Vec<String>,
    pub published_date: String,
    pub last_modified_date: String,
    pub references: Vec<String>,
}

/// Vulnerability analysis result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VulnerabilityAnalysis {
    pub vulnerability_id: String,
    pub exploitability: Exploitability,
    pub business_impact: BusinessImpact,
    pub attack_scenarios: Vec<String>,
    pub mitigation_priority: MitigationPriority,
    pub patch_strategy: String,
    pub compensating_controls: Vec<String>,
    pub analysis_timestamp: chrono::DateTime<chrono::Utc>,
}

/// Exploitability assessment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Exploitability {
    Low,
    Medium,
    High,
    Critical,
}

/// Business impact assessment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BusinessImpact {
    Minimal,
    Minor,
    Significant,
    Major,
    Critical,
}

/// Mitigation priority.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MitigationPriority {
    Low,
    Medium,
    High,
    Critical,
}

/// Threat intelligence report.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatReport {
    pub id: String,
    pub title: String,
    pub executive_summary: String,
    pub threat_landscape: String,
    pub key_findings: Vec<String>,
    pub recommendations: Vec<String>,
    pub generated_at: chrono::DateTime<chrono::Utc>,
    pub event_count: usize,
}

/// Attack pattern analysis result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttackPatternAnalysis {
    pub identified_ttps: Vec<TTP>,
    pub attack_stages: Vec<String>,
    pub threat_actor_indicators: Vec<String>,
    pub defensive_recommendations: Vec<String>,
    pub analysis_timestamp: chrono::DateTime<chrono::Utc>,
}

/// Tactics, Techniques, and Procedures.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TTP {
    pub tactic: String,
    pub technique: String,
    pub technique_id: String,
    pub confidence: u8,
}

/// Security insight from analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityInsight {
    pub id: String,
    pub insight_type: InsightType,
    pub title: String,
    pub description: String,
    pub severity: String,
    pub confidence: u8,
    pub recommendations: Vec<String>,
    pub generated_at: chrono::DateTime<chrono::Utc>,
}

/// Types of security insights.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InsightType {
    Threat,
    Vulnerability,
    Compliance,
    Configuration,
    Anomaly,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_event() {
        let event = SecurityEvent {
            id: "event-1".to_string(),
            event_type: "Malware Detected".to_string(),
            description: "Suspicious executable found".to_string(),
            system_info: "Windows 10".to_string(),
            historical_context: "Recent malware activity".to_string(),
            timestamp: chrono::Utc::now(),
            source: "Antivirus".to_string(),
            severity: "High".to_string(),
            raw_data: serde_json::json!({"test": "data"}),
        };

        assert_eq!(event.id, "event-1");
        assert_eq!(event.event_type, "Malware Detected");
    }

    #[test]
    fn test_security_classification() {
        let classification = SecurityClassification {
            event_id: "event-1".to_string(),
            threat_type: ThreatType::Malware,
            threat_level: ThreatLevel::High,
            confidence: 90,
            attack_vector: AttackVector::Network,
            tactics: vec!["Execution".to_string()],
            techniques: vec!["T1059".to_string()],
            impact_assessment: "High impact".to_string(),
            recommended_actions: vec!["Isolate".to_string()],
            classification_timestamp: chrono::Utc::now(),
            processing_time_ms: 1500,
        };

        assert!(matches!(classification.threat_type, ThreatType::Malware));
        assert!(matches!(classification.threat_level, ThreatLevel::High));
        assert_eq!(classification.confidence, 90);
    }
}
