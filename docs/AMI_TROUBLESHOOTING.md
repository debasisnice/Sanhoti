# Finding the Right Ubuntu AMI in AWS

If Ubuntu Server 22.04 LTS (Free tier eligible) is not showing up, follow these steps:

## ⚠️ IMPORTANT: Avoid Paid AMIs

**DO NOT select:**
- ❌ "Ubuntu Server 22.04 LTS (HVM) with SQL Server 2022 Standard" - **This is PAID!**
- ❌ Any AMI that mentions "SQL Server", "RDS", "Enterprise", or shows pricing
- ❌ AMIs from AWS Marketplace (unless specifically free)

**DO select:**
- ✅ "Ubuntu Server 22.04 LTS" (plain, no SQL Server)
- ✅ Shows "Free tier eligible" badge
- ✅ Owner: Canonical (099720109477)

## Option 1: Browse More AMIs

1. In the **Launch Instance** page
2. Under **Application and OS Images (Amazon Machine Image)**
3. Click **"Browse more AMIs"** button
4. In the search/filter area:
   - Search for: `ubuntu`
   - On the left sidebar, check **"Free tier only"** filter
   - **Important**: Uncheck "AWS Marketplace" if it's checked (those often have charges)
   - Look for AMIs that say just **"Ubuntu Server 22.04 LTS"** (NOT with SQL Server)
   - You should see Ubuntu options with "Free tier eligible" badge
   - **Owner should be**: Canonical (or shows "Canonical" as provider)

## Option 2: Search by Ubuntu Version

1. In **Browse more AMIs**, type in search:
   - `ubuntu server 22.04`
   - `ubuntu 22.04`
   - `ubuntu 24.04` (newer, also free tier eligible)

2. Look for these options:
   - **Ubuntu Server 22.04 LTS** (recommended)
   - **Ubuntu Server 24.04 LTS** (also works)
   - Make sure it shows **"Free tier eligible"** badge

## Option 3: Use Quick Start AMIs

1. In the main **Launch Instance** page
2. Under **Quick Start** tab (should be default)
3. Look for **Canonical** provider
4. You should see:
   - Ubuntu Server 22.04 LTS
   - Ubuntu Server 24.04 LTS
   - Both are free tier eligible

## Option 4: Manual AMI Search

1. Go to **EC2 Dashboard** → **AMIs** (left sidebar)
2. Click **"Public images"**
3. Search filters:
   - **Owner**: Select `099720109477` (Canonical's AWS account ID)
   - **Name**: Enter `ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*` (for 22.04)
   - Or: `ubuntu/images/hvm-ssd/ubuntu-noble-24.04-amd64-server-*` (for 24.04)
4. Make sure **"Free tier only"** filter is checked
5. Select the latest AMI

## Option 5: Region Check

**Important**: AMI availability varies by region!

1. Check your current region (top right corner of AWS Console)
2. Try switching to a common region:
   - **US East (N. Virginia)**: `us-east-1` (most AMIs available)
   - **US West (Oregon)**: `us-west-2`
   - **EU (Ireland)**: `eu-west-1`

3. To change region:
   - Click region dropdown (top right)
   - Select a different region
   - Go back to Launch Instance

## Option 6: Use AWS Marketplace (Alternative)

1. In **Browse more AMIs**, click **"AWS Marketplace"** tab
2. Search for: `ubuntu server`
3. Look for Canonical's official Ubuntu images
4. Most are free (AMI itself is free, you only pay for EC2 instance)

## Recommended AMI Names

Look for these exact names (they may vary slightly):

✅ **Ubuntu Server 22.04 LTS**
- Full name: `ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*`
- Architecture: 64-bit (x86)
- Virtualization: HVM

✅ **Ubuntu Server 24.04 LTS**
- Full name: `ubuntu/images/hvm-ssd/ubuntu-noble-24.04-amd64-server-*`
- Architecture: 64-bit (x86)
- Virtualization: HVM

## Verify Free Tier Eligibility

Before selecting, check:
- ✅ Shows **"Free tier eligible"** badge
- ✅ Owner: `099720109477` (Canonical)
- ✅ Architecture: `64-bit (x86)`
- ✅ Root device type: `ebs`

## If Still Not Available

### Use Ubuntu 24.04 LTS Instead
- **Ubuntu 24.04 LTS** is also free tier eligible
- Same deployment process
- Works identically for our purposes
- May actually be more readily available

### Use Amazon Linux 2023 (Alternative)
If Ubuntu absolutely not available:
- **Amazon Linux 2023** is also free tier eligible
- Commands will be slightly different (uses `yum` instead of `apt`)
- We can provide Amazon Linux specific instructions if needed

## Quick Fix: Try This First

1. **Clear filters**: Make sure no filters are applied
2. **Search box**: Type exactly: `ubuntu 22.04`
3. **Sort by**: "Relevance" or "Newest"
4. **Look for**: Canonical as the owner/provider
5. **Check badge**: Must say "Free tier eligible"

## Still Having Issues?

If you still can't find it:
1. **Check your region** - Some regions have limited AMIs
2. **Try a different region** - US East (N. Virginia) has the most options
3. **Contact AWS Support** - They can help locate the right AMI for your region
4. **Use Ubuntu 24.04** - It's identical for deployment purposes

---

**Note**: The deployment guide works with both Ubuntu 22.04 and 24.04. Either one will work perfectly!

