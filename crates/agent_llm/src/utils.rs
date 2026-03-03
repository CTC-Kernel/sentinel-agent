// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Shared helper functions used across multiple LLM modules.

use crate::analyzer::RiskLevel;
use serde::de::DeserializeOwned;

/// Try to extract a JSON object from free-form LLM text by locating the first
/// `{` and the last `}`.  Returns `None` when no braces are found or the slice
/// would be empty.  Zero-copy: returns a sub-slice of the input.
pub fn extract_json_block(text: &str) -> Option<&str> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if end > start {
        Some(&text[start..=end])
    } else {
        None
    }
}

/// Parse a risk level string into the `RiskLevel` enum, case-insensitive.
/// Returns `RiskLevel::Medium` for unrecognised values.
pub fn parse_risk_level(s: &str) -> RiskLevel {
    match s.to_lowercase().trim() {
        "low" => RiskLevel::Low,
        "medium" | "moderate" => RiskLevel::Medium,
        "high" => RiskLevel::High,
        "critical" | "severe" => RiskLevel::Critical,
        _ => RiskLevel::Medium,
    }
}

/// Extract simple keyword-like sentences from raw text (first N non-empty lines).
/// Strips leading bullet markers (`-`, `*`, digits followed by `.`) before collecting.
pub fn extract_lines(text: &str, max: usize) -> Vec<String> {
    text.lines()
        .map(|l| {
            l.trim().trim_start_matches(|c: char| {
                c == '-' || c == '*' || c.is_ascii_digit() || c == '.'
            })
        })
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .take(max)
        .collect()
}

/// Append the expected JSON response schema to a prompt string.
pub fn append_json_schema(prompt: &mut String, schema: &str) {
    prompt.push_str("\n\nYou MUST respond with a single valid JSON object matching this exact schema (no markdown fences, no extra text):\n");
    prompt.push_str(schema);
    prompt.push('\n');
}

/// Try to parse a JSON value from an LLM response string.
///
/// Strategy 1: direct `serde_json::from_str` on the full response.
/// Strategy 2: `extract_json_block` then `serde_json::from_str` on the extracted block.
/// Returns `Err(response)` if both fail, so the caller can apply a custom heuristic fallback.
pub fn try_parse_json<T: DeserializeOwned>(response: &str) -> std::result::Result<T, &str> {
    if let Ok(val) = serde_json::from_str::<T>(response) {
        return Ok(val);
    }
    if let Some(json_block) = extract_json_block(response)
        && let Ok(val) = serde_json::from_str::<T>(json_block)
    {
        return Ok(val);
    }
    Err(response)
}

/// Shared test utilities available to all modules in this crate.
#[cfg(test)]
pub mod test_helpers {
    use crate::config::LLMConfig;
    use crate::engine::{
        InferenceRequest, InferenceResponse, MemoryUsage, ModelEngine, ModelStatus,
    };
    use anyhow::Result;
    use std::sync::Arc;

    /// A mock engine that always returns a pre-configured response text.
    pub struct MockEngine {
        response_text: String,
    }

    impl MockEngine {
        /// Create an `Arc<dyn ModelEngine>` wrapping a `MockEngine` with the given response.
        pub fn arc(text: impl Into<String>) -> Arc<dyn ModelEngine> {
            Arc::new(Self {
                response_text: text.into(),
            })
        }
    }

    #[async_trait::async_trait]
    impl ModelEngine for MockEngine {
        async fn status(&self) -> ModelStatus {
            ModelStatus::Ready
        }
        async fn infer(&self, _request: InferenceRequest) -> Result<InferenceResponse> {
            Ok(InferenceResponse::new(self.response_text.clone()))
        }
        async fn memory_usage(&self) -> MemoryUsage {
            MemoryUsage {
                allocated_mb: 0,
                peak_mb: 0,
                available_mb: 0,
            }
        }
        async fn inference_count(&self) -> u64 {
            0
        }
        async fn reload(&self) -> Result<()> {
            Ok(())
        }
        async fn unload(&self) -> Result<()> {
            Ok(())
        }
    }

