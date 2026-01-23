# Story 10.5: Configure Update Policy

Status: done

## Story

As an **IT Administrator**,
I want **to configure how agents handle updates**,
So that **I control when and how updates are applied**.

## Acceptance Criteria

1. **AC1** - Policy Types
   - Automatic: Updates applied immediately
   - Manual approval: Wait for admin approval
   - Deferred: Delay N days after release
   - Disabled: No updates (except mandatory)

2. **AC2** - Maintenance Window
   - Maintenance window configurable (start/end hours)
   - Days of week for updates configurable

3. **AC3** - Policy Sync
   - Policy configuration synced from SaaS
   - Mandatory security updates override policy

4. **AC4** - Policy Enforcement
   - Updates only apply within maintenance window
   - Policy checked before update application

## Tasks / Subtasks

- [x] Task 1: Implement PolicyConfig (AC: 1, 2)
  - [x] PolicyConfig struct
  - [x] to_update_policy method
  - [x] is_maintenance_window method

- [x] Task 2: Implement Policy Sync (AC: 3)
  - [x] fetch_policy_config method
  - [x] update_policy method

- [x] Task 3: Implement Policy Enforcement (AC: 4)
  - [x] is_update_allowed method
  - [x] Maintenance window checking

- [x] Task 4: Add Tests (AC: All)
  - [x] Policy config tests
  - [x] Maintenance window tests

## Dev Notes

### PolicyConfig Structure

```rust
PolicyConfig {
    policy: String,              // automatic, manual_approval, deferred, disabled
    deferred_days: u32,          // Days to defer
    maintenance_window_start: Option<u8>,  // Hour 0-23
    maintenance_window_end: Option<u8>,    // Hour 0-23
    maintenance_days: Vec<u8>,   // Days 0=Sun, 6=Sat
}
```

### Maintenance Window Logic

- If no window configured, always allowed
- Window can cross midnight (start=22, end=6)
- Days of week filtering applied first

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- PolicyConfig with maintenance window support
- is_maintenance_window handles midnight crossing
- Policy sync from SaaS
- Mandatory updates override disabled policy

### File List

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/rollout.rs (shared)

### Change Log

- 2026-01-23: Implemented as part of rollout.rs module

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** APPROVED

### Review Findings

| Issue | Severity | Status |
|-------|----------|--------|
| All ACs met | - | ✅ Passed |

### Notes

- PolicyConfig with maintenance window support
- is_maintenance_window() handles midnight crossing
- Policy types all implemented
- Mandatory updates override disabled policy
