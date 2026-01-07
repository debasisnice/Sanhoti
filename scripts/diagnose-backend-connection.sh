#!/bin/bash

# Comprehensive backend connection diagnostic
# Run this on AWS server

set -e

echo "🔍 Comprehensive Backend Connection Diagnostic"
echo "=============================================="
echo ""

# 1. Check backend logs for CORS errors
echo "1️⃣ Checking backend logs for CORS errors..."
echo "--------------------------------------------"
pm2 logs sanhoti-backend --lines 30 --nostream | grep -i "cors\|error\|not allowed" || echo "No CORS errors found in recent logs"
echo ""

# 2. Check backend is running
echo "2️⃣ Backend PM2 Status:"
echo "--------------------------------------------"
pm2 status
echo ""

# 3. Test backend directly
echo "3️⃣ Testing backend directly (localhost:5001):"
echo "--------------------------------------------"
curl -v http://localhost:5001/health 2>&1 | head -20
echo ""

# 4. Test backend API endpoint
echo "4️⃣ Testing backend API endpoint:"
echo "--------------------------------------------"
curl -v http://localhost:5001/api/events/public 2>&1 | head -20
echo ""

# 5. Test through Nginx (HTTPS)
echo "5️⃣ Testing through Nginx HTTPS:"
echo "--------------------------------------------"
curl -k -v https://localhost/api/events/public 2>&1 | head -30
echo ""

# 6. Check Nginx access logs for recent requests
echo "6️⃣ Recent Nginx access logs:"
echo "--------------------------------------------"
sudo tail -20 /var/log/nginx/access.log | tail -10
echo ""

# 7. Check Nginx error logs
echo "7️⃣ Recent Nginx error logs:"
echo "--------------------------------------------"
sudo tail -20 /var/log/nginx/error.log | tail -10
echo ""

# 8. Check backend environment
echo "8️⃣ Backend environment variables:"
echo "--------------------------------------------"
cd /var/www/sanhoti/backend
if [ -f .env ]; then
    echo "NODE_ENV: $(grep NODE_ENV .env || echo 'not set')"
    echo "PORT: $(grep PORT .env || echo 'not set, using default 5001')"
    echo "CORS_ORIGIN: $(grep CORS_ORIGIN .env || echo 'not set')"
else
    echo ".env file not found"
fi
echo ""

# 9. Test with Origin header (simulating browser request)
echo "9️⃣ Testing with Origin header (simulating browser):"
echo "--------------------------------------------"
curl -k -H "Origin: https://www.sanhoti.org" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     -v https://localhost/api/events/public 2>&1 | head -30
echo ""

# 10. Check if backend is actually using the new code
echo "🔟 Checking backend code version:"
echo "--------------------------------------------"
cd /var/www/sanhoti/backend
if grep -q "sanhoti.org" dist/server.js 2>/dev/null; then
    echo "✅ Backend code includes sanhoti.org in CORS"
else
    echo "❌ Backend code does NOT include sanhoti.org in CORS"
    echo "   The backend needs to be rebuilt!"
fi
echo ""

echo "✅ Diagnostic complete!"
echo ""
echo "📋 Key things to check:"
echo "   1. If you see CORS errors in backend logs, the origin is being blocked"
echo "   2. If backend code doesn't include sanhoti.org, rebuild: cd backend && npm run build && pm2 restart sanhoti-backend"
echo "   3. Check Cloudflare SSL/TLS mode is 'Full' or 'Full (strict)'"
echo "   4. Test from browser: Open https://www.sanhoti.org and check browser console (F12)"
echo "   5. Check Network tab in browser to see what API requests are failing"

