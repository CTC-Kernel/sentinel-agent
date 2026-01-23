# Story 1.1: Initialize Cargo Workspace Structure

Status: review

## Story

As a **developer**,
I want **to have a properly configured Cargo Workspace with all 6 crates initialized**,
So that **I can start implementing agent features with proper module separation**.

## Acceptance Criteria

1. **AC1** - Workspace Configuration
   - Cargo workspace manifest exists at root with resolver v3
   - Rust 2024 Edition specified for all crates
   - All 6 crates listed as members (agent-common, agent-system, agent-storage, agent-scanner, agent-sync, agent-core)
   - xtask crate for build automation included

2. **AC2** - Workspace Dependencies
   - Shared dependencies declared in `[workspace.dependencies]`
   - tokio, serde, tracing, thiserror, anyhow versions pinned
   - Platform-specific dependencies (windows, nix) configured with features

3. **AC3** - Crate Initialization
   - All 6 crates compile successfully with `cargo build`
   - Each crate has proper Cargo.toml with `{workspace = true}` inheritance
   - Each lib crate has empty lib.rs, agent-core has main.rs

4. **AC4** - Security Tooling
   - deny.toml created with license allowlist (MIT, Apache-2.0, MPL-2.0)
   - rustfmt.toml with standard configuration
   - clippy.toml with strict linting rules

5. **AC5** - CI Pipeline
   - GitHub Actions workflow in .github/workflows/ci.yml
   - Pipeline runs: fmt check, clippy, test, deny check
   - Pipeline fails if any check fails

## Tasks / Subtasks

- [x] Task 1: Create Workspace Root (AC: 1)
  - [x] Create sentinel-agent directory
  - [x] Create root Cargo.toml with workspace config
  - [x] Set resolver = "3" and members list

- [x] Task 2: Initialize Agent Crates (AC: 3)
  - [x] `cargo init --lib --name agent-common crates/agent-common`
  - [x] `cargo init --lib --name agent-system crates/agent-system`
  - [x] `cargo init --lib --name agent-storage crates/agent-storage`
  - [x] `cargo init --lib --name agent-scanner crates/agent-scanner`
  - [x] `cargo init --lib --name agent-sync crates/agent-sync`
  - [x] `cargo init --name agent-core crates/agent-core`
  - [x] `cargo init --name xtask xtask`

- [x] Task 3: Configure Workspace Dependencies (AC: 2)
  - [x] Add [workspace.dependencies] section
  - [x] Pin tokio = "1" with features = ["full"]
  - [x] Pin reqwest = "0.13" with json, rustls-tls features
  - [x] Pin tokio-rusqlite = "0.7"
  - [x] Pin serde = "1" with derive feature
  - [x] Pin tracing = "0.1", tracing-subscriber = "0.3"
  - [x] Pin thiserror = "2", anyhow = "1"
  - [x] Add windows crate for Windows platform
  - [x] Add nix crate for Linux platform

- [x] Task 4: Configure Individual Crate Cargo.toml (AC: 3)
  - [x] Update each crate Cargo.toml with workspace inheritance
  - [x] Set edition.workspace = true, version.workspace = true
  - [x] Add appropriate dependencies from workspace

- [x] Task 5: Setup Security Tooling (AC: 4)
  - [x] Create deny.toml with advisories and licenses config
  - [x] Create rustfmt.toml with max_width = 100
  - [x] Create clippy.toml with strict rules

- [x] Task 6: Create CI Pipeline (AC: 5)
  - [x] Create .github/workflows/ci.yml
  - [x] Add steps: checkout, rust toolchain, fmt, clippy, test, deny
  - [x] Configure matrix for stable + beta

- [x] Task 7: Verify Build (AC: 1, 3)
  - [x] Run `cargo build` - must succeed
  - [x] Run `cargo fmt --check` - must pass
  - [x] Run `cargo clippy` - must pass
  - [x] Run `cargo test` - must pass (even if empty tests)

## Dev Notes

### Project Structure Notes

This story creates the foundational Rust workspace structure. The workspace will be created as a NEW project (not inside the existing SaaS codebase).

**Target Location:** New repository `sentinel-agent/`

**Complete Directory Structure (from Architecture Doc):**

```
sentinel-agent/
├── Cargo.toml              # Workspace manifest
├── Cargo.lock
├── deny.toml               # cargo-deny config
├── rustfmt.toml            # Formatting rules
├── clippy.toml             # Linting rules
├── .github/
│   └── workflows/
│       └── ci.yml
├── crates/
│   ├── agent-common/
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── agent-system/
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── agent-storage/
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── agent-scanner/
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── agent-sync/
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   └── agent-core/
│       ├── Cargo.toml
│       └── src/main.rs
└── xtask/
    ├── Cargo.toml
    └── src/main.rs
```

### Architecture Compliance

**CRITICAL: Follow these exact specifications from architecture-agent-grc.md:**

