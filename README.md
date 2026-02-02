# Sentinel GRC Agent

[![CI](https://github.com/sentinel/agent/actions/workflows/ci.yml/badge.svg)](https://github.com/sentinel/agent/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-2024%20edition-orange.svg)](https://www.rust-lang.org/)
[![Version](https://img.shields.io/badge/version-2.0.0-green.svg)]()

A lightweight, secure endpoint agent for compliance monitoring, vulnerability scanning, network discovery, and GRC (Governance, Risk, Compliance) enforcement -- with an optional real-time desktop GUI.

**Developed by [Cyber Threat Consulting](https://cyber-threat-consulting.com)**

## Overview

Sentinel GRC Agent is a cross-platform agent that:

### Compliance & Security
- Runs **21 compliance checks** across CIS benchmarks, NIS2, ISO 27001, DORA, and SOC2 frameworks
- Scans **151+ Homebrew packages** for known CVE vulnerabilities
- Monitors running processes for suspicious activity
- Provides automated remediation for failing compliance checks
- Tracks file integrity changes

### Network
- Collects network topology (interfaces, active connections, routes)
- Performs network discovery via ARP, mDNS, and SSDP
- Detects network-level security anomalies

### Desktop GUI
- Real-time desktop GUI built with **egui** and a system tray icon
- **14 pages**: Dashboard, Monitoring (CPU/RAM/Disk/Net charts), Compliance, Software, Vulnerabilities, File Integrity, Threats, Network, Sync, Terminal (live logs), Discovery, Cartography, Notifications, Settings
- Premium sync indicator in sidebar with animated status dot
- Light and dark theme support

### Sync & Storage
- Reports results to the [Sentinel GRC platform](https://app.cyber-threat-consulting.com)
- Encrypted SQLite storage (SQLCipher AES-256)
- Certificate-based authentication (mTLS) with header fallback
- Offline-first with store-and-forward sync
- Smart scheduling with jitter to avoid thundering herds
- Battery-aware scan throttling

## Architecture

The agent is built as a Rust workspace with modular crates:

```
sentinel-agent/
├── crates/
│   ├── agent-common/    # Shared types, config, and utilities
│   ├── agent-system/    # Platform-specific system interactions
│   ├── agent-storage/   # SQLite-based encrypted local storage
│   ├── agent-scanner/   # Compliance checks, vulnerability scanner, security monitor
│   ├── agent-network/   # Network collection, discovery, and security detection
│   ├── agent-sync/      # SaaS communication (mTLS, result upload, rule sync)
│   ├── agent-gui/       # egui desktop GUI with system tray
│   └── agent-core/      # Main entry point and orchestration
└── xtask/               # Build automation tasks
```

## Requirements

- Rust 2024 Edition (1.93.0+)
- Supported platforms:
  - macOS 12+ (x86_64 and Apple Silicon/ARM64)
  - Windows 10+ (x64)
  - Linux (Ubuntu 20.04+, RHEL 8+)

## Building

```bash
# Build with GUI (desktop)
cargo build --release --package agent-core --features gui

# Build headless (server)
cargo build --release --package agent-core

# Debug build
cargo build

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
- Certificate-based authentication with header fallback
- Binary signing (Authenticode/GPG)
- Regular security audits via cargo-audit

## Support

- **Website**: [cyber-threat-consulting.com](https://cyber-threat-consulting.com)
- **Platform**: [app.cyber-threat-consulting.com](https://app.cyber-threat-consulting.com)
- **Contact**: contact@cyber-threat-consulting.com

## License

Proprietary - Copyright 2024-2026 Cyber Threat Consulting. All rights reserved.
