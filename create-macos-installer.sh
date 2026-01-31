#!/bin/bash

# Sentinel GRC Agent - macOS Native Installer Script
# Creates a professional .pkg installer with native macOS interface

set -e

# Configuration
VERSION="2.0.0"
PACKAGE_NAME="SentinelAgent"
IDENTIFIER="com.sentinel.agent"
INSTALL_LOCATION="/Applications"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
PKG_DIR="$SCRIPT_DIR/dist"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🍎 Creating macOS Native Installer${NC}"
echo -e "${BLUE}=================================${NC}"

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf "$BUILD_DIR" "$PKG_DIR"
mkdir -p "$BUILD_DIR" "$PKG_DIR"

# Create app bundle structure
echo -e "${YELLOW}Creating application bundle...${NC}"
APP_BUNDLE="$BUILD_DIR/$PACKAGE_NAME.app"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"
mkdir -p "$APP_BUNDLE/Contents/Frameworks"

# Copy binary
if [[ -f "$SCRIPT_DIR/target/release/agent-core" ]]; then
    cp "$SCRIPT_DIR/target/release/agent-core" "$APP_BUNDLE/Contents/MacOS/SentinelAgent"
    chmod +x "$APP_BUNDLE/Contents/MacOS/SentinelAgent"
    echo -e "${GREEN}✅ Binary copied to app bundle${NC}"
else
    echo -e "${RED}❌ Binary not found. Please build the agent first.${NC}"
    exit 1
fi

# Create Info.plist for app bundle
cat > "$APP_BUNDLE/Contents/Info.plist" << EOF
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
    <key>CFBundleDisplayName</key>
    <string>Sentinel GRC Agent</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon.icns</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
    <key>NSRequiresAquaSystemAppearance</key>
    <false/>
    <key>LSBackgroundOnly</key>
    <false/>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
    </dict>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <string>NSPrivacyAccessedAPITypeSystemBootTime</string>
        <string>NSPrivacyAccessedAPITypeFileTimestamp</string>
        <string>NSPrivacyAccessedAPITypeNetwork</string>
        <string>NSPrivacyAccessedAPITypeSystemUptime</string>
    </array>
</dict>
</plist>
EOF

# Create app icon (simple placeholder)
echo -e "${YELLOW}Creating app icon...${NC}"
cat > "$APP_BUNDLE/Contents/Resources/icon.png" << 'EOF'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==
EOF
# This is a tiny transparent PNG - in production, you'd use a real icon

# Create distribution scripts
echo -e "${YELLOW}Creating distribution scripts...${NC}"

# Pre-install script
cat > "$BUILD_DIR/preinstall" << 'EOF'
#!/bin/bash

# Sentinel Agent Pre-install Script

# Check if older version exists
if [[ -d "/Applications/SentinelAgent.app" ]]; then
    echo "Removing previous installation..."
    rm -rf "/Applications/SentinelAgent.app"
fi

# Create directories
mkdir -p "/Library/Application Support/Sentinel GRC"
mkdir -p "/var/log/sentinel"

# Set permissions
chmod 755 "/Library/Application Support/Sentinel GRC"
chmod 755 "/var/log/sentinel"

exit 0
EOF

chmod +x "$BUILD_DIR/preinstall"

# Post-install script
cat > "$BUILD_DIR/postinstall" << 'POSTINSTALL'
#!/bin/bash

# Sentinel Agent Post-install Script

# Create symbolic link for command line usage
if [[ ! -L "/usr/local/bin/sentinel-agent" ]]; then
    mkdir -p "/usr/local/bin"
    ln -s "/Applications/SentinelAgent.app/Contents/MacOS/SentinelAgent" "/usr/local/bin/sentinel-agent"
fi

# Create default configuration
CONFIG_DIR="$HOME/Library/Application Support/Sentinel GRC"
mkdir -p "$CONFIG_DIR"

if [[ ! -f "$CONFIG_DIR/agent.json" ]]; then
    cat > "$CONFIG_DIR/agent.json" << 'CONFIG'
{
    "server_url": "https://sentinel-grc-v2-prod.web.app",
    "check_interval_secs": 3600,
    "heartbeat_interval_secs": 60,
    "log_level": "info",
    "tls_verify": true,
    "data_dir": "$HOME/Library/Application Support/Sentinel GRC"
}
CONFIG
    chmod 600 "$CONFIG_DIR/agent.json"