**Workspace Cargo.toml (exact content):**
```toml
[workspace]
resolver = "3"
members = [
    "crates/*",
    "xtask",
]

[workspace.package]
version = "0.1.0"
edition = "2024"
license = "Proprietary"
repository = "https://github.com/sentinel/agent"

[workspace.dependencies]
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.13", features = ["json", "rustls-tls"] }
tokio-rusqlite = "0.7"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json"] }
thiserror = "2"
anyhow = "1"

[workspace.dependencies.windows]
version = "0.58"
features = ["Win32_System_Services", "Win32_Security", "Win32_System_Registry"]

[workspace.dependencies.nix]
version = "0.29"
features = ["user", "process", "fs"]
```

**Crate Dependency Graph:**
```
agent-core
    ├── agent-scanner
    │       ├── agent-system
    │       │       └── agent-common
    │       └── agent-common
    ├── agent-sync
    │       ├── agent-storage
    │       │       └── agent-common
    │       └── agent-common
    └── agent-common
```

### Library & Framework Requirements

**Rust Version:** 2024 Edition (latest stable)
**Toolchain:** Use `rustup default stable`

**Required Tools:**
- cargo-deny (for license/security checks)
- rustfmt (for formatting)
- clippy (for linting)

**Install commands:**
```bash
cargo install cargo-deny
rustup component add rustfmt clippy
```

### Testing Requirements

This story focuses on workspace structure - minimal testing required:
- `cargo build` must succeed
- `cargo fmt --check` must pass
- `cargo clippy -- -D warnings` must pass
- `cargo test` must pass (empty test suite is ok)

### deny.toml Template

```toml
[advisories]
vulnerability = "deny"
unmaintained = "warn"
yanked = "deny"

[licenses]
allow = [
    "MIT",
    "Apache-2.0",
    "Apache-2.0 WITH LLVM-exception",
    "MPL-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "Unicode-DFS-2016",
]
confidence-threshold = 0.8

[bans]
multiple-versions = "warn"
wildcards = "deny"
```

### CI Workflow Template

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  CARGO_TERM_COLOR: always

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-action@stable
      - run: cargo fmt --check
      - run: cargo clippy -- -D warnings
      - run: cargo deny check
      - run: cargo test
      - run: cargo build --release
```

### References

- [Source: architecture-agent-grc.md#Starter-Template-Evaluation]
- [Source: architecture-agent-grc.md#Selected-Architecture-Cargo-Workspace-Multi-Crates]
- [Source: architecture-agent-grc.md#Complete-Project-Directory-Structure]
- [Source: architecture-agent-grc.md#CI-Pipeline]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Rust 1.93.0 installed via rustup
- reqwest feature `rustls-tls` updated to `rustls` for reqwest 0.13 compatibility
- cargo fmt applied to fix trailing newlines in lib.rs files
- All build verification commands passed successfully

### Completion Notes List

- ✅ Created sentinel-agent workspace directory at `/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-agent/`
- ✅ Created root Cargo.toml with resolver = "3", 2024 edition, all workspace dependencies
- ✅ Initialized 6 crates: agent-common, agent-system, agent-storage, agent-scanner, agent-sync, agent-core
- ✅ Initialized xtask crate for build automation
- ✅ All crates use workspace inheritance for version and edition
- ✅ Created deny.toml with license allowlist and security config
- ✅ Created rustfmt.toml with max_width = 100
- ✅ Created clippy.toml with complexity thresholds
- ✅ Created .github/workflows/ci.yml with fmt, clippy, deny, test, build steps
- ✅ `cargo build` - PASSED (compiled 227 packages)
- ✅ `cargo fmt --check` - PASSED
- ✅ `cargo clippy -- -D warnings` - PASSED (no warnings)
- ✅ `cargo test` - PASSED (0 tests, empty suite expected)

### File List

**New Files Created:**
- sentinel-agent/Cargo.toml
- sentinel-agent/Cargo.lock (generated)
- sentinel-agent/deny.toml
- sentinel-agent/rustfmt.toml
- sentinel-agent/clippy.toml
- sentinel-agent/.github/workflows/ci.yml
- sentinel-agent/crates/agent-common/Cargo.toml
- sentinel-agent/crates/agent-common/src/lib.rs
- sentinel-agent/crates/agent-system/Cargo.toml
- sentinel-agent/crates/agent-system/src/lib.rs
- sentinel-agent/crates/agent-storage/Cargo.toml
- sentinel-agent/crates/agent-storage/src/lib.rs
- sentinel-agent/crates/agent-scanner/Cargo.toml
- sentinel-agent/crates/agent-scanner/src/lib.rs
- sentinel-agent/crates/agent-sync/Cargo.toml
- sentinel-agent/crates/agent-sync/src/lib.rs
- sentinel-agent/crates/agent-core/Cargo.toml
- sentinel-agent/crates/agent-core/src/main.rs
- sentinel-agent/xtask/Cargo.toml
- sentinel-agent/xtask/src/main.rs

### Change Log

- 2026-01-23: Initial workspace structure created with all 6 crates, xtask, and tooling configuration
- 2026-01-23: Build verification completed - all checks passed (build, fmt, clippy, test)

