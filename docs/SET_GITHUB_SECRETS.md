# 🔐 Quick Guide: Set GitHub Secrets

## Your EC2 Details (for reference):
- **EC2_HOST**: `44.220.179.207`
- **EC2_USER**: `ubuntu`

## Steps to Set GitHub Secrets:

1. **Go to your GitHub repository:**
   ```
   https://github.com/debasisnice/Sanhoti/settings/secrets/actions
   ```

2. **Click "New repository secret"** and add these three secrets:

### Secret 1: `EC2_SSH_PRIVATE_KEY`

**Name:** `EC2_SSH_PRIVATE_KEY`

**Value:** The contents of your private SSH key file

```bash
# On your local machine, run this and copy the ENTIRE output:
cat ~/.ssh/deploy_key_ec2
```

**Important:** Copy everything including:
- `-----BEGIN OPENSSH PRIVATE KEY-----`
- All the lines in between
- `-----END OPENSSH PRIVATE KEY-----`

### Secret 2: `EC2_HOST`

**Name:** `EC2_HOST`

**Value:** 
```
44.220.179.207
```
(No quotes, no spaces, just the IP address)

### Secret 3: `EC2_USER`

**Name:** `EC2_USER`

**Value:**
```
ubuntu
```
(No quotes, no spaces, just the username)

---

## ✅ Verify Secrets Are Set:

1. Go back to: `https://github.com/debasisnice/Sanhoti/settings/secrets/actions`
2. You should see all three secrets listed:
   - ✅ `EC2_SSH_PRIVATE_KEY`
   - ✅ `EC2_HOST`
   - ✅ `EC2_USER`

---

## 🚨 Common Mistakes:

- ❌ Adding quotes around the values (don't add quotes)
- ❌ Adding extra spaces before/after values
- ❌ Using the public key instead of private key
- ❌ Not copying the entire private key (including BEGIN/END lines)

---

## 📝 Quick Copy-Paste Values:

**EC2_HOST:** `44.220.179.207`
**EC2_USER:** `ubuntu`

**EC2_SSH_PRIVATE_KEY:** (Get this from your local machine: `cat ~/.ssh/deploy_key_ec2`)

---

After setting these secrets, try pushing again or trigger the workflow manually!


