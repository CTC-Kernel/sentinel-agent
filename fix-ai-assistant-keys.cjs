#!/usr/bin/env node

const fs = require('fs');

function fixAIAssistantKeys(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Fix patterns like key={t.name} -> key={t.name || 'unknown'}
        const patterns = [
            {
                regex: /key={t\.name}/g,
                replacement: 'key={t.name || \'unknown\'}'
            },
            {
                regex: /key={t\.id}/g,
                replacement: 'key={t.id || \'unknown\'}'
            },
            {
                regex: /key={t\.value}/g,
                replacement: 'key={t.value || \'unknown\'}'
            },
            {
                regex: /key={t\.code}/g,
                replacement: 'key={t.code || \'unknown\'}'
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
            console.log(`✓ Fixed AI assistant keys in ${filePath}`);
            return true;
        } else {
            console.log(`- No AI assistant key fixes needed for ${filePath}`);
            return false;
        }
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

// AI Assistant component files
const aiAssistantFiles = [
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ui/AIAssistantHeader.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/suppliers/SupplierAIAssistant.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/audits/AuditAIAssistant.tsx'
];

console.log('🔧 Fixing AI assistant component keys...\n');

let fixedCount = 0;
aiAssistantFiles.forEach(file => {
    if (fixAIAssistantKeys(file)) {
        fixedCount++;
    }
});

console.log(`\n✅ AI assistant key fixing complete! Fixed ${fixedCount} files.`);
