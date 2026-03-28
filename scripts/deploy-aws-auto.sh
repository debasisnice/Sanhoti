#!/bin/bash

# Automated Deploy to AWS - Fully automated via SSH
# This script will push code to git and automatically deploy to AWS

set -e

# Configuration
AWS_KEY_PATH="$HOME/Downloads/sanhoti-keypair.pem"
AWS_USER="ubuntu"
AWS_HOST="44.220.179.207"
PROJECT_DIR="/var/www/sanhoti"

echo "🚀 Automated AWS Deployment"
echo "=========================="
echo ""

# 1. Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Warning: You have uncommitted changes."
    echo "   Files:"
    git status --short
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi

# 2. Push to git
echo "📤 Step 1: Pushing code to Git..."
if git push origin main; then
    echo "✅ Code pushed to Git successfully"
else
    echo "❌ Failed to push to Git"
    exit 1
fi
echo ""

# 3. Check if SSH key exists
if [ ! -f "$AWS_KEY_PATH" ]; then
    echo "❌ SSH key not found at: $AWS_KEY_PATH"
    echo "   Please update AWS_KEY_PATH in the script or place your key at that location"
    exit 1
fi

# 4. Deploy to AWS
echo "📦 Step 2: Deploying to AWS server..."
echo "   Connecting to: $AWS_USER@$AWS_HOST"
echo ""

# Create deployment script to run on remote server
DEPLOY_SCRIPT=$(cat <<'DEPLOY_EOF'
set -e
cd /var/www/sanhoti

echo "📥 Pulling latest code..."
git pull origin main || { echo "❌ Git pull failed"; exit 1; }

echo ""
echo "📦 Checking if dependencies need updating..."
cd frontend

# Check if package files changed
if git diff HEAD@{1} HEAD --name-only 2>/dev/null | grep -q 'package.json\|package-lock.json'; then
    echo "   Dependencies changed, running npm ci..."
    npm ci --prefer-offline || { echo "❌ npm ci failed"; exit 1; }
else
    echo "   ✅ Dependencies unchanged, skipping npm ci"
fi

echo ""
echo "🔨 Building frontend..."
npm run build || { echo "❌ Build failed"; exit 1; }

echo ""
echo "🔨 Building backend..."
cd ../backend
# PM2 runs dist/server.js — must compile TS after every pull or API behavior stays stale (local uses tsx on src).
if git diff HEAD@{1} HEAD --name-only 2>/dev/null | grep -qE '^backend/package\.json$|^backend/package-lock\.json$'; then
    echo "   Backend dependencies changed, running npm ci..."
    npm ci --prefer-offline || { echo "❌ Backend npm ci failed"; exit 1; }
else
    echo "   ✅ Backend dependencies unchanged, skipping npm ci"
fi
npm run build || { echo "❌ Backend build failed"; exit 1; }

echo ""
echo "🔄 Reloading services..."
cd ..
sudo systemctl reload nginx || { echo "⚠️  nginx reload warning (may be ok)"; }
pm2 restart sanhoti-backend || { echo "❌ pm2 restart failed"; exit 1; }

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Checking service status..."
pm2 status sanhoti-backend
DEPLOY_EOF
)

# Run deployment script on remote server
if ssh -i "$AWS_KEY_PATH" -o StrictHostKeyChecking=no "$AWS_USER@$AWS_HOST" "bash -s" <<< "$DEPLOY_SCRIPT"; then
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    echo "🌐 Your site should be live at: https://www.sanhoti.org"
else
    echo ""
    echo "❌ Deployment failed. Please check the errors above."
    exit 1
fi

