# Sentinel GRC Agent Configuration

This directory contains example configuration files for the Sentinel GRC Agent.

## Configuration Files

- `agent.example.json` - Minimal configuration example
- `agent.full.example.json` - Full configuration with all options

## Platform-Specific Paths

The agent automatically determines paths based on the operating system:

### Windows

| Path Type | Location |
|-----------|----------|
| Config File | `C:\ProgramData\Sentinel\agent.json` |
| Database | `C:\ProgramData\Sentinel\data\agent.db` |
| Logs | `C:\ProgramData\Sentinel\logs\` |

### Linux

| Path Type | Location |
|-----------|----------|
| Config File | `/etc/sentinel/agent.json` |
| Database | `/var/lib/sentinel-grc/agent.db` |
| Logs | `/var/log/sentinel-grc/` |

### macOS

| Path Type | Location |
|-----------|----------|
| Config File | `~/Library/Application Support/SentinelGRC/agent.json` |
| Database | `~/Library/Application Support/SentinelGRC/agent.db` |
| Logs | `~/Library/Application Support/SentinelGRC/logs/` |

## Environment Variables

All configuration values can be overridden via environment variables with the `SENTINEL_` prefix:

| Environment Variable | Config Field | Example |
|---------------------|--------------|---------|
| `SENTINEL_SERVER_URL` | `server_url` | `https://app.cyber-threat-consulting.com` |
| `SENTINEL_CHECK_INTERVAL_SECS` | `check_interval_secs` | `3600` |
| `SENTINEL_LOG_LEVEL` | `log_level` | `debug` |
| `SENTINEL_PROXY_URL` | `proxy.url` | `http://proxy:8080` |
| `SENTINEL_PROXY_USERNAME` | `proxy.username` | `user` |
| `SENTINEL_VULNERABILITY_SCAN_INTERVAL_SECS` | `vulnerability_scan_interval_secs` | `21600` |
| `SENTINEL_SECURITY_SCAN_INTERVAL_SECS` | `security_scan_interval_secs` | `300` |
| `SENTINEL_HEARTBEAT_INTERVAL_SECS` | `heartbeat_interval_secs` | `60` |

## Configuration Priority

Configuration is loaded in this order (later sources override earlier):

1. **Default values** - Hardcoded sensible defaults
2. **JSON file** - Platform-specific path or custom path
3. **Environment variables** - `SENTINEL_*` prefix

## Development Mode

For development, place `agent.json` in the current working directory. The agent will use this file if no system-level configuration exists.
