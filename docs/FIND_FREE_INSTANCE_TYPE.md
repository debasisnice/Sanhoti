# Finding Free Tier Instance Type (t2.micro)

If you can't find a free instance type, follow these steps:

## ⚠️ Important: Region Matters!

**Free tier instance types are NOT available in all regions!**

### Free Tier Available Regions:
- ✅ **US East (N. Virginia)** - `us-east-1` - **BEST OPTION**
- ✅ **US West (Oregon)** - `us-west-2`
- ✅ **EU (Ireland)** - `eu-west-1`
- ✅ **Asia Pacific (Singapore)** - `ap-southeast-1`
- ✅ **Asia Pacific (Tokyo)** - `ap-northeast-1`

### Check Your Current Region:
1. Look at **top right corner** of AWS Console
2. See what region you're in
3. If it's NOT one of the above, **switch regions**

---

## Solution 1: Switch to US East (N. Virginia)

**This is the most reliable region for free tier:**

1. **Top right corner** → Click the region dropdown
2. Select: **US East (N. Virginia)** - `us-east-1`
3. Go back to **EC2** → **Launch Instance**
4. Now you should see **t2.micro** as free tier eligible

---

## Solution 2: Find t2.micro Manually

### Step 1: Instance Type Selection
1. In **Launch Instance** page
2. Under **"Instance type"**, click the dropdown
3. **Left sidebar filters** (if available):
   - Look for **"Free tier only"** filter - check it
   - If not available, scroll through the list manually

### Step 2: Look for t2.micro
1. In the instance type list, look for:
   - **t2.micro** - Should show "Free tier eligible"
   - If not visible, scroll down or search for "t2"

### Step 3: If t2.micro Not Available
Try these alternatives:
- **t3.micro** - May be free tier eligible in some regions
- **t2.small** - NOT free (but might show up)
- **t2.nano** - Usually not available

---

## Solution 3: Check Free Tier Status

### Verify Your Account is Free Tier Eligible:

1. Go to **AWS Billing Dashboard**
2. Check **"Free Tier"** section
3. Verify you're still within 12 months of account creation
4. Check if you've exceeded free tier limits

### New Account Free Tier:
- ✅ **First 12 months** - Free tier available
- ❌ **After 12 months** - Free tier expires

---

## Solution 4: Use Different Region (Recommended)

**Most Reliable Method:**

1. **Switch Region:**
   - Top right → Click region name
   - Select: **US East (N. Virginia)** - `us-east-1`

2. **Start Over:**
   - Go to **EC2 Dashboard**
   - Click **"Launch Instance"**
   - Select your Ubuntu AMI
   - Now check Instance type - **t2.micro** should appear as "Free tier eligible"

---

## What You Should See

### ✅ Correct (Free Tier Eligible):
```
Instance type: t2.micro
vCPUs: 1
Memory: 1 GiB
Network performance: Low to Moderate
Free tier eligible: Yes ✓
```

### ❌ If You See This (Paid):
```
Instance type: t3.micro
Price: $0.0104 per hour (or similar)
Free tier eligible: No ❌
```

---

## Step-by-Step: Switch Region

1. **Top right corner** of AWS Console
2. Click **current region** (e.g., "Asia Pacific (Mumbai)")
3. Select: **US East (N. Virginia)** - `us-east-1`
4. Wait for page to reload
5. Navigate to **EC2** → **Instances**
6. Click **"Launch Instance"**
7. Select Ubuntu AMI you found
8. Check **Instance type** - should now show **t2.micro** with "Free tier eligible"

---

## Alternative: Use t3.micro (If Available)

If t2.micro is not available but t3.micro shows as "Free tier eligible":
- ✅ **t3.micro** is also free tier eligible in some regions
- Same 1 vCPU, 1 GiB RAM
- Works identically for your application

---

## Troubleshooting Checklist

- [ ] Check your region (top right corner)
- [ ] Switch to **US East (N. Virginia)** if not already there
- [ ] Verify account is within first 12 months
- [ ] Check if "Free tier only" filter is available
- [ ] Scroll through instance type list (t2.micro might not be at top)
- [ ] Search for "t2" in instance type search box

---

## Quick Fix Summary

**Most Common Issue: Wrong Region**

**Fix:**
1. Switch to **US East (N. Virginia)** - `us-east-1`
2. t2.micro should now appear as free tier eligible

---

## Still Not Working?

If after switching to US East (N. Virginia) you still don't see free tier:

1. **Check account age:**
   - Go to AWS Billing Dashboard
   - Check if free tier is still active

2. **Try selecting instance anyway:**
   - Select **t2.micro** (even if not showing "free tier eligible" badge)
   - Complete the launch
   - Check billing dashboard - it should still be free if within 12 months

3. **Contact AWS Support:**
   - They can verify your free tier eligibility
   - They can help locate the right region/instance type

---

**The region is almost always the issue! Switch to US East (N. Virginia) first!**


