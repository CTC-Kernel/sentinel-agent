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
