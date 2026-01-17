#!/bin/bash
#
# Sentinel GRC - Cloud KMS Setup Script
# This script sets up the Cloud KMS infrastructure for the Document Vault
#
# Prerequisites:
# - Google Cloud SDK (gcloud) installed and authenticated
# - Appropriate IAM permissions (roles/cloudkms.admin)
#
# Usage: ./setup-kms.sh [PROJECT_ID]
#

set -e

# Configuration
LOCATION="europe-west1"
KEY_RING_ID="sentinel-vault"
CRYPTO_KEY_ID="documents-key"
ROTATION_PERIOD="7776000s"  # 90 days in seconds

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project ID from argument or gcloud config
PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No project ID specified and none found in gcloud config${NC}"
    echo "Usage: $0 [PROJECT_ID]"
    exit 1
fi

echo -e "${GREEN}Setting up Cloud KMS for Sentinel GRC${NC}"
echo "Project: $PROJECT_ID"
echo "Location: $LOCATION"
echo "Key Ring: $KEY_RING_ID"
echo "Crypto Key: $CRYPTO_KEY_ID"
echo ""

# Step 1: Enable Cloud KMS API
echo -e "${YELLOW}Step 1: Enabling Cloud KMS API...${NC}"
gcloud services enable cloudkms.googleapis.com --project="$PROJECT_ID"
echo -e "${GREEN}Cloud KMS API enabled${NC}"
echo ""

# Step 2: Create Key Ring (if not exists)
echo -e "${YELLOW}Step 2: Creating Key Ring...${NC}"
if gcloud kms keyrings describe "$KEY_RING_ID" \
    --location="$LOCATION" \
    --project="$PROJECT_ID" &>/dev/null; then
    echo "Key Ring '$KEY_RING_ID' already exists"
else
    gcloud kms keyrings create "$KEY_RING_ID" \
        --location="$LOCATION" \
        --project="$PROJECT_ID"
    echo -e "${GREEN}Key Ring '$KEY_RING_ID' created${NC}"
fi
echo ""

# Step 3: Create Crypto Key (if not exists)
echo -e "${YELLOW}Step 3: Creating Crypto Key...${NC}"
if gcloud kms keys describe "$CRYPTO_KEY_ID" \
    --keyring="$KEY_RING_ID" \
    --location="$LOCATION" \
    --project="$PROJECT_ID" &>/dev/null; then
    echo "Crypto Key '$CRYPTO_KEY_ID' already exists"
else
    gcloud kms keys create "$CRYPTO_KEY_ID" \
        --keyring="$KEY_RING_ID" \
        --location="$LOCATION" \
        --project="$PROJECT_ID" \
        --purpose="encryption" \
        --rotation-period="$ROTATION_PERIOD" \
        --next-rotation-time="$(date -u -v+90d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d '+90 days' '+%Y-%m-%dT%H:%M:%SZ')"
    echo -e "${GREEN}Crypto Key '$CRYPTO_KEY_ID' created with automatic rotation${NC}"
fi
echo ""

# Step 4: Grant Cloud Functions service account access
echo -e "${YELLOW}Step 4: Configuring IAM permissions...${NC}"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
CF_SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

# Grant encrypter/decrypter role
gcloud kms keys add-iam-policy-binding "$CRYPTO_KEY_ID" \
    --keyring="$KEY_RING_ID" \
    --location="$LOCATION" \
    --project="$PROJECT_ID" \
    --member="serviceAccount:$CF_SERVICE_ACCOUNT" \
    --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" \
    --quiet

echo -e "${GREEN}IAM permissions configured for $CF_SERVICE_ACCOUNT${NC}"
echo ""

# Step 5: Verify setup
echo -e "${YELLOW}Step 5: Verifying setup...${NC}"
KEY_PATH="projects/$PROJECT_ID/locations/$LOCATION/keyRings/$KEY_RING_ID/cryptoKeys/$CRYPTO_KEY_ID"
gcloud kms keys describe "$CRYPTO_KEY_ID" \
    --keyring="$KEY_RING_ID" \
    --location="$LOCATION" \
    --project="$PROJECT_ID" \
    --format="table(name,purpose,primary.state,rotationPeriod)"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Cloud KMS Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Key Path: $KEY_PATH"
echo ""
echo "Next steps:"
echo "1. Deploy Cloud Functions with: cd functions && npm run deploy"
echo "2. Test encryption by uploading a document to the vault"
echo ""
