//! Proof generation engine.
//!
//! Generates timestamped, integrity-verified proofs for compliance checks.

use crate::check::CheckOutput;
use agent_common::types::{CheckDefinition, Proof};
use chrono::{Duration, Utc};
use sha2::{Digest, Sha256};
use uuid::Uuid;

/// Default retention period in days (12 months).
const DEFAULT_RETENTION_DAYS: i64 = 365;

/// Proof generator for compliance checks.
pub struct ProofGenerator {
    /// Retention period in days.
    retention_days: i64,
}

impl ProofGenerator {
    /// Create a new proof generator with default retention.
    pub fn new() -> Self {
        Self {
            retention_days: DEFAULT_RETENTION_DAYS,
        }
    }

    /// Create a proof generator with custom retention period.
    pub fn with_retention(retention_days: i64) -> Self {
        Self { retention_days }
    }

    /// Generate a proof from check output.
    pub fn generate(
        &self,
        check_result_id: Uuid,
        check_id: &str,
        output: &CheckOutput,
        definition: &CheckDefinition,
    ) -> Proof {
        let now = Utc::now();
        let expires_at = now + Duration::days(self.retention_days);

        // Build proof data with full context
        let proof_data = serde_json::json!({
            "check_id": check_id,
            "check_name": definition.name,
            "category": definition.category,
            "severity": definition.severity,
            "frameworks": definition.frameworks,
            "executed_at": now.to_rfc3339(),
            "passed": output.passed,
            "message": output.message,
            "raw_data": output.raw_data,
            "metadata": output.metadata,
        });

        // Compute SHA-256 hash
        let data_json = serde_json::to_string(&proof_data).unwrap_or_default();
        let data_hash = compute_sha256(&data_json);

        Proof {
            id: Uuid::new_v4(),
            check_result_id,
            check_id: check_id.to_string(),
            generated_at: now,
            data: proof_data,
            data_hash,
            signature: None,
            synced: false,
            expires_at: Some(expires_at),
        }
    }

    /// Verify the integrity of a proof.
    pub fn verify(&self, proof: &Proof) -> bool {
        let data_json = serde_json::to_string(&proof.data).unwrap_or_default();
        let computed_hash = compute_sha256(&data_json);
        computed_hash == proof.data_hash
    }

    /// Compute a signature for a proof (HMAC-SHA256).
    pub fn sign(&self, proof: &mut Proof, key: &[u8]) {
        use hmac::{Hmac, Mac};
        type HmacSha256 = Hmac<Sha256>;

        let data_json = serde_json::to_string(&proof.data).unwrap_or_default();
        let mut mac = HmacSha256::new_from_slice(key)
            .expect("HMAC can accept any key length");
        mac.update(data_json.as_bytes());

        let signature = hex::encode(mac.finalize().into_bytes());
        proof.signature = Some(format!("hmac-sha256:{}", signature));
    }

    /// Verify a proof signature.
    pub fn verify_signature(&self, proof: &Proof, key: &[u8]) -> bool {
        use hmac::{Hmac, Mac};
        type HmacSha256 = Hmac<Sha256>;

        let signature = match &proof.signature {
            Some(sig) => sig.strip_prefix("hmac-sha256:").unwrap_or(sig),
            None => return false,
        };

        let data_json = serde_json::to_string(&proof.data).unwrap_or_default();
        let mut mac = HmacSha256::new_from_slice(key)
            .expect("HMAC can accept any key length");
        mac.update(data_json.as_bytes());

        let expected = hex::encode(mac.finalize().into_bytes());
        signature == expected
    }
}

impl Default for ProofGenerator {
    fn default() -> Self {
        Self::new()
    }
}

/// Compute SHA-256 hash of a string.
pub fn compute_sha256(data: &str) -> String {
    let hash = Sha256::digest(data.as_bytes());
    format!("sha256:{}", hex::encode(hash))
}

