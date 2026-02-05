# agent-storage

Encrypted local storage for the Sentinel GRC Agent.

## Overview

This crate provides secure local data persistence:

- **SQLCipher encryption**: AES-256-CBC database encryption
- **Key management**: Platform-specific key protection
- **Repositories**: Type-safe data access patterns
- **Migrations**: Schema versioning and upgrades

## Security

### Key Management

Keys are protected using platform-specific mechanisms:

| Platform | Protection |
|----------|------------|
| Windows | DPAPI (Data Protection API) |
| Linux | File permissions (0600) + machine-id binding |
| macOS | File permissions (0600) + IOPlatformUUID binding |

Keys are zeroized from memory on drop.

### Database Encryption

All data is encrypted at rest using SQLCipher:

- AES-256-CBC encryption
- Key derived from protected key file
- Transparent encryption/decryption

## Repositories

| Repository | Data |
|------------|------|
| `CheckResultsRepository` | Compliance check results |
| `CheckRulesRepository` | Server-provided rules |
| `CredentialsRepository` | Authentication credentials |
| `ProofsRepository` | Compliance proofs |
| `AuditTrailRepository` | Local audit logs |
| `SyncQueueRepository` | Offline sync queue |

## Usage

```rust
use agent_storage::{Database, DatabaseConfig, KeyManager};

// Initialize key manager
let key_manager = KeyManager::new()?;

// Open encrypted database
let config = DatabaseConfig::default();
let db = Database::open(config, &key_manager)?;

// Use repositories
let repo = CheckResultsRepository::new(&db);
let results = repo.get_pending_sync().await?;
```

## Migrations

Schema migrations are versioned and applied automatically:

```rust
use agent_storage::migrations;

migrations::run_migrations(&mut conn)?;
let version = migrations::get_schema_version(&conn)?;
```
