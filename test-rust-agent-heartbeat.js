/**
 * Test script to verify the Rust agent heartbeat API fix
 * This simulates the Rust agent heartbeat request with proper X-Organization-Id header
 */

import fetch from 'node-fetch';

// Test data
const testAgentId = 'test-agent-rust-456';
const testOrganizationId = 'test-org-rust-789';

const heartbeatData = {
    timestamp: new Date().toISOString(),
    agent_version: '1.0.2-rust',
    status: 'online',
    hostname: 'rust-test-device',
    os_info: 'Linux 5.15.0',
    cpu_percent: 15.5,
    memory_bytes: 8589934592,
    memory_percent: 45.2,
    memory_total_bytes: 17179869184,
    disk_percent: 62.8,
    disk_used_bytes: 107374182400,
    disk_total_bytes: 171798691840,
    uptime_seconds: 86400,
    ip_address: '192.168.1.100',
    last_check_at: new Date().toISOString(),
    compliance_score: 92.5,
    pending_sync_count: 0,
    self_check_result: { checks: [] }
};

async function testRustAgentHeartbeat() {
    try {
        console.log('🦀 Testing Rust agent heartbeat API...');
        console.log('📤 Request data:', {
            url: `https://sentinel-grc-v2-prod.web.app/v1/agents/${testAgentId}/heartbeat`,
            headers: {
                'Content-Type': 'application/json',
                'X-Organization-Id': testOrganizationId,
                'X-Agent-ID': testAgentId
            },
            body: heartbeatData
        });

        const response = await fetch(`https://sentinel-grc-v2-prod.web.app/v1/agents/${testAgentId}/heartbeat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Organization-Id': testOrganizationId,
                'X-Agent-ID': testAgentId
            },
            body: JSON.stringify(heartbeatData)
        });

        console.log('📥 Response status:', response.status, response.statusText);
        
        const responseText = await response.text();
        console.log('📥 Response body:', responseText);

        if (response.ok) {
            console.log('✅ Rust agent heartbeat API test successful!');
            console.log('🎉 The X-Organization-Id header fix is working!');
        } else {
            console.log('❌ Rust agent heartbeat API test failed!');
            if (response.status === 401) {
                console.log('🔍 This might be expected for test data - the API correctly validates the agent');
            } else if (response.status === 403) {
                console.log('🔍 Organization mismatch - this is expected for test data');
            }
        }

    } catch (error) {
        console.error('💥 Test failed with error:', error.message);
    }
}

// Test without X-Organization-Id header (should fail with 401)
async function testWithoutOrganizationHeader() {
    try {
        console.log('\n🧪 Testing WITHOUT X-Organization-Id header (should fail)...');
        
        const response = await fetch(`https://sentinel-grc-v2-prod.web.app/v1/agents/${testAgentId}/heartbeat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Agent-ID': testAgentId
                // Missing X-Organization-Id header
            },
            body: JSON.stringify(heartbeatData)
        });

        console.log('📥 Response status:', response.status, response.statusText);
        
        if (response.status === 401) {
            console.log('✅ Correctly rejected request without X-Organization-Id header!');
        } else {
            console.log('❌ Should have been rejected with 401 status');
        }

    } catch (error) {
        console.error('💥 Test failed with error:', error.message);
    }
}

// Run both tests
console.log('🚀 Starting Rust agent heartbeat API tests...\n');
testRustAgentHeartbeat().then(() => {
    testWithoutOrganizationHeader();
});
