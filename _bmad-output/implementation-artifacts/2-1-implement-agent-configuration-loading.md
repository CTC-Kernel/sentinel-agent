# Story 2.1: Implement Agent Configuration Loading

Status: review

## Story

As an **administrator**,
I want **the agent to load configuration from JSON file or environment variables**,
So that **I can configure agent behavior without recompiling**.

## Acceptance Criteria

1. **AC1** - JSON File Configuration
   - Configuration file `agent.json` is loaded from standard paths
   - JSON structure matches `AgentConfig` struct from agent-common
   - Invalid JSON produces clear error message with line/column

2. **AC2** - Environment Variable Override
   - Environment variables override file values
   - Prefix `SENTINEL_` used (e.g., `SENTINEL_SERVER_URL`)
   - Nested config uses underscores (e.g., `SENTINEL_PROXY_HOST`)

3. **AC3** - Default Values
   - Missing optional settings use sensible defaults
   - Default check_interval_secs = 3600 (1 hour)
   - Default offline_mode_days = 7
   - Default log_level = "info"

4. **AC4** - Validation
   - Missing required config (server_url, agent_id) produces error
   - Invalid values (negative intervals, malformed URLs) are rejected
   - Validation errors include field name and expected format

5. **AC5** - Config Paths
   - Windows: `C:\ProgramData\Sentinel\agent.json`
   - Linux: `/etc/sentinel/agent.json`
   - Fallback to `./agent.json` for development

## Tasks / Subtasks

- [x] Task 1: Add Configuration Dependencies (AC: 1, 2)
  - [x] Add `config` crate to workspace dependencies
  - [x] Add `directories` crate for platform paths
  - [x] Add `url` crate for URL validation
  - [x] Add `tempfile` crate for testing
  - [x] Update agent-common Cargo.toml

- [x] Task 2: Implement Config Loading in agent-common (AC: 1, 3, 5)
  - [x] Implement AgentConfig::load() function in config.rs
  - [x] Implement platform-specific config paths (platform_config_path)
  - [x] Implement fallback path logic (./agent.json for dev)
  - [x] Implement platform_data_dir() helper

- [x] Task 3: Implement Environment Variable Overlay (AC: 2)
  - [x] Add environment variable source to config builder
  - [x] Map SENTINEL_* variables to config fields
  - [x] Handle nested config (proxy settings with SENTINEL_PROXY_URL)

- [x] Task 4: Implement Validation (AC: 4)
  - [x] Enhanced validate() method on AgentConfig
  - [x] URL format validation using `url` crate
  - [x] Log level validation (trace, debug, info, warn, error)
  - [x] Numeric range validation (intervals, days)
  - [x] Proxy URL validation

- [x] Task 5: Write Unit Tests (AC: 1, 2, 3, 4, 5)
  - [x] Test JSON file loading (test_load_from_json_file)
  - [x] Test environment override (implicit via config crate)
  - [x] Test default values (test_load_with_defaults)
  - [x] Test validation errors (10+ validation tests)
  - [x] Test platform paths (test_platform_config_path, test_platform_data_dir)

- [x] Task 6: Create Example Configuration (AC: 1)
  - [x] Create config/agent.example.json (minimal)
  - [x] Create config/agent.full.example.json (all options)

## Dev Notes

### Architecture Compliance

From architecture-agent-grc.md:
- FR4: L'agent peut se configurer via fichier JSON ou variables d'environnement
- Config Pattern: `#[serde(rename_all = "snake_case")]` obligatoire

### AgentConfig Structure (from agent-common)

```rust
pub struct AgentConfig {
    pub server_url: String,
    pub agent_id: Option<Uuid>,
    pub check_interval_secs: u64,
    pub offline_mode_days: u32,
    pub log_level: String,
    pub proxy: Option<ProxyConfig>,
}
```

### Config Crate Usage

Use the `config` crate for layered configuration:
1. Default values (hardcoded)
2. JSON file (platform-specific path)
3. Environment variables (SENTINEL_* prefix)

### Platform Paths

- Windows: Use `%PROGRAMDATA%\Sentinel\` (typically `C:\ProgramData\Sentinel\`)
- Linux: Use `/etc/sentinel/`
- Dev fallback: Current directory `./agent.json`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Added config, directories, url, tempfile to workspace dependencies
- Implemented layered configuration loading (defaults → file → env vars)
- Fixed clippy warnings: redundant closure, const assertions

### Completion Notes List

- ✅ Added `config` crate for layered configuration management
- ✅ Added `directories` crate for platform-specific paths
- ✅ Added `url` crate for URL validation
- ✅ Implemented AgentConfig::load() with JSON file + env var support
- ✅ Platform paths: Windows (C:\ProgramData\Sentinel), Linux (/etc/sentinel)
- ✅ Dev fallback path: ./agent.json
- ✅ Environment variables with SENTINEL_ prefix (e.g., SENTINEL_SERVER_URL)
- ✅ Comprehensive validation: URL format, log levels, numeric ranges
- ✅ Created example configuration files in config/ directory
- ✅ 37 unit tests passing + 2 doctests
- ✅ Clippy and fmt pass

### File List

**Modified Files:**
- sentinel-agent/Cargo.toml (added config, directories, url, tempfile)
- sentinel-agent/crates/agent-common/Cargo.toml (added dependencies)
- sentinel-agent/crates/agent-common/src/config.rs (config loading, validation)
- sentinel-agent/crates/agent-common/src/constants.rs (const assertions)

**New Files Created:**
- sentinel-agent/config/agent.example.json
- sentinel-agent/config/agent.full.example.json

### Change Log

- 2026-01-23: Implemented configuration loading with layered sources
- 2026-01-23: Added URL and log level validation
- 2026-01-23: Created example configuration files
