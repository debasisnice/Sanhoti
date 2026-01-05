# HTTPS Setup Guide for AWS EC2

This guide will help you set up HTTPS (SSL/TLS) for your website using Let's Encrypt (free SSL certificates).

## Prerequisites

- Domain name pointing to your EC2 server IP (e.g., `example.com` or `www.example.com`)
- EC2 instance running Ubuntu/Debian
- Nginx installed and configured
- Port 80 and 443 open in your EC2 Security Group

## Step 1: Install Certbot

```bash
# Update package list
sudo apt update

# Install Certbot and Nginx plugin
sudo apt install certbot python3-certbot-nginx -y
```

## Step 2: Update Security Group

In AWS Console:
1. Go to EC2 → Security Groups
2. Select your instance's security group
3. Add inbound rule:
   - Type: Custom TCP
   - Port: 443
   - Source: 0.0.0.0/0 (or your IP)
   - Description: HTTPS

## Step 3: Update Nginx Configuration

Edit your Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/sanhoti
```

Update the `server_name` to your domain:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;  # <-- UPDATE THIS

    client_max_body_size 20M;

    # Frontend
    location / {
        root /var/www/sanhoti/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # Backend API
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
    }
}
```

Test and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Step 4: Obtain SSL Certificate

Run Certbot to automatically obtain and configure SSL:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**Note:** Replace `yourdomain.com` with your actual domain name.

During the process, Certbot will:
1. Verify domain ownership
2. Obtain SSL certificate from Let's Encrypt
3. Automatically update your Nginx configuration
4. Set up automatic renewal

Follow the prompts:
- Enter your email address (for renewal notifications)
- Agree to terms of service
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

## Step 5: Verify HTTPS is Working

After Certbot completes:

1. Visit your website: `https://yourdomain.com`
2. Check browser shows padlock icon 🔒
3. Verify HTTP redirects to HTTPS: `http://yourdomain.com` → `https://yourdomain.com`

## Step 6: Verify Auto-Renewal

Let's Encrypt certificates expire every 90 days. Certbot automatically sets up renewal:

```bash
# Test renewal process
sudo certbot renew --dry-run

# Check renewal timer (should show active)
sudo systemctl status certbot.timer
```

## Step 7: Update API URLs (if needed)

If your frontend is hardcoded to use `http://`, update environment variables or rebuild:

```bash
# In frontend directory
# Update .env or rebuild with HTTPS URLs
npm run build
```

## Troubleshooting

### Certificate not issued

**Issue:** Certbot can't verify domain ownership

**Solutions:**
- Ensure domain DNS points to your EC2 IP
- Verify port 80 is open in Security Group
- Check Nginx is running: `sudo systemctl status nginx`
- Wait a few minutes after DNS changes

### Nginx configuration errors

**Issue:** `sudo nginx -t` shows errors

**Solutions:**
- Check for syntax errors in configuration
- Verify paths exist (e.g., `/var/www/sanhoti/frontend/dist`)
- Check file permissions

### Certificate renewal fails

**Issue:** Auto-renewal doesn't work

**Solutions:**
```bash
# Check renewal logs
sudo certbot renew --dry-run

# Manually renew
sudo certbot renew

# Check certbot timer
sudo systemctl status certbot.timer
```

### Mixed content warnings

**Issue:** Some resources still load over HTTP

**Solutions:**
- Update all API URLs to use HTTPS
- Use relative URLs (e.g., `/api/...`) instead of absolute URLs
- Check browser console for specific resources

## Current Nginx Configuration (After Certbot)

After Certbot runs, your configuration will look like this:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;  # Redirect HTTP to HTTPS
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL configuration (added by Certbot)
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20M;

    # Frontend
    location / {
        root /var/www/sanhoti/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # Backend API
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
    }
}
```

## Alternative: Cloudflare (Free SSL Proxy)

If you don't want to install certificates on the server:

1. Sign up for Cloudflare (free)
2. Add your domain to Cloudflare
3. Update nameservers to Cloudflare's
4. Enable SSL/TLS in Cloudflare dashboard
5. Set SSL mode to "Full" or "Full (strict)"
6. Cloudflare will handle SSL termination

**Note:** With Cloudflare, you still need SSL on your server for "Full (strict)" mode, or use "Flexible" mode (less secure).

## Security Recommendations

1. **Always redirect HTTP to HTTPS** (Certbot does this automatically)
2. **Use strong SSL configuration** (Certbot sets this up)
3. **Keep Certbot updated**: `sudo apt update && sudo apt upgrade certbot`
4. **Monitor certificate expiration**: Certbot emails you before expiration
5. **Enable HTTP/2**: Certbot enables this by default

## Need Help?

- Certbot documentation: https://certbot.eff.org/
- Let's Encrypt documentation: https://letsencrypt.org/docs/
- Nginx SSL configuration: https://nginx.org/en/docs/http/configuring_https_servers.html

