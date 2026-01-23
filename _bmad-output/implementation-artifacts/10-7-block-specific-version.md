# Story 10.7: Block Specific Version

Status: done

## Story

As an **IT Administrator**,
I want **to block a specific agent version**,
So that **faulty versions cannot be installed or remain running**.

## Acceptance Criteria

1. **AC1** - Blocked Version List
   - Blocked versions fetched from SaaS
   - Cached locally for offline operation

2. **AC2** - Version Checking
   - Agent checks blocked list before installing
   - Blocked version cannot be installed

3. **AC3** - Existing Agents
   - Agents on blocked version prompted to update
   - Staged rollout halted for blocked version

4. **AC4** - Block Management
   - Block reason recorded
   - Block can be lifted if issue resolved

## Tasks / Subtasks

- [x] Task 1: Implement BlockedVersion (AC: 1, 4)
  - [x] BlockedVersion struct
  - [x] fetch_blocked_versions method
  - [x] Local cache using HashSet

- [x] Task 2: Implement Version Checking (AC: 2, 3)
  - [x] is_version_blocked method
  - [x] Integration with eligibility check

- [x] Task 3: Add Tests (AC: All)
  - [x] Blocked version serialization tests
  - [x] HashSet tests

## Dev Notes

### BlockedVersion Structure

```rust
BlockedVersion {
    version: String,
    reason: String,
    blocked_by: String,
    blocked_at: DateTime<Utc>,
}
```

### Blocking Flow

```
1. Admin blocks version in console
2. Blocked list updated in SaaS
3. Agent fetches blocked list on sync
4. Agent checks list before update
5. Blocked version rejected
```

### Integration Points

- is_eligible_for_update checks blocked list first
- Rollout service sync includes blocked versions
- Cache updated periodically

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- BlockedVersion struct with metadata
- HashSet cache for fast lookups
- Integration with eligibility checking
- Sync method updates all rollout info

### File List

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/rollout.rs (shared)

### Change Log

- 2026-01-23: Implemented as part of rollout.rs module

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** APPROVED WITH FIXES

### Review Findings (Fixed)

| Issue | Severity | Status |
|-------|----------|--------|
| Agents on blocked version not prompted to update (AC3) | MEDIUM | ✅ Fixed |

### Fixes Applied

1. **set_current_version()** - New method to store agent's running version
2. **is_current_version_blocked()** - Checks if current version is in blocked list
3. **sync()** - Now warns if current version is blocked
4. **Warning log** - "Agent is running a blocked version - update required!"
