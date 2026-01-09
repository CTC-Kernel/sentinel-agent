const fs = require('fs');
const path = require('path');

const i18nPath = path.join(__dirname, '../src/i18n.ts');
let content = fs.readFileSync(i18nPath, 'utf8');

// Strip imports safely
content = content.replace(/^import .*[\r\n]+/gm, '');
content = content.replace(/^export .*[\r\n]+/gm, '');

// Mock dependencies
const LanguageDetector = {};
const initReactI18next = {};
const i18n = {
    use: () => i18n,
    init: (config) => {
        try {
            if (config.resources) {
                // EN
                if (config.resources.en) {
                    const enPath = path.join(__dirname, '../public/locales/en');
                    fs.mkdirSync(enPath, { recursive: true });
                    fs.writeFileSync(path.join(enPath, 'translation.json'), JSON.stringify(config.resources.en.translation, null, 2));
                    console.log('✅ EN extracted');
                }

                // FR
                if (config.resources.fr) {
                    const frPath = path.join(__dirname, '../public/locales/fr');
                    fs.mkdirSync(frPath, { recursive: true });
                    fs.writeFileSync(path.join(frPath, 'translation.json'), JSON.stringify(config.resources.fr.translation, null, 2));
                    console.log('✅ FR extracted');
                }
            }
        } catch (err) {
            console.error('Error writing files:', err);
        }
    }
};

// Simple TS stripping (remove "as unknown as string", types, etc if simplistic)
// For now, let's try eval. If syntax error, we refine.
try {
    eval(content);
} catch (e) {
    console.error("Eval failed:", e.message);
    // Fallback: try to manually extract the JSON object using regex if eval fails due to TS syntax
    // But let's hope it's clean enough JS
}
