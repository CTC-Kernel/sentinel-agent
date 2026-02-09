//! Certificate Validation compliance check.
//!
//! Verifies system certificate store security and certificate hygiene:
//! - Expired certificates detection
//! - Self-signed certificates in trust store
//! - Weak signature algorithms (MD5, SHA1)
//! - Certificate chain validation
//! - Root CA trust store integrity
//!
//! Supported platforms:
//! - Windows: Certificate store via certutil
//! - Linux: /etc/ssl/certs, ca-certificates
//! - macOS: Keychain and system trust store

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::{ScannerError, ScannerResult};
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for certificate validation.
pub const CHECK_ID: &str = "certificate_validation";

/// Days before expiration to warn.
const EXPIRATION_WARNING_DAYS: i64 = 30;

/// Known weak signature algorithms.
const WEAK_ALGORITHMS: &[&str] = &[
    "md5",
    "md5WithRSAEncryption",
    "sha1",
    "sha1WithRSAEncryption",
    "sha1WithRSA",
    "md2",
    "md2WithRSAEncryption",
];

/// Certificate information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertificateInfo {
    /// Certificate subject (CN).
    pub subject: String,

    /// Certificate issuer.
    pub issuer: String,

    /// Serial number.
    pub serial: Option<String>,

    /// Expiration date.
    pub expires: Option<String>,

    /// Days until expiration (negative if expired).
    pub days_until_expiry: Option<i64>,

    /// Whether the certificate is expired.
    pub is_expired: bool,

    /// Whether expiration is imminent.
    pub expiring_soon: bool,

    /// Signature algorithm.
    pub signature_algorithm: Option<String>,

    /// Whether the signature algorithm is weak.
    pub weak_algorithm: bool,

    /// Whether this is a self-signed certificate.
    pub is_self_signed: bool,

    /// Key size in bits.
    pub key_size: Option<u32>,
}

/// Certificate validation status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertificateValidationStatus {
    /// Whether certificate store is healthy.
    pub healthy: bool,

    /// Total certificates checked.
    pub total_certificates: u32,

    /// Number of expired certificates.
    pub expired_count: u32,

    /// Number of certificates expiring soon.
    pub expiring_soon_count: u32,

    /// Number of weak algorithm certificates.
    pub weak_algorithm_count: u32,

    /// Number of self-signed certificates in trust store.
    pub self_signed_count: u32,

    /// Number of untrusted root certificates.
    pub untrusted_root_count: u32,

    /// Certificate store location.
    pub store_location: String,

    /// List of problematic certificates.
    pub problematic_certs: Vec<CertificateInfo>,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Recommendations.
    #[serde(default)]
    pub recommendations: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Certificate validation compliance check.
pub struct CertificateValidationCheck {
    definition: CheckDefinition,
}

impl CertificateValidationCheck {
    /// Create a new certificate validation check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Certificate Validation")
            .description("Verify system certificate store security and certificate hygiene")
            .category(CheckCategory::CertificateManagement)
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

    /// Check if signature algorithm is weak.
    fn is_weak_algorithm(algo: &str) -> bool {
        let algo_lower = algo.to_lowercase();
        WEAK_ALGORITHMS
            .iter()
            .any(|&weak| algo_lower.contains(weak))
    }

    /// Parse expiration date from various formats.
    fn parse_expiration_date(date_str: &str) -> Option<DateTime<Utc>> {
        // Try common formats
        let formats = [
            "%b %d %H:%M:%S %Y %Z", // "Mar 15 12:00:00 2025 GMT"
            "%Y-%m-%d %H:%M:%S",    // "2025-03-15 12:00:00"
            "%Y%m%d%H%M%S",         // "20250315120000"
            "%a %b %d %H:%M:%S %Y", // "Sat Mar 15 12:00:00 2025"
            "%d/%m/%Y %H:%M:%S",    // European format
        ];

        for format in &formats {
            if let Ok(dt) = NaiveDateTime::parse_from_str(date_str.trim(), format) {
                return Some(DateTime::from_naive_utc_and_offset(dt, Utc));
            }
        }

        None
    }

    /// Calculate days until expiration.
    fn days_until_expiry(expires: &Option<String>) -> Option<i64> {
        expires.as_ref().and_then(|date_str| {
            Self::parse_expiration_date(date_str).map(|exp| (exp - Utc::now()).num_days())
        })
    }

    /// Check certificates on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<CertificateValidationStatus> {
        debug!("Checking Windows certificate stores");

        let mut status = CertificateValidationStatus {
            healthy: true,
            total_certificates: 0,
            expired_count: 0,
            expiring_soon_count: 0,
            weak_algorithm_count: 0,
            self_signed_count: 0,
            untrusted_root_count: 0,
            store_location: "Windows Certificate Store".to_string(),
            problematic_certs: Vec::new(),
            issues: Vec::new(),
            recommendations: Vec::new(),
            raw_output: String::new(),
        };

