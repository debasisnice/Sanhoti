# How to Find the FREE Ubuntu AMI (Avoiding SQL Server AMIs)

## ⚠️ You're Seeing the WRONG AMI!

**"Ubuntu Server 22.04 LTS (HVM) with SQL Server 2022 Standard"** is **NOT FREE** ❌

This AMI includes SQL Server which has licensing costs. You don't need SQL Server for your Node.js application!

---

## ✅ What You Need Instead

Look for: **"Ubuntu Server 22.04 LTS"** (plain, no SQL Server mention)

---

## Step-by-Step: Finding the FREE Ubuntu AMI

### Method 1: Use Quick Start (Easiest)

1. In **Launch Instance** page
2. Under **"Application and OS Images"**, click the **Quick Start** tab
3. Look for **Canonical** as the provider
4. Find: **"Ubuntu"** → **"Ubuntu Server 22.04 LTS"**
5. **Make sure it does NOT say**: "with SQL Server" or any database
6. Should show: **"Free tier eligible"** badge

### Method 2: Browse More AMIs (Recommended)

1. Click **"Browse more AMIs"**
2. In the search box: Type `ubuntu server 22.04`
3. **Important Filters** (left sidebar):
   - ✅ Check **"Free tier only"**
   - ❌ **Uncheck "AWS Marketplace"** (those often have charges)
   - ✅ Check **"Canonical"** under Owner/Provider
4. Look at the results:
   - ✅ **GOOD**: "Ubuntu Server 22.04 LTS" - Owner: Canonical - Free tier eligible
   - ❌ **BAD**: "Ubuntu Server 22.04 LTS with SQL Server" - Has pricing
   - ❌ **BAD**: Shows "$X.XX per hour" or pricing information
5. Select the plain "Ubuntu Server 22.04 LTS" (no SQL Server mentioned)

### Method 3: Search by Canonical Owner ID

1. In **Browse more AMIs**
2. Left sidebar → **Owners** section
3. Select: **"Canonical"** (Owner ID: 099720109477)
4. Search: `ubuntu 22.04`
5. Look for: **"ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"**
6. Select the latest one (highest number at the end)

---

## Visual Guide: What to Look For

### ✅ CORRECT - Select This:
```
Ubuntu Server 22.04 LTS
Owner: Canonical
Free tier eligible ✓
Architecture: 64-bit (x86)
Root device type: ebs
```

### ❌ WRONG - Don't Select This:
```
Ubuntu Server 22.04 LTS (HVM) with SQL Server 2022 Standard
Owner: AWS Marketplace
Pricing: $X.XX per hour ❌
```

---

## Alternative: Ubuntu 24.04 LTS

If you can't find 22.04, Ubuntu 24.04 works perfectly:

1. Search for: `ubuntu server 24.04`
2. Select: **"Ubuntu Server 24.04 LTS"** (plain, no SQL Server)
3. Same deployment process
4. Also free tier eligible

---

## Why Avoid SQL Server AMIs?

- ❌ **Additional licensing costs** (SQL Server is not free)
- ❌ **You don't need it** - Your app uses JSON files, not SQL Server
- ❌ **Larger AMI size** - Takes longer to launch
- ❌ **Unnecessary resources** - Wastes disk space and memory

---

## Quick Checklist

Before selecting an AMI, verify:

- [ ] Name says only **"Ubuntu Server 22.04 LTS"** (no SQL Server, no databases)
- [ ] Shows **"Free tier eligible"** badge
- [ ] Owner/Provider is **"Canonical"**
- [ ] Does NOT show pricing/per-hour costs
- [ ] Architecture is **64-bit (x86)**
- [ ] Root device type is **ebs**

---

## Still Having Issues?

1. **Try a different region**: Switch to **US East (N. Virginia)** - `us-east-1`
2. **Clear all filters**: Make sure no marketplace filters are active
3. **Search exactly**: Type `ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server`
4. **Check Owner ID**: Filter by owner `099720109477` (Canonical)

---

## What You'll See When Correct

When you find the right AMI, you should see:

```
Name: ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-20240125
Owner: 099720109477 (Canonical)
Free tier eligible: Yes ✓
```

**No SQL Server mentioned anywhere!**

