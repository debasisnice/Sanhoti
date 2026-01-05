# AWS EC2 Deployment Guide for Sanhoti

Complete guide to deploy your Sanhoti Bengali Community website on AWS EC2 free tier.

> **Already have another app on AWS?** See [MULTI_APP_DEPLOYMENT.md](./MULTI_APP_DEPLOYMENT.md) for deploying multiple applications on the same AWS account.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Create AWS EC2 Instance](#step-1-create-aws-ec2-instance)
3. [Step 2: Connect to Your EC2 Instance](#step-2-connect-to-your-ec2-instance)
4. [Step 3: Initial Server Setup](#step-3-initial-server-setup)
5. [Step 4: Install Node.js and Dependencies](#step-4-install-nodejs-and-dependencies)
6. [Step 5: Install Nginx](#step-5-install-nginx)
7. [Step 6: Install PM2](#step-6-install-pm2)
8. [Step 7: Deploy Your Application](#step-7-deploy-your-application)
9. [Step 8: Configure Nginx](#step-8-configure-nginx)
10. [Step 9: Set Up SSL with Let's Encrypt](#step-9-set-up-ssl-with-lets-encrypt)
11. [Step 10: Configure Backend Environment](#step-10-configure-backend-environment)
12. [Step 11: Start Your Application](#step-11-start-your-application)
13. [Troubleshooting](#troubleshooting)
14. [Maintenance & Updates](#maintenance--updates)

---

## Prerequisites

- AWS Account (free tier eligible)
  - **Account ID**: `681225013391` (keep this private, used for billing/support)
- Domain name (optional, but recommended)
- Git installed on your local machine
- SSH client (built into Mac/Linux, PuTTY for Windows)

> **Having trouble finding Ubuntu AMI?** See [AMI_TROUBLESHOOTING.md](./AMI_TROUBLESHOOTING.md) for detailed help finding the right Ubuntu image.

---

## Step 1: Create AWS EC2 Instance

### 1.1 Log into AWS Console
1. Go to [AWS Console](https://console.aws.amazon.com)
2. Sign in or create an account
3. Navigate to **EC2** service

### 1.2 Launch Instance
1. Click **"Launch Instance"**
2. Configure:
   - **Name**: `sanhoti-website`
   - **AMI (Application and OS Images)**: 
     - ⚠️ **IMPORTANT**: Do NOT select "Ubuntu Server 22.04 LTS with SQL Server" - that's PAID!
     - **Easiest Method**: Use **Quick Start** tab (default) → Find **Ubuntu Server 22.04 LTS** from **Canonical** (these are automatically free tier eligible)
     - **Alternative Method**: Click **"Browse more AMIs"**
       - Left sidebar → **Owners** section → Select: **Canonical** (or type: `099720109477`)
       - Left sidebar → **OS category**: Select **"All Linux/Unix"**
       - Left sidebar → **Architecture**: Select **"64-bit (x86)"**
       - Search bar: Type `ubuntu server 22.04`
       - Look for: **"Ubuntu Server 22.04 LTS"** (plain, no SQL Server)
       - Owner should be: **Canonical** (099720109477)
     - **Alternative**: Ubuntu Server 24.04 LTS also works (plain version, no SQL Server)
     - 📖 See [FIND_UBUNTU_WITHOUT_FILTER.md](./FIND_UBUNTU_WITHOUT_FILTER.md) if "Free tier only" filter is missing
   - **Instance Type**: 
     - ⚠️ **IMPORTANT**: Free tier is NOT available in all regions!
     - **Check your region** (top right corner) - Should be **US East (N. Virginia)** for best free tier support
     - Click **"Instance type"** dropdown
     - Filter: Check **"Free tier only"** on the left (if available)
     - Select: `t2.micro` (Free tier eligible)
     - If `t2.micro` not showing as free:
       - **Switch region** to **US East (N. Virginia)** - `us-east-1` (top right corner)
       - Start over with instance launch
     - Alternative: `t3.micro` (may be free tier eligible in some regions)
     - 📖 See [FIND_FREE_INSTANCE_TYPE.md](./FIND_FREE_INSTANCE_TYPE.md) if no free instance types showing
   - **Key Pair**: Create new key pair
     - Name: `sanhoti-keypair`
     - Key pair type: RSA
     - Private key file format: `.pem` (for Mac/Linux) or `.ppk` (for Windows)
     - Click **"Create key pair"** and download the file
   - **Network Settings**: 
     - Allow HTTP traffic from the internet: ✅
     - Allow HTTPS traffic from the internet: ✅
     - Allow SSH traffic: ✅ (default)
   - **Configure Storage**: 30 GB gp3 (Free tier eligible)
   - **Summary**: Review and click **"Launch Instance"**

### 1.3 Configure Security Group
1. Go to **Security Groups** in EC2 console
2. Find your instance's security group
3. Edit inbound rules:
   - **HTTP**: Port 80, Source: 0.0.0.0/0
   - **HTTPS**: Port 443, Source: 0.0.0.0/0
   - **SSH**: Port 22, Source: Your IP (recommended) or 0.0.0.0/0

### 1.4 Get Your Instance Details
1. Go to **Instances** → Select your instance
2. Note the **Public IPv4 address** (e.g., `44.220.179.207`)
3. Note the **Public IPv4 DNS** (e.g., `ec2-44-220-179-207.compute-1.amazonaws.com`)

---

## Step 2: Connect to Your EC2 Instance

### On Mac/Linux:
```bash
# Change permissions on key file
chmod 400 ~/Downloads/sanhoti-keypair.pem

# Connect to instance
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@YOUR_PUBLIC_IP

# Replace YOUR_PUBLIC_IP with your actual IP address
```

### On Windows (using PuTTY):
1. Open PuTTY
2. Convert `.pem` to `.ppk` using PuTTYgen
3. Enter Host Name: `ubuntu@YOUR_PUBLIC_IP`
4. Load the `.ppk` key in Connection → SSH → Auth
5. Click "Open"

---

## Step 3: Initial Server Setup

Once connected, run these commands:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y build-essential git curl wget

# Create application directory
sudo mkdir -p /var/www/sanhoti
sudo chown -R $USER:$USER /var/www/sanhoti
cd /var/www/sanhoti
```

---

## Step 4: Install Node.js and Dependencies

```bash
# Install Node.js 18.x using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x

# Install global packages
sudo npm install -g pm2
```

---

## Step 5: Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

---

## Step 6: Install PM2

```bash
# PM2 is already installed in Step 4
# Verify installation
pm2 --version

# Setup PM2 to start on boot
pm2 startup systemd
# Copy and run the command it outputs (usually starts with 'sudo env PATH=...')
```

---

## Step 7: Deploy Your Application

### Option A: Deploy using Git (Recommended)

```bash
# On EC2 server, clone your repository
cd /var/www/sanhoti

# Clone using SSH (requires SSH key setup on server)
# First, add your GitHub SSH key to the server:
# 1. Generate SSH key on server (if not exists): ssh-keygen -t ed25519 -C "your_email@example.com"
# 2. Copy public key: cat ~/.ssh/id_ed25519.pub
# 3. Add to GitHub: Settings → SSH and GPG keys → New SSH key

git clone git@github.com:debasisnice/Sanhoti.git .

# If SSH key is not set up, use HTTPS instead:
# git clone https://github.com/debasisnice/Sanhoti.git .

# Install dependencies
cd backend
npm install
cd ../frontend
npm install
cd ..
```

### Option B: Deploy using SCP (Direct Upload)

```bash
# On your local machine, compress the project (excluding node_modules)
cd /path/to/sanhoti
tar -czf sanhoti.tar.gz --exclude='node_modules' --exclude='.git' --exclude='backend/data' .

# Upload to EC2
scp -i ~/Downloads/sanhoti-keypair.pem sanhoti.tar.gz ubuntu@YOUR_PUBLIC_IP:/tmp/

# On EC2 server, extract and setup
cd /var/www/sanhoti
tar -xzf /tmp/sanhoti.tar.gz
cd backend && npm install
cd ../frontend && npm install
cd ..
```

---

## Step 8: Configure Nginx

### 8.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/sanhoti
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Frontend (React Build)
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

    # Health check
    location /health {
        proxy_pass http://localhost:5001/health;
    }

    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        root /var/www/sanhoti/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Save and exit (Ctrl+X, then Y, then Enter)

### 8.2 Enable Site and Test

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/sanhoti /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

---

## Step 9: Set Up SSL with Let's Encrypt

**Skip this step if you don't have a domain name yet.**

### 9.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 9.2 Get SSL Certificate

```bash
# Replace your-domain.com with your actual domain
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts:
# - Enter email address
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

### 9.3 Auto-renewal Setup

Certbot automatically sets up auto-renewal. Test it:

```bash
sudo certbot renew --dry-run
```

---

## Step 10: Configure Backend Environment

### 10.1 Create Environment File

```bash
cd /var/www/sanhoti/backend
nano .env
```

Add the following (update values as needed):

```env
PORT=5001
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
JWT_EXPIRES_IN=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
UPLOAD_DIR=./uploads

# CORS origins - update with your domain
CORS_ORIGIN=http://YOUR_DOMAIN_OR_IP,https://YOUR_DOMAIN
```

Save and exit.

### 10.2 Create Required Directories

```bash
cd /var/www/sanhoti/backend
mkdir -p data uploads
mkdir -p data/Galleries data/Notice_Flyers data/Events_Flyers data/Magazines
```

### 10.3 Build Backend

```bash
cd /var/www/sanhoti/backend
npm run build
```

### 10.4 Build Frontend

```bash
cd /var/www/sanhoti/frontend

# Create .env file for frontend (if needed)
nano .env
```

Add (update API URL):
```env
VITE_API_URL=https://YOUR_DOMAIN_OR_IP/api
```

```bash
# Build frontend
npm run build
```

---

## Step 11: Start Your Application

### 11.1 Start Backend with PM2

```bash
cd /var/www/sanhoti/backend

# Start the application
pm2 start dist/server.js --name sanhoti-backend

# Save PM2 process list
pm2 save

# Check status
pm2 status
pm2 logs sanhoti-backend
```

### 11.2 Verify Everything is Running

```bash
# Check if backend is running
curl http://localhost:5001/health

# Check Nginx
sudo systemctl status nginx

# Check PM2
pm2 status

# Check if ports are listening
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :5001
```

### 11.3 Access Your Website

Open your browser and visit:
- `http://YOUR_PUBLIC_IP` or
- `https://YOUR_DOMAIN` (if SSL is set up)

---

## Troubleshooting

### Backend Not Starting

```bash
# Check PM2 logs
pm2 logs sanhoti-backend

# Check if port is in use
sudo lsof -i :5001

# Restart backend
pm2 restart sanhoti-backend
```

### Nginx Errors

```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R $USER:$USER /var/www/sanhoti
sudo chmod -R 755 /var/www/sanhoti

# Fix backend data directory permissions
sudo chmod -R 755 /var/www/sanhoti/backend/data
```

### Can't Access Website

1. Check Security Group: Ensure ports 80, 443, and 22 are open
2. Check if services are running:
   ```bash
   sudo systemctl status nginx
   pm2 status
   ```
3. Check firewall:
   ```bash
   sudo ufw status
   sudo ufw allow 'Nginx Full'
   ```

### Application Crashes

```bash
# Monitor in real-time
pm2 monit

# View detailed logs
pm2 logs sanhoti-backend --lines 100

# Restart application
pm2 restart sanhoti-backend
```

---

## Maintenance & Updates

### Update Your Application

```bash
cd /var/www/sanhoti

# Pull latest changes (if using Git)
git pull origin main
# Note: Your repository is git@github.com:debasisnice/Sanhoti.git

# Rebuild and restart
cd backend
npm install
npm run build
pm2 restart sanhoti-backend

cd ../frontend
npm install
npm run build

# Reload Nginx
sudo systemctl reload nginx
```

### Backup Data

```bash
# Create backup script
sudo nano /usr/local/bin/backup-sanhoti.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/sanhoti"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/sanhoti-backup-$DATE.tar.gz -C /var/www/sanhoti/backend data
# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-sanhoti.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add line:
0 2 * * * /usr/local/bin/backup-sanhoti.sh
```

### Monitor Application

```bash
# View PM2 dashboard
pm2 monit

# Check system resources
htop

# Check disk usage
df -h

# Check logs
pm2 logs sanhoti-backend
sudo tail -f /var/log/nginx/access.log
```

### Update System Packages

```bash
# Update packages monthly
sudo apt update && sudo apt upgrade -y

# Reboot if kernel updates
sudo reboot
```

---

## Additional Configuration

### Update CORS in Backend

Edit `backend/src/server.ts` to include your production domain:

```typescript
app.use(cors({
  origin: [
    'http://YOUR_DOMAIN',
    'https://YOUR_DOMAIN',
    'http://YOUR_PUBLIC_IP'
  ],
  credentials: true,
  // ... rest of config
}));
```

### Enable Gzip Compression in Nginx

Edit `/etc/nginx/nginx.conf` and uncomment:

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
```

Then reload: `sudo systemctl reload nginx`

---

## Cost Estimation

**Free Tier (First 12 Months):**
- EC2 t2.micro: $0/month
- EBS 30GB: $0/month
- Data Transfer: ~$0/month (within free tier limits)

**After Free Tier:**
- EC2 t2.micro: ~$8-10/month
- EBS 30GB: $3/month
- Data Transfer: Varies (usually minimal)
- **Total: ~$11-13/month**

---

## Security Checklist

- [ ] Changed default JWT_SECRET
- [ ] Set strong passwords/keys
- [ ] Limited SSH access to your IP
- [ ] Enabled firewall (UFW)
- [ ] Set up SSL certificate
- [ ] Regular backups configured
- [ ] Updated system packages
- [ ] Secured .env file (not in git)
- [ ] Disabled root login (optional)
- [ ] Set up fail2ban (optional)

---

## Support

If you encounter issues:
1. Check logs: `pm2 logs` and `/var/log/nginx/error.log`
2. Verify all services are running
3. Check security group rules
4. Review this guide's troubleshooting section

---

**Congratulations! Your Sanhoti website should now be live on AWS! 🎉**

