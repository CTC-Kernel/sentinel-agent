# Story 5.6: Implement Session Lock Check

Status: review

## Story

As a **CISO**,
I want **the agent to verify automatic session lock is configured**,
So that **unattended endpoints are protected**.

## Acceptance Criteria

1. **AC1** - Windows Check
   - Screen saver and lock settings retrieved from registry/GPO
   - Result includes: lock_enabled, timeout_minutes, require_password

2. **AC2** - Linux Check
   - Desktop environment lock settings retrieved (GNOME, KDE, XFCE)
   - Result includes: lock_enabled, timeout_minutes, lock_on_suspend
   - Supports multiple DEs with fallback to generic lock tools

3. **AC3** - macOS Check
   - Screen saver and lock settings via defaults/pmset
   - Result includes: lock_enabled, timeout_minutes, require_password

4. **AC4** - Compliance Logic
   - Non-compliance if timeout > 15 minutes or lock disabled
   - Non-compliance if password not required on unlock

5. **AC5** - Framework Mapping
   - Check mapped to NIS2, DORA
   - Medium severity (Authentication category)

## Tasks / Subtasks

- [x] Task 1: Implement SessionLockStatus Types (AC: All)
  - [x] SessionLockStatus struct
  - [x] Serialization support
  - [x] Compliance validation method

- [x] Task 2: Implement Windows Check (AC: 1)
  - [x] Registry screen saver settings
  - [x] GPO override detection
  - [x] Power settings for lock on sleep

- [x] Task 3: Implement Linux Check (AC: 2)
  - [x] GNOME gsettings
  - [x] KDE config files
  - [x] XFCE xfconf-query
  - [x] systemd-logind settings
  - [x] Generic lock daemon detection

- [x] Task 4: Implement macOS Check (AC: 3)
  - [x] defaults read screensaver
  - [x] pmset display sleep
  - [x] askForPassword setting

- [x] Task 5: Add Tests (AC: All)
  - [x] 9 unit tests
  - [x] Compliance logic tests
  - [x] Live execution test

## Dev Notes

### SessionLockStatus Structure

```rust
SessionLockStatus {
    lock_enabled: bool,
    timeout_minutes: Option<u32>,
    require_password: bool,
    lock_on_suspend: bool,
    desktop_environment: Option<String>,
    compliant: bool,
    issues: Vec<String>,
    raw_output: String,
}
```

### Compliance Rules

| Rule | Threshold | Action |
|------|-----------|--------|
| lock_enabled | true | FAIL if false |
| timeout_minutes | <= 15 | FAIL if > 15 |
| require_password | true | FAIL if false |

### Platform Detection

| Platform | Primary | Fallback |
|----------|---------|----------|
| Windows | Registry + GPO | PowerShell secedit |
| Linux | gsettings (GNOME) | KDE config, XFCE, logind |
| macOS | defaults read | pmset |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- SessionLockCheck implementing Check trait
- Windows: Registry + GPO + Power settings
- Linux: GNOME/KDE/XFCE + logind + generic
- macOS: defaults + pmset
- Compliance: timeout <= 15min, lock enabled, password required
- NIS2, DORA framework mapping
- Total: 84 tests in agent-scanner

### File List

**New Files Created:**
- sentinel-agent/crates/agent-scanner/src/checks/session_lock.rs

**Modified Files:**
- sentinel-agent/crates/agent-scanner/src/checks/mod.rs

### Change Log

- 2026-01-23: Created SessionLockCheck
- 2026-01-23: Implemented Windows/Linux/macOS detection
- 2026-01-23: Added 9 unit tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
