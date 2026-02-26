#!/usr/bin/env bash
# fix-permissions.sh — Ensure Firebase Storage permissions stay correct
# for agent release files (public read, CORS, cache headers).
#
# Called by .github/workflows/fix-permissions.yml every 6 hours
# and on manual workflow_dispatch.

set -euo pipefail

BUCKET_NAME="sentinel-grc-a8701.firebasestorage.app"
BUCKET="gs://${BUCKET_NAME}/releases/agent"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CORS_FILE="${SCRIPT_DIR}/../.github/workflows/cors-config.json"

echo "=== Fix Firebase Storage Permissions ==="
echo "Bucket: ${BUCKET}"
echo "Date:   $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# ── 1. CORS ──────────────────────────────────────────────────────────
echo ""
echo "--- Applying CORS configuration ---"
if [ -f "$CORS_FILE" ]; then
  gcloud storage buckets update "gs://${BUCKET_NAME}" --cors-file="$CORS_FILE"
  echo "CORS applied from ${CORS_FILE}"
else
  echo "Warning: CORS file not found at ${CORS_FILE}, skipping"
fi

# ── 2. Public read ACL on release objects ────────────────────────────
echo ""
echo "--- Setting public-read ACL on release objects ---"
gsutil -m acl set -R public-read "$BUCKET" || true

# ── 3. IAM policy binding (fallback) ────────────────────────────────
echo ""
echo "--- Setting IAM policy binding ---"
gcloud storage objects add-iam-policy-binding "${BUCKET}/**" \
  --member="allUsers" \
  --role="roles/storage.objectViewer" 2>/dev/null || true

# ── 4. Content types ────────────────────────────────────────────────
echo ""
echo "--- Setting content types ---"
gcloud storage objects update "${BUCKET}/macos/*.pkg"      --content-type="application/vnd.apple.installer+xml"  2>/dev/null || true
gcloud storage objects update "${BUCKET}/windows/*.msi"    --content-type="application/x-msi"                    2>/dev/null || true
gcloud storage objects update "${BUCKET}/linux_deb/*.deb"  --content-type="application/vnd.debian.binary-package" 2>/dev/null || true
gcloud storage objects update "${BUCKET}/linux_rpm/*.rpm"  --content-type="application/x-rpm"                    2>/dev/null || true
gcloud storage objects update "${BUCKET}/release-info.json" --content-type="application/json"                    2>/dev/null || true
gcloud storage objects update "${BUCKET}/**/*.txt"         --content-type="text/plain"                           2>/dev/null || true

# ── 5. Cache-Control headers ────────────────────────────────────────
echo ""
echo "--- Setting Cache-Control headers ---"
gcloud storage objects update "${BUCKET}/**/latest*"        --cache-control="public, max-age=3600, no-cache" 2>/dev/null || true
gcloud storage objects update "${BUCKET}/release-info.json" --cache-control="public, max-age=300"            2>/dev/null || true

# ── 6. Verify ───────────────────────────────────────────────────────
echo ""
echo "--- Verifying public access ---"
BASE_URL="https://storage.googleapis.com/${BUCKET_NAME}/releases/agent"

FAILED=0
for path in \
  "macos/SentinelAgent-latest.pkg" \
  "windows/SentinelAgentSetup-latest.msi" \
  "release-info.json"; do

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/${path}")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  OK  ${path} (${HTTP_CODE})"
  else
    echo "  WARN ${path} (${HTTP_CODE})"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "All permission checks passed"
else
  echo "Warning: ${FAILED} file(s) returned non-200 status (may not exist yet)"
fi

echo "=== Done ==="
