#!/bin/bash

# Sentinel GRC Agent - One-Click Client Deployment
# Complete bypass of Apple signing/notarization for enterprise clients

set -e

# Configuration
VERSION="2.0.0"
PACKAGE_NAME="SentinelAgent"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}🚀 Sentinel GRC Agent - One-Click Enterprise Deployment${NC}"
echo -e "${BOLD}${CYAN}========================================================${NC}"

# Function to disable Gatekeeper temporarily
disable_gatekeeper() {
    echo -e "${YELLOW}🔓 Temporarily disabling Gatekeeper...${NC}"
    
    # Check if running as admin
    if [[ $EUID -eq 0 ]]; then
        # Disable Gatekeeper for this session
        spctl --master-disable 2>/dev/null || {
            echo -e "${YELLOW}⚠️  Could not disable Gatekeeper (may already be disabled)${NC}"
        }
        
        # Allow apps from anywhere
        sudo spctl --global-disable 2>/dev/null || true
        
        echo -e "${GREEN}✅ Gatekeeper bypassed for this session${NC}"
    else
        echo -e "${BLUE}ℹ️  Running in user mode - Gatekeeper will be handled at app level${NC}"
    fi
}

# Function to re-enable Gatekeeper
reenable_gatekeeper() {
    if [[ $EUID -eq 0 ]]; then
        echo -e "${YELLOW}🔒 Re-enabling Gatekeeper...${NC}"
        spctl --master-enable 2>/dev/null || {
            echo -e "${YELLOW}⚠️  Could not re-enable Gatekeeper${NC}"
        }
        echo -e "${GREEN}✅ Gatekeeper re-enabled${NC}"
    fi
}

# Function to create portable installation
create_portable_install() {
    echo -e "${BLUE}📦 Creating portable installation...${NC}"
    
    PORTABLE_DIR="$HOME/Desktop/SentinelAgent_Portable"
    mkdir -p "$PORTABLE_DIR"
    
    # Copy binary
    if [[ -f "$SCRIPT_DIR/target/release/agent-core" ]]; then
        cp "$SCRIPT_DIR/target/release/agent-core" "$PORTABLE_DIR/SentinelAgent"
        chmod +x "$PORTABLE_DIR/SentinelAgent"
        
        # Create launcher script
        cat > "$PORTABLE_DIR/Start Sentinel Agent.command" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./SentinelAgent --start
echo "Sentinel Agent started. Check logs for status."
read -p "Press Enter to continue..."
EOF
        chmod +x "$PORTABLE_DIR/Start Sentinel Agent.command"
        
        # Create stopper script
        cat > "$PORTABLE_DIR/Stop Sentinel Agent.command" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./SentinelAgent --stop
echo "Sentinel Agent stopped."
read -p "Press Enter to continue..."
EOF
        chmod +x "$PORTABLE_DIR/Stop Sentinel Agent.command"
        
        # Create configuration
        cat > "$PORTABLE_DIR/config.json" << EOF
{
    "server_url": "https://sentinel-grc-v2-prod.web.app",
    "check_interval_secs": 3600,
    "heartbeat_interval_secs": 60,
    "log_level": "info",
    "tls_verify": true,
    "data_dir": "$(dirname "$0")/data",
    "portable": true,
    "version": "$VERSION"
}
EOF
        
        # Create README
        cat > "$PORTABLE_DIR/README.txt" << EOF
Sentinel GRC Agent - Portable Version
=====================================

This is a portable installation of Sentinel GRC Agent that doesn't require
system installation or administrator privileges.

Files:
- SentinelAgent: Main application binary
- Start Sentinel Agent.command: Launch the agent
- Stop Sentinel Agent.command: Stop the agent
- config.json: Configuration file
- data/: Data directory (created automatically)

Usage:
1. Double-click "Start Sentinel Agent.command" to start
2. Double-click "Stop Sentinel Agent.command" to stop
3. Check the terminal output for status

This portable version runs entirely from this folder and doesn't install
anything to system directories.

For advanced usage, run from Terminal:
./SentinelAgent --help
EOF
        
        echo -e "${GREEN}✅ Portable installation created: $PORTABLE_DIR${NC}"
        return 0
    else
        echo -e "${RED}❌ Binary not found. Please build the agent first.${NC}"
        return 1
    fi
}

