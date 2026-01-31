#!/bin/bash

# Sentinel GRC Agent - Build and Package Script
# Creates complete installation packages for multiple architectures

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

echo -e "${BLUE}🏗️  Sentinel Agent Build & Package Script${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
cargo clean

# Build for current platform (with all features)
echo -e "${YELLOW}Building agent with GUI and tray features...${NC}"
cargo build --release --features "gui,tray"

# Create package directory
mkdir -p "$PACKAGE_DIR"

# Package information
echo -e "${YELLOW}Creating packages...${NC}"

# Get current architecture
CURRENT_ARCH=$(dpkg --print-architecture 2>/dev/null || echo "amd64")
echo -e "${YELLOW}Current architecture: ${CURRENT_ARCH}${NC}"

# Copy binary to package location
cp "$BUILD_DIR/agent-core" "sentinel-agent"

# Create Debian package
echo -e "${YELLOW}Creating Debian package...${NC}"
cargo deb --no-strip

# Move package to dist directory
if [[ -f "target/debian/sentinel-agent_${VERSION}-1_${CURRENT_ARCH}.deb" ]]; then
    mv "target/debian/sentinel-agent_${VERSION}-1_${CURRENT_ARCH}.deb" "$PACKAGE_DIR/"
    echo -e "${GREEN}✅ Debian package created: ${PACKAGE_DIR}/sentinel-agent_${VERSION}-1_${CURRENT_ARCH}.deb${NC}"
fi

# Create tarball for other Linux distributions
echo -e "${YELLOW}Creating tarball package...${NC}"
TAR_PACKAGE="sentinel-agent-${VERSION}-${CURRENT_ARCH}.tar.gz"

# Create tarball with binary and scripts
tar -czf "$PACKAGE_DIR/$TAR_PACKAGE" \
    sentinel-agent \
    install-sentinel-agent.sh \
    README_INSTALLATION.md

echo -e "${GREEN}✅ Tarball created: ${PACKAGE_DIR}/$TAR_PACKAGE${NC}"

# Create ZIP for Windows (cross-compilation if available)
echo -e "${YELLOW}Creating Windows package...${NC}"
if command -v x86_64-pc-windows-gnu-gcc &> /dev/null; then
    # Cross-compile for Windows
    cargo build --release --target x86_64-pc-windows-gnu --features "gui,tray"
    
    # Create Windows package
    WINDOWS_PACKAGE="sentinel-agent-${VERSION}-windows-x64.zip"
    cp "target/x86_64-pc-windows-gnu/release/agent-core.exe" "sentinel-agent.exe"
    
    # Create Windows installer script
    cat > "install-sentinel-agent.bat" << 'EOF'
@echo off
echo Installing Sentinel GRC Agent...

REM Create installation directory
if not exist "C:\Program Files\Sentinel GRC" mkdir "C:\Program Files\Sentinel GRC"

REM Copy agent binary
copy "sentinel-agent.exe" "C:\Program Files\Sentinel GRC\"

REM Create service (requires administrator)
sc create "SentinelAgent" binPath= "C:\Program Files\Sentinel GRC\sentinel-agent.exe run --no-tray" start= auto

echo Installation completed!
echo.
echo Next steps:
echo 1. Run: sentinel-agent.exe enroll --token YOUR_TOKEN
echo 2. Start service: net start SentinelAgent
echo.
pause
EOF

    zip "$PACKAGE_DIR/$WINDOWS_PACKAGE" \
        sentinel-agent.exe \
        install-sentinel-agent.bat \
        README_INSTALLATION.md
    
    echo -e "${GREEN}✅ Windows package created: ${PACKAGE_DIR}/$WINDOWS_PACKAGE${NC}"
else
    echo -e "${YELLOW}⚠️  Windows cross-compilation not available. Install rustup target: rustup target add x86_64-pc-windows-gnu${NC}"
fi

# Create macOS package (if on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}Creating macOS package...${NC}"
    
    # Create macOS app bundle
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
</dict>
</plist>
EOF
    
    # Create macOS installer script
    cat > "install-sentinel-agent-macos.sh" << 'EOF'
#!/bin/bash

echo "Installing Sentinel GRC Agent for macOS..."

# Create application directory
sudo mkdir -p "/Applications/Sentinel GRC"

# Copy app bundle
sudo cp -r SentinelAgent.app "/Applications/Sentinel GRC/"

# Create symbolic link for command line usage
sudo ln -sf "/Applications/Sentinel GRC/SentinelAgent.app/Contents/MacOS/SentinelAgent" /usr/local/bin/sentinel-agent

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
    tar -czf "$PACKAGE_DIR/$MACOS_PACKAGE" \
        "$MACOS_APP" \
        install-sentinel-agent-macos.sh \
        README_INSTALLATION.md
    
    echo -e "${GREEN}✅ macOS package created: ${PACKAGE_DIR}/$MACOS_PACKAGE${NC}"
fi

# Create checksums
echo -e "${YELLOW}Creating checksums...${NC}"
cd "$PACKAGE_DIR"
sha256sum * > SHA256SUMS
cd - ..

# Display package information
echo ""
echo -e "${GREEN}📦 Package Summary${NC}"
echo -e "${GREEN}==================${NC}"
echo ""

for file in "$PACKAGE_DIR"/*; do
    if [[ -f "$file" ]]; then
        size=$(du -h "$file" | cut -f1)
        echo -e "${BLUE}$(basename "$file")${NC} - Size: $size"
    fi
done

echo ""
echo -e "${YELLOW}Checksums:${NC}"
cat "$PACKAGE_DIR/SHA256SUMS"

echo ""
echo -e "${GREEN}✅ Build and packaging completed!${NC}"
echo -e "${BLUE}Packages are available in: ${PACKAGE_DIR}${NC}"
echo ""
echo -e "${YELLOW}To install:${NC}"
echo "  Debian/Ubuntu: sudo dpkg -i ${PACKAGE_DIR}/sentinel-agent_${VERSION}-1_${CURRENT_ARCH}.deb"
echo "  Other Linux:  tar -xzf ${PACKAGE_DIR}/sentinel-agent-${VERSION}-${CURRENT_ARCH}.tar.gz && sudo ./install-sentinel-agent.sh"
echo "  macOS:        tar -xzf ${PACKAGE_DIR}/sentinel-agent-${VERSION}-macos-x64.tar.gz && ./install-sentinel-agent-macos.sh"
echo "  Windows:      Extract ${PACKAGE_DIR}/sentinel-agent-${VERSION}-windows-x64.zip and run install-sentinel-agent.bat"
