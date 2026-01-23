# Story 6.2: Download Agent Configuration from SaaS

Status: review

## Story

As an **administrator**,
I want **agent configuration to sync from the SaaS console**,
So that **I can manage agent settings centrally**.

## Acceptance Criteria

1. **AC1** - Config Download
   - Download config from `/v1/agents/{id}/config` endpoint
   - Parse and validate configuration format
   - Store in `agent_config` table

2. **AC2** - Hot Reload
   - Configuration changes take effect without agent restart
   - Config sync occurs on heartbeat response signal
   - Observable config changes emit events

3. **AC3** - Merge Strategy
   - Local config file overrides are preserved
   - Remote config merged with local
   - Conflict resolution: local wins for explicit overrides

4. **AC4** - Error Handling
   - Config download failure uses cached config
   - Invalid config rejected with logging
   - Default values for missing keys

## Tasks / Subtasks

- [x] Task 1: Implement ConfigRepository (AC: 1, 3)
  - [x] ConfigEntry struct
  - [x] get/set methods
  - [x] get_all method
  - [x] merge_remote_config method

- [x] Task 2: Implement ConfigSyncService (AC: 1, 2)
  - [x] API types for config download
  - [x] sync_config method
  - [x] notify_config_changed method

- [x] Task 3: Implement Merge Strategy (AC: 3)
  - [x] Local override tracking
  - [x] Merge algorithm
  - [x] Conflict logging

- [x] Task 4: Add Tests (AC: All)
  - [x] Repository unit tests (16 tests)
  - [x] Sync service tests (6 tests)
  - [x] Merge strategy tests

## Dev Notes

### ConfigEntry Structure

```rust
ConfigEntry {
    key: String,
    value: String,
    updated_at: DateTime<Utc>,
    synced_at: Option<DateTime<Utc>>,
    source: ConfigSource, // Local, Remote
}
```

### API Response Format

```json
{
  "config": {
    "check_interval_secs": 3600,
    "heartbeat_interval_secs": 300,
    "enabled_checks": ["disk_encryption", "antivirus"],
    "log_level": "info"
  },
  "version": "1.0.0"
}
```

### Standard Config Keys

| Key | Description |
|-----|-------------|
| check_interval_secs | Check execution interval |
| heartbeat_interval_secs | Heartbeat interval |
| enabled_checks | List of enabled check IDs |
| log_level | Log level (debug/info/warn/error) |
| max_cpu_percent | CPU throttle limit |
| max_memory_bytes | Memory limit |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- ConfigRepository with full CRUD operations
- ConfigSyncService with hot reload notifications
- Merge strategy preserving local overrides
- Change detection via watch channel
- Standard config keys module
- 22 new tests added (16 in config, 6 in config_sync)
- Total: 367 tests passing across all crates

### File List

**New Files Created:**
- sentinel-agent/crates/agent-storage/src/repositories/config.rs
- sentinel-agent/crates/agent-sync/src/config_sync.rs

**Modified Files:**
- sentinel-agent/crates/agent-storage/src/repositories/mod.rs
- sentinel-agent/crates/agent-storage/src/lib.rs
- sentinel-agent/crates/agent-sync/src/lib.rs

### Change Log

- 2026-01-23: Implemented ConfigRepository
- 2026-01-23: Implemented ConfigSyncService
- 2026-01-23: Added 22 unit tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