# Function to bypass quarantine for existing files
bypass_quarantine() {
    local file_path="$1"
    echo -e "${YELLOW}🔓 Bypassing quarantine for: $file_path${NC}"
    
    # Remove all extended attributes
    if command -v xattr >/dev/null 2>&1; then
        xattr -cr "$file_path" 2>/dev/null || true
        xattr -d com.apple.quarantine "$file_path" 2>/dev/null || true
        xattr -d com.apple.macl "$file_path" 2>/dev/null || true
    fi
    
    # Set execution permissions
    chmod +x "$file_path" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Quarantine bypassed${NC}"
}

# Function to install with full bypass
install_full_bypass() {
    echo -e "${CYAN}🚀 Installing with full Gatekeeper bypass...${NC}"
    
    # Temporarily disable Gatekeeper
    disable_gatekeeper
    
    # Install using the client script
    if [[ -f "$SCRIPT_DIR/install-client.sh" ]]; then
        echo -e "${BLUE}📦 Running client installation...${NC}"
        
        if [[ $EUID -eq 0 ]]; then
            "$SCRIPT_DIR/install-client.sh" --system
        else
            "$SCRIPT_DIR/install-client.sh" --user
        fi
        
        # Bypass quarantine on installed app
        if [[ -d "/Applications/SentinelAgent.app" ]]; then
            bypass_quarantine "/Applications/SentinelAgent.app"
        elif [[ -d "$HOME/Applications/SentinelAgent.app" ]]; then
            bypass_quarantine "$HOME/Applications/SentinelAgent.app"
        fi
        
        echo -e "${GREEN}✅ Installation completed with bypass${NC}"
    else
        echo -e "${RED}❌ Client installer not found${NC}"
        return 1
    fi
    
    # Re-enable Gatekeeper
    reenable_gatekeeper
}

# Function to create self-extracting package
create_self_extracting() {
    echo -e "${BLUE}📦 Creating self-extracting package...${NC}"
    
    PACKAGE_DIR="$SCRIPT_DIR/SentinelAgent_SelfExtract"
    mkdir -p "$PACKAGE_DIR"
    
    # Copy files
    if [[ -f "$SCRIPT_DIR/target/release/agent-core" ]]; then
        cp "$SCRIPT_DIR/target/release/agent-core" "$PACKAGE_DIR/SentinelAgent"
        chmod +x "$PACKAGE_DIR/SentinelAgent"
        
        # Copy installer scripts
        cp "$SCRIPT_DIR/install-client.sh" "$PACKAGE_DIR/"
        cp "$SCRIPT_DIR/client-installer.applescript" "$PACKAGE_DIR/"
        
        # Create extraction script
        cat > "$PACKAGE_DIR/INSTALL.command" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 Sentinel GRC Agent - Self-Extracting Installer"
echo "================================================"

# Make scripts executable
chmod +x install-client.sh
chmod +x client-installer.applescript

# Run installer
echo "Starting installation..."
./install-client.sh

echo "Installation complete!"
read -p "Press Enter to exit..."
EOF
        chmod +x "$PACKAGE_DIR/INSTALL.command"
        
        # Create README
        cat > "$PACKAGE_DIR/README.txt" << EOF
Sentinel GRC Agent - Self-Extracting Package
============================================

This package contains everything needed to install Sentinel GRC Agent
without requiring Apple signing or notarization.

Installation:
1. Double-click "INSTALL.command"
2. Follow the on-screen instructions
3. The agent will be installed and configured

Alternative installation:
1. Open Terminal
2. Navigate to this folder
3. Run: ./install-client.sh

Files included:
- SentinelAgent: Main application binary
- install-client.sh: Installation script
- client-installer.applescript: GUI installer
- INSTALL.command: One-click installer

This package bypasses Apple's Gatekeeper for enterprise deployment.
EOF
        
        # Create archive
        cd "$SCRIPT_DIR"
        zip -r "SentinelAgent_SelfExtract_$VERSION.zip" "SentinelAgent_SelfExtract/"
        
        echo -e "${GREEN}✅ Self-extracting package created: SentinelAgent_SelfExtract_$VERSION.zip${NC}"
    else
        echo -e "${RED}❌ Binary not found. Please build the agent first.${NC}"
        return 1
    fi
}

