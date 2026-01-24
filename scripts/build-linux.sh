#!/bin/bash
# Build script for Linux - Creates DEB and RPM packages
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/target/release"
VERSION="1.0.0"

echo "=== Building Sentinel Agent for Linux ==="
echo "Project dir: $PROJECT_DIR"

# Build the release binary
echo ""
echo "1. Building release binary..."
cd "$PROJECT_DIR"
cargo build --release --package agent-core

# Create package directories
echo ""
echo "2. Creating package structure..."

# DEB package
DEB_DIR="$BUILD_DIR/deb"
DEB_NAME="sentinel-agent_${VERSION}_amd64"
rm -rf "$DEB_DIR"
mkdir -p "$DEB_DIR/$DEB_NAME/DEBIAN"
mkdir -p "$DEB_DIR/$DEB_NAME/usr/bin"
mkdir -p "$DEB_DIR/$DEB_NAME/etc/sentinel"
mkdir -p "$DEB_DIR/$DEB_NAME/lib/systemd/system"
mkdir -p "$DEB_DIR/$DEB_NAME/usr/share/doc/sentinel-agent"

# Copy binary
cp "$BUILD_DIR/agent-core" "$DEB_DIR/$DEB_NAME/usr/bin/sentinel-agent"
chmod 755 "$DEB_DIR/$DEB_NAME/usr/bin/sentinel-agent"

# Create control file
cat > "$DEB_DIR/$DEB_NAME/DEBIAN/control" << EOF
Package: sentinel-agent
Version: $VERSION
Section: admin
Priority: optional
Architecture: amd64
Depends: libc6 (>= 2.17), libssl3 | libssl1.1
Maintainer: Cyber Threat Consulting <***REMOVED***>
Description: Sentinel GRC Agent
 A lightweight compliance monitoring agent that performs
 security checks on endpoints and reports to the Sentinel GRC platform.
EOF

# Create postinst script
cat > "$DEB_DIR/$DEB_NAME/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e

# Create sentinel user if it doesn't exist
if ! id -u sentinel > /dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin sentinel
fi

# Set permissions
chown -R sentinel:sentinel /etc/sentinel
chmod 700 /etc/sentinel

# Enable and start the service
systemctl daemon-reload
systemctl enable sentinel-agent.service
systemctl start sentinel-agent.service || true

echo "Sentinel Agent installed successfully."
echo "Configure the agent by running: sentinel-agent enroll --token <YOUR_TOKEN>"
EOF
chmod 755 "$DEB_DIR/$DEB_NAME/DEBIAN/postinst"

# Create prerm script
cat > "$DEB_DIR/$DEB_NAME/DEBIAN/prerm" << 'EOF'
#!/bin/bash
set -e

# Stop and disable the service
systemctl stop sentinel-agent.service || true
systemctl disable sentinel-agent.service || true
EOF
chmod 755 "$DEB_DIR/$DEB_NAME/DEBIAN/prerm"

# Create systemd service file
cat > "$DEB_DIR/$DEB_NAME/lib/systemd/system/sentinel-agent.service" << EOF
[Unit]
Description=Sentinel GRC Agent
After=network.target

[Service]
Type=simple
User=sentinel
Group=sentinel
ExecStart=/usr/bin/sentinel-agent
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/etc/sentinel

[Install]
WantedBy=multi-user.target
EOF

# Create default config
cat > "$DEB_DIR/$DEB_NAME/etc/sentinel/agent.json" << 'EOF'
{
  "api_url": "https://europe-west1-sentinel-grc-a8701.cloudfunctions.net",
  "check_interval_seconds": 3600,
  "heartbeat_interval_seconds": 60,
  "log_level": "info"
}
EOF
chmod 600 "$DEB_DIR/$DEB_NAME/etc/sentinel/agent.json"

# Create README
cat > "$DEB_DIR/$DEB_NAME/usr/share/doc/sentinel-agent/README" << 'EOF'
╔══════════════════════════════════════════════════════════════════════════════╗
║                        SENTINEL AGENT                                        ║
║                     Cyber Threat Consulting                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

DESCRIPTION
===========
Agent de conformité endpoint pour la plateforme Sentinel GRC.
Effectue des vérifications de sécurité automatisées et rapporte les résultats.

FONCTIONNALITÉS
===============
• Surveillance de conformité en temps réel
• Vérification automatique des politiques de sécurité
• Synchronisation avec la plateforme Sentinel GRC
• Mode hors-ligne avec mise en cache locale (jusqu'à 7 jours)

CONFIGURATION
=============
Fichier : /etc/sentinel/agent.json

{
  "enrollment_token": "VOTRE_TOKEN",
  "server_url": "https://app.cyber-threat-consulting.com",
  "check_interval_seconds": 3600,
  "log_level": "info"
}

LOGS
====
  journalctl -u sentinel-agent -f

COMMANDES
=========
  sentinel-agent enroll --token <TOKEN>   Enrôler l'agent
  sentinel-agent status                   Afficher le statut
  sentinel-agent run                      Lancer une vérification
  sentinel-agent --help                   Afficher l'aide

SERVICE SYSTEMD
===============
  sudo systemctl start sentinel-agent     Démarrer le service
  sudo systemctl stop sentinel-agent      Arrêter le service
  sudo systemctl status sentinel-agent    Statut du service

LIENS UTILES
============
• Site web      : https://cyber-threat-consulting.com
• Plateforme    : https://app.cyber-threat-consulting.com
• Documentation : https://cyber-threat-consulting.com/docs/sentinel-agent

CONTACT
=======
Email : ***REMOVED***

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
© 2024-2026 Cyber Threat Consulting. Tous droits réservés.
EOF

# Build DEB package
echo ""
echo "3. Building DEB package..."
cd "$DEB_DIR"
dpkg-deb --build "$DEB_NAME"
mv "$DEB_NAME.deb" "$BUILD_DIR/sentinel-agent_${VERSION}_amd64.deb"

# Create symlink for latest
ln -sf "sentinel-agent_${VERSION}_amd64.deb" "$BUILD_DIR/sentinel-agent_latest_amd64.deb"

echo ""
echo "=== Build complete ==="
echo "DEB: $BUILD_DIR/sentinel-agent_${VERSION}_amd64.deb"
echo ""
echo "To install:"
echo "  sudo dpkg -i sentinel-agent_${VERSION}_amd64.deb"
echo "  sentinel-agent enroll --token <YOUR_TOKEN>"
