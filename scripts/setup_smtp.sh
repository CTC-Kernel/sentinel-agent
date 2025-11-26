#!/bin/bash

# Script to setup SMTP credentials for Firebase Functions
# Usage: ./scripts/setup_smtp.sh

echo "==================================================="
echo "   Sentinel GRC - SMTP Configuration Setup"
echo "==================================================="
echo ""
echo "This script will help you configure the SMTP settings for sending emails."
echo "If you are using Gmail, you MUST use an App Password."
echo "To generate one: Go to Google Account > Security > 2-Step Verification > App Passwords."
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "Error: 'firebase' command not found. Please install Firebase CLI."
    exit 1
fi

# Prompt for credentials
read -p "SMTP Host (default: smtp.gmail.com): " SMTP_HOST
SMTP_HOST=${SMTP_HOST:-smtp.gmail.com}

read -p "SMTP Port (default: 587): " SMTP_PORT
SMTP_PORT=${SMTP_PORT:-587}

read -p "SMTP User (your email): " SMTP_USER

echo -n "SMTP Password (app password): "
read -s SMTP_PASS
echo ""

if [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ]; then
    echo "Error: User and Password are required."
    exit 1
fi

echo ""
echo "Configuring Firebase secrets..."
echo "This may take a few moments."

# Resolve project root regardless of where script is called from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/functions/.env"

# Create or clear the file safely? 
# Better to append or replace specific keys. For simplicity in this helper script, we'll append/overwrite.
# But to avoid duplicates, let's just write a clean block or use sed if we wanted to be fancy.
# Since this is a setup script, let's just ensure these variables are set.

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    touch "$ENV_FILE"
fi

# Function to update or add a key-value pair
update_env() {
    key=$1
    value=$2
    if grep -q "^$key=" "$ENV_FILE"; then
        # Use sed to replace the line. Mac sed requires empty string for -i
        sed -i '' "s|^$key=.*|$key=\"$value\"|" "$ENV_FILE"
    else
        echo "$key=\"$value\"" >> "$ENV_FILE"
    fi
}

echo "Writing configuration to $ENV_FILE..."

update_env "SMTP_HOST" "$SMTP_HOST"
update_env "SMTP_PORT" "$SMTP_PORT"
update_env "SMTP_USER" "$SMTP_USER"
update_env "SMTP_PASS" "$SMTP_PASS"

echo ""
echo "==================================================="
echo "Configuration complete!"
echo "The credentials have been saved to $ENV_FILE."
echo "IMPORTANT: Do not commit this file to git if it contains real passwords."
echo ""
echo "To apply changes, deploy the functions:"
echo "firebase deploy --only functions"
echo "==================================================="
