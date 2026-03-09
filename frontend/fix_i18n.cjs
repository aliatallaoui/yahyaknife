const fs = require('fs');
const code = fs.readFileSync('d:\\\\ورشة يحيى\\\\saas-dashboard\\\\frontend\\\\src\\\\i18n.js', 'utf8');

const startMarker = 'const resources = {';
const startIndex = code.indexOf(startMarker);
if (startIndex === -1) {
    console.error("Could not find start marker");
    process.exit(1);
}

// Find the end of the resources object
let braces = 0;
let endIndex = -1;
for (let i = startIndex + startMarker.length - 1; i < code.length; i++) {
    if (code[i] === '{') braces++;
    if (code[i] === '}') {
        braces--;
        if (braces === 0) {
            endIndex = i;
            break;
        }
    }
}

if (endIndex === -1) {
    console.error("Could not find end of object");
    process.exit(1);
}

const objStr = code.substring(startIndex + 'const resources = '.length, endIndex + 1);
const before = code.substring(0, startIndex);
const after = code.substring(endIndex + 1);

// eval the object string to let Node merge duplicate keys
const evaluated = eval(`(${objStr})`);

// serialize back removing duplicates
const cleanObjStr = JSON.stringify(evaluated, null, 4)
    // Restore unquoted keys for a more "JS" look (optional, but let's just leave it as JSON)
    .replace(/"([^"]+)":/g, '$1:');

const newCode = `${before}const resources = ${cleanObjStr}; // fixed\n${after}`;

fs.writeFileSync('d:\\\\ورشة يحيى\\\\saas-dashboard\\\\frontend\\\\src\\\\i18n.js', newCode, 'utf8');
console.log("Fixed duplicates");
