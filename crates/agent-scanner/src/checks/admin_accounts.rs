//! Local admin accounts compliance check.
//!
//! Audits local administrator accounts:
//! - Windows: Local Administrators group members
//! - Linux: Users with sudo/wheel or UID 0
//! - macOS: admin group members

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::ScannerResult;
#[cfg(target_os = "windows")]
use crate::error::ScannerError;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for admin accounts.
pub const CHECK_ID: &str = "admin_accounts";

/// Maximum recommended admin accounts before warning.
const MAX_RECOMMENDED_ADMINS: usize = 3;

/// Admin accounts status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminAccountsStatus {
    /// Total count of admin accounts.
    pub admin_count: u32,

    /// List of admin account names.
    #[serde(default)]
    pub admin_accounts: Vec<String>,

    /// Non-standard admin accounts (not built-in).
    #[serde(default)]
    pub non_standard_admins: Vec<String>,

    /// Whether root account is enabled (Linux).
    pub root_enabled: Option<bool>,

    /// Users with sudo access (Linux).
    #[serde(default)]
    pub sudo_users: Vec<String>,

    /// Users in wheel group (Linux).
    #[serde(default)]
    pub wheel_members: Vec<String>,

    /// Built-in admin account enabled (Windows).
    pub builtin_admin_enabled: Option<bool>,

    /// Whether configuration meets compliance requirements.
    pub compliant: bool,

    /// Non-compliance/warning reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Admin accounts compliance check.
pub struct AdminAccountsCheck {
    definition: CheckDefinition,
}

impl AdminAccountsCheck {
    /// Create a new admin accounts check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Local Admin Accounts")
            .description("Audit local administrator accounts (warning if > 3 admins)")
            .category(CheckCategory::Accounts)
            .severity(CheckSeverity::Medium)
            .framework("NIS2")
            .framework("DORA")
            .platforms(vec![
                "windows".to_string(),
                "linux".to_string(),
                "macos".to_string(),
            ])
            .build();

