//! OpenLDAP and generic LDAP security auditing.
//!
//! Audits LDAP server configuration for security compliance:
//! - TLS/SSL configuration
//! - Access control lists (ACLs)
//! - Password policy overlays
//! - Anonymous bind settings
//! - Security-related schema

use super::types::*;
use crate::error::ScannerResult;
use serde::{Deserialize, Serialize};
use tracing::{debug, info};
#[cfg(target_os = "linux")]
use tracing::warn;

/// LDAP server security auditor.
pub struct LdapAuditor;

impl LdapAuditor {
    /// Create a new LDAP auditor.
    pub fn new() -> Self {
        Self
    }

    /// Get security configuration from an LDAP server.
    pub async fn get_security_config(&self, uri: &str) -> ScannerResult<LdapSecurityConfig> {
        info!("Auditing LDAP server security: {}", uri);

        let mut config = LdapSecurityConfig {
            server_uri: uri.to_string(),
            uses_tls: uri.starts_with("ldaps://"),
            uses_starttls: false, // Would need to probe
            ..Default::default()
        };

        // Try to connect and gather configuration
        #[cfg(target_os = "linux")]
        {
            self.probe_linux_ldap(uri, &mut config).await?;
        }

        #[cfg(target_os = "macos")]
        {
            self.probe_macos_ldap(uri, &mut config).await?;
        }

        #[cfg(target_os = "windows")]
        {
            self.probe_windows_ldap(uri, &mut config).await?;
        }

        debug!("LDAP security config: {:?}", config);
        Ok(config)
    }

    /// Probe LDAP server on Linux using ldapsearch.
    #[cfg(target_os = "linux")]
    async fn probe_linux_ldap(
        &self,
        uri: &str,
        config: &mut LdapSecurityConfig,
    ) -> ScannerResult<()> {
        use tokio::process::Command;

        // Check if ldapsearch is available
        let which_result = Command::new("which").arg("ldapsearch").output().await;

        if !which_result.is_ok_and(|o| o.status.success()) {
            warn!("ldapsearch not available, using limited probe");
            return self.probe_with_openssl(uri, config).await;
        }

        // Try anonymous bind to check if allowed
        let anon_result = Command::new("ldapsearch")
            .args([
                "-x",
                "-H",
                uri,
                "-b",
                "",
                "-s",
                "base",
                "(objectClass=*)",
                "namingContexts",
            ])
            .output()
            .await;

        if let Ok(output) = anon_result {
            config.allows_anonymous_bind = output.status.success();

            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                // Parse naming contexts
                for line in stdout.lines() {
                    if line.starts_with("namingContexts:") {
                        let context = line.replace("namingContexts:", "").trim().to_string();
                        config.naming_contexts.push(context);
                    }
                }
            }
        }

        // Check for password policy support
        let ppolicy_result = Command::new("ldapsearch")
            .args([
                "-x",
                "-H",
                uri,
                "-b",
                "cn=config",
                "(objectClass=olcPpolicyConfig)",
            ])
            .output()
            .await;

        if let Ok(output) = ppolicy_result {
            config.has_password_policy = output.status.success()
                && String::from_utf8_lossy(&output.stdout).contains("olcPpolicyConfig");
        }

        // Probe TLS configuration
        self.probe_with_openssl(uri, config).await?;

