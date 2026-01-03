# Finding Free Ubuntu AMI When "Free Tier" Filter is Missing

If you don't see "Free tier only" filter in the left sidebar, follow these steps:

## Method 1: Use Quick Start (Recommended)

This is the easiest way - Quick Start shows only free tier eligible AMIs!

1. In **Launch Instance** page
2. Under **"Application and OS Images"**
3. Make sure you're on the **"Quick Start"** tab (default, at the top)
4. Look for **"Ubuntu"** or **"Canonical"** as the provider
5. You should see:
   - **Ubuntu Server 22.04 LTS**
   - **Ubuntu Server 24.04 LTS**
6. These are **automatically free tier eligible** when in Quick Start
7. Select **Ubuntu Server 22.04 LTS** (plain version, no SQL Server)

## Method 2: Manual Search (When "Free tier" filter is missing)

### Step 1: Filter by Owner
1. In **Browse more AMIs**
2. Left sidebar, look for **"Owners"** section (might be collapsed)
3. Click to expand if needed
4. Select: **"Canonical"** or type owner ID: `099720109477`
5. This ensures you only see Canonical's official Ubuntu images (which are free)

### Step 2: Filter by OS and Architecture
1. Left sidebar:
   - ✅ Select: **"All Linux/Unix"** under OS category
   - ✅ Select: **"64-bit (x86)"** under Architecture
2. This narrows down to Linux 64-bit images

### Step 3: Search
1. In the search box, type exactly: `ubuntu server 22.04`
2. Or try: `ubuntu jammy 22.04`
3. Look at the results

### Step 4: Verify It's Free
Check each AMI for these indicators:

✅ **FREE (Select This):**
- Owner shows: **"Canonical"** or **"099720109477"**
- Name starts with: `ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server`
- Does NOT say: "SQL Server", "Marketplace", or show pricing
- Root device type: `ebs`
- Architecture: `x86_64`

❌ **NOT FREE (Avoid):**
- Owner shows: "AWS Marketplace" or different owner
- Shows pricing information (e.g., "$X.XX per hour")
- Mentions: "SQL Server", "Enterprise", "RDS", etc.

## Method 3: Use Canonical Owner ID Directly

1. In **Browse more AMIs**
2. Look for a search/filter field that says "Owner" or "Owner ID"
3. Type: `099720109477` (Canonical's AWS account ID)
4. This filters to show ONLY Canonical's official Ubuntu images
5. All of these should be free tier eligible
6. Then search: `ubuntu 22.04`

## Method 4: Go Back to Quick Start Tab

**Easiest Solution:**

1. Don't use "Browse more AMIs"
2. Stay on the main **"Launch Instance"** page
3. Under **"Application and OS Images"**, click the **"Quick Start"** tab (if not already selected)
4. Scroll through the list
5. Find **"Ubuntu"** under the provider column
6. Click on **"Ubuntu Server 22.04 LTS"**
7. It should automatically be free tier eligible

## Visual Guide: What You Should See

### In Quick Start Tab:
```
Provider: Canonical
Image: Ubuntu Server 22.04 LTS
Architecture: 64-bit (x86)
```

### In Browse More AMIs (after filtering):
```
Name: ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-20240125
Owner: 099720109477 (Canonical)
Architecture: x86_64
Root device type: ebs
```

## Quick Checklist

Before selecting, verify:
- [ ] Owner is **Canonical** (099720109477)
- [ ] Name contains `ubuntu-jammy-22.04` or `ubuntu-noble-24.04`
- [ ] Architecture is **64-bit (x86)** or **x86_64**
- [ ] Does NOT mention "SQL Server"
- [ ] Does NOT show pricing/per-hour costs
- [ ] Root device type is **ebs**

## If You Still Can't Find It

1. **Check your region**: 
   - Top right corner - what region are you in?
   - Try switching to: **US East (N. Virginia)** - `us-east-1`
   - This region has the most AMI options

2. **Use Ubuntu 24.04**:
   - Search for: `ubuntu server 24.04`
   - Look for: `ubuntu/images/hvm-ssd/ubuntu-noble-24.04-amd64-server`
   - Owner: Canonical (099720109477)
   - Works exactly the same for deployment

## What to Do Right Now

**Try this step-by-step:**

1. Click **"Browse more AMIs"**
2. In left sidebar, look for **"Owners"** section (scroll down if needed)
3. Type or select: `099720109477` (Canonical)
4. In search box: Type `ubuntu 22.04`
5. Select: One that shows `ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*`
6. Verify Owner column shows "Canonical" or "099720109477"
7. **Make sure it does NOT say "with SQL Server"**

OR

1. Go back to main Launch Instance page
2. Use **Quick Start** tab
3. Select **Ubuntu Server 22.04 LTS** from Canonical

---

**The Quick Start method is usually the easiest and safest way to find free tier eligible Ubuntu AMIs!**