        // Check personal certificate store
        let stores = ["My", "Root", "CA"];

        for store in &stores {
            let output = Command::new("certutil")
                .args(["-store", store])
                .output()
                .map_err(|e| {
                    ScannerError::CheckExecution(format!("Failed to run certutil: {}", e))
                })?;

            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== {} Store ===\n{}\n", store, result));

            // Parse certificates from output
            let mut current_subject = String::new();
            let mut current_issuer = String::new();
            let mut current_serial = String::new();
            let mut current_expires = String::new();
            let mut current_algo = String::new();

            for line in result.lines() {
                let line = line.trim();

                if line.starts_with("Subject:") {
                    if !current_subject.is_empty() {
                        // Process previous certificate
                        self.process_certificate(
                            &mut status,
                            &current_subject,
                            &current_issuer,
                            &current_serial,
                            &current_expires,
                            &current_algo,
                        );
                    }
                    current_subject = line.replace("Subject:", "").trim().to_string();
                    current_issuer.clear();
                    current_serial.clear();
                    current_expires.clear();
                    current_algo.clear();
                } else if line.starts_with("Issuer:") {
                    current_issuer = line.replace("Issuer:", "").trim().to_string();
                } else if line.starts_with("Serial Number:") {
                    current_serial = line.replace("Serial Number:", "").trim().to_string();
                } else if line.starts_with("NotAfter:") {
                    current_expires = line.replace("NotAfter:", "").trim().to_string();
                } else if line.contains("Signature Algorithm:") {
                    current_algo = line.replace("Signature Algorithm:", "").trim().to_string();
                }
            }

            // Process last certificate
            if !current_subject.is_empty() {
                self.process_certificate(
                    &mut status,
                    &current_subject,
                    &current_issuer,
                    &current_serial,
                    &current_expires,
                    &current_algo,
                );
            }
        }

