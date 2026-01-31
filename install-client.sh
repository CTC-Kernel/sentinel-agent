#!/bin/bash

# Sentinel GRC Agent - Client Installation Script
# Bypasses Apple signing/notarization issues for enterprise deployment

set -e

# Configuration
VERSION="2.0.0"
PACKAGE_NAME="SentinelAgent"
IDENTIFIER="com.sentinel.agent"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
DIST_DIR="$SCRIPT_DIR/dist"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🚀 Sentinel GRC Agent - Enterprise Installation${NC}"
echo -e "${CYAN}============================================${NC}"

# Check if running as root for system installation
if [[ $EUID -eq 0 ]]; then
    echo -e "${YELLOW}⚠️  Running as root - installing for all users${NC}"
    INSTALL_MODE="system"
else
    echo -e "${BLUE}👤 Running as user - installing for current user${NC}"
    INSTALL_MODE="user"
fi

# Function to create self-signed certificate
create_self_signed_cert() {
    echo -e "${YELLOW}🔐 Creating self-signed certificate...${NC}"
    
    # Create temporary directory for certificate
    CERT_DIR="$HOME/Library/Application Support/Sentinel GRC/certs"
    mkdir -p "$CERT_DIR"
    
    # Generate self-signed certificate
    if command -v openssl >/dev/null 2>&1; then
        openssl req -x509 -newkey rsa:2048 -keyout "$CERT_DIR/sentinel.key" -out "$CERT_DIR/sentinel.crt" -days 365 -nodes -subj "/C=FR/ST=State/L=City/O=Cyber Threat Consulting/OU=Security/CN=Sentinel GRC Agent" 2>/dev/null || {
            echo -e "${YELLOW}⚠️  OpenSSL not available, skipping certificate creation${NC}"
        }
    fi
}

# Function to remove quarantine attribute
remove_quarantine() {
    local file_path="$1"
    echo -e "${YELLOW}🔓 Removing quarantine attributes...${NC}"
    
    # Remove extended attributes that trigger Gatekeeper
    if command -v xattr >/dev/null 2>&1; then
        xattr -cr "$file_path" 2>/dev/null || true
        xattr -d com.apple.quarantine "$file_path" 2>/dev/null || true
    fi
}

# Function to install for current user
install_user_mode() {
    echo -e "${BLUE}👤 Installing in user mode...${NC}"
    
    USER_APPS="$HOME/Applications"
    mkdir -p "$USER_APPS"
    
    # Copy binary if it exists
    if [[ -f "$SCRIPT_DIR/target/release/agent-core" ]]; then
        mkdir -p "$USER_APPS/SentinelAgent.app/Contents/MacOS"
        cp "$SCRIPT_DIR/target/release/agent-core" "$USER_APPS/SentinelAgent.app/Contents/MacOS/SentinelAgent"
        chmod +x "$USER_APPS/SentinelAgent.app/Contents/MacOS/SentinelAgent"
        
        # Create Info.plist
        cat > "$USER_APPS/SentinelAgent.app/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>SentinelAgent</string>
    <key>CFBundleIdentifier</key>
    <string>$IDENTIFIER</string>
    <key>CFBundleName</key>
    <string>Sentinel Agent</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
EOF
        
        remove_quarantine "$USER_APPS/SentinelAgent.app"
        echo -e "${GREEN}✅ Application installed in $USER_APPS${NC}"
    else
        echo -e "${RED}❌ Binary not found. Please build the agent first.${NC}"
        exit 1
    fi
    
    # Create command line symlink
    mkdir -p "$HOME/.local/bin"
    ln -sf "$USER_APPS/SentinelAgent.app/Contents/MacOS/SentinelAgent" "$HOME/.local/bin/sentinel-agent"
    
    # Add to PATH if not already there
    if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bash_profile" 2>/dev/null || true
    fi
}

# Function to install in system mode
install_system_mode() {
    echo -e "${BLUE}🔧 Installing in system mode...${NC}"
    
    # Install to /Applications
    if [[ -f "$SCRIPT_DIR/target/release/agent-core" ]]; then
        mkdir -p "/Applications/SentinelAgent.app/Contents/MacOS"
        cp "$SCRIPT_DIR/target/release/agent-core" "/Applications/SentinelAgent.app/Contents/MacOS/SentinelAgent"
        chmod +x "/Applications/SentinelAgent.app/Contents/MacOS/SentinelAgent"
        
        # Create Info.plist
        cat > "/Applications/SentinelAgent.app/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>SentinelAgent</string>
    <key>CFBundleIdentifier</key>
    <string>$IDENTIFIER</string>
    <key>CFBundleName</key>
    <string>Sentinel Agent</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
EOF
        
        remove_quarantine "/Applications/SentinelAgent.app"
        echo -e "${GREEN}✅ Application installed in /Applications${NC}"
    else
        echo -e "${RED}❌ Binary not found. Please build the agent first.${NC}"
        exit 1
    fi
    
    # Create command line symlink
    mkdir -p "/usr/local/bin"
    ln -sf "/Applications/SentinelAgent.app/Contents/MacOS/SentinelAgent" "/usr/local/bin/sentinel-agent"
}

