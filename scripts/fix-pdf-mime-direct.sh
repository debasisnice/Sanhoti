#!/bin/bash

# Direct Fix for PDF Worker MIME Type
# This uses a more aggressive approach to ensure correct MIME type

set -e

echo "🔧 Direct Fix for PDF Worker MIME Type..."
echo ""

# 1. Add .mjs to mime.types
echo "📝 Step 1: Adding .mjs to mime.types..."
sudo sed -i '/application\/javascript.*js;/a\    application/javascript                mjs;' /etc/nginx/mime.types

# Verify
if grep -q "application/javascript.*mjs" /etc/nginx/mime.types; then
    echo "✅ .mjs added to mime.types"
    grep "application/javascript.*mjs" /etc/nginx/mime.types
else
    echo "❌ Failed to add .mjs"
    exit 1
fi
echo ""

# 2. Update Nginx site config with more specific location
echo "📝 Step 2: Updating Nginx site configuration..."
NGINX_CONFIG="/etc/nginx/sites-available/sanhoti"

# Create backup
sudo cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup"

# Remove existing pdfjs location block
sudo sed -i '/# PDF.js worker files/,/^    }$/d' "$NGINX_CONFIG"

# Find the closing brace
CLOSING_BRACE=$(grep -n "^}$" "$NGINX_CONFIG" | tail -1 | cut -d: -f1)

# Add location block that FORCES the MIME type
sudo sed -i "${CLOSING_BRACE}i\    # PDF.js worker files - MUST come before static files location\n    location ~* \\.mjs$ {\n        root /var/www/sanhoti/frontend/dist;\n        add_header Content-Type \"application/javascript\" always;\n        expires 1y;\n        add_header Cache-Control \"public, immutable\" always;\n    }\n    location /pdfjs {\n        root /var/www/sanhoti/frontend/dist;\n        add_header Content-Type \"application/javascript\" always;\n        expires 1y;\n        add_header Cache-Control \"public, immutable\" always;\n    }" "$NGINX_CONFIG"

# Verify
if grep -q "location.*mjs" "$NGINX_CONFIG"; then
    echo "✅ Successfully added location blocks"
    echo "   Location blocks:"
    grep -A 5 "location.*mjs\|location /pdfjs" "$NGINX_CONFIG"
else
    echo "❌ Failed to add location blocks"
    exit 1
fi
echo ""

# 3. Test Nginx configuration
echo "🧪 Step 3: Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors!"
    sudo nginx -t
    exit 1
fi
echo ""

# 4. Reload Nginx
echo "🔄 Step 4: Reloading Nginx..."
sudo systemctl reload nginx
sleep 2
echo "✅ Nginx reloaded"
echo ""

# 5. Test the worker file
echo "🧪 Step 5: Testing PDF worker file..."
sleep 1

echo "Testing localhost:"
HEADERS=$(curl -s -I http://localhost/pdfjs/pdf.worker.min.mjs)
echo "$HEADERS" | head -15
echo ""

CONTENT_TYPES=$(echo "$HEADERS" | grep -i "content-type")
echo "Content-Type headers:"
echo "$CONTENT_TYPES"
echo ""

# Check
LAST_TYPE=$(echo "$CONTENT_TYPES" | tail -1)
if echo "$LAST_TYPE" | grep -qi "application/javascript"; then
    echo "✅ SUCCESS! Content-Type is application/javascript"
else
    echo "⚠️  Content-Type: $LAST_TYPE"
fi
echo ""

# 6. Test from public URL
echo "🧪 Step 6: Testing from public URL..."
PUBLIC_HEADERS=$(curl -s -I http://44.220.179.207/pdfjs/pdf.worker.min.mjs)
echo "Public URL headers:"
echo "$PUBLIC_HEADERS" | head -15
echo ""

PUBLIC_CONTENT_TYPE=$(echo "$PUBLIC_HEADERS" | grep -i "content-type" | tail -1 | tr -d '\r\n')
echo "Public URL Content-Type: $PUBLIC_CONTENT_TYPE"
if echo "$PUBLIC_CONTENT_TYPE" | grep -qi "application/javascript"; then
    echo "✅ Public URL has correct MIME type!"
else
    echo "⚠️  Public URL MIME type might still be wrong"
    echo "   Try clearing browser cache and hard refresh"
fi
echo ""

echo "✅ Fix complete!"
echo ""
echo "📋 IMPORTANT: Clear browser cache completely!"
echo "   1. Press Ctrl+Shift+Delete (or Cmd+Shift+Delete)"
echo "   2. Select 'Cached images and files'"
echo "   3. Clear data"
echo "   4. Or use incognito/private window"
echo "   5. Test: http://44.220.179.207/magazines"