        Self { definition }
    }

    /// Check admin accounts on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<AdminAccountsStatus> {
        debug!("Checking Windows administrator accounts");

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $results = @{}

                # Get Local Administrators group members
                try {
                    $admins = Get-LocalGroupMember -Group 'Administrators' | Select-Object Name, ObjectClass, PrincipalSource
                    $results['Administrators'] = $admins | ForEach-Object {
                        @{
                            'Name' = $_.Name
                            'ObjectClass' = $_.ObjectClass.ToString()
                            'Source' = if ($_.PrincipalSource) { $_.PrincipalSource.ToString() } else { 'Local' }
                        }
                    }
                } catch {
                    # Fallback to net localgroup
                    $netOutput = net localgroup Administrators 2>&1
                    $results['NetOutput'] = $netOutput | Out-String
                }

                # Check if built-in Administrator is enabled
                try {
                    $builtinAdmin = Get-LocalUser -Name 'Administrator' -ErrorAction SilentlyContinue
                    if ($builtinAdmin) {
                        $results['BuiltinAdminEnabled'] = $builtinAdmin.Enabled
                    }
                } catch {}

                # Check Guest account status
                try {
                    $guest = Get-LocalUser -Name 'Guest' -ErrorAction SilentlyContinue
                    if ($guest) {
                        $results['GuestEnabled'] = $guest.Enabled
                    }
                } catch {}

                $results | ConvertTo-Json -Depth 3
                "#,
            ])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run PowerShell: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        let mut status = AdminAccountsStatus {
            admin_count: 0,
            admin_accounts: vec![],
            non_standard_admins: vec![],
            root_enabled: None,
            sudo_users: vec![],
            wheel_members: vec![],
            builtin_admin_enabled: None,
            compliant: false,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        // Standard Windows admin accounts
        let standard_admins = ["Administrator", "SYSTEM", "NT AUTHORITY\\SYSTEM"];

        // Parse JSON output
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw_output) {
            // Built-in admin status
            if let Some(enabled) = json.get("BuiltinAdminEnabled").and_then(|v| v.as_bool()) {
                status.builtin_admin_enabled = Some(enabled);
            }

            // Parse administrators
            if let Some(admins) = json.get("Administrators").and_then(|v| v.as_array()) {
                for admin in admins {
                    if let Some(name) = admin.get("Name").and_then(|v| v.as_str()) {
                        status.admin_accounts.push(name.to_string());
                        status.admin_count += 1;

                        // Check if non-standard
                        let is_standard = standard_admins.iter().any(|s| {
                            name.to_uppercase().contains(&s.to_uppercase())
                        });
                        if !is_standard {
                            status.non_standard_admins.push(name.to_string());
                        }
                    }
                }
            }

            // Fallback parsing from net localgroup output
            if status.admin_count == 0 {
                if let Some(output) = json.get("NetOutput").and_then(|v| v.as_str()) {
                    let mut in_members = false;
                    for line in output.lines() {
                        let line = line.trim();
                        if line.contains("---") {
                            in_members = true;
                            continue;
                        }
                        if in_members && !line.is_empty() && !line.starts_with("The command") {
                            status.admin_accounts.push(line.to_string());
                            status.admin_count += 1;

                            let is_standard = standard_admins.iter().any(|s| {
                                line.to_uppercase().contains(&s.to_uppercase())
                            });
                            if !is_standard {
                                status.non_standard_admins.push(line.to_string());
                            }
                        }
                    }
                }
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Check admin accounts on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<AdminAccountsStatus> {
        debug!("Checking Linux administrator accounts");

        let mut status = AdminAccountsStatus {
            admin_count: 0,
            admin_accounts: vec![],
            non_standard_admins: vec![],
            root_enabled: None,
            sudo_users: vec![],
            wheel_members: vec![],
            builtin_admin_enabled: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check root account status
        if let Ok(shadow) = std::fs::read_to_string("/etc/shadow") {
            for line in shadow.lines() {
                if line.starts_with("root:") {
                    let parts: Vec<&str> = line.split(':').collect();
                    if parts.len() > 1 {
                        let passwd_field = parts[1];
                        // Root is disabled if password starts with ! or *
                        status.root_enabled = Some(
                            !passwd_field.starts_with('!') && !passwd_field.starts_with('*')
                        );
                    }
                    break;
                }
            }
        }

        // Check wheel/sudo group members
        if let Ok(group) = std::fs::read_to_string("/etc/group") {
            status.raw_output.push_str(&format!("=== /etc/group (filtered) ===\n"));

            for line in group.lines() {
                if line.starts_with("wheel:") || line.starts_with("sudo:") {
                    status.raw_output.push_str(&format!("{}\n", line));

                    let parts: Vec<&str> = line.split(':').collect();
                    if parts.len() >= 4 {
                        let members: Vec<String> = parts[3]
                            .split(',')
                            .filter(|s| !s.is_empty())
                            .map(|s| s.to_string())
                            .collect();

                        if line.starts_with("wheel:") {
                            status.wheel_members = members.clone();
                        } else {
                            status.sudo_users = members.clone();
                        }

                        for member in members {
                            if !status.admin_accounts.contains(&member) {
                                status.admin_accounts.push(member.clone());
                                status.admin_count += 1;

                                // Non-standard if not root
                                if member != "root" {
                                    status.non_standard_admins.push(member);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Check sudoers for NOPASSWD and ALL access
        self.check_sudoers(&mut status);

        // Check for UID 0 accounts (besides root)
        if let Ok(passwd) = std::fs::read_to_string("/etc/passwd") {
            for line in passwd.lines() {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() >= 3 && parts[2] == "0" && parts[0] != "root" {
                    let username = parts[0].to_string();
                    status.raw_output.push_str(&format!("UID 0 account: {}\n", username));
                    if !status.admin_accounts.contains(&username) {
                        status.admin_accounts.push(username.clone());
                        status.admin_count += 1;
                        status.non_standard_admins.push(username);
                    }
                }
            }
        }

        // Add root to admin count if enabled
        if status.root_enabled == Some(true) && !status.admin_accounts.contains(&"root".to_string()) {
            status.admin_accounts.insert(0, "root".to_string());
            status.admin_count += 1;
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    #[cfg(target_os = "linux")]
    fn check_sudoers(&self, status: &mut AdminAccountsStatus) {
        // Collect all sudoers files to check
        let mut sudoers_paths = vec!["/etc/sudoers".to_string()];

        // Scan /etc/sudoers.d/ directory for additional configs
        if let Ok(entries) = std::fs::read_dir("/etc/sudoers.d") {
            for entry in entries.flatten() {
                let path = entry.path();
                // Skip hidden files and files ending in ~ (backups)
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if !name.starts_with('.') && !name.ends_with('~') && path.is_file() {
                        sudoers_paths.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }

        for path in &sudoers_paths {
            if let Ok(content) = std::fs::read_to_string(path) {
                status.raw_output.push_str(&format!("=== {} ===\n", path));

                for line in content.lines() {
                    let line = line.trim();
                    if line.starts_with('#') || line.is_empty() {
                        continue;
                    }

                    // Handle include directives
                    if line.starts_with("#include") || line.starts_with("@include") {
                        // Included files are handled by collecting all files in sudoers.d
                        continue;
                    }

                    // Check for ALL=(ALL) patterns - various formats
                    // User_Alias patterns, host patterns, etc.
                    let has_full_sudo = line.contains("ALL=(ALL)")
                        || line.contains("ALL=(ALL:ALL)")
                        || line.contains("ALL = (ALL)")
                        || line.contains("ALL = (ALL:ALL)");

                    if has_full_sudo {
                        status.raw_output.push_str(&format!("{}\n", line));

                        // Extract username (first token)
                        let username = line.split_whitespace().next().unwrap_or("");

                        // Skip group entries (%group), netgroups (@netgroup), and aliases
                        if !username.starts_with('%')
                            && !username.starts_with('@')
                            && !username.starts_with("User_Alias")
                            && !username.starts_with("Host_Alias")
                            && !username.starts_with("Cmnd_Alias")
                            && !username.starts_with("Defaults")
                        {
                            if !status.sudo_users.contains(&username.to_string()) {
                                status.sudo_users.push(username.to_string());
                            }
                        }
                    }

                    // Also check for NOPASSWD entries (security concern)
                    if line.contains("NOPASSWD") && !line.starts_with('#') {
                        debug!("Found NOPASSWD entry in {}: {}", path, line);
                    }
                }
            }
        }
    }

    /// Check admin accounts on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<AdminAccountsStatus> {
        debug!("Checking macOS administrator accounts");

        let mut status = AdminAccountsStatus {
            admin_count: 0,
            admin_accounts: vec![],
            non_standard_admins: vec![],
            root_enabled: None,
            sudo_users: vec![],
            wheel_members: vec![],
            builtin_admin_enabled: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Get admin group members
        if let Ok(output) = Command::new("dscl")
            .args([".", "-read", "/Groups/admin", "GroupMembership"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status.raw_output.push_str(&format!("=== dscl admin group ===\n{}\n", result));

            // Parse "GroupMembership: user1 user2 user3"
            if let Some(members_line) = result.lines().find(|l| l.contains("GroupMembership:")) {
                let members_str = members_line.replace("GroupMembership:", "").trim().to_string();
                for member in members_str.split_whitespace() {
                    status.admin_accounts.push(member.to_string());
                    status.admin_count += 1;

                    // Standard macOS admin accounts
                    if member != "root" && member != "_admin" {
                        status.non_standard_admins.push(member.to_string());
                    }
                }
            }
        }

        // Check if root is enabled
        if let Ok(output) = Command::new("dscl")
            .args([".", "-read", "/Users/root", "AuthenticationAuthority"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status.raw_output.push_str(&format!("Root status: {}\n", result.trim()));

            // Root is disabled if AuthenticationAuthority contains "DisabledUser"
            status.root_enabled = Some(!result.contains("DisabledUser"));
        }

        // Check for other users with admin capabilities
        if let Ok(output) = Command::new("dscacheutil")
            .args(["-q", "group", "-a", "name", "wheel"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status.raw_output.push_str(&format!("=== wheel group ===\n{}\n", result));

            for line in result.lines() {
                if line.starts_with("users:") {
                    let members = line.replace("users:", "").trim().to_string();
                    for member in members.split_whitespace() {
                        if !status.wheel_members.contains(&member.to_string()) {
                            status.wheel_members.push(member.to_string());
                        }
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
    async fn check_unsupported(&self) -> ScannerResult<AdminAccountsStatus> {
        Ok(AdminAccountsStatus {
            admin_count: 0,
            admin_accounts: vec![],
            non_standard_admins: vec![],
            root_enabled: None,
            sudo_users: vec![],
            wheel_members: vec![],
            builtin_admin_enabled: None,
            compliant: false,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }

    /// Check compliance based on parsed status.
    fn check_compliance(&self, status: &AdminAccountsStatus) -> Vec<String> {
        let mut issues = Vec::new();

        // Warning if too many admins
        if status.admin_count as usize > MAX_RECOMMENDED_ADMINS {
            issues.push(format!(
                "Too many admin accounts ({}) - recommended maximum is {}",
                status.admin_count, MAX_RECOMMENDED_ADMINS
            ));
        }

        // Warning for non-standard admins
        if !status.non_standard_admins.is_empty() {
            issues.push(format!(
                "Non-standard admin accounts detected: {}",
                status.non_standard_admins.join(", ")
            ));
        }

        issues
    }
}

impl Default for AdminAccountsCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for AdminAccountsCheck {
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
            Ok(CheckOutput::pass(
                format!(
                    "Admin accounts within limits: {} account(s) - {}",
                    status.admin_count,
                    status.admin_accounts.join(", ")
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("Admin account issues: {}", status.issues.join("; ")),
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
        let check = AdminAccountsCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Accounts);
        assert_eq!(check.definition().severity, CheckSeverity::Medium);
    }

    #[test]
    fn test_check_frameworks() {
        let check = AdminAccountsCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_admin_accounts_status_serialization() {
        let status = AdminAccountsStatus {
            admin_count: 2,
            admin_accounts: vec!["Administrator".to_string(), "JohnDoe".to_string()],
            non_standard_admins: vec!["JohnDoe".to_string()],
            root_enabled: None,
            sudo_users: vec![],
            wheel_members: vec![],
            builtin_admin_enabled: Some(false),
            compliant: true,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"admin_count\":2"));
        assert!(json.contains("Administrator"));

        let parsed: AdminAccountsStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.admin_count, 2);
        assert_eq!(parsed.admin_accounts.len(), 2);
    }

    #[test]
    fn test_compliance_check_pass() {
        let check = AdminAccountsCheck::new();
        let status = AdminAccountsStatus {
            admin_count: 2,
            admin_accounts: vec!["Administrator".to_string(), "root".to_string()],
            non_standard_admins: vec![],
            root_enabled: Some(true),
            sudo_users: vec![],
            wheel_members: vec![],
            builtin_admin_enabled: None,
            compliant: true,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(issues.is_empty());
    }

    #[test]
    fn test_compliance_check_fail_too_many() {
        let check = AdminAccountsCheck::new();
        let status = AdminAccountsStatus {
            admin_count: 5,
            admin_accounts: vec![
                "Administrator".to_string(),
                "User1".to_string(),
                "User2".to_string(),
                "User3".to_string(),
                "User4".to_string(),
            ],
            non_standard_admins: vec![],
            root_enabled: None,
            sudo_users: vec![],
            wheel_members: vec![],
            builtin_admin_enabled: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("Too many")));
    }

    #[test]
    fn test_compliance_check_warn_non_standard() {
        let check = AdminAccountsCheck::new();
        let status = AdminAccountsStatus {
            admin_count: 2,
            admin_accounts: vec!["Administrator".to_string(), "HackerAccount".to_string()],
            non_standard_admins: vec!["HackerAccount".to_string()],
            root_enabled: None,
            sudo_users: vec![],
            wheel_members: vec![],
            builtin_admin_enabled: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("Non-standard")));
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = AdminAccountsCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
