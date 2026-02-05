//! Security hardening and integrity features.
//!
//! This module provides:
//! - HMAC-SHA256 log signing for tamper detection
//! - Binary signature validation (Authenticode/GPG)
//! - Agent revocation handling

use crate::authenticated_client::AuthenticatedClient;
use crate::error::{SyncError, SyncResult};
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

/// HMAC-SHA256 type alias.
type HmacSha256 = Hmac<Sha256>;

/// Signed log entry with HMAC-SHA256 chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SignedLogEntry {
    /// Log sequence number.
    pub sequence: u64,
    /// Timestamp in ISO 8601 UTC.
    pub timestamp: DateTime<Utc>,
    /// Log level.
    pub level: String,
    /// Component/module name.
    pub component: String,
    /// Log message.
    pub message: String,
    /// Previous entry's HMAC (chain).
    pub previous_hash: String,
    /// HMAC-SHA256 signature of this entry.
    pub signature: String,
}

impl SignedLogEntry {
    /// Compute the canonical data to sign.
    fn canonical_data(&self) -> String {
        format!(
            "{}|{}|{}|{}|{}|{}",
            self.sequence,
            self.timestamp.to_rfc3339(),
            self.level,
            self.component,
            self.message,
            self.previous_hash
        )
    }
}

/// Log signer for HMAC-SHA256 log signing (NFR-S8).
pub struct LogSigner {
    /// HMAC key.
    key: Vec<u8>,
    /// Current sequence number.
    sequence: RwLock<u64>,
    /// Previous entry hash for chaining.
    previous_hash: RwLock<String>,
}

impl LogSigner {
    /// Create a new log signer with the given key.
    pub fn new(key: &[u8]) -> Self {
        Self {
            key: key.to_vec(),
            sequence: RwLock::new(0),
            previous_hash: RwLock::new("genesis".to_string()),
        }
    }

    /// Create a new log signer from hex-encoded key.
    pub fn from_hex_key(hex_key: &str) -> SyncResult<Self> {
        let key = hex::decode(hex_key)
            .map_err(|e| SyncError::Config(format!("Invalid HMAC key: {}", e)))?;
        Ok(Self::new(&key))
    }

    /// Sign a log entry.
    ///
    /// This creates a signed log entry with:
    /// - Incremented sequence number
    /// - Current timestamp
    /// - Hash of previous entry (chain)
    /// - HMAC-SHA256 signature
    pub async fn sign(
        &self,
        level: &str,
        component: &str,
        message: &str,
    ) -> SyncResult<SignedLogEntry> {
        let mut seq = self.sequence.write().await;
        let mut prev = self.previous_hash.write().await;

        *seq += 1;

        let entry = SignedLogEntry {
            sequence: *seq,
            timestamp: Utc::now(),
            level: level.to_string(),
            component: component.to_string(),
            message: message.to_string(),
            previous_hash: prev.clone(),
            signature: String::new(), // Will be filled
        };

        // Compute signature
        let canonical = entry.canonical_data();
        let signature = self.compute_hmac(&canonical)?;

        let signed_entry = SignedLogEntry {
            signature: signature.clone(),
            ..entry
        };

        // Update chain
        *prev = signature;

        Ok(signed_entry)
    }

    /// Verify a signed log entry.
    pub fn verify(&self, entry: &SignedLogEntry) -> SyncResult<bool> {
        // Recompute signature without the signature field
        let entry_for_verify = SignedLogEntry {
            signature: String::new(),
            ..entry.clone()
        };

        let canonical = entry_for_verify.canonical_data();
        let expected = self.compute_hmac(&canonical)?;

        Ok(expected.eq_ignore_ascii_case(&entry.signature))
    }

    /// Verify a chain of log entries.
    pub fn verify_chain(&self, entries: &[SignedLogEntry]) -> SyncResult<(bool, Vec<String>)> {
        let mut errors = Vec::new();
        let mut expected_prev = "genesis".to_string();
        let mut expected_seq = 0u64;

        for entry in entries {
            expected_seq += 1;

            // Check sequence
            if entry.sequence != expected_seq {
                errors.push(format!(
                    "Sequence mismatch at {}: expected {}, got {}",
                    entry.sequence, expected_seq, entry.sequence
                ));
            }

            // Check previous hash chain
            if entry.previous_hash != expected_prev {
                errors.push(format!(
                    "Chain broken at sequence {}: expected prev {}, got {}",
                    entry.sequence, expected_prev, entry.previous_hash
                ));
            }

            // Verify signature
            if !self.verify(entry)? {
                errors.push(format!("Invalid signature at sequence {}", entry.sequence));
            }

            expected_prev = entry.signature.clone();
        }

        Ok((errors.is_empty(), errors))
    }

