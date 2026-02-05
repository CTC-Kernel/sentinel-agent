# agent-core

Core runtime for the Sentinel GRC Agent.

## Overview

This crate provides the main agent runtime, including:

- **Service management**: Windows Service and Linux systemd integration
- **Agent lifecycle**: Startup, shutdown, pause/resume operations
- **API client**: HTTP communication with the Sentinel GRC server
- **Resource monitoring**: CPU, memory, and disk usage tracking
- **System tray**: Desktop icon with status menu (macOS/Windows)
- **Self-protection**: Anti-tampering and integrity verification
- **Update manager**: Automatic agent updates

## Feature Flags

- `tray` (default): Enable system tray icon (tray-icon + muda + tao)
- `gui`: Enable v2 desktop GUI support (agent-gui + agent-persistence)

## Modules

| Module | Description |
|--------|-------------|
| `api_client` | HTTP client for server communication |
| `audit_trail` | Local audit logging with persistence |
| `cleanup` | Uninstallation and data cleanup |
| `events` | Event and notification management |
| `resources` | Resource monitoring and throttling |
| `self_protection` | Anti-tampering protection |
| `service` | Windows/Linux service management |
| `state` | Runtime state and flags |
| `tray` | System tray icon (feature-gated) |
| `update_manager` | Automatic update handling |

## Usage

```rust
use agent_core::{AgentRuntime, AgentConfig};

let config = AgentConfig::load()?;
let runtime = AgentRuntime::new(config);
runtime.run().await?;
```

## Architecture

The `AgentRuntime` struct is the main entry point. It coordinates:

1. **Initialization**: Load config, initialize database, create API client
2. **Enrollment**: Register with server or restore existing credentials
3. **Main loop**: Heartbeat, compliance checks, sync operations
4. **Shutdown**: Graceful termination with cleanup

## Security

- All server communication uses TLS with certificate pinning
- Credentials are encrypted at rest (DPAPI on Windows, file permissions on Unix)
- Self-protection prevents tampering with agent binaries and config
