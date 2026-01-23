# Story 3.2: Implement Database Schema with Migrations

Status: review

## Story

As a **developer**,
I want **a versioned database schema with migration support**,
So that **database updates can be applied safely across agent versions**.

## Acceptance Criteria

1. **AC1** - Schema Tables
   - 5 tables created: `agent_config`, `check_rules`, `check_results`, `proofs`, `sync_queue`
   - All tables have appropriate columns and constraints
   - Foreign key constraints enforced

2. **AC2** - Migration Tracking
   - A `schema_version` table tracks applied migrations
   - Version number and name recorded with timestamp

3. **AC3** - Migration Execution
   - Migrations run in order and are idempotent
   - Failed migrations trigger rollback and error logging
   - Migrations run within transactions

4. **AC4** - Data Integrity
   - CHECK constraints on status and severity fields
   - Foreign key cascades on delete
   - Proper indexes for query performance

## Tasks / Subtasks

- [x] Task 1: Create Migration System (AC: 2, 3)
  - [x] Create migrations module with schema versioning
  - [x] Implement run_migrations() with transaction support
  - [x] Implement rollback_migration() for recovery
  - [x] Add idempotency checks

- [x] Task 2: Define Initial Schema (AC: 1, 4)
  - [x] agent_config table (key-value store)
  - [x] check_rules table (compliance check definitions)
  - [x] check_results table (execution results)
  - [x] proofs table (tamper-evident evidence)
  - [x] sync_queue table (offline sync queue)

- [x] Task 3: Add Constraints and Indexes (AC: 4)
  - [x] CHECK constraints for status, severity, entity_type
  - [x] Foreign key constraints with CASCADE DELETE
  - [x] Indexes for common queries (rule_id, executed_at, synced)

- [x] Task 4: Integrate with Database Module (AC: 3)
  - [x] Run migrations automatically on database open
  - [x] Add tests for schema validation

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- 5 normalized tables: agent_config, check_rules, check_results, proofs, sync_queue
- SQLite schema with proper foreign keys and indexes
- ISO 8601 UTC timestamps for all date fields

### Schema Design

```sql
-- agent_config: Key-value configuration storage
-- check_rules: Compliance check definitions from SaaS
-- check_results: Execution results with status/score
-- proofs: SHA-256 hashed evidence linked to results
-- sync_queue: FIFO queue for offline sync with retry
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Created comprehensive migration system with versioning
- All 8 migration tests passing
- Foreign key constraints working correctly

### Completion Notes List

- ✅ migrations.rs with CURRENT_SCHEMA_VERSION tracking
- ✅ Migration struct with version, name, up SQL, down SQL
- ✅ run_migrations() executes pending migrations in transactions
- ✅ rollback_migration() for disaster recovery
- ✅ is_schema_current() and get_applied_migrations() utilities
- ✅ agent_config table with key/value/source tracking
- ✅ check_rules table with severity CHECK constraint
- ✅ check_results table with status CHECK constraint
- ✅ proofs table with foreign key to check_results
- ✅ sync_queue table with entity_type CHECK constraint
- ✅ Indexes on frequently queried columns
- ✅ CASCADE DELETE for referential integrity
- ✅ Database::open() runs migrations automatically

### File List

**New Files Created:**
- sentinel-agent/crates/agent-storage/src/migrations.rs

**Modified Files:**
- sentinel-agent/crates/agent-storage/src/lib.rs (added migrations module export)
- sentinel-agent/crates/agent-storage/src/database.rs (runs migrations on open)

### Change Log

- 2026-01-23: Created migrations module with schema versioning
- 2026-01-23: Defined initial schema with 5 tables + schema_version
- 2026-01-23: Added comprehensive tests (8 migration tests)
- 2026-01-23: Integrated automatic migration on database open

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
