#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Standard t function mock
const tFunctionMock = `t: (key: string, options?: Record<string, unknown>) => {
            if (options && 'defaultValue' in options) {
                return (options as { defaultValue?: string }).defaultValue || key;
            }
            return key;
        }`;

function fixStoreMock(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if file already has proper t function mock
        if (content.includes('t: (key: string, options?: Record<string, unknown>)')) {
            console.log(`✓ ${filePath} already has proper t function mock`);
            return;
        }
        
        // Find useStore mock patterns and fix them
        const patterns = [
            // Pattern 1: vi.mock.*useStore.*=>.*\(\s*\{\s*[^}]*\}\s*\)
            {
                regex: /(vi\.mock\([^)]*useStore[^)]*\)\s*=>\s*\(\s*\{([^}]*)\}\s*\))/gs,
                replacement: (match, storeMock, innerContent) => {
                    // Check if t function is already present
                    if (innerContent.includes('t:')) {
                        return match;
                    }
                    
                    // Add t function to the mock
                    const fixedInner = innerContent.trim() + ',\n        ' + tFunctionMock;
                    return match.replace(innerContent, fixedInner);
                }
            },
            // Pattern 2: useStore: \(\) => \(\{([^}]*)\}\)
            {
                regex: /(useStore:\s*\(\)\s*=>\s*\(\{([^}]*)\}\))/gs,
                replacement: (match, storeMock, innerContent) => {
                    // Check if t function is already present
                    if (innerContent.includes('t:')) {
                        return match;
                    }
                    
                    // Add t function to the mock
                    const fixedInner = innerContent.trim() + ',\n        ' + tFunctionMock;
                    return match.replace(innerContent, fixedInner);
                }
            }
        ];
        
        let modified = false;
        patterns.forEach(pattern => {
            const newContent = content.replace(pattern.regex, pattern.replacement);
            if (newContent !== content) {
                content = newContent;
                modified = true;
            }
        });
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✓ Fixed ${filePath}`);
        } else {
            console.log(`- No changes needed for ${filePath}`);
        }
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
    }
}

// Get all test files
const testFiles = [
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/contexts/__tests__/AuthContext.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/contexts/__tests__/CrisisContext.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/continuity/inspector/__tests__/ProcessGeneralDetails.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ui/__tests__/FeedbackModal.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ui/__tests__/TrendSparkline.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ui/__tests__/SyncIndicator.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/settings/__tests__/AgentManagement.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/settings/__tests__/FrameworkSettings.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/collaboration/__tests__/CommentSection.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/collaboration/__tests__/DiscussionPanel.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/calendar/__tests__/CalendarDashboard.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/audits/inspector/__tests__/AuditFindings.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/auth/__tests__/RoleGuard.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/layout/__tests__/Sidebar.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/layout/__tests__/TopBar.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/voxel/__tests__/VoxelFallback2D.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/voxel/__tests__/VoxelCanvas.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/voxel/__tests__/VoxelViewer.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/dashboard/__tests__/ConfigurableDashboard.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ai/__tests__/AIAssistButton.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/threat-intel/__tests__/CommunitySettingsModal.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/risks/__tests__/TreatmentActions.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/documents/__tests__/ApprovalFlow.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/documents/__tests__/RetentionDashboard.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/assets/__tests__/AgentDownload.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/timeline/__tests__/InteractiveTimeline.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/incidents/__tests__/IncidentStats.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useGlobalShortcuts.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/admin/components/__tests__/TenantDetailModal.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/ActivityLogs.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Privacy.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Integrations.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Settings.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Dashboard.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Compliance.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Documents.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Onboarding.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Reports.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Notifications.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Suppliers.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Projects.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Incidents.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Pricing.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Continuity.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/EbiosAnalyses.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/EbiosAnalysisDetail.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/ThreatRegistry.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/VendorConcentration.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Risks.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Team.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Login.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Audits.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/Assets.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/SystemHealth.test.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views/__tests__/VoxelView.test.tsx'
];

console.log('🔧 Fixing store mocks in test files...\n');

testFiles.forEach(fixStoreMock);

console.log('\n✅ Store mock fixing complete!');
