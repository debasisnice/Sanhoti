#!/bin/bash

# Check and restart backend if needed
# Run this on AWS server

set -e

echo "🔍 Checking backend status..."
echo ""

# Check PM2 status
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "🔍 Checking if backend is listening on port 5001..."
if sudo netstat -tlnp | grep -q ":5001"; then
    echo "✅ Backend is listening on port 5001"
    sudo netstat -tlnp | grep ":5001"
else
    echo "❌ Backend is NOT listening on port 5001"
fi

echo ""
echo "🧪 Testing backend health endpoint..."
if curl -s http://localhost:5001/health > /dev/null; then
    echo "✅ Backend health check passed"
    curl http://localhost:5001/health
else
    echo "❌ Backend health check failed"
fi

echo ""
echo "📋 Recent backend logs:"
pm2 logs sanhoti-backend --lines 20 --nostream

echo ""
echo "💡 If backend is not running, restart it with:"
echo "   cd /var/www/sanhoti/backend"
echo "   pm2 restart sanhoti-backend"
echo "   # Or if it doesn't exist:"
echo "   pm2 start dist/server.js --name sanhoti-backend"
echo "   pm2 save"

