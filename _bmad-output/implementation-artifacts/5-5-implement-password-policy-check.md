# Story 5.5: Implement Password Policy Check

Status: review

## Story

As a **CISO**,
I want **the agent to verify password policy compliance**,
So that **I know credential policies meet security standards**.

## Acceptance Criteria

1. **AC1** - Windows Check
   - Local Security Policy queried via `net accounts` and `secedit`
   - Result includes: min_length, complexity_required, max_age_days, history_count, lockout_threshold

2. **AC2** - Linux Check
   - PAM configuration and /etc/login.defs parsed
   - Result includes: min_length, complexity_modules, max_age_days, password_history

3. **AC3** - macOS Check
   - pwpolicy queried for global password settings
   - Result includes: min_length, complexity, max_age, history

4. **AC4** - Compliance Logic
   - Non-compliance if min_length < 12 or complexity disabled
   - Issues list populated with specific non-compliance reasons

5. **AC5** - Framework Mapping
   - Check mapped to NIS2, DORA
   - High severity (Authentication category)

## Tasks / Subtasks

- [x] Task 1: Implement PasswordPolicyStatus Types (AC: All)
  - [x] PasswordPolicyStatus struct
  - [x] Serialization support
  - [x] Compliance validation method

- [x] Task 2: Implement Windows Check (AC: 1)
  - [x] net accounts parsing
  - [x] secedit for complexity check
  - [x] Parse all policy values

- [x] Task 3: Implement Linux Check (AC: 2)
  - [x] /etc/login.defs parsing
  - [x] PAM configuration parsing
  - [x] pwquality.conf parsing
  - [x] Complexity module detection

- [x] Task 4: Implement macOS Check (AC: 3)
  - [x] pwpolicy getaccountpolicies
  - [x] pwpolicy -getglobalpolicy
  - [x] Parse plist/key-value output

- [x] Task 5: Add Tests (AC: All)
  - [x] 10 unit tests
  - [x] Compliance logic tests
  - [x] Parsing tests
  - [x] Live execution test

## Dev Notes

### PasswordPolicyStatus Structure

```rust
PasswordPolicyStatus {
    compliant: bool,
    min_length: Option<u32>,
    complexity_required: Option<bool>,
    max_age_days: Option<u32>,
    min_age_days: Option<u32>,
    history_count: Option<u32>,
    lockout_threshold: Option<u32>,
    lockout_duration_minutes: Option<u32>,
    complexity_modules: Vec<String>,
    issues: Vec<String>,
    raw_output: String,
}
```

### Compliance Rules

| Rule | Threshold | Action |
|------|-----------|--------|
| min_length | >= 12 | FAIL if less |
| complexity | enabled | FAIL if disabled |

### Platform Detection

| Platform | Primary | Secondary |
|----------|---------|-----------|
| Windows | net accounts | secedit (complexity) |
| Linux | /etc/login.defs | PAM (/etc/pam.d/*) + pwquality.conf |
| macOS | pwpolicy getaccountpolicies | pwpolicy -getglobalpolicy |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- PasswordPolicyCheck implementing Check trait
- Windows: net accounts + secedit PowerShell
- Linux: login.defs + PAM + pwquality.conf parsing
- macOS: pwpolicy commands
- Compliance validation: min_length >= 12, complexity required
- NIS2, DORA framework mapping
- Total: 75 tests in agent-scanner

### File List

**New Files Created:**
- sentinel-agent/crates/agent-scanner/src/checks/password_policy.rs

**Modified Files:**
- sentinel-agent/crates/agent-scanner/src/checks/mod.rs
- sentinel-agent/crates/agent-scanner/src/checks/firewall.rs (warning fix)

### Change Log

- 2026-01-23: Created PasswordPolicyCheck
- 2026-01-23: Implemented Windows/Linux/macOS detection
- 2026-01-23: Added 10 unit tests
- 2026-01-23: Fixed firewall.rs warning

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
