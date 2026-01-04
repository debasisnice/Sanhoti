# 🚀 Quick Fix for CI/CD Issues

## Most Common Problems & Fixes

### Problem 1: "EC2_USER or EC2_HOST is not set!"

**Solution:** Set GitHub Secrets

1. Go to: https://github.com/debasisnice/Sanhoti/settings/secrets/actions
2. Add/verify these secrets:

**Secret: `EC2_HOST`**
- Value: `44.220.179.207`
- No quotes, no spaces

**Secret: `EC2_USER`**
- Value: `ubuntu`
- No quotes, no spaces

---

### Problem 2: "Permission denied (publickey)"

**Solution:** Add public key to EC2

**Your public key:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ4fSUqRvYcIH+RojyAkf0zgwcDwbBJ2qL2I56S0VkML github-actions-deploy
```

**Steps:**
```bash
# 1. SSH into EC2
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207

# 2. Add the key (run this ONCE on EC2)
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ4fSUqRvYcIH+RojyAkf0zgwcDwbBJ2qL2I56S0VkML github-actions-deploy" >> ~/.ssh/authorized_keys

# 3. Fix permissions
chmod 600 ~/.ssh/authorized_keys

# 4. Exit
exit

# 5. Test (from your Mac)
ssh -i ~/.ssh/deploy_key_ec2 ubuntu@44.220.179.207
```

If test works, key is set up correctly!

---

### Problem 3: "sudo: a password is required"

**Solution:** Setup passwordless sudo

```bash
# SSH into EC2
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207

# Edit sudoers
sudo visudo

# Add this line at the END:
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx

# Save (Ctrl+X, Y, Enter)

# Test it
sudo systemctl reload nginx
# Should NOT ask for password!
```

---

### Problem 4: "Connection refused" or "Could not resolve hostname"

**Solutions:**
1. Verify EC2 instance is running (check AWS Console)
2. Check your IP: `44.220.179.207` (might have changed)
3. Verify security group allows SSH from anywhere (0.0.0.0/0) on port 22

---

### Problem 5: GitHub Secret `EC2_SSH_PRIVATE_KEY` missing

**Get your private key:**
```bash
cat ~/.ssh/deploy_key_ec2
```

Copy the ENTIRE output (including `-----BEGIN` and `-----END` lines) and add it to GitHub Secret `EC2_SSH_PRIVATE_KEY`.

---

## ✅ Complete Setup Checklist

- [ ] GitHub Secret `EC2_SSH_PRIVATE_KEY` is set (full private key)
- [ ] GitHub Secret `EC2_HOST` is set (`44.220.179.207`)
- [ ] GitHub Secret `EC2_USER` is set (`ubuntu`)
- [ ] Public key added to EC2 `~/.ssh/authorized_keys`
- [ ] Passwordless sudo configured for nginx reload
- [ ] EC2 instance is running
- [ ] Security group allows SSH (port 22)
- [ ] Test SSH works: `ssh -i ~/.ssh/deploy_key_ec2 ubuntu@44.220.179.207`

---

## 🧪 Test CI/CD Manually

1. Go to: https://github.com/debasisnice/Sanhoti/actions
2. Click "Run workflow" (manual trigger)
3. Watch the logs
4. Check for specific error messages

---

## 📞 What Error Are You Seeing?

Tell me the exact error message from GitHub Actions, and I can help you fix it!

Common locations:
- GitHub Actions → Latest run → Click on "Deploy to EC2" step


