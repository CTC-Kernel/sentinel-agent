# Firebase Storage Permissions Guide

## Overview

Sentinel GRC Agent downloads are stored in Firebase Storage and require proper public access permissions to be downloadable by end users.

## Problem

Firebase Storage objects are private by default. When new releases are uploaded, permissions may not be correctly applied, resulting in 403 Access Denied errors.

## Solutions

### 1. Automated Fix (Recommended)

#### GitHub Actions Workflow
- **File**: `.github/workflows/fix-permissions.yml`
- **Triggers**: 
  - Manual dispatch (on-demand)
  - Scheduled every 6 hours
- **Action**: Runs the permissions fix script automatically

#### Release Workflow Integration
- **File**: `.github/workflows/release.yml` (lines 661-677)
- **Action**: Applies permissions automatically after each release upload

### 2. Manual Fix

#### Quick Script
```bash
cd sentinel-agent
./scripts/fix-permissions.sh
```

#### Individual Commands
```bash
# Set public read ACL on all objects
gsutil -m acl set -R public-read gs://sentinel-grc-a8701.firebasestorage.app/releases/agent

# Set IAM policy binding as fallback
gcloud storage objects add-iam-policy-binding "gs://sentinel-grc-a8701.firebasestorage.app/releases/agent/**" \
  --member="allUsers" \
  --role="roles/storage.objectViewer"
```

## Public Download URLs

Once permissions are fixed, these URLs should return HTTP 200:

### Latest Releases
- **macOS PKG**: https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/macos/SentinelAgent-latest.pkg
- **macOS DMG**: https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/macos/SentinelAgent-latest.dmg
- **Windows MSI**: https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/windows/SentinelAgentSetup-latest.msi
- **Linux DEB**: https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/linux_deb/sentinel-agent_latest_amd64.deb
- **Linux RPM**: https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/linux_rpm/sentinel-agent-latest.x86_64.rpm

## Testing Permissions

### Quick Test
```bash
# Test all download URLs
curl -I https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/macos/SentinelAgent-latest.pkg
curl -I https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/windows/SentinelAgentSetup-latest.msi
```

### Automated Test
Run the fix script - it will test all URLs and report status:
```bash
./scripts/fix-permissions.sh
```

## Troubleshooting

### 403 Access Denied
1. Run the permissions fix script
2. Check if GCP credentials are correctly configured
3. Verify the bucket name is correct

### Permissions Revert
If permissions keep reverting:
1. Check the release workflow logs
2. Ensure the fix-permissions workflow is enabled
3. Manually trigger the fix-permissions workflow

### CORS Issues
If downloads work but web UI can't access files:
```bash
gcloud storage buckets update gs://sentinel-grc-a8701.firebasestorage.app \
  --cors-file=.github/workflows/cors-config.json
```

## Monitoring

### GitHub Actions
- **Release Workflow**: Automatically applies permissions on each release
- **Fix Permissions Workflow**: Runs every 6 hours as backup
- **Manual Trigger**: Can be run on-demand from GitHub Actions tab

### Health Check
The fix script includes comprehensive testing and will report:
- Which URLs are accessible
- HTTP status codes
- Success/failure status

## Best Practices

1. **Always test after releases**: Verify downloads work after each deployment
2. **Monitor scheduled runs**: Check the 6-hourly workflow results
3. **Keep scripts updated**: Ensure the fix script matches current file structure
4. **Document changes**: Update this guide when adding new platforms or changing URLs

## Security Considerations

- Only the `/releases/agent/` folder is made public
- Individual file permissions are set to `public-read`
- IAM policy binding provides fallback access
- No sensitive data is exposed - only agent installers

## Support

For permission issues:
1. Check GitHub Actions logs
2. Run the manual fix script
3. Verify GCP credentials and permissions
4. Contact the DevOps team if issues persist
