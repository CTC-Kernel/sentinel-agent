# Changelog

All notable changes to the Sentinel GRC Agent will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Centralized Firebase configuration constants in `agent-common`
- Added `silent_command()` utility to prevent console window flash on Windows

### Security
- Removed all hardcoded credentials from source code
- Externalized certificate passwords to environment variables
- Purged sensitive data from git history
- Licensed under MIT for open-source release

## [2.0.112] - 2026-02-28

### Fixed
- Prevent `set -e` from swallowing `notarytool` error output on macOS signing

## [2.0.111] - 2026-02-27

### Fixed
- Point Windows shortcuts directly to `.exe` instead of `.bat` launcher
- Install self-signed certificate in Root store and fix `install-with-cert.bat`

## [2.0.110] - 2026-02-26

### Fixed
- Gate dev data-dir fallback behind `debug_assertions` only

## [2.0.109] - 2026-02-25

### Fixed
- Fallback log directory when running without root privileges

## [2.0.108] - 2026-02-24

### Changed
- Internal improvements and stability fixes

## [2.0.107] - 2026-02-23

### Changed
- Internal improvements and stability fixes

## [2.0.105] - 2026-02-21

### Changed
- Internal improvements and stability fixes

## [2.0.104] - 2026-02-20

### Changed
- Internal improvements and stability fixes

## [2.0.103] - 2026-02-19

### Changed
- Internal improvements and stability fixes

## [2.0.102] - 2026-02-18

### Changed
- Internal improvements and stability fixes

## [2.0.101] - 2026-02-17

### Changed
- Internal improvements and stability fixes

## [2.0.100] - 2026-02-16

### Changed
- Internal improvements and stability fixes

## [2.0.99] - 2026-02-15

### Changed
- Internal improvements and stability fixes

## [2.0.98] - 2026-02-14

### Changed
- Internal improvements and stability fixes

## [2.0.97] - 2026-02-13

### Changed
- Internal improvements and stability fixes

## [2.0.96] - 2026-02-12

### Fixed
- Remove invalid file starting with NUL that broke Windows build

## [2.0.95] - 2026-02-11

### Changed
- Internal improvements and stability fixes

## [2.0.94] - 2026-02-10

### Changed
- Internal improvements and stability fixes

## [2.0.93] - 2026-02-09

### Added
- Initial open-source release of the Sentinel GRC Agent
- 12-crate Rust workspace: `agent-core`, `agent-gui`, `agent-common`, `agent-scanner`, `agent-network`, `agent-storage`, `agent-sync`, `agent-siem`, `agent-fim`, `agent-persistence`, `agent_llm`, `xtask`
- Native desktop GUI with egui/eframe (14 pages)
- 21 compliance checks (CIS, NIS2, ISO 27001, DORA, SOC2)
- CVE vulnerability scanning
- File Integrity Monitoring (FIM)
- Real-time threat detection (USB, process, network)
- Network discovery (ARP, mDNS, SSDP)
- Automated remediation engine
- Self-update mechanism with SHA-256 verification
- Cross-platform support: macOS, Windows, Linux (DEB/RPM)
- System tray integration
- Encrypted local storage with SQLite
- Firebase backend synchronization

[Unreleased]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.112...HEAD
[2.0.112]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.111...v2.0.112
[2.0.111]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.110...v2.0.111
[2.0.110]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.109...v2.0.110
[2.0.109]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.108...v2.0.109
[2.0.108]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.107...v2.0.108
[2.0.107]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.105...v2.0.107
[2.0.105]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.104...v2.0.105
[2.0.104]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.103...v2.0.104
[2.0.103]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.102...v2.0.103
[2.0.102]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.101...v2.0.102
[2.0.101]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.100...v2.0.101
[2.0.100]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.99...v2.0.100
[2.0.99]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.98...v2.0.99
[2.0.98]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.97...v2.0.98
[2.0.97]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.96...v2.0.97
[2.0.96]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.95...v2.0.96
[2.0.95]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.94...v2.0.95
[2.0.94]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.93...v2.0.94
[2.0.93]: https://github.com/CTC-Kernel/sentinel-agent/releases/tag/v2.0.93
