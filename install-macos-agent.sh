#!/bin/bash

# Sentinel GRC Agent - macOS Installation Helper
# Helps users bypass Gatekeeper warnings for legitimate installations

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🍎 Sentinel GRC Agent - macOS Installation Helper${NC}"
echo -e "${BLUE}===============================================${NC}"

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ This script is for macOS only${NC}"
    exit 1
fi

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    echo -e "${YELLOW}⚠️  Please run this script as a normal user, not as root${NC}"
    exit 1
fi

# Package info
PACKAGE_URL="https://sentinel-grc-a8701.web.app/downloads/agents/SentinelAgent-2.0.0.pkg"
PACKAGE_NAME="SentinelAgent-2.0.0.pkg"
DOWNLOAD_DIR="$HOME/Downloads"
PACKAGE_PATH="$DOWNLOAD_DIR/$PACKAGE_NAME"

echo -e "${YELLOW}📥 Downloading Sentinel GRC Agent...${NC}"

# Download the package
if [[ -f "$PACKAGE_PATH" ]]; then
    echo -e "${YELLOW}⚠️  Package already exists. Removing old version...${NC}"
    rm "$PACKAGE_PATH"
fi

curl -L -o "$PACKAGE_PATH" "$PACKAGE_URL"

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Package downloaded successfully${NC}"
else
    echo -e "${RED}❌ Failed to download package${NC}"
    exit 1
fi

echo -e "${YELLOW}🔍 Verifying package integrity...${NC}"

# Verify package
if pkgutil --expand "$PACKAGE_PATH" "/tmp/sentinel-verify" 2>/dev/null; then
    echo -e "${GREEN}✅ Package verification successful${NC}"
    rm -rf "/tmp/sentinel-verify"
else
    echo -e "${RED}❌ Package verification failed${NC}"
    exit 1
fi

echo -e "${YELLOW}🔓 Preparing installation (bypassing Gatekeeper)...${NC}"

# Remove quarantine attribute
xattr -d com.apple.quarantine "$PACKAGE_PATH" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Could not remove quarantine attribute (this is normal)${NC}"
}

echo -e "${YELLOW}🚀 Starting installation...${NC}"

# Install the package
sudo installer -pkg "$PACKAGE_PATH" -target /

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Installation completed successfully!${NC}"
else
    echo -e "${RED}❌ Installation failed${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Post-installation steps:${NC}"
echo -e "${YELLOW}1. Launch Sentinel Agent from Applications${NC}"
echo -e "${YELLOW}2. Get your enrollment token from: https://sentinel-grc-v2-prod.web.app${NC}"
echo -e "${YELLOW}3. Configure the agent with your token${NC}"

echo -e "${GREEN}🎉 Sentinel GRC Agent is now installed!${NC}"
echo -e "${BLUE}Documentation: https://docs.sentinel-grc.com${NC}"

# Ask if user wants to launch the agent
read -p "Do you want to launch Sentinel Agent now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "/Applications/SentinelAgent.app"
    echo -e "${GREEN}✅ Sentinel Agent launched${NC}"
fi

echo -e "${YELLOW}💡 Tip: The agent will start automatically on login if you chose that option during installation${NC}"
