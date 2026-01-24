# Sentinel GRC Agent

[![CI](https://github.com/sentinel/agent/actions/workflows/ci.yml/badge.svg)](https://github.com/sentinel/agent/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-2024%20edition-orange.svg)](https://www.rust-lang.org/)

A lightweight, secure compliance agent for endpoint monitoring and GRC (Governance, Risk, Compliance) enforcement.

**Developed by [Cyber Threat Consulting](https://cyber-threat-consulting.com)**

## Overview

Sentinel GRC Agent is a cross-platform agent that:
- Monitors endpoint compliance with security policies
- Executes configurable compliance checks
- Reports results to the [Sentinel GRC platform](https://app.cyber-threat-consulting.com)
- Works offline with local caching and sync

## Architecture

The agent is built as a Rust workspace with modular crates:

```
sentinel-agent/
├── crates/
│   ├── agent-common/    # Shared types and utilities
│   ├── agent-system/    # Platform-specific system interactions
│   ├── agent-storage/   # SQLite-based encrypted local storage
│   ├── agent-scanner/   # Compliance check engine
│   ├── agent-sync/      # SaaS communication and synchronization
│   └── agent-core/      # Main entry point and orchestration
└── xtask/               # Build automation tasks
```

## Requirements

- Rust 2024 Edition (1.93.0+)
- Supported platforms:
  - Windows 10+ (x64)
  - Linux (Ubuntu 20.04+, RHEL 8+)

## Building

```bash
# Debug build
cargo build

# Release build
cargo build --release

# Run tests
cargo test

# Run with all checks
cargo fmt --check && cargo clippy -- -D warnings && cargo test
```

## Development

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install development tools
cargo install cargo-deny cargo-audit
rustup component add rustfmt clippy llvm-tools-preview
```

### Quality Gates

All PRs must pass:
- `cargo fmt --check` - Code formatting
- `cargo clippy -- -D warnings` - Linting
- `cargo test` - Unit tests
- `cargo deny check` - License and security checks
- `cargo audit` - Vulnerability scanning

### Code Coverage

Coverage reports are generated using `cargo-llvm-cov`:

```bash
cargo install cargo-llvm-cov
cargo llvm-cov --all-features --workspace
```

Minimum coverage threshold: **70%**

## Security

- All data encrypted at rest (SQLCipher/AES-256)
- TLS 1.3 + mTLS for all communications
- Binary signing (Authenticode/GPG)
- Regular security audits via cargo-audit

## Support

- **Website**: [cyber-threat-consulting.com](https://cyber-threat-consulting.com)
- **Platform**: [app.cyber-threat-consulting.com](https://app.cyber-threat-consulting.com)
- **Contact**: contact@cyber-threat-consulting.com

## License

Proprietary - Copyright © 2024-2026 Cyber Threat Consulting. All rights reserved.
