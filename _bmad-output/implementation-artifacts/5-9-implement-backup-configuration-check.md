# Story 5.9: Implement Backup Configuration Check

Status: review

## Story

As a **CISO**,
I want **the agent to verify backup is configured and recent**,
So that **I know data recovery is possible**.

## Acceptance Criteria

1. **AC1** - Windows Check
   - Windows Backup / File History status retrieved
   - Result includes: backup_enabled, last_backup_date, backup_destination, backup_size

2. **AC2** - Linux Check
   - Common backup tools detected (rsync cron, timeshift, restic, borg)
   - Result includes: backup_configured, last_backup_date, backup_location

3. **AC3** - macOS Check
   - Time Machine status checked
   - Result includes: backup_enabled, last_backup_date, backup_destination

4. **AC4** - Compliance Logic
   - Non-compliance if last backup > 30 days
   - Non-compliance if backup not configured

5. **AC5** - Framework Mapping
   - Check mapped to NIS2, DORA
   - Medium severity (Backup category)

## Tasks / Subtasks

- [x] Task 1: Implement BackupStatus Types (AC: All)
  - [x] BackupStatus struct
  - [x] Serialization support
  - [x] Compliance validation method

- [x] Task 2: Implement Windows Check (AC: 1)
  - [x] Windows Backup (wbadmin)
  - [x] File History
  - [x] System Restore
  - [x] VSS
  - [x] Third-party detection

- [x] Task 3: Implement Linux Check (AC: 2)
  - [x] Timeshift detection
  - [x] restic detection
  - [x] BorgBackup detection
  - [x] rsync cron detection
  - [x] Backup cron jobs

- [x] Task 4: Implement macOS Check (AC: 3)
  - [x] tmutil status
  - [x] tmutil destinationinfo
  - [x] tmutil latestbackup
  - [x] Auto-backup setting

- [x] Task 5: Add Tests (AC: All)
  - [x] 8 unit tests
  - [x] Compliance logic tests
  - [x] Live execution test

## Dev Notes

### BackupStatus Structure

```rust
BackupStatus {
    backup_configured: bool,
    backup_enabled: bool,
    last_backup_date: Option<DateTime<Utc>>,
    days_since_backup: Option<i64>,
    backup_destination: Option<String>,
    backup_size_bytes: Option<u64>,
    backup_type: Option<String>,
    backup_schedule: Option<String>,
    includes_system: Option<bool>,
    compliant: bool,
    issues: Vec<String>,
    raw_output: String,
}
```

### Compliance Rules

| Rule | Threshold | Action |
|------|-----------|--------|
| backup_configured | true | FAIL if not configured |
| backup_enabled | true | FAIL if not enabled |
| days_since_backup | <= 30 | FAIL if > 30 days |

### Platform Detection

| Platform | Backup Solution | Detection |
|----------|----------------|-----------|
| Windows | Windows Backup | wbadmin |
| Windows | File History | Registry |
| Windows | System Restore | PowerShell |
| Linux | Timeshift | timeshift --list |
| Linux | restic | ~/.cache/restic |
| Linux | BorgBackup | borg command |
| macOS | Time Machine | tmutil |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- BackupCheck implementing Check trait
- Windows: wbadmin + File History + System Restore + VSS
- Linux: Timeshift/restic/Borg/rsync detection
- macOS: Time Machine via tmutil
- Compliance: backup configured, enabled, < 30 days
- NIS2, DORA framework mapping
- Total: 108 tests in agent-scanner

### File List

**New Files Created:**
- sentinel-agent/crates/agent-scanner/src/checks/backup.rs

**Modified Files:**
- sentinel-agent/crates/agent-scanner/src/checks/mod.rs

### Change Log

- 2026-01-23: Created BackupCheck
- 2026-01-23: Implemented Windows/Linux/macOS detection
- 2026-01-23: Added 8 unit tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
