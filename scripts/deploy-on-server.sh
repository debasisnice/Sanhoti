#!/bin/bash

# Simple deployment script for AWS server
# Run this directly on the AWS server: bash scripts/deploy-on-server.sh

set -e

cd /var/www/sanhoti

echo "📥 Pulling latest code..."
# Stash local changes to tracked data files (we'll drop the stash after pulling since we don't want local data changes)
echo "   Stashing local changes to tracked data files..."
git stash push -m "Deployment stash - data files" backend/data/users.json backend/data/documents.json backend/data/events.json backend/data/notices.json backend/data/rsvps.json backend/data/subEvents.json 2>/dev/null || true
git pull origin main
# Drop the stash since we don't want to keep local data file changes
git stash drop 2>/dev/null || true

echo "📦 Checking dependencies..."
cd frontend

# Smart check: only run npm ci if package files changed
PREV_HEAD=$(git rev-parse HEAD@{1} 2>/dev/null || echo "")
CURR_HEAD=$(git rev-parse HEAD)

if [ "$PREV_HEAD" != "$CURR_HEAD" ]; then
    # Check if package files changed between previous and current HEAD
    if git diff "$PREV_HEAD" "$CURR_HEAD" --name-only 2>/dev/null | grep -qE '(package\.json|package-lock\.json)'; then
        echo "   Dependencies changed, installing (this may take a few minutes)..."
        npm ci --prefer-offline --no-audit --silent
    else
        echo "   ✅ Dependencies unchanged, skipping npm ci (saves time!)"
    fi
else
    # First time or can't determine previous HEAD, check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "   Installing dependencies (this may take a few minutes)..."
        npm ci --prefer-offline --no-audit --silent
    else
        echo "   ✅ node_modules exists, skipping npm ci (saves time!)"
    fi
fi

echo "🔨 Building frontend (this may take a minute)..."
npm run build --silent
echo "   ✅ Build completed"

echo "🔄 Reloading services..."
cd ..
echo "   Reloading nginx..."
sudo systemctl reload nginx || echo "   ⚠️  Nginx reload had issues (may be ok)"
echo "   ✅ Nginx reloaded"

echo "   Restarting backend..."
pm2 restart sanhoti-backend || (echo "   ❌ PM2 restart failed" && exit 1)
echo "   ✅ Backend restarted"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Backend status:"
pm2 status sanhoti-backend

