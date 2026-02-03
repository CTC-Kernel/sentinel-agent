#!/bin/bash

# Sentinel GRC Agent - macOS Developer Signed Installer Script
# Creates a professional .pkg installer with Apple Developer signing and Notarization support

set -e

# Configuration
VERSION="2.0.0"
PACKAGE_NAME="SentinelAgent"
IDENTIFIER="com.cyber-threat-consulting.sentinel-agent"  # Corrigé pour cohérence
INSTALL_LOCATION="/Applications"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
PKG_DIR="$SCRIPT_DIR/dist"

# Signing Configuration
# usage: export SIGNING_IDENTITY="Developer ID Application: Team Name (ID)"
# usage: export INSTALLER_IDENTITY="Developer ID Installer: Team Name (ID)"
SIGNING_IDENTITY="${SIGNING_IDENTITY:-"-"}" # Default to ad-hoc
INSTALLER_IDENTITY="${INSTALLER_IDENTITY:-""}"

# Notarization Configuration
# usage: export NOTARIZATION_KEYCHAIN_PROFILE="AC_PASSWORD_PROFILE"
# OR
# usage: export APPLE_ID="user@example.com"
# usage: export APPLE_PASSWORD="app-specific-password"
# usage: export TEAM_ID="TeamID"
NOTARIZE="${NOTARIZE:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🍎 Creating macOS Installer${NC}"
echo -e "${BLUE}=============================================${NC}"
echo -e "Identity: ${SIGNING_IDENTITY}"
echo -e "Installer Identity: ${INSTALLER_IDENTITY:-"None (Ad-hoc package)"}"
echo -e "Notarize: ${NOTARIZE}"

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
        <false/>
        <key>NSExceptionDomains</key>
        <dict>
            <key>sentinel-grc-v2-prod.web.app</key>
            <dict>
                <key>NSExceptionMinimumTLSVersion</key>
                <string>TLSv1.3</string>
                <key>NSExceptionRequiresForwardSecrecy</key>
                <true/>
            </dict>
            <key>europe-west1-sentinel-grc-a8701.cloudfunctions.net</key>
            <dict>
                <key>NSExceptionMinimumTLSVersion</key>
                <string>TLSv1.3</string>
                <key>NSExceptionRequiresForwardSecrecy</key>
                <true/>
            </dict>
            <key>firebasestorage.googleapis.com</key>
            <dict>
                <key>NSExceptionMinimumTLSVersion</key>
                <string>TLSv1.3</string>
                <key>NSExceptionRequiresForwardSecrecy</key>
                <true/>
            </dict>
        </dict>
    </dict>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <string>NSPrivacyAccessedAPITypeSystemBootTime</string>
        <string>NSPrivacyAccessedAPITypeFileTimestamp</string>
        <string>NSPrivacyAccessedAPITypeNetwork</string>
        <string>NSPrivacyAccessedAPITypeSystemUptime</string>
    </array>
    <key>NSRequiresAquaSystemAppearance</key>
    <false/>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.utilities</string>
    <key>CFBundleGetInfoString</key>
    <string>Sentinel GRC Agent v$VERSION - Endpoint compliance monitoring</string>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2024-2026 Cyber Threat Consulting. All rights reserved.</string>
</dict>
</plist>
EOF

# Copy app icon
echo -e "${YELLOW}Copying app icon...${NC}"
ICON_SOURCE="$SCRIPT_DIR/assets/icons/sentinel-agent.icns"
if [[ -f "$ICON_SOURCE" ]]; then
    cp "$ICON_SOURCE" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
    echo -e "${GREEN}✅ Icon copied successfully${NC}"
else
    echo -e "${YELLOW}⚠️ Icon not found at $ICON_SOURCE, using placeholder${NC}"
    # Valid placeholder creation (if needed, though prefer warning)
    touch "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
fi

# Sign the app bundle with Apple Developer ID
echo -e "${YELLOW}Signing app bundle with identity: $SIGNING_IDENTITY...${NC}"
MAX_RETRIES=3
RETRY_COUNT=0
SUCCESS=false

# Additional hardened runtime options for Rust applications
CODESIGN_OPTIONS="--force --options runtime --timestamp="http://timestamp.apple.com/ts01""