# Function to show deployment options
show_deployment_options() {
    echo -e "${BOLD}${BLUE}🚀 Deployment Options:${NC}"
    echo ""
    echo -e "${YELLOW}1. Full Installation (Recommended)${NC}"
    echo "   - Installs to /Applications or ~/Applications"
    echo "   - Configures auto-start"
    echo "   - Creates command line tools"
    echo "   - Bypasses Gatekeeper temporarily"
    echo ""
    echo -e "${YELLOW}2. Portable Installation${NC}"
    echo "   - Runs from Desktop folder"
    echo "   - No system installation required"
    echo "   - No admin privileges needed"
    echo "   - Easy to remove"
    echo ""
    echo -e "${YELLOW}3. Self-Extracting Package${NC}"
    echo "   - Creates distributable .zip package"
    echo "   - Contains all necessary files"
    echo "   - One-click installation for clients"
    echo "   - Bypasses all Apple restrictions"
    echo ""
    echo -e "${YELLOW}4. GUI Installer${NC}"
    echo "   - User-friendly graphical interface"
    echo "   - Step-by-step installation"
    echo "   - Error handling and recovery"
    echo ""
    
    read -p "Choose deployment option (1-4): " choice
    
    case $choice in
        1)
            echo -e "${BLUE}Starting full installation...${NC}"
            install_full_bypass
            ;;
        2)
            echo -e "${BLUE}Creating portable installation...${NC}"
            create_portable_install
            ;;
        3)
            echo -e "${BLUE}Creating self-extracting package...${NC}"
            create_self_extracting
            ;;
        4)
            echo -e "${BLUE}Starting GUI installer...${NC}"
            if command -v osascript >/dev/null 2>&1; then
                osascript "$SCRIPT_DIR/client-installer.applescript"
            else
                echo -e "${RED}❌ osascript not available${NC}"
            fi
            ;;
        *)
            echo -e "${RED}❌ Invalid choice${NC}"
            exit 1
            ;;
    esac
}

# Check for help
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Sentinel GRC Agent - One-Click Enterprise Deployment"
    echo ""
    echo "This script provides multiple deployment options that bypass"
    echo "Apple signing and notarization requirements."
    echo ""
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  --help, -h        Show this help"
    echo "  --full            Full installation with Gatekeeper bypass"
    echo "  --portable        Create portable installation"
    echo "  --package         Create self-extracting package"
    echo "  --gui             Launch GUI installer"
    echo ""
    echo "Without arguments, shows deployment options menu."
    exit 0
fi

# Parse command line arguments
case "$1" in
    --full)
        install_full_bypass
        ;;
    --portable)
        create_portable_install
        ;;
    --package)
        create_self_extracting
        ;;
    --gui)
        if command -v osascript >/dev/null 2>&1; then
            osascript "$SCRIPT_DIR/client-installer.applescript"
        else
            echo -e "${RED}❌ osascript not available${NC}"
            exit 1
        fi
        ;;
    "")
        show_deployment_options
        ;;
    *)
        echo -e "${RED}❌ Unknown option: $1${NC}"
        echo "Use --help for available options"
        exit 1
        ;;
esac

echo -e "${BOLD}${GREEN}🎉 Deployment process completed!${NC}"
echo -e "${BLUE}Sentinel GRC Agent is ready for enterprise use.${NC}"
