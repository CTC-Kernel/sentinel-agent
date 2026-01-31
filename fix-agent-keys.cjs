#!/usr/bin/env node

const fs = require('fs');

function fixAgentKeys(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Fix patterns like key={rule.id} -> key={rule.id || 'unknown'}
        const patterns = [
            {
                regex: /key={(\w+\.id)}/g,
                replacement: 'key={$1 || \'unknown\'}'
            },
            {
                regex: /key={(\w+\.idx)}/g,
                replacement: 'key={$1 || \'unknown\'}'
            },
            {
                regex: /key={(\w+\.pid)}/g,
                replacement: 'key={$1 || \'unknown\'}'
            },
            {
                regex: /key={(\w+\.name)}/g,
                replacement: 'key={$1 || \'unknown\'}'
            }
        ];
        
        patterns.forEach(pattern => {
            const newContent = content.replace(pattern.regex, pattern.replacement);
            if (newContent !== content) {
                content = newContent;
                modified = true;
            }
        });
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✓ Fixed agent keys in ${filePath}`);
            return true;
        } else {
            console.log(`- No agent key fixes needed for ${filePath}`);
            return false;
        }
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

// Agent component files
const agentFiles = [
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/PolicyEditor.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/AgentProcessList.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/AnomalyAlerts.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/AgentFleetDashboard.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/CISBenchmarkView.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/AgentHealthGrid.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/GroupManager.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/AgentNetworkConnections.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/AgentMetricsChart.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/SoftwareTable.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/AgentComplianceHeatmap.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/BehavioralBaseline.tsx'
];

console.log('🔧 Fixing agent component keys...\n');

let fixedCount = 0;
agentFiles.forEach(file => {
    if (fixAgentKeys(file)) {
        fixedCount++;
    }
});

console.log(`\n✅ Agent key fixing complete! Fixed ${fixedCount} files.`);
