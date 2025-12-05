import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { HelmetProvider } from 'react-helmet-async';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Initialize Capacitor plugins
const initializeApp = async () => {
  try {
    // Dynamically import Capacitor core to check platform
    const { Capacitor } = await import('@capacitor/core');

    if (Capacitor.isNativePlatform()) {
      // Only import and use plugins on native platforms
      const { SplashScreen } = await import('@capacitor/splash-screen');
      const { StatusBar, Style } = await import('@capacitor/status-bar');

      if (Capacitor.getPlatform() === 'ios') {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0f172a' });
      }

      await SplashScreen.hide();
    }
  } catch (error) {
    // Silently fail on web or if plugins are missing
    console.debug('Capacitor initialization skipped or failed:', error);
  }
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID_HERE";

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);

// Initialize app after render
initializeApp();