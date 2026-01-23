# Story 6.4: Implement Offline Mode with 7-Day Autonomy

Status: review

## Story

As an **agent**,
I want **to operate fully offline for at least 7 days**,
So that **disconnected endpoints maintain compliance monitoring**.

## Acceptance Criteria

1. **AC1** - Offline Detection
   - Detect loss of connectivity to SaaS
   - Track offline duration
   - Log offline entry/exit events

2. **AC2** - Continued Operation
   - Checks continue executing on schedule using cached rules
   - Results and proofs stored locally (NFR-R4: 0% data loss)
   - Compliance score continues updating locally

3. **AC3** - Autonomy Period
   - 7-day minimum autonomy (NFR)
   - Track time within autonomy period
   - No functionality degrades during offline period

4. **AC4** - Status Tracking
   - Log offline duration and queued item count
   - Provide status summary for monitoring
   - Track last successful connection

## Tasks / Subtasks

- [x] Task 1: Implement OfflineTracker (AC: 1, 3)
  - [x] is_offline state tracking
  - [x] offline_since timestamp
  - [x] offline_duration calculation
  - [x] is_within_autonomy_period check

- [x] Task 2: Implement Status Tracking (AC: 4)
  - [x] OfflineStatus struct
  - [x] queued_count tracking
  - [x] last_connected timestamp

- [x] Task 3: Add Tests (AC: All)
  - [x] Offline tracker tests
  - [x] Duration calculation tests
  - [x] Status tracking tests

## Dev Notes

### OfflineTracker Structure

```rust
OfflineTracker {
    is_offline: AtomicBool,
    offline_since: RwLock<Option<DateTime<Utc>>>,
    last_connected: RwLock<Option<DateTime<Utc>>>,
    queued_count: AtomicU32,
}
```

### OfflineStatus Structure

```rust
OfflineStatus {
    is_offline: bool,
    offline_since: Option<DateTime<Utc>>,
    last_connected: Option<DateTime<Utc>>,
    offline_duration_hours: Option<u32>,
    queued_item_count: u32,
    within_autonomy_period: bool,
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- OfflineTracker with atomic state management
- 7-day autonomy period validation
- Status summary for monitoring
- Queued item count tracking
- Entry/exit logging
- Part of offline.rs module

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/offline.rs (shared with 6-5, 6-6)

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs

### Change Log

- 2026-01-23: Implemented as part of offline.rs module

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
