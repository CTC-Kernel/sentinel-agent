# GitHub Actions Secrets Configuration

This document outlines all required and optional secrets for the Sentinel Agent GitHub Actions workflow.

## Required Secrets for macOS Build

### APPLE_CERTIFICATE
- **Type**: Required
- **Description**: Base64-encoded Developer ID Application certificate (.p12 file)
- **How to create**:
  1. Open Keychain Access on macOS
  2. Select your Developer ID Application certificate
  3. Right-click → Export "Developer ID Application: Your Name"
  4. Save as .p12 format with a strong password
  5. Encode to base64: `base64 -i certificate.p12 | tr -d '\n'`
- **Validation**: Checked during build, will fail if missing

### APPLE_CERTIFICATE_PASSWORD
- **Type**: Required
- **Description**: Password for the Developer ID Application certificate
- **How to get**: Use the password you set when exporting the certificate
- **Validation**: Checked during build, will fail if missing

## Optional Secrets for Enhanced Features

### APPLE_INSTALLER_CERTIFICATE_P12
- **Type**: Optional
- **Description**: Base64-encoded Developer ID Installer certificate (.p12 file)
- **Purpose**: Required for package notarization
- **How to create**: Same process as APPLE_CERTIFICATE but with Developer ID Installer certificate
- **Validation**: Optional, but if provided, APPLE_INSTALLER_CERTIFICATE_PASSWORD is required

### APPLE_INSTALLER_CERTIFICATE_PASSWORD
- **Type**: Optional (Required if APPLE_INSTALLER_CERTIFICATE_P12 is set)
- **Description**: Password for the Developer ID Installer certificate
- **Validation**: Must be provided if APPLE_INSTALLER_CERTIFICATE_P12 is set

## Required Secrets for Firebase Upload

### GCP_SA_KEY
- **Type**: Required for Firebase uploads
- **Description**: Base64-encoded Google Cloud service account JSON key
- **How to create**:
  1. Go to Google Cloud Console → IAM & Admin → Service Accounts
  2. Create a service account with Firebase Storage permissions
  3. Download the JSON key file
  4. Encode to base64: `base64 -i service-account-key.json | tr -d '\n'`
- **Validation**: Checked during upload, will fail if missing

## Required Secrets for Notarization

### APPLE_ID
- **Type**: Required for notarization
- **Description**: Apple ID email address for App Store Connect
- **Format**: Email address (e.g., developer@example.com)
- **Validation**: Optional for basic build, required for notarization

### APPLE_APP_PASSWORD
- **Type**: Required for notarization
- **Description**: App-specific password for Apple ID
- **How to create**:
  1. Go to appleid.apple.com
  2. Sign in with your Apple ID
  3. Go to Security → App-Specific Passwords
  4. Generate a new password
- **Validation**: Optional for basic build, required for notarization

### APPLE_TEAM_ID
- **Type**: Required for notarization
- **Description**: Apple Developer Team ID (10-character string)
- **How to find**: Go to developer.apple.com → Account → Membership
- **Format**: 10-character alphanumeric string (e.g., ABC1234567)
- **Validation**: Optional for basic build, required for notarization

## Setup Instructions

### 1. Navigate to Repository Settings
1. Go to your GitHub repository
2. Click "Settings" tab
3. Click "Secrets and variables" → "Actions"
4. Click "New repository secret"

### 2. Add Each Secret
For each secret listed above:

1. **Name**: Use the exact name from this document
2. **Secret**: Paste the value (base64-encoded for certificates/keys)
3. **Add secret**

### 3. Verify Configuration
After adding all secrets, you can test the workflow:

```bash
# Trigger a test build
git tag v2.0.0-test
git push origin v2.0.0-test
```

## Troubleshooting

### Secret Validation Errors
If you see "secret is not set" errors:

1. **Check spelling**: Ensure secret names match exactly
2. **Check permissions**: Ensure Actions have access to secrets
3. **Check environment**: Some secrets are only available in specific jobs

### Certificate Import Failures
If certificate import fails:

1. **Verify base64 encoding**: Re-encode the certificate file
2. **Check password**: Ensure password matches the exported certificate
3. **Check certificate type**: Ensure it's Developer ID Application, not Apple Development

### GCP Authentication Failures
If Firebase upload fails:

1. **Verify JSON format**: Check that the service account key is valid JSON
2. **Check permissions**: Ensure service account has Firebase Storage access
3. **Check base64 encoding**: Re-encode the JSON key file

### Notarization Failures
If notarization fails:

1. **Check Apple ID**: Ensure Apple ID and password are correct
2. **Check Team ID**: Verify Team ID matches your Developer account
3. **Check certificates**: Ensure you have both Developer ID Application and Installer certificates

## Security Best Practices

### Certificate Management
- Store certificates securely in Keychain Access
- Use strong, unique passwords for certificate exports
- Rotate certificates annually or when compromised
- Limit certificate access to necessary team members

### Service Account Keys
- Use least-privilege service accounts
- Rotate keys regularly
- Monitor key usage in Google Cloud
- Delete unused service accounts

### Apple ID Security
- Use app-specific passwords, not your main Apple password
- Enable two-factor authentication on Apple ID
- Monitor App Store Connect for unauthorized access
- Revoke unused app-specific passwords

## Testing Locally

You can test secrets locally before committing:

```bash
# Test certificate import
export APPLE_CERTIFICATE="base64-encoded-cert"
export APPLE_CERTIFICATE_PASSWORD="your-password"
./test-certificate-import.sh

# Test GCP authentication
export GCP_SA_KEY="base64-encoded-key"
echo $GCP_SA_KEY | base64 --decode > test-key.json
gcloud auth activate-service-account --key-file=test-key.json
rm test-key.json
```

## Emergency Procedures

### Certificate Compromise
1. Revoke certificate in Apple Developer portal
2. Generate new certificate
3. Update GitHub secrets
4. Rotate all related passwords

### Service Account Compromise
1. Disable service account in Google Cloud
2. Create new service account with minimal permissions
3. Update GitHub secrets
4. Review access logs

### Apple ID Compromise
1. Change Apple ID password immediately
2. Revoke all app-specific passwords
3. Generate new app-specific password
4. Update GitHub secrets

## Contact Support

For issues with:
- **Apple Developer certificates**: Contact Apple Developer Support
- **Google Cloud authentication**: Contact Google Cloud Support
- **GitHub Actions**: Contact GitHub Support
- **Repository-specific issues**: Contact repository maintainers

---

**Last Updated**: 2026-02-03
**Version**: 2.0.0
