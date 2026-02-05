# agent-scanner

Compliance scanning engine for the Sentinel GRC Agent.

## Overview

This crate provides the compliance and security scanning capabilities:

- **Compliance checks**: 21 built-in checks for NIS2, DORA, and other frameworks
- **Vulnerability scanning**: Package vulnerability detection (apt, brew, Windows)
- **Security monitoring**: Process, USB, and system event monitoring
- **Proof generation**: Timestamped, integrity-verified compliance proofs
- **Score calculation**: Weighted compliance scoring with framework breakdowns
- **Remediation**: Automated fix suggestions and execution

## Built-in Checks

| Check | Category | Frameworks |
|-------|----------|------------|
| Disk Encryption | Encryption | NIS2, DORA |
| Firewall Status | Network | NIS2, DORA |
| Antivirus Status | Endpoint | NIS2 |
| MFA Enforcement | Authentication | NIS2, DORA |
| Password Policy | Authentication | NIS2, DORA |
| System Updates | Patching | NIS2, DORA |
| Session Lock | Access Control | NIS2 |
| Remote Access | Network | NIS2 |
| Backup Status | Resilience | DORA |
| Admin Accounts | Access Control | NIS2 |
| Obsolete Protocols | Network | NIS2 |
| Audit Logging | Monitoring | NIS2, DORA |
| Auto Login | Access Control | NIS2 |
| Bluetooth | Network | NIS2 |
| Browser Security | Endpoint | NIS2 |
| Guest Account | Access Control | NIS2 |
| IPv6 Config | Network | NIS2 |
| Kernel Hardening | System | NIS2 |
| Log Rotation | Monitoring | NIS2 |
| Time Sync | System | NIS2 |
| USB Storage | Endpoint | NIS2 |

## Usage

```rust
use agent_scanner::{CheckRegistry, CheckRunner, DiskEncryptionCheck};

// Create registry and register checks
let mut registry = CheckRegistry::new();
registry.register(Arc::new(DiskEncryptionCheck::new()));

// Run checks
let runner = CheckRunner::new(registry);
let results = runner.run_all().await?;
```

## Scoring

The `ScoreCalculator` calculates weighted compliance scores:

- **Critical**: 4x weight
- **High**: 3x weight
- **Medium**: 2x weight
- **Low**: 1x weight
- **Info**: 0.5x weight

Scores are calculated per category and per framework.

## Proof Generation

Proofs include:

- Check result data
- Execution timestamp
- SHA-256 integrity hash
- Optional HMAC-SHA256 signature
- 12-month default retention