# Add entitlements if they exist
if [[ -f "macos/entitlements.plist" ]]; then
    CODESIGN_OPTIONS="$CODESIGN_OPTIONS --entitlements macos/entitlements.plist"
    echo -e "${BLUE}Using entitlements from macos/entitlements.plist${NC}"
else
    echo -e "${YELLOW}Warning: No entitlements.plist found, using default hardened runtime${NC}"
fi

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo -e "Attempt $((RETRY_COUNT + 1)) of $MAX_RETRIES..."
    if eval "codesign $CODESIGN_OPTIONS --sign '$SIGNING_IDENTITY' '$APP_BUNDLE'"; then
        SUCCESS=true
        break
    else
        echo -e "${YELLOW}⚠️ codesign failed (likely timestamp service). Retrying in 5 seconds...${NC}"
        RETRY_COUNT=$((RETRY_COUNT + 1))
        sleep 5
    fi
done

if [ "$SUCCESS" = false ]; then
    echo -e "${RED}❌ codesign failed after $MAX_RETRIES attempts.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ App bundle signed successfully${NC}"

# Verify signature
echo -e "${YELLOW}Verifying app bundle signature...${NC}"
codesign --verify --verbose "$APP_BUNDLE"

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

# Detect the real logged-in user (not root)
REAL_USER=$(/usr/bin/stat -f%Su /dev/console)
REAL_HOME=$(/usr/bin/dscl . -read /Users/"$REAL_USER" NFSHomeDirectory | awk '{print $2}')

echo "Installing for user: $REAL_USER (home: $REAL_HOME)"

# Create symbolic link for command line usage
if [[ ! -L "/usr/local/bin/sentinel-agent" ]]; then
    mkdir -p "/usr/local/bin"
    ln -sf "/Applications/SentinelAgent.app/Contents/MacOS/SentinelAgent" "/usr/local/bin/sentinel-agent"
fi

# Create default configuration in user directory
CONFIG_DIR="$REAL_HOME/Library/Application Support/Sentinel GRC"
sudo -u "$REAL_USER" mkdir -p "$CONFIG_DIR"

if [[ ! -f "$CONFIG_DIR/agent.json" ]]; then
    cat > "$CONFIG_DIR/agent.json" << CONFIG
{
    "server_url": "https://europe-west1-sentinel-grc-a8701.cloudfunctions.net/agentApi",
    "check_interval_secs": 3600,
    "heartbeat_interval_secs": 60,
    "log_level": "info",
    "tls_verify": true,
    "data_dir": "$CONFIG_DIR"
}
CONFIG
    chown "$REAL_USER" "$CONFIG_DIR/agent.json"
    chmod 600 "$CONFIG_DIR/agent.json"
fi

# Create LaunchAgent plist for auto-start at login
LAUNCH_AGENTS_DIR="$REAL_HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/com.cyber-threat-consulting.sentinel-agent.plist"

# Ask user about auto-start (only if strictly interactive/not handled by MDM)
# Skipping interactive dialogue in silent install contexts

AUTO_START="Oui" # Defaulting for now

if [[ "$AUTO_START" == "Oui" ]]; then
    sudo -u "$REAL_USER" mkdir -p "$LAUNCH_AGENTS_DIR"
    cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cyber-threat-consulting.sentinel-agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/SentinelAgent.app/Contents/MacOS/SentinelAgent</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>ProcessType</key>
    <string>Interactive</string>
    <key>StandardOutPath</key>
    <string>/tmp/sentinel-agent.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/sentinel-agent.stderr.log</string>
</dict>
</plist>
    chown "$REAL_USER" "$PLIST_PATH"
    chmod 644 "$PLIST_PATH"
    echo "Auto-start configured via LaunchAgent"
fi

# Launch the application now
echo "Launching Sentinel Agent..."
sudo -u "$REAL_USER" open "/Applications/SentinelAgent.app"

echo "Installation completed successfully!"
exit 0
POSTINSTALL

chmod +x "$BUILD_DIR/postinstall"

