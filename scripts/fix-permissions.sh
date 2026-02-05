#!/bin/bash

# Sentinel GRC Agent - Firebase Storage Permissions Fix
# This script fixes public access permissions for agent downloads

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BUCKET="gs://sentinel-grc-a8701.firebasestorage.app/releases/agent"
BASE_URL="https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent"

echo -e "${GREEN}🔧 Fixing Firebase Storage permissions for Sentinel GRC Agent${NC}"
echo "Bucket: $BUCKET"
echo ""

# Function to test URL accessibility
test_url() {
    local url="$1"
    local name="$2"
    
    echo -e "${YELLOW}Testing $name...${NC}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ $name: HTTP $HTTP_CODE (OK)${NC}"
        return 0
    else
        echo -e "${RED}❌ $name: HTTP $HTTP_CODE (FAILED)${NC}"
        return 1
    fi
}

# Function to fix permissions
fix_permissions() {
    echo -e "${YELLOW}Setting public read ACL on all objects...${NC}"
    gsutil -m acl set -R public-read "$BUCKET" || {
        echo -e "${RED}❌ Failed to set ACL permissions${NC}"
        return 1
    }
    
    echo -e "${YELLOW}Setting IAM policy binding as fallback...${NC}"
    gcloud storage objects add-iam-policy-binding "$BUCKET/**" \
        --member="allUsers" \
        --role="roles/storage.objectViewer" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Permissions applied${NC}"
}

# Test current state
echo -e "${YELLOW}=== Testing current access ===${NC}"
FAILED_TESTS=0

test_url "$BASE_URL/macos/SentinelAgent-latest.pkg" "macOS PKG" || ((FAILED_TESTS++))
test_url "$BASE_URL/macos/SentinelAgent-latest.dmg" "macOS DMG" || ((FAILED_TESTS++))
test_url "$BASE_URL/windows/SentinelAgentSetup-latest.msi" "Windows MSI" || ((FAILED_TESTS++))
test_url "$BASE_URL/linux_deb/sentinel-agent_latest_amd64.deb" "Linux DEB" || ((FAILED_TESTS++))
test_url "$BASE_URL/linux_rpm/sentinel-agent-latest.x86_64.rpm" "Linux RPM" || ((FAILED_TESTS++))

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All downloads are already accessible!${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}=== Fixing permissions ($FAILED_TESTS files failed) ===${NC}"

# Apply fixes
fix_permissions

# Wait a moment for permissions to propagate
echo -e "${YELLOW}Waiting for permissions to propagate...${NC}"
sleep 5

# Test again
echo ""
echo -e "${YELLOW}=== Testing after fix ===${NC}"
FAILED_AFTER_FIX=0

test_url "$BASE_URL/macos/SentinelAgent-latest.pkg" "macOS PKG" || ((FAILED_AFTER_FIX++))
test_url "$BASE_URL/macos/SentinelAgent-latest.dmg" "macOS DMG" || ((FAILED_AFTER_FIX++))
test_url "$BASE_URL/windows/SentinelAgentSetup-latest.msi" "Windows MSI" || ((FAILED_AFTER_FIX++))
test_url "$BASE_URL/linux_deb/sentinel-agent_latest_amd64.deb" "Linux DEB" || ((FAILED_AFTER_FIX++))
test_url "$BASE_URL/linux_rpm/sentinel-agent-latest.x86_64.rpm" "Linux RPM" || ((FAILED_AFTER_FIX++))

echo ""
if [ $FAILED_AFTER_FIX -eq 0 ]; then
    echo -e "${GREEN}🎉 All permissions fixed successfully!${NC}"
    echo ""
    echo "Public download URLs:"
    echo "macOS: $BASE_URL/macos/SentinelAgent-latest.pkg"
    echo "Windows: $BASE_URL/windows/SentinelAgentSetup-latest.msi"
    echo "Linux DEB: $BASE_URL/linux_deb/sentinel-agent_latest_amd64.deb"
    echo "Linux RPM: $BASE_URL/linux_rpm/sentinel-agent-latest.x86_64.rpm"
else
    echo -e "${RED}❌ $FAILED_AFTER_FIX files still failed. Manual intervention required.${NC}"
    exit 1
fi
