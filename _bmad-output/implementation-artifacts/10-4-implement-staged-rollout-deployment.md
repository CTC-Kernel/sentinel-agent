# Story 10.4: Implement Staged Rollout Deployment

Status: done

## Story

As a **Platform Operator**,
I want **updates deployed in phases**,
So that **faulty updates are caught before affecting all agents**.

## Acceptance Criteria

1. **AC1** - Rollout Groups
   - Agents assigned to rollout groups (1%, 10%, 50%, 100%)
   - Assignment fetched from SaaS

2. **AC2** - Eligibility Check
   - Agent checks eligibility before applying update
   - Blocked versions prevent update

3. **AC3** - Failure Tracking
   - Failure rate monitored per rollout
   - Rollout paused if threshold exceeded

4. **AC4** - Status Reporting
   - Rollout status visible to operators
   - Emergency rollback affects all updated agents

## Tasks / Subtasks

- [x] Task 1: Implement RolloutService (AC: 1, 2)
  - [x] fetch_assignment method
  - [x] rollout_group method
  - [x] is_eligible_for_update method

- [x] Task 2: Implement RolloutStatus (AC: 3, 4)
  - [x] RolloutStatus struct
  - [x] RolloutAssignment struct
  - [x] Failure rate tracking

- [x] Task 3: Add Tests (AC: All)
  - [x] Rollout status tests
  - [x] Assignment deserialization tests

## Dev Notes

### Rollout Groups

| Group | Percentage | Description |
|-------|------------|-------------|
| Canary | 1% | First testers |
| EarlyAdopter | 10% | Early adopters |
| Majority | 50% | Main rollout |
| GeneralAvailability | 100% | Full release |

### RolloutAssignment Structure

```rust
RolloutAssignment {
    group: String,
    percentage_rank: u8,
    eligible: bool,
    assigned_at: DateTime<Utc>,
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- RolloutService for managing staged deployment
- Eligibility checking based on group assignment
- Blocked version integration
- Failure rate threshold support

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/rollout.rs

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs

### Change Log

- 2026-01-23: Implemented RolloutService

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** APPROVED WITH FIXES

### Review Findings (Fixed)

| Issue | Severity | Status |
|-------|----------|--------|
| Emergency rollback broadcast not implemented (AC4) | MEDIUM | ✅ Fixed |

### Fixes Applied

1. **EmergencyRollbackCommand struct** - New struct for emergency rollback commands
2. **check_emergency_rollback()** - Fetches emergency rollback from `/v1/agents/{id}/emergency-rollback`
3. **acknowledge_emergency_rollback()** - Reports success/failure to SaaS
4. **should_emergency_rollback()** - Checks if current version is affected
5. **sync()** - Now also checks for emergency rollback commands
