# Mobile App Setup Guide

Step-by-step guide to set up and build the Sanhoti mobile app for iOS and Android.

## Quick Start

```bash
# 1. Install dependencies
cd SANHOTI-APP
npm install

# 2. Build the web app
npm run build

# 3. Add native platforms
npx cap add ios      # macOS only
npx cap add android

# 4. Sync to native
npx cap sync

# 5. Open in native IDE
npm run cap:open:ios      # Opens Xcode (macOS)
npm run cap:open:android  # Opens Android Studio
```

## Detailed Setup

### Step 1: Install Dependencies

```bash
cd SANHOTI-APP
npm install
```

This installs:
- React and dependencies
- Capacitor and plugins
- Build tools (Vite, TypeScript, Tailwind)

### Step 2: Build Web App

```bash
npm run build
```

This creates optimized files in the `dist/` folder.

### Step 3: Set Up iOS (macOS Only)

**Requirements:**
- macOS with Xcode 14+
- CocoaPods: `sudo gem install cocoapods`

**Steps:**
```bash
# Add iOS platform
npx cap add ios

# Sync web app to iOS
npx cap sync

# Open in Xcode
npx cap open ios
```

**In Xcode:**
1. Select your development team in Signing & Capabilities
2. Select a simulator or connected device
3. Click Run (▶️) to build and test

### Step 4: Set Up Android

**Requirements:**
- Android Studio with Android SDK
- Java JDK 11+
- Android 5.0+ (API level 21+)

**Steps:**
```bash
# Add Android platform
npx cap add android

# Sync web app to Android
npx cap sync

# Open in Android Studio
npx cap open android
```

**In Android Studio:**
1. Let Gradle sync complete
2. Select an emulator or connected device
3. Click Run (▶️) to build and test

## App Configuration

### Update App Name and ID

Edit `capacitor.config.ts`:

```typescript
const config: CapacitorConfig = {
  appId: 'org.sanhoti.app',        // Change this to your app ID
  appName: 'Sanhoti',              // Change this to your app name
  webDir: 'dist',
  // ...
};
```

### Set API Endpoint

The app uses production API by default: `https://www.sanhoti.org/api`

To change it, create `.env` file:
```env
VITE_API_URL=https://your-api-url.com/api
```

### Configure App Icons

**iOS:**
1. Open `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
2. Replace icon files (various sizes required)
3. Or use Xcode's Asset Catalog

**Android:**
1. Place icons in `android/app/src/main/res/`
2. Create folders: `mipmap-mdpi`, `mipmap-hdpi`, `mipmap-xhdpi`, etc.
3. Add `ic_launcher.png` files in each folder

Recommended sizes:
- iOS: 1024x1024 (single file, Xcode generates others)
- Android: 192x192 (mdpi), 512x512 (xxxhdpi)

### Configure Splash Screen

**iOS:**
Edit `capacitor.config.ts`:
```typescript
SplashScreen: {
  launchShowDuration: 2000,
  backgroundColor: '#ffffff',
  androidSplashResourceName: 'splash',
  // ...
}
```

Then add splash screen images in Xcode or Android Studio.

## Building for Release

### iOS Release Build

1. **Update version in Xcode:**
   - Select project → General tab
   - Update Version and Build number

2. **Configure signing:**
   - Select your development team
   - Select distribution provisioning profile

3. **Archive:**
   - Product → Archive
   - Wait for archive to complete
   - Click "Distribute App"

4. **Upload to App Store:**
   - Choose "App Store Connect"
   - Follow prompts to upload
   - Submit for review in App Store Connect

### Android Release Build

1. **Generate keystore:**
   ```bash
   keytool -genkey -v -keystore sanhoti-release.keystore -alias sanhoti -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Configure signing in `android/app/build.gradle`:**
   ```gradle
   android {
       signingConfigs {
           release {
               storeFile file('sanhoti-release.keystore')
               storePassword 'your-password'
               keyAlias 'sanhoti'
               keyPassword 'your-password'
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
           }
       }
   }
   ```

3. **Update version in `android/app/build.gradle`:**
   ```gradle
   android {
       defaultConfig {
           versionCode 1
           versionName "1.0.0"
       }
   }
   ```

4. **Build release APK or AAB:**
   - In Android Studio: Build → Generate Signed Bundle / APK
   - Choose Android App Bundle (.aab) for Play Store
   - Choose APK for direct distribution

5. **Upload to Play Console:**
   - Go to Google Play Console
   - Create new app or select existing
   - Upload the .aab file
   - Complete store listing and submit for review

## Testing

### Web Testing
```bash
npm run dev
```
Test in browser at `http://localhost:3001`

### iOS Testing
```bash
npm run build
npx cap sync ios
npx cap open ios
```
Then run in Xcode simulator or device.

### Android Testing
```bash
npm run build
npx cap sync android
npx cap open android
```
Then run in Android emulator or device.

## Troubleshooting

### Common Issues

**1. iOS build fails:**
- Ensure CocoaPods are installed: `sudo gem install cocoapods`
- Run `cd ios && pod install`
- Clean build in Xcode: Product → Clean Build Folder

**2. Android build fails:**
- Ensure Android SDK is installed
- Update Gradle: `cd android && ./gradlew wrapper --gradle-version 8.0`
- Clean project: `cd android && ./gradlew clean`

**3. API connection fails:**
- Check network permissions in `capacitor.config.ts`
- Verify API URL is accessible
- Check CORS settings on backend

**4. Icons not showing:**
- Ensure icon files are in correct folders
- Rebuild after adding icons
- Clear app cache and reinstall

### Getting Help

- Check Capacitor docs: https://capacitorjs.com/docs
- Check React docs: https://react.dev
- Check console logs in native IDEs

## Next Steps

1. ✅ Complete initial setup
2. ✅ Test on simulator/emulator
3. ✅ Test on physical devices
4. ✅ Configure app icons and splash screens
5. ✅ Set up app store accounts
6. ✅ Build release versions
7. ✅ Submit to app stores

## Publishing Checklist

### Before Publishing

- [ ] Test all features on iOS and Android
- [ ] Update app version numbers
- [ ] Configure app icons and splash screens
- [ ] Set up app store accounts
- [ ] Prepare app store screenshots
- [ ] Write app store description
- [ ] Test on multiple devices
- [ ] Check API endpoints are production-ready
- [ ] Review privacy policy requirements
- [ ] Test offline functionality

### App Store Submission

- [ ] iOS: Archive and upload to App Store Connect
- [ ] iOS: Complete app information in App Store Connect
- [ ] iOS: Submit for review
- [ ] Android: Generate signed bundle (.aab)
- [ ] Android: Upload to Google Play Console
- [ ] Android: Complete store listing
- [ ] Android: Submit for review

Good luck with your app launch! 🚀

