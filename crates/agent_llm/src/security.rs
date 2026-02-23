//! LLM-powered security classification and threat intelligence.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use anyhow::Result;
use tracing::{info, warn};

use super::engine::{ModelEngine, InferenceRequest};
use super::config::LLMConfig;
use super::prompts::{PromptTemplates, PromptBuilder};
pub use crate::prompts::ThreatLevel;
use crate::utils::extract_json_block;

// ---------------------------------------------------------------------------
// Intermediate serde structs for lenient JSON parsing (all fields optional/defaulted)
// ---------------------------------------------------------------------------

/// Intermediate struct for parsing SecurityClassification from LLM JSON.
#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct RawClassification {
    threat_type: Option<String>,
    threat_level: Option<String>,
    confidence: Option<u8>,
    attack_vector: Option<String>,
    tactics: Vec<String>,
    techniques: Vec<String>,
    impact_assessment: Option<String>,
    recommended_actions: Vec<String>,
}

/// Intermediate struct for parsing VulnerabilityAnalysis from LLM JSON.
#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct RawVulnerabilityAnalysis {
    exploitability: Option<String>,
    business_impact: Option<String>,
    attack_scenarios: Vec<String>,
    mitigation_priority: Option<String>,
    patch_strategy: Option<String>,
    compensating_controls: Vec<String>,
}

/// Intermediate struct for parsing ThreatReport from LLM JSON.
#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct RawThreatReport {
    title: Option<String>,
    executive_summary: Option<String>,
    threat_landscape: Option<String>,
    key_findings: Vec<String>,
    recommendations: Vec<String>,
}

/// Intermediate struct for parsing a single TTP from LLM JSON.
#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct RawTTP {
    tactic: Option<String>,
    technique: Option<String>,
    technique_id: Option<String>,
    confidence: Option<u8>,
}

/// Intermediate struct for parsing AttackPatternAnalysis from LLM JSON.
#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct RawAttackPatternAnalysis {
    identified_ttps: Vec<RawTTP>,
    attack_stages: Vec<String>,
    threat_actor_indicators: Vec<String>,
    defensive_recommendations: Vec<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Parse a string into a `ThreatType`, case-insensitive.
fn parse_threat_type(s: &str) -> ThreatType {
    match s.to_lowercase().replace([' ', '_', '-'], "").as_str() {
        "malware" => ThreatType::Malware,
        "phishing" => ThreatType::Phishing,
        "denialofservice" | "dos" | "ddos" => ThreatType::DenialOfService,
        "dataexfiltration" | "exfiltration" => ThreatType::DataExfiltration,
        "privilegeescalation" | "privesc" => ThreatType::PrivilegeEscalation,
        "lateralmovement" => ThreatType::LateralMovement,
        "commandandcontrol" | "c2" | "cnc" => ThreatType::CommandAndControl,
        "reconnaissance" | "recon" => ThreatType::Reconnaissance,
        _ => ThreatType::Unknown,
    }
}

/// Parse a string into a `ThreatLevel`, case-insensitive.
fn parse_threat_level(s: &str) -> ThreatLevel {
    match s.to_lowercase().as_str() {
        "low" => ThreatLevel::Low,
        "medium" | "moderate" => ThreatLevel::Medium,
        "high" => ThreatLevel::High,
        "critical" | "severe" => ThreatLevel::Critical,
        _ => ThreatLevel::Medium,
    }
}

/// Parse a string into an `AttackVector`, case-insensitive.
fn parse_attack_vector(s: &str) -> AttackVector {
    match s.to_lowercase().replace([' ', '_', '-'], "").as_str() {
        "network" | "remote" => AttackVector::Network,
        "local" => AttackVector::Local,
        "physical" => AttackVector::Physical,
        "social" | "socialengineering" => AttackVector::Social,
        "supplychain" => AttackVector::SupplyChain,
        _ => AttackVector::Unknown,
    }
}

/// Parse a string into an `Exploitability`, case-insensitive.
fn parse_exploitability(s: &str) -> Exploitability {
    match s.to_lowercase().as_str() {
        "low" => Exploitability::Low,
        "medium" | "moderate" => Exploitability::Medium,
        "high" => Exploitability::High,
        "critical" => Exploitability::Critical,
        _ => Exploitability::Medium,
    }
}

