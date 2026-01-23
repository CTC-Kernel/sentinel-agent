# Story 5.1: Implement Check Runner Framework and Scheduler

Status: review

## Story

As a **developer**,
I want **a pluggable check runner with configurable scheduling**,
So that **compliance checks execute reliably at defined intervals**.

## Acceptance Criteria

1. **AC1** - Check Trait
   - Pluggable Check trait for compliance checks
   - async execute() method returning CheckOutput
   - Platform support detection
   - CheckRegistry for managing checks

2. **AC2** - Check Runner
   - Parallel execution with configurable concurrency
   - Timeout per check (default 30s)
   - Check execution time < 2s per check (NFR-P6)
   - Full scan of 20 checks < 30s (NFR-P7)

3. **AC3** - Scheduler
   - Configurable interval (15 min to 24 hours)
   - Run on start option
   - Event emission for scan start/complete
   - Trigger immediate scan capability

4. **AC4** - Proof Generation
   - SHA-256 hash for integrity
   - HMAC-SHA256 signature support
   - 12-month retention expiration
   - Proof data includes full context

5. **AC5** - Score Calculator
   - Weighted scoring by severity
   - Category breakdown
   - Framework-specific scores
   - Trend calculation with delta

## Tasks / Subtasks

- [x] Task 1: Create Error Module (AC: All)
  - [x] ScannerError enum
  - [x] is_recoverable() method
  - [x] ScannerResult type alias

- [x] Task 2: Create Check Trait (AC: 1)
  - [x] Check trait with execute()
  - [x] CheckOutput struct
  - [x] CheckRegistry
  - [x] CheckDefinitionBuilder
  - [x] Platform detection

- [x] Task 3: Create Check Runner (AC: 2)
  - [x] CheckRunner with parallel execution
  - [x] Semaphore-based concurrency control
  - [x] Timeout handling
  - [x] NFR timing warnings
  - [x] ScanSummary

- [x] Task 4: Create Scheduler (AC: 3)
  - [x] Scheduler with interval config
  - [x] SchedulerEvent enum
  - [x] start/stop methods
  - [x] trigger_scan() for immediate scans
  - [x] Status tracking

- [x] Task 5: Create Proof Generator (AC: 4)
  - [x] ProofGenerator with SHA-256
  - [x] HMAC-SHA256 signing
  - [x] Retention expiration
  - [x] Integrity verification

- [x] Task 6: Create Score Calculator (AC: 5)
  - [x] ScoreCalculator with weighted scoring
  - [x] ScoringConfig for custom weights
  - [x] Category and framework scores
  - [x] Delta calculation

- [x] Task 7: Add Tests (AC: All)
  - [x] 46 comprehensive tests
  - [x] Error handling tests
  - [x] Check trait tests
  - [x] Runner tests
  - [x] Scheduler tests
  - [x] Proof tests
  - [x] Score tests

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- NFR-P6: Check execution < 2s
- NFR-P7: Full scan < 30s
- Proof generation with SHA-256 hash
- Weighted scoring for compliance

### Module Structure

```rust
agent-scanner/
├── check.rs      # Check trait and registry
├── error.rs      # Scanner errors
├── proof.rs      # Proof generation with SHA-256/HMAC
├── runner.rs     # Parallel check runner
├── scheduler.rs  # Periodic execution
└── score.rs      # Compliance score calculator
```

### Key Types

```rust
Check trait:
- definition() -> &CheckDefinition
- execute() -> ScannerResult<CheckOutput>
- is_platform_supported() -> bool

CheckRunner:
- run_check(id) -> ScannerResult<CheckExecutionResult>
- run_all() -> Vec<CheckExecutionResult>
- run_checks(checks) -> Vec<CheckExecutionResult>

Scheduler:
- start() -> mpsc::Receiver<SchedulerEvent>
- stop()
- trigger_scan() -> Vec<CheckExecutionResult>
- status() -> SchedulerStatus

ScoreCalculator:
- calculate(inputs) -> ComplianceScore
- calculate_simple(results) -> f64
```

### Key Design Decisions

- **async-trait**: For async Check trait execution
- **Semaphore concurrency**: Control parallel check execution
- **tokio::time::timeout**: Prevent hung checks
- **RwLock for status**: Thread-safe scheduler state
- **HMAC-SHA256**: For tamper-evident proof signatures
- **Weighted scoring**: Critical checks have more impact

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Created error.rs with ScannerError
- Created check.rs with Check trait and CheckRegistry
- Created runner.rs with parallel execution
- Created scheduler.rs with periodic execution
- Created proof.rs with SHA-256 and HMAC
- Created score.rs with weighted scoring
- Added async-trait to workspace dependencies
- 46 tests passing

### Completion Notes List

- Check trait with async execute()
- CheckRegistry for pluggable checks
- CheckDefinitionBuilder for easy definition creation
- CheckRunner with parallel execution (Semaphore)
- 30s timeout per check, 4 concurrent by default
- NFR timing warnings logged
- Scheduler with configurable interval
- SchedulerEvent for scan lifecycle
- ProofGenerator with SHA-256 hash
- HMAC-SHA256 signing for tamper detection
- 12-month retention by default
- ScoreCalculator with weighted scoring
- Category and framework breakdown
- 46 comprehensive tests

### File List

**New Files Created:**
- sentinel-agent/crates/agent-scanner/src/error.rs
- sentinel-agent/crates/agent-scanner/src/check.rs
- sentinel-agent/crates/agent-scanner/src/runner.rs
- sentinel-agent/crates/agent-scanner/src/scheduler.rs
- sentinel-agent/crates/agent-scanner/src/proof.rs
- sentinel-agent/crates/agent-scanner/src/score.rs

**Modified Files:**
- sentinel-agent/crates/agent-scanner/src/lib.rs
- sentinel-agent/crates/agent-scanner/Cargo.toml
- sentinel-agent/Cargo.toml (async-trait)

### Change Log

- 2026-01-23: Created error module
- 2026-01-23: Created check trait and registry
- 2026-01-23: Created parallel check runner
- 2026-01-23: Created scheduler
- 2026-01-23: Created proof generator
- 2026-01-23: Created score calculator
- 2026-01-23: Added 46 comprehensive tests

## Senior Developer Review (AI)

**Date:** 2026-01-23 | **Decision:** PENDING REVIEW
