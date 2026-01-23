# Story 10.1: Check for Available Updates

Status: done

## Story

As an **agent**,
I want **to check for new versions periodically**,
So that **I can stay up-to-date with the latest security and features**.

## Acceptance Criteria

1. **AC1** - Periodic Check
   - Agent queries `/v1/updates/check` with current version
   - Default check interval is 4 hours
   - Check respects staged rollout assignment

2. **AC2** - Response Handling
   - Response includes: available (bool), version, release_notes, mandatory, sha256
   - Update availability is logged
   - Agent evaluates update policy before proceeding

3. **AC3** - Policy Evaluation
   - Automatic policy applies updates immediately
   - Manual policy waits for admin approval
   - Deferred policy waits N days after release
   - Mandatory updates override non-automatic policies

4. **AC4** - Staged Rollout
   - Agent belongs to a rollout group (Canary 1%, EarlyAdopter 10%, Majority 50%, GA 100%)
   - Check respects rollout group assignment

## Tasks / Subtasks

- [x] Task 1: Implement UpdateService (AC: 1, 2)
  - [x] UpdateCheckRequest struct
  - [x] UpdateCheckResponse struct
  - [x] check_for_updates method
  - [x] Version comparison using semver

- [x] Task 2: Implement Policy Evaluation (AC: 3)
  - [x] UpdatePolicy enum (Automatic, ManualApproval, Deferred, Disabled)
  - [x] evaluate_policy method
  - [x] Mandatory update handling

- [x] Task 3: Implement Rollout Groups (AC: 4)
  - [x] RolloutGroup enum
  - [x] Group percentage tracking

- [x] Task 4: Add Tests (AC: All)
  - [x] Policy tests
  - [x] Rollout group tests
  - [x] Version comparison tests
  - [x] Serialization tests

## Dev Notes

### UpdatePolicy Enum

```rust
UpdatePolicy {
    Automatic,      // Apply updates immediately
    ManualApproval, // Wait for admin approval
    Deferred,       // Wait N days after release
    Disabled,       // Don't apply (except mandatory)
}
```

### RolloutGroup Enum

```rust
RolloutGroup {
    Canary,             // 1% of fleet
    EarlyAdopter,       // 10% of fleet
    Majority,           // 50% of fleet
    GeneralAvailability // 100% of fleet
}
```

### UpdateState Flow

```
Idle -> Checking -> Pending -> Downloading -> Verifying -> Installing -> Restarting -> Completed/Failed
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- UpdateService with check_for_updates method
- UpdatePolicy for controlling update behavior
- RolloutGroup for staged deployment
- UpdateState for tracking progress
- semver-based version comparison
- Policy evaluation with mandatory override

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/update.rs

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs
- sentinel-agent/crates/agent-sync/src/client.rs (download method)
- sentinel-agent/crates/agent-sync/src/authenticated_client.rs (download method)
- sentinel-agent/crates/agent-sync/Cargo.toml (semver dependency)
- sentinel-agent/Cargo.toml (workspace semver dependency)

### Change Log

- 2026-01-23: Implemented UpdateService with policy and rollout support

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** APPROVED

### Review Findings

| Issue | Severity | Status |
|-------|----------|--------|
| All ACs met | - | ✅ Passed |

### Notes

- All acceptance criteria verified
- UpdatePolicy enum implemented correctly
- RolloutGroup with correct percentages
- Mandatory update override implemented
