# Story 6.1: Download and Cache Check Rules from SaaS

Status: review

## Story

As an **agent**,
I want **to download check rules from the SaaS and cache them locally**,
So that **I can execute compliance checks even when offline**.

## Acceptance Criteria

1. **AC1** - Rule Download
   - Download rules from `/v1/agents/{id}/rules` endpoint
   - Parse and validate rule format
   - Store rules in `check_rules` table

2. **AC2** - Delta Sync
   - Use ETag header for conditional requests
   - Only download changed rules (304 Not Modified handling)
   - Store version hash for change detection

3. **AC3** - Cache Validity
   - Cached rules valid for 7 days minimum
   - Track last sync timestamp
   - Fallback to cached rules on download failure

4. **AC4** - Error Handling
   - Network failures don't prevent using cached rules
   - Log sync errors without crashing
   - Queue retry on transient failures

## Tasks / Subtasks

- [x] Task 1: Implement CheckRulesRepository (AC: 1, 3)
  - [x] CheckRule struct with all fields
  - [x] upsert method for storing rules
  - [x] get_all method
  - [x] get_by_id method
  - [x] get_enabled_rules method
  - [x] get_cache_metadata method

- [x] Task 2: Implement RuleSyncService (AC: 1, 2)
  - [x] API types for rule download
  - [x] sync_rules method
  - [x] ETag handling
  - [x] Delta sync logic

- [x] Task 3: Implement Cache Validation (AC: 3)
  - [x] is_cache_valid method (7-day threshold)
  - [x] get_last_sync_time method
  - [x] update_sync_metadata method

- [x] Task 4: Add Error Handling (AC: 4)
  - [x] Graceful fallback to cache
  - [x] Retry queue integration
  - [x] Error logging

- [x] Task 5: Add Tests (AC: All)
  - [x] Repository unit tests (17 tests)
  - [x] Sync service tests (7 tests)
  - [x] Cache validity tests
  - [x] Fallback tests

## Dev Notes

### CheckRule Structure

```rust
CheckRule {
    id: String,
    name: String,
    description: Option<String>,
    category: String,
    severity: Severity,
    enabled: bool,
    check_type: String,
    parameters: Option<serde_json::Value>,
    frameworks: Vec<String>,
    version: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

### API Response Format

```json
{
  "rules": [...],
  "etag": "hash-value",
  "total_count": 12
}
```

### Severity Enum

```rust
Severity {
    Critical, // weight: 4.0
    High,     // weight: 3.0
    Medium,   // weight: 2.0
    Low,      // weight: 1.0
    Info,     // weight: 0.5
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- CheckRulesRepository with full CRUD operations
- RuleSyncService with ETag-based delta sync
- 7-day cache validity threshold
- Graceful fallback to cached rules on failure
- Batch upsert with transaction support
- Framework and category filtering
- Cache metadata stored in agent_config table
- 24 new tests added (17 in check_rules, 7 in rules)
- Total: 345 tests passing across all crates

### File List

**New Files Created:**
- sentinel-agent/crates/agent-storage/src/repositories/check_rules.rs
- sentinel-agent/crates/agent-sync/src/rules.rs

**Modified Files:**
- sentinel-agent/crates/agent-storage/src/repositories/mod.rs
- sentinel-agent/crates/agent-storage/src/lib.rs
- sentinel-agent/crates/agent-sync/src/lib.rs

### Change Log

- 2026-01-23: Implemented CheckRulesRepository
- 2026-01-23: Implemented RuleSyncService
- 2026-01-23: Added 24 unit tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
