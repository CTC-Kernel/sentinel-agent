#!/usr/bin/env node

const fs = require('fs');

function fixEmptyKeys(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Pattern to fix property access without fallback
        // key={u.uid} -> key={u.uid || 'unknown'}
        const propertyPattern = /key={([^}]+)}/g;
        
        content = content.replace(propertyPattern, (match, variable) => {
            // Skip if already has fallback
            if (variable.includes('||')) {
                return match;
            }
            
            // Add fallback for property access
            modified = true;
            return `key={${variable} || 'unknown'}`;
        });
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✓ Fixed empty keys in ${filePath}`);
            return true;
        } else {
            console.log(`- No empty key fixes needed for ${filePath}`);
            return false;
        }
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

// Files with potential empty key issues
const problematicFiles = [
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/RoleManagement.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ebios/workshops/Workshop2Content.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ebios/workshops/forms/EssentialAssetForm.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ebios/workshops/forms/MissionForm.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ebios/workshops/forms/SupportingAssetForm.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ebios/workshops/forms/FearedEventForm.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ebios/workshops/Workshop5Content.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ebios/workshops/SecurityBaselinePanel.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/ebios/workshops/Workshop3Content.tsx'
];

console.log('🔧 Fixing all empty key issues...\n');

let fixedCount = 0;
problematicFiles.forEach(file => {
    if (fixEmptyKeys(file)) {
        fixedCount++;
    }
});

console.log(`\n✅ Empty key fixing complete! Fixed ${fixedCount} files.`);
