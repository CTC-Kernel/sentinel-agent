# Story 6.6: Handle Synchronization Conflicts

Status: review

## Story

As an **administrator**,
I want **conflicts handled gracefully after offline periods**,
So that **no data is lost and state is consistent**.

## Acceptance Criteria

1. **AC1** - Config Conflicts
   - Server configuration takes precedence (server wins)
   - Local results uploaded regardless of config changes

2. **AC2** - Rule Conflicts
   - Conflicting check rules resolved by version timestamp
   - Most recent version wins

3. **AC3** - Resolution Logging
   - Conflict resolution logged with before/after state
   - Manual conflict items flagged for admin review (edge cases)

4. **AC4** - Strategies
   - ServerWins strategy for config
   - MostRecent strategy for rules
   - ClientWins strategy available for data

## Tasks / Subtasks

- [x] Task 1: Implement ConflictResolution (AC: 1, 2, 3)
  - [x] ConflictStrategy enum
  - [x] ConflictResolution struct
  - [x] resolve_config_conflict function
  - [x] resolve_rule_conflict function

- [x] Task 2: Add Logging (AC: 3)
  - [x] Log before/after values
  - [x] needs_review flag for edge cases

- [x] Task 3: Add Tests (AC: All)
  - [x] Config conflict tests
  - [x] Rule conflict tests
  - [x] Strategy tests

## Dev Notes

### ConflictResolution Structure

```rust
ConflictResolution {
    key: String,
    strategy: ConflictStrategy,
    before: String,
    after: String,
    needs_review: bool,
}
```

### ConflictStrategy Enum

```rust
ConflictStrategy {
    ServerWins,   // For configuration
    ClientWins,   // For local data
    MostRecent,   // For versioned items
}
```

### Resolution Rules

| Entity | Strategy | Winner |
|--------|----------|--------|
| Config | ServerWins | Remote |
| Rules | MostRecent | Newer timestamp |
| Results | ClientWins | Local |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- ConflictStrategy with three modes
- resolve_config_conflict (server wins)
- resolve_rule_conflict (timestamp-based)
- needs_review flag for edge cases
- Part of offline.rs module

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/offline.rs (shared with 6-4, 6-5)

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs

### Change Log

- 2026-01-23: Implemented as part of offline.rs module

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
