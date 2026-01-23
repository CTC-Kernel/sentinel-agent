# Story 12.4: Trigger Remote Diagnostics

Status: done

## Story

As a **Support Engineer**,
I want **to trigger a diagnostic check on a remote agent**,
So that **I can collect comprehensive troubleshooting data**.

## Acceptance Criteria

1. **AC1** - System Information
   - OS version and type
   - Agent version
   - Uptime duration

2. **AC2** - Agent Health
   - Database status (size, integrity)
   - Last sync timestamp
   - Check execution status

3. **AC3** - Diagnostic Report
   - Comprehensive DiagnosticResult returned
   - All components aggregated
   - Uploadable to SaaS

## Tasks / Subtasks

- [x] Task 1: Implement SystemInfo (AC: 1)
  - [x] SystemInfo struct
  - [x] OS version detection
  - [x] Agent version
  - [x] Uptime calculation

- [x] Task 2: Implement AgentHealth (AC: 2)
  - [x] AgentHealth struct
  - [x] Database metrics
  - [x] Sync status
  - [x] Check engine status

- [x] Task 3: Implement DiagnosticService (AC: 3)
  - [x] DiagnosticService struct
  - [x] collect_diagnostics method
  - [x] DiagnosticResult aggregation

- [x] Task 4: Add Tests (AC: All)
  - [x] SystemInfo tests
  - [x] AgentHealth tests
  - [x] DiagnosticResult tests

## Dev Notes

### DiagnosticResult Structure

```rust
DiagnosticResult {
    collected_at: DateTime<Utc>,
    system_info: SystemInfo,
    agent_health: AgentHealth,
    connection_status: ConnectionStatus,
    recent_errors: Vec<ErrorEntry>,
    recent_logs: Vec<LogEntry>,
}
```

### SystemInfo Fields

```rust
SystemInfo {
    os_type: String,
    os_version: String,
    hostname: String,
    agent_version: String,
    uptime_seconds: u64,
    cpu_count: u32,
    memory_total_mb: u64,
}
```

### AgentHealth Fields

```rust
AgentHealth {
    database_size_bytes: u64,
    database_integrity_ok: bool,
    last_sync: Option<DateTime<Utc>>,
    last_check_run: Option<DateTime<Utc>>,
    pending_uploads: u32,
    enrolled: bool,
}
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- DiagnosticService collects all data
- SystemInfo with OS detection
- AgentHealth with database metrics
- Comprehensive DiagnosticResult

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/diagnostics.rs (shared)

**Modified Files:**
- sentinel-agent/crates/agent-sync/src/lib.rs

### Change Log

- 2026-01-23: Implemented as part of diagnostics.rs module

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** APPROVED WITH FIXES

### Review Findings (Fixed)

| Issue | Severity | Status |
|-------|----------|--------|
| DiagnosticResult missing recent_logs field | MEDIUM | ✅ Fixed |
| DiagnosticResult missing connection_status field | MEDIUM | ✅ Fixed |
| AgentHealth missing fields from story | MEDIUM | ✅ Fixed |

### Fixes Applied

1. **DiagnosticResult** - Added `connection_status: ConnectionStatus` and `recent_logs: Vec<LogEntry>`
2. **AgentHealth** - Added fields: `database_size_bytes`, `database_integrity_ok`, `last_sync`, `pending_uploads`, `enrolled`
3. **run_diagnostics()** - Now collects connection_status and recent_logs
4. **collect_agent_health()** - Populates all new fields from connection status
