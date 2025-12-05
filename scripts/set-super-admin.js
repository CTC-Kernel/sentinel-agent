import admin from 'firebase-admin';
import fs from 'fs';

const args = process.argv.slice(2);
const email = args[0];

if (!email) {
    console.error('Please provide an email address.');
    console.log('Usage: node scripts/set-super-admin.js <email>');
    process.exit(1);
}

// Initialize Firebase Admin
// Check for serviceAccountKey.json
const serviceAccountPath = './serviceAccountKey.json';

try {
    let app;
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Initialized with serviceAccountKey.json');
    } else {
        // Fallback to default credentials (requires `gcloud auth application-default login`)
        app = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: 'sentinel-grc-a8701' // Explicitly set project ID
        });
        console.log('Initialized with Application Default Credentials');
    }
} catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
}

async function setSuperAdmin(userEmail) {
    try {
        const user = await admin.auth().getUserByEmail(userEmail);

        // Get existing claims
        const currentClaims = user.customClaims || {};

        // Set superAdmin: true
        await admin.auth().setCustomUserClaims(user.uid, {
            ...currentClaims,
            superAdmin: true
        });

        console.log(`Successfully granted Super Admin access to ${userEmail}`);
        console.log('User UID:', user.uid);
        console.log('New Claims:', { ...currentClaims, superAdmin: true });
        console.log('\nIMPORTANT: The user must sign out and sign back in for changes to take effect.');
        process.exit(0);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.error(`User with email ${userEmail} not found.`);
        } else {
            console.error('Error setting custom claims:', error);
        }
        process.exit(1);
    }
}

setSuperAdmin(email);
