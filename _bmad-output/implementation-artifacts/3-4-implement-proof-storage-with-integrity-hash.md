# Story 3.4: Implement Proof Storage with Integrity Hash

Status: review

## Story

As an **auditor**,
I want **each proof to have a SHA-256 integrity hash**,
So that **I can verify proofs have not been tampered with**.

## Acceptance Criteria

1. **AC1** - Proof Storage
   - proofs table contains: proof_id, check_result_id, data, hash, created_at
   - Proof data stored as JSON blob
   - Foreign key link to check_results

2. **AC2** - Hash Computation
   - Hash computed as SHA-256 of (check_result_id + data + created_at)
   - Hash stored as hex-encoded string (64 chars)
   - Timestamp in ISO 8601 UTC format (NFR-C3)

3. **AC3** - Integrity Verification
   - verify_integrity() recomputes hash and compares
   - IntegrityStatus: Valid, Tampered, NotFound
   - Insert fails if hash doesn't match computed value

4. **AC4** - CRUD Operations
   - Insert with automatic hash validation
   - Get by ID, get by check_result_id
   - Mark synced, delete older than date
   - Statistics (count, size, date range)

## Tasks / Subtasks

- [x] Task 1: Add Hash Dependencies (AC: 2)
  - [x] Add sha2 and hex crates to workspace
  - [x] Add dependencies to agent-storage

- [x] Task 2: Implement Proof Model (AC: 1, 2)
  - [x] Proof struct with builder pattern
  - [x] compute_hash() static method
  - [x] verify_integrity() instance method
  - [x] with_timestamp() for testing

- [x] Task 3: Implement Repository (AC: 3, 4)
  - [x] insert() with hash validation
  - [x] get(), get_by_check_result()
  - [x] verify_integrity(), verify_all_for_result()
  - [x] mark_synced(), delete_older_than()
  - [x] get_stats() for monitoring

- [x] Task 4: Add Comprehensive Tests (AC: 1, 2, 3)
  - [x] test_proof_hash_computation
  - [x] test_proof_integrity_verification
  - [x] test_insert_invalid_hash_fails
  - [x] test_verify_integrity_valid
  - [x] test_get_stats

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- FR54: Le système peut garantir l'intégrité des preuves (hash SHA-256)
- NFR-C3: Horodatage preuves ISO 8601 UTC
- NFR-C4: Intégrité preuves Hash SHA-256 signé

### Hash Computation

```rust
// Hash = SHA-256(check_result_id || data || created_at)
let mut hasher = Sha256::new();
hasher.update(check_result_id.to_le_bytes());
hasher.update(data.as_bytes());
hasher.update(created_at.to_rfc3339().as_bytes());
hex::encode(hasher.finalize())
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Created proof repository with SHA-256 integrity hashing
- All 13 proof tests passing
- Insert validation prevents storing tampered proofs

### Completion Notes List

- ✅ sha2 v0.10 and hex v0.4 added to workspace
- ✅ Proof struct with check_result_id, data, hash, created_at
- ✅ compute_hash() using SHA-256 with little-endian bytes
- ✅ verify_integrity() compares stored vs computed hash
- ✅ IntegrityStatus enum: Valid, Tampered, NotFound
- ✅ insert() validates hash before storing
- ✅ verify_all_for_result() batch verification
- ✅ get_stats() returns count, size, date range
- ✅ ProofStats struct for monitoring
- ✅ hash_bytes() for binary comparison
- ✅ 13 comprehensive tests

### File List

**New Files Created:**
- sentinel-agent/crates/agent-storage/src/repositories/proofs.rs

**Modified Files:**
- sentinel-agent/Cargo.toml (sha2, hex dependencies)
- sentinel-agent/crates/agent-storage/Cargo.toml (sha2, hex)
- sentinel-agent/crates/agent-storage/src/repositories/mod.rs (export proofs)
- sentinel-agent/crates/agent-storage/src/lib.rs (export Proof types)

### Change Log

- 2026-01-23: Added sha2 and hex crates for hashing
- 2026-01-23: Created Proof struct with integrity hashing
- 2026-01-23: Implemented ProofsRepository with verification
- 2026-01-23: Added 13 comprehensive tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
