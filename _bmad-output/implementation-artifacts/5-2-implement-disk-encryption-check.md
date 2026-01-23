# Story 5.2: Implement Disk Encryption Check (BitLocker/LUKS)

Status: review

## Story

As a **CISO**,
I want **the agent to verify disk encryption status**,
So that **I know endpoints have data-at-rest protection**.

## Acceptance Criteria

1. **AC1** - Windows BitLocker Check
   - BitLocker status retrieved via PowerShell
   - Result includes: enabled, encryption_percentage, protection_status, key_protectors
   - Handles Windows Home edition (BitLocker not available)

2. **AC2** - Linux LUKS Check
   - LUKS status retrieved via lsblk/cryptsetup
   - Result includes: encrypted_partitions[], encryption_type, algorithm
   - Detects dm-crypt volumes

3. **AC3** - macOS FileVault Check
   - FileVault status retrieved via fdesetup
   - Result includes: enabled, encryption progress if encrypting
   - Handles permission requirements

4. **AC4** - Proof Data
   - Proof contains raw command output with timestamp
   - EncryptionStatus struct captures all details
   - VolumeEncryptionInfo for per-volume details

5. **AC5** - Framework Mapping
   - Check mapped to NIS2, DORA, RGPD
   - High severity (CheckSeverity::High)
   - Encryption category

## Tasks / Subtasks

- [x] Task 1: Create Checks Module Structure (AC: All)
  - [x] checks/mod.rs module
  - [x] Export DiskEncryptionCheck

- [x] Task 2: Implement EncryptionStatus Types (AC: 4)
  - [x] EncryptionStatus struct
  - [x] VolumeEncryptionInfo struct
  - [x] Serialization support

- [x] Task 3: Implement Windows BitLocker Check (AC: 1)
  - [x] PowerShell Get-BitLockerVolume command
  - [x] JSON parsing of results
  - [x] Handle missing BitLocker

- [x] Task 4: Implement Linux LUKS Check (AC: 2)
  - [x] lsblk --json command
  - [x] Parse crypto_LUKS and crypt devices
  - [x] Recursive child device checking

- [x] Task 5: Implement macOS FileVault Check (AC: 3)
  - [x] fdesetup status command
  - [x] Parse encryption status
  - [x] Handle progress detection

- [x] Task 6: Add Tests (AC: All)
  - [x] 7 unit tests
  - [x] Serialization tests
  - [x] Platform support test
  - [x] Live execution test

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- FR10: Vérification chiffrement disque
- Check generates proof with raw command output
- Mapped to NIS2, DORA, RGPD frameworks

### EncryptionStatus Structure

```rust
EncryptionStatus {
    enabled: bool,
    encryption_type: String,      // BitLocker, LUKS, FileVault
    encrypted_volumes: Vec<VolumeEncryptionInfo>,
    protection_status: String,
    raw_output: String,
}

VolumeEncryptionInfo {
    volume: String,               // C: or /dev/sda1
    encrypted: bool,
    encryption_percentage: Option<u8>,
    protection_status: Option<String>,
    key_protectors: Vec<String>,  // TPM, Recovery Key
    algorithm: Option<String>,    // AES-256, AES-XTS
}
```

### Platform Commands

| Platform | Command | Output |
|----------|---------|--------|
| Windows | `Get-BitLockerVolume \| ConvertTo-Json` | JSON with volume status |
| Linux | `lsblk --json -o NAME,TYPE,FSTYPE,MOUNTPOINT` | JSON with device tree |
| macOS | `fdesetup status` | Text status line |

### Key Design Decisions

- **Conditional compilation**: `#[cfg(target_os = "...")]` for platform code
- **PowerShell JSON**: Easier parsing than text output
- **lsblk recursive**: Check nested dm-crypt volumes
- **fdesetup fallback**: Handle permission errors gracefully

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Created checks module structure
- Implemented DiskEncryptionCheck with platform support
- Windows: PowerShell Get-BitLockerVolume
- Linux: lsblk with JSON and crypto_LUKS detection
- macOS: fdesetup status parsing
- 7 disk encryption tests passing

### Completion Notes List

- DiskEncryptionCheck implementing Check trait
- EncryptionStatus with full details
- VolumeEncryptionInfo per-volume
- Windows BitLocker via PowerShell
- Linux LUKS via lsblk
- macOS FileVault via fdesetup
- NIS2, DORA, RGPD framework mapping
- Total: 53 tests in agent-scanner

### File List

**New Files Created:**
- sentinel-agent/crates/agent-scanner/src/checks/mod.rs
- sentinel-agent/crates/agent-scanner/src/checks/disk_encryption.rs

**Modified Files:**
- sentinel-agent/crates/agent-scanner/src/lib.rs (export checks)

### Change Log

- 2026-01-23: Created checks module structure
- 2026-01-23: Implemented DiskEncryptionCheck
- 2026-01-23: Added platform-specific implementations
- 2026-01-23: Added 7 unit tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
