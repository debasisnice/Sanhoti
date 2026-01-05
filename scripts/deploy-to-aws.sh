#!/bin/bash

# Deploy to AWS - Run this from your local machine
# This script will push code to git and provide commands to run on AWS

set -e

echo "🚀 Deploying to AWS..."
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
git push origin main
if [ $? -eq 0 ]; then
    echo "✅ Code pushed to Git"
else
    echo "❌ Failed to push to Git"
    exit 1
fi
echo ""

# 3. Provide commands for AWS
echo "📋 Step 2: Run these commands on your AWS server:"
echo ""
echo "   ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207"
echo ""
echo "   Then run:"
echo ""
echo "   cd /var/www/sanhoti"
echo "   git pull origin main"
echo "   cd frontend"
echo "   npm ci"
echo "   npm run build"
echo "   cd .."
echo "   sudo systemctl reload nginx"
echo "   pm2 restart sanhoti-backend"
echo ""
echo "✅ Deployment instructions ready!"
echo ""
echo "💡 Tip: You can also run this on AWS server:"
echo "   cd /var/www/sanhoti && git pull origin main && cd frontend && npm ci && npm run build && cd .. && sudo systemctl reload nginx && pm2 restart sanhoti-backend"

