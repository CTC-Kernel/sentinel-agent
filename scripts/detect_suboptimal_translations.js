import fs from 'fs';
import path from 'path';

const I18N_PATH = path.resolve('src/i18n.ts');
const SRC_DIR = path.resolve('src');

// Regex to find keys in i18n.ts
function extractExistingKeys(i18nContent) {
    const keys = new Set();
    const stack = [];
    const indentStack = [];

    const lines = i18nContent.split('\n');
    let processing = false;

    for (const line of lines) {
        // Start processing inside "translation: {"
        if (line.includes('translation: {')) {
            processing = true;
            indentStack.push((line.match(/^\s*/) || [''])[0].length);
            continue;
        }

        if (!processing) continue;

        const trimmed = line.trim();
        // Loose check for end of blocks
        if (trimmed === '},' || trimmed === '}') {
            const currentIndent = (line.match(/^\s*/) || [''])[0].length;
            while (indentStack.length > 0 && currentIndent <= indentStack[indentStack.length - 1]) {
                indentStack.pop();
                stack.pop();
            }
            if (indentStack.length === 0) {
                processing = false;
            }
            continue;
        }

        // Detect object start: "key: {"
        const objectMatch = line.match(/^(\s*)(\w+):\s*\{/);
        if (objectMatch) {
            const indent = objectMatch[1].length;
            const key = objectMatch[2];

            while (indentStack.length > 0 && indent <= indentStack[indentStack.length - 1]) {
                indentStack.pop();
                stack.pop();
            }

            stack.push(key);
            indentStack.push(indent);
            continue;
        }

        // Detect leaf: "key: "value""
        const leafMatch = line.match(/^(\s*)(\w+):\s*["']|^(\s*)["'](\w+)["']:\s*["']/);
        if (leafMatch) {
            const indentStr = leafMatch[1] || leafMatch[3] || "";
            const indent = indentStr.length;
            const key = leafMatch[2] || leafMatch[4];

            while (indentStack.length > 0 && indent <= indentStack[indentStack.length - 1]) {
                indentStack.pop();
                stack.pop();
            }

            const fullKey = [...stack, key].join('.');
            keys.add(fullKey);
        }
    }

    return keys;
}

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });

    return arrayOfFiles;
}

async function findMissingKeys() {
    console.log('Reading i18n file...');
    const i18nContent = fs.readFileSync(I18N_PATH, 'utf-8');
    const existingKeys = extractExistingKeys(i18nContent);

    console.log(`Found ${existingKeys.size} existing keys.`);

    console.log('Scanning source files...');
    const files = getAllFiles(SRC_DIR);
    const missingKeys = new Set();
    const usedKeys = new Set();

    // Regex to find t('key') or t("key")
    const tRegex = /\bt\(['"]([\w.]+)['"]\)/g;

    for (const file of files) {
        if (file.includes('i18n.ts') || file.includes('.test.') || file.includes('setupTests')) continue;

        const content = fs.readFileSync(file, 'utf-8');
        let match;
        while ((match = tRegex.exec(content)) !== null) {
            const key = match[1];
            usedKeys.add(key);

            if (!existingKeys.has(key)) {
                missingKeys.add(key);
            }
        }
    }

    console.log(`Found ${missingKeys.size} missing keys.`);

    const sortedMissing = Array.from(missingKeys).sort();
    if (sortedMissing.length > 0) {
        console.log('Missing Keys:', JSON.stringify(sortedMissing, null, 2));
        fs.writeFileSync('missing_keys.json', JSON.stringify(sortedMissing, null, 2));
    } else {
        console.log('No missing keys found!');
    }
}

findMissingKeys();
