#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

function fixTabsContentKeys(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Fix TabsContent without key
        // <TabsContent value="metrics"> -> <TabsContent value="metrics" key="metrics">
        const tabsContentPattern = /<TabsContent\s+value="([^"]+)"([^>]*)>/g;
        
        content = content.replace(tabsContentPattern, (match, value, rest) => {
            // Check if key already exists
            if (rest.includes('key=')) {
                return match;
            }
            
            modified = true;
            return `<TabsContent value="${value}" key="${value}"${rest}>`;
        });
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✓ Fixed TabsContent keys in ${filePath}`);
            return true;
        } else {
            console.log(`- No TabsContent fixes needed for ${filePath}`);
            return false;
        }
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

console.log('🔧 Fixing TabsContent keys...\n');

// Get all TSX files with TabsContent
try {
    const result = execSync('find /Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src -name "*.tsx" -exec grep -l "TabsContent" {} \\;', { encoding: 'utf8' });
    const files = result.trim().split('\n').filter(file => file.length > 0);
    
    console.log(`Found ${files.length} files with TabsContent...\n`);
    
    let fixedCount = 0;
    files.forEach(file => {
        if (fixTabsContentKeys(file.trim())) {
            fixedCount++;
        }
    });
    
    console.log(`\n✅ TabsContent key fixing complete! Fixed ${fixedCount} files.`);
    console.log('\n🎯 Expected result: All TabsContent components now have unique keys!');
    
} catch (error) {
    console.error('Error finding files:', error.message);
}
