#!/bin/bash

# Script to configure SMTP secrets for Firebase Functions
# Usage: ./scripts/setup_smtp.sh

echo "==============================================="
echo "  Sentinel GRC - SMTP Configuration Setup"
echo "==============================================="
echo ""
echo "This script will help you set the SMTP secrets required for sending emails."
echo "You will need your SMTP provider details (Host, Port, User, Password)."
echo ""
echo "NOTE: This requires the Firebase CLI to be logged in and the project selected."
echo ""

read -p "Enter SMTP Host (e.g., smtp.sendgrid.net): " SMTP_HOST
read -p "Enter SMTP Port (e.g., 587): " SMTP_PORT
read -p "Enter SMTP User: " SMTP_USER
read -s -p "Enter SMTP Password: " SMTP_PASS
echo ""

if [ -z "$SMTP_HOST" ] || [ -z "$SMTP_PORT" ] || [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ]; then
  echo "Error: All fields are required."
  exit 1
fi

echo ""
echo "Setting secrets in Firebase..."

# Use firebase functions:secrets:set if available, or params
# Since the code uses defineString/defineInt which map to params/secrets
# We will create a .env.local file for local emulation and suggest commands for prod

echo "Creating .env.local for local testing..."
cat <<EOF > functions/.env.local
SMTP_HOST="$SMTP_HOST"
SMTP_PORT="$SMTP_PORT"
SMTP_USER="$SMTP_USER"
SMTP_PASS="$SMTP_PASS"
EOF

echo "✅ functions/.env.local created."

echo ""
echo "To deploy these secrets to production, run the following commands:"
echo ""
echo "firebase functions:secrets:set SMTP_HOST"
echo "firebase functions:secrets:set SMTP_PORT"
echo "firebase functions:secrets:set SMTP_USER"
echo "firebase functions:secrets:set SMTP_PASS"
echo ""
echo "Then redeploy your functions:"
echo "firebase deploy --only functions"
echo ""
echo "Done."
