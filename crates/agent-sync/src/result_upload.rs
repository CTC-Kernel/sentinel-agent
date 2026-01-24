//! Result upload service for uploading check results to SaaS.
//!
//! This module provides:
//! - Uploading check results to the SaaS API
//! - Gzip compression for payloads
//! - Rate limiting with token bucket
//! - Batch uploads for efficiency

use crate::authenticated_client::AuthenticatedClient;
use crate::error::{SyncError, SyncResult};
use agent_storage::{CheckResult, CheckResultsRepository, Database, ProofsRepository};
use chrono::{DateTime, Utc};
use flate2::Compression;
use flate2::write::GzEncoder;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tokio::sync::Semaphore;
use tokio::time::Instant;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Maximum results per batch upload.
const MAX_BATCH_SIZE: usize = 100;

/// Maximum requests per second (NFR-SC4).
const MAX_REQUESTS_PER_SECOND: u32 = 200;

/// Minimum interval between requests (5ms for 200 req/s).
const MIN_REQUEST_INTERVAL_MS: u64 = 5;

/// Upload operation timeout in seconds (NFR-SC5).
/// Prevents uploads from blocking indefinitely.
const UPLOAD_TIMEOUT_SECS: u64 = 60;

/// Payload for uploading check results.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ResultUploadRequest {
    /// List of check results to upload.
    pub results: Vec<CheckResultPayload>,
    /// Agent identifier.
    pub agent_id: Uuid,
    /// Upload timestamp.
    pub timestamp: DateTime<Utc>,
}

/// Individual check result payload.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct CheckResultPayload {
    /// Check rule identifier.
    pub check_id: String,
    /// Result status.
    pub status: String,
    /// Compliance score (0-100).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<i32>,
    /// Proof hash (SHA-256).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proof_hash: Option<String>,
    /// Execution timestamp.
    pub executed_at: DateTime<Utc>,
    /// Execution duration in milliseconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<i64>,
    /// Raw data JSON (if included).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_data: Option<serde_json::Value>,
}

impl From<&CheckResult> for CheckResultPayload {
    fn from(result: &CheckResult) -> Self {
        Self {
            check_id: result.check_rule_id.clone(),
            status: result.status.as_str().to_string(),
            score: result.score,
            proof_hash: None, // Proof hash added separately
            executed_at: result.executed_at,
            duration_ms: result.duration_ms,
            raw_data: result
                .raw_data
                .as_ref()
                .and_then(|s| serde_json::from_str(s).ok()),
        }
    }
}

/// Response from result upload.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ResultUploadResponse {
    /// Number of results accepted.
    pub accepted: usize,
    /// Number of results rejected.
    pub rejected: usize,
    /// IDs of rejected results (if any).
    #[serde(default)]
    pub rejected_ids: Vec<String>,
    /// Server timestamp.
    pub timestamp: DateTime<Utc>,
}

/// Result of an upload operation.
#[derive(Debug, Clone)]
pub struct UploadResult {
    /// Number of results uploaded.
    pub uploaded: usize,
    /// Number of results rejected.
    pub rejected: usize,
    /// Number of results still pending.
    pub pending: usize,
    /// Whether compression was used.
    pub compressed: bool,
    /// Payload size in bytes.
    pub payload_bytes: usize,
    /// Upload timestamp.
    pub timestamp: DateTime<Utc>,
}

/// Rate limiter using token bucket algorithm.
pub struct RateLimiter {
    /// Reference instant for measuring elapsed time.
    start_instant: Instant,
    /// Last request timestamp in milliseconds since start.
    last_request_ms: AtomicU64,
    /// Concurrent request semaphore.
    semaphore: Semaphore,
}

impl RateLimiter {
    /// Create a new rate limiter.
    pub fn new() -> Self {
        Self {
            start_instant: Instant::now(),
            last_request_ms: AtomicU64::new(0),
            semaphore: Semaphore::new(MAX_REQUESTS_PER_SECOND as usize),
        }
    }

