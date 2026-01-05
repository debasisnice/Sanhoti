# Deploy Sanhoti on New EC2 Instance

Complete guide for deploying Sanhoti on a separate EC2 instance (Option 2: Complete Isolation).

## Important Notes

✅ **Free Tier Benefits (New Account):**
- **Full 750 hours/month free tier available!**
- t2.micro instance running 24/7 = 730 hours/month
- **Completely FREE for first 12 months** (within free tier)
- After 12 months: ~$8-10/month per instance

✅ **Benefits:**
- Complete isolation
- No resource conflicts
- Independent scaling
- Better security separation
- Full free tier coverage

---

## Step 1: Create New EC2 Instance

### 1.1 In AWS Console

1. Go to **EC2 Dashboard** → **Instances**
2. Click **"Launch Instance"**
3. Configure:

   **Name and tags:**
   - Name: `sanhoti-website`

   **Application and OS Images:**
   - Ubuntu Server 22.04 LTS (Free tier eligible)

   **Instance type:**
   - t2.micro (Free tier eligible)
   - 1 vCPU, 1 GB RAM

   **Key pair:**
   - Select your existing key pair OR create a new one
   - If creating new: Name it `sanhoti-keypair` and download

   **Network settings:**
   - ✅ Allow HTTP traffic from the internet
   - ✅ Allow HTTPS traffic from the internet
   - SSH: Your IP (recommended) or 0.0.0.0/0

   **Configure storage:**
   - 30 GB gp3 (Free tier eligible)
   - General Purpose SSD (gp3)

4. Click **"Launch Instance"**

### 1.2 Get Instance Details

After instance is running:
- Note **Public IPv4 address**: `________________`
- Note **Public IPv4 DNS**: `________________`
- Note **Instance ID**: `________________`

### 1.3 Security Group Configuration

The default security group should have:
- **SSH (22)**: Your IP
- **HTTP (80)**: 0.0.0.0/0
- **HTTPS (443)**: 0.0.0.0/0

Verify in: **EC2 → Security Groups → Select your instance's security group**

---

## Step 2: Connect to New Instance

### On Mac/Linux:

```bash
# If using existing key pair
ssh -i ~/Downloads/YOUR_KEY_PAIR.pem ubuntu@NEW_INSTANCE_IP

# If using new key pair
chmod 400 ~/Downloads/sanhoti-keypair.pem
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@NEW_INSTANCE_IP
```

### On Windows (PuTTY):

1. Convert `.pem` to `.ppk` using PuTTYgen (if needed)
2. Enter Host Name: `ubuntu@NEW_INSTANCE_IP`
3. Load private key in Connection → SSH → Auth
4. Click "Open"

---

## Step 3: Initial Server Setup

Once connected, run:

```bash
# Update system
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
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x

# Install PM2 globally
sudo npm install -g pm2
```

---

## Step 5: Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify
sudo systemctl status nginx
```

---

## Step 6: Setup GitHub SSH Access

```bash
# Generate SSH key for GitHub
ssh-keygen -t ed25519 -C "your-email@example.com"
# Press Enter for default location
# Press Enter twice (no passphrase) or set one

# Display public key
cat ~/.ssh/id_ed25519.pub
```

**Copy the output** and add to GitHub:
1. GitHub → Settings → SSH and GPG keys
2. Click "New SSH key"
3. Paste public key
4. Save

---

## Step 7: Deploy Application

```bash
cd /var/www/sanhoti

# Clone repository
git clone git@github.com:debasisnice/Sanhoti.git .

# Install backend dependencies
cd backend
npm install
npm run build

# Install frontend dependencies
cd ../frontend
npm install
npm run build

cd ..
```

---

## Step 8: Configure Backend Environment

```bash
cd /var/www/sanhoti/backend

# Create .env file
nano .env
```

Add:

```env
PORT=5001
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this-min-32-characters-long
JWT_EXPIRES_IN=7d

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

UPLOAD_DIR=./uploads

# Update with your domain or IP
CORS_ORIGIN=http://NEW_INSTANCE_IP,https://your-domain.com
```

Save (Ctrl+X, Y, Enter)

```bash
# Create required directories
mkdir -p data uploads
mkdir -p data/Galleries data/Notice_Flyers data/Events_Flyers data/Magazines
```

---

## Step 9: Configure Nginx

```bash
# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Create Sanhoti configuration
sudo nano /etc/nginx/sites-available/sanhoti
```

Paste (replace `YOUR_DOMAIN_OR_IP`):

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

Save and exit

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/sanhoti /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# If test passes, reload
sudo systemctl reload nginx
```