fi

# Ask user about auto-start
osascript << 'APPLESCRIPT'
tell application "System Events"
    set autoStart to button returned of (display dialog "Would you like Sentinel Agent to start automatically when you log in?" buttons {"No", "Yes"} default button "Yes")
end tell

if autoStart is "Yes" then
    do shell script "osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"/Applications/SentinelAgent.app\", hidden:false}'"
end if
APPLESCRIPT

echo "Installation completed successfully!"
exit 0
POSTINSTALL

chmod +x "$BUILD_DIR/postinstall"

# Create distribution definition
echo -e "${YELLOW}Creating distribution definition...${NC}"
cat > "$BUILD_DIR/distribution.xml" << 'DISTXML'
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="1.0">
    <title>Sentinel GRC Agent</title>
    <organization>Sentinel GRC</organization>
    <domains enable_anywhere="true" />
    
    <options rootVolumeOnly="false" />
    
    <welcome file="welcome.html" mime-type="text/html" />
    <license file="license.html" mime-type="text/html" />
    <conclusion file="conclusion.html" mime-type="text/html" />
    
    <background file="background.png" alignment="center" scaling="proportional" />
    
    <choices-outline>
        <line choice="sentinel_agent">
            <line choice="agent_app">
                <line choice="agent_cli" />
            </line>
        </line>
    </choices-outline>
    
    <choice id="sentinel_agent" title="Sentinel GRC Agent" description="Install Sentinel GRC Agent for endpoint compliance monitoring">
        <pkg-ref id="com.sentinel.agent.pkg"/>
    </choice>
    
    <choice id="agent_app" title="Application" description="Install the Sentinel Agent application">
        <pkg-ref id="com.sentinel.agent.app.pkg"/>
    </choice>
    
    <choice id="agent_cli" title="Command Line Tools" description="Install command line tools and symbolic links">
        <pkg-ref id="com.sentinel.agent.cli.pkg"/>
    </choice>
    
    <pkg-ref id="com.sentinel.agent.pkg" version="$VERSION" onConclusion="none">SentinelAgent.pkg</pkg-ref>
    <pkg-ref id="com.sentinel.agent.app.pkg" version="$VERSION" onConclusion="none">SentinelAgentApp.pkg</pkg-ref>
    <pkg-ref id="com.sentinel.agent.cli.pkg" version="$VERSION" onConclusion="none">SentinelAgentCLI.pkg</pkg-ref>
</installer-gui-script>
DISTXML

