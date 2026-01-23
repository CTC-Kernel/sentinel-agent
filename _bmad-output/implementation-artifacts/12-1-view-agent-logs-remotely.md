# Story 12.1: View Agent Logs Remotely

Status: done

## Story

As a **Support Engineer**,
I want **to view logs from a specific agent**,
So that **I can diagnose issues without accessing the endpoint**.

## Acceptance Criteria

1. **AC1** - Log Storage
   - Last 1000 log entries stored in memory
   - Logs include: timestamp, level, component, message

2. **AC2** - Log Filtering
   - Filter by log level (DEBUG, INFO, WARN, ERROR)
   - Search logs by keyword

3. **AC3** - Log Format
   - Logs in JSON structured format (NFR-M6, NFR-I7)
   - Log integrity signatures verified on display

4. **AC4** - Remote Access
   - Logs uploadable to SaaS on request
   - Context fields for additional data

## Tasks / Subtasks

- [x] Task 1: Implement LogBuffer (AC: 1, 2)
  - [x] LogBuffer struct with capacity limit
  - [x] add method with auto-trimming
  - [x] get_recent method
  - [x] get_by_level filter
  - [x] search method

- [x] Task 2: Implement LogEntry (AC: 3)
  - [x] LogEntry struct with context
  - [x] JSON serialization

- [x] Task 3: Add Tests (AC: All)
  - [x] Buffer capacity tests
  - [x] Filtering tests
  - [x] Search tests

## Dev Notes

### LogEntry Structure

```rust
LogEntry {
    id: u64,
    timestamp: DateTime<Utc>,
    level: String,
    component: String,
    message: String,
    context: HashMap<String, String>,
}
```

### LogBuffer Features

- Configurable max entries (default 1000)
- Auto-trimming when over capacity
- Level filtering (case-insensitive)
- Keyword search in message and component

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- LogBuffer with configurable capacity
- LogEntry with JSON serialization
- Level and keyword filtering
- Context support for additional data

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/diagnostics.rs

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs

### Change Log

- 2026-01-23: Implemented LogBuffer and LogEntry

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** APPROVED WITH FIXES

### Review Findings (Fixed)

| Issue | Severity | Status |
|-------|----------|--------|
| AC3 Log Integrity Signatures not implemented | HIGH | ✅ Fixed |
| AC4 No upload method for logs | HIGH | ✅ Fixed |
| Missing is_empty() method | LOW | ✅ Fixed |

### Fixes Applied

1. **LogEntry** - Added `signature` and `previous_hash` fields for integrity chain
2. **LogBuffer** - Added `with_signer()` constructor for signed logs, `verify_chain()` method
3. **upload_logs()** - New function to upload logs to SaaS (AC4)
4. **LogUploadRequest/Response** - New types for log upload API
5. **is_empty()** - Added to LogBuffer
