const fs = require('fs');

let i18n = fs.readFileSync('i18n.js', 'utf8');

const enCouriers = `
            couriers: {
                dashboardTitle: 'Delivery Analytics',
                dashboardSubtitle: 'Monitor fleet performance and ECOTRACK synchronization.',
                successRate: 'Delivery Success Rate',
                returnRate: 'Return Rate',
                avgTime: 'Avg Delivery Speed',
                pendingCash: 'Pending Courier Clearance',
                delivered_out_of: 'Delivered out of',
                total_lowercase: 'Total',
                packages_failed: 'Packages Failed / Returned',
                days: 'Days',
                from_verification: 'From Verification to Client Handshake',
                settled: 'Settled:',
                regional_success: 'Regional Success Distribution',
                successful: 'Successful',
                failed_return: 'Failed/Return',
                cod_pipeline: 'Live Form COD Pipeline',
                total_delivered_value: 'Total Delivered Package Value',
                pending_clearance: 'Pending Clearance',
                settled_to_bank: 'Settled to Bank',
                delivered_no_money: 'Delivered, No Money',
                loading: 'Loading Logistic Metrics...'
            },`;

const arCouriers = `
        couriers: {
            dashboardTitle: 'تحليلات التوصيل',
            dashboardSubtitle: 'مراقبة أداء الأسطول وتزامن ECOTRACK.',
            successRate: 'معدل نجاح التوصيل',
            returnRate: 'معدل الإرجاع',
            avgTime: 'متوسط سرعة التوصيل',
            pendingCash: 'المبالغ قيد التصفية',
            delivered_out_of: 'تم توصيلها من أصل',
            total_lowercase: 'إجمالي',
            packages_failed: 'طرود فاشلة / مرتجعة',
            days: 'أيام',
            from_verification: 'من التحقق حتى تسليم العميل',
            settled: 'مسواة:',
            regional_success: 'توزيع النجاح حسب الولاية',
            successful: 'ناجحة',
            failed_return: 'فاشلة / مرتجعة',
            cod_pipeline: 'خط التدفق المالي للدفع عند الاستلام',
            total_delivered_value: 'إجمالي قيمة الطرود المُسلمة',
            pending_clearance: 'قيد التصفية',
            settled_to_bank: 'مسواة في البنك',
            delivered_no_money: 'مُسلمة، بدون تحصيل',
            loading: 'جارِ تحميل مقاييس اللوجستيك...'
        },`;

if (!i18n.includes('couriers: {')) {
    i18n = i18n.replace(/en:\s*\{\s*translation:\s*\{/, "en: {\n        translation: {" + enCouriers);
    i18n = i18n.replace(/ar:\s*\{\s*translation:\s*\{/, "ar: {\n        translation: {\n" + arCouriers);
    fs.writeFileSync('i18n.js', i18n, 'utf8');
    console.log("Injected couriers translations successfully.");
} else {
    console.log("Already has couriers translations. Overwriting...");
    const regexEn = /couriers:\s*\{[\s\S]*?\},/;
    i18n = i18n.replace(regexEn, enCouriers + '\n');
    fs.writeFileSync('i18n.js', i18n, 'utf8');
    console.log("Re-injected.");
}
