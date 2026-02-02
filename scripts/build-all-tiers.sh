#!/bin/bash
# Sentinel GRC Agent — Build All Installation Tiers for macOS
# Creates Desktop (GUI), Tray, and CLI variants as DMG + PKG packages.
#
# Usage:
#   bash scripts/build-all-tiers.sh            # Build all tiers
#   bash scripts/build-all-tiers.sh --upload    # Build + upload to Firebase Storage
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/target/release"
DIST_DIR="$PROJECT_DIR/dist/tiers"
STAGING_DIR="$DIST_DIR/staging"

# Extract version from Cargo.toml (single source of truth)
CARGO_VERSION=$(grep '^version' "$PROJECT_DIR/Cargo.toml" | head -1 | sed 's/.*"\(.*\)".*/\1/')
VERSION="${VERSION:-$CARGO_VERSION}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# Firebase Storage config
BUCKET="sentinel-grc-a8701.firebasestorage.app"
STORAGE_PATH="releases/agent/macos"

UPLOAD=false
if [[ "$1" == "--upload" ]]; then
    UPLOAD=true
fi

echo -e "${BOLD}${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         Sentinel GRC Agent — Build All Tiers                ║"
echo "║         Version: $VERSION                                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Tier Definitions ──────────────────────────────────────────────
# Format: NAME|FEATURES|IDENTIFIER|DESCRIPTION
TIERS=(
    "Desktop|default|com.cyber-threat-consulting.sentinel-agent|Interface graphique complete"
    "Tray|tray,fim|com.cyber-threat-consulting.sentinel-agent.tray|Icone barre de menu"
    "CLI|fim|com.cyber-threat-consulting.sentinel-agent.cli|Ligne de commande"
)

# ─── Clean ─────────────────────────────────────────────────────────
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf "$DIST_DIR"
mkdir -p "$STAGING_DIR"

# ─── Detect Code Signing Identity ─────────────────────────────────
IDENTITY=""
if security find-identity -v -p codesigning 2>/dev/null | grep -q "Developer ID Application"; then
    IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | awk -F'"' '{print $2}')
    echo -e "${GREEN}Code signing identity: $IDENTITY${NC}"
else
    echo -e "${YELLOW}No Developer ID found — using ad-hoc signing${NC}"
fi

# ─── Build Loop ────────────────────────────────────────────────────
TOTAL_START=$(date +%s)

