# Fix SSH Timeout - Step by Step

## Problem
SSH connection times out - this means the security group is blocking port 22.

## Solution: Update Security Group in AWS Console

### Step 1: Open EC2 Console
1. Go to: https://console.aws.amazon.com/ec2/
2. Make sure you're in the correct region (check top-right corner)
3. Click "Instances" in the left sidebar

### Step 2: Find Your Instance
1. Look for instance: `sanhoti-website` or ID: `i-0a28b7dc87fe31b3e`
2. Click on the instance name/ID to select it

### Step 3: Open Security Group
1. Look at the bottom panel (instance details)
2. Click the "Security" tab
3. You'll see "Security groups" section
4. Click on the security group name (it's a blue clickable link)

### Step 4: Edit Inbound Rules
1. In the security group page, click "Edit inbound rules" button
2. Look for a rule with:
   - Type: SSH
   - Port: 22
   
   **If SSH rule exists:**
   - Click the "Edit" button (pencil icon) on the SSH rule
   - Change "Source" dropdown to "Custom"
   - In the text box, enter: `0.0.0.0/0`
   - Description: "Allow SSH from anywhere"
   - Click "Save rules"
   
   **If SSH rule doesn't exist:**
   - Click "Add rule" button
   - Type: Select "SSH" from dropdown
   - Port: Should auto-fill to 22
   - Source: Select "Custom" and enter `0.0.0.0/0`
   - Description: "Allow SSH access"
   - Click "Save rules"

### Step 5: Verify Rules
After saving, you should see:
```
Type        Protocol    Port Range    Source          Description
SSH         TCP         22            0.0.0.0/0       Allow SSH access
HTTP        TCP         80            0.0.0.0/0       Allow HTTP
HTTPS       TCP         443           0.0.0.0/0      Allow HTTPS
```

### Step 6: Wait 10-30 seconds
Security group changes apply immediately, but wait a moment for propagation.

### Step 7: Try SSH Again
```bash
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207
```

## Alternative: Use EC2 Instance Connect (No SSH Needed!)

If SSH still doesn't work, use the browser-based terminal:

1. In EC2 Console → Select your instance
2. Click "Connect" button (top right)
3. Choose "EC2 Instance Connect" tab
4. Click "Connect"
5. Browser terminal opens - no SSH needed!

## If Still Not Working

Check these:

1. **Instance State:**
   - Should be "Running" ✅
   - If "Stopped", click "Start instance"

2. **Status Checks:**
   - Should show "2/2 checks passed" ✅
   - If failing, instance may need reboot

3. **Network ACLs:**
   - Go to VPC → Network ACLs
   - Check if there are custom rules blocking port 22

4. **Try Different Port:**
   - Some instances use port 2222 instead of 22
   - Try: `ssh -i ~/Downloads/sanhoti-keypair.pem -p 2222 ubuntu@44.220.179.207`

## Quick Test: Can You Reach the Server?

Test if the server is reachable at all:

```bash
# Test if port 22 is open (should timeout if blocked)
nc -zv 44.220.179.207 22

# Test if website is accessible (should work)
curl -I https://www.sanhoti.org
```

If website works but SSH doesn't = Security group issue (needs SSH rule)
If both don't work = Instance might be down or network issue
