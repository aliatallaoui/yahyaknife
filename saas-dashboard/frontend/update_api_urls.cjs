const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        if (file === 'node_modules' || file === 'dist') return;

        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(directoryPath);

let modifiedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Handle single/double quotes: fetch('/api/xxx') -> fetch(`${import.meta.env.VITE_API_URL || ''}/api/xxx`)
    content = content.replace(/fetch\(\s*['"](\/api\/.*?)['"]/g, "fetch(`${import.meta.env.VITE_API_URL || ''}$1`");

    // Handle existing template literals: fetch(`/api/xxx${id}`) -> fetch(`${import.meta.env.VITE_API_URL || ''}/api/xxx${id}`)
    content = content.replace(/fetch\(\s*`(\/api\/.*?)`/g, "fetch(`${import.meta.env.VITE_API_URL || ''}$1`");

    // Same for axios: axios.get('/api/xxx') -> axios.get(`${import.meta.env.VITE_API_URL || ''}/api/xxx`)
    content = content.replace(/axios\.(get|post|put|delete|patch)\(\s*['"](\/api\/.*?)['"]/g, "axios.$1(`${import.meta.env.VITE_API_URL || ''}$2`");

    content = content.replace(/axios\.(get|post|put|delete|patch)\(\s*`(\/api\/.*?)`/g, "axios.$1(`${import.meta.env.VITE_API_URL || ''}$2`");

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        modifiedCount++;
    }
});

console.log(`Updated ${modifiedCount} files to use VITE_API_URL safely.`);
