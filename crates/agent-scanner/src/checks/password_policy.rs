//! Password policy compliance check.
//!
//! Verifies password policy configuration:
//! - Windows: Local Security Policy (net accounts, secedit)
//! - Linux: PAM configuration and /etc/login.defs
//! - macOS: pwpolicy

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
#[cfg(target_os = "windows")]
use crate::error::ScannerError;
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
#[cfg(any(target_os = "windows", target_os = "macos"))]
use std::process::Command;
use tracing::debug;

/// Check ID for password policy.
pub const CHECK_ID: &str = "password_policy";

/// Minimum password length for compliance.
const MIN_REQUIRED_LENGTH: u32 = 12;

/// Password policy status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordPolicyStatus {
    /// Whether password policy meets compliance requirements.
    pub compliant: bool,

    /// Minimum password length required.
    pub min_length: Option<u32>,

    /// Whether complexity is required.
    pub complexity_required: Option<bool>,

    /// Maximum password age in days.
    pub max_age_days: Option<u32>,

    /// Minimum password age in days.
    pub min_age_days: Option<u32>,

    /// Password history count (how many previous passwords remembered).
    pub history_count: Option<u32>,

    /// Account lockout threshold (failed attempts before lockout).
    pub lockout_threshold: Option<u32>,

    /// Account lockout duration in minutes.
    pub lockout_duration_minutes: Option<u32>,

    /// Complexity modules enabled (Linux PAM).
    #[serde(default)]
    pub complexity_modules: Vec<String>,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Password policy compliance check.
pub struct PasswordPolicyCheck {
    definition: CheckDefinition,
}

impl PasswordPolicyCheck {
    /// Create a new password policy check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Password Policy")
            .description(
                "Verify password policy meets security standards (min length 12, complexity)",
            )
            .category(CheckCategory::Authentication)
            .severity(CheckSeverity::High)
            .framework("NIS2")
            .framework("DORA")
            .framework("CIS_V8")
            .framework("PCI_DSS")
            .framework("NIST_CSF")
            .framework("ISO_27001")
            .platforms(vec![
                "windows".to_string(),
                "linux".to_string(),
                "macos".to_string(),
            ])
            .build();

