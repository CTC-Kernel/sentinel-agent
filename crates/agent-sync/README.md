# agent-sync

Server synchronization for the Sentinel GRC Agent.

## Overview

This crate handles all communication with the Sentinel GRC server:

- **Authentication**: mTLS with certificate pinning
- **Config sync**: Server configuration download
- **Rule sync**: Compliance rule updates
- **Result upload**: Check results and proofs
- **Offline mode**: 7-day offline autonomy

## Modules

| Module | Description |
|--------|-------------|
| `authenticated_client` | mTLS HTTP client with auto-refresh |
| `config_sync` | Server configuration synchronization |
| `credentials` | Secure credential storage |
| `diagnostics` | Connection status and logging |
| `integrity` | Binary and config integrity verification |
| `offline` | Offline mode and sync queue |
| `pinning` | Certificate pinning with TOFU |
| `result_upload` | Check result batch upload |
| `rollout` | Canary deployment support |
| `rules` | Rule sync with ETag caching |
| `security` | Log signing and signature verification |
| `update` | Self-update orchestration |

## Security Features

### Certificate Pinning

Trust-on-first-use (TOFU) with backup pin support:

```rust
use agent_sync::CertificatePinning;

let pinning = CertificatePinning::from_fingerprints(vec![
    "sha256:ABC123...",
    "sha256:DEF456...", // Backup pin
]);
```

### Log Signing

HMAC-SHA256 log chain for tamper detection:

```rust
use agent_sync::LogSigner;

let signer = LogSigner::new(&key);
let entry = signer.sign("INFO", "core", "Agent started").await?;
```

### Signature Verification

Binary signature validation:

- Windows: Authenticode via PowerShell
- Linux/macOS: GPG detached signatures

## Offline Mode

The agent operates autonomously for up to 7 days offline:

- Results queued locally with exponential backoff retry
- Circuit breaker prevents overwhelming the server
- Automatic resync on reconnection
