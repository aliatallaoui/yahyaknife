const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const keys = new Set();
const regex = /t\(['"]hr\.([a-zA-Z0-9_]+)['"]\)/g;

walkDir('./frontend/src', (filePath) => {
    if (filePath.endsWith('.jsx')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        let match;
        while ((match = regex.exec(content)) !== null) {
            keys.add(match[1]);
        }
    }
});

const existingKeysStr = fs.readFileSync('./frontend/src/i18n.js', 'utf8');
// Find English block
const enBlockMatch = existingKeysStr.match(/en: \{[\s\S]+?hr:\s*\{([\s\S]+?)\}\s*\},?\s*ar:/i);
const hrBlock = enBlockMatch ? enBlockMatch[1] : '';

const missingKeys = [];
Array.from(keys).forEach(k => {
    if (!hrBlock.includes(k + ':')) {
        missingKeys.push(k);
    }
});

console.log('--- MISSING KEYS ---');
console.log(missingKeys.join('\n'));