    /// Compute HMAC-SHA256.
    fn compute_hmac(&self, data: &str) -> SyncResult<String> {
        let mut mac = HmacSha256::new_from_slice(&self.key)
            .map_err(|e| SyncError::Config(format!("Invalid HMAC key: {}", e)))?;

        mac.update(data.as_bytes());
        let result = mac.finalize();

        Ok(hex::encode(result.into_bytes()))
    }

    /// Get current sequence number.
    pub async fn sequence(&self) -> u64 {
        *self.sequence.read().await
    }

    /// Reset the signer (for testing).
    pub async fn reset(&self) {
        *self.sequence.write().await = 0;
        *self.previous_hash.write().await = "genesis".to_string();
    }

    /// Sign a string and return the signature (for LogEntry integration).
    ///
    /// # Panics
    /// Panics if HMAC computation fails due to invalid key configuration.
    /// This should never happen in production as keys are validated at construction.
    pub fn sign_data(&self, data: &str) -> String {
        self.compute_hmac(data).expect("HMAC computation failed - invalid key configuration")
    }

    /// Verify a signature against data (for LogEntry integration).
    pub fn verify_data(&self, data: &str, signature: &str) -> bool {
        match self.compute_hmac(data) {
            Ok(expected) => expected.eq_ignore_ascii_case(signature),
            Err(_) => false,
        }
    }
}

/// Binary signature type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SignatureType {
    /// Windows Authenticode signature.
    Authenticode,
    /// Linux GPG signature.
    Gpg,
    /// No signature.
    None,
}

impl SignatureType {
    /// Get the appropriate type for the current platform.
    pub fn for_current_platform() -> Self {
        #[cfg(windows)]
        return SignatureType::Authenticode;

        #[cfg(not(windows))]
        return SignatureType::Gpg;
    }
}

/// Result of signature verification.
#[derive(Debug, Clone)]
pub struct SignatureVerificationResult {
    /// Whether the signature is valid.
    pub valid: bool,
    /// Signature type.
    pub signature_type: SignatureType,
    /// Signer information (if available).
    pub signer: Option<String>,
    /// Certificate information (if available).
    pub certificate: Option<String>,
    /// Timestamp (if available).
    pub timestamp: Option<DateTime<Utc>>,
    /// Error message (if invalid).
    pub error: Option<String>,
}

/// Binary signature validator.
pub struct SignatureValidator {
    /// Trusted signer identities.
    trusted_signers: Vec<String>,
    /// Skip verification (for development/testing only).
    skip_verification: bool,
}

impl SignatureValidator {
    /// Create a new signature validator.
    pub fn new(trusted_signers: Vec<String>) -> Self {
        Self {
            trusted_signers,
            skip_verification: false,
        }
    }

    /// Create a validator that skips verification (DANGEROUS - dev only).
    ///
    /// # Safety
    /// This should ONLY be used in development/testing environments.
    /// In production, always use `new()` with proper trusted signers.
    pub fn skip_verification() -> Self {
        warn!("SignatureValidator created with skip_verification=true - THIS IS INSECURE");
        Self {
            trusted_signers: vec![],
            skip_verification: true,
        }
    }

