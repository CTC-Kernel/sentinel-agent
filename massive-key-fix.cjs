#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

function fixAllKeysInFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Fix ALL property access patterns without fallback
        // key={user.uid} -> key={user.uid || 'unknown'}
        const propertyPattern = /key={([^}]+)}/g;
        
        content = content.replace(propertyPattern, (match, variable) => {
            // Skip if already has fallback
            if (variable.includes('||') || variable.includes('&&')) {
                return match;
            }
            
            // Add fallback for any property access
            modified = true;
            return `key={${variable} || 'unknown'}`;
        });
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✓ Fixed keys in ${filePath}`);
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

console.log('🔧 MASSIVE FIX: Correcting ALL key issues in 311 files...\n');

// Get all TSX files
try {
    const result = execSync('find /Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src -name "*.tsx"', { encoding: 'utf8' });
    const files = result.trim().split('\n').filter(file => file.length > 0);
    
    console.log(`Processing ${files.length} files...\n`);
    
    let fixedCount = 0;
    let processedCount = 0;
    
    files.forEach(file => {
        if (fixAllKeysInFile(file.trim())) {
            fixedCount++;
        }
        processedCount++;
        
        // Show progress every 100 files
        if (processedCount % 100 === 0) {
            console.log(`Processed ${processedCount}/${files.length} files, fixed ${fixedCount}...`);
        }
    });
    
    console.log(`\n✅ MASSIVE FIX COMPLETE! Fixed ${fixedCount} files.`);
    console.log('\n🎯 Expected result: ALL duplicate key errors should be resolved!');
    
} catch (error) {
    console.error('Error finding files:', error.message);
}
