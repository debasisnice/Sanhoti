# Sanhoti Mobile App

Native mobile application for Sanhoti Bengali Association of Orange County, CA. Built with React, TypeScript, and Capacitor for iOS and Android platforms.

## Features

All features from the website are available in the mobile app:
- ✅ View upcoming and past events
- ✅ RSVP for events
- ✅ View community notices
- ✅ Browse photo galleries
- ✅ Read magazines and documents
- ✅ View committee members
- ✅ Contact form
- ✅ Donation with QR code
- ✅ User authentication and dashboard
- ✅ Admin panel (for admin users)

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** - Build tool
- **Capacitor 6** - Native mobile framework
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Zustand** - State management
- **Axios** - API calls

## Prerequisites

### For Development
- Node.js 18+ 
- npm or yarn

### For iOS Development (macOS only)
- macOS with Xcode 14+
- CocoaPods (`sudo gem install cocoapods`)
- iOS 13+ device or simulator

### For Android Development
- Android Studio with Android SDK
- Java Development Kit (JDK) 11+
- Android 5.0+ (API level 21+)

### For Publishing
- **Apple App Store**: Apple Developer Account ($99/year)
- **Google Play Store**: Google Play Developer Account ($25 one-time)

## Installation

1. **Install dependencies:**
   ```bash
   cd SANHOTI-APP
   npm install
   ```

2. **Set up Capacitor:**
   ```bash
   npx cap init
   ```
   
   Or manually configure in `capacitor.config.ts` (already set up).

3. **Add platforms:**
   ```bash
   # For iOS (macOS only)
   npx cap add ios
   
   # For Android
   npx cap add android
   ```

## Development

### Run Web Version (for testing)
```bash
npm run dev
```
Opens at `http://localhost:3001`

### Build for Production
```bash
npm run build
```
This creates the `dist` folder with optimized files.

### Sync to Native Platforms
After building, sync to native platforms:
```bash
npm run cap:sync
```

## Building Native Apps

### iOS

1. **Build the web app:**
   ```bash
   npm run build
   ```

2. **Sync to iOS:**
   ```bash
   npm run cap:sync
   npm run cap:open:ios
   ```

3. **In Xcode:**
   - Select a simulator or connected device
   - Click Run (▶️) to build and run
   - For App Store submission: Product → Archive

### Android

1. **Build the web app:**
   ```bash
   npm run build
   ```

2. **Sync to Android:**
   ```bash
   npm run cap:sync
   npm run cap:open:android
   ```

3. **In Android Studio:**
   - Select an emulator or connected device
   - Click Run (▶️) to build and run
   - For Play Store: Build → Generate Signed Bundle / APK

## Configuration

### API Endpoint
The app connects to the production API by default: `https://www.sanhoti.org/api`

To use a different API endpoint, create a `.env` file:
```env
VITE_API_URL=https://your-api-url.com/api
```

### App Configuration
Edit `capacitor.config.ts` to customize:
- App ID: `org.sanhoti.app`
- App Name: `Sanhoti`
- Status bar color
- Splash screen settings

### App Icons and Splash Screens

Icons should be placed in:
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- Android: `android/app/src/main/res/`

Splash screens:
- iOS: `ios/App/App/Assets.xcassets/Splash.imageset/`
- Android: `android/app/src/main/res/drawable/`

## Project Structure

```
SANHOTI-APP/
├── src/
│   ├── components/      # Reusable React components
│   ├── pages/          # Page components
│   ├── services/       # API services
│   ├── store/          # State management (Zustand)
│   ├── types/          # TypeScript types
│   ├── utils/          # Utility functions
│   ├── App.tsx         # Main app component
│   └── main.tsx        # Entry point with Capacitor init
├── public/             # Static assets
├── ios/                # iOS native project (generated)
├── android/            # Android native project (generated)
├── capacitor.config.ts # Capacitor configuration
├── vite.config.ts      # Vite build configuration
└── package.json        # Dependencies and scripts
```

## Publishing to App Stores

### Apple App Store

1. **Register Apple Developer Account** ($99/year)
2. **Create App ID** in Apple Developer Portal
3. **Update app configuration** in Xcode:
   - Bundle Identifier
   - Version number
   - Build number
   - App icons
   - Launch screen
4. **Archive the app:**
   - Product → Archive in Xcode
   - Upload to App Store Connect
5. **Submit for review** in App Store Connect

### Google Play Store

1. **Register Google Play Developer Account** ($25 one-time)
2. **Create app** in Google Play Console
3. **Update app configuration** in Android Studio:
   - Package name
   - Version code
   - Version name
   - App icons
   - Launch screen
4. **Generate signed bundle:**
   - Build → Generate Signed Bundle / APK
   - Choose Android App Bundle (.aab)
5. **Upload to Play Console** and submit for review

## Environment Variables

Create a `.env` file for environment-specific configuration:

```env
# API Endpoint (defaults to production)
VITE_API_URL=https://www.sanhoti.org/api

# Development API (if needed)
# VITE_API_URL=http://localhost:5001/api
```

## Troubleshooting

### Build Errors

**iOS:**
- Ensure CocoaPods are installed: `sudo gem install cocoapods`
- Run `cd ios && pod install` after adding plugins
- Clean build folder in Xcode: Product → Clean Build Folder

**Android:**
- Ensure Android SDK is installed
- Update Gradle: `cd android && ./gradlew wrapper --gradle-version 8.0`
- Clean project: `cd android && ./gradlew clean`

### API Connection Issues

- Check network permissions in `capacitor.config.ts`
- Verify API URL in `.env` file
- Check CORS settings on backend server
- Ensure HTTPS is used in production

### Plugin Issues

- Sync after adding plugins: `npx cap sync`
- Rebuild native projects
- Check plugin compatibility with Capacitor 6

## Useful Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Sync to native platforms
npm run cap:sync

# Open iOS project
npm run cap:open:ios

# Open Android project
npm run cap:open:android

# Build and open iOS
npm run build:ios

# Build and open Android
npm run build:android

# Lint code
npm run lint
```

## Development Tips

1. **Test in browser first:** Use `npm run dev` to test web version
2. **Use live reload:** Capacitor supports live reload with `npx cap run ios` or `npx cap run android`
3. **Check console:** Use Safari Web Inspector (iOS) or Chrome DevTools (Android) for debugging
4. **Platform-specific code:** Use `Capacitor.isNativePlatform()` to detect native vs web

## Support

For issues or questions, refer to:
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

## License

ISC