/// Parse a string into a `BusinessImpact`, case-insensitive.
fn parse_business_impact(s: &str) -> BusinessImpact {
    match s.to_lowercase().as_str() {
        "minimal" | "negligible" => BusinessImpact::Minimal,
        "minor" | "low" => BusinessImpact::Minor,
        "significant" | "moderate" | "medium" => BusinessImpact::Significant,
        "major" | "high" => BusinessImpact::Major,
        "critical" | "severe" => BusinessImpact::Critical,
        _ => BusinessImpact::Significant,
    }
}

/// Parse a string into a `MitigationPriority`, case-insensitive.
fn parse_mitigation_priority(s: &str) -> MitigationPriority {
    match s.to_lowercase().as_str() {
        "low" => MitigationPriority::Low,
        "medium" | "moderate" => MitigationPriority::Medium,
        "high" => MitigationPriority::High,
        "critical" | "urgent" | "immediate" => MitigationPriority::Critical,
        _ => MitigationPriority::High,
    }
}

/// Extract simple keyword-like sentences from raw text (first N non-empty lines).
fn extract_lines(text: &str, max: usize) -> Vec<String> {
    text.lines()
        .map(|l| l.trim().trim_start_matches(|c: char| c == '-' || c == '*' || c.is_ascii_digit() || c == '.'))
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .take(max)
        .collect()
}

/// Append the expected JSON response schema to a prompt string.
fn append_json_schema(prompt: &mut String, schema: &str) {
    prompt.push_str("\n\nYou MUST respond with a single valid JSON object matching this exact schema (no markdown fences, no extra text):\n");
    prompt.push_str(schema);
    prompt.push('\n');
}

// ---------------------------------------------------------------------------
// JSON schemas appended to prompts
// ---------------------------------------------------------------------------

const CLASSIFICATION_SCHEMA: &str = r#"{
  "threat_type": "Malware | Phishing | DenialOfService | DataExfiltration | PrivilegeEscalation | LateralMovement | CommandAndControl | Reconnaissance | Unknown",
  "threat_level": "Low | Medium | High | Critical",
  "confidence": 0-100,
  "attack_vector": "Network | Local | Physical | Social | SupplyChain | Unknown",
  "tactics": ["tactic name", ...],
  "techniques": ["TXXXX", ...],
  "impact_assessment": "string describing the potential impact",
  "recommended_actions": ["action1", "action2", ...]
}"#;

const VULNERABILITY_SCHEMA: &str = r#"{
  "exploitability": "Low | Medium | High | Critical",
  "business_impact": "Minimal | Minor | Significant | Major | Critical",
  "attack_scenarios": ["scenario1", "scenario2", ...],
  "mitigation_priority": "Low | Medium | High | Critical",
  "patch_strategy": "string describing the recommended patch/mitigation strategy",
  "compensating_controls": ["control1", "control2", ...]
}"#;

const THREAT_REPORT_SCHEMA: &str = r#"{
  "title": "Report title string",
  "executive_summary": "Summary paragraph",
  "threat_landscape": "Description of the current threat landscape",
  "key_findings": ["finding1", "finding2", ...],
  "recommendations": ["recommendation1", "recommendation2", ...]
}"#;

const ATTACK_PATTERN_SCHEMA: &str = r#"{
  "identified_ttps": [
    {
      "tactic": "Tactic name (e.g. Execution)",
      "technique": "Technique name (e.g. Command and Scripting Interpreter)",
      "technique_id": "TXXXX",
      "confidence": 0-100
    }
  ],
  "attack_stages": ["stage1", "stage2", ...],
  "threat_actor_indicators": ["indicator1", ...],
  "defensive_recommendations": ["recommendation1", ...]
}"#;

