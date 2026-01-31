#!/bin/bash

# Sentinel GRC Agent - Installation Script
# This script installs the Sentinel Agent with all dependencies and configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AGENT_VERSION="2.0.0"
SERVICE_NAME="sentinel-agent"
INSTALL_DIR="/opt/sentinel-grc"
CONFIG_DIR="/etc/sentinel"
LOG_DIR="/var/log/sentinel"
DATA_DIR="/var/lib/sentinel"

echo -e "${BLUE}🛡️  Sentinel GRC Agent Installation Script${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Detect architecture
ARCH=$(dpkg --print-architecture)
echo -e "${YELLOW}Detected architecture: ${ARCH}${NC}"

# Check if package exists
DEB_PACKAGE="sentinel-agent_${AGENT_VERSION}-1_${ARCH}.deb"
if [[ ! -f "$DEB_PACKAGE" ]]; then
    echo -e "${RED}Error: Package ${DEB_PACKAGE} not found!${NC}"
    echo "Please ensure the .deb package is in the current directory."
    exit 1
fi

echo -e "${YELLOW}Installing dependencies...${NC}"
apt-get update
apt-get install -y \
    libssl3 \
    libgcc-s1 \
    libc6 \
    libstdc++6 \
    systemd \
    curl \
    wget

echo -e "${YELLOW}Installing Sentinel Agent package...${NC}"
dpkg -i "$DEB_PACKAGE" || {
    echo -e "${YELLOW}Fixing potential dependencies...${NC}"
    apt-get install -f -y
    dpkg -i "$DEB_PACKAGE"
}

echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p "$CONFIG_DIR"
mkdir -p "$LOG_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$INSTALL_DIR/bin"

echo -e "${YELLOW}Setting up permissions...${NC}"
chmod 755 "$INSTALL_DIR/bin/sentinel-agent"
chmod 755 "$CONFIG_DIR"
chmod 755 "$LOG_DIR"
chmod 755 "$DATA_DIR"

echo -e "${YELLOW}Creating default configuration...${NC}"
cat > "$CONFIG_DIR/agent.json" << EOF
{
    "server_url": "https://sentinel-grc-v2-prod.web.app",
    "check_interval_secs": 3600,
    "heartbeat_interval_secs": 60,
    "log_level": "info",
    "tls_verify": true,
    "data_dir": "$DATA_DIR"
}
EOF

chmod 600 "$CONFIG_DIR/agent.json"

echo -e "${YELLOW}Setting up systemd service...${NC}"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Sentinel GRC Agent
Documentation=https://sentinel-grc-v2-prod.web.app
After=network.target

[Service]
Type=simple
User=sentinel
Group=sentinel
ExecStart=$INSTALL_DIR/bin/sentinel-agent run --no-tray
Restart=always
RestartSec=10
Environment=LOG_LEVEL=info
Environment=RUST_LOG=info

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$DATA_DIR $LOG_DIR $CONFIG_DIR
ProtectHome=true
RemoveIPC=true

# Resource limits
LimitNOFILE=65536
MemoryMax=512M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
EOF

echo -e "${YELLOW}Creating sentinel user...${NC}"
if ! id "sentinel" &>/dev/null; then
    useradd --system --home "$DATA_DIR" --shell /bin/false sentinel
fi

chown -R sentinel:sentinel "$DATA_DIR"
chown -R sentinel:sentinel "$LOG_DIR"
chown -R root:sentinel "$CONFIG_DIR"
chmod 750 "$CONFIG_DIR"

echo -e "${YELLOW}Setting up log rotation...${NC}"
cat > "/etc/logrotate.d/sentinel-agent" << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 sentinel sentinel
    postrotate
        systemctl reload ${SERVICE_NAME} > /dev/null 2>&1 || true
    endscript
}
EOF

echo -e "${YELLOW}Enabling and starting service...${NC}"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

echo -e "${YELLOW}Waiting for service to start...${NC}"
sleep 3

# Check service status
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✅ Sentinel Agent service is running!${NC}"
else
    echo -e "${RED}❌ Service failed to start. Checking logs...${NC}"
    journalctl -u "$SERVICE_NAME" --no-pager -l
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Get an enrollment token from your Sentinel GRC dashboard"
echo "2. Enroll the agent with: sudo -u sentinel $INSTALL_DIR/bin/sentinel-agent enroll --token YOUR_TOKEN"
echo "3. Check status with: systemctl status $SERVICE_NAME"
echo "4. View logs with: journalctl -u $SERVICE_NAME -f"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  Start service:   systemctl start $SERVICE_NAME"
echo "  Stop service:    systemctl stop $SERVICE_NAME"
echo "  Restart service: systemctl restart $SERVICE_NAME"
echo "  View status:     systemctl status $SERVICE_NAME"
echo "  View logs:       journalctl -u $SERVICE_NAME -f"
echo "  Enroll agent:    sudo -u sentinel $INSTALL_DIR/bin/sentinel-agent enroll --token TOKEN"
echo ""
echo -e "${GREEN}The Sentinel Agent is now ready to secure your endpoint!${NC}"
