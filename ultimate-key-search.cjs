#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

function ultimateKeySearch(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const issues = [];
        
        lines.forEach((line, index) => {
            // Pattern 1: Any key with property access without fallback
            const keyMatch = line.match(/key={([^}]+)}/);
            if (keyMatch) {
                const variable = keyMatch[1].trim();
                
                // Check for ANY property access without fallback
                if (variable.includes('.') && !variable.includes('||') && !variable.includes('&&')) {
                    issues.push({
                        line: index + 1,
                        type: 'property-access-no-fallback',
                        content: line.trim(),
                        variable: variable
                    });
                }
                
                // Check for ANY optional chaining without fallback
                if (variable.includes('?.') && !variable.includes('||') && !variable.includes('&&')) {
                    issues.push({
                        line: index + 1,
                        type: 'optional-chaining-no-fallback',
                        content: line.trim(),
                        variable: variable
                    });
                }
                
                // Check for ANY array access without fallback
                if (variable.includes('[') && !variable.includes('||') && !variable.includes('&&')) {
                    issues.push({
                        line: index + 1,
                        type: 'array-access-no-fallback',
                        content: line.trim(),
                        variable: variable
                    });
                }
            }
        });
        
        if (issues.length > 0) {
            console.log(`\n🔍 Issues in ${filePath}:`);
            issues.forEach(issue => {
                console.log(`  Line ${issue.line}: [${issue.type}] ${issue.content}`);
                console.log(`    Variable: ${issue.variable}`);
            });
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

console.log('🔧 ULTIMATE: Searching ALL files for ANY key issues...\n');

// Search in ALL TSX files in the entire project
try {
    const result = execSync('find /Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src -name "*.tsx"', { encoding: 'utf8' });
    const files = result.trim().split('\n').filter(file => file.length > 0);
    
    console.log(`Found ${files.length} TSX files to check...\n`);
    
    let totalIssues = 0;
    let processedCount = 0;
    
    files.forEach(file => {
        if (ultimateKeySearch(file.trim())) {
            totalIssues++;
        }
        processedCount++;
        
        // Show progress every 50 files
        if (processedCount % 50 === 0) {
            console.log(`Processed ${processedCount}/${files.length} files...`);
        }
    });
    
    console.log(`\n📊 FINAL RESULT: Found key issues in ${totalIssues} files`);
    
    if (totalIssues > 0) {
        console.log('\n⚠️  These are the sources of the duplicate key errors!');
        console.log('💡 ALL of these need || "fallback" to be fixed');
    } else {
        console.log('\n✅ No key issues found - the problem might be elsewhere');
    }
    
} catch (error) {
    console.error('Error finding files:', error.message);
}
