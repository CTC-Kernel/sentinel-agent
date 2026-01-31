#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function fixAnimatePresence(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Replace ALL occurrences of mode="wait" with mode="popLayout"
        const animatePresencePattern = /mode="wait"/g;
        
        if (animatePresencePattern.test(content)) {
            content = content.replace(animatePresencePattern, 'mode="popLayout"');
            modified = true;
        }
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✓ Fixed AnimatePresence in ${filePath}`);
            return true;
        } else {
            console.log(`- No AnimatePresence fixes needed for ${filePath}`);
            return false;
        }
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

// Get ALL files with mode="wait"
console.log('🔧 Finding all files with AnimatePresence mode="wait"...');

try {
    const result = execSync('find /Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src -name "*.tsx" -exec grep -l "mode=\\"wait\\"" {} \\;', { encoding: 'utf8' });
    const files = result.trim().split('\n').filter(file => file.length > 0);
    
    console.log(`Found ${files.length} files to fix...\n`);
    
    let fixedCount = 0;
    files.forEach(file => {
        if (fixAnimatePresence(file.trim())) {
            fixedCount++;
        }
    });
    
    console.log(`\n✅ AnimatePresence fixing complete! Fixed ${fixedCount} files.`);
    
} catch (error) {
    console.error('Error finding files:', error.message);
}
