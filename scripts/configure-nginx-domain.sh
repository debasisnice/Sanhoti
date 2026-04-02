#!/bin/bash

# Configure Nginx for sanhoti.org domain
# Run this script on AWS server after setting up Cloudflare DNS

set -e

echo "🔧 Configuring Nginx for sanhoti.org domain..."
echo ""

NGINX_CONFIG="/etc/nginx/sites-available/sanhoti"
NGINX_CONFIG_BACKUP="/etc/nginx/sites-available/sanhoti.backup.$(date +%Y%m%d_%H%M%S)"

# Backup existing config
if [ -f "$NGINX_CONFIG" ]; then
    echo "📋 Backing up existing Nginx config..."
    sudo cp "$NGINX_CONFIG" "$NGINX_CONFIG_BACKUP"
    echo "✅ Backup created: $NGINX_CONFIG_BACKUP"
else
    echo "⚠️  Nginx config file not found at $NGINX_CONFIG"
    echo "   Creating new configuration..."
fi

echo ""
echo "🔐 Setting up SSL certificate..."

# Create SSL directory if it doesn't exist
sudo mkdir -p /etc/nginx/ssl

# Generate self-signed certificate if it doesn't exist
if [ ! -f /etc/nginx/ssl/sanhoti-selfsigned.crt ]; then
    echo "   Generating self-signed SSL certificate..."
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/sanhoti-selfsigned.key \
        -out /etc/nginx/ssl/sanhoti-selfsigned.crt \
        -subj "/C=US/ST=CA/L=Irvine/O=Sanhoti/CN=sanhoti.org" 2>/dev/null
    echo "✅ Self-signed certificate generated"
else
    echo "✅ SSL certificate already exists"
fi

echo ""
echo "📝 Creating/Updating Nginx configuration..."

# Create/update Nginx configuration
sudo tee "$NGINX_CONFIG" > /dev/null <<'EOF'
# Sanhoti Website Configuration
# Handles both IP access and domain access

# HTTP server - redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name sanhoti.org www.sanhoti.org 44.220.179.207;

    # Allow Let's Encrypt challenges
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name sanhoti.org www.sanhoti.org 44.220.179.207;

    # SSL Configuration (Cloudflare will handle SSL termination)
    # For direct HTTPS access, we'll generate a self-signed certificate if needed
    # If using Let's Encrypt, uncomment and update paths:
    # ssl_certificate /etc/letsencrypt/live/sanhoti.org/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/sanhoti.org/privkey.pem;
    
    # Generate self-signed certificate if it doesn't exist
    # Note: Cloudflare handles SSL, so this is mainly for direct IP access
    ssl_certificate /etc/nginx/ssl/sanhoti-selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/sanhoti-selfsigned.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Increase client max body size for file uploads
    client_max_body_size 20M;

    # Frontend (React app)
    root /var/www/sanhoti/frontend/dist;
    index index.html;

    # Open Graph / link-preview images (not under /api — better WhatsApp/Facebook acceptance)
    location /og/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API proxy to backend
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for large file uploads
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # PDF.js worker files
    location /pdfjs/ {
        alias /var/www/sanhoti/frontend/dist/pdfjs/;
        add_header Content-Type application/javascript;
    }

    # Static assets
    location /images {
        alias /var/www/sanhoti/frontend/public/images;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Frontend routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF

echo "✅ Nginx configuration updated"
echo ""

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    echo ""
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
    echo ""
    echo "✅ Configuration complete!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Make sure Cloudflare DNS is pointing to 44.220.179.207"
    echo "   2. Wait for DNS propagation (5-30 minutes)"
    echo "   3. Test: https://sanhoti.org"
    echo ""
    echo "💡 Note: If you want to use Let's Encrypt SSL (instead of Cloudflare SSL),"
    echo "   run: sudo certbot --nginx -d sanhoti.org -d www.sanhoti.org"
else
    echo "❌ Nginx configuration test failed!"
    echo "   Restoring backup..."
    if [ -f "$NGINX_CONFIG_BACKUP" ]; then
        sudo cp "$NGINX_CONFIG_BACKUP" "$NGINX_CONFIG"
        echo "✅ Backup restored"
    fi
    exit 1
fi

