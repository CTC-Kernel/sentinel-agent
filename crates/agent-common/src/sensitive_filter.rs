//! Sensitive data filtering for logging and tracing.
//!
//! This module provides utilities to filter out sensitive information
//! like tokens, passwords, API keys, and other secrets from logs.

use once_cell::sync::Lazy;
use regex::Regex;

/// Patterns to detect and mask sensitive data
static TOKEN_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        // JWT tokens (Bearer)
        Regex::new(r"(?i)bearer\s+[a-zA-Z0-9\-._~+/]+=*").unwrap(),
        // API keys in headers - simplified pattern
        Regex::new(r"(?i)api[_-]?key\s*[:=]\s*[a-zA-Z0-9\-._~+/]+=*").unwrap(),
        // Authorization headers
        Regex::new(r"(?i)authorization\s*[:=]\s*[a-zA-Z0-9\-._~+/]+=*").unwrap(),
        // Enrollment tokens (xxxxx-xxxxx-xxxxx format)
        Regex::new(r"\b[a-zA-Z0-9]{5}(?:-[a-zA-Z0-9]{5}){2,}\b").unwrap(),
        // Generic secret patterns
        Regex::new(r"(?i)(secret|password|passphrase|private[_-]?key)\s*[:=]\s*[^\s]{8,}").unwrap(),
        // Certificate content
        Regex::new(r"(?i)-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----").unwrap(),
        // Base64 encoded secrets (long strings)
        Regex::new(r"[A-Za-z0-9+/]{40,}={0,2}").unwrap(),
    ]
});

/// Replacement text for masked sensitive data
const MASK_REPLACEMENT: &str = "***REDACTED***";

/// Filter sensitive data from a string.
///
/// This function scans the input for various patterns that might indicate
/// sensitive information and replaces them with a placeholder.
pub fn filter_sensitive_data(input: &str) -> String {
    let mut filtered = input.to_string();

    for pattern in TOKEN_PATTERNS.iter() {
        filtered = pattern.replace_all(&filtered, MASK_REPLACEMENT).to_string();
    }

    filtered
}

/// Check if a string contains sensitive data patterns.
pub fn contains_sensitive_data(input: &str) -> bool {
    TOKEN_PATTERNS.iter().any(|pattern| pattern.is_match(input))
}

/// Filter sensitive data from a JSON string while preserving structure.
pub fn filter_json_sensitive_data(json_str: &str) -> String {
    // First try to parse as JSON to filter specific fields
    if let Ok(mut value) = serde_json::from_str::<serde_json::Value>(json_str) {
        filter_sensitive_json_value(&mut value);
        serde_json::to_string(&value).unwrap_or_else(|_| filter_sensitive_data(json_str))
    } else {
        // Fallback to regex-based filtering
        filter_sensitive_data(json_str)
    }
}

/// Recursively filter sensitive data from JSON values.
fn filter_sensitive_json_value(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(map) => {
            for (key, val) in map.iter_mut() {
                if is_sensitive_key(key) {
                    *val = serde_json::Value::String(MASK_REPLACEMENT.to_string());
                } else {
                    filter_sensitive_json_value(val);
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr.iter_mut() {
                filter_sensitive_json_value(item);
            }
        }
        serde_json::Value::String(s) => {
            if contains_sensitive_data(s) {
                *value = serde_json::Value::String(MASK_REPLACEMENT.to_string());
            }
        }
        _ => {} // Other types are not sensitive
    }
}

/// Check if a JSON key name suggests sensitive data.
fn is_sensitive_key(key: &str) -> bool {
    let key_lower = key.to_lowercase();
    key_lower.contains("token")
        || key_lower.contains("password")
        || key_lower.contains("secret")
        || key_lower.contains("key")
        || key_lower.contains("auth")
        || key_lower.contains("credential")
        || key_lower.contains("certificate")
        || key_lower.contains("private")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_bearer_token() {
        let input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
        let filtered = filter_sensitive_data(input);
        assert_eq!(filtered, "Authorization: ***REDACTED***");
    }

    #[test]
    fn test_filter_enrollment_token() {
        let input = "Token: abcde-fghij-klmno";
        let filtered = filter_sensitive_data(input);
        assert_eq!(filtered, "Token: ***REDACTED***");
    }

    #[test]
    fn test_filter_api_key() {
        let input = "api_key=sk-1234567890abcdef";
        let filtered = filter_sensitive_data(input);
        assert_eq!(filtered, "***REDACTED***");
    }

    #[test]
    fn test_filter_json() {
        let json = r#"{"token": "secret123", "name": "test", "password": "pass123"}"#;
        let filtered = filter_json_sensitive_data(json);
        assert!(filtered.contains("***REDACTED***"));
        assert!(filtered.contains("test"));
        assert!(!filtered.contains("secret123"));
        assert!(!filtered.contains("pass123"));
    }

    #[test]
    fn test_preserve_safe_data() {
        let input = "This is a safe message without secrets";
        let filtered = filter_sensitive_data(input);
        assert_eq!(filtered, input);
    }
}
