#!/bin/bash

# Pull production data to local
# This script will download all JSON data files and uploaded files from production server

set -e

echo "📥 Pulling production data to local..."
echo ""

# Configuration
PROD_SERVER="ubuntu@44.220.179.207"
PROD_PATH="/var/www/sanhoti/backend/data"
LOCAL_PATH="./backend/data"
SSH_KEY="${HOME}/Downloads/sanhoti-keypair.pem"

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH key not found at: $SSH_KEY"
    echo "   Please update the SSH_KEY path in this script or place your key at the expected location"
    exit 1
fi

# Create local data directory if it doesn't exist
mkdir -p "$LOCAL_PATH"

echo "📋 Step 1: Downloading JSON data files..."
echo ""

# List of JSON files to download (missing files on prod are skipped safely).
JSON_FILES=(
    "events.json"
    "subEvents.json"
    "rsvps.json"
    "galleries.json"
    "magazines.json"
    "news.json"
    "notices.json"
    "documents.json"
    "users.json"
    "settings.json"
    "messages.json"
    "auditLogs.json"
    "durgaPujaPage.json"
    # Ticketing / seat booking data
    "ticketingProfile.json"
    "seatMaps.json"
    "seatMapTemplates.json"
    "theaterMaps.json"
    "ticketSetups.json"
    "seatBookings.json"
    "seatHolds.json"
    "seatingConfig.json"
    "discountCodes.json"
)

# Download each JSON file
for file in "${JSON_FILES[@]}"; do
    echo "   Downloading $file..."
    scp -i "$SSH_KEY" "$PROD_SERVER:$PROD_PATH/$file" "$LOCAL_PATH/$file" 2>/dev/null || {
        echo "   ⚠️  $file not found on production server (skipping)"
    }
done

echo ""
echo "✅ JSON data files downloaded"
echo ""

# Ask if user wants to download uploaded files (images, PDFs, etc.)
read -p "📁 Do you want to download uploaded files (images, PDFs, etc.)? This may take a while. (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📋 Step 2: Downloading uploaded files..."
    echo ""
    
    # Directories to sync
    DIRS=(
        "Events_Flyers"
        "Galleries"
        "Magazines"
        "Notice_Flyers"
        "Documents"
        "HomePage_Images"
        "Sponsors"
        "BoardMembers"
        "PaymentQR"
    )
    
    for dir in "${DIRS[@]}"; do
        echo "   Syncing $dir..."
        rsync -avz --delete -e "ssh -i $SSH_KEY" "$PROD_SERVER:$PROD_PATH/$dir/" "$LOCAL_PATH/$dir/" 2>/dev/null || {
            echo "   ⚠️  $dir not found on production server (skipping)"
        }
    done
    
    echo ""
    echo "✅ Uploaded files synced"
else
    echo ""
    echo "⏭️  Skipping uploaded files download"
fi

echo ""
echo "✅ Production data pull complete!"
echo ""
echo "📝 Note: Your local data files have been updated with production data."
echo "   Make sure to backup your local data if needed before running this script."

