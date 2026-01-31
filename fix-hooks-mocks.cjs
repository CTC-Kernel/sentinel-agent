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

// Get all hook test files
const hookTestFiles = [
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/utils/__tests__/permissions.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/voxel/__tests__/useVoxelRealtime.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/voxel/__tests__/useRbacNodeFilter.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useAdminActions.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useVoxels.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useSecureForm.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useComplianceDataSeeder.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useContinuity.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/usePrivacy.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useLocale.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useReferenceData.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useActivityLogs.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useTeamManagement.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useDocumentWorkflow.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/usePlanLimits.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useAuthActions.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useThreats.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useSystemHealth.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useComplianceData.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useReports.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useGlobalSearch.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useVulnerabilities.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useResourceLogs.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useThreatIntelligence.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useFrameworks.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/hooks/__tests__/useTeamData.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/services/__tests__/PdfService.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/services/__tests__/encryptionService.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/services/__tests__/accountService.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/services/__tests__/adminService.test.ts',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/services/__tests__/errorLogger.test.ts'
];

console.log('🔧 Fixing store mocks in hook test files...\n');

hookTestFiles.forEach(fixStoreMock);

console.log('\n✅ Hook store mock fixing complete!');
