const fs = require('fs');
const path = require('path');
const filePath = 'd:\\\\ورشة يحيى\\\\saas-dashboard\\\\frontend\\\\src\\\\i18n.js';

try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\\r?\\n/);

    // Grab the block at the bottom
    const hrLatest = lines.slice(3070, 3249);

    // Remove the block at the bottom
    lines.splice(3070, 179);

    // Fix trailing comma at 3069 if exists
    if (lines[3069] && lines[3069].endsWith(',')) {
        lines[3069] = lines[3069].slice(0, -1);
    }

    // Replace the block at 2658 with the latest block
    lines.splice(2658, 140, ...hrLatest);

    fs.writeFileSync(filePath, lines.join('\\n'), 'utf8');
    console.log("SUCCESS");
} catch (e) {
    console.error(e);
}
