#!/bin/bash

# HTTPS Setup Script for AWS EC2
# Run this script on your AWS EC2 server with sudo privileges

set -e  # Exit on error

echo "🔒 Starting HTTPS Setup..."
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run this script with sudo: sudo bash setup-https.sh"
    exit 1
fi

# Step 1: Update package list
echo "📦 Updating package list..."
apt update -y

# Step 2: Install Certbot
echo "📦 Installing Certbot..."
apt install certbot python3-certbot-nginx -y

echo ""
echo "✅ Certbot installed successfully!"
echo ""
echo "⚠️  IMPORTANT: Before continuing, you need to:"
echo "   1. Have a domain name pointing to this server's IP"
echo "   2. Update your Nginx configuration with the domain name"
echo "   3. Ensure port 443 is open in your EC2 Security Group"
echo ""
echo "Next steps:"
echo "1. Edit Nginx config: sudo nano /etc/nginx/sites-available/sanhoti"
echo "2. Update server_name to your domain: server_name yourdomain.com www.yourdomain.com;"
echo "3. Test config: sudo nginx -t"
echo "4. Reload Nginx: sudo systemctl reload nginx"
echo "5. Run Certbot: sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com"
echo ""
echo "For detailed instructions, see HTTPS_SETUP.md"