    /// Verify a binary's signature.
    ///
    /// On Windows, uses Authenticode verification via PowerShell.
    /// On Linux, uses GPG verification.
    #[cfg(windows)]
    pub async fn verify_binary(
        &self,
        path: &std::path::Path,
    ) -> SyncResult<SignatureVerificationResult> {
        // Check if verification is skipped (dev mode)
        if self.skip_verification {
            warn!("Signature verification SKIPPED for {:?} - INSECURE", path);
            return Ok(SignatureVerificationResult {
                valid: true,
                signature_type: SignatureType::None,
                signer: None,
                certificate: None,
                timestamp: None,
                error: Some("Verification skipped (dev mode)".to_string()),
            });
        }

        info!("Verifying Authenticode signature for {:?}", path);

        // Use PowerShell Get-AuthenticodeSignature for verification
        let path_str = path.to_string_lossy();
        let output = tokio::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                &format!(
                    "$sig = Get-AuthenticodeSignature -FilePath '{}'; \
                     $json = @{{ \
                         Status = $sig.Status.ToString(); \
                         SignerCertificate = if($sig.SignerCertificate) {{ $sig.SignerCertificate.Subject }} else {{ $null }}; \
                         TimeStamperCertificate = if($sig.TimeStamperCertificate) {{ $sig.TimeStamperCertificate.Subject }} else {{ $null }}; \
                         StatusMessage = $sig.StatusMessage \
                     }}; \
                     $json | ConvertTo-Json -Compress",
                    path_str
                ),
            ])
            .output()
            .await
            .map_err(|e| SyncError::Config(format!("Failed to run PowerShell: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("Authenticode verification failed: {}", stderr);
            return Ok(SignatureVerificationResult {
                valid: false,
                signature_type: SignatureType::Authenticode,
                signer: None,
                certificate: None,
                timestamp: None,
                error: Some(format!("PowerShell error: {}", stderr)),
            });
        }

        let stdout = String::from_utf8_lossy(&output.stdout);

        // Parse JSON response
        #[derive(Deserialize)]
        #[serde(rename_all = "PascalCase")]
        struct AuthenticodeResult {
            status: String,
            signer_certificate: Option<String>,
            time_stamper_certificate: Option<String>,
            status_message: Option<String>,
        }

        let result: AuthenticodeResult = serde_json::from_str(&stdout)
            .map_err(|e| SyncError::Config(format!("Failed to parse Authenticode result: {}", e)))?;

        let valid = result.status == "Valid";

        if valid {
            info!(
                "Authenticode signature VALID for {:?}, signer: {:?}",
                path, result.signer_certificate
            );
        } else {
            warn!(
                "Authenticode signature INVALID for {:?}: {} - {}",
                path,
                result.status,
                result.status_message.as_deref().unwrap_or("No details")
            );
        }

        Ok(SignatureVerificationResult {
            valid,
            signature_type: SignatureType::Authenticode,
            signer: result.signer_certificate,
            certificate: result.time_stamper_certificate,
            timestamp: None,
            error: if valid { None } else { result.status_message },
        })
    }

    /// Verify a binary's signature (Linux/macOS).
    #[cfg(not(windows))]
    pub async fn verify_binary(
        &self,
        path: &std::path::Path,
    ) -> SyncResult<SignatureVerificationResult> {
        // Check if verification is skipped (dev mode)
        if self.skip_verification {
            warn!("Signature verification SKIPPED for {:?} - INSECURE", path);
            return Ok(SignatureVerificationResult {
                valid: true,
                signature_type: SignatureType::None,
                signer: None,
                certificate: None,
                timestamp: None,
                error: Some("Verification skipped (dev mode)".to_string()),
            });
        }

        info!("Verifying GPG signature for {:?}", path);

        // Check for detached signature file
        let sig_path = path.with_extension("sig");
        let asc_path = path.with_extension("asc");

        let signature_file = if sig_path.exists() {
            sig_path
        } else if asc_path.exists() {
            asc_path
        } else {
            warn!("No signature file found for {:?}", path);
            return Ok(SignatureVerificationResult {
                valid: false,
                signature_type: SignatureType::Gpg,
                signer: None,
                certificate: None,
                timestamp: None,
                error: Some("No detached signature file (.sig or .asc) found".to_string()),
            });
        };

        // Run GPG verification with status output for parsing
        let output = tokio::process::Command::new("gpg")
            .args([
                "--verify",
                "--status-fd=1",
                &signature_file.to_string_lossy(),
                &path.to_string_lossy(),
            ])
            .output()
            .await
            .map_err(|e| SyncError::Config(format!("Failed to run gpg: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        // Parse GPG status output
        // GOODSIG = valid signature from a known key
        // VALIDSIG = valid signature with fingerprint
        // BADSIG = bad signature
        // ERRSIG = error during verification
        // NO_PUBKEY = signing key not in keyring

        let valid = stdout.contains("[GNUPG:] GOODSIG") || stdout.contains("[GNUPG:] VALIDSIG");
        let bad_sig = stdout.contains("[GNUPG:] BADSIG");
        let no_pubkey = stdout.contains("[GNUPG:] NO_PUBKEY");

        // Extract signer information from GOODSIG line
        // Format: [GNUPG:] GOODSIG <keyid> <username>
        let signer = stdout
            .lines()
            .find(|line| line.contains("[GNUPG:] GOODSIG"))
            .and_then(|line| {
                let parts: Vec<&str> = line.splitn(4, ' ').collect();
                if parts.len() >= 4 {
                    Some(parts[3].to_string())
                } else {
                    None
                }
            });

        // Extract key fingerprint from VALIDSIG
        // Format: [GNUPG:] VALIDSIG <fingerprint> <creation_date> <sig_timestamp> ...
        let fingerprint = stdout
            .lines()
            .find(|line| line.contains("[GNUPG:] VALIDSIG"))
            .and_then(|line| {
                let parts: Vec<&str> = line.split(' ').collect();
                if parts.len() >= 3 {
                    Some(parts[2].to_string())
                } else {
                    None
                }
            });

        let error = if bad_sig {
            Some("Signature verification FAILED - signature is invalid".to_string())
        } else if no_pubkey {
            Some("Signing key not found in GPG keyring".to_string())
        } else if !valid && !output.status.success() {
            Some(format!("GPG error: {}", stderr.trim()))
        } else {
            None
        };

        if valid {
            info!(
                "GPG signature VALID for {:?}, signer: {:?}, fingerprint: {:?}",
                path, signer, fingerprint
            );
        } else {
            warn!(
                "GPG signature INVALID for {:?}: {:?}",
                path,
                error.as_deref().unwrap_or("Unknown error")
            );
        }

        Ok(SignatureVerificationResult {
            valid,
            signature_type: SignatureType::Gpg,
            signer,
            certificate: fingerprint,
            timestamp: None,
            error,
        })
    }

    /// Verify and block if signature is invalid (AC3).
    ///
    /// Returns Ok(()) if signature is valid and signer is trusted.
    /// Returns Err if signature is invalid or signer is not trusted.
    pub async fn verify_and_block(&self, path: &std::path::Path) -> SyncResult<()> {
        let result = self.verify_binary(path).await?;

        if !result.valid {
            error!(
                "Binary signature validation FAILED for {:?}: {}",
                path,
                result.error.as_deref().unwrap_or("Unknown error")
            );
            return Err(SyncError::Config(format!(
                "Binary signature invalid: {}",
                result.error.unwrap_or_else(|| "Unknown error".to_string())
            )));
        }

        // Check if signer is trusted
        if let Some(ref signer) = result.signer {
            if !self.is_trusted_signer(signer) {
                error!("Binary signer '{}' is not trusted for {:?}", signer, path);
                return Err(SyncError::Config(format!(
                    "Binary signer '{}' is not in trusted signers list",
                    signer
                )));
            }
            info!("Binary {:?} signed by trusted signer: {}", path, signer);
        } else if !self.skip_verification {
            warn!("No signer information available for {:?}", path);
        }

        Ok(())
    }

    /// Check if a signer is trusted.
    pub fn is_trusted_signer(&self, signer: &str) -> bool {
        self.trusted_signers
            .iter()
            .any(|s| s.eq_ignore_ascii_case(signer) || signer.contains(s))
    }
}

/// Agent revocation status.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct RevocationStatus {
    /// Whether the agent is revoked.
    pub revoked: bool,
    /// Reason for revocation.
    pub reason: Option<String>,
    /// Who revoked the agent.
    pub revoked_by: Option<String>,
    /// When the agent was revoked.
    pub revoked_at: Option<DateTime<Utc>>,
}

/// Revocation action to take when agent is revoked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RevocationAction {
    /// Continue normal operations (not revoked).
    Continue,
    /// Stop all operations and exit gracefully.
    StopAndExit,
    /// Stop sync but continue local operations.
    StopSyncOnly,
}

/// Service for handling agent revocation.
pub struct RevocationService {
    client: Arc<AuthenticatedClient>,
    /// Cached revocation status.
    status: RwLock<Option<RevocationStatus>>,
    /// Flag indicating operations should stop.
    should_stop: std::sync::atomic::AtomicBool,
}

impl RevocationService {
    /// Create a new revocation service.
    pub fn new(client: Arc<AuthenticatedClient>) -> Self {
        Self {
            client,
            status: RwLock::new(None),
            should_stop: std::sync::atomic::AtomicBool::new(false),
        }
    }

    /// Check revocation status from SaaS.
    pub async fn check_revocation(&self) -> SyncResult<RevocationStatus> {
        let agent_id = self.client.agent_id().await?;
        let path = format!("/v1/agents/{}/revocation", agent_id);

        match self.client.get::<RevocationStatus>(&path).await {
            Ok(status) => {
                *self.status.write().await = Some(status.clone());

                if status.revoked {
                    warn!("Agent {} is revoked: {:?}", agent_id, status.reason);
                    // Set the stop flag
                    self.should_stop
                        .store(true, std::sync::atomic::Ordering::SeqCst);
                }

                Ok(status)
            }
            Err(SyncError::ServerError { status: 404, .. }) => {
                // Not found means not revoked
                let status = RevocationStatus {
                    revoked: false,
                    reason: None,
                    revoked_by: None,
                    revoked_at: None,
                };
                *self.status.write().await = Some(status.clone());
                Ok(status)
            }
            Err(e) => Err(e),
        }
    }

    /// Get cached revocation status.
    pub async fn status(&self) -> Option<RevocationStatus> {
        self.status.read().await.clone()
    }

    /// Check if agent is revoked (from cache).
    pub async fn is_revoked(&self) -> bool {
        self.status
            .read()
            .await
            .as_ref()
            .map(|s| s.revoked)
            .unwrap_or(false)
    }

    /// Check if operations should stop (thread-safe).
    pub fn should_stop(&self) -> bool {
        self.should_stop.load(std::sync::atomic::Ordering::SeqCst)
    }

    /// Handle revocation by determining what action to take.
    ///
    /// Returns the action that should be taken based on revocation status.
    /// The caller is responsible for actually stopping operations.
    pub async fn handle_revocation(&self) -> SyncResult<RevocationAction> {
        let status = self.check_revocation().await?;

        if !status.revoked {
            return Ok(RevocationAction::Continue);
        }

        // Log the revocation event (AC4 - Audit)
        error!(
            "SECURITY: Agent has been REVOKED. Reason: {}. Revoked by: {}. At: {:?}",
            status.reason.as_deref().unwrap_or("No reason provided"),
            status.revoked_by.as_deref().unwrap_or("Unknown"),
            status.revoked_at
        );

        // Set the stop flag for other threads to check
        self.should_stop
            .store(true, std::sync::atomic::Ordering::SeqCst);

        // Return action for caller to execute
        Ok(RevocationAction::StopAndExit)
    }

    /// Check revocation and return error if revoked (for use in request guards).
    ///
    /// This method can be called before any sync operation to ensure
    /// the agent is not revoked.
    pub async fn ensure_not_revoked(&self) -> SyncResult<()> {
        if self.should_stop() {
            return Err(SyncError::Config("Agent has been revoked".to_string()));
        }

        // Also check cache
        if self.is_revoked().await {
            return Err(SyncError::Config("Agent has been revoked".to_string()));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_key() -> Vec<u8> {
        // 32-byte key for HMAC-SHA256
        hex::decode("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef").unwrap()
    }

    #[tokio::test]
    async fn test_log_signer_sign() {
        let signer = LogSigner::new(&test_key());

        let entry = signer.sign("INFO", "test", "Hello world").await.unwrap();

        assert_eq!(entry.sequence, 1);
        assert_eq!(entry.level, "INFO");
        assert_eq!(entry.component, "test");
        assert_eq!(entry.message, "Hello world");
        assert_eq!(entry.previous_hash, "genesis");
        assert!(!entry.signature.is_empty());
    }

    #[tokio::test]
    async fn test_log_signer_chain() {
        let signer = LogSigner::new(&test_key());

        let entry1 = signer.sign("INFO", "test", "First").await.unwrap();
        let entry2 = signer.sign("DEBUG", "test", "Second").await.unwrap();
        let entry3 = signer.sign("WARN", "test", "Third").await.unwrap();

        assert_eq!(entry1.sequence, 1);
        assert_eq!(entry2.sequence, 2);
        assert_eq!(entry3.sequence, 3);

        // Chain verification
        assert_eq!(entry1.previous_hash, "genesis");
        assert_eq!(entry2.previous_hash, entry1.signature);
        assert_eq!(entry3.previous_hash, entry2.signature);
    }

    #[tokio::test]
    async fn test_log_signer_verify() {
        let signer = LogSigner::new(&test_key());

        let entry = signer.sign("INFO", "test", "Verify me").await.unwrap();

        assert!(signer.verify(&entry).unwrap());
    }

    #[tokio::test]
    async fn test_log_signer_verify_tampered() {
        let signer = LogSigner::new(&test_key());

        let mut entry = signer.sign("INFO", "test", "Original").await.unwrap();
        entry.message = "Tampered".to_string();

        assert!(!signer.verify(&entry).unwrap());
    }

    #[tokio::test]
    async fn test_log_signer_verify_chain() {
        let signer = LogSigner::new(&test_key());

        let entry1 = signer.sign("INFO", "test", "First").await.unwrap();
        let entry2 = signer.sign("INFO", "test", "Second").await.unwrap();
        let entry3 = signer.sign("INFO", "test", "Third").await.unwrap();

        let entries = vec![entry1, entry2, entry3];
        let (valid, errors) = signer.verify_chain(&entries).unwrap();

        assert!(valid);
        assert!(errors.is_empty());
    }

    #[tokio::test]
    async fn test_log_signer_verify_broken_chain() {
        let signer = LogSigner::new(&test_key());

        let entry1 = signer.sign("INFO", "test", "First").await.unwrap();
        let mut entry2 = signer.sign("INFO", "test", "Second").await.unwrap();
        let entry3 = signer.sign("INFO", "test", "Third").await.unwrap();

        // Break the chain
        entry2.previous_hash = "wrong".to_string();

        let entries = vec![entry1, entry2, entry3];
        let (valid, errors) = signer.verify_chain(&entries).unwrap();

        assert!(!valid);
        assert!(!errors.is_empty());
    }

    #[tokio::test]
    async fn test_log_signer_reset() {
        let signer = LogSigner::new(&test_key());

        let _ = signer.sign("INFO", "test", "First").await.unwrap();
        assert_eq!(signer.sequence().await, 1);

        signer.reset().await;
        assert_eq!(signer.sequence().await, 0);

        let entry = signer.sign("INFO", "test", "After reset").await.unwrap();
        assert_eq!(entry.sequence, 1);
        assert_eq!(entry.previous_hash, "genesis");
    }

    #[test]
    fn test_log_signer_from_hex_key() {
        let key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let signer = LogSigner::from_hex_key(key);
        assert!(signer.is_ok());
    }

    #[test]
    fn test_log_signer_invalid_hex_key() {
        let signer = LogSigner::from_hex_key("invalid");
        assert!(signer.is_err());
    }

    #[test]
    fn test_signature_type_for_platform() {
        let sig_type = SignatureType::for_current_platform();
        // Just verify it returns a valid type
        assert!(sig_type == SignatureType::Authenticode || sig_type == SignatureType::Gpg);
    }

    #[test]
    fn test_signature_validator_trusted_signer() {
        let validator = SignatureValidator::new(vec![
            "Sentinel GRC".to_string(),
            "trusted@example.com".to_string(),
        ]);

        assert!(validator.is_trusted_signer("Sentinel GRC"));
        assert!(validator.is_trusted_signer("sentinel grc")); // Case insensitive
        assert!(validator.is_trusted_signer("Signed by Sentinel GRC Inc.")); // Contains
        assert!(!validator.is_trusted_signer("Unknown Signer"));
    }

    #[test]
    fn test_revocation_status_deserialization() {
        let json = r#"{
            "revoked": true,
            "reason": "Compromised",
            "revoked_by": "admin@example.com",
            "revoked_at": "2026-01-23T12:00:00Z"
        }"#;

        let status: RevocationStatus = serde_json::from_str(json).unwrap();
        assert!(status.revoked);
        assert_eq!(status.reason, Some("Compromised".to_string()));
    }

    #[test]
    fn test_revocation_status_not_revoked() {
        let json = r#"{
            "revoked": false
        }"#;

        let status: RevocationStatus = serde_json::from_str(json).unwrap();
        assert!(!status.revoked);
        assert!(status.reason.is_none());
    }

    #[test]
    fn test_signed_log_entry_serialization() {
        let entry = SignedLogEntry {
            sequence: 1,
            timestamp: Utc::now(),
            level: "INFO".to_string(),
            component: "test".to_string(),
            message: "Test message".to_string(),
            previous_hash: "genesis".to_string(),
            signature: "abc123".to_string(),
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("sequence"));
        assert!(json.contains("previous_hash"));
        assert!(json.contains("signature"));
    }

    #[test]
    fn test_signature_verification_result() {
        let result = SignatureVerificationResult {
            valid: true,
            signature_type: SignatureType::Gpg,
            signer: Some("Test Signer".to_string()),
            certificate: None,
            timestamp: Some(Utc::now()),
            error: None,
        };

        assert!(result.valid);
        assert_eq!(result.signature_type, SignatureType::Gpg);
    }

    #[test]
    fn test_sign_data() {
        let signer = LogSigner::new(&test_key());

        let data = "test data to sign";
        let signature = signer.sign_data(data);

        assert!(!signature.is_empty());
        // Signature should be hex-encoded HMAC-SHA256 (64 chars)
        assert_eq!(signature.len(), 64);
    }

    #[test]
    fn test_verify_data() {
        let signer = LogSigner::new(&test_key());

        let data = "test data to verify";
        let signature = signer.sign_data(data);

        assert!(signer.verify_data(data, &signature));
        assert!(!signer.verify_data("tampered data", &signature));
    }

    #[test]
    fn test_verify_data_case_insensitive() {
        let signer = LogSigner::new(&test_key());

        let data = "test data";
        let signature = signer.sign_data(data);
        let upper_signature = signature.to_uppercase();

        // Should work with uppercase signature
        assert!(signer.verify_data(data, &upper_signature));
    }

    #[tokio::test]
    async fn test_log_signing_performance() {
        let signer = LogSigner::new(&test_key());

        // Sign 100 entries and measure time
        let start = std::time::Instant::now();
        for i in 0..100 {
            let _ = signer
                .sign("INFO", "perf_test", &format!("Message {}", i))
                .await
                .unwrap();
        }
        let elapsed = start.elapsed();

        // Average should be < 1ms per entry (AC4)
        let avg_ms = elapsed.as_millis() as f64 / 100.0;
        assert!(
            avg_ms < 1.0,
            "Average signing time {}ms exceeds 1ms limit",
            avg_ms
        );
    }

    #[tokio::test]
    async fn test_verify_binary_rejects_by_default() {
        let validator = SignatureValidator::new(vec!["Trusted".to_string()]);

        // Create a temp file to test
        let temp_dir = tempfile::tempdir().unwrap();
        let test_file = temp_dir.path().join("test_binary");
        std::fs::write(&test_file, b"fake binary content").unwrap();

        let result = validator.verify_binary(&test_file).await.unwrap();

        // Should be invalid by default (security-by-default)
        assert!(!result.valid);
        assert!(result.error.is_some());
    }

    #[tokio::test]
    async fn test_verify_and_block() {
        let validator = SignatureValidator::new(vec!["Trusted".to_string()]);

        let temp_dir = tempfile::tempdir().unwrap();
        let test_file = temp_dir.path().join("test_binary");
        std::fs::write(&test_file, b"fake binary").unwrap();

        // Should fail because signature is invalid
        let result = validator.verify_and_block(&test_file).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_skip_verification_validator() {
        let validator = SignatureValidator::skip_verification();

        let temp_dir = tempfile::tempdir().unwrap();
        let test_file = temp_dir.path().join("test_binary");
        std::fs::write(&test_file, b"any content").unwrap();

        let result = validator.verify_binary(&test_file).await.unwrap();

        // Skip verification returns valid but with warning
        assert!(result.valid);
        assert!(result.error.as_ref().unwrap().contains("skipped"));
    }

    #[test]
    fn test_revocation_action_enum() {
        assert_eq!(RevocationAction::Continue, RevocationAction::Continue);
        assert_ne!(RevocationAction::Continue, RevocationAction::StopAndExit);
    }

    #[test]
    fn test_revocation_service_should_stop_initial() {
        // Can't test full RevocationService without client, but we can test the flag behavior
        // This would need integration testing with a mock client
    }
}
