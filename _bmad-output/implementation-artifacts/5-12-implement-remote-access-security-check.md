# Story 5.12: Implement Remote Access Security Check

Status: review

## Story

As a **CISO**,
I want **the agent to verify remote access security**,
So that **I know remote connections are properly secured**.

## Acceptance Criteria

1. **AC1** - Windows Check
   - RDP settings verified (NLA, encryption)
   - WinRM and SSH status checked
   - Result includes: rdp_config, nla_required, encryption_level

2. **AC2** - Linux Check
   - SSH configuration parsed
   - Result includes: permit_root_login, password_auth, pubkey_auth

3. **AC3** - macOS Check
   - Screen sharing and remote management checked
   - SSH configuration parsed
   - Result includes: ssh_config, screen_sharing_enabled

4. **AC4** - Security Issues
   - Flag root login permitted
   - Flag password authentication on SSH
   - Flag NLA not required on RDP

5. **AC5** - Framework Mapping
   - Check mapped to NIS2, DORA
   - High severity (RemoteAccess category)

## Tasks / Subtasks

- [x] Task 1: Implement RemoteAccessStatus Types (AC: All)
  - [x] RemoteAccessStatus struct
  - [x] SshConfig struct
  - [x] RdpConfig struct
  - [x] Serialization support

- [x] Task 2: Implement Windows Check (AC: 1)
  - [x] RDP registry settings
  - [x] NLA requirement check
  - [x] WinRM status
  - [x] OpenSSH server status

- [x] Task 3: Implement Linux Check (AC: 2)
  - [x] sshd service status
  - [x] /etc/ssh/sshd_config parsing
  - [x] VNC detection

- [x] Task 4: Implement macOS Check (AC: 3)
  - [x] Screen sharing launchctl
  - [x] Remote management (ARD)
  - [x] Remote login (systemsetup)
  - [x] SSH config parsing

- [x] Task 5: Add Tests (AC: All)
  - [x] 7 unit tests
  - [x] Compliance logic tests
  - [x] Live execution test

## Dev Notes

### RemoteAccessStatus Structure

```rust
RemoteAccessStatus {
    remote_access_enabled: bool,
    ssh_config: Option<SshConfig>,
    rdp_config: Option<RdpConfig>,
    screen_sharing_enabled: Option<bool>,
    remote_management_enabled: Option<bool>,
    security_issues: Vec<String>,
    compliant: bool,
    issues: Vec<String>,
    raw_output: String,
}

SshConfig {
    enabled: bool,
    permit_root_login: Option<bool>,
    password_auth: Option<bool>,
    pubkey_auth: Option<bool>,
    port: Option<u16>,
    auth_methods: Vec<String>,
}
```

### Security Issues Detected

| Issue | Risk |
|-------|------|
| SSH root login permitted | High |
| SSH password auth enabled | Medium |
| RDP NLA not required | High |
| RDP low encryption | Medium |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- RemoteAccessCheck implementing Check trait
- Windows: RDP + WinRM + OpenSSH
- Linux: sshd_config + VNC detection
- macOS: Screen sharing + ARD + SSH
- Security issues flagged automatically
- NIS2, DORA framework mapping
- Total: 128 tests in agent-scanner

### File List

**New Files Created:**
- sentinel-agent/crates/agent-scanner/src/checks/remote_access.rs

**Modified Files:**
- sentinel-agent/crates/agent-scanner/src/checks/mod.rs

### Change Log

- 2026-01-23: Created RemoteAccessCheck
- 2026-01-23: Implemented Windows/Linux/macOS detection
- 2026-01-23: Added 7 unit tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
