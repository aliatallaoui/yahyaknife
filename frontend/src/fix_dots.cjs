const fs = require('fs');
let content = fs.readFileSync('i18n.js', 'utf8');
content = content.replace(/"(\w+)\.([a-z_]+)":/g, '"$1_$2":');
fs.writeFileSync('i18n.js', content, 'utf8');
