#!/bin/bash

# Script to verify Apple Certificates and prepare Base64 secrets for GitHub Actions
# Used for troubleshootng: "APPLE_CERTIFICATE password is invalid or the .p12 is corrupted"

set -e

echo "=== Apple Certificate Secret Preparer ==="

read -p "Enter path to your .p12 certificate file: " CERTPATH
if [ ! -f "$CERTPATH" ]; then
    echo "Error: File not found at $CERTPATH"
    exit 1
fi

read -sp "Enter the password for this certificate: " CERTPASS
echo ""

echo "--- Verifying certificate with openssl ---"
# Try with -legacy (required for modern macOS exports if using OpenSSL 3)
if openssl pkcs12 -legacy -in "$CERTPATH" -passin "pass:$CERTPASS" -info -noout > /dev/null 2>&1; then
    echo "✅ Success: Certificate verified correctly (used -legacy flag)."
    USE_LEGACY=true
# Try without -legacy (for older exports or LibreSSL)
elif openssl pkcs12 -in "$CERTPATH" -passin "pass:$CERTPASS" -info -noout > /dev/null 2>&1; then
    echo "✅ Success: Certificate verified correctly (standard)."
    USE_LEGACY=false
else
    echo "❌ Error: Failed to verify certificate. Possible reasons:"
    echo "   1. Wrong password"
    echo "   2. Corrupted .p12 file"
    echo "   3. OpenSSL version mismatch"
    echo ""
    echo "Try to re-export the certificate from Keychain Access on macOS:"
    echo "1. Select 'Developer ID Application' certificate"
    echo "2. Right-click -> Export"
    echo "3. Use a simple password (avoid special characters that might need shell escaping)"
    exit 1
fi

echo "--- Generating Base64 Secret ---"
# Generate base64 without any line breaks
B64_SECRET=$(base64 < "$CERTPATH" | tr -d '\n\r ')

echo "✅ Base64 string generated successfully."
echo ""
echo "INSTRUCTIONS:"
echo "1. Copy the following Base64 string and paste it into GitHub Secret: APPLE_CERTIFICATE_P12"
echo "   (It is a single very long line)"
echo "--------------------------------------------------------------------------------"
echo "$B64_SECRET"
echo "--------------------------------------------------------------------------------"
echo ""
echo "2. Update GitHub Secret: APPLE_CERTIFICATE_PASSWORD with the password you just used."
echo ""
echo "--- Developer ID Installer Certificate (Optional) ---"
read -p "Do you also have a Developer ID Installer certificate to prepare? (y/n): " HAVE_INSTALLER
if [[ "$HAVE_INSTALLER" == "y"* ]]; then
    read -p "Enter path to your Installer .p12 file: " INSTALLER_PATH
    read -sp "Enter the password for this certificate: " INSTALLER_PASS
    echo ""
    
    if openssl pkcs12 -legacy -in "$INSTALLER_PATH" -passin "pass:$INSTALLER_PASS" -info -noout > /dev/null 2>&1 || \
       openssl pkcs12 -in "$INSTALLER_PATH" -passin "pass:$INSTALLER_PASS" -info -noout > /dev/null 2>&1; then
        echo "✅ Success: Installer certificate verified."
        INSTALLER_B64=$(base64 < "$INSTALLER_PATH" | tr -d '\n\r ')
        echo "Copy this to GitHub Secret: APPLE_INSTALLER_CERTIFICATE_P12"
        echo "--------------------------------------------------------------------------------"
        echo "$INSTALLER_B64"
        echo "--------------------------------------------------------------------------------"
        echo "Update GitHub Secret: APPLE_INSTALLER_CERTIFICATE_PASSWORD"
    else
        echo "❌ Error: Failed to verify installer certificate."
    fi
fi
