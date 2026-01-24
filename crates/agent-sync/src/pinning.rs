//! Certificate pinning for server validation.
//!
//! This module provides certificate pinning to prevent MITM attacks
//! even with compromised certificate authorities.
//!
//! # Fingerprint Format
//!
//! Fingerprints are stored as `sha256:<hex-encoded-hash>` strings.
//! Example: `sha256:abc123def456...`
//!
//! # Usage
//!
//! ```no_run
//! use agent_sync::pinning::CertificatePinning;
//!
//! # async fn example() {
//! let pins = vec![
//!     "sha256:abc123...".to_string(),
//!     "sha256:def456...".to_string(), // backup pin
//! ];
//!
//! let pinning = CertificatePinning::new(pins);
//!
//! // Verify a certificate fingerprint
//! let cert_fingerprint = "sha256:abc123...";
//! if pinning.verify(cert_fingerprint).await.is_ok() {
//!     println!("Certificate verified!");
//! }
//! # }
//! ```

use crate::credentials::CredentialsRepository;
use crate::error::{SyncError, SyncResult};
use agent_storage::Database;
use sha2::{Digest, Sha256};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Prefix for SHA-256 fingerprints.
const SHA256_PREFIX: &str = "sha256:";

/// Certificate pinning validator.
///
/// Maintains a list of trusted server certificate fingerprints
/// and validates connections against them.
#[derive(Debug)]
pub struct CertificatePinning {
    /// List of pinned fingerprints (primary + backups).
    pins: RwLock<Vec<String>>,
    /// Whether pinning is enabled (disabled if no pins configured).
    enabled: RwLock<bool>,
}

impl CertificatePinning {
    /// Create a new certificate pinning validator.
    ///
    /// # Arguments
    /// * `pins` - List of trusted fingerprints in `sha256:<hex>` format
    pub fn new(pins: Vec<String>) -> Self {
        let enabled = !pins.is_empty();
        if enabled {
            info!("Certificate pinning enabled with {} pin(s)", pins.len());
        } else {
            warn!("Certificate pinning disabled (no pins configured)");
        }

        Self {
            pins: RwLock::new(pins),
            enabled: RwLock::new(enabled),
        }
    }

    /// Create a certificate pinning validator from stored credentials.
    pub async fn from_credentials(db: &Database) -> SyncResult<Self> {
        let repo = CredentialsRepository::new(db);

        match repo.load().await? {
            Some(credentials) => {
                debug!(
                    "Loaded {} server fingerprints from credentials",
                    credentials.server_fingerprints.len()
                );
                Ok(Self::new(credentials.server_fingerprints))
            }
            None => {
                debug!("No credentials found, certificate pinning disabled");
                Ok(Self::new(vec![]))
            }
        }
    }

    /// Check if certificate pinning is enabled.
    pub async fn is_enabled(&self) -> bool {
        *self.enabled.read().await
    }

    /// Get the number of configured pins.
    pub async fn pin_count(&self) -> usize {
        self.pins.read().await.len()
    }

    /// Verify a certificate fingerprint against the pinned values.
    ///
    /// # Arguments
    /// * `fingerprint` - The fingerprint to verify in `sha256:<hex>` format
    ///
    /// # Returns
    /// * `Ok(())` if the fingerprint matches any pinned value
    /// * `Err(SyncError::CertificateValidation)` if no match found
    pub async fn verify(&self, fingerprint: &str) -> SyncResult<()> {
        if !*self.enabled.read().await {
            debug!("Certificate pinning disabled, skipping verification");
            return Ok(());
        }

        let pins = self.pins.read().await;
        let normalized = Self::normalize_fingerprint(fingerprint);

        for pin in pins.iter() {
            let normalized_pin = Self::normalize_fingerprint(pin);
            if normalized == normalized_pin {
                debug!("Certificate fingerprint verified against pin");
                return Ok(());
            }
        }

        // No match found - log details
        error!(
            "Certificate pinning validation FAILED. Received fingerprint: {}",
            fingerprint
        );
        error!("Expected one of {} pinned fingerprint(s)", pins.len());

        // Log first few characters of each pin for debugging (not full pin for security)
        for (i, pin) in pins.iter().enumerate() {
            let preview = if pin.len() > 20 {
                format!("{}...", &pin[..20])
            } else {
                pin.clone()
            };
            error!("  Pin {}: {}", i + 1, preview);
        }

        Err(SyncError::CertificateValidation(format!(
            "Server certificate fingerprint does not match any pinned value. \
             Received: {}, Expected one of {} pins",
            Self::fingerprint_preview(fingerprint),
            pins.len()
        )))
    }

    /// Verify a raw certificate (DER-encoded) against pinned fingerprints.
    ///
    /// Computes the SHA-256 hash of the certificate and verifies it.
    pub async fn verify_certificate(&self, cert_der: &[u8]) -> SyncResult<()> {
        let fingerprint = Self::compute_fingerprint(cert_der);
        self.verify(&fingerprint).await
    }

