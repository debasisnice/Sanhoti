# Fix PM2 Backend Process

## Issue
`[PM2][ERROR] Process or Namespace backend not found`

This means PM2 doesn't have a process named "backend" running.

## Solution

### Step 1: Check PM2 Status

```bash
pm2 list
```

This will show all running PM2 processes.

### Step 2: Check What Backend Process Should Be Named

The backend might be running under a different name. Common names:
- `sanhoti-backend`
- `server`
- `node`
- Or it might not be running at all

### Step 3: Start/Restart Backend

**If backend is not running:**

```bash
cd /var/www/sanhoti/backend
pm2 start npm --name "backend" -- run start
# Or if using dist:
pm2 start dist/server.js --name "backend"
```

**If backend is running under different name:**

```bash
# Find the process name from pm2 list
pm2 restart <process-name>
```

**If using PM2 ecosystem file:**

```bash
cd /var/www/sanhoti
pm2 start ecosystem.config.js
# Or
pm2 restart ecosystem.config.js
```

### Step 4: Verify Backend is Running

```bash
pm2 list
pm2 logs backend --lines 20
```

### Step 5: Reload Nginx

```bash
sudo systemctl reload nginx
```

## Complete Fix Sequence

```bash
# 1. Check PM2 status
pm2 list

# 2. If backend not running, start it
cd /var/www/sanhoti/backend
pm2 start npm --name "backend" -- run start

# 3. Or if you have a different setup, check backend directory
cd /var/www/sanhoti/backend
ls -la
cat package.json | grep "start"

# 4. Reload Nginx
sudo systemctl reload nginx

# 5. Test backend
curl http://localhost:5001/health
```

