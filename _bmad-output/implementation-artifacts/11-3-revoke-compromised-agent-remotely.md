# Story 11.3: Revoke Compromised Agent Remotely

Status: done

## Story

As a **security officer**,
I want **to revoke a compromised agent remotely**,
So that **it can no longer access the SaaS or report data**.

## Acceptance Criteria

1. **AC1** - Revocation Check
   - Agent checks revocation status from SaaS
   - mTLS certificate added to revocation list

2. **AC2** - Session Termination
   - All active sessions terminated immediately
   - Agent receives revocation notice

3. **AC3** - Stop Operations
   - Agent stops all operations upon revocation
   - Revoked agent cannot re-enroll without new token

4. **AC4** - Audit
   - Revocation logged with reason and admin ID
   - Compliance data from compromised agent flagged

## Tasks / Subtasks

- [x] Task 1: Implement RevocationService (AC: 1, 2)
  - [x] RevocationStatus struct
  - [x] check_revocation method
  - [x] Cached status tracking

- [x] Task 2: Implement Revocation Handling (AC: 3, 4)
  - [x] is_revoked method
  - [x] handle_revocation method
  - [x] Logging of revocation events

- [x] Task 3: Add Tests (AC: All)
  - [x] RevocationStatus deserialization tests
  - [x] Not-revoked status tests

## Dev Notes

### RevocationStatus Structure

```rust
RevocationStatus {
    revoked: bool,
    reason: Option<String>,
    revoked_by: Option<String>,
    revoked_at: Option<DateTime<Utc>>,
}
```

### Revocation Flow

```
1. Security officer clicks "Revoke" in console
2. Agent's certificate added to revocation list
3. Agent checks revocation status
4. If revoked, agent stops all operations
5. Revocation logged locally
```

### API Endpoint

```
GET /v1/agents/{id}/revocation
- Returns 200 with RevocationStatus
- Returns 404 if not revoked (treated as not revoked)
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- RevocationService for status checking
- Cached revocation status
- handle_revocation for stopping operations
- Graceful 404 handling (not revoked)

### File List

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/security.rs (shared)

### Change Log

- 2026-01-23: Implemented as part of security.rs module

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** APPROVED WITH FIXES

### Review Findings (Fixed)

| Issue | Severity | Status |
|-------|----------|--------|
| handle_revocation doesn't stop operations (AC3) | HIGH | ✅ Fixed |

### Fixes Applied

1. **RevocationAction enum** - New enum: Continue, StopAndExit, StopSyncOnly
2. **should_stop flag** - AtomicBool for thread-safe stop checking
3. **handle_revocation()** - Returns RevocationAction for caller to act on
4. **should_stop()** - Method for other threads to check if operations should stop
5. **ensure_not_revoked()** - Guard method that returns error if revoked (for request guards)
6. **Audit logging** - Enhanced error logging with reason, revoked_by, and timestamp (AC4)