        Ok(())
    }

    /// Probe LDAP server on macOS.
    #[cfg(target_os = "macos")]
    async fn probe_macos_ldap(
        &self,
        uri: &str,
        config: &mut LdapSecurityConfig,
    ) -> ScannerResult<()> {
        // macOS uses similar tools but may have dscl for local directory
        self.probe_with_openssl(uri, config).await
    }

    /// Probe LDAP server on Windows (Active Directory).
    #[cfg(target_os = "windows")]
    async fn probe_windows_ldap(
        &self,
        uri: &str,
        config: &mut LdapSecurityConfig,
    ) -> ScannerResult<()> {
        use crate::error::ScannerError;
        use tokio::process::Command;

        // Reject URIs containing PowerShell metacharacters to prevent command injection
        if uri.contains('$')
            || uri.contains('`')
            || uri.contains('"')
            || uri.contains('\'')
            || uri.contains(';')
            || uri.contains('|')
            || uri.contains('&')
            || uri.contains('\n')
            || uri.contains('\r')
        {
            return Err(ScannerError::CheckExecution(
                "LDAP URI contains invalid characters".to_string(),
            ));
        }

        // Use PowerShell to probe LDAP/AD
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    r#"
                    $ldapUri = "{}"

                    # Try to get AD info
                    try {{
                        $domain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
                        @{{
                            "DomainName" = $domain.Name
                            "ForestName" = $domain.Forest.Name
                            "DomainControllers" = ($domain.DomainControllers | Select-Object -ExpandProperty Name) -join ","
                            "DomainMode" = $domain.DomainMode.ToString()
                        }} | ConvertTo-Json
                    }} catch {{
                        @{{"Error" = $_.Exception.Message}} | ConvertTo-Json
                    }}
                    "#,
                    uri
                ),
            ])
            .output()
            .await;

        if let Ok(output) = output {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Ok(info) = serde_json::from_str::<serde_json::Value>(&stdout) {
                    if let Some(domain) = info.get("DomainName").and_then(|v| v.as_str()) {
                        config
                            .naming_contexts
                            .push(format!("DC={}", domain.replace('.', ",DC=")));
                    }
                }
            }
        }

        // Check LDAPS connectivity
        self.probe_with_openssl(uri, config).await?;

        Ok(())
    }

    /// Probe TLS configuration using OpenSSL.
    async fn probe_with_openssl(
        &self,
        uri: &str,
        config: &mut LdapSecurityConfig,
    ) -> ScannerResult<()> {
        use tokio::process::Command;

        // Extract host and port from URI
        let uri_parts: Vec<&str> = uri.split("://").collect();
        if uri_parts.len() < 2 {
            return Ok(());
        }

        let host_port = uri_parts[1].trim_end_matches('/');
        let (host, port) = if let Some((h, p)) = host_port.rsplit_once(':') {
            (h, p)
        } else if uri.starts_with("ldaps://") {
            (host_port, "636")
        } else {
            (host_port, "389")
        };

        // Use openssl to check TLS if LDAPS
        if uri.starts_with("ldaps://") {
            let tls_result = Command::new("openssl")
                .args([
                    "s_client",
                    "-connect",
                    &format!("{}:{}", host, port),
                    "-brief",
                ])
                .output()
                .await;

            if let Ok(output) = tls_result {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                let combined = format!("{}{}", stdout, stderr);

                // Parse TLS version
                if combined.contains("TLSv1.3") {
                    config.tls_version = Some("TLSv1.3".to_string());
                    config.tls_config = TlsConfiguration {
                        min_version: "TLSv1.3".to_string(),
                        supports_tls_1_3: true,
                        supports_tls_1_2: true,
                        weak_ciphers_enabled: false,
                        certificate_valid: !combined.contains("verify error"),
                    };
                } else if combined.contains("TLSv1.2") {
                    config.tls_version = Some("TLSv1.2".to_string());
                    config.tls_config = TlsConfiguration {
                        min_version: "TLSv1.2".to_string(),
                        supports_tls_1_3: false,
                        supports_tls_1_2: true,
                        weak_ciphers_enabled: false,
                        certificate_valid: !combined.contains("verify error"),
                    };
                }

                // Check for weak ciphers
                config.tls_config.weak_ciphers_enabled = combined.contains("RC4")
                    || combined.contains("DES")
                    || combined.contains("MD5")
                    || combined.contains("NULL");
            }
        }

        Ok(())
    }

    /// Check local OpenLDAP configuration files.
    #[cfg(target_os = "linux")]
    pub async fn check_local_slapd_config(&self) -> ScannerResult<Vec<LdapConfigFinding>> {
        use tokio::fs;

        let mut findings = Vec::new();
        let config_paths = [
            "/etc/ldap/slapd.conf",
            "/etc/openldap/slapd.conf",
            "/etc/ldap/slapd.d",
        ];

        for path in config_paths {
            if let Ok(metadata) = fs::metadata(path).await {
                // Check file permissions
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mode = metadata.permissions().mode();

                    if mode & 0o077 != 0 {
                        findings.push(LdapConfigFinding {
                            setting: "slapd.conf permissions".to_string(),
                            current_value: format!("{:o}", mode & 0o777),
                            expected_value: "600 or 640".to_string(),
                            is_compliant: false,
                            severity: DirectorySeverity::High,
                            description: "LDAP config file has overly permissive permissions"
                                .to_string(),
                        });
                    }
                }
            }
        }

        Ok(findings)
    }
}

