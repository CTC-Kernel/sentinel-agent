#!/bin/bash

# Sentinel GRC Agent - macOS Build Script
# Creates macOS app bundle and package

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
VERSION="2.0.0"
BUILD_DIR="target/release"
PACKAGE_DIR="dist/packages"

echo -e "${BLUE}🍎 Sentinel Agent macOS Build Script${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${YELLOW}⚠️  This script is designed to run on macOS only.${NC}"
    echo -e "${YELLOW}Current OS: $OSTYPE${NC}"
    exit 1
fi

# Navigate to sentinel-agent directory
cd "$(dirname "$0')"

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
cargo clean

# Build for macOS with all features
echo -e "${YELLOW}Building agent with GUI and tray features for macOS...${NC}"
cargo build --release --features "gui,tray"

# Create package directory
mkdir -p "$PACKAGE_DIR"

# Create macOS app bundle
echo -e "${YELLOW}Creating macOS app bundle...${NC}"
MACOS_APP="SentinelAgent.app"
MACOS_PACKAGE="sentinel-agent-${VERSION}-macos-x64.tar.gz"

# Clean previous app bundle
rm -rf "$MACOS_APP"

# Create app bundle structure
mkdir -p "$MACOS_APP/Contents/MacOS"
mkdir -p "$MACOS_APP/Contents/Resources"

# Copy binary
cp "$BUILD_DIR/agent-core" "$MACOS_APP/Contents/MacOS/SentinelAgent"
chmod +x "$MACOS_APP/Contents/MacOS/SentinelAgent"

# Create Info.plist
cat > "$MACOS_APP/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>SentinelAgent</string>
    <key>CFBundleIdentifier</key>
    <string>com.sentinel.agent</string>
    <key>CFBundleName</key>
    <string>Sentinel Agent</string>
    <key>CFBundleVersion</key>
    <string>${VERSION}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
</dict>
</plist>
EOF

# Create macOS installer script
cat > "install-sentinel-agent-macos.sh" << 'EOF'
#!/bin/bash

echo "Installing Sentinel GRC Agent for macOS..."

# Check if running with appropriate permissions
if [[ $EUID -ne 0 ]]; then
   echo "This script requires sudo privileges to install system-wide."
   echo "Please run with: sudo ./install-sentinel-agent-macos.sh"
   exit 1
fi

# Create application directory
mkdir -p "/Applications/Sentinel GRC"

# Copy app bundle
cp -r SentinelAgent.app "/Applications/Sentinel GRC/"

# Create symbolic link for command line usage
ln -sf "/Applications/Sentinel GRC/SentinelAgent.app/Contents/MacOS/SentinelAgent" /usr/local/bin/sentinel-agent

# Set proper permissions
chown -R root:wheel "/Applications/Sentinel GRC/SentinelAgent.app"
chmod +x "/Applications/Sentinel GRC/SentinelAgent.app/Contents/MacOS/SentinelAgent"

echo "Installation completed!"
echo ""
echo "Next steps:"
echo "1. Open SentinelAgent from Applications"
echo "2. Or run from terminal: sentinel-agent"
echo "3. Enroll with: sentinel-agent enroll --token YOUR_TOKEN"
echo ""
echo "The agent will start automatically and show in the menu bar."
EOF

chmod +x "install-sentinel-agent-macos.sh"

# Create tarball
echo -e "${YELLOW}Creating macOS package tarball...${NC}"
tar -czf "$PACKAGE_DIR/$MACOS_PACKAGE" \
    "$MACOS_APP" \
    install-sentinel-agent-macos.sh \
    README_INSTALLATION.md

# Create checksum
echo -e "${YELLOW}Creating checksum...${NC}"
cd "$PACKAGE_DIR"
sha256sum "$MACOS_PACKAGE" > "${MACOS_PACKAGE}.sha256"
cd - ..

# Display package information
echo ""
echo -e "${GREEN}🍎 macOS Package Summary${NC}"
echo -e "${GREEN}========================${NC}"
echo ""

if [[ -f "$PACKAGE_DIR/$MACOS_PACKAGE" ]]; then
    size=$(du -h "$PACKAGE_DIR/$MACOS_PACKAGE" | cut -f1)
    echo -e "${BLUE}$(basename "$PACKAGE_DIR/$MACOS_PACKAGE")${NC} - Size: $size"
fi

if [[ -f "$PACKAGE_DIR/${MACOS_PACKAGE}.sha256" ]]; then
    echo -e "${BLUE}$(basename "$PACKAGE_DIR/${MACOS_PACKAGE}.sha256")${NC} - Checksum"
fi

echo ""
echo -e "${YELLOW}Checksum:${NC}"
cat "$PACKAGE_DIR/${MACOS_PACKAGE}.sha256"

echo ""
echo -e "${GREEN}✅ macOS build completed!${NC}"
echo -e "${BLUE}Package available in: ${PACKAGE_DIR}${NC}"
echo ""
echo -e "${YELLOW}To install:${NC}"
echo "  tar -xzf ${PACKAGE_DIR}/$MACOS_PACKAGE"
echo "  sudo ./install-sentinel-agent-macos.sh"
echo ""
echo -e "${YELLOW}To run directly:${NC}"
echo "  open ${MACOS_APP}"
echo "  or: ${MACOS_APP}/Contents/MacOS/SentinelAgent"
