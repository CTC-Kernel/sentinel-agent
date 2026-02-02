#!/bin/bash

set -e

echo "Installing Sentinel GRC Agent for macOS..."

# Verify package integrity if checksum file exists
if [[ -f "SentinelAgent.app.sha256" ]]; then
    echo "Verifying package integrity (SHA-256)..."
    if shasum -a 256 --check "SentinelAgent.app.sha256" --status 2>/dev/null; then
        echo "✅ Package integrity verified"
    else
        echo "❌ Package integrity check FAILED!"
        echo "The package may have been tampered with. Aborting installation."
        exit 1
    fi
else
    echo "⚠️  No SHA-256 checksum file found. Skipping integrity verification."
fi

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
