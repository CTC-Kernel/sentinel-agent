# Contributing to Sentinel GRC Agent

Merci de votre interet pour Sentinel GRC Agent ! Ce guide explique comment contribuer au projet.

## Prerequisites

- **Rust 2024 Edition** (1.93.0+)
- `rustfmt`, `clippy`, `llvm-tools-preview` (via `rustup component add`)
- `cargo-deny`, `cargo-audit` (via `cargo install`)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/sentinel/agent.git
cd sentinel-agent

# Build
cargo build

# Run tests
cargo test

# Run all quality checks
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test && cargo deny check
```

## Quality Gates

All pull requests must pass:

| Check | Command |
|-------|---------|
| Formatting | `cargo fmt --check` |
| Linting | `cargo clippy --all-targets -- -D warnings` |
| Tests | `cargo test` |
| License & Security | `cargo deny check` |
| Vulnerabilities | `cargo audit` |

## Code Style

- **No `any` types** -- strict TypeScript equivalent: all types must be explicit
- **No `unwrap()`** on user data -- use proper error handling
- **No `let _ =`** to suppress important `Result` values
- Use `saturating_*()` / `.clamp()` for arithmetic to prevent overflows
- Use `chars()` / `char_indices()` instead of byte indexing for UTF-8 safety
- All SQL queries must use parameterized statements (no string interpolation)

## Architecture

The project is a Rust workspace with modular crates:

| Crate | Purpose |
|-------|---------|
| `agent-common` | Shared types, config, constants |
| `agent-core` | Main orchestration, entry point |
| `agent-gui` | egui desktop GUI + system tray |
| `agent-scanner` | Compliance checks, CVE scanning |
| `agent-network` | Network topology, discovery |
| `agent-storage` | Encrypted SQLite storage |
| `agent-sync` | Server communication (mTLS) |
| `agent-fim` | File integrity monitoring |
| `agent-siem` | SIEM log forwarding |
| `agent-persistence` | Persistent state management |
| `agent_llm` | Local LLM analysis (experimental) |
| `xtask` | Build automation |

## Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes with tests
3. Ensure all quality gates pass locally
4. Submit a pull request with a clear description
5. Address review feedback

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- For security vulnerabilities, see [SECURITY.md](SECURITY.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