/// Verify a SHA-256 hash.
pub fn verify_sha256(data: &str, expected_hash: &str) -> bool {
    let computed = compute_sha256(data);
    computed.to_lowercase() == expected_hash.to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::check::{CheckDefinitionBuilder, CheckOutput};
    use agent_common::types::CheckCategory;

    fn create_test_definition() -> CheckDefinition {
        CheckDefinitionBuilder::new("disk_encryption")
            .name("Disk Encryption")
            .description("Verify disk encryption is enabled")
            .category(CheckCategory::Encryption)
            .framework("NIS2")
            .framework("DORA")
            .build()
    }

    fn create_test_output() -> CheckOutput {
        CheckOutput::pass(
            "BitLocker is enabled",
            serde_json::json!({
                "encryption_enabled": true,
                "algorithm": "AES-256",
                "protection_status": "on"
            }),
        )
    }

    #[test]
    fn test_proof_generation() {
        let generator = ProofGenerator::new();
        let definition = create_test_definition();
        let output = create_test_output();
        let result_id = Uuid::new_v4();

        let proof = generator.generate(result_id, "disk_encryption", &output, &definition);

        assert_eq!(proof.check_result_id, result_id);
        assert_eq!(proof.check_id, "disk_encryption");
        assert!(proof.data_hash.starts_with("sha256:"));
        assert!(!proof.synced);
        assert!(proof.expires_at.is_some());
    }

    #[test]
    fn test_proof_integrity_verification() {
        let generator = ProofGenerator::new();
        let definition = create_test_definition();
        let output = create_test_output();

        let proof = generator.generate(Uuid::new_v4(), "test", &output, &definition);

        assert!(generator.verify(&proof));
    }

    #[test]
    fn test_proof_tamper_detection() {
        let generator = ProofGenerator::new();
        let definition = create_test_definition();
        let output = create_test_output();

        let mut proof = generator.generate(Uuid::new_v4(), "test", &output, &definition);

        // Tamper with the data
        proof.data = serde_json::json!({"tampered": true});

        assert!(!generator.verify(&proof));
    }

    #[test]
    fn test_proof_signing() {
        let generator = ProofGenerator::new();
        let definition = create_test_definition();
        let output = create_test_output();
        let key = b"test-secret-key-32-bytes-long!!";

        let mut proof = generator.generate(Uuid::new_v4(), "test", &output, &definition);
        generator.sign(&mut proof, key);

        assert!(proof.signature.is_some());
        assert!(proof.signature.as_ref().unwrap().starts_with("hmac-sha256:"));
    }

    #[test]
    fn test_signature_verification() {
        let generator = ProofGenerator::new();
        let definition = create_test_definition();
        let output = create_test_output();
        let key = b"test-secret-key-32-bytes-long!!";

        let mut proof = generator.generate(Uuid::new_v4(), "test", &output, &definition);
        generator.sign(&mut proof, key);

        assert!(generator.verify_signature(&proof, key));
        assert!(!generator.verify_signature(&proof, b"wrong-key"));
    }

    #[test]
    fn test_compute_sha256() {
        let hash = compute_sha256("test data");
        assert!(hash.starts_with("sha256:"));
        assert_eq!(hash.len(), 7 + 64); // "sha256:" + 64 hex chars
    }

    #[test]
    fn test_compute_sha256_deterministic() {
        let hash1 = compute_sha256("same data");
        let hash2 = compute_sha256("same data");
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_verify_sha256() {
        let data = "test data";
        let hash = compute_sha256(data);
        assert!(verify_sha256(data, &hash));
        assert!(!verify_sha256("different data", &hash));
    }

    #[test]
    fn test_proof_expiration() {
        let generator = ProofGenerator::with_retention(30); // 30 days
        let definition = create_test_definition();
        let output = create_test_output();

        let proof = generator.generate(Uuid::new_v4(), "test", &output, &definition);

        let expires_at = proof.expires_at.unwrap();
        let days_until_expiry = (expires_at - Utc::now()).num_days();

        // Should be approximately 30 days (allow 1 day tolerance)
        assert!(days_until_expiry >= 29 && days_until_expiry <= 30);
    }

    #[test]
    fn test_proof_data_content() {
        let generator = ProofGenerator::new();
        let definition = create_test_definition();
        let output = create_test_output();

        let proof = generator.generate(Uuid::new_v4(), "disk_encryption", &output, &definition);

        // Verify proof data contains expected fields
        let data = &proof.data;
        assert_eq!(data["check_id"], "disk_encryption");
        assert_eq!(data["check_name"], "Disk Encryption");
        assert_eq!(data["passed"], true);
        assert!(data["executed_at"].as_str().is_some());
    }
}
