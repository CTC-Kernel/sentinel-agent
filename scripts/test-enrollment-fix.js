/**
 * Test Enrollment Fix
 *
 * This script simulates an agent enrollment request without an organization_id.
 * It targets the local Firebase emulator suite.
 *
 * Usage:
 * 1. Start emulators: firebase emulators:start
 * 2. Run this script: node scripts/test-enrollment-fix.js
 */

const http = require('http');

// Configuration
const PROJECT_ID = 'sentinel-grc-a8701'; // Default project ID
const REGION = 'europe-west1';
const FUNCTION_NAME = 'enrollAgent';
const PORT = 5001; // Default functions emulator port

// Mock Data
const payload = {
    enrollment_token: 'TEST-TOKEN-12345', // Ensure this token exists in your emulator data
    hostname: 'test-agent-host',
    os: 'test-os',
    os_version: '1.0',
    machine_id: 'test-machine-id-' + Date.now(),
    agent_version: '0.0.0'
    // NOTE: organization_id is INTENTIONALLY OMITTED
};

const payloadString = JSON.stringify(payload);

const options = {
    hostname: '127.0.0.1',
    port: PORT,
    path: `/${PROJECT_ID}/${REGION}/${FUNCTION_NAME}`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': payloadString.length
    }
};

console.log('Sending enrollment request:', options.path);
console.log('Payload:', payload);

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Response Body:', data);

        if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
                const json = JSON.parse(data);
                if (json.agent_id && json.organization_id) {
                    console.log('✅ SUCCESS: Enrollment successful without organization_id!');
                    console.log(`   Agent ID: ${json.agent_id}`);
                    console.log(`   Organization ID: ${json.organization_id}`);
                } else {
                    console.log('⚠️  WARNING: Response missing agent_id or organization_id');
                }
            } catch (e) {
                console.log('❌ ERROR: Invalid JSON response');
            }
        } else {
            console.log('❌ FAILURE: Request failed');
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    console.log('HINT: Make sure Firebase Emulators are running (firebase emulators:start)');
});

req.write(payloadString);
req.end();
