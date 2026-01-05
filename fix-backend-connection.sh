#!/bin/bash

# Fix Backend Connection Issue on AWS
# This script diagnoses and fixes backend connection problems

set -e

echo "🔍 Diagnosing Backend Connection Issue..."
echo ""

# 1. Check what's listening on port 5001
echo "📊 Checking port 5001:"
sudo netstat -tlnp | grep 5001 || echo "⚠️  Nothing listening on port 5001"
echo ""

# 2. Check PM2 process details
echo "📋 PM2 Process Details:"
pm2 describe sanhoti-backend
echo ""

# 3. Check if backend file exists and is correct
echo "📁 Checking backend files:"
if [ -f "/var/www/sanhoti/backend/dist/server.js" ]; then
    echo "✅ Backend file exists"
    ls -lh /var/www/sanhoti/backend/dist/server.js
else
    echo "❌ Backend file NOT found!"
    echo "   Rebuilding backend..."
    cd /var/www/sanhoti/backend
    npm run build
fi
echo ""

# 4. Check backend logs for errors
echo "📋 Recent Backend Logs:"
pm2 logs sanhoti-backend --lines 10 --nostream
echo ""

# 5. Try to restart backend properly
echo "🔄 Restarting backend..."
cd /var/www/sanhoti/backend

# Stop current process
pm2 stop sanhoti-backend 2>/dev/null || true
pm2 delete sanhoti-backend 2>/dev/null || true

# Start with explicit path
pm2 start dist/server.js --name "sanhoti-backend"
sleep 3

# Check status
echo ""
echo "📊 PM2 Status:"
pm2 list

# Check logs
echo ""
echo "📋 Startup Logs:"
pm2 logs sanhoti-backend --lines 5 --nostream

# Test connection
echo ""
echo "🧪 Testing Connection:"
sleep 2
if curl -s http://localhost:5001/health > /dev/null; then
    echo "✅ Backend is responding!"
    curl http://localhost:5001/health
else
    echo "❌ Backend still not responding"
    echo ""
    echo "Checking what's listening on port 5001:"
    sudo netstat -tlnp | grep 5001 || echo "Nothing found"
fi

# Save PM2 config
pm2 save

echo ""
echo "✅ Fix script complete!"

