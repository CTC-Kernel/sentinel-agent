# Story 3.5: Implement Data Retention Policy

Status: review

## Story

As a **compliance administrator**,
I want **proof and result data older than 12 months to be automatically purged**,
So that **the local database doesn't grow indefinitely and complies with NFR-C2**.

## Acceptance Criteria

1. **AC1** - Retention Configuration
   - Configurable retention period (default 365 days per NFR-C2)
   - Option to keep or delete orphaned check results
   - Dry-run mode to preview deletions without executing

2. **AC2** - Retention Execution
   - Delete proofs older than retention period
   - Delete orphaned check results (results with no remaining proofs)
   - Delete sync queue entries for deleted entities
   - Transactional (atomic) cleanup operation

3. **AC3** - Retention Statistics
   - Report number of proofs/results/sync entries deleted
   - Report cutoff date used for deletion
   - Report oldest/newest remaining proof dates
   - Report remaining counts and execution duration

4. **AC4** - Storage Statistics
   - Get storage stats without executing retention
   - Report proof count, data size, result count, sync queue count
   - Human-readable size formatting (B, KB, MB, GB)
   - Calculate data span in days

## Tasks / Subtasks

- [x] Task 1: Implement RetentionConfig (AC: 1)
  - [x] Configurable retention_days (default 365)
  - [x] delete_orphaned_results option
  - [x] dry_run mode
  - [x] Builder pattern methods

- [x] Task 2: Implement RetentionPolicy (AC: 2, 3)
  - [x] execute() with transactional cleanup
  - [x] Step 1: Identify proofs to delete
  - [x] Step 2: Identify orphaned check results
  - [x] Step 3-4: Delete sync queue entries
  - [x] Step 5-6: Delete proofs and results
  - [x] Step 7: Collect statistics

- [x] Task 3: Implement Dry-Run Mode (AC: 1, 3)
  - [x] execute_dry_run() counts without deleting
  - [x] Same reporting as real execution

- [x] Task 4: Implement Storage Statistics (AC: 4)
  - [x] StorageStats struct
  - [x] get_storage_stats() method
  - [x] proof_data_human() formatting
  - [x] data_span_days() calculation

- [x] Task 5: Add Comprehensive Tests (AC: 1, 2, 3, 4)
  - [x] test_retention_deletes_old_data
  - [x] test_retention_dry_run
  - [x] test_retention_keeps_recent_data
  - [x] test_retention_result_methods
  - [x] test_storage_stats
  - [x] test_storage_stats_human_readable
  - [x] test_data_span_days
  - [x] test_keep_orphaned_results
  - [x] test_default_retention_period
  - [x] test_retention_config_builder

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- NFR-C2: Rétention données 12 mois local (365 days)
- Uses PROOF_RETENTION_DAYS constant from agent-common

### Retention Process Flow

```rust
// 1. Calculate cutoff date
let cutoff = Utc::now() - Duration::days(retention_days);

// 2. In transaction:
//    - Identify and collect IDs to delete
//    - Delete sync_queue entries for proofs
//    - Delete sync_queue entries for results
//    - Delete proofs older than cutoff
//    - Delete orphaned check results
//    - Collect remaining statistics

// 3. Commit transaction (atomic)
```

### Key Design Decisions

- **Transactional**: All deletions in single transaction for atomicity
- **ID Collection First**: Collect IDs before deleting to clean sync_queue
- **Orphan Detection**: Results are orphaned if ALL their proofs are deleted
- **Mutable Connection**: Uses `with_connection_mut` for transaction support

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed `with_connection` to `with_connection_mut` for transaction support
- Removed unused debug/warn imports from tracing
- All 13 retention tests passing

### Completion Notes List

- RetentionConfig with builder pattern (dry_run, keep_orphaned_results)
- DEFAULT_RETENTION_DAYS = 365 (from PROOF_RETENTION_DAYS)
- RetentionPolicy with execute() and execute_dry_run()
- Transactional cleanup using rusqlite Transaction
- StorageStats with human-readable formatting
- data_span_days() calculates span between oldest/newest
- 13 comprehensive tests covering all acceptance criteria
- Exports: RetentionPolicy, RetentionConfig, RetentionResult, StorageStats

### File List

**New Files Created:**
- sentinel-agent/crates/agent-storage/src/retention.rs

**Modified Files:**
- sentinel-agent/crates/agent-storage/src/lib.rs (export retention module)

### Change Log

- 2026-01-23: Created retention.rs with RetentionPolicy
- 2026-01-23: Implemented transactional cleanup with atomicity
- 2026-01-23: Added dry-run mode and storage statistics
- 2026-01-23: Fixed with_connection_mut for transaction support
- 2026-01-23: Added 13 comprehensive tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
