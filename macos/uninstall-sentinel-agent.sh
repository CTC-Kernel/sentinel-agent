#!/bin/bash
# ============================================================================
# Sentinel GRC Agent - Desinstallation macOS
# Usage: sudo bash uninstall-sentinel-agent.sh [--purge]
# ============================================================================

set -e

PURGE=false
if [[ "$1" == "--purge" ]]; then
    PURGE=true
fi

DAEMON_PLIST="com.cyber-threat-consulting.sentinel-agent"
DAEMON_PATH="/Library/LaunchDaemons/${DAEMON_PLIST}.plist"
APP_PATH="/Applications/Sentinel Agent.app"
CLI_LINK="/usr/local/bin/sentinel-agent"

echo "=== Desinstallation de Sentinel GRC Agent ==="
echo ""

# 1. Stop and unload LaunchDaemon (system-level service)
if [ -f "$DAEMON_PATH" ]; then
    echo "[1/5] Arret du service systeme..."
    sudo launchctl bootout system/"$DAEMON_PLIST" 2>/dev/null || true
    sudo rm -f "$DAEMON_PATH"
    echo "      Service systeme arrete et supprime."
else
    echo "[1/5] Pas de service systeme detecte."
fi

# 2. Stop and unload LaunchAgent (user-level, if present)
echo "[2/5] Verification des agents utilisateur..."
CURRENT_USER=$(stat -f%Su /dev/console 2>/dev/null || echo "$USER")
AGENT_PATH="/Users/$CURRENT_USER/Library/LaunchAgents/${DAEMON_PLIST}.plist"
if [ -f "$AGENT_PATH" ]; then
    sudo -u "$CURRENT_USER" launchctl unload "$AGENT_PATH" 2>/dev/null || true
    rm -f "$AGENT_PATH"
    echo "      Agent utilisateur arrete et supprime."
else
    echo "      Pas d'agent utilisateur detecte."
fi

# 3. Remove application bundle
echo "[3/5] Suppression de l'application..."
if [ -d "$APP_PATH" ]; then
    sudo rm -rf "$APP_PATH"
    echo "      Application supprimee: $APP_PATH"
else
    echo "      Application non trouvee."
fi

# Also remove alternative names
sudo rm -rf "/Applications/SentinelAgent.app" 2>/dev/null || true
sudo rm -rf "/Applications/Sentinel GRC Agent.app" 2>/dev/null || true

# 4. Remove CLI symlink
echo "[4/5] Suppression du lien CLI..."
if [ -L "$CLI_LINK" ] || [ -f "$CLI_LINK" ]; then
    sudo rm -f "$CLI_LINK"
    echo "      Lien CLI supprime: $CLI_LINK"
else
    echo "      Pas de lien CLI detecte."
fi

# 5. Data cleanup (only with --purge)
if $PURGE; then
    echo "[5/5] Suppression des donnees (mode purge)..."
    rm -rf "$HOME/Library/Application Support/SentinelGRC" 2>/dev/null || true
    rm -rf "$HOME/Library/Application Support/Sentinel GRC" 2>/dev/null || true
    rm -rf "$HOME/Library/Caches/com.cyber-threat-consulting.sentinel-agent" 2>/dev/null || true
    rm -rf "$HOME/Library/Preferences/com.cyber-threat-consulting.sentinel-agent.plist" 2>/dev/null || true
    sudo rm -f /var/log/sentinel-agent.log 2>/dev/null || true
    sudo rm -f /var/log/sentinel-agent.err 2>/dev/null || true
    sudo rm -rf "/Library/Application Support/Sentinel GRC" 2>/dev/null || true
    echo "      Donnees et journaux supprimes."
else
    echo "[5/5] Donnees preservees."
    echo "      Pour tout supprimer: sudo bash $0 --purge"
fi

echo ""
echo "=== Sentinel GRC Agent desinstalle avec succes ==="
