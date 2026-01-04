# 🔧 CI/CD Troubleshooting Guide

## Quick Checklist

### ✅ Step 1: Verify GitHub Secrets Are Set

1. Go to: https://github.com/debasisnice/Sanhoti/settings/secrets/actions
2. You should see these three secrets:
   - `EC2_SSH_PRIVATE_KEY`
   - `EC2_HOST`
   - `EC2_USER`

**If any are missing, add them!**

---

### ✅ Step 2: Verify Your Private Key

**Get your private key (for GitHub Secret):**

```bash
cat ~/.ssh/deploy_key_ec2
```

Copy the ENTIRE output (including `-----BEGIN` and `-----END` lines) and paste it into the `EC2_SSH_PRIVATE_KEY` secret.

---

### ✅ Step 3: Add Public Key to EC2

**Your public key:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ4fSUqRvYcIH+RojyAkf0zgwcDwbBJ2qL2I56S0VkML github-actions-deploy
```

**SSH into EC2 and add it:**
```bash
# 1. SSH into EC2
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207

# 2. Add the public key
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ4fSUqRvYcIH+RojyAkf0zgwcDwbBJ2qL2I56S0VkML github-actions-deploy" >> ~/.ssh/authorized_keys

# 3. Set correct permissions
chmod 600 ~/.ssh/authorized_keys

# 4. Exit
exit

# 5. Test the key works
ssh -i ~/.ssh/deploy_key_ec2 ubuntu@44.220.179.207
```

If the test SSH works, your key is correctly set up!

---

### ✅ Step 4: Setup Passwordless Sudo for Nginx

**SSH into EC2:**
```bash
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207
```

**Edit sudoers:**
```bash
sudo visudo
```

**Add this line at the end:**
```
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
```

**Save** (Ctrl+X, then Y, then Enter)

**Test it:**
```bash
sudo systemctl reload nginx
```

Should work without asking for password!

---

### ✅ Step 5: Check GitHub Actions Logs

1. Go to: https://github.com/debasisnice/Sanhoti/actions
2. Click on the latest workflow run
3. Click on "Deploy to EC2" step
4. Look for error messages

**Common errors and fixes:**

#### Error: "EC2_USER or EC2_HOST is not set!"
→ **Fix:** Make sure GitHub Secrets `EC2_HOST` and `EC2_USER` are set (no quotes, no spaces)

#### Error: "Permission denied (publickey)"
→ **Fix:** 
- Verify the public key is in EC2 `~/.ssh/authorized_keys`
- Check the private key in GitHub Secrets matches `~/.ssh/deploy_key_ec2`
- Test SSH manually: `ssh -i ~/.ssh/deploy_key_ec2 ubuntu@44.220.179.207`

#### Error: "sudo: a password is required"
→ **Fix:** Setup passwordless sudo for nginx reload (Step 4 above)

#### Error: "Connection refused" or "Could not resolve hostname"
→ **Fix:** 
- Verify EC2 instance is running
- Check security group allows SSH (port 22) from GitHub Actions IPs
- Verify `EC2_HOST` secret is correct: `44.220.179.207`

#### Error: "PM2 not found" or "npm not found"
→ **Fix:** SSH into EC2 and install:
```bash
sudo npm install -g pm2
```

#### Error: "git pull failed"
→ **Fix:** Check Git is configured on EC2:
```bash
cd /var/www/sanhoti
git remote -v  # Should show your GitHub repo
```

---

### ✅ Step 6: Manual Test

**Test the deployment script manually on EC2:**

```bash
# SSH into EC2
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207

# Go to app directory
cd /var/www/sanhoti

# Pull latest code
git pull origin main

# Build backend
cd backend
npm ci
npm run build

# Build frontend
cd ../frontend
npm ci
npm run build

# Restart services
pm2 restart sanhoti-backend
sudo systemctl reload nginx

# Check status
pm2 status
```

If this works manually, the CI/CD should work too!

---

### ✅ Step 7: Verify Workflow File

The workflow file should be at: `.github/workflows/deploy.yml`

If you've made changes to it, make sure:
- Secrets are referenced correctly: `${{ secrets.EC2_HOST }}`
- No syntax errors
- Committed and pushed to GitHub

---

## 🐛 Still Not Working?

1. **Check GitHub Actions tab** for specific error messages
2. **Check EC2 logs** - SSH in and check PM2 logs: `pm2 logs sanhoti-backend`
3. **Verify network access** - Make sure security group allows SSH from GitHub IPs
4. **Test SSH connection** manually from your local machine

---

## 📝 Quick Reference

**GitHub Secrets:**
- `EC2_SSH_PRIVATE_KEY`: Contents of `~/.ssh/deploy_key_ec2`
- `EC2_HOST`: `44.220.179.207`
- `EC2_USER`: `ubuntu`

**EC2 Connection:**
- IP: `44.220.179.207`
- User: `ubuntu`
- Key: `~/.ssh/deploy_key_ec2` (for CI/CD) or `~/Downloads/sanhoti-keypair.pem` (for manual)

---

**Need help? Check the GitHub Actions logs for the specific error message!**


