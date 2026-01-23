# Story 3.1: Initialize SQLite Database with SQLCipher Encryption

Status: in-progress

## Story

As a **security officer**,
I want **all local data stored in an encrypted SQLite database**,
So that **confidential compliance data is protected at rest**.

## Acceptance Criteria

1. **AC1** - Database Initialization
   - SQLite database created at designated location
   - Database path configurable via configuration
   - Automatic creation on first run

2. **AC2** - SQLCipher Encryption
   - SQLCipher encryption enabled with AES-256-CBC
   - Database cannot be read without correct key
   - Encryption verified via tests

3. **AC3** - Key Management
   - Encryption key derived from machine-specific data
   - DPAPI on Windows for key protection
   - Keyring/secure storage on Linux
   - Key never stored in plaintext

4. **AC4** - Database Location
   - Windows: `C:\ProgramData\Sentinel\data\agent.db`
   - Linux: `/var/lib/sentinel-grc/agent.db`
   - Directory created if not exists

## Tasks / Subtasks

- [ ] Task 1: Add SQLite/SQLCipher Dependencies (AC: 2)
  - [ ] Add rusqlite with bundled-sqlcipher feature
  - [ ] Verify encryption capabilities

- [ ] Task 2: Implement Database Manager (AC: 1, 4)
  - [ ] Create database module in agent-storage
  - [ ] Platform-specific database paths
  - [ ] Connection pool management

- [ ] Task 3: Implement Key Derivation (AC: 3)
  - [ ] Machine-specific key derivation
  - [ ] DPAPI integration (Windows)
  - [ ] Secure key storage (Linux)

- [ ] Task 4: Add Encryption Tests (AC: 2)
  - [ ] Test database creation with encryption
  - [ ] Test data cannot be read without key
  - [ ] Test key rotation (future)

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- FR58: L'agent peut chiffrer les données stockées localement
- NFR-S2: Chiffrement stockage local SQLite avec SQLCipher (AES-256)

### rusqlite Configuration

```toml
[dependencies]
rusqlite = { version = "0.32", features = ["bundled-sqlcipher"] }
```

### Key Derivation

Use machine-specific data combined with a salt:
- Windows: Machine GUID + DPAPI
- Linux: Machine ID + user keyring or file-based key

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Change Log
