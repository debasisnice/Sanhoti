#!/bin/bash

# Quick fix for backend OOM (Out of Memory) issues on t3.micro
# Run this script on the AWS server

set -e

echo "🔧 Fixing Backend OOM Issues..."

# 1. Add swap space if not exists
if [ ! -f /swapfile ]; then
    echo "📦 Creating 2GB swap file..."
    # Use dd instead of fallocate for better compatibility
    sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap file created"
else
    echo "✅ Swap file already exists"
fi

# 2. Check current memory
echo ""
echo "💾 Current Memory Status:"
free -h

# 3. Stop and reconfigure backend with memory limits
echo ""
echo "🔄 Reconfiguring backend with memory limits..."
cd /var/www/sanhoti/backend

# Stop backend
pm2 stop sanhoti-backend 2>/dev/null || true
pm2 delete sanhoti-backend 2>/dev/null || true

# Create ecosystem config if it doesn't exist
if [ ! -f ecosystem.config.js ]; then
    echo "📝 Creating ecosystem.config.js..."
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
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false
  }]
};
EOF
    mkdir -p logs
    echo "✅ Ecosystem config created"
fi

# Start backend with new config
echo "🚀 Starting backend with memory limits..."
pm2 start ecosystem.config.js
pm2 save

# 4. Verify
echo ""
echo "✅ Verification:"
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "💚 Backend Health:"
sleep 2
curl -s http://localhost:5001/health || echo "⚠️  Backend not responding yet (may need a moment)"

echo ""
echo "💾 Memory After Fix:"
free -h

echo ""
echo "✅ Fix applied! Monitor with: pm2 monit"
echo "📝 Check logs with: pm2 logs sanhoti-backend"
