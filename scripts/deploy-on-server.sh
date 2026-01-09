#!/bin/bash

# Simple deployment script for AWS server
# Run this directly on the AWS server: bash scripts/deploy-on-server.sh

set -e

cd /var/www/sanhoti

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Checking dependencies..."
cd frontend

# Smart check: only run npm ci if package files changed
PREV_HEAD=$(git rev-parse HEAD@{1} 2>/dev/null || echo "")
CURR_HEAD=$(git rev-parse HEAD)

if [ "$PREV_HEAD" != "$CURR_HEAD" ]; then
    # Check if package files changed between previous and current HEAD
    if git diff "$PREV_HEAD" "$CURR_HEAD" --name-only 2>/dev/null | grep -qE '(package\.json|package-lock\.json)'; then
        echo "   Dependencies changed, installing..."
        npm ci --prefer-offline
    else
        echo "   ✅ Dependencies unchanged, skipping npm ci"
    fi
else
    # First time or can't determine previous HEAD, check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "   Installing dependencies..."
        npm ci --prefer-offline
    else
        echo "   ✅ node_modules exists, skipping npm ci"
    fi
fi

echo "🔨 Building frontend..."
npm run build

echo "🔄 Reloading services..."
cd ..
sudo systemctl reload nginx
pm2 restart sanhoti-backend

echo "✅ Deployment complete!"
pm2 status sanhoti-backend