# Create welcome HTML
cat > "$BUILD_DIR/welcome.html" << 'WELCOMEHTML'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Welcome</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .icon { font-size: 48px; color: #007AFF; }
        h1 { color: #1d1d1f; margin-bottom: 10px; }
        .features { margin: 20px 0; }
        .feature { margin: 10px 0; padding-left: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="icon">🛡️</div>
        <h1>Welcome to Sentinel GRC Agent</h1>
        <p>Endpoint compliance monitoring for the Sentinel GRC platform</p>
    </div>
    
    <div class="features">
        <h3>This installer will:</h3>
        <div class="feature">✓ Install the Sentinel Agent application</div>
        <div class="feature">✓ Set up system integration and auto-start</div>
        <div class="feature">✓ Configure command line tools</div>
        <div class="feature">✓ Create desktop shortcuts</div>
        <div class="feature">✓ Set up secure configuration</div>
    </div>
    
    <div class="footer">
        <p>Version 2.0.0 | © 2024-2026 Cyber Threat Consulting</p>
    </div>
</body>
</html>
WELCOMEHTML

# License HTML
cat > "$BUILD_DIR/license.html" << 'LICENSEHTML'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>License Agreement</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        h1 { color: #1d1d1f; margin-bottom: 10px; }
        .license { background: #f5f5f7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .license pre { white-space: pre-wrap; font-family: monospace; font-size: 12px; }
        .footer { text-align: center; margin-top: 30px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>License Agreement</h1>
        <p>Sentinel GRC Agent - Software License Agreement</p>
    </div>
    
    <div class="license">
        <pre>Copyright © 2024-2026 Cyber Threat Consulting

IMPORTANT NOTICE: This software is provided 'as-is', without warranty of any kind. 
By installing this software, you agree to:

1. Use the software only for legitimate security monitoring purposes
2. Not reverse engineer or modify the software
3. Comply with all applicable laws and regulations
4. Not use the software for any malicious purposes

Full terms available at: https://sentinel-grc-v2-prod.web.app/terms

This software collects system information for compliance monitoring purposes.
By continuing, you consent to this data collection and processing.</pre>
    </div>
    
    <div class="footer">
        <p>By clicking "Continue" you accept the terms of this agreement.</p>
    </div>
</body>
</html>
LICENSEHTML

# Conclusion HTML
cat > "$BUILD_DIR/conclusion.html" << 'CONCLUSIONHTML'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Installation Complete</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .icon { font-size: 48px; color: #34C759; }
        h1 { color: #1d1d1f; margin-bottom: 10px; }
        .info { background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007AFF; }
        .next-steps { margin: 20px 0; }
        .step { margin: 10px 0; padding-left: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="icon">✅</div>
        <h1>Installation Complete!</h1>
        <p>Sentinel GRC Agent has been successfully installed</p>
    </div>
    
    <div class="info">
        <strong>Installation Location:</strong> /Applications/SentinelAgent.app<br>
        <strong>Command Line:</strong> sentinel-agent<br>
        <strong>Configuration:</strong> ~/Library/Application Support/Sentinel GRC/
    </div>
    
    <div class="next-steps">
        <h3>Next Steps:</h3>
        <div class="step">1. Launch Sentinel Agent from Applications</div>
        <div class="step">2. Get your enrollment token from the Sentinel GRC dashboard</div>
        <div class="step">3. Enroll the agent using the GUI or command line</div>
        <div class="step">4. Monitor compliance from your Sentinel GRC dashboard</div>
    </div>
    
    <div class="footer">
        <p>Thank you for choosing Sentinel GRC Agent!</p>
        <p>Documentation: https://docs.sentinel-grc.com</p>
    </div>
</body>
</html>
CONCLUSIONHTML

# Create background image (simple gradient)
echo -e "${YELLOW}Creating background image...${NC}"
cat > "$BUILD_DIR/background.png" << 'EOF'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==
EOF

# Build the package
echo -e "${YELLOW}Building macOS package...${NC}"
cd "$BUILD_DIR"

# Create component package
pkgbuild \
    --root "$APP_BUNDLE" \
    --identifier "$IDENTIFIER.app" \
    --version "$VERSION" \
    --install-location "$INSTALL_LOCATION" \
    --scripts "$BUILD_DIR" \
    --preserve-xattr \
    "SentinelAgentApp.pkg"

# Create product archive
productbuild \
    --distribution "$BUILD_DIR/distribution.xml" \
    --resources "$BUILD_DIR" \
    --package-path "$BUILD_DIR" \
    "$PKG_DIR/SentinelAgent-$VERSION.pkg"

echo -e "${GREEN}✅ macOS package created: $PKG_DIR/SentinelAgent-$VERSION.pkg${NC}"

# Display package info
echo -e "${BLUE}Package Information:${NC}"
echo "File: $PKG_DIR/SentinelAgent-$VERSION.pkg"
echo "Size: $(du -h "$PKG_DIR/SentinelAgent-$VERSION.pkg" | cut -f1)"
echo "Version: $VERSION"
echo "Identifier: $IDENTIFIER"

# Verify package
echo -e "${YELLOW}Verifying package...${NC}"
pkgutil --expand "$PKG_DIR/SentinelAgent-$VERSION.pkg" "$BUILD_DIR/expanded"

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Package verification successful${NC}"
    rm -rf "$BUILD_DIR/expanded"
else
    echo -e "${RED}❌ Package verification failed${NC}"
fi

echo -e "${GREEN}🎉 macOS native installer created successfully!${NC}"
echo -e "${BLUE}To install: sudo installer -pkg $PKG_DIR/SentinelAgent-$VERSION.pkg -target /${NC}"
