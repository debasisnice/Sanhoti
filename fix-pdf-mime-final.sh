#!/bin/bash

# Final Fix for PDF Worker MIME Type
# This ensures .mjs files are served with application/javascript

set -e

echo "🔧 Final Fix for PDF Worker MIME Type..."
echo ""

# 1. Add .mjs to mime.types
echo "📝 Step 1: Updating /etc/nginx/mime.types..."
if grep -q "application/javascript.*mjs" /etc/nginx/mime.types; then
    echo "✅ .mjs already in mime.types"
else
    # Find the JavaScript line and add mjs
    sudo sed -i '/application\/javascript.*js$/a\    application/javascript                 mjs;' /etc/nginx/mime.types
    echo "✅ Added .mjs to mime.types"
fi

# Verify it was added
if grep -q "application/javascript.*mjs" /etc/nginx/mime.types; then
    echo "✅ Verified: .mjs is in mime.types"
    grep "application/javascript.*mjs" /etc/nginx/mime.types
else
    echo "❌ Failed to add .mjs to mime.types"
    exit 1
fi
echo ""

# 2. Update Nginx site config
echo "📝 Step 2: Updating Nginx site configuration..."
NGINX_CONFIG="/etc/nginx/sites-available/sanhoti"

# Remove existing pdfjs location block
if grep -q "location /pdfjs" "$NGINX_CONFIG"; then
    echo "   Removing existing /pdfjs location block..."
    sudo sed -i '/# PDF.js worker files/,/^    }$/d' "$NGINX_CONFIG"
fi

# Add new location block BEFORE the closing brace
echo "   Adding new /pdfjs location block..."
sudo sed -i '/^}$/i\    # PDF.js worker files\n    location /pdfjs {\n        root /var/www/sanhoti/frontend/dist;\n        default_type application/javascript;\n        expires 1y;\n        add_header Cache-Control "public, immutable";\n    }' "$NGINX_CONFIG"

# Verify it was added
if grep -q "location /pdfjs" "$NGINX_CONFIG"; then
    echo "✅ Verified: /pdfjs location block added"
    grep -A 5 "location /pdfjs" "$NGINX_CONFIG"
else
    echo "❌ Failed to add /pdfjs location block"
    exit 1
fi
echo ""

# 3. Test Nginx configuration
echo "🧪 Step 3: Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors!"
    echo "   Showing errors:"
    sudo nginx -t 2>&1
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

# Get headers
HEADERS=$(curl -s -I http://localhost/pdfjs/pdf.worker.min.mjs)
CONTENT_TYPES=$(echo "$HEADERS" | grep -i "content-type" | tr -d '\r\n')

echo "Response headers:"
echo "$HEADERS" | head -15
echo ""

echo "Content-Type headers:"
echo "$CONTENT_TYPES"
echo ""

# Check if correct
if echo "$CONTENT_TYPES" | grep -qi "application/javascript"; then
    COUNT=$(echo "$CONTENT_TYPES" | grep -c "content-type" || echo "0")
    if [ "$COUNT" -eq 1 ] || [ "$COUNT" -eq 2 ]; then
        # Check if the last one (which browser will use) is correct
        LAST_TYPE=$(echo "$CONTENT_TYPES" | tail -1)
        if echo "$LAST_TYPE" | grep -qi "application/javascript"; then
            echo "✅ SUCCESS! Content-Type is application/javascript"
        else
            echo "⚠️  Multiple headers, but last one might be wrong"
        fi
    else
        echo "⚠️  Unexpected number of Content-Type headers"
    fi
else
    echo "❌ Content-Type is NOT application/javascript"
    echo "   This might be a caching issue. Try:"
    echo "   1. Clear browser cache"
    echo "   2. Hard refresh (Ctrl+F5)"
    echo "   3. Test in incognito mode"
fi
echo ""

# 6. Test from public URL
echo "🧪 Step 6: Testing from public URL..."
PUBLIC_HEADERS=$(curl -s -I http://44.220.179.207/pdfjs/pdf.worker.min.mjs)
PUBLIC_CONTENT_TYPE=$(echo "$PUBLIC_HEADERS" | grep -i "content-type" | tail -1 | tr -d '\r\n')
echo "Public URL Content-Type: $PUBLIC_CONTENT_TYPE"
if echo "$PUBLIC_CONTENT_TYPE" | grep -qi "application/javascript"; then
    echo "✅ Public URL has correct MIME type!"
else
    echo "⚠️  Public URL MIME type might be wrong"
fi
echo ""

echo "✅ Fix complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Clear browser cache completely (Ctrl+Shift+Delete)"
echo "   2. Hard refresh (Ctrl+F5 or Cmd+Shift+R)"
echo "   3. Or test in incognito/private window"
echo "   4. Test: http://44.220.179.207/magazines"
echo ""
echo "🧪 Debug: Check MIME type in browser console:"
echo "   fetch('/pdfjs/pdf.worker.min.mjs').then(r => console.log('Content-Type:', r.headers.get('content-type')))"

