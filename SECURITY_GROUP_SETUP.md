# Security Group Configuration for Sanhoti

## What You're Seeing

You're seeing security group options during instance launch. For your first instance, you should **create a new security group**.

---

## Option 1: Create New Security Group (Recommended for First Instance)

### Step 1: Select "Create security group"

1. In the **"Network settings"** or **"Firewall (security group)"** section
2. Select: **"Create security group"** (usually a radio button)
3. This creates a new security group specifically for this instance

### Step 2: Configure Rules

Make sure these rules are enabled (should be pre-configured):

✅ **SSH (22)**
- Type: SSH
- Protocol: TCP
- Port: 22
- Source: **My IP** (recommended) or **0.0.0.0/0** (less secure, allows from anywhere)
- Description: "Allow SSH access"

✅ **HTTP (80)**
- Type: HTTP
- Protocol: TCP
- Port: 80
- Source: **0.0.0.0/0** (allows from internet)
- Description: "Allow HTTP traffic"
- **Make sure this is checked!**

✅ **HTTPS (443)**
- Type: HTTPS
- Protocol: TCP
- Port: 443
- Source: **0.0.0.0/0** (allows from internet)
- Description: "Allow HTTPS traffic"
- **Make sure this is checked!**

### Step 3: Name Your Security Group

- **Security group name**: `sanhoti-website-sg` (or any descriptive name)
- **Description**: "Security group for Sanhoti website"

---

## Option 2: Select Existing Security Group

If you see an existing security group option:
- ⚠️ Only use this if you already have a security group with the correct rules
- For your first instance, **create a new one** instead

---

## What You Should See

After configuration:

```
Security group name: sanhoti-website-sg
Description: Security group for Sanhoti website

Inbound rules:
✅ SSH (22) - My IP or 0.0.0.0/0
✅ HTTP (80) - 0.0.0.0/0
✅ HTTPS (443) - 0.0.0.0/0
```

---

## Important: Enable HTTP and HTTPS

**Critical for your website to work:**

- ✅ **HTTP (port 80)** - Must be enabled so users can access your website
- ✅ **HTTPS (port 443)** - Must be enabled for SSL/HTTPS later
- ✅ **SSH (port 22)** - For you to connect and manage the server

---

## Quick Checklist

- [ ] Selected "Create security group"
- [ ] HTTP (80) is enabled with source 0.0.0.0/0
- [ ] HTTPS (443) is enabled with source 0.0.0.0/0
- [ ] SSH (22) is enabled (My IP preferred, or 0.0.0.0/0)
- [ ] Named the security group (e.g., "sanhoti-website-sg")

---

## After Launch

You can modify security group rules later:
1. Go to **EC2 Dashboard** → **Security Groups**
2. Select your security group
3. Edit inbound/outbound rules as needed

---

## Security Note

- **SSH from "My IP"** is more secure (only you can SSH)
- **SSH from 0.0.0.0/0** allows anyone to try to SSH (less secure but more convenient)
- For HTTP/HTTPS, **0.0.0.0/0** is necessary (your website needs to be accessible to everyone)

**For now, using 0.0.0.0/0 for all is fine for getting started!**

