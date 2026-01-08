import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.sanhoti.app',
  appName: 'Sanhoti',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // Use production API in production builds
    url: process.env.CAPACITOR_SERVER_URL || undefined,
    cleartext: false, // Disable cleartext (HTTP) traffic for security
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#B8860B',
    },
    StatusBar: {
      style: 'default',
      backgroundColor: '#B8860B',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
};

export default config;

