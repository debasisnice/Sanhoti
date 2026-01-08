# Accept Xcode License - Required Step

## Quick Fix

Xcode is installed but the license hasn't been accepted. You need to accept it:

### Option 1: Interactive (Recommended)
```bash
sudo xcodebuild -license
```

This will:
1. Show the license agreement
2. You can scroll through it
3. Type `agree` at the end
4. Press Enter

### Option 2: Auto-Accept (If you're comfortable)
```bash
sudo xcodebuild -license accept
```

This automatically accepts without showing the full license.

## After Accepting License

1. **Install CocoaPods:**
   ```bash
   sudo gem install cocoapods
   ```

2. **Install iOS Pods:**
   ```bash
   cd SANHOTI-APP/ios/App
   pod install
   cd ../..
   ```

3. **Sync iOS:**
   ```bash
   cd SANHOTI-APP
   npx cap sync ios
   ```

4. **Open in Xcode:**
   ```bash
   npx cap open ios
   ```

## Testing iOS App (FREE)

After setup:
1. In Xcode, select a simulator (e.g., "iPhone 15 Pro")
2. Click Run (▶️)
3. App opens in simulator - **FREE!**

Or test on your iPhone:
1. Connect iPhone via USB
2. Select your iPhone in Xcode
3. Click Run (▶️)
4. Trust developer certificate on iPhone - **FREE!**

**All testing is FREE - no $99 fee needed for development/testing!**

