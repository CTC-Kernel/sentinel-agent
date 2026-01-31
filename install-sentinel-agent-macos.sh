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
