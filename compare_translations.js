const fs = require('fs');
const path = require('path');

const fr = JSON.parse(fs.readFileSync('public/locales/fr/translation.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('public/locales/en/translation.json', 'utf8'));

function countKeys(obj) {
  let count = 0;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      count += countKeys(obj[key]);
    } else {
      count++;
    }
  }
  return count;
}

console.log('FR leaf keys:', countKeys(fr));
console.log('EN leaf keys:', countKeys(en));

// Find missing keys in EN (present in FR but not in EN)
function findMissing(frObj, enObj, prefix) {
  const missing = [];
  for (const key of Object.keys(frObj)) {
    const fullKey = prefix ? prefix + '.' + key : key;
    const frVal = frObj[key];
    const enVal = enObj ? enObj[key] : undefined;

    if (typeof frVal === 'object' && frVal !== null && !Array.isArray(frVal)) {
      if (enVal !== undefined && typeof enVal === 'object') {
        missing.push(...findMissing(frVal, enVal, fullKey));
      } else if (enVal === undefined) {
        // entire object missing in EN
        missing.push(...findMissing(frVal, undefined, fullKey));
      }
    } else {
      if (enVal === undefined) {
        missing.push({ key: fullKey, frValue: frVal });
      }
    }
  }
  return missing;
}

const missing = findMissing(fr, en, '');
console.log('\nMissing keys count:', missing.length);
console.log('\nMissing keys:');
missing.forEach(m => {
  console.log('  ' + m.key + ' = ' + JSON.stringify(m.frValue));
});
