#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

function deepSearchForEmptyKeys(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const issues = [];
        
        lines.forEach((line, index) => {
            // Pattern 1: key={variable} where variable could be undefined
            const keyMatch = line.match(/key={([^}]+)}/);
            if (keyMatch) {
                const variable = keyMatch[1].trim();
                
                // Check for patterns that commonly result in empty strings
                if (variable.includes('?.') && !variable.includes('||') && !variable.includes('&&')) {
                    // Optional chaining without fallback
                    issues.push({
                        line: index + 1,
                        type: 'optional-chaining-no-fallback',
                        content: line.trim(),
                        variable: variable
                    });
                }
                
                // Check for array access that could be undefined
                if (variable.includes('[') && !variable.includes('||') && !variable.includes('&&')) {
                    issues.push({
                        line: index + 1,
                        type: 'array-access-no-fallback',
                        content: line.trim(),
                        variable: variable
                    });
                }
                
                // Check for property access that could be undefined
                if (variable.includes('.') && !variable.includes('||') && !variable.includes('&&') && !variable.includes('?')) {
                    issues.push({
                        line: index + 1,
                        type: 'property-access-no-fallback',
                        content: line.trim(),
                        variable: variable
                    });
                }
            }
            
            // Pattern 2: Template literals that could be empty
            const templateMatch = line.match(/key={`([^`]+)`}/);
            if (templateMatch) {
                const template = templateMatch[1];
                
                // Check if template could result in empty string
                if (template.includes('${') && template.includes('||') === false) {
                    issues.push({
                        line: index + 1,
                        type: 'template-literal-no-fallback',
                        content: line.trim(),
                        template: template
                    });
                }
            }
        });
        
        if (issues.length > 0) {
            console.log(`\n🔍 Issues in ${filePath}:`);
            issues.forEach(issue => {
                console.log(`  Line ${issue.line}: [${issue.type}] ${issue.content}`);
                if (issue.variable) console.log(`    Variable: ${issue.variable}`);
                if (issue.template) console.log(`    Template: ${issue.template}`);
            });
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

console.log('🔧 Deep searching for empty key patterns...\n');

// Search in all TSX files that could be causing issues
try {
    const result = execSync('find /Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src -name "*.tsx" | head -30', { encoding: 'utf8' });
    const files = result.trim().split('\n').filter(file => file.length > 0);
    
    let totalIssues = 0;
    files.forEach(file => {
        if (deepSearchForEmptyKeys(file.trim())) {
            totalIssues++;
        }
    });
    
    console.log(`\n📊 Summary: Found potential issues in ${totalIssues} files`);
    
    if (totalIssues > 0) {
        console.log('\n⚠️  These patterns could generate empty keys!');
        console.log('💡 Fix them by adding || "fallback" to the key expressions');
    }
    
} catch (error) {
    console.error('Error finding files:', error.message);
}
