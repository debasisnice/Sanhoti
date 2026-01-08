# Quick Start Guide - Sanhoti Mobile App

Get your mobile app running in minutes!

## Prerequisites Check

**For iOS (macOS only):**
- [ ] macOS with Xcode installed
- [ ] CocoaPods installed: `sudo gem install cocoapods`

**For Android:**
- [ ] Android Studio installed
- [ ] Android SDK configured
- [ ] Java JDK 11+ installed

## Installation (5 minutes)

```bash
# 1. Navigate to app folder
cd SANHOTI-APP

# 2. Install dependencies
npm install

# 3. Build the web app
npm run build

# 4. Add platforms (choose one or both)
npx cap add ios      # macOS only
npx cap add android

# 5. Sync to native
npx cap sync

# 6. Open in native IDE
npm run cap:open:ios      # macOS - opens Xcode
npm run cap:open:android  # Opens Android Studio
```

## Run the App

### Web Version (Test First)
```bash
npm run dev
```
Visit: `http://localhost:3001`

### iOS
1. In Xcode, select a simulator or device
2. Click Run (▶️)

### Android
1. In Android Studio, select an emulator or device
2. Click Run (▶️)

## Next Steps

1. **Test the app:** Make sure all features work
2. **Configure app:** Update `capacitor.config.ts` with your app name and ID
3. **Add app icons:** Replace default icons in iOS/Android folders
4. **Build for release:** See `SETUP_GUIDE.md` for detailed instructions
5. **Publish:** Submit to App Store and Play Store

## Troubleshooting

**Can't build?**
- Run `npm install` again
- Delete `node_modules` and reinstall
- Check Node.js version (needs 18+)

**iOS won't open?**
- Install CocoaPods: `sudo gem install cocoapods`
- Run `cd ios && pod install`

**Android won't open?**
- Open Android Studio first
- Let it sync Gradle files
- Then run `npx cap open android`

## Documentation

- Full setup: See `SETUP_GUIDE.md`
- Detailed info: See `README.md`
- Capacitor docs: https://capacitorjs.com/docs

## Getting Help

Check the console logs in:
- iOS: Safari → Develop → [Your Device] → [Your App]
- Android: Chrome → chrome://inspect → Devices

Happy coding! 🚀

