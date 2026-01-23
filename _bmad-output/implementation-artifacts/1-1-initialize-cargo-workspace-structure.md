# Story 1.1: Initialize Cargo Workspace Structure

Status: ready-for-dev

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

- [ ] Task 1: Create Workspace Root (AC: 1)
  - [ ] Create sentinel-agent directory
  - [ ] Create root Cargo.toml with workspace config
  - [ ] Set resolver = "3" and members list

- [ ] Task 2: Initialize Agent Crates (AC: 3)
  - [ ] `cargo init --lib --name agent-common crates/agent-common`
  - [ ] `cargo init --lib --name agent-system crates/agent-system`
  - [ ] `cargo init --lib --name agent-storage crates/agent-storage`
  - [ ] `cargo init --lib --name agent-scanner crates/agent-scanner`
  - [ ] `cargo init --lib --name agent-sync crates/agent-sync`
  - [ ] `cargo init --name agent-core crates/agent-core`
  - [ ] `cargo init --name xtask xtask`

- [ ] Task 3: Configure Workspace Dependencies (AC: 2)
  - [ ] Add [workspace.dependencies] section
  - [ ] Pin tokio = "1" with features = ["full"]
  - [ ] Pin reqwest = "0.13" with json, rustls-tls features
  - [ ] Pin tokio-rusqlite = "0.7"
  - [ ] Pin serde = "1" with derive feature
  - [ ] Pin tracing = "0.1", tracing-subscriber = "0.3"
  - [ ] Pin thiserror = "2", anyhow = "1"
  - [ ] Add windows crate for Windows platform
  - [ ] Add nix crate for Linux platform

- [ ] Task 4: Configure Individual Crate Cargo.toml (AC: 3)
  - [ ] Update each crate Cargo.toml with workspace inheritance
  - [ ] Set edition.workspace = true, version.workspace = true
  - [ ] Add appropriate dependencies from workspace

- [ ] Task 5: Setup Security Tooling (AC: 4)
  - [ ] Create deny.toml with advisories and licenses config
  - [ ] Create rustfmt.toml with max_width = 100
  - [ ] Create clippy.toml with strict rules

- [ ] Task 6: Create CI Pipeline (AC: 5)
  - [ ] Create .github/workflows/ci.yml
  - [ ] Add steps: checkout, rust toolchain, fmt, clippy, test, deny
  - [ ] Configure matrix for stable + beta

- [ ] Task 7: Verify Build (AC: 1, 3)
  - [ ] Run `cargo build` - must succeed
  - [ ] Run `cargo fmt --check` - must pass
  - [ ] Run `cargo clippy` - must pass
  - [ ] Run `cargo test` - must pass (even if empty tests)

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

