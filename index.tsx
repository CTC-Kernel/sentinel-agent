import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorLogger } from './services/errorLogger';
import { HelmetProvider } from 'react-helmet-async';

// Capacitor imports for native functionality
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

// Initialize Capacitor plugins
const initializeApp = async () => {
  try {
    // Configure StatusBar for iOS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Capacitor?.getPlatform() === 'ios') {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0f172a' });
    }

    // Hide splash screen after app is ready
    await SplashScreen.hide();
  } catch (error) {
    ErrorLogger.error(error, 'index.initializeApp');
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);

// Initialize app after render
initializeApp();