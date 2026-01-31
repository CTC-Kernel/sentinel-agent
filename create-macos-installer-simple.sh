#!/bin/bash

# Sentinel GRC Agent - Simplified macOS Installer
# Creates a basic .pkg installer without complex distribution

set -e

# Configuration
VERSION="2.0.0"
PACKAGE_NAME="SentinelAgent"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
PKG_DIR="$SCRIPT_DIR/dist"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🍎 Creating Simplified macOS Installer${NC}"
echo -e "${BLUE}==================================${NC}"

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf "$BUILD_DIR" "$PKG_DIR"
mkdir -p "$BUILD_DIR" "$PKG_DIR"

# Create app bundle structure
echo -e "${YELLOW}Creating application bundle...${NC}"
APP_BUNDLE="$BUILD_DIR/$PACKAGE_NAME.app"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Copy binary
if [[ -f "$SCRIPT_DIR/target/release/agent-core" ]]; then
    cp "$SCRIPT_DIR/target/release/agent-core" "$APP_BUNDLE/Contents/MacOS/SentinelAgent"
    chmod +x "$APP_BUNDLE/Contents/MacOS/SentinelAgent"
    echo -e "${GREEN}✅ Binary copied to app bundle${NC}"
else
    echo -e "${RED}❌ Binary not found. Please build the agent first.${NC}"
    exit 1
fi

# Create Info.plist
cat > "$APP_BUNDLE/Contents/Info.plist" << EOF
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
    <key>CFBundleDisplayName</key>
    <string>Sentinel GRC Agent</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
    <key>NSRequiresAquaSystemAppearance</key>
    <false/>
</dict>
</plist>
EOF

# Create simple package
echo -e "${YELLOW}Creating package...${NC}"
cd "$BUILD_DIR"

# Create component package
pkgbuild \
    --root "$APP_BUNDLE" \
    --identifier "com.sentinel.agent" \
    --version "$VERSION" \
    --install-location "/Applications" \
    "SentinelAgent.pkg"

# Move to dist directory
mv "SentinelAgent.pkg" "$PKG_DIR/"

echo -e "${GREEN}✅ macOS package created: $PKG_DIR/SentinelAgent.pkg${NC}"

# Display package info
echo -e "${BLUE}Package Information:${NC}"
echo "File: $PKG_DIR/SentinelAgent.pkg"
echo "Size: $(du -h "$PKG_DIR/SentinelAgent.pkg" | cut -f1)"
echo "Version: $VERSION"

echo -e "${GREEN}🎉 Simplified macOS installer created successfully!${NC}"
echo -e "${BLUE}To install: sudo installer -pkg $PKG_DIR/SentinelAgent.pkg -target /${NC}"
