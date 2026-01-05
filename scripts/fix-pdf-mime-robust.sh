#!/bin/bash

# Robust Fix for PDF Worker MIME Type
# This manually edits the files to ensure .mjs is properly configured

set -e

echo "🔧 Robust Fix for PDF Worker MIME Type..."
echo ""

# 1. Check current mime.types
echo "📝 Step 1: Checking /etc/nginx/mime.types..."
if grep -q "application/javascript.*mjs" /etc/nginx/mime.types; then
    echo "✅ .mjs already in mime.types"
    grep "application/javascript.*mjs" /etc/nginx/mime.types
else
    echo "   .mjs NOT found. Adding it manually..."
    
    # Find the JavaScript line
    JS_LINE=$(grep -n "application/javascript.*js$" /etc/nginx/mime.types | head -1 | cut -d: -f1)
    
    if [ -z "$JS_LINE" ]; then
        echo "❌ Could not find JavaScript line in mime.types"
        echo "   Showing relevant lines:"
        grep -n "javascript\|application" /etc/nginx/mime.types | head -10
        exit 1
    fi
    
    echo "   Found JavaScript line at line $JS_LINE"
    
    # Create a backup
    sudo cp /etc/nginx/mime.types /etc/nginx/mime.types.backup
    
    # Add mjs line after JavaScript line
    sudo sed -i "${JS_LINE}a\    application/javascript                 mjs;" /etc/nginx/mime.types
    
    # Verify
    if grep -q "application/javascript.*mjs" /etc/nginx/mime.types; then
        echo "✅ Successfully added .mjs to mime.types"
        grep "application/javascript.*mjs" /etc/nginx/mime.types
    else
        echo "❌ Failed to add .mjs. Restoring backup..."
        sudo cp /etc/nginx/mime.types.backup /etc/nginx/mime.types
        exit 1
    fi
fi
echo ""

# 2. Update Nginx site config
echo "📝 Step 2: Updating Nginx site configuration..."
NGINX_CONFIG="/etc/nginx/sites-available/sanhoti"

# Create backup
sudo cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup"

# Remove existing pdfjs location block if it exists
if grep -q "location /pdfjs" "$NGINX_CONFIG"; then
    echo "   Removing existing /pdfjs location block..."
    # Find line numbers
    START_LINE=$(grep -n "# PDF.js worker files" "$NGINX_CONFIG" | cut -d: -f1)
    if [ -n "$START_LINE" ]; then
        # Find the closing brace
        END_LINE=$(sed -n "${START_LINE},$ p" "$NGINX_CONFIG" | grep -n "^    }$" | head -1 | cut -d: -f1)
        if [ -n "$END_LINE" ]; then
            END_LINE=$((START_LINE + END_LINE - 1))
            sudo sed -i "${START_LINE},${END_LINE}d" "$NGINX_CONFIG"
            echo "   Removed old block (lines $START_LINE-$END_LINE)"
        fi
    fi
fi

# Find the closing brace of the server block
CLOSING_BRACE=$(grep -n "^}$" "$NGINX_CONFIG" | tail -1 | cut -d: -f1)

if [ -z "$CLOSING_BRACE" ]; then
    echo "❌ Could not find closing brace in Nginx config"
    exit 1
fi

echo "   Adding /pdfjs location block before line $CLOSING_BRACE..."

# Insert the location block before the closing brace
sudo sed -i "${CLOSING_BRACE}i\    # PDF.js worker files\n    location /pdfjs {\n        root /var/www/sanhoti/frontend/dist;\n        default_type application/javascript;\n        expires 1y;\n        add_header Cache-Control \"public, immutable\";\n    }" "$NGINX_CONFIG"

# Verify
if grep -q "location /pdfjs" "$NGINX_CONFIG"; then
    echo "✅ Successfully added /pdfjs location block"
    echo "   Location block:"
    grep -A 5 "location /pdfjs" "$NGINX_CONFIG"
else
    echo "❌ Failed to add /pdfjs location block. Restoring backup..."
    sudo cp "${NGINX_CONFIG}.backup" "$NGINX_CONFIG"
    exit 1
fi
echo ""

# 3. Test Nginx configuration
echo "🧪 Step 3: Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors!"
    echo "   Restoring backups..."
    sudo cp /etc/nginx/mime.types.backup /etc/nginx/mime.types 2>/dev/null || true
    sudo cp "${NGINX_CONFIG}.backup" "$NGINX_CONFIG" 2>/dev/null || true
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

HEADERS=$(curl -s -I http://localhost/pdfjs/pdf.worker.min.mjs)
CONTENT_TYPES=$(echo "$HEADERS" | grep -i "content-type" | tr -d '\r')

echo "Response headers:"
echo "$HEADERS" | head -12
echo ""

echo "Content-Type headers found:"
echo "$CONTENT_TYPES"
echo ""

# Check the last Content-Type header (browser will use this)
LAST_TYPE=$(echo "$CONTENT_TYPES" | tail -1)
if echo "$LAST_TYPE" | grep -qi "application/javascript"; then
    echo "✅ SUCCESS! Last Content-Type is application/javascript"
    echo "   Browser should accept this!"
else
    echo "⚠️  Last Content-Type might not be correct"
    echo "   Last type: $LAST_TYPE"
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
    echo "⚠️  Public URL MIME type: $PUBLIC_CONTENT_TYPE"
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
echo "🧪 Debug in browser console:"
echo "   fetch('/pdfjs/pdf.worker.min.mjs').then(r => console.log('Content-Type:', r.headers.get('content-type')))"

