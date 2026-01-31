const fs = require('fs');
const path = require('path');
const fr = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'locales', 'fr', 'translation.json'), 'utf8'));
const de = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'locales', 'de', 'translation.json'), 'utf8'));

function leafPaths(obj, prefix) {
  prefix = prefix || '';
  var results = [];
  for (var key in obj) {
    var fullKey = prefix ? prefix + '.' + key : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      results = results.concat(leafPaths(obj[key], fullKey));
    } else {
      results.push(fullKey);
    }
  }
  return results;
}

var frPaths = leafPaths(fr);
var dePathsSet = new Set(leafPaths(de));
var missing = frPaths.filter(function(p) { return !dePathsSet.has(p); });

console.log('FR: ' + frPaths.length + ', DE: ' + dePathsSet.size + ', Missing: ' + missing.length);

var sections = {};
missing.forEach(function(p) {
  var s = p.split('.')[0];
  sections[s] = (sections[s] || 0) + 1;
});

Object.entries(sections).sort(function(a, b) { return b[1] - a[1]; }).forEach(function(entry) {
  console.log('  ' + entry[0] + ': ' + entry[1]);
});
