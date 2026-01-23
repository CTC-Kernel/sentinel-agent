# Story 5.10: Implement Local Admin Accounts Check

Status: review

## Story

As a **CISO**,
I want **the agent to audit local administrator accounts**,
So that **I know privileged access is controlled**.

## Acceptance Criteria

1. **AC1** - Windows Check
   - Local Administrators group members enumerated
   - Result includes: admin_accounts[], count, non_standard_admins[]

2. **AC2** - Linux Check
   - Users with sudo/wheel group or UID 0 enumerated
   - Result includes: root_enabled, sudo_users[], wheel_members[]

3. **AC3** - macOS Check
   - Admin group members enumerated
   - Root account status checked

4. **AC4** - Compliance Logic
   - Warning if admin count > 3
   - Warning if unexpected/non-standard accounts found

5. **AC5** - Framework Mapping
   - Check mapped to NIS2, DORA
   - Medium severity (Accounts category)

## Tasks / Subtasks

- [x] Task 1: Implement AdminAccountsStatus Types (AC: All)
  - [x] AdminAccountsStatus struct
  - [x] Serialization support
  - [x] Compliance validation method

- [x] Task 2: Implement Windows Check (AC: 1)
  - [x] Get-LocalGroupMember PowerShell
  - [x] net localgroup fallback
  - [x] Built-in admin status

- [x] Task 3: Implement Linux Check (AC: 2)
  - [x] /etc/group parsing
  - [x] /etc/shadow root status
  - [x] /etc/sudoers parsing
  - [x] UID 0 detection

- [x] Task 4: Implement macOS Check (AC: 3)
  - [x] dscl admin group
  - [x] Root account status
  - [x] wheel group members

- [x] Task 5: Add Tests (AC: All)
  - [x] 7 unit tests
  - [x] Compliance logic tests
  - [x] Live execution test

## Dev Notes

### AdminAccountsStatus Structure

```rust
AdminAccountsStatus {
    admin_count: u32,
    admin_accounts: Vec<String>,
    non_standard_admins: Vec<String>,
    root_enabled: Option<bool>,
    sudo_users: Vec<String>,
    wheel_members: Vec<String>,
    builtin_admin_enabled: Option<bool>,
    compliant: bool,
    issues: Vec<String>,
    raw_output: String,
}
```

### Compliance Rules

| Rule | Threshold | Action |
|------|-----------|--------|
| admin_count | <= 3 | WARN if > 3 |
| non_standard_admins | empty | WARN if non-standard found |

### Platform Detection

| Platform | Method | Source |
|----------|--------|--------|
| Windows | Get-LocalGroupMember | Administrators group |
| Linux | /etc/group | wheel, sudo groups |
| Linux | /etc/passwd | UID 0 accounts |
| macOS | dscl | admin group |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- AdminAccountsCheck implementing Check trait
- Windows: Get-LocalGroupMember + net localgroup
- Linux: /etc/group + /etc/shadow + sudoers + UID 0
- macOS: dscl admin group + root status
- Compliance: warn > 3 admins, warn non-standard
- NIS2, DORA framework mapping
- Total: 115 tests in agent-scanner

### File List

**New Files Created:**
- sentinel-agent/crates/agent-scanner/src/checks/admin_accounts.rs

**Modified Files:**
- sentinel-agent/crates/agent-scanner/src/checks/mod.rs

### Change Log

- 2026-01-23: Created AdminAccountsCheck
- 2026-01-23: Implemented Windows/Linux/macOS detection
- 2026-01-23: Added 7 unit tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
