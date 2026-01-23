# Story 5.4: Implement Firewall Configuration Check

Status: review

## Story

As a **CISO**,
I want **the agent to verify firewall is enabled**,
So that **I know endpoints have network protection**.

## Acceptance Criteria

1. **AC1** - Windows Check
   - Windows Firewall status retrieved for all profiles (Domain, Private, Public)
   - Result includes: profile_name, enabled, default_inbound_action, default_outbound_action

2. **AC2** - Linux Check
   - iptables/nftables/ufw status retrieved
   - Result includes: firewall_type, enabled, rule_count, default_policy

3. **AC3** - macOS Check
   - Application Firewall (ALF) status checked
   - Stealth mode and block all settings detected

4. **AC4** - Framework Mapping
   - Check mapped to NIS2, DORA
   - High severity (Firewall category)

## Tasks / Subtasks

- [x] Task 1: Implement FirewallStatus Types (AC: All)
  - [x] FirewallStatus struct
  - [x] FirewallProfile struct
  - [x] Serialization support

- [x] Task 2: Implement Windows Check (AC: 1)
  - [x] Get-NetFirewallProfile PowerShell
  - [x] Parse all profile states
  - [x] Get rule count

- [x] Task 3: Implement Linux Check (AC: 2)
  - [x] ufw status verbose
  - [x] nftables list ruleset
  - [x] iptables -L fallback

- [x] Task 4: Implement macOS Check (AC: 3)
  - [x] socketfilterfw --getglobalstate
  - [x] Stealth and block all modes

- [x] Task 5: Add Tests (AC: All)
  - [x] 6 unit tests
  - [x] Serialization tests
  - [x] Live execution test

## Dev Notes

### FirewallStatus Structure

```rust
FirewallStatus {
    enabled: bool,
    firewall_type: String,        // "Windows Firewall", "ufw", "iptables", "ALF"
    profiles: Vec<FirewallProfile>,
    rule_count: Option<u32>,
    raw_output: String,
}

FirewallProfile {
    name: String,                 // "Domain", "Private", "Public", "INPUT"
    enabled: bool,
    default_inbound: Option<String>,   // "Block", "Allow"
    default_outbound: Option<String>,
    rule_count: Option<u32>,
}
```

### Platform Detection Order

| Platform | Priority | Command |
|----------|----------|---------|
| Windows | 1 | `Get-NetFirewallProfile` |
| Linux | 1 | `ufw status verbose` |
| Linux | 2 | `nft list ruleset` |
| Linux | 3 | `iptables -L -n` |
| macOS | 1 | `socketfilterfw --getglobalstate` |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- FirewallCheck implementing Check trait
- Windows: All 3 profiles checked
- Linux: ufw > nftables > iptables fallback
- macOS: ALF with stealth/block detection
- Total: 65 tests in agent-scanner

### File List

**New Files Created:**
- sentinel-agent/crates/agent-scanner/src/checks/firewall.rs

**Modified Files:**
- sentinel-agent/crates/agent-scanner/src/checks/mod.rs

### Change Log

- 2026-01-23: Created FirewallCheck
- 2026-01-23: Implemented Windows/Linux/macOS detection
- 2026-01-23: Added 6 unit tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
