# Story 4.3: Implement Heartbeat Mechanism with Metrics

Status: review

## Story

As an **administrator**,
I want **agents to send periodic heartbeats with health metrics**,
So that **I can monitor agent connectivity and health in real-time**.

## Acceptance Criteria

1. **AC1** - Periodic Heartbeats
   - Agent sends heartbeats at configurable interval (default: 60 seconds)
   - POST to `/v1/agents/{id}/heartbeat` endpoint
   - Uses mTLS via AuthenticatedClient

2. **AC2** - Health Metrics Payload
   - Includes: agent_version, os_info, cpu_usage, memory_usage
   - Includes: last_check_timestamp, compliance_score, pending_sync_count
   - Includes: status (online/offline)
   - Self-check result sent on first heartbeat only

3. **AC3** - Exponential Backoff Retry
   - Failed heartbeats retried with exponential backoff
   - Base: 1s, doubles each retry, max: 5 minutes
   - Uses MAX_SYNC_RETRIES (5) attempts

4. **AC4** - Offline Mode
   - 3 consecutive failures trigger offline mode
   - Success exits offline mode and resets counter
   - Offline status reflected in heartbeat payload

5. **AC5** - Command Processing
   - Process commands from heartbeat response
   - Handle ForceSync, RunChecks, Update, Diagnostics, Revoke
   - Track config_changed and rules_changed flags

## Tasks / Subtasks

- [x] Task 1: Add System Metrics Dependency (AC: 2)
  - [x] Add sysinfo crate to workspace
  - [x] Add sysinfo to agent-sync

- [x] Task 2: Create HeartbeatService (AC: 1)
  - [x] new() with AuthenticatedClient
  - [x] Configurable interval (set_interval, interval)
  - [x] run() async loop with shutdown signal

- [x] Task 3: Implement Metrics Collection (AC: 2)
  - [x] CPU usage via sysinfo
  - [x] Memory usage via sysinfo
  - [x] build_request() assembles payload
  - [x] Self-check result (sent once)

- [x] Task 4: Implement Retry Logic (AC: 3)
  - [x] send_heartbeat() with retries
  - [x] Exponential backoff timing
  - [x] is_retryable() error check

- [x] Task 5: Implement Offline Mode (AC: 4)
  - [x] consecutive_failures tracking
  - [x] OFFLINE_MODE_THRESHOLD = 3
  - [x] on_failure() increments and checks
  - [x] on_success() resets and exits offline
  - [x] reset_offline_mode() for manual recovery

- [x] Task 6: Implement Command Processing (AC: 5)
  - [x] process_commands() extracts commands
  - [x] Returns Vec<AgentCommand> for caller
  - [x] Logs config_changed, rules_changed

- [x] Task 7: Add Comprehensive Tests (AC: All)
  - [x] test_heartbeat_service_creation
  - [x] test_set_interval
  - [x] test_offline_mode_tracking
  - [x] test_success_resets_failures
  - [x] test_success_exits_offline_mode
  - [x] test_last_check_at
  - [x] test_compliance_score
  - [x] test_pending_sync_count
  - [x] test_self_check_result_sent_once
  - [x] test_build_request_metrics
  - [x] test_process_commands

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- FR6: Heartbeat périodique avec métriques
- NFR-P8: Heartbeat latency < 1s at p95
- DEFAULT_HEARTBEAT_INTERVAL_SECS = 60

### HeartbeatService Architecture

```rust
HeartbeatService
├── client: Arc<AuthenticatedClient>
├── interval_secs: RwLock<u64>
├── consecutive_failures: AtomicU32
├── offline_mode: AtomicBool
├── last_success: RwLock<Option<DateTime>>
├── last_check_at: RwLock<Option<DateTime>>
├── compliance_score: RwLock<Option<f32>>
├── pending_sync_count: AtomicU32
├── self_check_result: RwLock<Option<SelfCheckResult>>
└── sys: RwLock<System>  // sysinfo for metrics

Methods:
- send_heartbeat() -> SyncResult<HeartbeatResponse>
- build_request() -> HeartbeatRequest
- process_commands(&response) -> Vec<AgentCommand>
- run(shutdown) -> runs forever
```

### Key Design Decisions

- **Atomic Counters**: Use AtomicU32/AtomicBool for lock-free failure tracking
- **RwLock for State**: Concurrent reads, exclusive writes for mutable state
- **Self-Check Once**: self_check_result.take() ensures sent only once
- **Graceful Shutdown**: run() accepts watch::Receiver for clean termination
- **sysinfo Crate**: Cross-platform CPU/memory metrics

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Added sysinfo v0.35 for system metrics
- Created HeartbeatService with full feature set
- 11 heartbeat tests passing

### Completion Notes List

- sysinfo v0.35 added for CPU/memory metrics
- HeartbeatService with configurable interval
- send_heartbeat() with exponential backoff retry
- Offline mode after 3 consecutive failures
- build_request() collects all metrics
- Self-check result sent on first heartbeat only
- process_commands() returns commands for caller
- run() with shutdown signal support
- 11 comprehensive tests
- Total: 54 tests in agent-sync

### File List

**New Files Created:**
- sentinel-agent/crates/agent-sync/src/heartbeat.rs

**Modified Files:**
- sentinel-agent/Cargo.toml (sysinfo dependency)
- sentinel-agent/crates/agent-sync/Cargo.toml (sysinfo)
- sentinel-agent/crates/agent-sync/src/lib.rs (export heartbeat)

### Change Log

- 2026-01-23: Added sysinfo crate for system metrics
- 2026-01-23: Created HeartbeatService with periodic sending
- 2026-01-23: Implemented exponential backoff retry
- 2026-01-23: Implemented offline mode tracking
- 2026-01-23: Added command processing
- 2026-01-23: All 54 tests passing

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
