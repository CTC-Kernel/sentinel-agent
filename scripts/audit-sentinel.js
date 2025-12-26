
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, '../src');

const RULES = [
    // -------------------------------------------------------------------------
    // 1. ARCHITECTURE RULES
    // -------------------------------------------------------------------------
    {
        id: 'arch-no-direct-firebase-views',
        human: 'Views MUST NOT import directly from firebase. Use Hooks/Services.',
        severity: 'critical',
        check: (content, filePath) => {
            if (!filePath.includes('/src/views/')) return null;
            // Match imports from 'firebase/*' or local '../firebase' references
            const regex = /import.*from\s+['"](firebase\/|(\.\.\/)*firebase)['"]/g;
            if (content.match(regex)) {
                return { line: 0, match: 'Direct Firebase Import detected in View' };
            }
            return null;
        }
    },

    // -------------------------------------------------------------------------
    // 2. LOGIC & ERROR HANDLING
    // -------------------------------------------------------------------------
    {
        id: 'logic-catch-error-handling',
        human: 'Catch blocks MUST use ErrorLogger or toast.',
        severity: 'error',
        check: (content, filePath) => {
            // Simple heuristic: catch (e) { ... }
            // We look for catch blocks that don't contain ErrorLogger or toast inside them.
            // This is hard with regex, so we'll do a primitive scan.
            const lines = content.split('\n');
            const errors = [];

            // Check lines with 'catch'
            lines.forEach((line, i) => {
                if (line.match(/catch\s*\(/)) {
                    // Look ahead a few lines (simple heuristic)
                    let context = line;
                    for (let j = 1; j < 5; j++) {
                        if (lines[i + j]) context += lines[i + j];
                    }
                    if (!context.includes('ErrorLogger') && !context.includes('toast') && !context.includes('reportError')) {
                        errors.push({ line: i, match: 'Empty or Unlogged Catch Block (No ErrorLogger/Toast found)' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'no-console-log',
        human: 'Use ErrorLogger instead of console.log',
        severity: 'warning',
        regex: /console\.log\(/g
    },


    // -------------------------------------------------------------------------
    // 3. UI/UX "MASTERPIECE"
    // -------------------------------------------------------------------------
    {
        id: 'ui-interactive-hover',
        human: 'Interactive elements MUST have a hover: state.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const lines = content.split('\n');
            const errors = [];
            lines.forEach((line, i) => {
                // If it has onClick, it should probably have hover: (unless it's a component like Button which might handle it internally, but we Audit for raw HTML too)
                if (line.match(/onClick=/) && line.match(/className=/) && !line.includes('hover:')) {
                    // Ignore common components that might have internal styles
                    if (!line.includes('<Button') && !line.includes('<IconButton')) {
                        errors.push({ line: i, match: 'Interactive element (onClick) missing hover: state' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    },
    {
        id: 'no-hex-colors',
        human: 'Use Tailwind classes instead of hardcoded Hex colors',
        severity: 'error',
        regex: /className=['"`].*#[0-9a-fA-F]{3,6}.*['"`]/g
    },
    {
        id: 'missing-aria-label',
        human: 'Interactive element missing aria-label or title',
        severity: 'info',
        check: (content, filePath) => {
            if (!filePath.endsWith('.tsx')) return null;
            const errors = [];

            // Regex to find start of button/input/a tags
            const tagRegex = /<(button|input|a)\b/g;
            let match;
            while ((match = tagRegex.exec(content)) !== null) {
                const startIndex = match.index;
                const tagName = match[1];

                if (filePath.includes('Onboarding.tsx')) {
                    console.log(`DEBUG: Onboarding match at ${startIndex}: ${match[0]}`);
                    console.log(`DEBUG: Snippet: ${content.substring(startIndex, startIndex + 50)}`);
                }

                // Extract context: from start of tag, look forward until we find a closing `>` 
                // that is NOT part of an arrow function `=>` or inside a string.
                // This is complex, so we'll use a heuristic: scan next 2000 chars.
                const buffer = content.slice(startIndex, startIndex + 2000);

                // We want to find the end of the opening tag.
                // We count braces/parens to ensure we don't stop inside a prop expression.
                let depth = 0;
                let inString = null; // ' or " or `
                let tagEndIndex = -1;

                for (let i = tagName.length + 1; i < buffer.length; i++) {
                    const char = buffer[i];
                    const prev = buffer[i - 1];

                    if (inString) {
                        if (char === inString && prev !== '\\') inString = null;
                        continue;
                    }

                    if (char === "'" || char === '"' || char === '`') {
                        inString = char;
                        continue;
                    }

                    if (char === '{') depth++;
                    else if (char === '}') depth--;
                    else if (char === '>' && depth === 0) {
                        tagEndIndex = i;
                        break;
                    }
                }

                if (tagEndIndex === -1) continue; // Could not find end, skip

                const tagContent = buffer.slice(0, tagEndIndex + 1);

                // Now check attributes in tagContent
                const hasAriaLabel = /aria-label=/.test(tagContent);
                const hasTitle = /title=/.test(tagContent);

                // We assume if it has neither, it's a violation. 
                // (Ignoring 'children' prop check as it's rare on these tags, and text content usually implies accessible name but explicit label is better for icons).

                if (!hasAriaLabel && !hasTitle) {
                    // Extract line number
                    const linesBefore = content.slice(0, startIndex).split('\n');
                    const lineNo = linesBefore.length - 1;

                    // Snippet for report
                    const snippet = tagContent.replace(/\s+/g, ' ').slice(0, 80) + '...';

                    errors.push({
                        line: lineNo,
                        match: `Interactive element missing aria-label or title\n    Code: ${snippet}`
                    });
                }
            }
            return errors.length ? errors : null;
        }
    },
    {
        id: 'check-z-index',
        human: 'Arbitrary z-index found. Verify against z-max/standard.',
        regex: /z-\[\d+\]/g,
        severity: 'info'
    },


    // -------------------------------------------------------------------------
    // 4. REACT BEST PRACTICES
    // -------------------------------------------------------------------------
    {
        id: 'react-no-index-key',
        human: 'Do not use array index as key.',
        severity: 'error',
        regex: /key=\{[a-zA-Z]*i(ndex)?\}/g
    },
    {
        id: 'no-any-type',
        human: 'Avoid explicit "any" type',
        regex: /: any/g,
        severity: 'warning'
    },



    // -------------------------------------------------------------------------
    // 5. WORKFLOW INTEGRITY
    // -------------------------------------------------------------------------
    {
        id: 'workflow-loading-state',
        human: 'Data fetching components MUST handle loading state.',
        severity: 'warning',
        check: (content, filePath) => {
            if (!filePath.includes('/src/views/')) return null;
            // If we use useFirestoreCollection, we should see 'loading' usage
            if (content.includes('useFirestoreCollection') && !content.includes('loading')) {
                return { line: 0, match: 'useFirestoreCollection used but Loading state not handled' };
            }
            return null;
        }
    },

    // -------------------------------------------------------------------------
    // 6. SECURITY & ACL (RBAC)
    // -------------------------------------------------------------------------
    {
        id: 'rbac-guard-check',
        human: 'Sensitive actions (delete/update) MUST have permission guards.',
        severity: 'critical',
        check: (content, filePath) => {
            if (!filePath.includes('/src/views/')) return null;

            const lines = content.split('\n');
            // Heuristic A: Destructuring sensitive actions from a hook
            // const { deleteAsset, updateAsset } = useAssets();
            const hookActionRegex = /const\s+\{.*(delete|update|remove)[a-zA-Z0-9]*.*\}\s+=\s+use[a-zA-Z]+\(/;

            // Heuristic B: Checking for permission gates
            // hasPermission(user, ...) or isResourceOwner(...) or canDeleteResource(...)
            const hasGuard = content.includes('hasPermission') ||
                content.includes('isResourceOwner') ||
                content.includes('canDelete') ||
                content.includes('canEdit') ||
                content.includes('isAdmin');

            if (content.match(hookActionRegex) && !hasGuard) {
                return { line: 0, match: 'View uses sensitive actions (delete/update) but NO visible permission guard found.' };
            }
            return null;
        }
    },
    {
        id: 'security-risk-check',
        human: 'Avoid dangerous patterns (innerHTML, eval).',
        severity: 'critical',
        regex: /dangerouslySetInnerHTML|eval\(/g
    },

    // -------------------------------------------------------------------------
    // 7. PERFORMANCE
    // -------------------------------------------------------------------------
    {
        id: 'perf-render-check',
        human: 'Avoid missing dependency arrays in useEffect.',
        severity: 'warning',
        regex: /useEffect\(\(\)\s*=>\s*\{.*\}\)\s*;/g // Very naive check for no dependency array
    }
];

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file.match(/\.tsx?$/)) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });

    return arrayOfFiles;
}

function audit() {
    console.log('🛡️  Starting Sentinel Global Audit V2 (Ultimate Edition)...\n');
    const files = getAllFiles(SRC_DIR);
    let violations = 0;

    // Summary counters
    const summary = {};
    RULES.forEach(r => summary[r.id] = 0);

    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(process.cwd(), file);

        RULES.forEach(rule => {
            // Regex Check
            if (rule.regex) {
                rule.regex.lastIndex = 0;
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (line.match(rule.regex)) {
                        // filters
                        if (line.includes('// eslint-disable') || line.includes('// audit-ignore')) return;

                        console.log(`[${rule.severity.toUpperCase()}] ${relativePath}:${index + 1} - ${rule.human}`);
                        console.log(`    Code: ${line.trim().substring(0, 80)}...`);
                        violations++;
                        summary[rule.id]++;
                    }
                });
            }
            // Custom Logic Check
            else if (rule.check) {
                const result = rule.check(content, file);
                if (result) {
                    if (Array.isArray(result)) {
                        result.forEach(err => {
                            console.log(`[${rule.severity.toUpperCase()}] ${relativePath}:${err.line + 1} - ${rule.human}`);
                            console.log(`    Detail: ${err.match}`);
                            violations++;
                            summary[rule.id]++;
                        });
                    } else {
                        console.log(`[${rule.severity.toUpperCase()}] ${relativePath}:${result.line + 1} - ${rule.human}`);
                        console.log(`    Detail: ${result.match}`);
                        violations++;
                        summary[rule.id]++;
                    }
                }
            }
        });
    });

    console.log(`\nAudit Complete. Found ${violations} potential violations.`);
    console.table(summary);
}

audit();
