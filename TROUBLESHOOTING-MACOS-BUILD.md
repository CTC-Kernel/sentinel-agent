# macOS Build Troubleshooting Guide

## Issue: Certificate Import Failure

**Error**: `security: SecKeychainItemImport: One or more parameters passed to a function were not valid.`

### Root Cause Analysis

The certificate import failure in GitHub Actions typically occurs due to:

1. **Invalid certificate format** - Base64 decoding produces corrupted file
2. **Incorrect certificate password** - Password doesn't match the P12 file
3. **Keychain access issues** - Default keychain permissions or conflicts
4. **Expired/revoked certificate** - Certificate no longer valid for signing

### Solution Implemented

#### 1. Dedicated Keychain Management
```bash
# Create isolated keychain to avoid conflicts
security create-keychain -p "$RUNNER_TEMP" "$KEYCHAIN_PATH"
security default-keychain -s "$KEYCHAIN_PATH"
security unlock-keychain -p "$RUNNER_TEMP" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
```

#### 2. Enhanced Certificate Validation
```bash
# Verify certificate file exists and is not empty
if [ ! -s "$CERTIFICATE_PATH" ]; then
    echo "::error::Certificate file is empty or invalid"
    exit 1
fi
```

#### 3. Explicit Keychain Specification
```bash
# Import with explicit keychain and error handling
security import "$CERTIFICATE_PATH" \
    -k "$KEYCHAIN_PATH" \
    -P "$APPLE_CERTIFICATE_PASSWORD" \
    -T /usr/bin/codesign \
    -T /usr/bin/productbuild \
    -A
```

#### 4. Comprehensive Error Reporting
```bash
# List imported identities for verification
echo "=== Imported identities ==="
security find-identity -v -p codesigning "$KEYCHAIN_PATH"
```

### Troubleshooting Steps

#### Step 1: Validate Certificate Secrets
1. Check GitHub repository secrets:
   - `APPLE_CERTIFICATE` - Base64 encoded P12 file
   - `APPLE_CERTIFICATE_PASSWORD` - Password for the P12 file
   - `APPLE_INSTALLER_CERTIFICATE_P12` - Optional installer certificate
   - `APPLE_INSTALLER_CERTIFICATE_PASSWORD` - Password for installer certificate

2. Test certificate locally:
```bash
# Set environment variables
export APPLE_CERTIFICATE="base64-encoded-p12"
export APPLE_CERTIFICATE_PASSWORD="your-password"

# Run test script
./test-certificate-import.sh
```

#### Step 2: Verify Certificate Format
```bash
# Decode and verify certificate
echo "base64-data" | base64 --decode > certificate.p12
openssl pkcs12 -info -in certificate.p12 -passin pass:password
```

#### Step 3: Check Certificate Validity
```bash
# Check expiration dates
security find-identity -v -p codesigning
# Or with OpenSSL
openssl pkcs12 -info -in certificate.p12 -passin pass:password | grep -i "not after"
```

#### Step 4: Validate Apple Developer Account
1. Ensure Developer ID Application certificate is active
2. Check if certificate is revoked or expired
3. Verify certificate matches the Team ID used for notarization

### Common Issues and Solutions

#### Issue: "Certificate file is empty or invalid"
**Cause**: Base64 encoding/decoding error
**Solution**: 
- Re-encode the P12 file: `base64 -i certificate.p12`
- Ensure no line breaks in the base64 string
- Check for trailing newlines

#### Issue: "Invalid certificate password"
**Cause**: Password doesn't match P12 file
**Solution**:
- Verify password with: `openssl pkcs12 -info -in cert.p12 -passin pass:password`
- Re-export certificate from Keychain Access with correct password

#### Issue: "No Developer ID Application certificate found"
**Cause**: Certificate not imported or wrong type
**Solution**:
- Check certificate type: `security find-identity -v -p codesigning`
- Ensure it's "Developer ID Application" not just "Apple Development"

#### Issue: "Certificate expired"
**Cause**: Certificate has passed expiration date
**Solution**:
- Generate new certificate from Apple Developer portal
- Update repository secrets with new certificate

### Build Process Flow

1. **Certificate Import** (Fixed)
   - Create dedicated keychain
   - Validate certificate file
   - Import with explicit keychain
   - Verify identities

2. **Universal Binary Creation**
   - Build ARM64 and x86_64 targets
   - Combine with `lipo`

3. **Application Bundle Creation**
   - Create .app structure
   - Copy binary and resources
   - Sign with Developer ID

4. **Package Creation**
   - Build component package
   - Create distribution XML
   - Sign installer package

5. **Notarization** (Optional)
   - Submit to Apple notary service
   - Staple ticket to package

### Monitoring and Maintenance

#### Regular Checks
- Monitor certificate expiration dates
- Verify GitHub Actions secrets are current
- Test build process after certificate renewal

#### Automation
- Set up alerts for certificate expiration (30 days before)
- Automate certificate renewal process
- Validate secrets after updates

### Emergency Procedures

#### Certificate Compromise
1. Revoke compromised certificate immediately
2. Generate new certificate from Apple Developer portal
3. Update all repository secrets
4. Revoke existing app notarization if needed

#### Build Failure Recovery
1. Check GitHub Actions logs for specific error
2. Run local test script to validate certificate
3. Verify certificate validity in Keychain Access
4. Update secrets if certificate expired

### Support Resources

- Apple Developer Documentation: Code Signing
- GitHub Actions Documentation: macOS
- Xcode Documentation: Distribution

### Version History

- **v2.0.0**: Implemented dedicated keychain management
- **v1.9.0**: Added certificate validation
- **v1.8.0**: Initial certificate import implementation
