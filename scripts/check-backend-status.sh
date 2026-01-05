#!/bin/bash

# Check Backend Status on AWS
# Run this on your AWS server to diagnose backend issues

echo "🔍 Checking Backend Status..."
echo ""

# 1. Check PM2 status
echo "📊 PM2 Process Status:"
pm2 list
echo ""

# 2. Check backend logs
echo "📋 Backend Logs (last 30 lines):"
pm2 logs sanhoti-backend --lines 30 --nostream
echo ""

# 3. Check if port 5001 is in use
echo "🔌 Port 5001 Status:"
sudo netstat -tlnp | grep 5001 || echo "Port 5001 is not listening"
echo ""

# 4. Check backend process
echo "🔍 Backend Process Details:"
pm2 describe sanhoti-backend
echo ""

# 5. Check if backend file exists
echo "📁 Backend Files:"
ls -lah /var/www/sanhoti/backend/dist/server.js 2>/dev/null || echo "❌ Backend dist/server.js not found!"
echo ""

# 6. Test backend directly
echo "🧪 Testing Backend:"
cd /var/www/sanhoti/backend
node dist/server.js &
BACKEND_PID=$!
sleep 2
curl http://localhost:5001/health 2>/dev/null && echo "✅ Backend responds!" || echo "❌ Backend not responding"
kill $BACKEND_PID 2>/dev/null
echo ""

echo "✅ Diagnostic complete!"

