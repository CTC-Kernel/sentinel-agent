#!/usr/bin/env node

const fs = require('fs');

function findProblematicKeys(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const issues = [];
        
        lines.forEach((line, index) => {
            // Pattern 1: key={``} - empty template literal
            if (line.includes('key={``}')) {
                issues.push({
                    line: index + 1,
                    type: 'empty-template',
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
            
            // Pattern 4: key={variable} where variable might be undefined
            const keyVariableMatch = line.match(/key={\s*([^}]+)\s*}/);
            if (keyVariableMatch && !keyVariableMatch[1].includes('`') && !keyVariableMatch[1].includes('"')) {
                const variable = keyVariableMatch[1];
                // Check if this variable could be undefined in common patterns
                if (variable.includes('item.') || variable.includes('data.') || variable.includes('obj.')) {
                    issues.push({
                        line: index + 1,
                        type: 'potential-undefined',
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

// Search in common component directories
const searchDirs = [
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/views'
];

console.log('🔍 Searching for problematic React keys...\n');

let totalIssues = 0;
searchDirs.forEach(dir => {
    try {
        const { execSync } = require('child_process');
        const result = execSync(`find "${dir}" -name "*.tsx" | head -20`, { encoding: 'utf8' });
        const files = result.trim().split('\n').filter(file => file.length > 0);
        
        files.forEach(file => {
            if (findProblematicKeys(file.trim())) {
                totalIssues++;
            }
        });
    } catch (error) {
        // Skip if directory doesn't exist
    }
});

console.log(`\n📊 Summary: Found issues in ${totalIssues} files`);
