# Quick AWS Deployment

## Run these commands on your AWS server:

```bash
# 1. SSH into your server
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207

# 2. Navigate to project directory
cd /var/www/sanhoti

# 3. Pull latest code
git pull origin main

# 4. Rebuild frontend
cd frontend
npm ci
npm run build

# 5. Reload services
cd ..
sudo systemctl reload nginx
pm2 restart sanhoti-backend

# 6. Verify deployment
pm2 list
curl http://localhost:5001/health
```

## Or use the automated script on AWS server:

```bash
cd /var/www/sanhoti
bash deploy.sh
```

## Verify deployment:

1. Check backend: `curl http://localhost:5001/health`
2. Check frontend: Visit `http://44.220.179.207/`
3. Check PM2: `pm2 list`
4. Check logs: `pm2 logs sanhoti-backend --lines 20`

