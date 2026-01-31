/**
 * Test script to verify the heartbeat API fix
 * This simulates the mobile app heartbeat request
 */

import fetch from 'node-fetch';

// Test data
const testAgentId = 'test-agent-123';
const testOrganizationId = 'test-org-456';

const heartbeatData = {
    timestamp: new Date().toISOString(),
    agent_version: '1.0.0-test',
    status: 'online',
    hostname: 'test-device',
    os_info: 'iOS 17.0',
    cpu_percent: 0,
    memory_bytes: 0,
    memory_percent: 0,
    memory_total_bytes: 0,
    disk_percent: 0,
    disk_used_bytes: 0,
    disk_total_bytes: 0,
    uptime_seconds: 0,
    ip_address: 'unknown',
    last_check_at: new Date().toISOString(),
    compliance_score: 85,
    pending_sync_count: 0,
    self_check_result: { checks: [] }
};

async function testHeartbeatAPI() {
    try {
        console.log('🧪 Testing heartbeat API...');
        console.log('📤 Request data:', {
            url: `https://europe-west1-sentinel-grc-v2-prod.cloudfunctions.net/agentApi/v1/agents/${testAgentId}/heartbeat`,
            headers: {
                'Content-Type': 'application/json',
                'X-Organization-Id': testOrganizationId,
                'X-Agent-ID': testAgentId
            },
            body: heartbeatData
        });

        const response = await fetch(`https://europe-west1-sentinel-grc-v2-prod.cloudfunctions.net/agentApi/v1/agents/${testAgentId}/heartbeat`, {
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
            console.log('✅ Heartbeat API test successful!');
        } else {
            console.log('❌ Heartbeat API test failed!');
            if (response.status === 401) {
                console.log('🔍 This is expected for test data - the API correctly validates organization ID');
            }
        }

    } catch (error) {
        console.error('💥 Test failed with error:', error.message);
    }
}

// Run the test
testHeartbeatAPI();
