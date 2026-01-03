# Deploying Sanhoti with Existing AWS Application

This guide covers deploying Sanhoti when you already have another application hosted on AWS.

## Important Considerations

### Free Tier Limitations
- **Free tier is per AWS account**, not per instance
- You've already used some of your 750 hours/month free tier
- After free tier expires, each EC2 instance costs ~$8-10/month

### Options

1. **Use Same EC2 Instance** (Recommended if resources allow)
   - Cost: $0 additional (within free tier limits)
   - Both apps share the t2.micro resources
   - Uses Nginx virtual hosts/server blocks

2. **Create New EC2 Instance**
   - Cost: Additional $8-10/month after free tier
   - Complete isolation
   - Better performance separation

3. **Use Different Ports**
   - Both apps on same instance
   - Different ports (e.g., :80 for app1, :8080 for app2)
   - Less ideal for production

---

## Option 1: Same EC2 Instance (Recommended)

### Step 1: Check Current Resources

On your existing EC2 instance:

```bash
# Check available resources
free -h
df -h
top

# Check if Node.js is installed
node --version
npm --version

# Check if Nginx is installed
nginx -v
```

### Step 2: Check Current Nginx Configuration

```bash
# List current sites
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/

# View current configuration
cat /etc/nginx/sites-available/default
# or
cat /etc/nginx/sites-available/your-existing-app
```

### Step 3: Deploy Sanhoti to Separate Directory

```bash
# Create directory for Sanhoti
sudo mkdir -p /var/www/sanhoti
sudo chown -R $USER:$USER /var/www/sanhoti
cd /var/www/sanhoti

# Clone repository
git clone git@github.com:debasisnice/Sanhoti.git .

# Install dependencies
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
```

### Step 4: Configure Nginx for Multiple Sites

