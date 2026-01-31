#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

function diagnoseFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const issues = [];
        
        // Check for React.Fragment ref issues
        if (content.includes('<React.Fragment') && content.includes('ref=')) {
            issues.push('React.Fragment with ref prop');
        }
        
        // Check for empty keys
        if (content.includes('key={``}') || content.includes('key=""') || content.includes('key={}')) {
            issues.push('Empty React key');
        }
        
        // Check for AnimatePresence mode="wait"
        if (content.includes('mode="wait"')) {
            issues.push('AnimatePresence mode="wait"');
        }
        
        // Check for Recharts without dimensions
        if (content.includes('ResponsiveContainer') && !content.includes('minWidth') && !content.includes('minHeight')) {
            issues.push('Recharts ResponsiveContainer without dimensions');
        }
        
        if (issues.length > 0) {
            console.log(`❌ ${filePath}: ${issues.join(', ')}`);
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.log(`⚠️  Could not read ${filePath}: ${error.message}`);
        return false;
    }
}

console.log('🔍 Diagnosing runtime errors...\n');

// Check key files
const keyFiles = [
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ui/Breadcrumbs.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/AgentProcessList.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/AgentMetricsChart.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/VoxelGuide.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/risks/RiskForm.tsx'
];

let healthyFiles = 0;
keyFiles.forEach(file => {
    if (diagnoseFile(file)) {
        healthyFiles++;
    }
});

console.log(`\n📊 Diagnosis Complete: ${healthyFiles}/${keyFiles.length} files healthy`);

// Quick check for any remaining issues
try {
    const result = execSync('find /Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src -name "*.tsx" -exec grep -l "mode=\\"wait\\"" {} \\; | wc -l', { encoding: 'utf8' });
    const waitModeCount = parseInt(result.trim());
    
    if (waitModeCount > 0) {
        console.log(`⚠️  Still found ${waitModeCount} files with mode="wait"`);
    } else {
        console.log('✅ No files with mode="wait" found');
    }
} catch (error) {
    console.log('⚠️  Could not check for mode="wait" files');
}

console.log('\n🎯 Expected result: Reload the application to see if errors are resolved!');
