#!/bin/bash

# Script to restore data files to AWS server
# Run this from your LOCAL machine (not on AWS server)
# Usage: bash scripts/restore-data-to-server.sh

set -e

# Configuration
AWS_USER="ubuntu"
AWS_HOST="44.220.179.207"
AWS_KEY_PATH="~/Downloads/sanhoti-keypair.pem"
REMOTE_DATA_DIR="/var/www/sanhoti/backend/data"
LOCAL_DATA_DIR="backend/data"

echo "🔄 Restoring data files to AWS server..."
echo ""

# Check if key file exists
if [ ! -f "${AWS_KEY_PATH/#\~/$HOME}" ]; then
    echo "❌ SSH key not found at: $AWS_KEY_PATH"
    echo "   Please update AWS_KEY_PATH in this script"
    exit 1
fi

# Files to restore
DATA_FILES=(
    "events.json"
    "users.json"
    "notices.json"
    "documents.json"
    "rsvps.json"
    "subEvents.json"
    "galleries.json"
    "magazines.json"
    "messages.json"
    "settings.json"
)

# Copy each file
for file in "${DATA_FILES[@]}"; do
    if [ -f "$LOCAL_DATA_DIR/$file" ]; then
        echo "   Copying $file..."
        scp -i "${AWS_KEY_PATH/#\~/$HOME}" \
            "$LOCAL_DATA_DIR/$file" \
            "$AWS_USER@$AWS_HOST:$REMOTE_DATA_DIR/$file"
        echo "   ✅ $file restored"
    else
        echo "   ⚠️  $file not found locally, skipping"
    fi
done

echo ""
echo "✅ Data restoration complete!"
echo ""
echo "🔄 Now restart the backend on AWS server:"
echo "   ssh -i $AWS_KEY_PATH $AWS_USER@$AWS_HOST"
echo "   pm2 restart sanhoti-backend"