    /// Update the pinned fingerprints.
    ///
    /// This should be called when new fingerprints are received from the SaaS.
    pub async fn update_pins(&self, new_pins: Vec<String>) {
        if new_pins.is_empty() {
            warn!("Received empty pin list, keeping existing pins");
            return;
        }

        let mut pins = self.pins.write().await;
        let mut enabled = self.enabled.write().await;

        let old_count = pins.len();
        *pins = new_pins;
        *enabled = !pins.is_empty();

        info!(
            "Certificate pins updated: {} -> {} pin(s)",
            old_count,
            pins.len()
        );
    }

    /// Add a backup pin.
    ///
    /// Backup pins are used during certificate rotation to allow
    /// both old and new certificates temporarily.
    pub async fn add_backup_pin(&self, fingerprint: String) {
        let mut pins = self.pins.write().await;

        // Check if already exists
        let normalized = Self::normalize_fingerprint(&fingerprint);
        for pin in pins.iter() {
            if Self::normalize_fingerprint(pin) == normalized {
                debug!("Backup pin already exists, skipping");
                return;
            }
        }

        pins.push(fingerprint);
        info!("Backup pin added, now have {} pin(s)", pins.len());
    }

    /// Remove a pin (e.g., after certificate rotation is complete).
    pub async fn remove_pin(&self, fingerprint: &str) -> bool {
        let mut pins = self.pins.write().await;
        let normalized = Self::normalize_fingerprint(fingerprint);

        let initial_len = pins.len();
        pins.retain(|pin| Self::normalize_fingerprint(pin) != normalized);

        let removed = pins.len() < initial_len;
        if removed {
            info!("Pin removed, now have {} pin(s)", pins.len());

            // Update enabled status
            if pins.is_empty() {
                let mut enabled = self.enabled.write().await;
                *enabled = false;
                warn!("All pins removed, certificate pinning disabled");
            }
        }

        removed
    }

    /// Compute SHA-256 fingerprint of a certificate.
    pub fn compute_fingerprint(cert_der: &[u8]) -> String {
        let hash = Sha256::digest(cert_der);
        format!("{}{}", SHA256_PREFIX, hex::encode(hash))
    }

    /// Normalize a fingerprint for comparison.
    ///
    /// Removes prefix if present and converts to lowercase.
    fn normalize_fingerprint(fingerprint: &str) -> String {
        let fp = fingerprint
            .strip_prefix(SHA256_PREFIX)
            .unwrap_or(fingerprint);
        fp.to_lowercase().replace([':', ' ', '-'], "")
    }

    /// Get a preview of a fingerprint for logging (partial, for security).
    fn fingerprint_preview(fingerprint: &str) -> String {
        if fingerprint.len() > 24 {
            format!("{}...", &fingerprint[..24])
        } else {
            fingerprint.to_string()
        }
    }

    /// Get the current pins (for persistence).
    pub async fn get_pins(&self) -> Vec<String> {
        self.pins.read().await.clone()
    }

    /// Save updated pins to credentials storage.
    pub async fn save_to_credentials(&self, db: &Database) -> SyncResult<()> {
        let pins = self.get_pins().await;
        let repo = CredentialsRepository::new(db);
        repo.update_server_fingerprints(&pins).await
    }
}

/// Pinning validation result with details.
#[derive(Debug, Clone)]
pub struct PinningResult {
    /// Whether validation succeeded.
    pub valid: bool,
    /// The fingerprint that was checked.
    pub fingerprint: String,
    /// Which pin matched (if any).
    pub matched_pin_index: Option<usize>,
    /// Error message if validation failed.
    pub error: Option<String>,
}

impl PinningResult {
    /// Create a successful result.
    pub fn success(fingerprint: String, matched_index: usize) -> Self {
        Self {
            valid: true,
            fingerprint,
            matched_pin_index: Some(matched_index),
            error: None,
        }
    }

    /// Create a failed result.
    pub fn failure(fingerprint: String, error: String) -> Self {
        Self {
            valid: false,
            fingerprint,
            matched_pin_index: None,
            error: Some(error),
        }
    }

