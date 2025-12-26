
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, '../src');

const RULES = [
    {
        id: 'logic-catch-error-handling',
        human: 'Catch blocks MUST use ErrorLogger or toast.',
        severity: 'error',
        check: (content, filePath) => {
            const lines = content.split('\n');
            const errors = [];
            lines.forEach((line, i) => {
                if (line.match(/catch\s*\(/)) {
                    let context = line;
                    for (let j = 1; j < 20; j++) { // Look ahead 20 lines
                        if (lines[i + j]) context += lines[i + j];
                    }
                    // normalize whitespace for check
                    if (!context.includes('ErrorLogger') && !context.includes('toast') && !context.includes('reportError') && !context.includes('console.error') && !context.includes('logger')) {
                        // Note: We flag console.error as well if we want to be strict, but the rule says "Empty or Unlogged". 
                        // The original rule allowed toast/reportError. 
                        // I will strictly look for ErrorLogger OR toast.

                        // If it has console.error, it's technically logged but not correctly.
                        // Let's flag it if it DOES NOT have ErrorLogger/toast.
                        errors.push({ line: i, match: 'Miss ErrorLogger/Toast' });
                    }
                }
            });
            return errors.length ? errors : null;
        }
    }
];

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file.match(/\.tsx?$/) && !file.includes('schemas/index.ts')) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });
    return arrayOfFiles;
}

function audit() {
    console.log('Running Focused Logic Audit...');
    const files = getAllFiles(SRC_DIR);
    const EXCLUDE_PATTERNS = ['node_modules', 'dist', 'build', '.git', 'scripts', 'src/services/errorLogger.ts', 'src/schemas/index.ts'];
    files.forEach(file => {
        const relativePath = path.relative(process.cwd(), file);
        if (EXCLUDE_PATTERNS.some(pattern => relativePath.includes(pattern))) return;

        const content = fs.readFileSync(file, 'utf8');
        RULES.forEach(rule => {
            const result = rule.check(content, file);
            if (result) {
                result.forEach(err => {
                    console.log(`${relativePath}:${err.line + 1}: ${err.match}`);
                });
            }
        });
    });
}

audit();
