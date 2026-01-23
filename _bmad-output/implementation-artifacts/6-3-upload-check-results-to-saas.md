# Story 6.3: Upload Check Results to SaaS

Status: review

## Story

As a **CISO**,
I want **check results uploaded to the SaaS in real-time**,
So that **I see compliance status as soon as checks complete**.

## Acceptance Criteria

1. **AC1** - Result Upload
   - Upload results to `/v1/agents/{id}/results` within 60s
   - Payload includes: check_id, timestamp, status, score, proof_hash
   - Successful upload marks local record as synced

2. **AC2** - Compression
   - Use gzip compression (NFR-I8)
   - Batch multiple results in single request
   - Limit batch size for reliability

3. **AC3** - Rate Limiting
   - Upload rate limited to 200 req/s (NFR-SC4)
   - Graceful backoff on 429 responses
   - Priority queue for critical results

4. **AC4** - Error Handling
   - Network errors queue for retry
   - Server errors logged and retried
   - Invalid results rejected locally

## Tasks / Subtasks

- [x] Task 1: Implement ResultUploader (AC: 1, 2)
  - [x] ResultUploadRequest struct
  - [x] upload_results method
  - [x] batch_upload method
  - [x] gzip compression

- [x] Task 2: Implement Rate Limiting (AC: 3)
  - [x] Token bucket rate limiter
  - [x] 429 response handling
  - [x] Priority queue

- [x] Task 3: Add Tests (AC: All)
  - [x] Upload tests (10 tests)
  - [x] Compression tests
  - [x] Rate limit tests

## Dev Notes

### ResultUploadRequest Structure

```rust
ResultUploadRequest {
    results: Vec<CheckResultPayload>,
    agent_id: Uuid,
    timestamp: DateTime<Utc>,
}

CheckResultPayload {
    check_id: String,
    status: String,
    score: Option<i32>,
    proof_hash: Option<String>,
    executed_at: DateTime<Utc>,
    duration_ms: Option<i64>,
    raw_data: Option<Value>,
}
```

### Rate Limiting

| Parameter | Value |
|-----------|-------|
| Max requests/sec | 200 |
| Min interval | 5ms |
| Max batch size | 100 |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- ResultUploader with batch upload support
- Gzip compression using flate2
- Token bucket rate limiter (200 req/s)
- 429 graceful handling
- Integration with CheckResultsRepository
- 10 new tests added
- Total: 377 tests passing across all crates

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/result_upload.rs

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs
- sentinel-agent/crates/agent-sync/Cargo.toml (added flate2)

### Change Log

- 2026-01-23: Implemented ResultUploader
- 2026-01-23: Added gzip compression
- 2026-01-23: Added rate limiting
- 2026-01-23: Added 10 unit tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
