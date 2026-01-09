#!/bin/bash

# Fast Deploy to AWS - Optimized version
# This script will push code to git and provide optimized commands to run on AWS

set -e

echo "🚀 Fast Deploying to AWS..."
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

# 3. Provide optimized commands for AWS
echo "📋 Step 2: Run these OPTIMIZED commands on your AWS server:"
echo ""
echo "   ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207"
echo ""
echo "   Then run:"
echo ""
echo "   cd /var/www/sanhoti"
echo "   git pull origin main"
echo "   cd frontend"
echo "   # Only install if package files changed, otherwise skip"
echo "   if git diff HEAD@{1} HEAD --name-only | grep -q 'package.json\|package-lock.json'; then"
echo "     npm ci --prefer-offline"
echo "   else"
echo "     echo 'Dependencies unchanged, skipping npm ci'"
echo "   fi"
echo "   npm run build"
echo "   cd .."
echo "   sudo systemctl reload nginx"
echo "   pm2 restart sanhoti-backend"
echo ""
echo "✅ Fast deployment instructions ready!"
echo ""
echo "💡 Or run this optimized single command on AWS server:"
echo "   cd /var/www/sanhoti && git pull origin main && cd frontend && (git diff HEAD@{1} HEAD --name-only 2>/dev/null | grep -q 'package.json\|package-lock.json' && npm ci --prefer-offline || echo 'Skipping npm ci') && npm run build && cd .. && sudo systemctl reload nginx && pm2 restart sanhoti-backend"
echo ""
echo "⚡ Speed optimizations:"
echo "   - Uses --prefer-offline to use npm cache"
echo "   - Skips npm ci if dependencies haven't changed"
echo "   - Only builds frontend (backend doesn't need rebuild unless changed)"