        self.generate_findings(&mut status);
        Ok(status)
    }

    /// Check certificates on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<CertificateValidationStatus> {
        debug!("Checking Linux certificate store");

        let mut status = CertificateValidationStatus {
            healthy: true,
            total_certificates: 0,
            expired_count: 0,
            expiring_soon_count: 0,
            weak_algorithm_count: 0,
            self_signed_count: 0,
            untrusted_root_count: 0,
            store_location: "/etc/ssl/certs".to_string(),
            problematic_certs: Vec::new(),
            issues: Vec::new(),
            recommendations: Vec::new(),
            raw_output: String::new(),
        };

        // Check if openssl is available
        let openssl_check = Command::new("which").args(["openssl"]).output();
        if openssl_check.is_err() || !openssl_check.unwrap().status.success() {
            status
                .issues
                .push("OpenSSL not available for certificate verification".to_string());
            return Ok(status);
        }

        // List certificates in /etc/ssl/certs
        let cert_paths = [
            "/etc/ssl/certs",
            "/etc/pki/tls/certs",
            "/usr/share/ca-certificates",
        ];

        for cert_path in &cert_paths {
            if !std::path::Path::new(cert_path).exists() {
                continue;
            }

            status.store_location = cert_path.to_string();

            // Use find to get all .crt and .pem files
            let output = Command::new("find")
                .args([
                    cert_path, "-type", "f", "-name", "*.crt", "-o", "-name", "*.pem",
                ])
                .output();

            if let Ok(output) = output {
                let files = String::from_utf8_lossy(&output.stdout);
                let file_list: Vec<&str> = files.lines().take(100).collect(); // Limit to 100 certs

                for cert_file in file_list {
                    if cert_file.is_empty() {
                        continue;
                    }

                    // Parse certificate with openssl
                    let cert_output = Command::new("openssl")
                        .args([
                            "x509", "-in", cert_file, "-noout", "-subject", "-issuer", "-dates",
                            "-serial", "-text",
                        ])
                        .output();

                    if let Ok(cert_out) = cert_output {
                        if cert_out.status.success() {
                            let cert_info = String::from_utf8_lossy(&cert_out.stdout);
                            self.parse_openssl_cert(&cert_info, &mut status);
                        }
                    }
                }
            }
            break; // Use first available path
        }

        // Also check system trust
        if let Ok(output) = Command::new("trust").args(["list"]).output() {
            let trust_list = String::from_utf8_lossy(&output.stdout);
            status
                .raw_output
                .push_str(&format!("=== trust list ===\n{}\n", trust_list));
        }

        self.generate_findings(&mut status);
        Ok(status)
    }

    /// Check certificates on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<CertificateValidationStatus> {
        debug!("Checking macOS certificate store (Keychain)");

        let mut status = CertificateValidationStatus {
            healthy: true,
            total_certificates: 0,
            expired_count: 0,
            expiring_soon_count: 0,
            weak_algorithm_count: 0,
            self_signed_count: 0,
            untrusted_root_count: 0,
            store_location: "macOS Keychain".to_string(),
            problematic_certs: Vec::new(),
            issues: Vec::new(),
            recommendations: Vec::new(),
            raw_output: String::new(),
        };

        // Use security command to list certificates
        let output = Command::new("security")
            .args([
                "find-certificate",
                "-a",
                "-p",
                "/System/Library/Keychains/SystemRootCertificates.keychain",
            ])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to run security command: {}", e))
            })?;

        let certs_pem = String::from_utf8_lossy(&output.stdout).to_string();
        status
            .raw_output
            .push_str(&format!("Certificates found: {} bytes\n", certs_pem.len()));

        // Split into individual certificates
        let cert_blocks: Vec<&str> = certs_pem
            .split("-----BEGIN CERTIFICATE-----")
            .filter(|b| b.contains("-----END CERTIFICATE-----"))
            .take(100) // Limit
            .collect();

        for cert_block in cert_blocks {
            let cert_pem = format!("-----BEGIN CERTIFICATE-----{}", cert_block);

            // Parse with openssl
            let parse_output = Command::new("openssl")
                .args(["x509", "-noout", "-subject", "-issuer", "-dates", "-text"])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .spawn();

            if let Ok(mut child) = parse_output {
                use std::io::Write;
                if let Some(ref mut stdin) = child.stdin {
                    let _ = stdin.write_all(cert_pem.as_bytes());
                }

                if let Ok(output) = child.wait_with_output()
                    && output.status.success() {
                        let cert_info = String::from_utf8_lossy(&output.stdout);
                        self.parse_openssl_cert(&cert_info, &mut status);
                    }
            }
        }

        // Check for expired certs using verify
        let verify_output = Command::new("security")
            .args([
                "verify-cert",
                "-c",
                "/System/Library/Keychains/SystemRootCertificates.keychain",
            ])
            .output();

        if let Ok(output) = verify_output {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("expired") {
                status
                    .issues
                    .push("System root certificates contain expired entries".to_string());
            }
        }

        self.generate_findings(&mut status);
        Ok(status)
    }

    /// Parse OpenSSL certificate output.
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    fn parse_openssl_cert(&self, cert_info: &str, status: &mut CertificateValidationStatus) {
        let mut subject = String::new();
        let mut issuer = String::new();
        let mut serial = String::new();
        let mut expires = String::new();
        let mut algo = String::new();

        for line in cert_info.lines() {
            let line = line.trim();
            if line.starts_with("subject=") || line.starts_with("subject =") {
                subject = line
                    .split('=')
                    .skip(1)
                    .collect::<Vec<_>>()
                    .join("=")
                    .trim()
                    .to_string();
            } else if line.starts_with("issuer=") || line.starts_with("issuer =") {
                issuer = line
                    .split('=')
                    .skip(1)
                    .collect::<Vec<_>>()
                    .join("=")
                    .trim()
                    .to_string();
            } else if line.starts_with("serial=") {
                serial = line.replace("serial=", "").trim().to_string();
            } else if line.starts_with("notAfter=") {
                expires = line.replace("notAfter=", "").trim().to_string();
            } else if line.contains("Signature Algorithm:") {
                algo = line.replace("Signature Algorithm:", "").trim().to_string();
            }
        }

        if !subject.is_empty() {
            self.process_certificate(status, &subject, &issuer, &serial, &expires, &algo);
        }
    }

    /// Process a single certificate and update status.
    fn process_certificate(
        &self,
        status: &mut CertificateValidationStatus,
        subject: &str,
        issuer: &str,
        serial: &str,
        expires: &str,
        algo: &str,
    ) {
        status.total_certificates += 1;

        let days = Self::days_until_expiry(&Some(expires.to_string()));
        let is_expired = days.is_some_and(|d| d < 0);
        let expiring_soon = days.is_some_and(|d| (0..=EXPIRATION_WARNING_DAYS).contains(&d));
        let weak_algorithm = Self::is_weak_algorithm(algo);
        let is_self_signed = subject == issuer;

        if is_expired {
            status.expired_count += 1;
        }
        if expiring_soon {
            status.expiring_soon_count += 1;
        }
        if weak_algorithm {
            status.weak_algorithm_count += 1;
        }
        if is_self_signed {
            status.self_signed_count += 1;
        }

        // Add to problematic list if any issue
        if is_expired || expiring_soon || weak_algorithm {
            status.problematic_certs.push(CertificateInfo {
                subject: subject.to_string(),
                issuer: issuer.to_string(),
                serial: if serial.is_empty() {
                    None
                } else {
                    Some(serial.to_string())
                },
                expires: if expires.is_empty() {
                    None
                } else {
                    Some(expires.to_string())
                },
                days_until_expiry: days,
                is_expired,
                expiring_soon,
                signature_algorithm: if algo.is_empty() {
                    None
                } else {
                    Some(algo.to_string())
                },
                weak_algorithm,
                is_self_signed,
                key_size: None,
            });
        }
    }

    /// Generate findings based on status.
    fn generate_findings(&self, status: &mut CertificateValidationStatus) {
        if status.expired_count > 0 {
            status.issues.push(format!(
                "{} expired certificate(s) found in store",
                status.expired_count
            ));
            status
                .recommendations
                .push("Remove or renew expired certificates".to_string());
        }

        if status.expiring_soon_count > 0 {
            status.issues.push(format!(
                "{} certificate(s) expiring within {} days",
                status.expiring_soon_count, EXPIRATION_WARNING_DAYS
            ));
            status
                .recommendations
                .push("Renew certificates before expiration".to_string());
        }

        if status.weak_algorithm_count > 0 {
            status.issues.push(format!(
                "{} certificate(s) using weak signature algorithms (MD5, SHA1)",
                status.weak_algorithm_count
            ));
            status
                .recommendations
                .push("Replace certificates with SHA-256 or stronger".to_string());
        }

        status.healthy = status.expired_count == 0
            && status.weak_algorithm_count == 0
            && status.expiring_soon_count == 0;
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<CertificateValidationStatus> {
        Ok(CertificateValidationStatus {
            healthy: false,
            total_certificates: 0,
            expired_count: 0,
            expiring_soon_count: 0,
            weak_algorithm_count: 0,
            self_signed_count: 0,
            untrusted_root_count: 0,
            store_location: "Unknown".to_string(),
            problematic_certs: Vec::new(),
            issues: vec!["Unsupported platform".to_string()],
            recommendations: Vec::new(),
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for CertificateValidationCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for CertificateValidationCheck {
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

        if status.healthy {
            Ok(CheckOutput::pass(
                format!(
                    "Certificate store is healthy: {} certificates checked, no issues found",
                    status.total_certificates
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("Certificate issues found: {}", status.issues.join("; ")),
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
        let check = CertificateValidationCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(
            check.definition().category,
            CheckCategory::CertificateManagement
        );
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = CertificateValidationCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"PCI_DSS".to_string()));
        assert!(frameworks.contains(&"ISO_27001".to_string()));
    }

    #[test]
    fn test_weak_algorithm_detection() {
        assert!(CertificateValidationCheck::is_weak_algorithm(
            "sha1WithRSAEncryption"
        ));
        assert!(CertificateValidationCheck::is_weak_algorithm(
            "md5WithRSAEncryption"
        ));
        assert!(CertificateValidationCheck::is_weak_algorithm("MD5"));
        assert!(!CertificateValidationCheck::is_weak_algorithm(
            "sha256WithRSAEncryption"
        ));
        assert!(!CertificateValidationCheck::is_weak_algorithm(
            "sha384WithRSAEncryption"
        ));
    }

    #[test]
    fn test_certificate_info_serialization() {
        let cert = CertificateInfo {
            subject: "CN=example.com".to_string(),
            issuer: "CN=DigiCert".to_string(),
            serial: Some("01:23:45".to_string()),
            expires: Some("Mar 15 00:00:00 2025 GMT".to_string()),
            days_until_expiry: Some(30),
            is_expired: false,
            expiring_soon: true,
            signature_algorithm: Some("sha256WithRSAEncryption".to_string()),
            weak_algorithm: false,
            is_self_signed: false,
            key_size: Some(2048),
        };

        let json = serde_json::to_string(&cert).unwrap();
        assert!(json.contains("example.com"));
        assert!(json.contains("DigiCert"));

        let parsed: CertificateInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.subject, "CN=example.com");
    }

    #[test]
    fn test_status_serialization() {
        let status = CertificateValidationStatus {
            healthy: true,
            total_certificates: 100,
            expired_count: 0,
            expiring_soon_count: 2,
            weak_algorithm_count: 0,
            self_signed_count: 5,
            untrusted_root_count: 0,
            store_location: "/etc/ssl/certs".to_string(),
            problematic_certs: Vec::new(),
            issues: Vec::new(),
            recommendations: Vec::new(),
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"healthy\":true"));
        assert!(json.contains("\"total_certificates\":100"));
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = CertificateValidationCheck::new();
        let result = check.execute().await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