for tier_def in "${TIERS[@]}"; do
    IFS='|' read -r TIER_NAME FEATURES IDENTIFIER DESCRIPTION <<< "$tier_def"

    echo ""
    echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${BLUE}  Building: ${TIER_NAME} (${DESCRIPTION})${NC}"
    echo -e "${BOLD}${BLUE}  Features: ${FEATURES}${NC}"
    echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════${NC}"

    TIER_START=$(date +%s)

    # ── Step 1: Cargo build ──
    echo -e "${YELLOW}[1/6] Compiling...${NC}"
    cd "$PROJECT_DIR"

    # Clean agent-core between builds to ensure feature gates recompile
    cargo clean -p agent-core 2>/dev/null || true

    if [[ "$FEATURES" == "default" ]]; then
        cargo build --release --package agent-core 2>&1
    else
        cargo build --release --package agent-core --no-default-features --features "$FEATURES" 2>&1
    fi

    # ── Step 2: Stage binary ──
    echo -e "${YELLOW}[2/6] Staging binary...${NC}"
    cp "$BUILD_DIR/agent-core" "$STAGING_DIR/agent-core-${TIER_NAME}"
    BINARY_SIZE=$(stat -f%z "$STAGING_DIR/agent-core-${TIER_NAME}" 2>/dev/null || stat -c%s "$STAGING_DIR/agent-core-${TIER_NAME}" 2>/dev/null)
    BINARY_MB=$((BINARY_SIZE / 1024 / 1024))
    echo -e "  Binary size: ${BOLD}${BINARY_MB} MB${NC} (${BINARY_SIZE} bytes)"

    # ── Step 3: Create .app bundle ──
    echo -e "${YELLOW}[3/6] Creating .app bundle...${NC}"
    APP_NAME="Sentinel Agent"
    TIER_APP_DIR="$DIST_DIR/${TIER_NAME}"
    APP_BUNDLE="$TIER_APP_DIR/${APP_NAME}.app"

    rm -rf "$TIER_APP_DIR"
    mkdir -p "$APP_BUNDLE/Contents/MacOS"
    mkdir -p "$APP_BUNDLE/Contents/Resources"

    # Copy binary
    cp "$STAGING_DIR/agent-core-${TIER_NAME}" "$APP_BUNDLE/Contents/MacOS/sentinel-agent"
    chmod +x "$APP_BUNDLE/Contents/MacOS/sentinel-agent"

    # Info.plist — customise identifier per tier
    sed "s|com.cyber-threat-consulting.sentinel-agent|${IDENTIFIER}|" \
        "$PROJECT_DIR/macos/Info.plist" > "$APP_BUNDLE/Contents/Info.plist"

    # Icon
    if [ -f "$PROJECT_DIR/assets/icons/sentinel-agent.icns" ]; then
        cp "$PROJECT_DIR/assets/icons/sentinel-agent.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
    fi

    echo "APPL????" > "$APP_BUNDLE/Contents/PkgInfo"

    # ── Step 4: Code sign ──
    echo -e "${YELLOW}[4/6] Code signing...${NC}"
    if [ -n "$IDENTITY" ]; then
        ENTITLEMENTS="$PROJECT_DIR/macos/entitlements.plist"
        if [ -f "$ENTITLEMENTS" ]; then
            codesign --force --deep --options runtime \
                --entitlements "$ENTITLEMENTS" \
                --sign "$IDENTITY" \
                "$APP_BUNDLE" 2>&1
        else
            codesign --force --deep --options runtime \
                --sign "$IDENTITY" \
                "$APP_BUNDLE" 2>&1
        fi
        codesign --verify --verbose=2 "$APP_BUNDLE" 2>&1
        echo -e "  ${GREEN}Signed with Developer ID${NC}"
    else
        codesign --force --deep --sign - "$APP_BUNDLE" 2>&1
        echo -e "  ${YELLOW}Ad-hoc signed${NC}"
    fi

    # ── Step 5: Create DMG ──
    echo -e "${YELLOW}[5/6] Creating DMG...${NC}"
    DMG_PATH="$DIST_DIR/SentinelAgent-${TIER_NAME}-${VERSION}.dmg"
    DMG_TEMP="$DIST_DIR/dmg-temp-${TIER_NAME}"

    rm -rf "$DMG_TEMP"
    mkdir -p "$DMG_TEMP"
    cp -R "$APP_BUNDLE" "$DMG_TEMP/"
    ln -s /Applications "$DMG_TEMP/Applications"

    # Installer.command
    cat > "$DMG_TEMP/Installer.command" << 'INSTALLER_EOF'
#!/bin/bash
# Sentinel Agent Installer
clear
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           INSTALLATION DE SENTINEL AGENT                     ║"
echo "║           Cyber Threat Consulting                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Sentinel Agent.app"
SOURCE_APP="$SCRIPT_DIR/$APP_NAME"
DEST_APP="/Applications/$APP_NAME"

if [ ! -d "$SOURCE_APP" ]; then
    echo "Erreur: Application non trouvee dans le DMG"
    read -p "Appuyez sur Entree pour fermer..."
    exit 1
fi

echo "Copie de l'application vers /Applications..."
[ -d "$DEST_APP" ] && rm -rf "$DEST_APP"
cp -R "$SOURCE_APP" "$DEST_APP"

if [ $? -ne 0 ]; then
    echo "Erreur lors de la copie."
    read -p "Appuyez sur Entree pour fermer..."
    exit 1
fi

echo "Application copiee avec succes"
echo ""
echo "Suppression de la quarantaine macOS..."
xattr -cr "$DEST_APP"
echo "Quarantaine supprimee"
echo ""
echo "INSTALLATION TERMINEE !"
echo ""

read -p "Voulez-vous lancer l'application maintenant ? (o/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Oo]$ ]]; then
    echo "Lancement de Sentinel Agent..."
    open "$DEST_APP"
fi

echo "Vous pouvez ejecter le DMG et fermer cette fenetre."
INSTALLER_EOF
    chmod +x "$DMG_TEMP/Installer.command"

    # LISEZ-MOI.txt
    cat > "$DMG_TEMP/LISEZ-MOI.txt" << EOF
SENTINEL AGENT v${VERSION} — ${DESCRIPTION}
Cyber Threat Consulting

INSTALLATION
1. Double-cliquez sur "Installer.command"
2. Ou glissez "Sentinel Agent" vers "Applications"
3. Si macOS bloque : Preferences Systeme > Securite > "Ouvrir quand meme"

COMMANDES CLI
  sentinel-agent enroll --token <TOKEN>
  sentinel-agent status
  sentinel-agent run --no-tray

