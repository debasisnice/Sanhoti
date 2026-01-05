# Quick Deployment Reference

Quick reference for deploying Sanhoti to AWS EC2.

## Git Repository
```
git@github.com:debasisnice/Sanhoti.git
```

## Initial Setup Commands

### 1. On EC2 Server - Setup SSH Key for GitHub (One-time)

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"
# Press Enter to accept default location
# Press Enter twice for no passphrase (or set one)

# Display public key
cat ~/.ssh/id_ed25519.pub
```

**Copy the output** and add it to GitHub:
1. Go to GitHub → Settings → SSH and GPG keys
2. Click "New SSH key"
3. Paste the public key
4. Save

### 2. Clone Repository

```bash
cd /var/www
sudo mkdir -p sanhoti
sudo chown -R $USER:$USER sanhoti
cd sanhoti
git clone git@github.com:debasisnice/Sanhoti.git .
```

### 3. Initial Deployment

```bash
cd /var/www/sanhoti

# Install backend dependencies
cd backend
npm install
npm run build

# Install frontend dependencies
cd ../frontend
npm install
npm run build

# Create .env file for backend
cd ../backend
nano .env
# (Add your environment variables - see AWS_DEPLOYMENT_GUIDE.md)

# Create required directories
mkdir -p data uploads
mkdir -p data/Galleries data/Notice_Flyers data/Events_Flyers data/Magazines

# Start with PM2
pm2 start dist/server.js --name sanhoti-backend
pm2 save
```

## Quick Update Commands

```bash
cd /var/www/sanhoti
git pull origin main
../scripts/deploy.sh
```

Or manually:

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

## Verify Deployment

```bash
# Check backend health
curl http://localhost:5001/health

# Check PM2 status
pm2 status

# Check logs
pm2 logs sanhoti-backend

# Check Nginx
sudo systemctl status nginx
```

## Environment Variables Template

Create `backend/.env`:

```env
PORT=5001
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this-min-32-chars
JWT_EXPIRES_IN=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
UPLOAD_DIR=./uploads
CORS_ORIGIN=https://yourdomain.com,http://your-ec2-ip
```

## Useful Commands

```bash
# View logs
pm2 logs sanhoti-backend --lines 50

# Monitor
pm2 monit

# Restart
pm2 restart sanhoti-backend

# Stop
pm2 stop sanhoti-backend

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```


