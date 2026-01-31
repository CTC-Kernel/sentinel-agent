#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

function findEmptyKeys(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const issues = [];
        
        lines.forEach((line, index) => {
            // Pattern 1: key={``} - empty template literal
            if (line.includes('key={``}')) {
                issues.push({
                    line: index + 1,
                    type: 'empty-template-literal',
                    content: line.trim()
                });
            }
            
            // Pattern 2: key={""} - empty string
            if (line.includes('key=""')) {
                issues.push({
                    line: index + 1,
                    type: 'empty-string',
                    content: line.trim()
                });
            }
            
            // Pattern 3: key={} - empty braces
            if (line.includes('key={}') && !line.includes('key={``}') && !line.includes('key={""}')) {
                issues.push({
                    line: index + 1,
                    type: 'empty-braces',
                    content: line.trim()
                });
            }
            
            // Pattern 4: key={variable} where variable could be null/undefined
            const keyMatch = line.match(/key={\s*([^}]+)\s*}/);
            if (keyMatch) {
                const variable = keyMatch[1];
                // Check for patterns that commonly result in undefined/null
                if (variable.includes('?.') && !variable.includes('||')) {
                    // Optional chaining without fallback
                    issues.push({
                        line: index + 1,
                        type: 'optional-chaining-no-fallback',
                        content: line.trim(),
                        variable: variable
                    });
                }
                
                // Check for array access without bounds check
                if (variable.includes('[') && !variable.includes('||')) {
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
                if (issue.variable) {
                    console.log(`    Variable: ${issue.variable}`);
                }
            });
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

// Search in ALL TSX files
console.log('🔧 Searching ALL files for empty React keys...\n');

try {
    const result = execSync('find /Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src -name "*.tsx" | head -50', { encoding: 'utf8' });
    const files = result.trim().split('\n').filter(file => file.length > 0);
    
    let totalIssues = 0;
    files.forEach(file => {
        if (findEmptyKeys(file.trim())) {
            totalIssues++;
        }
    });
    
    console.log(`\n📊 Summary: Found issues in ${totalIssues} files`);
    
} catch (error) {
    console.error('Error finding files:', error.message);
}
