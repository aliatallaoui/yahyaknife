import fs from 'fs';

const filePath = 'd:\\\\ورشة يحيى\\\\saas-dashboard\\\\frontend\\\\src\\\\i18n.js';

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Find the hr object inside ar.translation
    const startIndex1 = content.indexOf('            hr: {\r\n                title: "الموارد البشرية وفريق العمل"');
    const endIndex1 = content.indexOf('            widgets: {');
    const oldHrBlock = content.substring(startIndex1, endIndex1);

    // Find the hr object at the bottom
    const startIndex2 = content.lastIndexOf('        hr: {\r\n            "activeWorking":');
    const endIndex2 = content.lastIndexOf('\r\n    }\r\n};'); // End of ar
    const newHrBlock = content.substring(startIndex2, endIndex2);

    // Replace the old one with the new one, indented 4 more spaces, plus a comma
    let indentedNewHrBlock = newHrBlock.split('\\n').map(line => '    ' + line).join('\\n');
    indentedNewHrBlock += ',\\r\\n';

    // Replace the first occurrence
    content = content.replace(oldHrBlock, indentedNewHrBlock);

    // Remove the bottom occurrence.
    // The previous line was `            accessDenied: "الترخيص مرفوض"\r\n        },\r\n`
    // We want to remove from the comma before `hr: {` to the end of `hr: { ... }`
    const strToRemove = ',\\r\\n' + newHrBlock;
    content = content.replace(strToRemove, '');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log("SUCCESS");
} catch (e) {
    console.error(e);
}