// ---------------------------------------------------------------------------
// SecurityClassifier
// ---------------------------------------------------------------------------

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

        let (system_prompt, prompt) = self.build_classification_prompt(event)?;

        let mut request = InferenceRequest::new(prompt)
            .with_max_tokens(1024)
            .with_temperature(0.2) // Low temperature for consistency
            .with_top_p(self.config.inference.top_p);
        if let Some(sys) = system_prompt {
            request = request.with_system_prompt(sys);
        }

        let response = self.engine.infer(request).await?;
        let classification = self.parse_classification_response(&response.text, event, start_time.elapsed())?;

        info!("Event classified as {:?} with confidence {}",
              classification.threat_type, classification.confidence);
        Ok(classification)
    }

    /// Analyze vulnerability and assess its impact.
    pub async fn analyze_vulnerability(&self, vuln: &Vulnerability) -> Result<VulnerabilityAnalysis> {
        let (system_prompt, prompt) = self.build_vulnerability_prompt(vuln)?;

        let mut request = InferenceRequest::new(prompt)
            .with_max_tokens(2048)
            .with_temperature(0.3);
        if let Some(sys) = system_prompt {
            request = request.with_system_prompt(sys);
        }

        let response = self.engine.infer(request).await?;
        self.parse_vulnerability_analysis(&response.text, vuln)
    }

    /// Generate threat intelligence report.
    pub async fn generate_threat_report(&self, events: &[SecurityEvent]) -> Result<ThreatReport> {
        info!("Generating threat report for {} events", events.len());

        let (system_prompt, prompt) = self.build_threat_report_prompt(events)?;

        let mut request = InferenceRequest::new(prompt)
            .with_max_tokens(3072)
            .with_temperature(0.4);
        if let Some(sys) = system_prompt {
            request = request.with_system_prompt(sys);
        }

        let response = self.engine.infer(request).await?;
        self.parse_threat_report(&response.text, events)
    }

    /// Assess attack patterns and techniques.
    pub async fn analyze_attack_patterns(&self, events: &[SecurityEvent]) -> Result<AttackPatternAnalysis> {
        let (system_prompt, prompt) = self.build_attack_pattern_prompt(events)?;

        let mut request = InferenceRequest::new(prompt)
            .with_max_tokens(2048)
            .with_temperature(0.3);
        if let Some(sys) = system_prompt {
            request = request.with_system_prompt(sys);
        }

        let response = self.engine.infer(request).await?;
        self.parse_attack_pattern_analysis(&response.text)
    }

    /// Build classification prompt for security event, returning (system_prompt, user_prompt).
    fn build_classification_prompt(&self, event: &SecurityEvent) -> Result<(Option<String>, String)> {
        let template = PromptTemplates::get("threat_classification")
            .ok_or_else(|| anyhow::anyhow!("Threat classification template not found"))?;

        let event_details = serde_json::to_string_pretty(event)?;

        let (system_prompt, mut user_prompt) = PromptBuilder::new(template)
            .set("event_details", &event_details)
            .set("system_info", &event.system_info)
            .set("historical_context", &event.historical_context)
            .build_parts();

        append_json_schema(&mut user_prompt, CLASSIFICATION_SCHEMA);
        Ok((system_prompt, user_prompt))
    }

    /// Build vulnerability analysis prompt, returning (system_prompt, user_prompt).
    fn build_vulnerability_prompt(&self, vuln: &Vulnerability) -> Result<(Option<String>, String)> {
        let mut user_prompt = format!(
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

        append_json_schema(&mut user_prompt, VULNERABILITY_SCHEMA);
        Ok((
            Some("You are a cybersecurity vulnerability analyst with expertise in CVSS scoring and risk assessment. Provide detailed, actionable vulnerability assessments.".to_string()),
            user_prompt,
        ))
    }

    /// Build threat report prompt, returning (system_prompt, user_prompt).
    fn build_threat_report_prompt(&self, events: &[SecurityEvent]) -> Result<(Option<String>, String)> {
        let events_summary = events.iter()
            .map(|e| format!("{} [{}] - {}", e.id, e.event_type, e.description))
            .collect::<Vec<_>>()
            .join("\n");

        let mut user_prompt = format!(
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

        append_json_schema(&mut user_prompt, THREAT_REPORT_SCHEMA);
        Ok((
            Some("You are a senior threat intelligence analyst. Generate professional threat intelligence reports with actionable insights for security leadership.".to_string()),
            user_prompt,
        ))
    }

    /// Build attack pattern analysis prompt, returning (system_prompt, user_prompt).
    fn build_attack_pattern_prompt(&self, events: &[SecurityEvent]) -> Result<(Option<String>, String)> {
        let events_data = serde_json::to_string(events)?;

        let mut user_prompt = format!(
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

        append_json_schema(&mut user_prompt, ATTACK_PATTERN_SCHEMA);
        Ok((
            Some("You are a threat intelligence analyst specializing in MITRE ATT&CK framework analysis and attack pattern identification.".to_string()),
            user_prompt,
        ))
    }

    // -----------------------------------------------------------------------
    // Response parsers
    // -----------------------------------------------------------------------

    /// Parse classification response from LLM text into SecurityClassification.
    ///
    /// Strategy: try direct JSON parse -> extract JSON block -> fallback from raw text.
    fn parse_classification_response(&self, response: &str, event: &SecurityEvent, duration: std::time::Duration) -> Result<SecurityClassification> {
        let now = chrono::Utc::now();
        let processing_time_ms = duration.as_millis() as u64;

        // Attempt 1: direct deserialization
        if let Ok(raw) = serde_json::from_str::<RawClassification>(response) {
            return Ok(self.build_classification_from_raw(raw, event, now, processing_time_ms));
        }

        // Attempt 2: extract JSON block from surrounding text
        if let Some(json_block) = extract_json_block(response)
            && let Ok(raw) = serde_json::from_str::<RawClassification>(json_block)
        {
            return Ok(self.build_classification_from_raw(raw, event, now, processing_time_ms));
        }

        // Attempt 3: fallback - build from raw text keywords
        warn!("Failed to parse classification JSON for event {}; building fallback from raw text", event.id);
        let lower = response.to_lowercase();

        let threat_type = if lower.contains("malware") {
            ThreatType::Malware
        } else if lower.contains("phishing") {
            ThreatType::Phishing
        } else if lower.contains("denial") || lower.contains("ddos") || lower.contains("dos") {
            ThreatType::DenialOfService
        } else if lower.contains("exfiltration") {
            ThreatType::DataExfiltration
        } else if lower.contains("privilege") || lower.contains("escalation") {
            ThreatType::PrivilegeEscalation
        } else if lower.contains("lateral") {
            ThreatType::LateralMovement
        } else if lower.contains("command and control") || lower.contains("c2") {
            ThreatType::CommandAndControl
        } else if lower.contains("reconnaissance") || lower.contains("recon") {
            ThreatType::Reconnaissance
        } else {
            ThreatType::Unknown
        };

        let threat_level = if lower.contains("critical") {
            ThreatLevel::Critical
        } else if lower.contains("high") {
            ThreatLevel::High
        } else if lower.contains("medium") || lower.contains("moderate") {
            ThreatLevel::Medium
        } else {
            ThreatLevel::Low
        };

        Ok(SecurityClassification {
            event_id: event.id.clone(),
            threat_type,
            threat_level,
            confidence: 40, // low confidence for fallback
            attack_vector: AttackVector::Unknown,
            tactics: extract_lines(response, 5),
            techniques: Vec::new(),
            impact_assessment: response.chars().take(500).collect(),
            recommended_actions: vec!["Review event manually".to_string()],
            classification_timestamp: now,
            processing_time_ms,
        })
    }

    /// Build a `SecurityClassification` from the intermediate `RawClassification`.
    fn build_classification_from_raw(
        &self,
        raw: RawClassification,
        event: &SecurityEvent,
        now: chrono::DateTime<chrono::Utc>,
        processing_time_ms: u64,
    ) -> SecurityClassification {
        SecurityClassification {
            event_id: event.id.clone(),
            threat_type: raw.threat_type.as_deref().map(parse_threat_type).unwrap_or(ThreatType::Unknown),
            threat_level: raw.threat_level.as_deref().map(parse_threat_level).unwrap_or(ThreatLevel::Medium),
            confidence: raw.confidence.unwrap_or(50),
            attack_vector: raw.attack_vector.as_deref().map(parse_attack_vector).unwrap_or(AttackVector::Unknown),
            tactics: raw.tactics,
            techniques: raw.techniques,
            impact_assessment: raw.impact_assessment.unwrap_or_else(|| "No impact assessment provided".to_string()),
            recommended_actions: if raw.recommended_actions.is_empty() {
                vec!["Review event details".to_string()]
            } else {
                raw.recommended_actions
            },
            classification_timestamp: now,
            processing_time_ms,
        }
    }

    /// Parse vulnerability analysis response from LLM text.
    fn parse_vulnerability_analysis(&self, response: &str, vuln: &Vulnerability) -> Result<VulnerabilityAnalysis> {
        let now = chrono::Utc::now();

        // Attempt 1: direct deserialization
        if let Ok(raw) = serde_json::from_str::<RawVulnerabilityAnalysis>(response) {
            return Ok(self.build_vuln_analysis_from_raw(raw, vuln, now));
        }

        // Attempt 2: extract JSON block
        if let Some(json_block) = extract_json_block(response)
            && let Ok(raw) = serde_json::from_str::<RawVulnerabilityAnalysis>(json_block)
        {
            return Ok(self.build_vuln_analysis_from_raw(raw, vuln, now));
        }

        // Attempt 3: fallback from raw text
        warn!("Failed to parse vulnerability analysis JSON for {}; building fallback from raw text", vuln.id);
        let lower = response.to_lowercase();

        let exploitability = if lower.contains("critical") {
            Exploitability::Critical
        } else if lower.contains("high") {
            Exploitability::High
        } else if lower.contains("medium") || lower.contains("moderate") {
            Exploitability::Medium
        } else {
            Exploitability::Low
        };

        let mitigation_priority = if vuln.cvss_score >= 9.0 {
            MitigationPriority::Critical
        } else if vuln.cvss_score >= 7.0 {
            MitigationPriority::High
        } else if vuln.cvss_score >= 4.0 {
            MitigationPriority::Medium
        } else {
            MitigationPriority::Low
        };

        Ok(VulnerabilityAnalysis {
            vulnerability_id: vuln.id.clone(),
            exploitability,
            business_impact: BusinessImpact::Significant,
            attack_scenarios: extract_lines(response, 5),
            mitigation_priority,
            patch_strategy: response.chars().take(500).collect(),
            compensating_controls: vec!["Review vulnerability manually".to_string()],
            analysis_timestamp: now,
        })
    }

    /// Build a `VulnerabilityAnalysis` from the intermediate `RawVulnerabilityAnalysis`.
    fn build_vuln_analysis_from_raw(
        &self,
        raw: RawVulnerabilityAnalysis,
        vuln: &Vulnerability,
        now: chrono::DateTime<chrono::Utc>,
    ) -> VulnerabilityAnalysis {
        VulnerabilityAnalysis {
            vulnerability_id: vuln.id.clone(),
            exploitability: raw.exploitability.as_deref().map(parse_exploitability).unwrap_or(Exploitability::Medium),
            business_impact: raw.business_impact.as_deref().map(parse_business_impact).unwrap_or(BusinessImpact::Significant),
            attack_scenarios: if raw.attack_scenarios.is_empty() {
                vec!["No specific scenarios provided".to_string()]
            } else {
                raw.attack_scenarios
            },
            mitigation_priority: raw.mitigation_priority.as_deref().map(parse_mitigation_priority).unwrap_or(MitigationPriority::High),
            patch_strategy: raw.patch_strategy.unwrap_or_else(|| "Apply vendor patches as available".to_string()),
            compensating_controls: if raw.compensating_controls.is_empty() {
                vec!["Enhanced monitoring".to_string()]
            } else {
                raw.compensating_controls
            },
            analysis_timestamp: now,
        }
    }

    /// Parse threat report response from LLM text.
    fn parse_threat_report(&self, response: &str, events: &[SecurityEvent]) -> Result<ThreatReport> {
        let now = chrono::Utc::now();
        let event_count = events.len();

        // Attempt 1: direct deserialization
        if let Ok(raw) = serde_json::from_str::<RawThreatReport>(response) {
            return Ok(self.build_threat_report_from_raw(raw, now, event_count));
        }

        // Attempt 2: extract JSON block
        if let Some(json_block) = extract_json_block(response)
            && let Ok(raw) = serde_json::from_str::<RawThreatReport>(json_block)
        {
            return Ok(self.build_threat_report_from_raw(raw, now, event_count));
        }

        // Attempt 3: fallback - use the raw response as the executive summary
        warn!("Failed to parse threat report JSON; building fallback from raw text");

        let lines = extract_lines(response, 20);
        let title = lines.first().cloned().unwrap_or_else(|| "Threat Intelligence Report".to_string());
        // Use the full response as executive summary, capped at 2000 chars
        let executive_summary: String = response.chars().take(2000).collect();

        Ok(ThreatReport {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            executive_summary,
            threat_landscape: "See executive summary for details".to_string(),
            key_findings: lines.into_iter().skip(1).take(5).collect(),
            recommendations: vec!["Review report details manually".to_string()],
            generated_at: now,
            event_count,
        })
    }

    /// Build a `ThreatReport` from the intermediate `RawThreatReport`.
    fn build_threat_report_from_raw(
        &self,
        raw: RawThreatReport,
        now: chrono::DateTime<chrono::Utc>,
        event_count: usize,
    ) -> ThreatReport {
        ThreatReport {
            id: uuid::Uuid::new_v4().to_string(),
            title: raw.title.unwrap_or_else(|| "Threat Intelligence Report".to_string()),
            executive_summary: raw.executive_summary.unwrap_or_else(|| "No executive summary provided".to_string()),
            threat_landscape: raw.threat_landscape.unwrap_or_else(|| "No threat landscape analysis provided".to_string()),
            key_findings: if raw.key_findings.is_empty() {
                vec!["No specific findings extracted".to_string()]
            } else {
                raw.key_findings
            },
            recommendations: if raw.recommendations.is_empty() {
                vec!["Review report for detailed recommendations".to_string()]
            } else {
                raw.recommendations
            },
            generated_at: now,
            event_count,
        }
    }

    /// Parse attack pattern analysis response from LLM text.
    fn parse_attack_pattern_analysis(&self, response: &str) -> Result<AttackPatternAnalysis> {
        let now = chrono::Utc::now();

        // Attempt 1: direct deserialization
        if let Ok(raw) = serde_json::from_str::<RawAttackPatternAnalysis>(response) {
            return Ok(self.build_attack_pattern_from_raw(raw, now));
        }

        // Attempt 2: extract JSON block
        if let Some(json_block) = extract_json_block(response)
            && let Ok(raw) = serde_json::from_str::<RawAttackPatternAnalysis>(json_block)
        {
            return Ok(self.build_attack_pattern_from_raw(raw, now));
        }

        // Attempt 3: fallback - try to extract MITRE references from raw text
        warn!("Failed to parse attack pattern analysis JSON; building fallback from raw text");

        // Look for MITRE technique IDs in the text (T followed by 4 digits)
        let technique_ids: Vec<String> = {
            let re = regex::Regex::new(r"T\d{4}(?:\.\d{3})?").unwrap();
            re.find_iter(response)
                .map(|m| m.as_str().to_string())
                .collect()
        };

        let ttps: Vec<TTP> = technique_ids.iter().map(|tid| {
            TTP {
                tactic: "Unknown".to_string(),
                technique: "See technique ID".to_string(),
                technique_id: tid.clone(),
                confidence: 30,
            }
        }).collect();

        Ok(AttackPatternAnalysis {
            identified_ttps: ttps,
            attack_stages: extract_lines(response, 5),
            threat_actor_indicators: Vec::new(),
            defensive_recommendations: vec!["Review analysis manually".to_string()],
            analysis_timestamp: now,
        })
    }

    /// Build an `AttackPatternAnalysis` from the intermediate `RawAttackPatternAnalysis`.
    fn build_attack_pattern_from_raw(
        &self,
        raw: RawAttackPatternAnalysis,
        now: chrono::DateTime<chrono::Utc>,
    ) -> AttackPatternAnalysis {
        let ttps = raw.identified_ttps.into_iter().map(|r| {
            TTP {
                tactic: r.tactic.unwrap_or_else(|| "Unknown".to_string()),
                technique: r.technique.unwrap_or_else(|| "Unknown".to_string()),
                technique_id: r.technique_id.unwrap_or_else(|| "N/A".to_string()),
                confidence: r.confidence.unwrap_or(50),
            }
        }).collect();

        AttackPatternAnalysis {
            identified_ttps: ttps,
            attack_stages: if raw.attack_stages.is_empty() {
                vec!["Unknown".to_string()]
            } else {
                raw.attack_stages
            },
            threat_actor_indicators: raw.threat_actor_indicators,
            defensive_recommendations: if raw.defensive_recommendations.is_empty() {
                vec!["Review identified TTPs and apply appropriate mitigations".to_string()]
            } else {
                raw.defensive_recommendations
            },
            analysis_timestamp: now,
        }
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

    // -----------------------------------------------------------------------
    // Tests for helper functions and parsers
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_threat_type_variants() {
        assert!(matches!(parse_threat_type("Malware"), ThreatType::Malware));
        assert!(matches!(parse_threat_type("phishing"), ThreatType::Phishing));
        assert!(matches!(parse_threat_type("DenialOfService"), ThreatType::DenialOfService));
        assert!(matches!(parse_threat_type("ddos"), ThreatType::DenialOfService));
        assert!(matches!(parse_threat_type("DataExfiltration"), ThreatType::DataExfiltration));
        assert!(matches!(parse_threat_type("PrivilegeEscalation"), ThreatType::PrivilegeEscalation));
        assert!(matches!(parse_threat_type("LateralMovement"), ThreatType::LateralMovement));
        assert!(matches!(parse_threat_type("CommandAndControl"), ThreatType::CommandAndControl));
        assert!(matches!(parse_threat_type("c2"), ThreatType::CommandAndControl));
        assert!(matches!(parse_threat_type("Reconnaissance"), ThreatType::Reconnaissance));
        assert!(matches!(parse_threat_type("something_else"), ThreatType::Unknown));
    }

    #[test]
    fn test_parse_threat_level_variants() {
        assert!(matches!(parse_threat_level("low"), ThreatLevel::Low));
        assert!(matches!(parse_threat_level("Medium"), ThreatLevel::Medium));
        assert!(matches!(parse_threat_level("moderate"), ThreatLevel::Medium));
        assert!(matches!(parse_threat_level("HIGH"), ThreatLevel::High));
        assert!(matches!(parse_threat_level("critical"), ThreatLevel::Critical));
        assert!(matches!(parse_threat_level("severe"), ThreatLevel::Critical));
        assert!(matches!(parse_threat_level("???"), ThreatLevel::Medium));
    }

    #[test]
    fn test_parse_attack_vector_variants() {
        assert!(matches!(parse_attack_vector("Network"), AttackVector::Network));
        assert!(matches!(parse_attack_vector("remote"), AttackVector::Network));
        assert!(matches!(parse_attack_vector("Local"), AttackVector::Local));
        assert!(matches!(parse_attack_vector("Physical"), AttackVector::Physical));
        assert!(matches!(parse_attack_vector("Social Engineering"), AttackVector::Social));
        assert!(matches!(parse_attack_vector("SupplyChain"), AttackVector::SupplyChain));
        assert!(matches!(parse_attack_vector("other"), AttackVector::Unknown));
    }

    #[test]
    fn test_parse_exploitability_variants() {
        assert!(matches!(parse_exploitability("Low"), Exploitability::Low));
        assert!(matches!(parse_exploitability("medium"), Exploitability::Medium));
        assert!(matches!(parse_exploitability("High"), Exploitability::High));
        assert!(matches!(parse_exploitability("Critical"), Exploitability::Critical));
        assert!(matches!(parse_exploitability("???"), Exploitability::Medium));
    }

    #[test]
    fn test_parse_business_impact_variants() {
        assert!(matches!(parse_business_impact("minimal"), BusinessImpact::Minimal));
        assert!(matches!(parse_business_impact("minor"), BusinessImpact::Minor));
        assert!(matches!(parse_business_impact("significant"), BusinessImpact::Significant));
        assert!(matches!(parse_business_impact("moderate"), BusinessImpact::Significant));
        assert!(matches!(parse_business_impact("major"), BusinessImpact::Major));
        assert!(matches!(parse_business_impact("critical"), BusinessImpact::Critical));
        assert!(matches!(parse_business_impact("???"), BusinessImpact::Significant));
    }

    #[test]
    fn test_parse_mitigation_priority_variants() {
        assert!(matches!(parse_mitigation_priority("low"), MitigationPriority::Low));
        assert!(matches!(parse_mitigation_priority("medium"), MitigationPriority::Medium));
        assert!(matches!(parse_mitigation_priority("high"), MitigationPriority::High));
        assert!(matches!(parse_mitigation_priority("critical"), MitigationPriority::Critical));
        assert!(matches!(parse_mitigation_priority("urgent"), MitigationPriority::Critical));
        assert!(matches!(parse_mitigation_priority("???"), MitigationPriority::High));
    }

    #[test]
    fn test_extract_lines() {
        let text = "- First item\n* Second item\n3. Third item\n\n  \nFourth item";
        let lines = extract_lines(text, 3);
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0], "First item");
        assert_eq!(lines[1], "Second item");
        assert_eq!(lines[2], "Third item");
    }

    #[test]
    fn test_raw_classification_from_valid_json() {
        let json = r#"{
            "threat_type": "Malware",
            "threat_level": "High",
            "confidence": 92,
            "attack_vector": "Network",
            "tactics": ["Execution", "Persistence"],
            "techniques": ["T1059", "T1053"],
            "impact_assessment": "Critical data at risk",
            "recommended_actions": ["Isolate host", "Scan network"]
        }"#;

        let raw: RawClassification = serde_json::from_str(json).unwrap();
        assert_eq!(raw.threat_type.as_deref(), Some("Malware"));
        assert_eq!(raw.confidence, Some(92));
        assert_eq!(raw.tactics.len(), 2);
    }

    #[test]
    fn test_raw_classification_partial_json() {
        // Only some fields present - serde(default) handles the rest
        let json = r#"{"threat_type": "Phishing", "confidence": 70}"#;
        let raw: RawClassification = serde_json::from_str(json).unwrap();
        assert_eq!(raw.threat_type.as_deref(), Some("Phishing"));
        assert_eq!(raw.confidence, Some(70));
        assert!(raw.tactics.is_empty());
        assert!(raw.techniques.is_empty());
        assert!(raw.attack_vector.is_none());
    }

    #[test]
    fn test_raw_vulnerability_analysis_from_valid_json() {
        let json = r#"{
            "exploitability": "High",
            "business_impact": "Major",
            "attack_scenarios": ["Remote code execution"],
            "mitigation_priority": "Critical",
            "patch_strategy": "Apply patch immediately",
            "compensating_controls": ["Network segmentation"]
        }"#;

        let raw: RawVulnerabilityAnalysis = serde_json::from_str(json).unwrap();
        assert_eq!(raw.exploitability.as_deref(), Some("High"));
        assert_eq!(raw.mitigation_priority.as_deref(), Some("Critical"));
        assert_eq!(raw.attack_scenarios.len(), 1);
    }

    #[test]
    fn test_raw_threat_report_from_valid_json() {
        let json = r#"{
            "title": "Weekly Threat Report",
            "executive_summary": "Multiple high-severity events detected",
            "threat_landscape": "Active APT campaigns targeting infrastructure",
            "key_findings": ["Finding 1", "Finding 2"],
            "recommendations": ["Rec 1"]
        }"#;

        let raw: RawThreatReport = serde_json::from_str(json).unwrap();
        assert_eq!(raw.title.as_deref(), Some("Weekly Threat Report"));
        assert_eq!(raw.key_findings.len(), 2);
    }

    #[test]
    fn test_raw_attack_pattern_analysis_from_valid_json() {
        let json = r#"{
            "identified_ttps": [
                {
                    "tactic": "Execution",
                    "technique": "Command and Scripting Interpreter",
                    "technique_id": "T1059",
                    "confidence": 90
                }
            ],
            "attack_stages": ["Initial Access", "Execution"],
            "threat_actor_indicators": ["APT-style"],
            "defensive_recommendations": ["Enable logging"]
        }"#;

        let raw: RawAttackPatternAnalysis = serde_json::from_str(json).unwrap();
        assert_eq!(raw.identified_ttps.len(), 1);
        assert_eq!(raw.identified_ttps[0].technique_id.as_deref(), Some("T1059"));
        assert_eq!(raw.attack_stages.len(), 2);
    }

    #[test]
    fn test_append_json_schema() {
        let mut prompt = "Analyze this event.".to_string();
        append_json_schema(&mut prompt, r#"{"key": "value"}"#);
        assert!(prompt.contains("single valid JSON object"));
        assert!(prompt.contains(r#"{"key": "value"}"#));
    }
}
