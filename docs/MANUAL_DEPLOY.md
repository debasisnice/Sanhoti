# 📦 Manual Deployment Guide

## Quick Manual Deployment

### Option 1: Use the Deployment Script (Recommended)

```bash
cd "/Users/debasispramanik/Library/Mobile Documents/com~apple~CloudDocs/Project/Sanhoti"
../scripts/manual_deploy.sh
```

The script will:
1. ✅ Build backend locally
2. ✅ Build frontend locally
3. ✅ Push code to GitHub
4. ✅ SSH into EC2
5. ✅ Pull latest code
6. ✅ Build on EC2
7. ✅ Restart PM2 backend
8. ✅ Reload Nginx

---

### Option 2: Manual Step-by-Step

#### Step 1: Build and Push Locally

```bash
# Build backend
cd backend
npm install
npm run build
cd ..

# Build frontend
cd frontend
npm install
npm run build
cd ..

# Commit and push
git add -A
git commit -m "Manual deployment"
git push
```

#### Step 2: Deploy to EC2

```bash
# SSH into EC2
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207
```

Once connected to EC2, run:

```bash
# Navigate to app directory
cd /var/www/sanhoti

# Pull latest code
git pull origin main

# Build backend
cd backend
npm ci
npm run build

# Build frontend
cd ../frontend
npm ci
npm run build

# Restart backend
pm2 restart sanhoti-backend

# Reload Nginx
sudo systemctl reload nginx

# Check status
pm2 status
```

#### Step 3: Verify

```bash
# Check backend health
curl http://localhost:5001/health

# Check PM2 status
pm2 status

# Check Nginx
sudo systemctl status nginx
```

---

## 🔧 First Time Setup on EC2

If this is your first deployment, you may need to:

### 1. Create App Directory

```bash
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207

sudo mkdir -p /var/www/sanhoti
sudo chown ubuntu:ubuntu /var/www/sanhoti
cd /var/www/sanhoti
```

### 2. Clone Repository

```bash
# Make sure Git is configured
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Clone the repo
git clone git@github.com:debasisnice/Sanhoti.git .
# OR if using HTTPS:
git clone https://github.com/debasisnice/Sanhoti.git .
```

### 3. Install Dependencies

```bash
# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx (if not installed)
sudo apt-get update
sudo apt-get install -y nginx
```

### 4. Setup Environment

```bash
cd /var/www/sanhoti/backend

# Create .env file
cat > .env << 'EOF'
PORT=5001
JWT_SECRET=your-secret-key-here
EMAIL_USER=
EMAIL_PASS=
UPLOAD_DIR=./uploads
CORS_ORIGIN=http://44.220.179.207
EOF
```

### 5. Create Required Directories

```bash
cd /var/www/sanhoti/backend
mkdir -p data uploads
mkdir -p data/Galleries data/Notice_Flyers data/Events_Flyers data/Magazines
```

### 6. Setup Nginx

```bash
sudo nano /etc/nginx/sites-available/sanhoti
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name 44.220.179.207;

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

    # Health check
    location /health {
        proxy_pass http://localhost:5001/health;
    }
}
```

Enable site:
```bash
sudo rm /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/sanhoti /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Start Backend with PM2

```bash
cd /var/www/sanhoti/backend
npm ci
npm run build
pm2 start dist/server.js --name sanhoti-backend
pm2 save
pm2 startup  # Follow the instructions shown
```

---

## 📝 Useful Commands

### On EC2:

```bash
# View backend logs
pm2 logs sanhoti-backend

# View last 50 lines
pm2 logs sanhoti-backend --lines 50

# Restart backend
pm2 restart sanhoti-backend

# Stop backend
pm2 stop sanhoti-backend

# Check status
pm2 status

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Restart Nginx
sudo systemctl restart nginx

# Check Nginx status
sudo systemctl status nginx
```

---

## 🐛 Troubleshooting

### Backend not starting:
```bash
pm2 logs sanhoti-backend
# Check for errors
```

### Frontend not loading:
```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Verify frontend build exists
ls -la /var/www/sanhoti/frontend/dist
```

### Can't SSH into EC2:
- Check your security group allows SSH (port 22)
- Verify your key file permissions: `chmod 400 ~/Downloads/sanhoti-keypair.pem`

---

**That's it! Your application should now be deployed manually.**


