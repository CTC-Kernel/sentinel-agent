# Story 4.5: Implement Agent Self-Integrity Check at Startup

Status: review

## Story

As a **security officer**,
I want **the agent to verify its own binary integrity at startup**,
So that **tampered binaries are detected before executing compliance checks**.

## Acceptance Criteria

1. **AC1** - SHA-256 Hash Computation
   - Agent computes SHA-256 hash of its own executable at startup
   - Hash format: `sha256:<hex-encoded-hash>`
   - Buffered reading (1MB) for large binaries

2. **AC2** - First Run Behavior
   - First run detects no stored hash and stores current hash
   - Hash stored in agent_config table with key `integrity.expected_hash`
   - First run considered successful (no verification needed)

3. **AC3** - Subsequent Run Verification
   - Hash recomputed and compared against stored expected hash
   - Case-insensitive comparison
   - Environment variable `SENTINEL_EXPECTED_HASH` overrides stored hash

4. **AC4** - Verification Failure Handling
   - Failed verification logs critical error with hash mismatch details
   - `verify_or_exit()` function exits with code 1 on failure
   - SelfCheckResult returned for inclusion in first heartbeat

5. **AC5** - Performance Requirement
   - Integrity check completes within 1 second (NFR)
   - Warning logged if check exceeds 1000ms

## Tasks / Subtasks

- [x] Task 1: Create IntegrityChecker Module (AC: 1, 2, 3)
  - [x] new() from current executable path
  - [x] for_path() for testing
  - [x] compute_hash() with buffered reader

- [x] Task 2: Implement Hash Storage (AC: 2)
  - [x] get_expected_hash() from env/db
  - [x] store_expected_hash() to agent_config
  - [x] clear_expected_hash() for testing

- [x] Task 3: Implement Verification Flow (AC: 3, 4)
  - [x] check() async method returning SelfCheckResult
  - [x] verify_or_exit() convenience function
  - [x] Hash comparison with mismatch logging

- [x] Task 4: Implement Utility Functions (AC: 5)
  - [x] log_timing() with NFR warning
  - [x] hash_preview() for secure logging
  - [x] executable_path() getter

- [x] Task 5: Add Comprehensive Tests (AC: All)
  - [x] 12 unit tests covering all features
  - [x] Hash computation determinism
  - [x] First run stores hash
  - [x] Subsequent run verifies
  - [x] Tampered binary detection

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- NFR-S2: Binary integrity verification at startup
- Self-check result included in first heartbeat
- Expected hash sources: env var > stored hash > SaaS enrollment

### IntegrityChecker Structure

```rust
IntegrityChecker
├── executable_path: PathBuf
└── Methods:
    ├── new() -> SyncResult<Self>
    ├── for_path(path) -> Self
    ├── check(&db) -> SelfCheckResult
    ├── compute_hash() -> SyncResult<String>
    ├── get_expected_hash(&db) -> SyncResult<Option<String>>
    ├── store_expected_hash(&db, hash) -> SyncResult<()>
    ├── update_expected_hash(&db, hash) -> SyncResult<()>
    ├── get_stored_hash(&db) -> SyncResult<Option<String>>
    └── clear_expected_hash(&db) -> SyncResult<()>
```

### SelfCheckResult Structure

```rust
SelfCheckResult {
    passed: bool,           // Whether integrity check passed
    binary_hash: String,    // Current binary hash
    error: Option<String>,  // Error details if failed
}
```

### Key Design Decisions

- **Buffered Reading**: 1MB BufReader + 8KB chunks for efficient hashing
- **First Run Detection**: No stored hash = first run, store and succeed
- **Environment Override**: SENTINEL_EXPECTED_HASH for deployment flexibility
- **Partial Logging**: Only first 21 chars of hash logged for security
- **Exit on Failure**: verify_or_exit() for mandatory startup verification

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Created IntegrityChecker module with SHA-256 hashing
- Implemented hash storage in agent_config table
- Added SelfCheckResult for heartbeat integration
- 12 integrity tests passing
- Fixed hash_preview length assertion

### Completion Notes List

- IntegrityChecker with compute_hash() using sha2 crate
- EXPECTED_HASH_KEY = "integrity.expected_hash"
- EXPECTED_HASH_ENV = "SENTINEL_EXPECTED_HASH"
- MAX_CHECK_DURATION_MS = 1000 (NFR compliance)
- check() returns SelfCheckResult for heartbeat
- verify_or_exit() exits with code 1 on failure
- Hash format: `sha256:<64-hex-chars>`
- 12 comprehensive tests
- Total: 82 tests in agent-sync

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/integrity.rs

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs (export integrity)
- sentinel-agent/crates/agent-sync/src/types.rs (SelfCheckResult)

### Change Log

- 2026-01-23: Created IntegrityChecker module
- 2026-01-23: Implemented SHA-256 hash computation
- 2026-01-23: Implemented hash storage/verification
- 2026-01-23: Added 12 comprehensive tests
- 2026-01-23: Fixed hash_preview length (20 -> 21 chars)

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
