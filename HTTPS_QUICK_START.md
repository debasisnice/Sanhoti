# HTTPS Quick Start Guide

## ⚠️ Prerequisites Check

Before starting, ensure you have:
- [ ] A domain name (e.g., `example.com`)
- [ ] Domain DNS pointing to your EC2 server IP
- [ ] Port 443 open in EC2 Security Group
- [ ] SSH access to your EC2 server

## Quick Setup (5 Steps)

### Step 1: SSH into your AWS server
```bash
ssh -i your-key.pem ubuntu@44.220.179.207
# Or use your SSH method
```

### Step 2: Upload and run the setup script
```bash
# If you have the script file, upload it first, then:
sudo bash setup-https.sh

# Or install Certbot manually:
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

### Step 3: Update Nginx Configuration

Edit your Nginx config:
```bash
sudo nano /etc/nginx/sites-available/sanhoti
```

Find the line:
```nginx
server_name 44.220.179.207;
```

Change it to your domain:
```nginx
server_name yourdomain.com www.yourdomain.com;
```

Save and exit (Ctrl+X, then Y, then Enter)

Test the configuration:
```bash
sudo nginx -t
```

If successful, reload Nginx:
```bash
sudo systemctl reload nginx
```

### Step 4: Update Security Group

In AWS Console:
1. Go to EC2 → Security Groups
2. Select your instance's security group
3. Add inbound rule:
   - Type: **HTTPS**
   - Port: **443**
   - Source: **0.0.0.0/0**
   - Description: **HTTPS**

### Step 5: Get SSL Certificate

Run Certbot (replace `yourdomain.com` with your actual domain):
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts:
- Enter email address (for renewal notifications)
- Agree to terms (type `A` and press Enter)
- Choose redirect HTTP to HTTPS (type `2` and press Enter - recommended)

### Step 6: Verify HTTPS

1. Visit `https://yourdomain.com` in your browser
2. You should see a padlock icon 🔒
3. HTTP should automatically redirect to HTTPS

## Done! 🎉

Your website is now secured with HTTPS. Certbot will automatically renew certificates every 90 days.

## Troubleshooting

### "Domain doesn't point to this server"
- Check DNS records: `dig yourdomain.com` or `nslookup yourdomain.com`
- Ensure A record points to your EC2 IP: `44.220.179.207`
- Wait a few minutes after DNS changes

### "Port 443 not open"
- Check Security Group rules
- Ensure HTTPS (port 443) is allowed from 0.0.0.0/0

### "Nginx configuration error"
- Test config: `sudo nginx -t`
- Check for typos in domain name
- Verify file paths exist

## Need Help?

See `HTTPS_SETUP.md` for detailed instructions and troubleshooting.

