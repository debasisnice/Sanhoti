# GitHub Actions CI/CD Setup Guide

This guide will help you set up automatic deployment to AWS EC2 when you push to GitHub.

## Overview

When you run `git push`, GitHub Actions will automatically:
1. Build your backend and frontend
2. Deploy to your AWS EC2 instance
3. Restart services (PM2, Nginx)
4. Verify the deployment

## Prerequisites

1. ✅ Your code is already pushed to GitHub
2. ✅ EC2 instance is set up and accessible via SSH
3. ✅ You have SSH access to your EC2 instance

## Step 1: Generate SSH Key Pair (if you don't have one)

If you already have an SSH key for EC2 access, you can use that. Otherwise:

**On your local machine:**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key_ec2 -N ""
```

This creates:
- `~/.ssh/deploy_key_ec2` (private key - keep this secret!)
- `~/.ssh/deploy_key_ec2.pub` (public key)

## Step 2: Add Public Key to EC2

**Copy your public key to EC2:**

```bash
# Replace with your EC2 user (usually 'ubuntu') and IP
ssh-copy-id -i ~/.ssh/deploy_key_ec2.pub ubuntu@44.220.179.207
```

Or manually add it:

1. SSH into your EC2 instance
2. Edit `~/.ssh/authorized_keys`
3. Add the contents of `deploy_key_ec2.pub`

**Important:** Test SSH access:

```bash
ssh -i ~/.ssh/deploy_key_ec2 ubuntu@44.220.179.207
```

## Step 3: Configure GitHub Secrets

1. Go to your GitHub repository: `https://github.com/debasisnice/Sanhoti`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

### Secret 1: `EC2_SSH_PRIVATE_KEY`

**Value:** Contents of your private key file

```bash
# On your local machine, display the private key:
cat ~/.ssh/deploy_key_ec2
```

Copy the entire output (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`) and paste it into GitHub.

### Secret 2: `EC2_HOST`

**Value:** Your EC2 public IP or DNS

```
44.220.179.207
```

Or use the DNS:

```
ec2-44-220-179-207.compute-1.amazonaws.com
```

### Secret 3: `EC2_USER`

**Value:** Your EC2 username (usually `ubuntu` for Ubuntu instances)

```
ubuntu
```

## Step 4: Configure Sudo Access (Important!)

The deployment script needs to reload Nginx. Set up passwordless sudo for the nginx reload command:

**On your EC2 instance (SSH in):**

```bash
sudo visudo
```

Add this line at the end (replace `ubuntu` with your username if different):

```
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
```

Save and exit (Ctrl+X, then Y, then Enter).

**Test it:**

```bash
sudo systemctl reload nginx
```

It should work without asking for a password.

## Step 5: Test the Workflow

1. Make a small change to your code
2. Commit and push:

```bash
git add .
git commit -m "Test CI/CD deployment"
git push
```

3. Go to GitHub → **Actions** tab
4. You should see a workflow run starting
5. Click on it to see the deployment progress
6. Green checkmark = success! ✅

## Step 6: Verify Deployment

After successful deployment, check:

```bash
# SSH into EC2
ssh ubuntu@44.220.179.207

# Check PM2 status
pm2 status

# Check Nginx
sudo systemctl status nginx

# Check your website
curl http://localhost:5001/health
```

## Troubleshooting

### Error: Permission denied (publickey)

- Verify your private key is correctly added to GitHub Secrets
- Ensure the public key is in `~/.ssh/authorized_keys` on EC2
- Check file permissions: `chmod 600 ~/.ssh/authorized_keys`

### Error: sudo: a password is required

- Configure passwordless sudo for nginx reload (Step 4)
- Verify with: `sudo systemctl reload nginx`

### Error: PM2 not found

- SSH into EC2 and install PM2: `sudo npm install -g pm2`
- Verify with: `pm2 --version`

### Error: npm ci fails

- Ensure `package-lock.json` files are committed to Git
- The workflow uses `npm ci` which requires a lock file

### Deployment succeeds but website doesn't update

- Check PM2 logs: `pm2 logs sanhoti-backend`
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Verify frontend build output: `ls -la /var/www/sanhoti/frontend/dist`

## Manual Deployment (Alternative)

If you want to deploy manually, SSH into EC2 and run:

```bash
cd /var/www/sanhoti
git pull
cd backend && npm ci && npm run build
cd ../frontend && npm ci && npm run build
pm2 restart sanhoti-backend
sudo systemctl reload nginx
```

## Security Notes

- ⚠️ **Never commit your private SSH key to Git**
- ✅ Private keys should only be in GitHub Secrets
- ✅ Use separate SSH keys for deployment (not your personal key)
- ✅ Regularly rotate your SSH keys
- ✅ Use EC2 security groups to restrict SSH access to your IP only

## What Happens on Each Push?

1. ✅ Code is pulled from GitHub
2. ✅ Backend dependencies installed (`npm ci`)
3. ✅ Backend built (`npm run build`)
4. ✅ Frontend dependencies installed (`npm ci`)
5. ✅ Frontend built (`npm run build`)
6. ✅ PM2 restarts backend service
7. ✅ Nginx reloaded to serve new frontend
8. ✅ Deployment verified

## Monitoring

Check GitHub Actions logs:
- Go to: `https://github.com/debasisnice/Sanhoti/actions`
- Click on any workflow run to see detailed logs

View live deployment:
- SSH into EC2: `pm2 logs sanhoti-backend --lines 50`

---

🎉 **You're all set!** Now every `git push` will automatically deploy your changes to AWS!

