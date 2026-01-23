# Story 10.2: Download and Apply Update Automatically

Status: done

## Story

As an **agent**,
I want **to download and install updates automatically**,
So that **endpoints stay current without manual intervention**.

## Acceptance Criteria

1. **AC1** - Download
   - New binary downloaded to staging directory
   - SHA-256 hash verified against expected value
   - Code signature verified (Authenticode/GPG)

2. **AC2** - Shadow Copy
   - Shadow copy mechanism preserves current binary for rollback
   - Previous version stored with .shadow suffix

3. **AC3** - Installation
   - Service restarted with new binary
   - Post-update health check confirms successful start
   - Update result reported to SaaS

4. **AC4** - Metadata
   - Update metadata tracked (current/previous version, hashes)
   - Rollback availability flag maintained

## Tasks / Subtasks

- [x] Task 1: Implement UpdateManager (AC: 1, 2, 3)
  - [x] apply_update method
  - [x] download_update integration
  - [x] verify_package integration
  - [x] State machine tracking

- [x] Task 2: Implement Shadow Copy (AC: 2)
  - [x] create_shadow_copy method
  - [x] replace_binary method
  - [x] Executable permissions handling

- [x] Task 3: Implement Metadata (AC: 4)
  - [x] UpdateMetadata struct
  - [x] load_metadata method
  - [x] save_metadata method

- [x] Task 4: Add Tests (AC: All)
  - [x] Metadata serialization tests
  - [x] UpdateResult tests
  - [x] HealthCheckResult tests

## Dev Notes

### UpdateManager Flow

```
1. Download to staging
2. Verify SHA-256 hash
3. Create shadow copy of current binary
4. Replace binary with new version
5. Save metadata
6. Report result
```

### UpdateMetadata Structure

```rust
UpdateMetadata {
    current_version: String,
    previous_version: Option<String>,
    updated_at: Option<DateTime<Utc>>,
    current_hash: Option<String>,
    previous_hash: Option<String>,
    rollback_available: bool,
    state: String,
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- UpdateManager with shadow copy mechanism
- State machine for tracking update progress
- Metadata persistence for tracking versions
- Cross-platform support (Unix permissions, Windows rename)

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/updater.rs

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs

### Change Log

- 2026-01-23: Implemented UpdateManager with shadow copy

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** APPROVED WITH FIXES

### Review Findings (Fixed)

| Issue | Severity | Status |
|-------|----------|--------|
| Code signature verification not integrated (AC1) | HIGH | ✅ Fixed |
| Post-update health check not implemented (AC3) | HIGH | ✅ Fixed |

### Fixes Applied

1. **SignatureValidator integration** - UpdateManager now optionally takes SignatureValidator via `with_signature_validator()`
2. **verify_and_block()** - Called after SHA-256 verification in apply_update flow
3. **perform_health_check()** - New method that checks binary exists, permissions, and runs `--version`
4. **Health check triggers rollback** - If health check fails, automatic rollback is triggered
