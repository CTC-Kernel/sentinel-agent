#!/bin/bash

# Test script for certificate import validation
# This script helps diagnose certificate import issues

set -e

echo "=== Certificate Import Test ==="
echo "This script tests the certificate import process locally"
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script must be run on macOS"
    exit 1
fi

# Test variables (replace with actual values for testing)
TEST_CERTIFICATE_BASE64="${APPLE_CERTIFICATE:-""}"
TEST_CERTIFICATE_PASSWORD="${APPLE_CERTIFICATE_PASSWORD:-""}"

if [[ -z "$TEST_CERTIFICATE_BASE64" ]]; then
    echo "❌ APPLE_CERTIFICATE environment variable not set"
    echo "   Set it to test certificate import:"
    echo "   export APPLE_CERTIFICATE='base64-encoded-p12-file'"
    exit 1
fi

if [[ -z "$TEST_CERTIFICATE_PASSWORD" ]]; then
    echo "❌ APPLE_CERTIFICATE_PASSWORD environment variable not set"
    echo "   Set it to test certificate import:"
    echo "   export APPLE_CERTIFICATE_PASSWORD='your-certificate-password'"
    exit 1
fi

# Create test environment
TEMP_DIR=$(mktemp -d)
CERTIFICATE_PATH="$TEMP_DIR/test_certificate.p12"
KEYCHAIN_PATH="$TEMP_DIR/test.keychain-db"

echo "📁 Test directory: $TEMP_DIR"
echo "🔑 Certificate path: $CERTIFICATE_PATH"
echo "🗝️  Keychain path: $KEYCHAIN_PATH"
echo ""

# Decode certificate
echo "📦 Decoding certificate..."
echo -n "$TEST_CERTIFICATE_BASE64" | base64 --decode --output "$CERTIFICATE_PATH"
CERT_SIZE=$(wc -c < "$CERTIFICATE_PATH")
echo "   Certificate file size: $CERT_SIZE bytes"

if [[ ! -s "$CERTIFICATE_PATH" ]]; then
    echo "❌ Certificate file is empty or invalid"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "✅ Certificate decoded successfully"
echo ""

# Create test keychain
echo "🔐 Creating test keychain..."
security create-keychain -p "test-password" "$KEYCHAIN_PATH"
security default-keychain -s "$KEYCHAIN_PATH"
security unlock-keychain -p "test-password" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
echo "✅ Test keychain created"
echo ""

# Test certificate import
echo "🔑 Testing certificate import..."
if security import "$CERTIFICATE_PATH" \
    -k "$KEYCHAIN_PATH" \
    -P "$TEST_CERTIFICATE_PASSWORD" \
    -T /usr/bin/codesign \
    -T /usr/bin/productbuild \
    -A; then
    echo "✅ Certificate import successful"
else
    echo "❌ Certificate import failed"
    echo ""
    echo "Possible causes:"
    echo "  - Invalid certificate password"
    echo "  - Corrupted certificate file"
    echo "  - Expired certificate"
    echo "  - Wrong certificate format"
    
    # Try to get more info about the certificate
    echo ""
    echo "🔍 Certificate info:"
    if command -v openssl &> /dev/null; then
        openssl pkcs12 -info -in "$CERTIFICATE_PATH" -passin pass:"$TEST_CERTIFICATE_PASSWORD" || echo "   Could not read certificate with OpenSSL"
    fi
    
    rm -rf "$TEMP_DIR"
    exit 1
fi

# List identities
echo ""
echo "📋 Imported identities:"
security find-identity -v -p codesigning "$KEYCHAIN_PATH" || echo "   No code signing identities found"

# Cleanup
echo ""
echo "🧹 Cleaning up..."
rm -rf "$TEMP_DIR"
echo "✅ Test completed successfully"
