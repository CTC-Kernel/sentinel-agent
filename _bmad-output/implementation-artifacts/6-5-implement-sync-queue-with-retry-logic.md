# Story 6.5: Implement Sync Queue with Retry Logic

Status: review

## Story

As an **agent**,
I want **pending uploads queued and retried with exponential backoff**,
So that **data is eventually synchronized without overwhelming the server**.

## Acceptance Criteria

1. **AC1** - Queue Management
   - Queue items in `sync_queue` table with attempt count
   - Process queue FIFO with oldest items first
   - Track retry attempts and timestamps

2. **AC2** - Exponential Backoff
   - Retry uses exponential backoff: 1s, 2s, 4s, 8s... up to 1 hour max
   - Retry continues up to 24 hours (NFR-R6)
   - Calculate next retry time

3. **AC3** - Circuit Breaker
   - Circuit breaker opens after 5 consecutive failures (pause 5 min)
   - Half-open state for testing recovery
   - Success resets failure count

4. **AC4** - Performance
   - Sync completes within 5 minutes after reconnection (NFR-P9)
   - Batch processing for efficiency
   - Priority queue support

## Tasks / Subtasks

- [x] Task 1: Implement SyncQueueItem (AC: 1, 2)
  - [x] SyncQueueItem struct
  - [x] SyncEntityType enum
  - [x] calculate_next_retry method
  - [x] should_retry logic

- [x] Task 2: Implement CircuitBreaker (AC: 3)
  - [x] CircuitState enum
  - [x] is_allowed check
  - [x] record_success/failure methods
  - [x] Automatic state transitions

- [x] Task 3: Add Tests (AC: All)
  - [x] Queue item tests
  - [x] Backoff calculation tests
  - [x] Circuit breaker tests

## Dev Notes

### SyncQueueItem Structure

```rust
SyncQueueItem {
    id: i64,
    entity_type: SyncEntityType,
    entity_id: i64,
    payload: String,
    priority: i32,
    attempts: u32,
    max_attempts: u32,
    last_attempt_at: Option<DateTime<Utc>>,
    last_error: Option<String>,
    created_at: DateTime<Utc>,
    next_retry_at: DateTime<Utc>,
}
```

### Backoff Formula

```
delay = min(INITIAL_DELAY * 2^attempts, MAX_DELAY)
where INITIAL_DELAY = 1s, MAX_DELAY = 3600s
```

### Circuit Breaker States

| State | Description | Transitions |
|-------|-------------|-------------|
| Closed | Normal operation | → Open (5 failures) |
| Open | Requests blocked | → HalfOpen (5 min timeout) |
| HalfOpen | Testing | → Closed (success) / Open (failure) |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- SyncQueueItem with exponential backoff
- CircuitBreaker with state machine
- 24-hour retry window
- 5 consecutive failures threshold
- Part of offline.rs module

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/offline.rs (shared with 6-4, 6-6)

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs

### Change Log

- 2026-01-23: Implemented as part of offline.rs module

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
