import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../src');

const METRICS = {
    fileSize: { limit: 400, name: 'Complex Files (>400 lines)' },
    anyType: { pattern: /: any/g, name: 'Explicit "any" Usage' },
    consoleLog: { pattern: /console\.log\(/g, name: 'Leftover console.log' },
    hardcodedColors: { pattern: /text-\[#[0-9a-fA-F]{3,6}\]|bg-\[#[0-9a-fA-F]{3,6}\]|border-\[#[0-9a-fA-F]{3,6}\]/g, name: 'Hardcoded Hex Colors (Tailwind)' },
    todos: { pattern: /\/\/ TODO:|\/\/ FIXME:/g, name: 'TODO/FIXME Comments' },
    dangerouslySetInnerHTML: { pattern: /dangerouslySetInnerHTML/g, name: 'Dangerous HTML Injection' },
    inlineStyles: { pattern: /style=\{\{/g, name: 'Inline Styles' }
};

const IGNORE_DIRS = ['__tests__', 'assets', 'vite-env.d.ts'];

function scanDirectory(dir, results) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        if (IGNORE_DIRS.includes(file)) continue;

        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath, results);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            analyzeFile(fullPath, results);
        }
    }
}

function analyzeFile(filePath, results) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(ROOT_DIR, filePath);
    const lines = content.split('\n');

    // Metric 1: File Size
    if (lines.length > METRICS.fileSize.limit) {
        results.fileSize.push({ file: relativePath, value: lines.length });
    }

    // Regex Metrics
    for (const [key, metric] of Object.entries(METRICS)) {
        if (key === 'fileSize') continue;
        const matches = content.match(metric.pattern);
        if (matches) {
            results[key].push({ file: relativePath, count: matches.length });
        }
    }
}

function runAudit() {
    console.log('🔍 Starting Deep Exhaustive Audit on /src...\n');

    const results = {
        fileSize: [],
        anyType: [],
        consoleLog: [],
        hardcodedColors: [],
        todos: [],
        dangerouslySetInnerHTML: [],
        inlineStyles: []
    };

    scanDirectory(ROOT_DIR, results);

    console.log('--- AUDIT REPORT ---\n');

    // 1. Complexity
    console.log(`📦 ${METRICS.fileSize.name}`);
    results.fileSize.sort((a, b) => b.value - a.value).slice(0, 10).forEach(item => {
        console.log(`   - ${item.file}: ${item.value} lines`);
    });
    console.log(`   (Total: ${results.fileSize.length} files)\n`);

    // 2. Type Safety
    console.log(`🚨 ${METRICS.anyType.name}`);
    console.log(`   Total Occurrences: ${results.anyType.reduce((acc, curr) => acc + curr.count, 0)}`);
    results.anyType.sort((a, b) => b.count - a.count).slice(0, 5).forEach(item => {
        console.log(`   - ${item.file}: ${item.count}`);
    });
    console.log('');

    // 3. Design System
    console.log(`🎨 ${METRICS.hardcodedColors.name}`);
    results.hardcodedColors.slice(0, 10).forEach(item => {
        console.log(`   - ${item.file}: ${item.count} deviations`);
    });
    console.log('');

    // 4. Cleanliness
    console.log(`🧹 ${METRICS.consoleLog.name}`);
    console.log(`   Total Occurrences: ${results.consoleLog.reduce((acc, curr) => acc + curr.count, 0)}`);
    console.log('');

    console.log(`📝 ${METRICS.todos.name}`);
    results.todos.slice(0, 10).forEach(item => {
        console.log(`   - ${item.file}`);
    });
    console.log('');

    // 5. Security
    console.log(`🛡️ ${METRICS.dangerouslySetInnerHTML.name}`);
    results.dangerouslySetInnerHTML.forEach(item => {
        console.log(`   - [WARNING] ${item.file}`);
    });
    console.log('');
}

runAudit();
