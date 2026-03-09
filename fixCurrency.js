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

    // Fix the accidentally broken template literals:
    // It replaced " $" with " DZD ". So " ${token}" became " DZD {token}".
    // Also ">$" became ">DZD ". So ">${value}" became ">DZD {value}".
    // Let's change "DZD {" back to "${" UNLESS it's a known financial variable, in which case it should be "DZD ${"

    // First, let's fix ALL "DZD {" to "${" for the interpolations.
    content = content.replace(/DZD \{/g, '${');
    content = content.replace(/DZD\{/g, '${');

    // Wait, now we have `> ${order.totalAmount}` instead of `> DZD ${order...`
    // Let's re-run the specific financial variables safely:
    // We want to prepend `DZD ` to these specific variables if they are used as prices.

    const financialVars = [
        'order.totalAmount',
        'ch.value',
        'proj.spent',
        'proj.budget',
        'mat.costPerUnit',
        'bom.totalEstimatedCost',
        'variant.price',
        'variant.cost',
        'material.costPerUnit',
        'tx.amount',
        'totalRevenue.toLocaleString()',
        'totalExpenses.toLocaleString()',
        'netProfit.toLocaleString()',
        'value / 1000',
        'value.toLocaleString()',
        '(metrics\\?\\.totalInventoryValue \\|\\| 0)\\.toLocaleString\\(undefined, \\{ maximumFractionDigits: 0 \\}\\)',
        '(performance\\?\\.totalSalesVolume \\|\\| 0)\\.toLocaleString\\(undefined, \\{ maximumFractionDigits: 0 \\}\\)',
        '(performance\\?\\.averageOrderValue \\|\\| 0)\\.toLocaleString\\(undefined, \\{ maximumFractionDigits: 0 \\}\\)'
    ];

    financialVars.forEach(v => {
        // e.g. replace `${order.totalAmount}` with `DZD ${order.totalAmount}`
        // Use a strict replace to avoid double DZD. We look for `${v}` and ensure it is not preceded by `DZD `
        // Actually, let's just replace `${v}` with `DZD ${v}` everywhere globally, then clean up double DZDs.
        const regex = new RegExp(`\\$\\{${v}\\}`, 'g');
        content = content.replace(regex, `DZD \${${v.replace(/\\/g, '')}}`);
    });

    // Clean up any double `DZD DZD` or `DZD  DZD`
    content = content.replace(/DZD\s+DZD/g, 'DZD');
    // Clean up >DZD DZD 
    content = content.replace(/>\s*DZD\s+DZD/g, '>DZD');

    // Also, if someone had `$${value}`, the previous script did `DZD ${value}`. We didn't break that one.
    // The issue was `/ \$/g`. So we fixed `DZD {` to `${`. 
    // And what about `>DZD ` followed by text? `>$100` -> `>DZD 100`. That's correct.

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed: ' + file);
    }
});
