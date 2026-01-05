#!/bin/bash

# Fix PDF Worker MIME Type Issue - Version 2
# This ensures only the correct Content-Type is sent

set -e

echo "🔧 Fixing PDF Worker MIME Type (Version 2)..."
echo ""

# 1. Update mime.types to include .mjs
echo "📝 Updating /etc/nginx/mime.types..."
if grep -q "application/javascript.*mjs" /etc/nginx/mime.types 2>/dev/null; then
    echo "✅ MIME type for .mjs already in mime.types"
else
    # Find the JavaScript line and add mjs after it
    sudo sed -i '/application\/javascript.*js$/a\    application/javascript                 mjs;' /etc/nginx/mime.types
    echo "✅ Added .mjs to mime.types"
fi
echo ""

# 2. Update site config to override Content-Type properly
echo "📝 Updating Nginx site configuration..."
NGINX_CONFIG="/etc/nginx/sites-available/sanhoti"

# Remove existing pdfjs location block if it exists
sudo sed -i '/# PDF.js worker files/,/^    }$/d' "$NGINX_CONFIG"

# Add new location block with proper Content-Type override
sudo sed -i '/^}$/i\    # PDF.js worker files\n    location /pdfjs {\n        root /var/www/sanhoti/frontend/dist;\n        default_type application/javascript;\n        expires 1y;\n        add_header Cache-Control "public, immutable";\n    }' "$NGINX_CONFIG"

echo "✅ Updated PDF.js location block"
echo ""

# 3. Test Nginx configuration
echo "🧪 Testing Nginx configuration:"
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors!"
    exit 1
fi
echo ""

# 4. Reload Nginx
echo "🔄 Reloading Nginx:"
sudo systemctl reload nginx
echo "✅ Nginx reloaded"
echo ""

# 5. Test PDF worker file
echo "🧪 Testing PDF worker file:"
sleep 1
RESPONSE=$(curl -s -I http://localhost/pdfjs/pdf.worker.min.mjs)
CONTENT_TYPES=$(echo "$RESPONSE" | grep -i "content-type" | tr -d '\r')

echo "Response headers:"
echo "$RESPONSE" | head -10

echo ""
echo "Content-Type headers found:"
echo "$CONTENT_TYPES"

# Count Content-Type headers
COUNT=$(echo "$CONTENT_TYPES" | wc -l)
if [ "$COUNT" -eq 1 ]; then
    if echo "$CONTENT_TYPES" | grep -qi "javascript"; then
        echo "✅ Perfect! Only one Content-Type header with correct MIME type"
    else
        echo "⚠️  Only one header, but MIME type might be wrong"
    fi
else
    echo "⚠️  Multiple Content-Type headers found ($COUNT). Browser might use the first one."
fi
echo ""

echo "✅ Fix complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Clear your browser cache completely"
echo "   2. Hard refresh (Ctrl+F5 or Cmd+Shift+R)"
echo "   3. Test: http://44.220.179.207/magazines"
echo ""
echo "🧪 Test from browser console:"
echo "   fetch('/pdfjs/pdf.worker.min.mjs').then(r => console.log(r.headers.get('content-type')))"

