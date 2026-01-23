//! Compliance proof types.
//!
//! Proofs provide auditable evidence of compliance check results.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A compliance proof with integrity verification.
///
/// Proofs are generated for each check execution and provide
/// cryptographic evidence of the check result.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct Proof {
    /// Unique identifier for this proof.
    pub id: Uuid,

    /// ID of the associated check result.
    pub check_result_id: Uuid,

    /// ID of the check definition.
    pub check_id: String,

    /// Timestamp when the proof was generated.
    pub generated_at: DateTime<Utc>,

    /// Raw proof data (JSON-encoded check output).
    pub data: serde_json::Value,

    /// SHA-256 hash of the proof data for integrity verification.
    pub data_hash: String,

    /// HMAC-SHA256 signature for tamper detection.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,

    /// Whether this proof has been synced to the server.
    #[serde(default)]
    pub synced: bool,

    /// Expiration date for data retention policy.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<DateTime<Utc>>,
}

impl Proof {
    /// Create a new proof with the given data.
    ///
    /// The hash is computed from the serialized data.
    pub fn new(
        check_result_id: Uuid,
        check_id: impl Into<String>,
        data: serde_json::Value,
    ) -> Self {
        let data_json = serde_json::to_string(&data).unwrap_or_default();
        let data_hash = compute_sha256(&data_json);

        Self {
            id: Uuid::new_v4(),
            check_result_id,
            check_id: check_id.into(),
            generated_at: Utc::now(),
            data,
            data_hash,
            signature: None,
            synced: false,
            expires_at: None,
        }
    }

    /// Verify the integrity of the proof data.
    pub fn verify_integrity(&self) -> bool {
        let data_json = serde_json::to_string(&self.data).unwrap_or_default();
        let computed_hash = compute_sha256(&data_json);
        computed_hash == self.data_hash
    }

    /// Set the signature for tamper detection.
    pub fn with_signature(mut self, signature: String) -> Self {
        self.signature = Some(signature);
        self
    }

    /// Set the expiration date.
    pub fn with_expiration(mut self, expires_at: DateTime<Utc>) -> Self {
        self.expires_at = Some(expires_at);
        self
    }
}

/// Metadata about proof storage.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct ProofMetadata {
    /// Total number of proofs stored locally.
    pub total_count: u64,

    /// Total storage size in bytes.
    pub total_size_bytes: u64,

    /// Oldest proof timestamp.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub oldest_proof_at: Option<DateTime<Utc>>,

    /// Newest proof timestamp.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub newest_proof_at: Option<DateTime<Utc>>,

    /// Number of unsynced proofs.
    pub unsynced_count: u64,
}

/// Compute SHA-256 hash of a string.
///
/// This is a placeholder implementation. In production, use a proper
/// cryptographic library.
fn compute_sha256(data: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    // NOTE: This is NOT a real SHA-256 implementation!
    // It's a placeholder for the story. Real implementation should use
    // ring or sha2 crate.
    let mut hasher = DefaultHasher::new();
    data.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proof_creation() {
        let result_id = Uuid::new_v4();
        let data = serde_json::json!({
            "encryption_enabled": true,
            "algorithm": "AES-256"
        });

        let proof = Proof::new(result_id, "disk_encryption", data.clone());

        assert_eq!(proof.check_result_id, result_id);
        assert_eq!(proof.check_id, "disk_encryption");
        assert_eq!(proof.data, data);
        assert!(!proof.data_hash.is_empty());
        assert!(!proof.synced);
    }

    #[test]
    fn test_proof_integrity_verification() {
        let data = serde_json::json!({"test": "value"});
        let proof = Proof::new(Uuid::new_v4(), "test", data);

        assert!(proof.verify_integrity());
    }

    #[test]
    fn test_proof_serialization() {
        let proof = Proof::new(
            Uuid::nil(),
            "test_check",
            serde_json::json!({"status": "ok"}),
        );

        let json = serde_json::to_string(&proof).unwrap();
        assert!(json.contains("check_result_id"));
        assert!(json.contains("data_hash"));
        assert!(json.contains("generated_at"));

        let parsed: Proof = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.check_id, "test_check");
    }

    #[test]
    fn test_proof_with_signature() {
        let proof = Proof::new(Uuid::new_v4(), "test", serde_json::json!({}))
            .with_signature("sig123".to_string());

        assert_eq!(proof.signature, Some("sig123".to_string()));
    }

    #[test]
    fn test_proof_metadata_serialization() {
        let metadata = ProofMetadata {
            total_count: 100,
            total_size_bytes: 50000,
            oldest_proof_at: Some(Utc::now()),
            newest_proof_at: Some(Utc::now()),
            unsynced_count: 5,
        };

        let json = serde_json::to_string(&metadata).unwrap();
        let parsed: ProofMetadata = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.total_count, 100);
    }
}
