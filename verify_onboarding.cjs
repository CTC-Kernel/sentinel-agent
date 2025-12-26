
const fs = require('fs');
const path = require('path');

const filePath = 'src/views/Onboarding.tsx';
const content = fs.readFileSync(filePath, 'utf8');

const errors = [];
const tagRegex = /<(button|input|a)\b/g;
let match;

console.log('Scanning ' + filePath);

while ((match = tagRegex.exec(content)) !== null) {
    const startIndex = match.index;
    const tagName = match[1];

    // Extract context: from start of tag, look forward until we find a closing `>` 
    // that is NOT part of an arrow function `=>` or inside a string.
    const buffer = content.slice(startIndex, startIndex + 2000);

    let depth = 0;
    let inString = null;
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

    if (tagEndIndex === -1) continue;

    const tagContent = buffer.slice(0, tagEndIndex + 1);
    const hasAriaLabel = /aria-label=/.test(tagContent);
    const hasTitle = /title=/.test(tagContent);

    // Get line number
    const linesUpToMatch = content.slice(0, startIndex).split('\n');
    const lineNumber = linesUpToMatch.length;

    if (!hasAriaLabel && !hasTitle) {
        console.error(`[VIOLATION] Line ${lineNumber}: <${tagName}> missing aria-label or title`);
        console.error(`Snippet: ${tagContent.replace(/\n/g, ' ')}\n`);
        errors.push(lineNumber);
    }
}

console.log(`Found ${errors.length} violations.`);
