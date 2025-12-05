const admin = require('firebase-admin');
const args = process.argv.slice(2);
const email = args[0];

if (!email) {
    console.error('Please provide an email address: node scripts/set-super-admin.js <email>');
    process.exit(1);
}

// Initialize Firebase Admin
// 1. Try to find serviceAccountKey.json in root or parent
// 2. Fallback to GOOGLE_APPLICATION_CREDENTIALS or Default Auth
try {
    // Check local directory
    try {
        const serviceAccount = require('../serviceAccountKey.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Using serviceAccountKey.json');
    } catch (e) {
        console.log('No serviceAccountKey.json found, trying default credentials...');
        admin.initializeApp();
    }
} catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
}

async function setSuperAdmin() {
    try {
        console.log(`Looking up user: ${email}...`);
        const user = await admin.auth().getUserByEmail(email);

        console.log(`User found: ${user.uid}`);
        console.log(`Current claims:`, user.customClaims || {});

        const currentClaims = user.customClaims || {};

        await admin.auth().setCustomUserClaims(user.uid, {
            ...currentClaims,
            superAdmin: true
        });

        console.log('-----------------------------------');
        console.log(`✅ Success! ${email} is now a Super Admin.`);
        console.log('-----------------------------------');
        console.log('Please log out and log back in to refresh your token claims.');
        process.exit(0);
    } catch (error) {
        console.error('Error setting super admin claim:', error);
        process.exit(1);
    }
}

setSuperAdmin();
