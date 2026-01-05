# Fix Your Instance Configuration

Based on your screenshot, here's what needs to be changed:

## Issues Found

1. ❌ **Instance Type**: You selected `t3.micro` (shows $0.0104/hour pricing)
2. ❌ **Storage**: Shows 8 GiB (should be 30 GiB for free tier)

## ✅ Fix Step-by-Step

### Step 1: Change Instance Type to t2.micro

1. In the **Instance type** section
2. Click on the instance type dropdown/field (currently shows `t3.micro`)
3. Search for or select: **`t2.micro`**
4. Look for one that shows:
   - **"Free tier eligible"** badge
   - Or shows $0.00 pricing
5. Select **`t2.micro`**

**Note**: `t3.micro` is NOT free tier eligible. Only `t2.micro` is free tier eligible.

### Step 2: Increase Storage to 30 GiB

1. Scroll down to **"Configure storage"** section
2. Click to expand or edit the storage configuration
3. Change the **Size (GiB)** from `8` to `30`
4. This is within free tier (up to 30GB EBS storage)

### Step 3: Verify Before Launching

Before clicking "Launch instance", verify:

✅ **Instance type**: `t2.micro` (not t3.micro)
✅ **Storage**: 30 GiB (not 8 GiB)
✅ **AMI**: Ubuntu Server 22.04 LTS (you have this correct ✅)
✅ **Region**: US East (N. Virginia) (you have this correct ✅)

---

## What You Should See

After making changes:

**Instance Type Section:**
```
Instance type: t2.micro
Free tier eligible: Yes ✓
vCPUs: 1
Memory: 1 GiB
Price: $0.00 per hour (or Free tier eligible badge)
```

**Storage Section:**
```
Storage (volumes): 1 volume(s) - 30 GiB
Type: gp3 (or gp2)
Free tier eligible: Yes ✓
```

---

## Why t2.micro vs t3.micro?

- ❌ **t3.micro**: Newer generation, but **NOT free tier eligible** - costs ~$0.0104/hour
- ✅ **t2.micro**: Older generation, but **FREE tier eligible** for first 12 months

For your application, `t2.micro` is perfectly fine!

---

## After Making Changes

1. ✅ Verify instance type shows `t2.micro`
2. ✅ Verify storage shows `30 GiB`
3. ✅ Continue with key pair configuration
4. ✅ Then click "Launch instance"

---

**The main issue: Change from `t3.micro` to `t2.micro`!**


