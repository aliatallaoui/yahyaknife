const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.jsx') || file.endsWith('.js')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('d:/ورشة يحيى/saas-dashboard/frontend/src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Replace `$ ` followed by variable or literal
    // 1. JSX text instances like `> ${variant` -> `> DZD {variant`
    // but React interpolates `${variant}` as text? No, it's `>${variant}<` -> `>DZD {variant}<` (doesn't exist)
    // Actually, usually it's `Cost: $${` -> `Cost: DZD ${` or `>${...}`
    // Let's replace `$${` with `DZD ${`
    content = content.replace(/\$\$\{/g, 'DZD ${');
    // Replace `$${` with `DZD ${` in template literals like `${value}` inside strings
    content = content.replace(/`\$([^\{])/g, '`DZD $1'); // `$100` -> `DZD 100`
    content = content.replace(/\$\{([a-zA-Z0-9_\.]+)\}/g, (match, p1) => {
        // if preceded by $ -> already handled
        return match;
    });

    // Replace literal `$` before `{` if it's not preceded by another `$` (e.g. `> 100 $` but they put it before)
    // Let's replace `>${` -> we don't want to change `>${` because it's a JSX tag. Wait, `>${` is end of tag, then expression `{`. There is no `$` there.

    // Replace hardcoded `$ {` or `$XX`
    content = content.replace(/>\$/g, '>DZD '); // `>$100` -> `>DZD 100`
    content = content.replace(/ \$/g, ' DZD '); // ` $100` -> ` DZD 100`
    content = content.replace(/'\$'/g, "'DZD'"); // `'$'` -> `'DZD'`
    content = content.replace(/"\$"/g, '"DZD"'); // `"$"` -> `"DZD"`

    // Specific known usages from grep:
    content = content.replace(/\$\{order\.totalAmount/g, 'DZD ${order.totalAmount'); // Fix: <td>${order... -> <td>DZD ${order...
    content = content.replace(/\$\{ch\.value/g, 'DZD ${ch.value');
    content = content.replace(/\$\{proj\.spent/g, 'DZD ${proj.spent');
    content = content.replace(/\$\{proj\.budget/g, 'DZD ${proj.budget');
    content = content.replace(/\$\{mat\.costPerUnit/g, 'DZD ${mat.costPerUnit');
    content = content.replace(/\$\{bom\.totalEstimatedCost/g, 'DZD ${bom.totalEstimatedCost');
    content = content.replace(/\$\{variant\.price/g, 'DZD ${variant.price');
    content = content.replace(/\$\{variant\.cost/g, 'DZD ${variant.cost');
    content = content.replace(/\$\{material\.costPerUnit/g, 'DZD ${material.costPerUnit');
    content = content.replace(/\$\{tx\.amount/g, 'DZD ${tx.amount');

    // Remove any double DZD
    content = content.replace(/DZD DZD/g, 'DZD');

    // Fix the `\u003ctd\u003e${` which was `<td>${` in the UI but my regex above handles it.
    // Let's do a simple regex for `>${value}` where `value` is a variable used as a price.

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated: ' + file);
    }
});