    /// Create a skipped result (pinning disabled).
    pub fn skipped() -> Self {
        Self {
            valid: true,
            fingerprint: String::new(),
            matched_pin_index: None,
            error: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_fingerprint() -> String {
        "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string()
    }

    fn test_fingerprint_alt() -> String {
        "sha256:d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592".to_string()
    }

    #[tokio::test]
    async fn test_pinning_enabled() {
        let pins = vec![test_fingerprint()];
        let pinning = CertificatePinning::new(pins);

        assert!(pinning.is_enabled().await);
        assert_eq!(pinning.pin_count().await, 1);
    }

    #[tokio::test]
    async fn test_pinning_disabled_no_pins() {
        let pinning = CertificatePinning::new(vec![]);

        assert!(!pinning.is_enabled().await);
        assert_eq!(pinning.pin_count().await, 0);
    }

    #[tokio::test]
    async fn test_verify_success() {
        let fp = test_fingerprint();
        let pins = vec![fp.clone()];
        let pinning = CertificatePinning::new(pins);

        let result = pinning.verify(&fp).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_verify_failure() {
        let pins = vec![test_fingerprint()];
        let pinning = CertificatePinning::new(pins);

        let result = pinning.verify(&test_fingerprint_alt()).await;
        assert!(result.is_err());
        assert!(matches!(result, Err(SyncError::CertificateValidation(_))));
    }

    #[tokio::test]
    async fn test_verify_backup_pin() {
        let pins = vec![test_fingerprint(), test_fingerprint_alt()];
        let pinning = CertificatePinning::new(pins);

        // Should match backup pin
        let result = pinning.verify(&test_fingerprint_alt()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_verify_skipped_when_disabled() {
        let pinning = CertificatePinning::new(vec![]);

        // Should succeed even with random fingerprint
        let result = pinning.verify("sha256:random").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_normalize_fingerprint() {
        // With prefix
        let normalized = CertificatePinning::normalize_fingerprint("sha256:AB:CD:EF:12");
        assert_eq!(normalized, "abcdef12");

        // Without prefix
        let normalized = CertificatePinning::normalize_fingerprint("AB-CD-EF-12");
        assert_eq!(normalized, "abcdef12");

        // With spaces
        let normalized = CertificatePinning::normalize_fingerprint("ab cd ef 12");
        assert_eq!(normalized, "abcdef12");
    }

    #[tokio::test]
    async fn test_compute_fingerprint() {
        // Empty data has known SHA-256 hash
        let fp = CertificatePinning::compute_fingerprint(&[]);
        assert_eq!(
            fp,
            "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );

        // Some test data
        let fp = CertificatePinning::compute_fingerprint(b"test");
        assert!(fp.starts_with("sha256:"));
        assert_eq!(fp.len(), 7 + 64); // "sha256:" + 64 hex chars
    }

    #[tokio::test]
    async fn test_update_pins() {
        let pinning = CertificatePinning::new(vec![test_fingerprint()]);
        assert_eq!(pinning.pin_count().await, 1);

        pinning
            .update_pins(vec![test_fingerprint(), test_fingerprint_alt()])
            .await;
        assert_eq!(pinning.pin_count().await, 2);
    }

    #[tokio::test]
    async fn test_update_pins_empty_ignored() {
        let pinning = CertificatePinning::new(vec![test_fingerprint()]);

        // Empty update should be ignored
        pinning.update_pins(vec![]).await;
        assert_eq!(pinning.pin_count().await, 1);
    }

    #[tokio::test]
    async fn test_add_backup_pin() {
        let pinning = CertificatePinning::new(vec![test_fingerprint()]);

        pinning.add_backup_pin(test_fingerprint_alt()).await;
        assert_eq!(pinning.pin_count().await, 2);
    }

    #[tokio::test]
    async fn test_add_backup_pin_duplicate() {
        let pinning = CertificatePinning::new(vec![test_fingerprint()]);

        // Adding duplicate should be ignored
        pinning.add_backup_pin(test_fingerprint()).await;
        assert_eq!(pinning.pin_count().await, 1);
    }

    #[tokio::test]
    async fn test_remove_pin() {
        let pinning = CertificatePinning::new(vec![test_fingerprint(), test_fingerprint_alt()]);

        let removed = pinning.remove_pin(&test_fingerprint()).await;
        assert!(removed);
        assert_eq!(pinning.pin_count().await, 1);

        // Removing non-existent pin
        let removed = pinning.remove_pin("sha256:nonexistent").await;
        assert!(!removed);
    }

    #[tokio::test]
    async fn test_remove_all_pins_disables() {
        let pinning = CertificatePinning::new(vec![test_fingerprint()]);
        assert!(pinning.is_enabled().await);

        pinning.remove_pin(&test_fingerprint()).await;
        assert!(!pinning.is_enabled().await);
    }

    #[tokio::test]
    async fn test_get_pins() {
        let pins = vec![test_fingerprint(), test_fingerprint_alt()];
        let pinning = CertificatePinning::new(pins.clone());

        let retrieved = pinning.get_pins().await;
        assert_eq!(retrieved, pins);
    }

    #[tokio::test]
    async fn test_case_insensitive_verification() {
        let fp_lower = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let fp_upper = "sha256:E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855";

        let pinning = CertificatePinning::new(vec![fp_lower.to_string()]);

        // Should match regardless of case
        assert!(pinning.verify(fp_upper).await.is_ok());
    }

    #[test]
    fn test_pinning_result_success() {
        let result = PinningResult::success("sha256:abc".to_string(), 0);
        assert!(result.valid);
        assert_eq!(result.matched_pin_index, Some(0));
        assert!(result.error.is_none());
    }

    #[test]
    fn test_pinning_result_failure() {
        let result = PinningResult::failure("sha256:abc".to_string(), "no match".to_string());
        assert!(!result.valid);
        assert!(result.matched_pin_index.is_none());
        assert!(result.error.is_some());
    }
}
