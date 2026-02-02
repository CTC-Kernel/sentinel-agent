//! FIM policy management.
//!
//! Policies define which paths to monitor and which patterns to ignore.

use agent_common::types::FimPolicy;
use std::path::PathBuf;
use tracing::info;

/// Merge user-configured paths with defaults.
pub fn build_policy(
    custom_watched_paths: Option<&[String]>,
    custom_ignore_patterns: Option<&[String]>,
) -> FimPolicy {
    let watched_paths = match custom_watched_paths {
        Some(paths) if !paths.is_empty() => {
            info!("Using {} custom FIM watched paths", paths.len());
            paths.iter().map(PathBuf::from).collect()
        }
        _ => {
            let defaults = FimPolicy::default_watched_paths();
            info!("Using {} default FIM watched paths", defaults.len());
            defaults
        }
    };

    let ignore_patterns = match custom_ignore_patterns {
        Some(patterns) if !patterns.is_empty() => patterns.to_vec(),
        _ => vec![
            "*.log".to_string(),
            "*.tmp".to_string(),
            "*.swp".to_string(),
            ".git/**".to_string(),
        ],
    };

    FimPolicy {
        watched_paths,
        ignore_patterns,
        recursive: true,
        debounce_ms: 500,
    }
}

/// Validate that watched paths exist and are accessible.
pub fn validate_policy(policy: &FimPolicy) -> Vec<String> {
    let mut warnings = Vec::new();

    for path in &policy.watched_paths {
        if !path.exists() {
            warnings.push(format!("Watched path does not exist: {}", path.display()));
        } else if !path.is_dir() && !path.is_file() {
            warnings.push(format!(
                "Watched path is not a file or directory: {}",
                path.display()
            ));
        }
    }

    if policy.debounce_ms < 100 {
        warnings.push("Debounce interval is very low (<100ms), may cause high CPU usage".to_string());
    }

    warnings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_policy_defaults() {
        let policy = build_policy(None, None);
        assert!(!policy.watched_paths.is_empty());
        assert!(policy.recursive);
    }

    #[test]
    fn test_build_policy_custom() {
        let paths = vec!["/custom/path".to_string()];
        let policy = build_policy(Some(&paths), None);
        assert_eq!(policy.watched_paths.len(), 1);
        assert_eq!(policy.watched_paths[0], PathBuf::from("/custom/path"));
    }

    #[test]
    fn test_validate_policy_nonexistent_path() {
        let policy = FimPolicy {
            watched_paths: vec![PathBuf::from("/nonexistent/path/12345")],
            ignore_patterns: vec![],
            recursive: true,
            debounce_ms: 500,
        };

        let warnings = validate_policy(&policy);
        assert!(!warnings.is_empty());
    }

    #[test]
    fn test_validate_policy_low_debounce() {
        let policy = FimPolicy {
            watched_paths: vec![],
            ignore_patterns: vec![],
            recursive: true,
            debounce_ms: 50,
        };

        let warnings = validate_policy(&policy);
        assert!(warnings.iter().any(|w| w.contains("Debounce")));
    }
}
