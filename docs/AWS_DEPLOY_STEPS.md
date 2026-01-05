# AWS Deployment Steps

## Quick Deployment Commands

### 1. SSH into AWS Server
```bash
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207
```

### 2. Full Deployment (Run these commands on AWS server)
```bash
cd /var/www/sanhoti

# Pull latest code
git pull origin main

# Build backend
cd backend
npm install
npm run build
pm2 restart sanhoti-backend

# Build frontend
cd ../frontend
npm ci
npm run build

# Reload Nginx
cd ..
sudo systemctl reload nginx
```

### 3. Verify Deployment
```bash
# Run verification script
bash scripts/deploy-aws-verify.sh

# Or check manually:
pm2 status
curl http://localhost:5001/health
sudo systemctl status nginx
```

## Important Notes

### settings.json
- **settings.json is NOT in git** (for security - contains email passwords)
- The file will be **auto-created with defaults** when the backend first accesses it
- If you need to configure email settings, do it through the admin panel at `/admin/email`
- The backend will create the file automatically with default values if it doesn't exist

### Troubleshooting

**If changes aren't showing:**
1. Check if code was pulled: `cd /var/www/sanhoti && git log -1`
2. Check if frontend was rebuilt: `ls -la frontend/dist`
3. Check if backend was restarted: `pm2 logs sanhoti-backend --lines 20`
4. Clear browser cache or do hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

**If backend isn't running:**
```bash
cd /var/www/sanhoti/backend
pm2 start dist/server.js --name sanhoti-backend
pm2 save
```

**If frontend build fails:**
```bash
cd /var/www/sanhoti/frontend
rm -rf node_modules dist
npm ci
npm run build
```

**Check Nginx configuration:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## One-Line Deployment
```bash
cd /var/www/sanhoti && git pull origin main && cd backend && npm install && npm run build && pm2 restart sanhoti-backend && cd ../frontend && npm ci && npm run build && cd .. && sudo systemctl reload nginx
```

