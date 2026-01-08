# Fix iPhone Pairing Issue - Xcode

## Problem
"Debasis's iPhone is not available because pairing is in progress."

## Solution Steps

### Step 1: Trust Your Mac on iPhone

1. **On your iPhone:**
   - Unlock your iPhone
   - A popup should appear: "Trust This Computer?"
   - Tap **"Trust"**
   - Enter your iPhone passcode if prompted

2. **If popup doesn't appear:**
   - Disconnect and reconnect USB cable
   - Unlock iPhone
   - Try again

### Step 2: Trust Developer Certificate (After First Run)

When you first run the app on iPhone:

1. **On iPhone:**
   - Go to **Settings** → **General** → **VPN & Device Management**
   - You'll see your Apple ID or developer certificate
   - Tap on it
   - Tap **"Trust [Your Name]"**
   - Confirm by tapping **"Trust"**

### Step 3: Wait for Pairing to Complete

- The pairing process can take 30-60 seconds
- Keep iPhone unlocked
- Keep USB connected
- Wait for Xcode to finish pairing

### Step 4: Check Xcode

1. **In Xcode:**
   - Look at the device dropdown at the top
   - Wait for "Debasis's iPhone" to appear
   - It should show "Ready" or "Connected"
   - If it shows "Pairing...", wait a bit longer

### Step 5: If Still Not Working

**Option A: Restart Pairing**
1. Disconnect iPhone
2. Close Xcode
3. Reconnect iPhone
4. Open Xcode again
5. Wait for device to appear

**Option B: Reset Trust**
1. On iPhone: Settings → General → Reset → Reset Location & Privacy
2. Reconnect iPhone
3. Trust computer again

**Option C: Use iOS Simulator Instead**
- In Xcode, select a simulator (e.g., "iPhone 15 Pro")
- No pairing needed
- Works immediately

## Quick Fix Commands

If you want to check device status:

```bash
# List connected devices
xcrun xctrace list devices

# Or in Xcode: Window → Devices and Simulators
```

## Alternative: Test on Simulator First

While waiting for iPhone pairing:

1. **In Xcode:**
   - Click device dropdown at top
   - Select **"iPhone 15 Pro"** (or any simulator)
   - Click **Run** (▶️)
   - App runs in simulator immediately

**Advantage:** No pairing needed, instant testing!

## After Pairing Succeeds

Once iPhone shows as "Ready" in Xcode:

1. Select "Debasis's iPhone" from device dropdown
2. Click **Run** (▶️)
3. App builds and installs on iPhone
4. App launches automatically

## Troubleshooting

### "Device is busy"
- Unlock iPhone
- Close any apps that might be using the device
- Try again

### "Could not find Developer Disk Image"
- Update Xcode to latest version
- Or use iOS Simulator instead

### Pairing takes too long
- Use iOS Simulator for immediate testing
- Fix iPhone pairing later

## Recommended: Test Simulator First

**Easiest approach:**
1. Use iOS Simulator now (works immediately)
2. Fix iPhone pairing later (not urgent)
3. Test on iPhone when convenient

**To use simulator:**
- In Xcode device dropdown, select any iPhone simulator
- Click Run (▶️)
- App runs instantly!

