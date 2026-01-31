# Sentinel GRC Agent - Installation Guide

## 📦 Package Contents

The Sentinel Agent package includes:

- **sentinel-agent**: Main agent binary with GUI and tray support
- **Configuration files**: Default configuration and systemd service
- **Installation script**: Automated setup with all dependencies

## 🚀 Quick Installation (Recommended)

### Prerequisites
- Ubuntu 20.04+ / Debian 11+ / RHEL 8+ / CentOS 8+
- Root/sudo access
- Internet connection for enrollment

### Step 1: Download Package
```bash
# Download the appropriate package for your architecture
wget https://releases.sentinel-grc.com/sentinel-agent_2.0.0-1_amd64.deb  # Intel/AMD
# or
wget https://releases.sentinel-grc.com/sentinel-agent_2.0.0-1_arm64.deb  # ARM64
```

### Step 2: Run Installation Script
```bash
# Make the script executable and run it
chmod +x install-sentinel-agent.sh
sudo ./install-sentinel-agent.sh
```

### Step 3: Enroll the Agent
```bash
# Get your enrollment token from the Sentinel GRC dashboard
sudo -u sentinel /opt/sentinel-grc/bin/sentinel-agent enroll --token YOUR_ENROLLMENT_TOKEN
```

## 🔧 Manual Installation

### Step 1: Install Dependencies
```bash
sudo apt-get update
sudo apt-get install -y libssl3 libgcc-s1 libc6 libstdc++6 systemd curl wget
```

### Step 2: Install Package
```bash
sudo dpkg -i sentinel-agent_2.0.0-1_amd64.deb
sudo apt-get install -f  # Fix any missing dependencies
```

### Step 3: Create Configuration
```bash
sudo mkdir -p /etc/sentinel
sudo tee /etc/sentinel/agent.json > /dev/null <<EOF
{
    "server_url": "https://sentinel-grc-v2-prod.web.app",
    "check_interval_secs": 3600,
    "heartbeat_interval_secs": 60,
    "log_level": "info",
    "tls_verify": true,
    "data_dir": "/var/lib/sentinel"
}
EOF
sudo chmod 600 /etc/sentinel/agent.json
```

### Step 4: Setup Service
```bash
sudo systemctl enable sentinel-agent
sudo systemctl start sentinel-agent
```

### Step 5: Enroll Agent
```bash
sudo -u sentinel /opt/sentinel-grc/bin/sentinel-agent enroll --token YOUR_TOKEN
```

## 🖥️ GUI Mode (Desktop)

For desktop environments, you can run the agent with GUI:

```bash
# Run with GUI and tray icon
/opt/sentinel-grc/bin/sentinel-agent

# Or run in background
/opt/sentinel-grc/bin/sentinel-agent &
```

The GUI provides:
- **Dashboard**: Real-time compliance status
- **Enrollment**: Easy token-based enrollment
- **Configuration**: Interactive settings management
- **Logs**: Live log viewing
- **Network Discovery**: Visual network mapping

## 🖥️ Headless Mode (Servers)

For servers, run in headless mode:

```bash
# Run without GUI (server mode)
/opt/sentinel-grc/bin/sentinel-agent run --no-tray

# Or run as service (default)
sudo systemctl start sentinel-agent
```

## 📊 Verification

### Check Service Status
```bash
systemctl status sentinel-agent
```

### View Logs
```bash
# Real-time logs
journalctl -u sentinel-agent -f

# Recent logs
journalctl -u sentinel-agent --since "1 hour ago"
```

### Check Agent Health
```bash
# Check if agent is enrolled and running
sudo -u sentinel /opt/sentinel-grc/bin/sentinel-agent status
```

## 🔍 Troubleshooting

### Service Won't Start
```bash
# Check service logs
journalctl -u sentinel-agent -n 50

# Check configuration
sudo -u sentinel /opt/sentinel-grc/bin/sentinel-agent --config /etc/sentinel/agent.json status
```

### Enrollment Issues
```bash
# Test enrollment manually
sudo -u sentinel /opt/sentinel-grc/bin/sentinel-agent enroll --token YOUR_TOKEN

# Check network connectivity
curl -I https://sentinel-grc-v2-prod.web.app
```

### Permission Issues
```bash
# Fix permissions
sudo chown -R sentinel:sentinel /var/lib/sentinel
sudo chown -R sentinel:sentinel /var/log/sentinel
sudo chmod 600 /etc/sentinel/agent.json
```

## 🔄 Updates

### Update Agent
```bash
# Stop service
sudo systemctl stop sentinel-agent

# Install new package
sudo dpkg -i sentinel-agent_NEW_VERSION.deb

# Start service
sudo systemctl start sentinel-agent
```

### Update Configuration
```bash
# Edit configuration
sudo nano /etc/sentinel/agent.json

# Reload service
sudo systemctl reload sentinel-agent
```

## 🗑️ Uninstallation

### Complete Removal
```bash
# Stop and disable service
sudo systemctl stop sentinel-agent
sudo systemctl disable sentinel-agent

# Remove package
sudo apt-get remove --purge sentinel-agent

# Remove data (optional)
sudo rm -rf /opt/sentinel-grc
sudo rm -rf /etc/sentinel
sudo rm -rf /var/lib/sentinel
sudo rm -rf /var/log/sentinel

# Remove user
sudo userdel sentinel
```

### Keep Configuration
```bash
# Remove package but keep data
sudo apt-get remove sentinel-agent
```

## 📋 Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `server_url` | `https://sentinel-grc-v2-prod.web.app` | Sentinel GRC server URL |
| `check_interval_secs` | `3600` | Compliance check interval (1 hour) |
| `heartbeat_interval_secs` | `60` | Heartbeat interval (1 minute) |
| `log_level` | `info` | Logging level (trace, debug, info, warn, error) |
| `tls_verify` | `true` | Verify TLS certificates |
| `data_dir` | `/var/lib/sentinel` | Data storage directory |

## 🔐 Security Features

- **Encrypted Storage**: All local data encrypted with SQLiteCipher
- **Certificate Authentication**: mTLS for server communication
- **Principle of Least Privilege**: Runs as dedicated non-root user
- **Systemd Hardening**: Security restrictions and resource limits
- **Audit Logging**: All operations logged for compliance

## 📞 Support

- **Documentation**: https://docs.sentinel-grc.com
- **Issues**: https://github.com/sentinel-grc/agent/issues
- **Community**: https://community.sentinel-grc.com
- **Support**: support@sentinel-grc.com

---

**© 2024-2026 Cyber Threat Consulting. All rights reserved.**