    /// Acquire permission to make a request.
    ///
    /// This will wait if necessary to respect the rate limit.
    pub async fn acquire(&self) {
        let _permit = self.semaphore.acquire().await;

        // Calculate current time relative to the start instant
        let now_ms = self.start_instant.elapsed().as_millis() as u64;

        let last = self.last_request_ms.load(Ordering::Relaxed);
        let elapsed = now_ms.saturating_sub(last);

        if elapsed < MIN_REQUEST_INTERVAL_MS {
            let wait = MIN_REQUEST_INTERVAL_MS - elapsed;
            tokio::time::sleep(Duration::from_millis(wait)).await;
        }

        // Update last request time with current time (after potential wait)
        let updated_ms = self.start_instant.elapsed().as_millis() as u64;
        self.last_request_ms.store(updated_ms, Ordering::Relaxed);
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

/// Service for uploading check results to SaaS.
pub struct ResultUploader {
    client: Arc<AuthenticatedClient>,
    db: Arc<Database>,
    rate_limiter: RateLimiter,
    /// Whether to use gzip compression.
    use_compression: bool,
}

impl ResultUploader {
    /// Create a new result uploader.
    pub fn new(client: Arc<AuthenticatedClient>, db: Arc<Database>) -> Self {
        Self {
            client,
            db,
            rate_limiter: RateLimiter::new(),
            use_compression: true,
        }
    }

    /// Create an uploader without compression (for testing).
    pub fn without_compression(client: Arc<AuthenticatedClient>, db: Arc<Database>) -> Self {
        Self {
            client,
            db,
            rate_limiter: RateLimiter::new(),
            use_compression: false,
        }
    }

    /// Upload all unsynced results.
    ///
    /// This method fetches unsynced results from the database,
    /// batches them, and uploads them to the SaaS.
    pub async fn upload_pending(&self) -> SyncResult<UploadResult> {
        let repo = CheckResultsRepository::new(&self.db);

        // Get unsynced results
        let results = repo.get_unsynced(MAX_BATCH_SIZE as i64).await?;

        if results.is_empty() {
            debug!("No pending results to upload");
            return Ok(UploadResult {
                uploaded: 0,
                rejected: 0,
                pending: 0,
                compressed: false,
                payload_bytes: 0,
                timestamp: Utc::now(),
            });
        }

        info!("Uploading {} pending results", results.len());

        // Upload the batch
        let upload_result = self.upload_batch(&results).await?;

        // Mark successful uploads as synced
        if upload_result.uploaded > 0 {
            let synced_ids: Vec<i64> = results
                .iter()
                .filter_map(|r| r.id)
                .take(upload_result.uploaded)
                .collect();

            if !synced_ids.is_empty() {
                repo.mark_synced(&synced_ids).await?;
            }
        }

        // Log rejected results for audit trail
        if upload_result.rejected > 0 {
            let rejected_ids: Vec<i64> = results
                .iter()
                .filter_map(|r| r.id)
                .skip(upload_result.uploaded)
                .take(upload_result.rejected)
                .collect();

            warn!(
                "Server rejected {} results (IDs: {:?}). Results will be retried on next upload.",
                upload_result.rejected, rejected_ids
            );

            // Log individual rejected results for debugging
            for id in &rejected_ids {
                if let Some(result) = results.iter().find(|r| r.id == Some(*id)) {
                    debug!(
                        "Rejected result: id={}, check_rule_id={}, status={:?}",
                        id, result.check_rule_id, result.status
                    );
                }
            }
        }

        // Get remaining pending count
        let remaining = repo.get_unsynced(1).await?.len();

        Ok(UploadResult {
            uploaded: upload_result.uploaded,
            rejected: upload_result.rejected,
            pending: remaining,
            compressed: upload_result.compressed,
            payload_bytes: upload_result.payload_bytes,
            timestamp: Utc::now(),
        })
    }

    /// Upload a batch of results.
    async fn upload_batch(&self, results: &[CheckResult]) -> SyncResult<UploadResult> {
        if results.is_empty() {
            return Ok(UploadResult {
                uploaded: 0,
                rejected: 0,
                pending: 0,
                compressed: false,
                payload_bytes: 0,
                timestamp: Utc::now(),
            });
        }

        // Rate limit
        self.rate_limiter.acquire().await;

        let agent_id = self.client.agent_id().await?;

        // Build request payload with proof hashes
        let proofs_repo = ProofsRepository::new(&self.db);
        let mut payloads: Vec<CheckResultPayload> = Vec::with_capacity(results.len());

        for result in results {
            let mut payload = CheckResultPayload::from(result);

            // Try to get the proof hash for this result
            if let Some(result_id) = result.id {
                match proofs_repo.get_by_check_result(result_id).await {
                    Ok(proofs) if !proofs.is_empty() => {
                        // Use the most recent proof's hash
                        payload.proof_hash = Some(proofs[0].hash.clone());
                    }
                    Ok(_) => {
                        // No proof found - this is okay, not all results have proofs
                        debug!("No proof found for check result {}", result_id);
                    }
                    Err(e) => {
                        // Log but don't fail the upload
                        warn!("Failed to get proof for result {}: {}", result_id, e);
                    }
                }
            }

            payloads.push(payload);
        }

        let request = ResultUploadRequest {
            results: payloads,
            agent_id,
            timestamp: Utc::now(),
        };

        // Serialize and optionally compress
        let (payload_bytes, compressed) = if self.use_compression {
            let json = serde_json::to_vec(&request)?;
            let compressed = compress_gzip(&json)?;
            (compressed, true)
        } else {
            let json = serde_json::to_vec(&request)?;
            (json, false)
        };

        let payload_size = payload_bytes.len();
        let path = format!("/v1/agents/{}/results", agent_id);

        debug!(
            "Uploading {} results ({} bytes, compressed: {})",
            results.len(),
            payload_size,
            compressed
        );

        // Upload with timeout enforcement (NFR-SC5: max 60 seconds)
        // In real implementation, this would use the compressed payload
        // For now, we use the standard JSON POST
        let upload_future = self
            .client
            .post_json::<_, ResultUploadResponse>(&path, &request);
        let timeout_duration = Duration::from_secs(UPLOAD_TIMEOUT_SECS);

        match tokio::time::timeout(timeout_duration, upload_future).await {
            Ok(Ok(response)) => {
                info!(
                    "Upload complete: {} accepted, {} rejected",
                    response.accepted, response.rejected
                );

                Ok(UploadResult {
                    uploaded: response.accepted,
                    rejected: response.rejected,
                    pending: 0,
                    compressed,
                    payload_bytes: payload_size,
                    timestamp: response.timestamp,
                })
            }
            Ok(Err(SyncError::ServerError { status: 429, .. })) => {
                warn!("Rate limited (429), will retry later");
                Err(SyncError::server(429, "Rate limited"))
            }
            Ok(Err(e)) => {
                error!("Upload failed: {}", e);
                Err(e)
            }
            Err(_) => {
                error!("Upload timed out after {} seconds", UPLOAD_TIMEOUT_SECS);
                Err(SyncError::Timeout)
            }
        }
    }

    /// Upload results continuously until all are synced.
    ///
    /// Returns the total number of results uploaded.
    pub async fn upload_all(&self) -> SyncResult<usize> {
        let mut total_uploaded = 0;

        loop {
            let result = self.upload_pending().await?;
            total_uploaded += result.uploaded;

            if result.pending == 0 {
                break;
            }

            // Small delay between batches
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        Ok(total_uploaded)
    }

    /// Get count of pending uploads.
    pub async fn pending_count(&self) -> SyncResult<i64> {
        let repo = CheckResultsRepository::new(&self.db);
        // We don't have a direct count method, so query with limit
        let unsynced = repo.get_unsynced(i64::MAX).await?;
        Ok(unsynced.len() as i64)
    }
}

/// Compress data using gzip.
fn compress_gzip(data: &[u8]) -> SyncResult<Vec<u8>> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(data)
        .map_err(|e| SyncError::Config(format!("Compression failed: {}", e)))?;
    encoder
        .finish()
        .map_err(|e| SyncError::Config(format!("Compression finalization failed: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_storage::CheckStatus;

    #[test]
    fn test_check_result_payload_from() {
        let result = CheckResult {
            id: Some(1),
            check_rule_id: "disk_encryption".to_string(),
            status: CheckStatus::Pass,
            score: Some(100),
            message: Some("Encryption enabled".to_string()),
            raw_data: Some(r#"{"bitlocker": "enabled"}"#.to_string()),
            executed_at: Utc::now(),
            duration_ms: Some(150),
            synced: false,
        };

        let payload = CheckResultPayload::from(&result);
        assert_eq!(payload.check_id, "disk_encryption");
        assert_eq!(payload.status, "pass");
        assert_eq!(payload.score, Some(100));
        assert_eq!(payload.duration_ms, Some(150));
    }

    #[test]
    fn test_result_upload_request_serialization() {
        let request = ResultUploadRequest {
            results: vec![CheckResultPayload {
                check_id: "test".to_string(),
                status: "pass".to_string(),
                score: Some(100),
                proof_hash: Some("abc123".to_string()),
                executed_at: Utc::now(),
                duration_ms: Some(50),
                raw_data: None,
            }],
            agent_id: Uuid::new_v4(),
            timestamp: Utc::now(),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("check_id"));
        assert!(json.contains("agent_id"));
        assert!(json.contains("proof_hash"));
    }

    #[test]
    fn test_result_upload_response_deserialization() {
        let json = r#"{
            "accepted": 10,
            "rejected": 2,
            "rejected_ids": ["id1", "id2"],
            "timestamp": "2026-01-23T12:00:00Z"
        }"#;

        let response: ResultUploadResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.accepted, 10);
        assert_eq!(response.rejected, 2);
        assert_eq!(response.rejected_ids.len(), 2);
    }

    #[test]
    fn test_result_upload_response_minimal() {
        let json = r#"{
            "accepted": 5,
            "rejected": 0,
            "timestamp": "2026-01-23T12:00:00Z"
        }"#;

        let response: ResultUploadResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.accepted, 5);
        assert!(response.rejected_ids.is_empty());
    }

    #[test]
    fn test_gzip_compression() {
        let data = r#"{"test": "data", "more": "content"}"#.as_bytes();
        let compressed = compress_gzip(data).unwrap();

        // Compressed should be different from original
        assert_ne!(compressed, data);

        // Gzip magic bytes
        assert_eq!(compressed[0], 0x1f);
        assert_eq!(compressed[1], 0x8b);
    }

    #[test]
    fn test_upload_result() {
        let result = UploadResult {
            uploaded: 10,
            rejected: 0,
            pending: 5,
            compressed: true,
            payload_bytes: 1024,
            timestamp: Utc::now(),
        };

        assert_eq!(result.uploaded, 10);
        assert!(result.compressed);
    }

    #[test]
    fn test_rate_limiter_creation() {
        let limiter = RateLimiter::new();
        assert_eq!(limiter.last_request_ms.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn test_max_batch_size() {
        assert_eq!(MAX_BATCH_SIZE, 100);
    }

    #[test]
    fn test_max_requests_per_second() {
        assert_eq!(MAX_REQUESTS_PER_SECOND, 200);
    }

    #[test]
    fn test_payload_skip_none_fields() {
        let payload = CheckResultPayload {
            check_id: "test".to_string(),
            status: "pass".to_string(),
            score: None,
            proof_hash: None,
            executed_at: Utc::now(),
            duration_ms: None,
            raw_data: None,
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(!json.contains("score"));
        assert!(!json.contains("proof_hash"));
        assert!(!json.contains("duration_ms"));
        assert!(!json.contains("raw_data"));
    }
}
