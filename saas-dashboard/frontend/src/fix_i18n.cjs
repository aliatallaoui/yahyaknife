const fs = require('fs');
const filePath = 'd:\\\\ورشة يحيى\\\\saas-dashboard\\\\frontend\\\\src\\\\i18n.js';

try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\\n');

    // Find ar.translation.hr around line 2658
    let targetStart = -1;
    let targetEnd = -1;
    for (let i = 2600; i < 2800; i++) {
        if (lines[i] && lines[i].trim() === 'hr: {') {
            targetStart = i;
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j] && lines[j].trim() === '},') {
                    // Check if the next line is widgets: {
                    if (lines[j + 1] && lines[j + 1].includes('widgets: {')) {
                        targetEnd = j;
                        break;
                    }
                }
            }
            break;
        }
    }

    // Find ar.hr around line 3070
    let sourceStart = -1;
    let sourceEnd = -1;
    for (let i = 3000; i < lines.length; i++) {
        if (lines[i] && lines[i].trim() === 'hr: {') {
            sourceStart = i;
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j] && lines[j].trim() === '}') {
                    // Check if it's the end of hr block before end of ar block
                    if (lines[j + 1] && lines[j + 1].trim() === '}') {
                        sourceEnd = j;
                        break;
                    }
                }
            }
            break;
        }
    }

    console.log("Target:", targetStart, "to", targetEnd);
    console.log("Source:", sourceStart, "to", sourceEnd);

    if (targetStart !== -1 && targetEnd !== -1 && sourceStart !== -1 && sourceEnd !== -1) {
        // Extract source
        let sourceLines = lines.slice(sourceStart, sourceEnd + 1);

        // Fix indentation of sourceLines (from 8 spaces to 12 spaces for the 'hr: {' and 16 for contents)
        // Actually, sourceStart has '        hr: {' (8 spaces). targetStart has '            hr: {' (12 spaces).
        // Let's just add 4 spaces to every line in sourceLines.
        sourceLines = sourceLines.map(line => '    ' + line);

        // Add trailing comma to the last line of sourceLines since it's going inside translation: {}
        sourceLines[sourceLines.length - 1] = sourceLines[sourceLines.length - 1] + ',';

        // Remove source from original lines (bottom to top to avoid shifting indices for the replacement below)
        lines.splice(sourceStart, sourceEnd - sourceStart + 1);

        // Fix trailing comma of the line before sourceStart
        let preSourceLine = lines[sourceStart - 1];
        if (preSourceLine && preSourceLine.trim() === '},') {
            lines[sourceStart - 1] = preSourceLine.replace('},', '}');
        }

        // Replace target with sourceLines
        lines.splice(targetStart, targetEnd - targetStart + 1, ...sourceLines);

        fs.writeFileSync(filePath, lines.join('\\n'), 'utf8');
        console.log("SUCCESS");
    } else {
        console.log("Checks failed. Not replacing.");
    }
} catch (e) {
    console.error(e);
}
