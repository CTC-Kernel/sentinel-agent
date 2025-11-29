#!/bin/bash

# Sentinel GRC - Email Configuration Script
# This script helps you configure the SMTP settings for Firebase Functions.

echo "=================================================="
echo "   Sentinel GRC - Email Configuration Setup"
echo "=================================================="
echo ""
echo "This script will set the necessary Firebase secrets/parameters for email sending."
echo "You will need your SMTP provider details (e.g., Gmail, SendGrid, Mailgun)."
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "Error: 'firebase' command not found. Please install Firebase CLI."
    exit 1
fi

# Prompt for SMTP Host
read -p "Enter SMTP Host (default: ssl0.ovh.net): " SMTP_HOST
SMTP_HOST=${SMTP_HOST:-ssl0.ovh.net}

# Prompt for SMTP Port
read -p "Enter SMTP Port (default: 465): " SMTP_PORT
SMTP_PORT=${SMTP_PORT:-465}

# Prompt for SMTP User
read -p "Enter SMTP User (default: postmaster@cyber-threat-consulting.com): " SMTP_USER
SMTP_USER=${SMTP_USER:-postmaster@cyber-threat-consulting.com}

# Prompt for SMTP Password (hidden input)
read -s -p "Enter SMTP Password (default: Al21689a!): " SMTP_PASS
echo ""
SMTP_PASS=${SMTP_PASS:-Al21689a!}

echo ""
echo "Configuring Firebase parameters..."
echo "----------------------------------"

# Set the parameters using firebase functions:secrets:set or .env file approach?
# Since the code uses defineString/defineInt which can read from .env or params.
# We will create a .env.local file in functions/ directory for local testing
# and guide user to use firebase functions:config:set or secrets for production.

# For Gen 2 functions using params, we should use a .env file for deployment
ENV_FILE="functions/.env"

# Check if .env exists, if not create it
if [ ! -f "$ENV_FILE" ]; then
    touch "$ENV_FILE"
fi

# Function to update or add a key-value pair in .env
update_env() {
    local key=$1
    local value=$2
    if grep -q "^$key=" "$ENV_FILE"; then
        # Use sed to replace the line. Mac requires '' for -i
        sed -i '' "s|^$key=.*|$key=\"$value\"|" "$ENV_FILE"
    else
        echo "$key=\"$value\"" >> "$ENV_FILE"
    fi
}

update_env "SMTP_HOST" "$SMTP_HOST"
update_env "SMTP_PORT" "$SMTP_PORT"
update_env "SMTP_USER" "$SMTP_USER"
update_env "SMTP_PASS" "$SMTP_PASS"

echo "✅ Configuration saved to $ENV_FILE"
echo ""
echo "=================================================="
echo "   Next Steps:"
echo "=================================================="
echo "1. Deploy the functions to apply changes:"
echo "   firebase deploy --only functions"
echo ""
echo "2. If using Gmail, make sure you are using an 'App Password'."
echo "   (Account > Security > 2-Step Verification > App Passwords)"
echo ""
echo "Done."
