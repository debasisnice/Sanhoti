# Fix iOS Build Errors - Common Solutions

## Common Build Errors and Fixes

### 1. Signing Issues (Most Common)

**Error:** "No signing certificate found" or "Code signing is required"

**Fix:**
1. In Xcode, select the **App** project in left sidebar
2. Select **App** target
3. Go to **Signing & Capabilities** tab
4. Check **"Automatically manage signing"**
5. Select your **Team** (your Apple ID)
6. Xcode will create a development certificate automatically

**Note:** You can use your free Apple ID for development (no $99 needed)

### 2. Deployment Target Mismatch

**Error:** "iOS deployment target" errors

**Fix:**
1. In Xcode, select **App** project
2. Select **App** target
3. Go to **General** tab
4. Set **iOS Deployment Target** to **13.0** (matches Podfile)
5. Also check **Project** settings (not just target)

### 3. Missing Dependencies

**Error:** "No such module" or "Cannot find"

**Fix:**
```bash
cd SANHOTI-APP/ios/App
pod install
cd ../..
npx cap sync ios
```

Then in Xcode:
- **Product** → **Clean Build Folder** (Shift+Cmd+K)
- Close and reopen Xcode
- Try building again

### 4. Swift Version Issues

**Error:** Swift version mismatch

**Fix:**
1. In Xcode: **File** → **Project Settings**
2. Set **Swift Language Version** to latest (5.x)
3. Clean build folder: **Product** → **Clean Build Folder**

### 5. Build Settings Issues

**Error:** Various build setting errors

**Fix:**
1. In Xcode, select **App** project
2. Select **App** target
3. Go to **Build Settings** tab
4. Search for the error keyword
5. Set correct values or use project defaults

## Quick Fix Checklist

### Step 1: Clean Build
In Xcode:
- **Product** → **Clean Build Folder** (Shift+Cmd+K)
- Wait for it to complete

### Step 2: Check Signing
1. Select **App** project → **App** target
2. **Signing & Capabilities** tab
3. Enable **"Automatically manage signing"**
4. Select your **Team** (Apple ID)

### Step 3: Reinstall Pods
```bash
cd SANHOTI-APP/ios/App
rm -rf Pods Podfile.lock
pod install
cd ../..
npx cap sync ios
```

### Step 4: Reopen Xcode
- Close Xcode completely
- Reopen the workspace: `SANHOTI-APP/ios/App/App.xcworkspace`
- Wait for indexing to complete
- Try building again

## Most Likely Issue: Signing

**90% of build failures are signing issues!**

**Quick Fix:**
1. In Xcode: **App** project → **App** target
2. **Signing & Capabilities** tab
3. Check **"Automatically manage signing"**
4. Select your **Team** (your Apple ID - free!)
5. Xcode will handle the rest

## Alternative: Build from Command Line

To see detailed error messages:

```bash
cd SANHOTI-APP/ios/App
xcodebuild -workspace App.xcworkspace -scheme App -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

This will show the exact error message.

## If Still Failing

**Share the exact error message from Xcode:**
1. In Xcode, click on the error in the issue navigator
2. Copy the full error message
3. Share it and I'll help fix it

## Test Web Version First

While fixing iOS build:
```bash
cd SANHOTI-APP
npm run dev
```
Visit: `http://localhost:3001`

This works immediately and tests all functionality!