Create Sanhoti Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/sanhoti
```

**If using a domain/subdomain:**

```nginx
# Sanhoti Configuration
server {
    listen 80;
    server_name sanhoti.yourdomain.com;  # or your-domain.com
    
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
    
    location /health {
        proxy_pass http://localhost:5001/health;
    }
}
```

**If using IP address with path:**

```nginx
# Sanhoti Configuration
server {
    listen 80;
    server_name YOUR_EC2_IP;
    
    # Sanhoti frontend
    location /sanhoti {
        alias /var/www/sanhoti/frontend/dist;
        try_files $uri $uri/ /sanhoti/index.html;
        index index.html;
    }
    
    # Sanhoti backend API
    location /sanhoti/api {
        rewrite ^/sanhoti/api/(.*) /api/$1 break;
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
    
    # Your existing app routes (adjust as needed)
    location / {
        # Your existing app configuration
        # ...
    }
}
```

**If using different port:**

```nginx
# Sanhoti on port 8080
server {
    listen 8080;
    server_name YOUR_EC2_IP;
    
    location / {
        root /var/www/sanhoti/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:5001;
        # ... proxy settings ...
    }
}
```

Update security group to allow port 8080 if using this approach.

### Step 5: Enable Site

```bash
# Enable Sanhoti site
sudo ln -s /etc/nginx/sites-available/sanhoti /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 6: Start Sanhoti Backend

```bash
cd /var/www/sanhoti/backend

# Create .env file
nano .env
# Add your configuration (see main deployment guide)

# Start with PM2
pm2 start dist/server.js --name sanhoti-backend
pm2 save

# Check both apps are running
pm2 list
```

---

## Option 2: New EC2 Instance

If you prefer complete isolation or your current instance doesn't have enough resources:

📖 **See detailed guide**: [NEW_INSTANCE_DEPLOYMENT.md](./NEW_INSTANCE_DEPLOYMENT.md)

### Quick Summary

1. Follow the detailed `NEW_INSTANCE_DEPLOYMENT.md` guide
2. Create a new t2.micro instance
3. **Note**: This uses more of your free tier hours
   - If both instances run 24/7, you'll exceed 750 hours/month
   - During free tier: ~$6-8/month for extra hours
   - After free tier: ~$16-20/month for both instances

### Use Different Security Groups

- Create separate security groups for each application
- Easier to manage and secure independently

---

## Option 3: Resource Optimization

### Monitor Resources

```bash
# Install monitoring tools
sudo apt install htop

# Monitor in real-time
htop

# Check disk usage
df -h

# Check memory
free -h

# Check CPU usage
top
```

### Optimize if Needed

1. **Reduce memory usage**:
   - Use PM2 cluster mode carefully (may not fit in 1GB RAM)
   - Optimize Node.js heap size if needed

2. **Optimize disk space**:
   - Clean npm cache: `npm cache clean --force`
   - Remove old logs: `pm2 flush`
   - Regular backups and cleanup

3. **Use PM2 ecosystem** for better resource management:

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'existing-app-backend',
      script: '/var/www/existing-app/backend/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M'
    },
    {
      name: 'sanhoti-backend',
      script: '/var/www/sanhoti/backend/dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M'
    }
  ]
};
```

Then start with: `pm2 start ecosystem.config.js`

---

## Recommended Approach

### If Current Instance Has Resources Available:
✅ **Use same instance with subdomain or path routing**

### If Resources Are Limited:
✅ **Create new instance** (costs more but better isolation)

### Best Practice for Production:
✅ **Use subdomains** (e.g., `app1.yourdomain.com` and `sanhoti.yourdomain.com`)

---

## DNS Configuration (If Using Subdomains)

### Add A Record for Subdomain

1. Go to your domain registrar's DNS settings
2. Add A record:
   - **Name**: `sanhoti` (or `www.sanhoti`)
   - **Type**: A
   - **Value**: Your EC2 public IP address
   - **TTL**: 300

3. Wait for DNS propagation (5-30 minutes)

4. Configure SSL for subdomain:
   ```bash
   sudo certbot --nginx -d sanhoti.yourdomain.com
   ```

---

## Cost Estimate

### Same Instance:
- Current cost: $0 (free tier) or existing cost
- Additional cost: $0
- **Total**: Same as current

### New Instance:
- Current app: $0 (free tier) or existing cost
- Sanhoti: $0 (free tier, if hours available) or $8-10/month
- **Total**: $0-20/month depending on free tier usage

**Note**: Free tier is 750 hours/month total, not per instance.
- 1 instance 24/7 = 730 hours/month ✅ (within limit)
- 2 instances 24/7 = 1460 hours/month ❌ (exceeds limit, will incur charges)

---

## Troubleshooting

### Port Conflicts

```bash
# Check what's using ports
sudo netstat -tlnp | grep :5001
sudo lsof -i :5001

# If port in use, change Sanhoti port in backend/.env
PORT=5002
```

### Nginx Conflicts

```bash
# Check Nginx configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log

# Check if all sites are enabled
ls -la /etc/nginx/sites-enabled/
```

### Memory Issues

```bash
# Check PM2 memory usage
pm2 monit

# Restart if needed
pm2 restart all

# Check system memory
free -h
```

---

## Quick Decision Matrix

| Scenario | Recommendation |
|----------|----------------|
| t2.micro, low traffic apps | ✅ Same instance |
| t2.micro, medium traffic | ⚠️ Monitor resources, consider upgrade |
| t2.micro, high traffic | ✅ New instance or upgrade instance type |
| Want complete isolation | ✅ New instance |
| Want to save money | ✅ Same instance |
| Different domains | ✅ Same instance with virtual hosts |

---

## Next Steps

1. **Check current instance resources**: Run resource check commands above
2. **Choose deployment option**: Based on resources and requirements
3. **Configure Nginx**: Set up virtual hosts for both apps
4. **Deploy Sanhoti**: Follow deployment steps
5. **Test both applications**: Ensure they work independently
6. **Monitor resources**: Watch for any issues

Need help deciding which option? Check your current instance resources first!

