# HTTPS Setup for sanhoti.org

## Step-by-Step Instructions

### Prerequisites Check

Before starting, ensure:
1. ✅ Domain name: **sanhoti.org**
2. ⚠️ DNS A record points to: **44.220.179.207**
3. ⚠️ Port 443 open in EC2 Security Group

### Step 1: Verify DNS Configuration

First, verify your domain points to your server:

```bash
# From your local machine or any terminal
dig sanhoti.org +short
# Should return: 44.220.179.207

# Or check with nslookup
nslookup sanhoti.org
# Should show: 44.220.179.207
```

**If DNS is not configured:**
1. Log into your domain registrar (where you bought sanhoti.org)
2. Go to DNS settings
3. Add/Update A record:
   - Type: **A**
   - Name: **@** (or leave blank)
   - Value: **44.220.179.207**
   - TTL: **3600** (or default)
4. Optionally add www subdomain:
   - Type: **A**
   - Name: **www**
   - Value: **44.220.179.207**
   - TTL: **3600**

**Wait 5-10 minutes** for DNS to propagate after changes.

### Step 2: Update EC2 Security Group

In AWS Console:
1. Go to **EC2 → Security Groups**
2. Select your instance's security group
3. Click **Edit inbound rules**
4. Click **Add rule**
5. Configure:
   - **Type**: HTTPS
   - **Protocol**: TCP
   - **Port range**: 443
   - **Source**: 0.0.0.0/0
   - **Description**: HTTPS
6. Click **Save rules**

### Step 3: SSH into Your Server

```bash
# From your local machine
ssh -i your-key.pem ubuntu@44.220.179.207
# Or use your usual SSH method
```

### Step 4: Install Certbot

Run these commands on your AWS server:

```bash
# Update package list
sudo apt update

# Install Certbot and Nginx plugin
sudo apt install certbot python3-certbot-nginx -y
```

### Step 5: Update Nginx Configuration

Edit your Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/sanhoti
```

Find this line:
```nginx
server_name 44.220.179.207;
```

Change it to:
```nginx
server_name sanhoti.org www.sanhoti.org;
```

**Save and exit:**
- Press `Ctrl+X`
- Press `Y` to confirm
- Press `Enter` to save

**Test the configuration:**
```bash
sudo nginx -t
```

You should see:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**If test passes, reload Nginx:**
```bash
sudo systemctl reload nginx
```

### Step 6: Obtain SSL Certificate

Run Certbot with your domain:

```bash
sudo certbot --nginx -d sanhoti.org -d www.sanhoti.org
```

**Follow the prompts:**

1. **Enter email address:**
   - Enter your email (for renewal notifications)
   - Press Enter

2. **Agree to Terms of Service:**
   - Type `A` and press Enter

3. **Email sharing (optional):**
   - Type `N` and press Enter (or `Y` if you want to share)

4. **Redirect HTTP to HTTPS:**
   - Type `2` and press Enter (recommended - redirects all HTTP to HTTPS)

Certbot will:
- Verify domain ownership
- Obtain SSL certificate
- Configure Nginx automatically
- Set up automatic renewal

### Step 7: Verify HTTPS is Working

1. **Visit your website:**
   - Open browser: `https://sanhoti.org`
   - You should see a padlock icon 🔒 in the address bar

2. **Test HTTP redirect:**
   - Visit: `http://sanhoti.org`
   - Should automatically redirect to `https://sanhoti.org`

3. **Check certificate:**
   - Click the padlock icon in browser
   - View certificate details
   - Should show "Valid" and "Issued by: Let's Encrypt"

### Step 8: Verify Auto-Renewal

Certbot sets up automatic renewal. Verify it's working:

```bash
# Test renewal process (dry run)
sudo certbot renew --dry-run

# Check renewal timer status
sudo systemctl status certbot.timer
```

You should see:
```
Active: active (waiting)
```

## Complete Command Sequence (Copy-Paste Ready)

Here are all the commands in sequence (run on your AWS server):

```bash
# 1. Update packages
sudo apt update

# 2. Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# 3. Edit Nginx config
sudo nano /etc/nginx/sites-available/sanhoti
# In editor: Change server_name 44.220.179.207; to server_name sanhoti.org www.sanhoti.org;
# Save: Ctrl+X, Y, Enter

# 4. Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# 5. Get SSL certificate
sudo certbot --nginx -d sanhoti.org -d www.sanhoti.org
# Follow prompts: Enter email, type A, type N, type 2

# 6. Verify HTTPS works
curl -I https://sanhoti.org
# Should return: HTTP/2 200
```

## Troubleshooting

### Error: "Domain doesn't point to this server"

**Solution:**
1. Verify DNS: `dig sanhoti.org +short` should return `44.220.179.207`
2. Wait a few minutes after DNS changes
3. Check DNS from different locations: https://dnschecker.org

### Error: "Connection refused" or "Port 443 not open"

**Solution:**
1. Check Security Group has HTTPS (443) inbound rule
2. Verify rule source is `0.0.0.0/0`
3. Check Nginx is running: `sudo systemctl status nginx`

### Error: "Nginx configuration test failed"

**Solution:**
1. Check syntax: `sudo nginx -t` shows errors
2. Verify domain name spelling in config
3. Check file paths exist (e.g., `/var/www/sanhoti/frontend/dist`)

### Certificate expires in 90 days

**This is normal!** Certbot automatically renews certificates. To verify:
```bash
sudo certbot renew --dry-run
```

## Current Configuration (After Setup)

After Certbot completes, your Nginx config will look like:

```nginx
# HTTP server - redirects to HTTPS
server {
    listen 80;
    server_name sanhoti.org www.sanhoti.org;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name sanhoti.org www.sanhoti.org;

    ssl_certificate /etc/letsencrypt/live/sanhoti.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sanhoti.org/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20M;

    location / {
        root /var/www/sanhoti/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

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

## Next Steps After HTTPS Setup

1. **Update any hardcoded HTTP URLs** in your application to use HTTPS
2. **Test all pages** work correctly over HTTPS
3. **Monitor certificate renewal** (Certbot handles this automatically)
4. **Set up monitoring** for certificate expiration (optional)

## Need Help?

- Certbot logs: `/var/log/letsencrypt/`
- Nginx logs: `/var/log/nginx/error.log`
- Test SSL: https://www.ssllabs.com/ssltest/analyze.html?d=sanhoti.org

