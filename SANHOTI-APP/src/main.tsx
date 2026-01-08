import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import App from './App.tsx';
import './index.css';

// Initialize Capacitor plugins
const initCapacitor = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      // Set status bar style
      await StatusBar.setStyle({ style: Style.Default });
      await StatusBar.setBackgroundColor({ color: '#B8860B' });
      
      // Hide splash screen after app loads
      await SplashScreen.hide();
    } catch (error) {
      console.warn('Capacitor plugins not available:', error);
    }
  }
};

// Initialize and render
initCapacitor();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

