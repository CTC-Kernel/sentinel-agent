# Story 12.3: Identify Recent Agent Errors

Status: done

## Story

As a **Support Engineer**,
I want **to see the most recent errors from an agent**,
So that **I can quickly diagnose problems**.

## Acceptance Criteria

1. **AC1** - Error Tracking
   - Last 50 errors stored
   - Error includes: timestamp, code, message, context

2. **AC2** - Error Analysis
   - Errors grouped by type
   - Error count per category
   - Time since last error

3. **AC3** - Error Retention
   - Errors older than 7 days purged
   - Most critical errors prioritized

## Tasks / Subtasks

- [x] Task 1: Implement ErrorEntry (AC: 1)
  - [x] ErrorEntry struct with all fields
  - [x] Context HashMap for additional data
  - [x] JSON serialization

- [x] Task 2: Implement ErrorTracker (AC: 1, 2, 3)
  - [x] ErrorTracker struct with capacity
  - [x] record_error method
  - [x] get_recent method
  - [x] get_by_code filter
  - [x] get_counts aggregation
  - [x] cleanup_old method (7-day retention)

- [x] Task 3: Add Tests (AC: All)
  - [x] Error recording tests
  - [x] Filtering tests
  - [x] Cleanup tests

## Dev Notes

### ErrorEntry Structure

```rust
ErrorEntry {
    id: u64,
    timestamp: DateTime<Utc>,
    code: String,
    message: String,
    context: HashMap<String, String>,
}
```

### Error Categories

- SYNC_* - Synchronization errors
- AUTH_* - Authentication errors
- CHECK_* - Compliance check errors
- UPDATE_* - Update errors
- STORAGE_* - Storage errors

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- ErrorTracker with 50 error capacity
- 7-day retention cleanup
- Error count aggregation by code
- Context support for debugging

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/diagnostics.rs (shared)

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs

### Change Log

- 2026-01-23: Implemented as part of diagnostics.rs module

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** APPROVED WITH FIXES

### Review Findings (Fixed)

| Issue | Severity | Status |
|-------|----------|--------|
| ErrorEntry missing context HashMap (AC1) | MEDIUM | ✅ Fixed |
| ErrorTracker no capacity limit of 50 (AC1) | MEDIUM | ✅ Fixed |

### Fixes Applied

1. **ErrorEntry** - Added `context: HashMap<String, String>` field
2. **ErrorTracker** - Added `max_entries` with default 50, `with_capacity()` constructor
3. **record_error_with_context()** - New method accepting context HashMap
4. **MAX_ERROR_ENTRIES** constant (50)
5. **first_seen** tracking - Proper first occurrence tracking per error code
