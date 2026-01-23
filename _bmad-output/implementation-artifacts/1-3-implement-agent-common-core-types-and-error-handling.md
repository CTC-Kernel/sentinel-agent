# Story 1.3: Implement agent-common Core Types and Error Handling

Status: review

## Story

As a **developer**,
I want **shared types, configuration structs, and error enums in agent-common**,
So that **all crates have consistent type definitions and error handling**.

## Acceptance Criteria

1. **AC1** - Error Types
   - `CommonError` enum defined with thiserror derives
   - Error types follow architecture pattern: `{Crate}Error`
   - Wrapped variant for chaining errors with context

2. **AC2** - Configuration Types
   - `AgentConfig` struct with all configuration fields
   - Serde snake_case serialization
   - Default values via `#[serde(default)]`

3. **AC3** - Domain Types
   - `CheckResult` type for check execution results
   - `Proof` type for compliance evidence
   - `AgentStatus` enum for agent state

4. **AC4** - Serialization
   - All types implement Serialize/Deserialize
   - DateTime uses chrono with ISO 8601 format
   - JSON field names in snake_case

5. **AC5** - Testing
   - Unit tests verify serialization roundtrip
   - Tests for default values
   - Tests for error formatting

## Tasks / Subtasks

- [x] Task 1: Create Module Structure (AC: 1, 2, 3)
  - [x] Create src/error.rs
  - [x] Create src/config.rs
  - [x] Create src/types/ directory with mod.rs
  - [x] Create src/types/check.rs
  - [x] Create src/types/proof.rs
  - [x] Create src/types/agent.rs
  - [x] Create src/constants.rs
  - [x] Update src/lib.rs to export modules

- [x] Task 2: Implement Error Types (AC: 1)
  - [x] Define CommonError enum with thiserror
  - [x] Add Config, Io, Serialization, Validation variants
  - [x] Implement wrapped error variant

- [x] Task 3: Implement Configuration Types (AC: 2, 4)
  - [x] Define AgentConfig struct
  - [x] Add server_url, agent_id, check_interval fields
  - [x] Add offline_mode_days, log_level fields
  - [x] Configure serde attributes

- [x] Task 4: Implement Domain Types (AC: 3, 4)
  - [x] Define CheckResult struct (id, status, timestamp, proof_id)
  - [x] Define Proof struct (id, check_id, data, hash, timestamp)
  - [x] Define AgentStatus enum (Online, Offline, Syncing, Error)
  - [x] Define CheckStatus enum (Pass, Fail, Error, Skipped)

- [x] Task 5: Add Chrono Dependency (AC: 4)
  - [x] Add chrono to workspace dependencies
  - [x] Use DateTime<Utc> for timestamps
  - [x] Configure serde with chrono feature

- [x] Task 6: Write Unit Tests (AC: 5)
  - [x] Test config serialization roundtrip
  - [x] Test check result serialization
  - [x] Test proof serialization
  - [x] Test error formatting
  - [x] Test default values

- [x] Task 7: Verify Build (AC: 1, 2, 3, 4, 5)
  - [x] Run cargo build
  - [x] Run cargo test
  - [x] Run cargo clippy

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:

**Module Structure:**
```
crates/agent-common/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── error.rs
    ├── config.rs
    ├── types/
    │   ├── mod.rs
    │   ├── check.rs
    │   ├── proof.rs
    │   └── agent.rs
    └── constants.rs
```

**Error Pattern:**
```rust
#[derive(Error, Debug)]
pub enum {Crate}Error {
    #[error("{context}: {source}")]
    Wrapped { context: String, #[source] source: Box<dyn Error> },
}
```

**Config Pattern:**
- `#[serde(rename_all = "snake_case")]` obligatoire
- Defaults via `#[serde(default)]`

**DateTime Pattern:**
- Storage: ISO 8601 TEXT
- Use `chrono::DateTime<Utc>` partout

### Dependencies Added

```toml
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4", "serde"] }
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Added chrono and uuid to workspace dependencies
- Created modular structure following architecture specs
- All 25 unit tests pass + 1 doctest
- clippy warning fixed: used derive(Default) with #[default] attribute

### Completion Notes List

- ✅ Created error.rs with CommonError enum (Config, Io, Serialization, Validation, Wrapped, Internal)
- ✅ Created config.rs with AgentConfig struct (server_url, agent_id, check_interval_secs, etc.)
- ✅ Created config.rs with ProxyConfig struct
- ✅ Created types/agent.rs with AgentStatus, AgentInfo, Heartbeat, SystemMetrics
- ✅ Created types/check.rs with CheckStatus, CheckSeverity, CheckCategory, CheckDefinition, CheckResult
- ✅ Created types/proof.rs with Proof, ProofMetadata
- ✅ Created constants.rs with all agent constants
- ✅ Updated lib.rs with module exports and documentation
- ✅ Added chrono and uuid to workspace dependencies
- ✅ All types use snake_case serde serialization
- ✅ DateTime<Utc> used for all timestamps
- ✅ 25 unit tests + 1 doctest passing
- ✅ cargo build, clippy, fmt all pass

### File List

**Modified Files:**
- sentinel-agent/Cargo.toml (added chrono, uuid dependencies)
- sentinel-agent/crates/agent-common/Cargo.toml (added chrono, uuid)
- sentinel-agent/crates/agent-common/src/lib.rs (module exports)

**New Files Created:**
- sentinel-agent/crates/agent-common/src/error.rs
- sentinel-agent/crates/agent-common/src/config.rs
- sentinel-agent/crates/agent-common/src/constants.rs
- sentinel-agent/crates/agent-common/src/types/mod.rs
- sentinel-agent/crates/agent-common/src/types/agent.rs
- sentinel-agent/crates/agent-common/src/types/check.rs
- sentinel-agent/crates/agent-common/src/types/proof.rs

### Change Log

- 2026-01-23: Implemented agent-common core types and error handling
- 2026-01-23: Added 25 unit tests for serialization, defaults, and error formatting
