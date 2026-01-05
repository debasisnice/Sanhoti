#!/bin/bash

# Fix PDF Worker MIME Type Issue on AWS
# This script updates Nginx to serve .mjs files with correct MIME type

set -e

echo "🔧 Fixing PDF Worker MIME Type Issue..."
echo ""

# 1. Check if PDF worker file exists in dist
echo "📁 Checking PDF worker file:"
if [ -f "/var/www/sanhoti/frontend/dist/pdfjs/pdf.worker.min.mjs" ]; then
    echo "✅ PDF worker file exists in dist"
    ls -lh /var/www/sanhoti/frontend/dist/pdfjs/pdf.worker.min.mjs
else
    echo "❌ PDF worker file NOT found in dist!"
    echo "   Checking if it exists in public:"
    if [ -f "/var/www/sanhoti/frontend/public/pdfjs/pdf.worker.min.mjs" ]; then
        echo "   ✅ Found in public, copying to dist..."
        mkdir -p /var/www/sanhoti/frontend/dist/pdfjs
        cp /var/www/sanhoti/frontend/public/pdfjs/pdf.worker.min.mjs /var/www/sanhoti/frontend/dist/pdfjs/
        echo "   ✅ Copied to dist"
    else
        echo "   ❌ Not found in public either!"
        exit 1
    fi
fi
echo ""

# 2. Update Nginx configuration to add MIME type for .mjs files
echo "📝 Updating Nginx configuration..."

# Check if mime.types already includes .mjs
if grep -q "application/javascript.*mjs" /etc/nginx/mime.types 2>/dev/null; then
    echo "✅ MIME type for .mjs already configured"
else
    echo "   Adding MIME type for .mjs files..."
    # Add .mjs to mime.types if not present
    sudo sed -i '/application\/javascript.*js$/a\    application/javascript                 mjs;' /etc/nginx/mime.types || {
        # If sed fails, add it manually
        echo "   Using alternative method..."
        sudo bash -c 'echo "    application/javascript                 mjs;" >> /etc/nginx/mime.types'
    }
    echo "✅ Added MIME type for .mjs files"
fi
echo ""

# 3. Update site-specific Nginx config to ensure .mjs files are served correctly
echo "📝 Updating site Nginx configuration..."
NGINX_CONFIG="/etc/nginx/sites-available/sanhoti"

# Check if location block for pdfjs exists
if grep -q "location /pdfjs" "$NGINX_CONFIG" 2>/dev/null; then
    echo "✅ PDF.js location block already exists"
else
    echo "   Adding PDF.js location block..."
    # Add location block for pdfjs before the closing brace
    sudo sed -i '/^}$/i\    # PDF.js worker files\n    location /pdfjs {\n        root /var/www/sanhoti/frontend/dist;\n        add_header Content-Type "application/javascript";\n        expires 1y;\n        add_header Cache-Control "public, immutable";\n    }' "$NGINX_CONFIG"
    echo "✅ Added PDF.js location block"
fi
echo ""

# 4. Test Nginx configuration
echo "🧪 Testing Nginx configuration:"
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors!"
    exit 1
fi
echo ""

# 5. Reload Nginx
echo "🔄 Reloading Nginx:"
sudo systemctl reload nginx
echo "✅ Nginx reloaded"
echo ""

# 6. Test PDF worker file
echo "🧪 Testing PDF worker file:"
WORKER_URL="http://localhost/pdfjs/pdf.worker.min.mjs"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL")
CONTENT_TYPE=$(curl -s -I "$WORKER_URL" | grep -i "content-type" | cut -d' ' -f2 | tr -d '\r')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ PDF worker file is accessible (HTTP $HTTP_CODE)"
    echo "   Content-Type: $CONTENT_TYPE"
    if echo "$CONTENT_TYPE" | grep -qi "javascript"; then
        echo "✅ MIME type is correct!"
    else
        echo "⚠️  MIME type might still be wrong: $CONTENT_TYPE"
    fi
else
    echo "❌ PDF worker file not accessible (HTTP $HTTP_CODE)"
fi
echo ""

echo "✅ Fix complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Clear your browser cache"
echo "   2. Hard refresh (Ctrl+F5 or Cmd+Shift+R)"
echo "   3. Test the magazines page: http://44.220.179.207/magazines"
echo ""
echo "🧪 Test PDF worker directly:"
echo "   curl -I http://44.220.179.207/pdfjs/pdf.worker.min.mjs"

