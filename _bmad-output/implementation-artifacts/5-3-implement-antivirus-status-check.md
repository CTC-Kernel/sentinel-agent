# Story 5.3: Implement Antivirus Status Check

Status: review

## Story

As a **CISO**,
I want **the agent to verify antivirus is active with current definitions**,
So that **I know endpoints have malware protection**.

## Acceptance Criteria

1. **AC1** - Windows Check
   - Windows Security Center/Defender queried
   - Result includes: av_name, enabled, real_time_protection, definition_date, definition_version
   - Fallback to WMI for third-party AV

2. **AC2** - Linux Check
   - Common AV agents detected (ClamAV, Sophos, ESET)
   - Result includes: av_name, service_running, last_scan_date
   - Check systemd service status

3. **AC3** - macOS Check
   - XProtect (built-in) status checked
   - Third-party AV detection (Malwarebytes, Sophos)

4. **AC4** - Definition Currency
   - Definitions older than 7 days trigger non-compliant status
   - Compliance requires: enabled + real-time + current definitions

5. **AC5** - Framework Mapping
   - Check mapped to NIS2, DORA
   - High severity

## Tasks / Subtasks

- [x] Task 1: Implement AntivirusStatus Types (AC: All)
  - [x] AntivirusStatus struct
  - [x] Serialization support

- [x] Task 2: Implement Windows Check (AC: 1)
  - [x] PowerShell Get-MpComputerStatus
  - [x] WMI fallback for third-party AV
  - [x] Parse definition date/version

- [x] Task 3: Implement Linux Check (AC: 2)
  - [x] ClamAV detection (clamd, freshclam)
  - [x] Sophos detection
  - [x] ESET detection

- [x] Task 4: Implement macOS Check (AC: 3)
  - [x] XProtect (built-in)
  - [x] Third-party AV path detection

- [x] Task 5: Add Tests (AC: All)
  - [x] 6 unit tests
  - [x] Serialization test
  - [x] Definition age test
  - [x] Live execution test

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- FR11: Vérification état antivirus
- 7-day definition currency requirement
- Framework mapping: NIS2, DORA

### AntivirusStatus Structure

```rust
AntivirusStatus {
    enabled: bool,
    av_name: String,
    real_time_protection: bool,
    definition_date: Option<DateTime<Utc>>,
    definition_version: Option<String>,
    definitions_current: bool,
    last_scan_date: Option<DateTime<Utc>>,
    service_running: bool,
    additional_products: Vec<String>,
    raw_output: String,
}
```

### Platform Commands

| Platform | Primary Command | Fallback |
|----------|----------------|----------|
| Windows | `Get-MpComputerStatus` | WMI AntiVirusProduct |
| Linux | `systemctl is-active clamav-daemon` | Sophos/ESET paths |
| macOS | XProtect (always on) | Path detection |

### Compliance Logic

```rust
passed = enabled
    && real_time_protection
    && definitions_current  // < 7 days old
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Created AntivirusCheck implementing Check trait
- Windows: PowerShell + WMI fallback
- Linux: ClamAV, Sophos, ESET detection
- macOS: XProtect + third-party detection
- 6 antivirus tests passing

### Completion Notes List

- AntivirusCheck with Check trait
- Windows Defender via Get-MpComputerStatus
- WMI SecurityCenter2 fallback
- Linux multi-AV detection
- macOS XProtect baseline
- 7-day definition currency check
- NIS2, DORA framework mapping
- Total: 59 tests in agent-scanner

### File List

**New Files Created:**
- sentinel-agent/crates/agent-scanner/src/checks/antivirus.rs

**Modified Files:**
- sentinel-agent/crates/agent-scanner/src/checks/mod.rs

### Change Log

- 2026-01-23: Created AntivirusCheck
- 2026-01-23: Implemented Windows/Linux/macOS detection
- 2026-01-23: Added 6 unit tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
