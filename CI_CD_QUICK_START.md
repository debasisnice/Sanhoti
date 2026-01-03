# CI/CD Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Generate SSH Key for Deployment

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key_ec2 -N ""
```

### 2. Copy Public Key to EC2

```bash
ssh-copy-id -i ~/.ssh/deploy_key_ec2.pub ubuntu@44.220.179.207
```

### 3. Test SSH Access

```bash
ssh -i ~/.ssh/deploy_key_ec2 ubuntu@44.220.179.207
```

If this works, you're good! Exit with `exit`.

### 4. Configure GitHub Secrets

Go to: `https://github.com/debasisnice/Sanhoti/settings/secrets/actions`

Click **New repository secret** and add:

#### Secret 1: `EC2_SSH_PRIVATE_KEY`
```bash
cat ~/.ssh/deploy_key_ec2
```
Copy entire output (from `-----BEGIN` to `-----END`)

#### Secret 2: `EC2_HOST`
```
44.220.179.207
```

#### Secret 3: `EC2_USER`
```
ubuntu
```

### 5. Setup Passwordless Sudo for Nginx (on EC2)

SSH into EC2:
```bash
ssh ubuntu@44.220.179.207
```

Run:
```bash
sudo visudo
```

Add this line at the end:
```
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
```

Save (Ctrl+X, Y, Enter) and test:
```bash
sudo systemctl reload nginx
```

### 6. Commit and Push the Workflow

```bash
git add .github/
git commit -m "Add CI/CD workflow"
git push
```

### 7. Test It! 🎉

Make a small change and push:
```bash
echo "# Test" >> README.md
git add README.md
git commit -m "Test CI/CD"
git push
```

Check GitHub Actions: `https://github.com/debasisnice/Sanhoti/actions`

---

## ✅ What Happens on `git push`?

1. ✅ GitHub Actions triggers
2. ✅ Builds backend (`npm ci && npm run build`)
3. ✅ Builds frontend (`npm ci && npm run build`)
4. ✅ Deploys to EC2
5. ✅ Restarts PM2 backend
6. ✅ Reloads Nginx
7. ✅ Verifies deployment

---

## 🐛 Troubleshooting

**"Permission denied (publickey)"**
→ Check SSH key in GitHub Secrets matches `~/.ssh/deploy_key_ec2`

**"sudo: a password is required"**
→ Run `sudo visudo` and add the nginx reload line (Step 5)

**"PM2 not found"**
→ SSH into EC2 and run: `sudo npm install -g pm2`

**"Deployment succeeds but site not updated"**
→ Check: `pm2 logs sanhoti-backend` on EC2

---

## 📚 Full Documentation

See `GITHUB_ACTIONS_SETUP.md` for detailed instructions.

---

**That's it! Now `git push` = automatic deployment! 🚀**

