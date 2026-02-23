//! Shared helper functions used across multiple LLM modules.

use crate::analyzer::RiskLevel;

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
}
