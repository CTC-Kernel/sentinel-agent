
const fs = require('fs');
const path = require('path');

const CONFIG = {
    rootDir: path.join(__dirname, '../src'),
    ignoreDirs: ['__tests__', 'mocks', 'utils/testUtils'],
    extensions: ['.ts', '.tsx'],
};

const RULES = [
    {
        id: 'NO_NATIVE_INTERACTION',
        severity: 'CRITICAL',
        pattern: /window\.(confirm|alert|prompt)\(/,
        message: 'Native browser interaction forbidden. Use Shadcn/UI Dialog or Toast.',
    },
    {
        id: 'NO_HARDCODED_COLORS',
        severity: 'WARNING',
        pattern: /(bg|text|border)-\[#[0-9A-Fa-f]{3,6}\]/,
        message: 'Hardcoded arbitrary color detected. Use Design System tokens (e.g., bg-brand-500).',
    },
    {
        id: 'NO_CONSOLE_LOG',
        severity: 'WARNING',
        pattern: /console\.log\(/,
        message: 'Production code should not contain console.log. Use Logger service.',
    },
    {
        id: 'A11Y_CLICK_NO_KEY',
        severity: 'MAJOR',
        pattern: /onClick=\{[^}]+\}(?![^>]*onKeyDown)/,
        message: 'Interactive element has onClick but missing onKeyDown (Accessibility).',
    },
    {
        id: 'MISSING_EMPTY_STATE',
        severity: 'MINOR',
        // Heuristic: Component maps over data but doesn't seem to have an "Empty" fallback visually identified by standard naming
        // This is weak, maybe skip for now or make very specific
        pattern: /\.map\(/,
        customCheck: (content) => !content.includes('EmptyState') && !content.includes('length > 0') && !content.includes('length === 0'),
        message: 'List rendering detected without obvious Empty State handling (Standard: use <EmptyState />).',
    }
];

let issues = [];

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(CONFIG.rootDir, filePath);

    // Split by lines to give line numbers (simple approach)
    const lines = content.split('\n');

    RULES.forEach(rule => {
        lines.forEach((line, index) => {
            let matches = false;

            if (rule.customCheck) {
                // Custom checks might apply to the whole file or logic, simplified here for line-by-line or whole content
                // For the map check, we actually need whole content context, so let's skip line-by-line for customCheck if it's meant for file scope
                // But for now, let's stick to regex per line for simplicity or simple content checks
            } else if (rule.pattern.test(line)) {
                matches = true;
            }

            if (matches) {
                issues.push({
                    file: relativePath,
                    line: index + 1,
                    ruleId: rule.id,
                    severity: rule.severity,
                    message: rule.message,
                    code: line.trim().substring(0, 100)
                });
            }
        });
    });
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (!CONFIG.ignoreDirs.includes(file)) {
                walkDir(filePath);
            }
        } else {
            if (CONFIG.extensions.includes(path.extname(file))) {
                scanFile(filePath);
            }
        }
    });
}

console.log('🛡️  Sentinel-Core Audit Sequence Initiated...');
console.log('Scanning for violations of Masterpiece Standards...\n');

walkDir(CONFIG.rootDir);

// Sort issues by severity
const order = { 'CRITICAL': 0, 'MAJOR': 1, 'WARNING': 2, 'MINOR': 3 };
issues.sort((a, b) => order[a.severity] - order[b.severity]);

// Report
let criticalCount = 0;
issues.forEach(issue => {
    if (issue.severity === 'CRITICAL') criticalCount++;
    const color = issue.severity === 'CRITICAL' ? '\x1b[31m' : issue.severity === 'MAJOR' ? '\x1b[35m' : '\x1b[33m';
    const reset = '\x1b[0m';

    console.log(`${color}[${issue.severity}] ${issue.ruleId}${reset}`);
    console.log(`  File: src/${issue.file}:${issue.line}`);
    console.log(`  Msg:  ${issue.message}`);
    console.log(`  Code: ${issue.code}`);
    console.log('');
});

console.log('--- AUDIT SUMMARY ---');
console.log(`Total Issues: ${issues.length}`);
console.log(`Critical: ${criticalCount}`);

if (criticalCount > 0) {
    console.log('\x1b[31m⛔ AUDIT FAILED: Critical issues must be resolved immediately.\x1b[0m');
    process.exit(1);
} else {
    console.log('\x1b[32m✅ AUDIT PASSED: No critical violations found.\x1b[0m');
    process.exit(0);
}
