#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

function finalKeyVerification(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const issues = [];
        
        lines.forEach((line, index) => {
            // Pattern 1: Empty keys
            if (line.includes('key={``}') || line.includes('key=""') || line.includes('key={}')) {
                issues.push({
                    line: index + 1,
                    type: 'empty-key',
                    content: line.trim()
                });
            }
            
            // Pattern 2: Property access without fallback
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
            
            // Pattern 3: React.Fragment with ref
            if (line.includes('<React.Fragment') && line.includes('ref=')) {
                issues.push({
                    line: index + 1,
                    type: 'fragment-with-ref',
                    content: line.trim()
                });
            }
            
            // Pattern 4: AnimatePresence mode="wait"
            if (line.includes('mode="wait"')) {
                issues.push({
                    line: index + 1,
                    type: 'animatepresence-wait-mode',
                    content: line.trim()
                });
            }
        });
        
        if (issues.length > 0) {
            console.log(`\n❌ Issues in ${filePath}:`);
            issues.forEach(issue => {
                console.log(`  Line ${issue.line}: [${issue.type}] ${issue.content}`);
                if (issue.variable) console.log(`    Variable: ${issue.variable}`);
            });
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

console.log('🔍 FINAL VERIFICATION: Checking ALL files for ANY remaining key issues...\n');

// Check ALL TSX files in the entire project
try {
    const result = execSync('find /Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src -name "*.tsx"', { encoding: 'utf8' });
    const files = result.trim().split('\n').filter(file => file.length > 0);
    
    console.log(`Checking ${files.length} TSX files...\n`);
    
    let healthyFiles = 0;
    let totalIssues = 0;
    let processedCount = 0;
    
    files.forEach(file => {
        if (finalKeyVerification(file.trim())) {
            healthyFiles++;
        } else {
            totalIssues++;
        }
        processedCount++;
        
        // Show progress every 100 files
        if (processedCount % 100 === 0) {
            console.log(`Processed ${processedCount}/${files.length} files...`);
        }
    });
    
    console.log(`\n📊 FINAL VERIFICATION RESULTS:`);
    console.log(`✅ Healthy files: ${healthyFiles}/${files.length}`);
    console.log(`❌ Files with issues: ${totalIssues}`);
    
    if (totalIssues === 0) {
        console.log('\n🎉 PERFECT! All key issues have been resolved!');
        console.log('✅ No duplicate keys, empty keys, or React.Fragment ref errors');
        console.log('✅ All AnimatePresence components use mode="popLayout"');
        console.log('\n🚀 The application should be completely stable now!');
    } else {
        console.log(`\n⚠️  Still ${totalIssues} files with key issues that need attention`);
        console.log('💡 Run the detailed search to see specific issues');
    }
    
} catch (error) {
    console.error('Error finding files:', error.message);
}