    /// Build a default `LLMConfig` suitable for tests (no model file needed).
    pub fn test_config() -> LLMConfig {
        LLMConfig::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // extract_json_block
    // -----------------------------------------------------------------------

    #[test]
    fn test_extract_json_block_clean() {
        let input = r#"{"risk_level": "high"}"#;
        assert_eq!(extract_json_block(input), Some(r#"{"risk_level": "high"}"#));
    }

    #[test]
    fn test_extract_json_block_with_surrounding_text() {
        let input = "Here is the analysis:\n{\"key\": \"value\"}\nDone.";
        assert_eq!(extract_json_block(input), Some("{\"key\": \"value\"}"));
    }

    #[test]
    fn test_extract_json_block_with_markdown_fences() {
        let input = "```json\n{\"key\": \"value\"}\n```";
        assert_eq!(extract_json_block(input), Some("{\"key\": \"value\"}"));
    }

    #[test]
    fn test_extract_json_block_no_json() {
        assert!(extract_json_block("no json here at all").is_none());
    }

    #[test]
    fn test_extract_json_block_no_closing_brace() {
        assert!(extract_json_block("Something { but no closing").is_none());
    }

    #[test]
    fn test_extract_json_block_only_closing_brace() {
        assert!(extract_json_block("}").is_none());
    }

    // -----------------------------------------------------------------------
    // parse_risk_level
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_risk_level() {
        assert!(matches!(parse_risk_level("low"), RiskLevel::Low));
        assert!(matches!(parse_risk_level("Medium"), RiskLevel::Medium));
        assert!(matches!(parse_risk_level("HIGH"), RiskLevel::High));
        assert!(matches!(parse_risk_level("critical"), RiskLevel::Critical));
        assert!(matches!(parse_risk_level("severe"), RiskLevel::Critical));
        assert!(matches!(parse_risk_level("moderate"), RiskLevel::Medium));
        assert!(matches!(parse_risk_level("unknown"), RiskLevel::Medium));
    }

    // -----------------------------------------------------------------------
    // extract_lines
    // -----------------------------------------------------------------------

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
    fn test_extract_lines_empty() {
        assert!(extract_lines("", 10).is_empty());
        assert!(extract_lines("   \n\n  ", 10).is_empty());
    }

    // -----------------------------------------------------------------------
    // append_json_schema
    // -----------------------------------------------------------------------

    #[test]
    fn test_append_json_schema() {
        let mut prompt = "Analyze this event.".to_string();
        append_json_schema(&mut prompt, r#"{"key": "value"}"#);
        assert!(prompt.contains("single valid JSON object"));
        assert!(prompt.contains(r#"{"key": "value"}"#));
    }

    // -----------------------------------------------------------------------
    // try_parse_json
    // -----------------------------------------------------------------------

    #[test]
    fn test_try_parse_json_direct() {
        #[derive(serde::Deserialize)]
        struct Simple {
            value: String,
        }
        let result: std::result::Result<Simple, _> = try_parse_json(r#"{"value": "hello"}"#);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().value, "hello");
    }

    #[test]
    fn test_try_parse_json_with_surrounding_text() {
        #[derive(serde::Deserialize)]
        struct Simple {
            value: String,
        }
        let result: std::result::Result<Simple, _> =
            try_parse_json("Here is the result:\n{\"value\": \"world\"}\nDone.");
        assert!(result.is_ok());
        assert_eq!(result.unwrap().value, "world");
    }

    #[test]
    fn test_try_parse_json_failure() {
        #[derive(Debug, serde::Deserialize)]
        #[allow(dead_code)]
        struct Simple {
            value: String,
        }
        let result: std::result::Result<Simple, _> = try_parse_json("no json at all");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "no json at all");
    }
}
