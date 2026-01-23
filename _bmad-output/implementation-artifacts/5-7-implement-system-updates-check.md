# Story 5.7: Implement System Updates Check

Status: review

## Story

As a **CISO**,
I want **the agent to verify system updates are current**,
So that **I know endpoints have security patches applied**.

## Acceptance Criteria

1. **AC1** - Windows Check
   - Windows Update status retrieved via COM API
   - Result includes: last_check_date, pending_updates_count, pending_security_updates, last_install_date

2. **AC2** - Linux Check
   - Package manager (apt/yum/dnf) queried
   - Result includes: last_update_date, upgradable_packages_count, security_updates_pending

3. **AC3** - macOS Check
   - softwareupdate command used
   - Result includes: pending_updates, pending_security_updates, auto_updates_enabled

4. **AC4** - Compliance Logic
   - Non-compliance if security updates pending > 7 days
   - Non-compliance if update check is stale (> 7 days)

5. **AC5** - Framework Mapping
   - Check mapped to NIS2, DORA
   - High severity (Updates category)

## Tasks / Subtasks

- [x] Task 1: Implement SystemUpdatesStatus Types (AC: All)
  - [x] SystemUpdatesStatus struct
  - [x] Serialization support
  - [x] Compliance validation method

- [x] Task 2: Implement Windows Check (AC: 1)
  - [x] Windows Update COM API via PowerShell
  - [x] Pending updates count
  - [x] Security updates detection
  - [x] Auto-update settings

- [x] Task 3: Implement Linux Check (AC: 2)
  - [x] apt package manager
  - [x] dnf package manager
  - [x] yum package manager
  - [x] Security updates detection
  - [x] Auto-upgrade status

- [x] Task 4: Implement macOS Check (AC: 3)
  - [x] softwareupdate --list
  - [x] Auto-update settings via defaults

- [x] Task 5: Add Tests (AC: All)
  - [x] 8 unit tests
  - [x] Compliance logic tests
  - [x] Live execution test

## Dev Notes

### SystemUpdatesStatus Structure

```rust
SystemUpdatesStatus {
    up_to_date: bool,
    last_check_date: Option<DateTime<Utc>>,
    last_install_date: Option<DateTime<Utc>>,
    pending_updates_count: u32,
    pending_security_updates: u32,
    upgradable_packages: u32,
    package_manager: Option<String>,
    auto_updates_enabled: Option<bool>,
    days_since_check: Option<i64>,
    compliant: bool,
    issues: Vec<String>,
    raw_output: String,
}
```

### Compliance Rules

| Rule | Threshold | Action |
|------|-----------|--------|
| pending_security_updates | 0 | FAIL if > 0 |
| days_since_check | <= 7 | FAIL if > 7 days |

### Platform Detection

| Platform | Primary | Detection |
|----------|---------|-----------|
| Windows | Windows Update COM | PowerShell |
| Linux | apt | which apt |
| Linux | dnf | which dnf |
| Linux | yum | which yum |
| macOS | softwareupdate | Built-in |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- SystemUpdatesCheck implementing Check trait
- Windows: Windows Update COM API via PowerShell
- Linux: apt/dnf/yum detection and status
- macOS: softwareupdate + defaults
- Compliance: no pending security updates, check < 7 days
- NIS2, DORA framework mapping
- Total: 92 tests in agent-scanner

### File List

**New Files Created:**
- sentinel-agent/crates/agent-scanner/src/checks/system_updates.rs

**Modified Files:**
- sentinel-agent/crates/agent-scanner/src/checks/mod.rs

### Change Log

- 2026-01-23: Created SystemUpdatesCheck
- 2026-01-23: Implemented Windows/Linux/macOS detection
- 2026-01-23: Added 8 unit tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
