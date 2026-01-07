# Cloudflare Domain Setup Guide

This guide explains how to configure your Sanhoti website to use the `sanhoti.org` domain through Cloudflare.

## Prerequisites

- Domain `sanhoti.org` added to Cloudflare
- AWS EC2 server running at `44.220.179.207`
- SSH access to AWS server

## Step 1: Configure Cloudflare DNS

1. Log in to your Cloudflare dashboard
2. Select your domain `sanhoti.org`
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Configure:
   - **Type**: `A`
   - **Name**: `@` (or leave blank for root domain)
   - **IPv4 address**: `44.220.179.207`
   - **Proxy status**: **Proxied** (orange cloud) ✅
   - **TTL**: Auto
6. Click **Save**

### Optional: Add www subdomain

1. Click **Add record** again
2. **Type**: `A`
3. **Name**: `www`
4. **IPv4 address**: `44.220.179.207`
5. **Proxy status**: **Proxied** (orange cloud) ✅
6. Click **Save**

## Step 2: Configure SSL/TLS in Cloudflare

1. Go to **SSL/TLS** in Cloudflare dashboard
2. Set **Encryption mode** to **Full** or **Full (strict)**
   - **Full**: Allows Cloudflare to connect to your origin with any valid SSL certificate
   - **Full (strict)**: Requires a valid SSL certificate on your origin (recommended if you have Let's Encrypt)

## Step 3: Configure Nginx on AWS Server

SSH into your AWS server and run the configuration script:

```bash
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207
cd /var/www/sanhoti
git pull origin main
bash scripts/configure-nginx-domain.sh
```

Or manually update Nginx:

```bash
sudo nano /etc/nginx/sites-available/sanhoti
```

The script will:
- Backup your existing Nginx configuration
- Update the config to accept `sanhoti.org` and `www.sanhoti.org`
- Test the configuration
- Reload Nginx

## Step 4: Wait for DNS Propagation

- DNS changes typically take 5-30 minutes to propagate
- You can check propagation status at: https://dnschecker.org

## Step 5: Verify

After DNS propagation:

1. Test the domain: `https://sanhoti.org`
2. Test www: `https://www.sanhoti.org`
3. Verify SSL: Check that the padlock icon appears in the browser

## How It Works

1. **User visits** `https://sanhoti.org`
2. **Cloudflare** receives the request (via DNS)
3. **Cloudflare** provides SSL/TLS encryption
4. **Cloudflare** proxies the request to your AWS server (`44.220.179.207`)
5. **Nginx** on AWS serves the website
6. **Response** goes back through Cloudflare to the user

## Benefits

- ✅ Free SSL certificate (via Cloudflare)
- ✅ CDN for faster loading
- ✅ DDoS protection
- ✅ Professional domain name
- ✅ Hides your server IP address

## Troubleshooting

### Domain not resolving
- Check DNS propagation: https://dnschecker.org
- Verify Cloudflare DNS records are correct
- Wait a bit longer (can take up to 48 hours in rare cases)

### SSL errors
- Make sure Cloudflare SSL/TLS mode is set to **Full** or **Full (strict)**
- If using **Full (strict)**, ensure you have a valid SSL certificate on the server
- Check Nginx SSL configuration

### 502 Bad Gateway
- Check if backend is running: `pm2 status`
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Verify backend is listening on port 5001: `sudo netstat -tlnp | grep 5001`

### Site not loading
- Check Nginx status: `sudo systemctl status nginx`
- Test Nginx config: `sudo nginx -t`
- Check Nginx access logs: `sudo tail -f /var/log/nginx/access.log`

## Optional: Let's Encrypt SSL (Alternative to Cloudflare SSL)

If you want to use Let's Encrypt SSL directly on the server (instead of Cloudflare SSL):

```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d sanhoti.org -d www.sanhoti.org
```

Then set Cloudflare SSL/TLS mode to **Full (strict)**.

## Notes

- The Nginx configuration accepts both domain and IP access
- Cloudflare handles SSL termination (you don't need a valid SSL cert on the server if using Cloudflare SSL)
- The configuration uses a self-signed certificate for direct HTTPS access (Cloudflare will handle SSL for domain access)

