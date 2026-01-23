# Story 10.3: Implement Automatic Rollback on Failure

Status: done

## Story

As an **agent**,
I want **to rollback to previous version if update fails**,
So that **endpoints remain functional even if update is faulty**.

## Acceptance Criteria

1. **AC1** - Rollback Trigger
   - Rollback triggered if post-update health check fails
   - Rollback triggered if installation fails

2. **AC2** - Rollback Process
   - Agent restores shadow copy of previous binary
   - Service restarts with previous version
   - Rollback completes in < 2 minutes (NFR-R5)

3. **AC3** - Reporting
   - Failure reported to SaaS with error details
   - Failed version marked for investigation
   - Agent continues operating on previous version

4. **AC4** - State Tracking
   - Rollback state tracked in metadata
   - Rollback availability flag updated

## Tasks / Subtasks

- [x] Task 1: Implement Rollback (AC: 1, 2)
  - [x] rollback method
  - [x] can_rollback check
  - [x] Shadow copy restoration

- [x] Task 2: Implement Cleanup (AC: 4)
  - [x] cleanup_shadow method
  - [x] Metadata update on rollback

- [x] Task 3: Add Tests (AC: All)
  - [x] Rollback constant tests
  - [x] UpdateResult with rollback tests

## Dev Notes

### Rollback Flow

```
1. Detect failure (hash mismatch, installation error, health check failure)
2. Copy shadow file back to binary location
3. Set executable permissions (Unix)
4. Update metadata (rollback_available = false)
5. Report failure to SaaS
6. Continue with previous version
```

### NFR-R5 Compliance

```
MAX_ROLLBACK_SECS = 120  // < 2 minutes
```

### State Transitions

```
Installing (failure) -> RolledBack
Verifying (failure) -> Failed (no rollback needed)
Downloading (failure) -> Failed (no rollback needed)
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Rollback method restores shadow copy
- Cleanup method removes shadow after success
- Metadata tracks rollback availability
- < 2 minute rollback time (NFR-R5)

### File List

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/updater.rs (shared with 10.2)

### Change Log

- 2026-01-23: Implemented as part of updater.rs module

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** APPROVED WITH FIXES

### Review Findings (Fixed)

| Issue | Severity | Status |
|-------|----------|--------|
| Health check rollback trigger missing (AC1) | HIGH | ✅ Fixed (in 10.2) |
| Failed version not marked for investigation (AC3) | MEDIUM | ✅ Fixed |

### Fixes Applied

1. **Health check rollback** - perform_health_check() integrated into apply_update, triggers rollback on failure
2. **mark_version_failed()** - New method reports failed version to SaaS `/v1/agents/{id}/versions/failed`
3. **Failed version reports** - Include version, reason, timestamp, and agent version
