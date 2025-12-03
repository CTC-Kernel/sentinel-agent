import fs from 'fs';
import path from 'path';

// 1. Read .env
const envPath = path.join(process.cwd(), '.env');
let envContent = '';
try {
    envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
    console.error('❌ Could not read .env');
    process.exit(1);
}

const getEnvVar = (name) => {
    const match = envContent.match(new RegExp(`${name}=(.*)`));
    return match ? match[1].trim() : null;
};

const senderId = getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID');
const appId = getEnvVar('VITE_FIREBASE_APP_ID');

console.log('--- Production Config ---');
console.log('Sender ID:', senderId);
console.log('App ID:', appId);

// 2. Read public/firebase-messaging-sw.js
const swPath = path.join(process.cwd(), 'public/firebase-messaging-sw.js');
let swContent = '';
try {
    swContent = fs.readFileSync(swPath, 'utf8');
} catch (e) {
    console.error('❌ Could not read public/firebase-messaging-sw.js');
    process.exit(1);
}

const getSwVar = (name) => {
    const match = swContent.match(new RegExp(`${name}: "(.*)"`));
    return match ? match[1].trim() : null;
};

const swSenderId = getSwVar('messagingSenderId');
const swAppId = getSwVar('appId');

console.log('\n--- Service Worker Config ---');
console.log('Sender ID:', swSenderId);
console.log('App ID:', swAppId);

// 3. Compare
console.log('\n--- Verification Result ---');
if (senderId === swSenderId && appId === swAppId) {
    console.log('✅ Service Worker configuration MATCHES production environment.');
} else {
    console.error('❌ MISMATCH DETECTED!');
    if (senderId !== swSenderId) console.error(`Sender ID mismatch: Env(${senderId}) vs SW(${swSenderId})`);
    if (appId !== swAppId) console.error(`App ID mismatch: Env(${appId}) vs SW(${swAppId})`);
}