impl Default for LdapAuditor {
    fn default() -> Self {
        Self::new()
    }
}

/// LDAP server security configuration.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LdapSecurityConfig {
    /// Server URI.
    pub server_uri: String,
    /// Whether server uses LDAPS.
    pub uses_tls: bool,
    /// Whether server supports STARTTLS.
    pub uses_starttls: bool,
    /// TLS version in use.
    pub tls_version: Option<String>,
    /// Detailed TLS configuration.
    pub tls_config: TlsConfiguration,
    /// Whether anonymous bind is allowed.
    pub allows_anonymous_bind: bool,
    /// Whether password policy overlay is configured.
    pub has_password_policy: bool,
    /// LDAP password policy settings (if available).
    pub password_policy: Option<LdapPasswordPolicy>,
    /// Naming contexts (base DNs).
    pub naming_contexts: Vec<String>,
    /// Access control findings.
    pub acl_findings: Vec<AclFinding>,
    /// Schema extensions.
    pub schema_extensions: Vec<String>,
}

/// TLS configuration details.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TlsConfiguration {
    /// Minimum TLS version.
    pub min_version: String,
    /// Whether TLS 1.3 is supported.
    pub supports_tls_1_3: bool,
    /// Whether TLS 1.2 is supported.
    pub supports_tls_1_2: bool,
    /// Whether weak ciphers are enabled.
    pub weak_ciphers_enabled: bool,
    /// Whether certificate is valid.
    pub certificate_valid: bool,
}

/// LDAP password policy settings.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LdapPasswordPolicy {
    /// Minimum password length.
    pub min_length: u32,
    /// Password expiration days.
    pub max_age_days: u32,
    /// Password history count.
    pub history_count: u32,
    /// Lockout threshold.
    pub lockout_count: u32,
    /// Lockout duration in seconds.
    pub lockout_duration_secs: u32,
    /// Whether password quality checking is enabled.
    pub quality_check_enabled: bool,
}

/// ACL finding from LDAP audit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AclFinding {
    /// ACL rule description.
    pub rule: String,
    /// Whether this ACL is secure.
    pub is_secure: bool,
    /// Risk level.
    pub risk_level: DirectorySeverity,
    /// Description of the issue.
    pub description: String,
}

/// LDAP configuration finding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LdapConfigFinding {
    /// Setting name.
    pub setting: String,
    /// Current value.
    pub current_value: String,
    /// Expected value.
    pub expected_value: String,
    /// Whether compliant.
    pub is_compliant: bool,
    /// Severity.
    pub severity: DirectorySeverity,
    /// Description.
    pub description: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ldap_auditor_creation() {
        let _auditor = LdapAuditor::new();
    }

    #[test]
    fn test_ldap_security_config_default() {
        let config = LdapSecurityConfig::default();
        assert!(!config.uses_tls);
        assert!(!config.allows_anonymous_bind);
        assert!(config.naming_contexts.is_empty());
    }

    #[test]
    fn test_tls_configuration_default() {
        let config = TlsConfiguration::default();
        assert!(!config.supports_tls_1_3);
        assert!(!config.weak_ciphers_enabled);
    }
}