---

## Step 10: Start Application with PM2

```bash
cd /var/www/sanhoti/backend

# Start backend
pm2 start dist/server.js --name sanhoti-backend

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Copy and run the command it outputs (starts with 'sudo env PATH=...')

# Check status
pm2 status
pm2 logs sanhoti-backend
```

---

## Step 11: Verify Deployment

```bash
# Test backend health
curl http://localhost:5001/health

# Check if services are running
pm2 status
sudo systemctl status nginx

# Check ports
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :5001
```

**Test in browser:**
- Frontend: `http://YOUR_NEW_INSTANCE_IP`
- API Health: `http://YOUR_NEW_INSTANCE_IP/health`

---

## Step 12: Setup SSL (If Using Domain)

### 12.1 Configure DNS

1. Go to your domain registrar
2. Add A record:
   - **Name**: `sanhoti` (or `www.sanhoti`)
   - **Type**: A
   - **Value**: Your new EC2 instance public IP
   - **TTL**: 300

3. Wait 5-30 minutes for DNS propagation

### 12.2 Install SSL Certificate

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d sanhoti.yourdomain.com -d www.sanhoti.yourdomain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Redirect HTTP to HTTPS: Yes

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## Step 13: Update Frontend API URL (If Using Domain)

If you set up a domain, update frontend build:

```bash
cd /var/www/sanhoti/frontend

# Create .env file
nano .env
```

Add:
```env
VITE_API_URL=https://your-domain.com/api
```

```bash
# Rebuild frontend
npm run build

# Reload Nginx
sudo systemctl reload nginx
```

---

## Cost Tracking

### Monitor Your Usage

1. Go to **AWS Billing Dashboard**
2. Set up **Budget Alerts**:
   - Alert at $5, $10, $15 thresholds
   - Check "Forecasted vs Actual"

3. Monitor EC2 usage:
   - EC2 Dashboard → Instances → Check running hours
   - Free tier: 750 hours/month (fresh account!)
   - One instance running 24/7 = 730 hours/month (well within limit)

### Estimated Costs

**Month 1-12 (Free Tier - New Account):**
- Sanhoti instance: 730 hours/month
- **FREE!** ✅ (within 750 hours/month limit)
- **Cost: $0/month**

**After 12 Months:**
- Sanhoti instance: ~$8-10/month
- **Total: ~$8-10/month**

---

## Maintenance

### Quick Update Script

Copy the deploy script to your server:

```bash
cd /var/www/sanhoti
# The deploy.sh script will pull from Git and rebuild
../scripts/deploy.sh
```

### Manual Update

```bash
cd /var/www/sanhoti
git pull origin main

cd backend
npm install
npm run build
pm2 restart sanhoti-backend

cd ../frontend
npm install
npm run build

sudo systemctl reload nginx
```

---

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
pm2 logs sanhoti-backend

# Check port availability
sudo lsof -i :5001

# Restart
pm2 restart sanhoti-backend
```

### Nginx Errors

```bash
# Check error logs
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t

# Restart
sudo systemctl restart nginx
```

### Can't Access Website

1. Check Security Group: Ports 80, 443 open
2. Check if services running: `pm2 status` and `sudo systemctl status nginx`
3. Check firewall: `sudo ufw status`
4. Check EC2 instance is running in AWS Console

---

## Summary Checklist

- [ ] New EC2 t2.micro instance created
- [ ] Connected via SSH
- [ ] Node.js 18.x installed
- [ ] Nginx installed and running
- [ ] PM2 installed
- [ ] GitHub SSH key set up
- [ ] Repository cloned
- [ ] Dependencies installed (backend & frontend)
- [ ] Backend built
- [ ] Frontend built
- [ ] Backend .env configured
- [ ] Required directories created
- [ ] Nginx configured
- [ ] Backend started with PM2
- [ ] PM2 startup configured
- [ ] Website accessible
- [ ] SSL configured (if using domain)
- [ ] Budget alerts set up

---

## Next Steps

1. ✅ Test all functionality on the new instance
2. ✅ Set up domain (if not done yet)
3. ✅ Configure SSL certificate
4. ✅ Set up backups (see main deployment guide)
5. ✅ Monitor costs in AWS Billing Dashboard

**Your Sanhoti website is now live on a dedicated EC2 instance! 🎉**

---

## Need Help?

Refer to:
- `AWS_DEPLOYMENT_GUIDE.md` - Detailed troubleshooting
- `MULTI_APP_DEPLOYMENT.md` - Managing multiple apps
- `DEPLOYMENT_CHECKLIST.md` - Quick reference