        Self { definition }
    }

    /// Check password policy on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<PasswordPolicyStatus> {
        debug!("Checking Windows password policy");

        // Use 'net accounts' to get password policy
        let output = Command::new("net")
            .args(["accounts"])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to run net accounts: {}", e))
            })?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        let mut status = PasswordPolicyStatus {
            compliant: true,
            min_length: None,
            complexity_required: None,
            max_age_days: None,
            min_age_days: None,
            history_count: None,
            lockout_threshold: None,
            lockout_duration_minutes: None,
            complexity_modules: vec![],
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        // Parse net accounts output
        for line in raw_output.lines() {
            let line = line.trim();

            if line.starts_with("Minimum password length") {
                if let Some(val) = Self::parse_numeric_value(line) {
                    status.min_length = Some(val);
                }
            } else if line.starts_with("Maximum password age") {
                if let Some(val) = Self::parse_days_value(line) {
                    status.max_age_days = Some(val);
                }
            } else if line.starts_with("Minimum password age") {
                if let Some(val) = Self::parse_days_value(line) {
                    status.min_age_days = Some(val);
                }
            } else if line.starts_with("Length of password history")
                || line.starts_with("Password history")
            {
                if let Some(val) = Self::parse_numeric_value(line) {
                    status.history_count = Some(val);
                }
            } else if line.starts_with("Lockout threshold") {
                if let Some(val) = Self::parse_numeric_value(line) {
                    status.lockout_threshold = Some(val);
                }
            } else if line.starts_with("Lockout duration") {
                if let Some(val) = Self::parse_numeric_value(line) {
                    status.lockout_duration_minutes = Some(val);
                }
            }
        }

        // Check complexity via PowerShell (secedit is more reliable)
        if let Ok(complexity) = self.check_windows_complexity().await {
            status.complexity_required = Some(complexity);
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    #[cfg(target_os = "windows")]
    async fn check_windows_complexity(&self) -> ScannerResult<bool> {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $tempFile = [System.IO.Path]::GetTempFileName()
                secedit /export /cfg $tempFile /quiet
                $content = Get-Content $tempFile -Raw
                Remove-Item $tempFile -Force
                if ($content -match 'PasswordComplexity\s*=\s*(\d+)') {
                    $matches[1]
                } else {
                    '0'
                }
                "#,
            ])
            .output()
            .map_err(|e| ScannerError::CheckExecution(e.to_string()))?;

        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(result == "1")
    }

    /// Check password policy on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<PasswordPolicyStatus> {
        debug!("Checking Linux password policy");

        let mut status = PasswordPolicyStatus {
            compliant: true,
            min_length: None,
            complexity_required: None,
            max_age_days: None,
            min_age_days: None,
            history_count: None,
            lockout_threshold: None,
            lockout_duration_minutes: None,
            complexity_modules: vec![],
            issues: vec![],
            raw_output: String::new(),
        };

        // Parse /etc/login.defs
        if let Ok(login_defs) = std::fs::read_to_string("/etc/login.defs") {
            status.raw_output.push_str("=== /etc/login.defs ===\n");
            status.raw_output.push_str(&login_defs);
            status.raw_output.push_str("\n\n");

            for line in login_defs.lines() {
                let line = line.trim();
                if line.starts_with('#') || line.is_empty() {
                    continue;
                }

                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    match parts[0] {
                        "PASS_MAX_DAYS" => {
                            status.max_age_days = parts[1].parse().ok();
                        }
                        "PASS_MIN_DAYS" => {
                            status.min_age_days = parts[1].parse().ok();
                        }
                        "PASS_MIN_LEN" => {
                            status.min_length = parts[1].parse().ok();
                        }
                        _ => {}
                    }
                }
            }
        }

        // Check PAM configuration for pwquality/cracklib
        self.parse_pam_config(&mut status);

        // Check pwquality.conf if exists
        if let Ok(pwquality) = std::fs::read_to_string("/etc/security/pwquality.conf") {
            status
                .raw_output
                .push_str("=== /etc/security/pwquality.conf ===\n");
            status.raw_output.push_str(&pwquality);
            status.raw_output.push_str("\n\n");

            for line in pwquality.lines() {
                let line = line.trim();
                if line.starts_with('#') || line.is_empty() {
                    continue;
                }

                if line.starts_with("minlen") {
                    if let Some(val) = Self::parse_config_value(line) {
                        status.min_length = Some(val);
                    }
                } else if line.starts_with("remember") {
                    if let Some(val) = Self::parse_config_value(line) {
                        status.history_count = Some(val);
                    }
                }

                // Check for complexity requirements
                for module in ["dcredit", "ucredit", "lcredit", "ocredit", "minclass"] {
                    if line.starts_with(module) {
                        if !status.complexity_modules.contains(&"pwquality".to_string()) {
                            status.complexity_modules.push("pwquality".to_string());
                        }
                        status.complexity_required = Some(true);
                    }
                }
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    #[cfg(target_os = "linux")]
    fn parse_pam_config(&self, status: &mut PasswordPolicyStatus) {
        // Check common PAM files
        let pam_paths = [
            "/etc/pam.d/common-password",
            "/etc/pam.d/system-auth",
            "/etc/pam.d/password-auth",
        ];

        for path in &pam_paths {
            if let Ok(content) = std::fs::read_to_string(path) {
                status.raw_output.push_str(&format!("=== {} ===\n", path));
                status.raw_output.push_str(&content);
                status.raw_output.push_str("\n\n");

                for line in content.lines() {
                    let line = line.trim();
                    if line.starts_with('#') || line.is_empty() {
                        continue;
                    }

                    // Detect complexity modules
                    if line.contains("pam_pwquality.so") {
                        if !status
                            .complexity_modules
                            .contains(&"pam_pwquality".to_string())
                        {
                            status.complexity_modules.push("pam_pwquality".to_string());
                        }
                        status.complexity_required = Some(true);

                        // Parse inline minlen
                        if let Some((_, rest)) = line.split_once("minlen=") {
                            if let Some(val) = rest.split_whitespace().next() {
                                if let Ok(v) = val.parse() {
                                    status.min_length = Some(v);
                                }
                            }
                        }
                    } else if line.contains("pam_cracklib.so") {
                        if !status
                            .complexity_modules
                            .contains(&"pam_cracklib".to_string())
                        {
                            status.complexity_modules.push("pam_cracklib".to_string());
                        }
                        status.complexity_required = Some(true);
                    } else if line.contains("pam_unix.so") && line.contains("remember=") {
                        if let Some((_, rest)) = line.split_once("remember=") {
                            if let Some(val) = rest.split_whitespace().next() {
                                if let Ok(v) = val.parse() {
                                    status.history_count = Some(v);
                                }
                            }
                        }
                    }

                    // Check for faillock/pam_tally2
                    if line.contains("pam_faillock.so") || line.contains("pam_tally2.so") {
                        if let Some((_, rest)) = line.split_once("deny=") {
                            if let Some(val) = rest.split_whitespace().next() {
                                if let Ok(v) = val.parse() {
                                    status.lockout_threshold = Some(v);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /// Check password policy on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<PasswordPolicyStatus> {
        debug!("Checking macOS password policy");

        let mut status = PasswordPolicyStatus {
            compliant: true,
            min_length: None,
            complexity_required: None,
            max_age_days: None,
            min_age_days: None,
            history_count: None,
            lockout_threshold: None,
            lockout_duration_minutes: None,
            complexity_modules: vec![],
            issues: vec![],
            raw_output: String::new(),
        };

        // Get global password policy
        let output = Command::new("pwpolicy")
            .args(["getaccountpolicies"])
            .output();

        if let Ok(output) = output {
            let raw = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str("=== pwpolicy getaccountpolicies ===\n");
            status.raw_output.push_str(&raw);
            status.raw_output.push_str("\n\n");

            // Parse XML/plist output
            for line in raw.lines() {
                let line = line.trim();

                if (line.contains("minChars") || line.contains("minimumLength"))
                    && let Some(val) = Self::extract_plist_integer(line)
                {
                    status.min_length = Some(val);
                }

                if line.contains("maxMinutesUntilChangePassword")
                    && let Some(val) = Self::extract_plist_integer(line)
                {
                    // Convert minutes to days
                    status.max_age_days = Some(val / (60 * 24));
                }

                if line.contains("requiresMixedCase")
                    || line.contains("requiresSymbol")
                    || line.contains("requiresNumeric")
                {
                    status.complexity_required = Some(true);
                }

                if line.contains("usingHistory")
                    && let Some(val) = Self::extract_plist_integer(line)
                {
                    status.history_count = Some(val);
                }

                if line.contains("maxFailedLoginAttempts")
                    && let Some(val) = Self::extract_plist_integer(line)
                {
                    status.lockout_threshold = Some(val);
                }
            }
        }

        // Also check pwpolicy -getglobalpolicy (older method)
        let output = Command::new("pwpolicy").args(["-getglobalpolicy"]).output();

        if let Ok(output) = output {
            let raw = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str("=== pwpolicy -getglobalpolicy ===\n");
            status.raw_output.push_str(&raw);
            status.raw_output.push_str("\n\n");

            // Parse key=value pairs
            for part in raw.split_whitespace() {
                if let Some((key, value)) = part.split_once('=') {
                    match key {
                        "minChars" => {
                            status.min_length = value.parse().ok();
                        }
                        "maxMinutesUntilChangePassword" => {
                            if let Ok(minutes) = value.parse::<u32>() {
                                status.max_age_days = Some(minutes / (60 * 24));
                            }
                        }
                        "requiresMixedCase" | "requiresSymbol" | "requiresNumeric" => {
                            if value == "1" {
                                status.complexity_required = Some(true);
                            }
                        }
                        "usingHistory" => {
                            status.history_count = value.parse().ok();
                        }
                        "maxFailedLoginAttempts" => {
                            status.lockout_threshold = value.parse().ok();
                        }
                        _ => {}
                    }
                }
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<PasswordPolicyStatus> {
        Ok(PasswordPolicyStatus {
            compliant: false,
            min_length: None,
            complexity_required: None,
            max_age_days: None,
            min_age_days: None,
            history_count: None,
            lockout_threshold: None,
            lockout_duration_minutes: None,
            complexity_modules: vec![],
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }

    /// Check compliance based on parsed status.
    fn check_compliance(&self, status: &PasswordPolicyStatus) -> Vec<String> {
        let mut issues = Vec::new();

        // Check minimum length
        if let Some(min_len) = status.min_length {
            if min_len < MIN_REQUIRED_LENGTH {
                issues.push(format!(
                    "Minimum password length ({}) is less than required ({})",
                    min_len, MIN_REQUIRED_LENGTH
                ));
            }
        } else {
            issues.push("Minimum password length not configured".to_string());
        }

        // Check complexity
        if let Some(complexity) = status.complexity_required {
            if !complexity {
                issues.push("Password complexity is not required".to_string());
            }
        } else {
            issues.push("Password complexity requirement not configured".to_string());
        }

        issues
    }

    /// Parse a numeric value from a line like "Minimum password length: 8"
    #[allow(dead_code)]
    fn parse_numeric_value(line: &str) -> Option<u32> {
        line.split(':')
            .next_back()
            .and_then(|s| s.trim().parse().ok())
    }

    /// Parse days value, handling "unlimited" and "(days)" suffix
    #[allow(dead_code)]
    fn parse_days_value(line: &str) -> Option<u32> {
        let value_part = line.split(':').next_back()?.trim();

        if value_part.to_lowercase().contains("unlimited")
            || value_part.to_lowercase().contains("never")
        {
            return Some(99999);
        }

        // Remove "(days)" suffix if present
        let clean = value_part
            .replace("(days)", "")
            .replace("days", "")
            .trim()
            .to_string();

        clean.parse().ok()
    }

    /// Parse config file value like "minlen = 14"
    #[allow(dead_code)]
    fn parse_config_value(line: &str) -> Option<u32> {
        line.split('=')
            .next_back()
            .and_then(|s| s.trim().parse().ok())
    }

    /// Extract integer from macOS plist line
    #[allow(dead_code)]
    fn extract_plist_integer(line: &str) -> Option<u32> {
        // Handle <integer>N</integer> format
        if line.contains("<integer>") {
            let start = line.find("<integer>")? + 9;
            let end = line.find("</integer>")?;
            return line.get(start..end)?.parse().ok();
        }

        // Handle key=value format
        if let Some((_, value)) = line.split_once('=') {
            return value.trim().parse().ok();
        }

        None
    }
}

impl Default for PasswordPolicyCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for PasswordPolicyCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        #[cfg(target_os = "windows")]
        let status = self.check_windows().await?;

        #[cfg(target_os = "linux")]
        let status = self.check_linux().await?;

        #[cfg(target_os = "macos")]
        let status = self.check_macos().await?;

        #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
        let status = self.check_unsupported().await?;

        let raw_data = serde_json::to_value(&status).unwrap_or_default();

        if status.compliant {
            let mut details = Vec::new();
            if let Some(len) = status.min_length {
                details.push(format!("min_length={}", len));
            }
            if let Some(true) = status.complexity_required {
                details.push("complexity=enabled".to_string());
            }
            if let Some(age) = status.max_age_days
                && age < 99999
            {
                details.push(format!("max_age={}d", age));
            }
            if let Some(history) = status.history_count {
                details.push(format!("history={}", history));
            }

            Ok(CheckOutput::pass(
                format!("Password policy is compliant: {}", details.join(", ")),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("Password policy issues: {}", status.issues.join("; ")),
                raw_data,
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_creation() {
        let check = PasswordPolicyCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Authentication);
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = PasswordPolicyCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_password_policy_status_serialization() {
        let status = PasswordPolicyStatus {
            compliant: true,
            min_length: Some(14),
            complexity_required: Some(true),
            max_age_days: Some(90),
            min_age_days: Some(1),
            history_count: Some(24),
            lockout_threshold: Some(5),
            lockout_duration_minutes: Some(30),
            complexity_modules: vec!["pam_pwquality".to_string()],
            issues: vec![],
            raw_output: "test output".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"min_length\":14"));
        assert!(json.contains("\"complexity_required\":true"));

        let parsed: PasswordPolicyStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.compliant);
        assert_eq!(parsed.min_length, Some(14));
    }

    #[test]
    fn test_compliance_check_pass() {
        let check = PasswordPolicyCheck::new();
        let status = PasswordPolicyStatus {
            compliant: true,
            min_length: Some(14),
            complexity_required: Some(true),
            max_age_days: Some(90),
            min_age_days: None,
            history_count: None,
            lockout_threshold: None,
            lockout_duration_minutes: None,
            complexity_modules: vec![],
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(issues.is_empty());
    }

    #[test]
    fn test_compliance_check_fail_length() {
        let check = PasswordPolicyCheck::new();
        let status = PasswordPolicyStatus {
            compliant: false,
            min_length: Some(8),
            complexity_required: Some(true),
            max_age_days: None,
            min_age_days: None,
            history_count: None,
            lockout_threshold: None,
            lockout_duration_minutes: None,
            complexity_modules: vec![],
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("less than required")));
    }

    #[test]
    fn test_compliance_check_fail_complexity() {
        let check = PasswordPolicyCheck::new();
        let status = PasswordPolicyStatus {
            compliant: false,
            min_length: Some(14),
            complexity_required: Some(false),
            max_age_days: None,
            min_age_days: None,
            history_count: None,
            lockout_threshold: None,
            lockout_duration_minutes: None,
            complexity_modules: vec![],
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("complexity")));
    }

    #[test]
    fn test_parse_numeric_value() {
        assert_eq!(
            PasswordPolicyCheck::parse_numeric_value("Minimum password length: 14"),
            Some(14)
        );
        assert_eq!(
            PasswordPolicyCheck::parse_numeric_value("Lockout threshold: 5"),
            Some(5)
        );
    }

    #[test]
    fn test_parse_days_value() {
        assert_eq!(
            PasswordPolicyCheck::parse_days_value("Maximum password age (days): 90"),
            Some(90)
        );
        assert_eq!(
            PasswordPolicyCheck::parse_days_value("Maximum password age: Unlimited"),
            Some(99999)
        );
    }

    #[test]
    fn test_parse_config_value() {
        assert_eq!(
            PasswordPolicyCheck::parse_config_value("minlen = 14"),
            Some(14)
        );
        assert_eq!(
            PasswordPolicyCheck::parse_config_value("remember=24"),
            Some(24)
        );
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = PasswordPolicyCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
