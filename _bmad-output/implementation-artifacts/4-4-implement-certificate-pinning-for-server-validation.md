# Story 4.4: Implement Certificate Pinning for Server Validation

Status: review

## Story

As a **security officer**,
I want **the agent to validate the server certificate against a pinned fingerprint**,
So that **MITM attacks are prevented even with compromised CAs**.

## Acceptance Criteria

1. **AC1** - Fingerprint Validation
   - Server certificate SHA-256 fingerprint validated against pinned values
   - Fingerprint format: `sha256:<hex-encoded-hash>`
   - Case-insensitive comparison with separator normalization

2. **AC2** - Pin Storage
   - Pinned fingerprints stored in agent configuration (credentials.server_fingerprints)
   - Updatable via SaaS (from enrollment response and heartbeat)
   - Loadable from credentials repository

3. **AC3** - Connection Rejection
   - Connection rejected if fingerprint doesn't match any pin
   - Returns SyncError::CertificateValidation with details
   - Gracefully disabled if no pins configured

4. **AC4** - Backup Pins
   - Multiple pins supported for certificate rotation
   - add_backup_pin() for temporary dual-validity
   - remove_pin() after rotation completes

5. **AC5** - Failure Logging
   - Pin validation failures logged with details
   - Received fingerprint logged (partial, for security)
   - Expected pin count logged

## Tasks / Subtasks

- [x] Task 1: Add Dependencies (AC: 1)
  - [x] Add sha2 and hex to agent-sync

- [x] Task 2: Create CertificatePinning Module (AC: 1, 3)
  - [x] new() with initial pins
  - [x] verify() fingerprint validation
  - [x] verify_certificate() from DER bytes
  - [x] compute_fingerprint() static method

- [x] Task 3: Implement Pin Management (AC: 2, 4)
  - [x] from_credentials() loader
  - [x] update_pins() from SaaS
  - [x] add_backup_pin() for rotation
  - [x] remove_pin() after rotation
  - [x] save_to_credentials() persistence

- [x] Task 4: Implement Normalization (AC: 1)
  - [x] normalize_fingerprint() case/separator handling
  - [x] Strip sha256: prefix
  - [x] Remove colons, spaces, dashes

- [x] Task 5: Implement Failure Logging (AC: 5)
  - [x] Error logs with fingerprint preview
  - [x] Pin count in error messages
  - [x] PinningResult struct for detailed results

- [x] Task 6: Add Comprehensive Tests (AC: All)
  - [x] 18 unit tests covering all features
  - [x] Verification success/failure
  - [x] Backup pins
  - [x] Pin management
  - [x] Normalization
  - [x] Case insensitivity

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- NFR-S3: Certificate pinning for MITM prevention
- Server fingerprints stored in encrypted SQLCipher database
- Updatable via enrollment response and heartbeat

### CertificatePinning Structure

```rust
CertificatePinning
├── pins: RwLock<Vec<String>>    # Pinned fingerprints
└── enabled: RwLock<bool>        # Auto-disabled if no pins

Methods:
- verify(fingerprint) -> SyncResult<()>
- verify_certificate(cert_der) -> SyncResult<()>
- compute_fingerprint(cert_der) -> String
- update_pins(new_pins)
- add_backup_pin(fingerprint)
- remove_pin(fingerprint) -> bool
- save_to_credentials(db) -> SyncResult<()>
```

### Fingerprint Format

```
sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
       └─────────────────────────────────────────────────────────────────────┘
       64 hex characters (32 bytes SHA-256)
```

### Key Design Decisions

- **RwLock for Pins**: Concurrent reads, exclusive writes for updates
- **Disabled by Default**: No pins = pinning disabled (warns in logs)
- **Partial Logging**: Only first 24 chars of fingerprint logged for security
- **Normalization**: Case-insensitive, strips prefixes and separators
- **Empty Update Ignored**: Prevents accidental pin removal

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Added sha2 and hex dependencies to agent-sync
- Created CertificatePinning module with full feature set
- 18 pinning tests passing

### Completion Notes List

- sha2 and hex added to agent-sync
- CertificatePinning with async verify methods
- SHA256_PREFIX = "sha256:" constant
- normalize_fingerprint() handles various formats
- compute_fingerprint() for raw certificate bytes
- update_pins(), add_backup_pin(), remove_pin()
- from_credentials() and save_to_credentials()
- PinningResult struct for detailed results
- 18 comprehensive tests
- Total: 73 tests in agent-sync

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/pinning.rs

**Modified Files:**
- sentinel-agent/crates/agent-sync/Cargo.toml (sha2, hex)
- sentinel-agent/crates/agent-sync/src/lib.rs (export pinning)

### Change Log

- 2026-01-23: Added sha2 and hex dependencies
- 2026-01-23: Created CertificatePinning module
- 2026-01-23: Implemented fingerprint validation
- 2026-01-23: Implemented pin management
- 2026-01-23: Added 18 comprehensive tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