# Function to configure auto-start
configure_autostart() {
    echo -e "${YELLOW}🚀 Configuring auto-start...${NC}"
    
    if [[ "$INSTALL_MODE" == "user" ]]; then
        # User-level launch agent
        LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
        mkdir -p "$LAUNCH_AGENTS_DIR"
        
        cat > "$LAUNCH_AGENTS_DIR/com.sentinel.agent.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.sentinel.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$HOME/Applications/SentinelAgent.app/Contents/MacOS/SentinelAgent</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/SentinelAgent.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/SentinelAgent.error.log</string>
</dict>
</plist>
EOF
        
        # Load the launch agent
        launchctl load "$LAUNCH_AGENTS_DIR/com.sentinel.agent.plist" 2>/dev/null || true
        
    else
        # System-level launch daemon
        LAUNCH_DAEMONS_DIR="/Library/LaunchDaemons"
        mkdir -p "$LAUNCH_DAEMONS_DIR"
        
        cat > "$LAUNCH_DAEMONS_DIR/com.sentinel.agent.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.sentinel.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/SentinelAgent.app/Contents/MacOS/SentinelAgent</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/sentinel-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/sentinel-agent.error.log</string>
</dict>
</plist>
EOF
        
        # Load the launch daemon
        launchctl load "/Library/LaunchDaemons/com.sentinel.agent.plist" 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Auto-start configured${NC}"
}

# Function to create configuration
create_config() {
    echo -e "${YELLOW}⚙️  Creating configuration...${NC}"
    
    if [[ "$INSTALL_MODE" == "user" ]]; then
        CONFIG_DIR="$HOME/Library/Application Support/Sentinel GRC"
    else
        CONFIG_DIR="/Library/Application Support/Sentinel GRC"
    fi
    
    mkdir -p "$CONFIG_DIR"
    
    if [[ ! -f "$CONFIG_DIR/agent.json" ]]; then
        cat > "$CONFIG_DIR/agent.json" << EOF
{
    "server_url": "https://sentinel-grc-v2-prod.web.app",
    "check_interval_secs": 3600,
    "heartbeat_interval_secs": 60,
    "log_level": "info",
    "tls_verify": true,
    "data_dir": "$CONFIG_DIR",
    "installation_mode": "$INSTALL_MODE",
    "version": "$VERSION"
}
EOF
        
        if [[ "$INSTALL_MODE" == "user" ]]; then
            chmod 600 "$CONFIG_DIR/agent.json"
        else
            chmod 644 "$CONFIG_DIR/agent.json"
        fi
    fi
    
    echo -e "${GREEN}✅ Configuration created in $CONFIG_DIR${NC}"
}

# Function to verify installation
verify_installation() {
    echo -e "${YELLOW}🔍 Verifying installation...${NC}"
    
    if [[ "$INSTALL_MODE" == "user" ]]; then
        APP_PATH="$HOME/Applications/SentinelAgent.app"
        BINARY_PATH="$HOME/.local/bin/sentinel-agent"
    else
        APP_PATH="/Applications/SentinelAgent.app"
        BINARY_PATH="/usr/local/bin/sentinel-agent"
    fi
    
    # Check application
    if [[ -d "$APP_PATH" ]]; then
        echo -e "${GREEN}✅ Application installed: $APP_PATH${NC}"
    else
        echo -e "${RED}❌ Application not found${NC}"
        return 1
    fi
    
    # Check binary
    if [[ -L "$BINARY_PATH" ]]; then
        echo -e "${GREEN}✅ Command line tool: $BINARY_PATH${NC}"
    else
        echo -e "${YELLOW}⚠️  Command line tool not created${NC}"
    fi
    
    # Test binary execution
    if [[ -x "$APP_PATH/Contents/MacOS/SentinelAgent" ]]; then
        echo -e "${GREEN}✅ Binary is executable${NC}"
    else
        echo -e "${RED}❌ Binary is not executable${NC}"
        return 1
    fi
    
    return 0
}

# Main installation process
main() {
    echo -e "${CYAN}Starting Sentinel GRC Agent installation...${NC}"
    
    # Create self-signed certificate (optional)
    create_self_signed_cert
    
    # Install based on mode
    if [[ "$INSTALL_MODE" == "user" ]]; then
        install_user_mode
    else
        install_system_mode
    fi
    
    # Configure auto-start
    configure_autostart
    
    # Create configuration
    create_config
    
    # Verify installation
    if verify_installation; then
        echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
        
        # Show completion message
        echo -e "${BLUE}Installation Summary:${NC}"
        echo -e "${BLUE}• Mode: $INSTALL_MODE${NC}"
        if [[ "$INSTALL_MODE" == "user" ]]; then
            echo -e "${BLUE}• Application: $HOME/Applications/SentinelAgent.app${NC}"
            echo -e "${BLUE}• Command: $HOME/.local/bin/sentinel-agent${NC}"
        else
            echo -e "${BLUE}• Application: /Applications/SentinelAgent.app${NC}"
            echo -e "${BLUE}• Command: /usr/local/bin/sentinel-agent${NC}"
        fi
        echo -e "${BLUE}• Auto-start: Enabled${NC}"
        echo -e "${BLUE}• Logs: Available in system logs${NC}"
        
        echo -e "${CYAN}To start the agent: sentinel-agent --start${NC}"
        echo -e "${CYAN}To check status: sentinel-agent --status${NC}"
        echo -e "${CYAN}To stop the agent: sentinel-agent --stop${NC}"
        
    else
        echo -e "${RED}❌ Installation verification failed${NC}"
        exit 1
    fi
}

# Check for help flag
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Sentinel GRC Agent - Enterprise Installation Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h     Show this help message"
    echo "  --user         Force user mode installation"
    echo "  --system       Force system mode installation (requires sudo)"
    echo "  --no-autostart Skip auto-start configuration"
    echo ""
    echo "Examples:"
    echo "  $0                    # Auto-detect mode based on user"
    echo "  sudo $0 --system     # Force system installation"
    echo "  $0 --user            # Force user installation"
    exit 0
fi

# Parse command line arguments
if [[ "$1" == "--user" ]]; then
    INSTALL_MODE="user"
elif [[ "$1" == "--system" ]]; then
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}❌ System installation requires sudo${NC}"
        exit 1
    fi
    INSTALL_MODE="system"
fi

# Run main installation
main
