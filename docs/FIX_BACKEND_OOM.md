# Fix Backend Out of Memory (OOM) Issue

## Problem
The backend Node.js process is being killed by the Linux OOM killer because the t3.micro instance (1GB RAM) is running out of memory.

## Solutions (Choose One)

### Solution 1: Add Swap Space (Quick Fix - Recommended First)
This gives the system more virtual memory to work with.

```bash
# SSH into AWS server
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@<YOUR_IP>

# Check current swap
free -h

# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
free -h
```

### Solution 2: Limit Node.js Memory Usage
Configure PM2 to limit Node.js memory usage.

```bash
# SSH into AWS server
cd /var/www/sanhoti/backend

# Stop current backend
pm2 stop sanhoti-backend
pm2 delete sanhoti-backend

# Start with memory limit (512MB max)
pm2 start dist/server.js --name sanhoti-backend --max-memory-restart 512M

# Save PM2 config
pm2 save

# Check status
pm2 status
pm2 logs sanhoti-backend
```

### Solution 3: Optimize Node.js with Environment Variables
Add Node.js memory optimization flags.

```bash
# Edit PM2 ecosystem or use environment variables
cd /var/www/sanhoti/backend

# Stop backend
pm2 stop sanhoti-backend
pm2 delete sanhoti-backend

# Start with optimized Node.js flags
NODE_OPTIONS="--max-old-space-size=512" pm2 start dist/server.js --name sanhoti-backend

# Or create ecosystem.config.js for better control
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

# Start with ecosystem config
pm2 start ecosystem.config.js
pm2 save
```

### Solution 4: Upgrade Instance Type (Best Long-term Solution)
Upgrade from t3.micro (1GB RAM) to t3.small (2GB RAM) or t3.medium (4GB RAM).

**Steps:**
1. Go to AWS Console → EC2 → Instances
2. Select your instance
3. Click "Actions" → "Instance State" → "Stop"
4. Wait for instance to stop
5. Click "Actions" → "Instance Settings" → "Change Instance Type"
6. Select **t3.small** (2GB RAM) or **t3.medium** (4GB RAM)
7. Click "Apply"
8. Start the instance

**Cost:**
- t3.micro: ~$7.50/month (1GB RAM)
- t3.small: ~$15/month (2GB RAM)
- t3.medium: ~$30/month (4GB RAM)

### Solution 5: Check for Memory Leaks
Investigate what's consuming memory.

```bash
# Check current memory usage
free -h
ps aux --sort=-%mem | head -10

# Check PM2 memory usage
pm2 monit

# Check backend logs for memory issues
pm2 logs sanhoti-backend --lines 100 | grep -i "memory\|heap\|out of memory"
```

## Recommended Approach

**Immediate Fix (Do This First):**
1. Add swap space (Solution 1) - Takes 2 minutes
2. Limit Node.js memory (Solution 2) - Takes 1 minute
3. Restart backend and monitor

**Long-term Fix:**
- Upgrade to t3.small (2GB RAM) if budget allows
- Or keep t3.micro with swap + memory limits

## Verification

After applying fixes:

```bash
# Check memory
free -h

# Check PM2 status
pm2 status

# Check backend health
curl http://localhost:5001/health

# Monitor for a few minutes
pm2 monit

# Check system logs for OOM kills
sudo dmesg | grep -i "out of memory" | tail -10
```

## Prevention

1. **Monitor Memory Usage:**
   ```bash
   # Set up PM2 monitoring
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   ```

2. **Set Up Alerts:**
   - Use CloudWatch to monitor memory usage
   - Set alerts when memory > 80%

3. **Optimize Code:**
   - Review backend code for memory leaks
   - Use streaming for large file operations
   - Limit concurrent requests if needed