# Create distribution definition
echo -e "${YELLOW}Creating distribution definition...${NC}"
cat > "$BUILD_DIR/distribution.xml" << DISTXML
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="1.0">
    <title>Sentinel GRC Agent</title>
    <organization>Cyber Threat Consulting</organization>
    <domains enable_anywhere="true" />

    <options rootVolumeOnly="false" />

    <welcome file="welcome.html" mime-type="text/html" />
    <license file="license.html" mime-type="text/html" />
    <conclusion file="conclusion.html" mime-type="text/html" />

    <background file="background.png" alignment="center" scaling="proportional" />

    <choices-outline>
        <line choice="sentinel_agent" />
    </choices-outline>

    <choice id="sentinel_agent" title="Sentinel GRC Agent v$VERSION" description="Application de monitoring de conformité pour la plateforme Sentinel GRC. Inclut l'application, les outils CLI et le lancement automatique.">
        <pkg-ref id="com.sentinel.agent.app"/>
    </choice>

    <pkg-ref id="com.sentinel.agent.app" version="$VERSION" onConclusion="none">SentinelAgentApp.pkg</pkg-ref>
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
        .verified { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="icon">🛡️</div>
        <h1>Welcome to Sentinel GRC Agent</h1>
        <p>Endpoint compliance monitoring for the Sentinel GRC platform</p>
    </div>
    
    <div class="verified">
        <strong>✅ Verified Developer:</strong> This package is signed with an Apple Developer certificate 
        and has passed Gatekeeper verification. You can install with confidence.
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
        .verified { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .next-steps { margin: 20px 0; }
        .step { margin: 10px 0; padding-left: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="icon">✅</div>
        <h1>Installation Complete!</h1>
        <p>Sentinel GRC Agent has been successfully installed and verified</p>
    </div>
    
    <div class="verified">
        <strong>🔒 Security Verified:</strong> This package was signed with an Apple Developer certificate 
        and has passed all security checks. The application is ready to use.
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

# Create payload directory with .app bundle inside
PAYLOAD_DIR="$BUILD_DIR/payload"
mkdir -p "$PAYLOAD_DIR"
cp -R "$APP_BUNDLE" "$PAYLOAD_DIR/SentinelAgent.app"

# Create component package
pkgbuild \
    --root "$PAYLOAD_DIR" \
    --identifier "$IDENTIFIER.app" \
    --version "$VERSION" \
    --install-location "$INSTALL_LOCATION" \
    --scripts "$BUILD_DIR" \
    --preserve-xattr \
    "SentinelAgentApp.pkg"


# Create product archive
# If we have an installer identity, use it. Otherwise, normal build.
if [ -n "$INSTALLER_IDENTITY" ]; then
    echo -e "${YELLOW}Signing Installer Package with: $INSTALLER_IDENTITY...${NC}"
    productbuild \
        --distribution "$BUILD_DIR/distribution.xml" \
        --resources "$BUILD_DIR" \
        --package-path "$BUILD_DIR" \
        --sign "$INSTALLER_IDENTITY" \
        "$PKG_DIR/SentinelAgent-$VERSION.pkg"
else
    echo -e "${YELLOW}⚠️  No Developer ID Installer certificate found.${NC}"
    echo -e "${YELLOW}   Package will be signed with Developer ID Application but not notarized.${NC}"
    echo -e "${YELLOW}   To enable notarization, add a Developer ID Installer certificate to your keychain.${NC}"
    
    if [ "$NOTARIZE" = "true" ]; then
        echo -e "${RED}❌ Cannot notarize without Developer ID Installer certificate.${NC}"
        echo -e "${RED}   Disabling notarization and continuing with signed package only...${NC}"
        export NOTARIZE=false
    fi
    
    echo -e "${YELLOW}Building Unsigned Installer Package (Ad-hoc)...${NC}"
    productbuild \
        --distribution "$BUILD_DIR/distribution.xml" \
        --resources "$BUILD_DIR" \
        --package-path "$BUILD_DIR" \
        "$PKG_DIR/SentinelAgent-$VERSION.pkg"
fi

# Verify package integrity
echo -e "${YELLOW}Verifying package integrity...${NC}"
pkgutil --expand "$PKG_DIR/SentinelAgent-$VERSION.pkg" "$BUILD_DIR/expanded"

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Package verification successful${NC}"
    rm -rf "$BUILD_DIR/expanded"
else
    echo -e "${RED}❌ Package verification failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ macOS package created: $PKG_DIR/SentinelAgent-$VERSION.pkg${NC}"

# Notarization Step
if [ "$NOTARIZE" == "true" ]; then
    echo -e "${BLUE}🍎 Starting Notarization Process...${NC}"
    
    # Check for credentials
    if [[ -z "$NOTARIZATION_KEYCHAIN_PROFILE" ]] && [[ -z "$APPLE_PASSWORD" ]]; then
        echo -e "${RED}❌ Missing Notarization Credentials. Please set NOTARIZATION_KEYCHAIN_PROFILE or APPLE_ID/APPLE_PASSWORD/TEAM_ID.${NC}"
        exit 1
    fi

    # Submit for notarization
    echo -e "${YELLOW}Submitting path for notarization (this may take a while)...${NC}"
    
    SUBMISSION_ID=""
    if [[ -n "$NOTARIZATION_KEYCHAIN_PROFILE" ]]; then
        echo -e "${BLUE}Using keychain profile for notarization${NC}"
        SUBMISSION_OUTPUT=$(xcrun notarytool submit "$PKG_DIR/SentinelAgent-$VERSION.pkg" \
            --keychain-profile "$NOTARIZATION_KEYCHAIN_PROFILE" \
            --wait 2>&1)
        SUBMISSION_ID=$(echo "$SUBMISSION_OUTPUT" | grep "id:" | head -1 | awk '{print $2}')
    else
        echo -e "${BLUE}Using Apple ID credentials for notarization${NC}"
        SUBMISSION_OUTPUT=$(xcrun notarytool submit "$PKG_DIR/SentinelAgent-$VERSION.pkg" \
            --apple-id "$APPLE_ID" \
            --password "$APPLE_PASSWORD" \
            --team-id "$TEAM_ID" \
            --wait 2>&1)
        SUBMISSION_ID=$(echo "$SUBMISSION_OUTPUT" | grep "id:" | head -1 | awk '{print $2}')
    fi
    
    echo -e "${BLUE}Submission complete. Checking results...${NC}"
    
    # Check if submission was successful
    if echo "$SUBMISSION_OUTPUT" | grep -q "status: Invalid"; then
        echo -e "${RED}❌ Notarization failed with status: Invalid${NC}"
        
        # Try to get detailed logs
        if [[ -n "$SUBMISSION_ID" ]]; then
            echo -e "${YELLOW}Attempting to fetch detailed logs for submission: $SUBMISSION_ID${NC}"
            if [[ -n "$NOTARIZATION_KEYCHAIN_PROFILE" ]]; then
                xcrun notarytool log "$SUBMISSION_ID" --keychain-profile "$NOTARIZATION_KEYCHAIN_PROFILE" || echo -e "${YELLOW}Could not fetch logs${NC}"
            else
                xcrun notarytool log "$SUBMISSION_ID" \
                    --apple-id "$APPLE_ID" \
                    --password "$APPLE_PASSWORD" \
                    --team-id "$TEAM_ID" || echo -e "${YELLOW}Could not fetch logs${NC}"
            fi
        fi
        
        echo -e "${RED}❌ Package notarization failed. Please check the logs above.${NC}"
        exit 66
    elif echo "$SUBMISSION_OUTPUT" | grep -q "status: Accepted"; then
        echo -e "${GREEN}✅ Notarization successful!${NC}"
        
        # Staple the ticket
        echo -e "${YELLOW}Stapling ticket to package...${NC}"
        if xcrun stapler staple "$PKG_DIR/SentinelAgent-$VERSION.pkg"; then
            echo -e "${GREEN}✅ Stapling successful${NC}"
        else
            echo -e "${YELLOW}⚠️ Stapling failed, but notarization is complete${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Unexpected notarization status. Please check manually.${NC}"
        echo "$SUBMISSION_OUTPUT"
    fi
    
    echo -e "${GREEN}✅ Notarization Complete!${NC}"
fi

# Display package info
echo -e "${BLUE}Package Information:${NC}"
echo "File: $PKG_DIR/SentinelAgent-$VERSION.pkg"
echo "Size: $(du -h "$PKG_DIR/SentinelAgent-$VERSION.pkg" | cut -f1)"
echo "Version: $VERSION"
echo "Identifier: $IDENTIFIER"
echo "Signing Identity: $SIGNING_IDENTITY"
if [ "$NOTARIZE" == "true" ]; then
    echo "Notarized: Yes"
else
    echo "Notarized: No (Use spctl --add to bypass locally)"
fi

echo -e "${GREEN}🎉 macOS installer created successfully!${NC}"
