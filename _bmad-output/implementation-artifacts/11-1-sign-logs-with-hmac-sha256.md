# Story 11.1: Sign Logs with HMAC-SHA256

Status: done

## Story

As a **security officer**,
I want **all agent logs signed with HMAC-SHA256**,
So that **log tampering can be detected**.

## Acceptance Criteria

1. **AC1** - Log Signing
   - HMAC-SHA256 signature computed using agent's secret key
   - Signature appended to each log entry (NFR-S8)

2. **AC2** - Log Chaining
   - Each entry includes: timestamp, level, message, previous_hash
   - Previous hash creates tamper-evident chain

3. **AC3** - Verification
   - Log chain can be verified for integrity
   - Tampering detection alerts generated on failure

4. **AC4** - Performance
   - Signing adds < 1ms overhead per entry

## Tasks / Subtasks

- [x] Task 1: Implement LogSigner (AC: 1, 2)
  - [x] LogSigner struct with HMAC key
  - [x] sign method with sequence and chaining
  - [x] SignedLogEntry struct

- [x] Task 2: Implement Verification (AC: 3)
  - [x] verify method for single entry
  - [x] verify_chain method for entry chain
  - [x] Error reporting on tampering

- [x] Task 3: Add Tests (AC: All)
  - [x] Sign and verify tests
  - [x] Chain verification tests
  - [x] Tamper detection tests

## Dev Notes

### SignedLogEntry Structure

```rust
SignedLogEntry {
    sequence: u64,
    timestamp: DateTime<Utc>,
    level: String,
    component: String,
    message: String,
    previous_hash: String,
    signature: String,
}
```

### Chain Verification

```
Entry 1: prev_hash = "genesis"
Entry 2: prev_hash = Entry1.signature
Entry 3: prev_hash = Entry2.signature
...
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- LogSigner with HMAC-SHA256
- Sequence number tracking
- Chain verification via previous_hash
- Tamper detection with detailed errors

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/security.rs

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs
- sentinel-agent/crates/agent-sync/Cargo.toml (hmac dependency)
- sentinel-agent/Cargo.toml (workspace hmac dependency)

### Change Log

- 2026-01-23: Implemented LogSigner with chain verification

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** APPROVED WITH FIXES

### Review Findings (Fixed)

| Issue | Severity | Status |
|-------|----------|--------|
| AC4 Performance not measured | MEDIUM | ✅ Fixed |
| Missing tests for sign_data/verify_data | MEDIUM | ✅ Fixed |

### Fixes Applied

1. **test_log_signing_performance** - Benchmark test verifying < 1ms per entry
2. **test_sign_data** - Test for sign_data helper method
3. **test_verify_data** - Test for verify_data helper method
4. **test_verify_data_case_insensitive** - Signature comparison test
