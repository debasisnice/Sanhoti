# Fix EC2 Instance Connect Failed

## Problem
Both SSH and EC2 Instance Connect are failing. This usually means:
- Instance is not fully healthy
- Network configuration issue
- Instance needs reboot

## Solution Steps

### Step 1: Check Instance Status in AWS Console

1. Go to: https://console.aws.amazon.com/ec2/
2. Click "Instances"
3. Find `sanhoti-website` (i-0a28b7dc87fe31b3e)
4. Check these:

**Instance State:**
- Should be "Running" ✅
- If "Stopped" → Click "Start instance" and wait 2-3 minutes
- If "Stopping" or "Starting" → Wait for it to finish

**Status Checks:**
- Should show "2/2 checks passed" ✅
- If showing "2/3 checks passed" or "1/2 checks passed" → One check is failing
- This means the instance is running but not fully healthy

### Step 2: Reboot the Instance

If status checks are failing:

1. Select the instance
2. Click "Instance state" → "Reboot instance"
3. Wait 2-3 minutes for reboot to complete
4. Check status checks again - should show "2/2 checks passed"

### Step 3: Check Security Group (Again)

Even if you updated it, double-check:

1. Select instance → "Security" tab → Click security group name
2. "Edit inbound rules"
3. Verify SSH rule exists:
   - Type: SSH
   - Port: 22
   - Source: `0.0.0.0/0`
4. If missing or wrong, fix it and save

### Step 4: Check Network Settings

1. Select instance → "Networking" tab
2. Check:
   - **Public IPv4 address**: Should be 44.220.179.207
   - **Public IPv4 DNS**: Should show a DNS name
   - **Subnet**: Should be in a public subnet
   - **Auto-assign Public IP**: Should be enabled

### Step 5: Try Alternative Access Methods

**Option A: Use AWS Systems Manager (if SSM Agent works)**
1. EC2 Console → Select instance
2. Click "Connect" → "Session Manager" tab
3. If SSM Agent is online, this will work

**Option B: Check CloudWatch Logs**
1. EC2 Console → Select instance
2. Click "Monitoring" tab
3. Check for any error messages or unusual metrics

**Option C: Check Instance Logs**
1. EC2 Console → Select instance
2. Click "Actions" → "Monitor and troubleshoot" → "Get system log"
3. Look for boot errors or network issues

### Step 6: If Nothing Works - Create New Instance

If the instance is completely unresponsive:

1. **Take a snapshot first** (to preserve data):
   - Select instance → "Storage" tab
   - Click on volume → "Actions" → "Create snapshot"
   - Wait for snapshot to complete

2. **Terminate and recreate** (last resort):
   - Only if you have backups/snapshots
   - Launch new instance from AMI or snapshot
   - Reconfigure everything

## Quick Diagnostic Commands (If You Can Access)

If you somehow get access, run these:

```bash
# Check if SSH service is running
sudo systemctl status ssh

# Check network connectivity
ping -c 3 8.8.8.8

# Check if port 22 is listening
sudo netstat -tlnp | grep 22

# Check system resources
free -h
df -h
```

## Most Likely Fix

**Try this first:**
1. Reboot the instance (Step 2)
2. Wait 3-5 minutes
3. Check status checks - should be "2/2 checks passed"
4. Try EC2 Instance Connect again

The "2/3 checks passed" status you saw earlier indicates the instance is not fully healthy, which is why connections are failing.
