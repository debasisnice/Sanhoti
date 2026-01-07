#!/bin/bash

# Fix backend connection issues with Cloudflare
# Run this on AWS server

set -e

echo "🔧 Fixing backend connection issues..."
echo ""

# 1. Rebuild backend with latest code
echo "1️⃣ Rebuilding backend..."
cd /var/www/sanhoti/backend
npm install
npm run build
echo "✅ Backend rebuilt"

# 2. Check if backend is running
echo ""
echo "2️⃣ Checking backend status..."
if pm2 list | grep -q "sanhoti-backend"; then
    echo "✅ Backend process exists in PM2"
    pm2 status | grep sanhoti-backend
else
    echo "❌ Backend not found in PM2"
    echo "   Starting backend..."
    pm2 start dist/server.js --name sanhoti-backend
    pm2 save
fi

# 3. Restart backend
echo ""
echo "3️⃣ Restarting backend..."
pm2 restart sanhoti-backend
sleep 3

# 4. Check if backend is listening
echo ""
echo "4️⃣ Checking if backend is listening on port 5001..."
if sudo netstat -tlnp | grep -q ":5001"; then
    echo "✅ Backend is listening on port 5001"
    sudo netstat -tlnp | grep ":5001"
else
    echo "❌ Backend is NOT listening on port 5001"
    echo "   Check backend logs: pm2 logs sanhoti-backend --lines 50"
fi

# 5. Test backend health
echo ""
echo "5️⃣ Testing backend health endpoint..."
if curl -s http://localhost:5001/health > /dev/null; then
    echo "✅ Backend health check passed"
    curl http://localhost:5001/health
else
    echo "❌ Backend health check failed"
    echo "   Backend might not be running or there's an error"
    echo "   Check logs: pm2 logs sanhoti-backend --lines 50"
fi

# 6. Test Nginx proxy (HTTPS)
echo ""
echo "6️⃣ Testing Nginx proxy to backend (HTTPS)..."
if curl -s -k https://localhost/api/health > /dev/null; then
    echo "✅ Nginx HTTPS proxy to backend is working"
    curl -k https://localhost/api/health
else
    echo "⚠️  Testing HTTP proxy (will redirect to HTTPS)..."
    if curl -s -L http://localhost/api/health > /dev/null; then
        echo "✅ Nginx proxy redirects correctly"
    else
        echo "❌ Nginx proxy to backend is NOT working"
        echo "   Check Nginx error logs: sudo tail -20 /var/log/nginx/error.log"
    fi
fi

# 7. Check Nginx configuration
echo ""
echo "7️⃣ Checking Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors"
    exit 1
fi

# 8. Reload Nginx
echo ""
echo "8️⃣ Reloading Nginx..."
sudo systemctl reload nginx
echo "✅ Nginx reloaded"

echo ""
echo "✅ Diagnostic complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Check Cloudflare SSL/TLS mode is set to 'Full' or 'Full (strict)'"
echo "   2. Test: https://www.sanhoti.org/api/health"
echo "   3. Check browser console for CORS errors"
echo "   4. Check Nginx access logs: sudo tail -f /var/log/nginx/access.log"
echo "   5. Check Nginx error logs: sudo tail -f /var/log/nginx/error.log"