DONNEES
  Config   : ~/Library/Application Support/SentinelGRC/agent.json
  Database : ~/Library/Application Support/SentinelGRC/agent.db
  Logs     : ~/Library/Application Support/SentinelGRC/logs/

LIENS
  Site web   : https://cyber-threat-consulting.com
  Dashboard  : https://app.cyber-threat-consulting.com
  Contact    : contact@cyber-threat-consulting.com

(c) 2024-2026 Cyber Threat Consulting. Tous droits reserves.
EOF

    hdiutil create -volname "Sentinel Agent ${TIER_NAME}" \
        -srcfolder "$DMG_TEMP" \
        -ov -format UDZO \
        "$DMG_PATH" 2>&1

    rm -rf "$DMG_TEMP"
    DMG_SIZE=$(du -h "$DMG_PATH" | cut -f1)
    echo -e "  DMG: ${GREEN}${DMG_SIZE}${NC} → $(basename "$DMG_PATH")"

    # ── Step 6: Create PKG ──
    echo -e "${YELLOW}[6/6] Creating PKG...${NC}"
    PKG_PATH="$DIST_DIR/SentinelAgent-${TIER_NAME}-${VERSION}.pkg"

    pkgbuild --root "$TIER_APP_DIR" \
        --identifier "$IDENTIFIER" \
        --version "$VERSION" \
        --install-location "/Applications" \
        "$PKG_PATH" 2>&1

    PKG_SIZE=$(du -h "$PKG_PATH" | cut -f1)
    echo -e "  PKG: ${GREEN}${PKG_SIZE}${NC} → $(basename "$PKG_PATH")"

    TIER_END=$(date +%s)
    echo -e "  ${GREEN}Done in $((TIER_END - TIER_START))s${NC}"
done

# ─── Cleanup ───────────────────────────────────────────────────────
rm -rf "$STAGING_DIR"
for tier_def in "${TIERS[@]}"; do
    IFS='|' read -r TIER_NAME _ _ _ <<< "$tier_def"
    rm -rf "$DIST_DIR/${TIER_NAME}"
done

# ─── SHA256 Checksums ──────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Generating SHA256 checksums...${NC}"
cd "$DIST_DIR"
shasum -a 256 SentinelAgent-*.dmg SentinelAgent-*.pkg > SHA256SUMS.txt
cd "$PROJECT_DIR"

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║                    BUILD SUMMARY                             ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

for file in "$DIST_DIR"/SentinelAgent-*.dmg "$DIST_DIR"/SentinelAgent-*.pkg; do
    if [ -f "$file" ]; then
        size=$(du -h "$file" | cut -f1)
        printf "  ${BLUE}%-45s${NC} %s\n" "$(basename "$file")" "$size"
    fi
done

echo ""
echo -e "${BOLD}SHA256 Checksums:${NC}"
cat "$DIST_DIR/SHA256SUMS.txt" | while IFS= read -r line; do
    echo -e "  ${BLUE}$line${NC}"
done

TOTAL_END=$(date +%s)
echo ""
echo -e "${GREEN}Total build time: $((TOTAL_END - TOTAL_START))s${NC}"

# ─── Upload ────────────────────────────────────────────────────────
if $UPLOAD; then
    echo ""
    echo -e "${YELLOW}Uploading to Firebase Storage...${NC}"

    gsutil -m cp \
        "$DIST_DIR"/SentinelAgent-*.dmg \
        "$DIST_DIR"/SentinelAgent-*.pkg \
        "$DIST_DIR"/SHA256SUMS.txt \
        "gs://${BUCKET}/${STORAGE_PATH}/" 2>&1

    # Set content types
    for file in "$DIST_DIR"/SentinelAgent-*.dmg; do
        FILENAME=$(basename "$file")
        gsutil setmeta -h "Content-Type:application/x-apple-diskimage" \
            "gs://${BUCKET}/${STORAGE_PATH}/${FILENAME}" 2>/dev/null || true
    done
    for file in "$DIST_DIR"/SentinelAgent-*.pkg; do
        FILENAME=$(basename "$file")
        gsutil setmeta -h "Content-Type:application/vnd.apple.installer+xml" \
            "gs://${BUCKET}/${STORAGE_PATH}/${FILENAME}" 2>/dev/null || true
    done

    echo ""
    echo -e "${GREEN}Upload complete!${NC}"
    echo -e "Files available at: gs://${BUCKET}/${STORAGE_PATH}/"
    gsutil ls -l "gs://${BUCKET}/${STORAGE_PATH}/SentinelAgent-*" 2>&1
fi

echo ""
echo -e "${GREEN}Done.${NC}"
