import { FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  console.log('🔧 Setting up E2E test environment...');
  
  // Set environment variables for Firebase emulators
  process.env.VITE_USE_EMULATORS = 'true';
  process.env.VITE_FIREBASE_PROJECT_ID = 'sentinel-grc-a8701';
  process.env.VITE_FIREBASE_API_KEY = 'mock-api-key';
  process.env.VITE_FIREBASE_AUTH_DOMAIN = 'localhost:9099';
  process.env.VITE_FIREBASE_APP_ID = 'mock-app-id';
  process.env.VITE_FIREBASE_MESSAGING_SENDER_ID = 'mock-sender-id';
  process.env.VITE_FIREBASE_STORAGE_BUCKET = 'localhost:9199';
  process.env.VITE_FIREBASE_MEASUREMENT_ID = 'mock-measurement-id';
  
  console.log('✅ E2E environment configured');
}

export default globalSetup;
