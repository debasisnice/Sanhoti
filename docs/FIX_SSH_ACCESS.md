# Fix SSH Access to AWS EC2 Instance

## Problem
- SSH connection times out
- SSM Agent is not online (can't use Session Manager)
- Need to access server to fix backend OOM issue

## Solution: Fix Security Group Rules via AWS Console

### Step 1: Get Your Current IP Address
Your current IP is: **136.52.40.61**

(If this changes, check with: `curl https://api.ipify.org`)

### Step 2: Update Security Group in AWS Console

1. **Go to EC2 Console:**
   - https://console.aws.amazon.com/ec2/
   - Click "Instances" in left menu

2. **Select Your Instance:**
   - Find `sanhoti-website` (i-0a28b7dc87fe31b3e)
   - Click on it to select

3. **Open Security Group:**
   - Click "Security" tab (bottom panel)
   - Click on the Security Group name (it's a link)

4. **Edit Inbound Rules:**
   - Click "Edit inbound rules" button
   - Look for SSH rule (port 22)
   
   **If SSH rule exists but is restricted:**
   - Click "Edit" on the SSH rule
   - Change "Source" to: `136.52.40.61/32` (your current IP)
   - Or use `0.0.0.0/0` (allows from anywhere - less secure but works)
   - Click "Save rules"

   **If SSH rule doesn't exist:**
   - Click "Add rule"
   - Type: SSH
   - Port: 22
   - Source: `136.52.40.61/32` (your IP) or `0.0.0.0/0` (anywhere)
   - Description: "Allow SSH access"
   - Click "Save rules"

5. **Verify Rules:**
   - You should see:
     - SSH (22) from your IP or 0.0.0.0/0 ✅
     - HTTP (80) from 0.0.0.0/0 ✅
     - HTTPS (443) from 0.0.0.0/0 ✅

### Step 3: Get Current Public IP

The instance IP may have changed. Check it:

1. In EC2 Console → Instances
2. Select your instance
3. Look at "Public IPv4 address" column
4. Note the IP (might be different from 44.220.179.207)

### Step 4: Try SSH Again

```bash
# Replace <NEW_IP> with the actual IP from Step 3
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@<NEW_IP>
```

### Step 5: If Still Not Working - Check Instance Status

1. In EC2 Console → Instances
2. Check "Instance state":
   - Should be "Running" ✅
   - If "Stopped", click "Start instance"
   - Wait 1-2 minutes for it to start

3. Check "Status checks":
   - Should show "2/2 checks passed" ✅
   - If showing "2/3 checks passed" or errors, the instance may need a reboot

### Step 6: Alternative - Use EC2 Instance Connect (Browser-based)

If SSH still doesn't work:

1. In EC2 Console → Select instance
2. Click "Connect" button
3. Choose "EC2 Instance Connect" tab
4. Click "Connect"
5. This opens a browser-based terminal (no SSH needed!)

## Once Connected - Fix Backend OOM

After you can access the server (via SSH or EC2 Instance Connect), run:

```bash
# Add swap space
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Fix backend
cd /var/www/sanhoti/backend
pm2 stop sanhoti-backend
pm2 delete sanhoti-backend
pm2 start dist/server.js --name sanhoti-backend --max-memory-restart 512M --node-args="--max-old-space-size=512"
pm2 save

# Verify
pm2 status
curl http://localhost:5001/health
free -h
```

## Quick Checklist

- [ ] Updated security group to allow SSH from your IP (136.52.40.61/32) or 0.0.0.0/0
- [ ] Got current Public IPv4 address from EC2 Console
- [ ] Instance state is "Running"
- [ ] Tried SSH with correct IP
- [ ] If SSH fails, tried EC2 Instance Connect (browser terminal)
- [ ] Once connected, ran OOM fix commands
