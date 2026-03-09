const fs = require('fs');

let i18n = fs.readFileSync('i18n.js', 'utf8');
i18n = i18n.replace(/settings:\s*\{\s*roles_title/g, 'rbac: {\n                roles_title');
fs.writeFileSync('i18n.js', i18n, 'utf8');

let settingsRoles = fs.readFileSync('pages/settings/SettingsRoles.jsx', 'utf8');
settingsRoles = settingsRoles.replace(/t\(['"]settings\.roles_/g, "t('rbac.roles_");
fs.writeFileSync('pages/settings/SettingsRoles.jsx', settingsRoles, 'utf8');

console.log('Fixup complete!');
