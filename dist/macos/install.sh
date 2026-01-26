#!/bin/bash
# Sentinel Agent - Installation Script for macOS
# Run as: sudo ./install.sh --token YOUR_TOKEN

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
SERVER_URL="https://europe-west1-sentinel-grc-a8701.cloudfunctions.net/agentApi"
TOKEN=""
INSTALL_DIR="/usr/local/sentinel"
CONFIG_DIR="/etc/sentinel"
DATA_DIR="/var/lib/sentinel"
LOG_DIR="/var/log/sentinel"
LAUNCHD_PLIST="/Library/LaunchDaemons/com.cyberthreatconsulting.sentinel-agent.plist"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --token|-t)
            TOKEN="$2"
            shift 2
            ;;
        --server|-s)
            SERVER_URL="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: sudo ./install.sh --token YOUR_ENROLLMENT_TOKEN [--server SERVER_URL]"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

echo ""
echo -e "${CYAN}========================================"
echo "   Sentinel GRC Agent - Installation"
echo -e "========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Erreur: Ce script doit être exécuté avec sudo${NC}"
    echo "Usage: sudo ./install.sh --token YOUR_TOKEN"
    exit 1
fi

# Prompt for token if not provided
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}Entrez le token d'enrollment fourni par votre administrateur:${NC}"
    read -p "Token: " TOKEN

    if [ -z "$TOKEN" ]; then
        echo -e "${RED}Erreur: Le token d'enrollment est requis.${NC}"
        exit 1
    fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${YELLOW}1. Création des répertoires...${NC}"

mkdir -p "$INSTALL_DIR/bin"
mkdir -p "$CONFIG_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"

echo "   - $INSTALL_DIR"
echo "   - $CONFIG_DIR"
echo "   - $DATA_DIR"
echo "   - $LOG_DIR"

echo ""
echo -e "${YELLOW}2. Copie des fichiers...${NC}"

# Copy executable
cp "$SCRIPT_DIR/sentinel-agent" "$INSTALL_DIR/bin/sentinel-agent"
chmod 755 "$INSTALL_DIR/bin/sentinel-agent"
echo "   - sentinel-agent"

# Create config file
cat > "$CONFIG_DIR/agent.json" << EOF
{
    "server_url": "$SERVER_URL",
    "enrollment_token": "$TOKEN",
    "data_dir": "$DATA_DIR",
    "log_level": "info",
    "heartbeat_interval_secs": 60,
    "check_interval_secs": 3600
}
EOF
chmod 600 "$CONFIG_DIR/agent.json"
echo "   - agent.json"

echo ""
echo -e "${YELLOW}3. Configuration du service LaunchDaemon...${NC}"

# Stop existing service if running
if launchctl list | grep -q "com.cyberthreatconsulting.sentinel-agent"; then
    echo "   - Arrêt du service existant..."
    launchctl unload "$LAUNCHD_PLIST" 2>/dev/null || true
    sleep 1
fi

# Create LaunchDaemon plist
cat > "$LAUNCHD_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cyberthreatconsulting.sentinel-agent</string>

    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/bin/sentinel-agent</string>
        <string>--config</string>
        <string>$CONFIG_DIR/agent.json</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>

    <key>ThrottleInterval</key>
    <integer>60</integer>

    <key>StandardOutPath</key>
    <string>$LOG_DIR/sentinel-agent.log</string>

    <key>StandardErrorPath</key>
    <string>$LOG_DIR/sentinel-agent.error.log</string>

    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>SENTINEL_CONFIG_PATH</key>
        <string>$CONFIG_DIR/agent.json</string>
    </dict>
</dict>
</plist>
EOF

chmod 644 "$LAUNCHD_PLIST"
echo "   - LaunchDaemon créé"

echo ""
echo -e "${YELLOW}4. Enrollment de l'agent...${NC}"

# Run enrollment
if "$INSTALL_DIR/bin/sentinel-agent" enroll --token "$TOKEN" --server "$SERVER_URL" 2>&1; then
    echo -e "   - ${GREEN}Enrollment réussi${NC}"
else
    echo -e "   - ${YELLOW}Enrollment sera effectué au démarrage du service${NC}"
fi

echo ""
echo -e "${YELLOW}5. Démarrage du service...${NC}"

launchctl load "$LAUNCHD_PLIST"
sleep 2

if launchctl list | grep -q "com.cyberthreatconsulting.sentinel-agent"; then
    echo -e "   - ${GREEN}Service démarré avec succès${NC}"
else
    echo -e "   - ${YELLOW}Vérifiez les logs: $LOG_DIR/sentinel-agent.log${NC}"
fi

echo ""
echo -e "${GREEN}========================================"
echo "   Installation terminée!"
echo -e "========================================${NC}"
echo ""
echo "L'agent Sentinel est maintenant installé et actif."
echo ""
echo -e "${CYAN}Commandes utiles:${NC}"
echo "  - Statut:    sudo launchctl list | grep sentinel"
echo "  - Logs:      tail -f $LOG_DIR/sentinel-agent.log"
echo "  - Arrêter:   sudo launchctl unload $LAUNCHD_PLIST"
echo "  - Démarrer:  sudo launchctl load $LAUNCHD_PLIST"
echo ""
echo -e "${CYAN}Tableau de bord:${NC} https://app.cyber-threat-consulting.com/settings?tab=agents"
echo ""
