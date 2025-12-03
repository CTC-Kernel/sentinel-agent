import fs from 'fs';
import path from 'path';

const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_MEASUREMENT_ID',
    'VITE_FIREBASE_VAPID_KEY',
    'VITE_RECAPTCHA_ENTERPRISE_KEY',
    'VITE_APP_BASE_URL',
    'VITE_API_URL'
];

const yamlPath = path.join(process.cwd(), 'apphosting.yaml');
let yamlContent = '';

try {
    yamlContent = fs.readFileSync(yamlPath, 'utf8');
} catch (e) {
    console.error('❌ Could not read apphosting.yaml');
    process.exit(1);
}

console.log('--- Verifying apphosting.yaml ---');

let missingVars = [];
requiredVars.forEach(varName => {
    // Simple check if the variable name exists in the file
    if (!yamlContent.includes(varName)) {
        missingVars.push(varName);
    }
});

if (missingVars.length > 0) {
    console.error('❌ Missing variables in apphosting.yaml:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
} else {
    console.log('✅ All required variables are present in apphosting.yaml.');
}

// Check for secrets (should NOT be in env for App Hosting if using defineSecret in functions, 
// but if using App Hosting backend, they might be needed. Here we assume standard functions).
// We just verify they are NOT exposed as plain text if they were somehow added.
const dangerousSecrets = ['SENDGRID_API_KEY', 'STRIPE_SECRET_KEY'];
dangerousSecrets.forEach(secret => {
    if (yamlContent.includes(secret) && !yamlContent.includes(`secret: ${secret}`)) {
        console.warn(`⚠️ WARNING: ${secret} found in apphosting.yaml. Ensure it is not hardcoded!`);
    }
});
