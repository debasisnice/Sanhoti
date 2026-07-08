# Manual Fix for Backend OOM - Run on AWS Server

## Step 1: Access AWS Server
Use AWS Session Manager (EC2 Console → Connect → Session Manager) or SSH.

## Step 2: Add Swap Space
```bash
# Check current memory
free -h

# Create 2GB swap file
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify swap is active
free -h
```

## Step 3: Reconfigure Backend with Memory Limits
```bash
cd /var/www/sanhoti/backend

# Stop current backend
pm2 stop sanhoti-backend
pm2 delete sanhoti-backend

# Start with memory limit (512MB max)
pm2 start dist/server.js --name sanhoti-backend --max-memory-restart 512M --node-args="--max-old-space-size=512"
pm2 save

# Verify
pm2 status
curl http://localhost:5001/health
```

## Step 4: Monitor
```bash
# Watch memory usage
pm2 monit

# Check logs
pm2 logs sanhoti-backend --lines 50
```

## Alternative: Create Ecosystem Config
If you want more control, create `ecosystem.config.js`:

```bash
cd /var/www/sanhoti/backend

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'sanhoti-backend',
    script: 'dist/server.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '512M',
    node_args: '--max-old-space-size=512',
    env: {
      NODE_ENV: 'production',
      PORT: 5001
    }
  }]
};
EOF

# Stop old process
pm2 stop sanhoti-backend 2>/dev/null || true
pm2 delete sanhoti-backend 2>/dev/null || true

# Start with config
pm2 start ecosystem.config.js
pm2 save
```

## Verify Everything Works
```bash
# Check memory
free -h

# Check PM2
pm2 status

# Check backend
curl http://localhost:5001/health

# Monitor for a few minutes
pm2 monit
```
