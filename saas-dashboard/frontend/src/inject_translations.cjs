const fs = require('fs');
const filePath = 'd:\\\\ورشة يحيى\\\\saas-dashboard\\\\frontend\\\\src\\\\i18n.js';

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Inject French dashboard translations
    const frDashboardInjection = `                actionRequired: "Action Required",
                cash_transit: "Espèces en Transit",
                couriers_pending: "Livreurs en Attente",
                volume: "Volume",
                activeProduction: "Actifs en Forge",
                completedThisMonth: "Terminés ce Mois",
                pendingCustom: "Commandes sur Mesure",
                valueInProduction: "Valeur en Forge"
            },`;

    // Locate the French dashboard block by looking for the translation structure before "settings: {"
    content = content.replace(
        /                actionRequired: "Action Required",\s+cash_transit: "Espèces en Transit",\s+couriers_pending: "Livreurs en Attente",\s+volume: "Volume"\s+},/g,
        frDashboardInjection
    );

    // Inject Arabic dashboard translations
    const arDashboardInjection = `                actionRequired: "إجراء مطلوب",
                cash_transit: "النقدية في الطريق",
                couriers_pending: "قيد التسوية مع المندوبين",
                volume: "الحجم",
                activeProduction: "نشط في الورشة",
                completedThisMonth: "أُنْتِجَ هذا الشهر",
                pendingCustom: "الطلبات الخاصة",
                valueInProduction: "قيمة المنتجات بالورشة"
            },`;

    content = content.replace(
        /                actionRequired: "إجراء مطلوب",\s+cash_transit: "النقدية في الطريق",\s+couriers_pending: "قيد التسوية مع المندوبين",\s+volume: "الحجم"\s+},/g,
        arDashboardInjection
    );

    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Translation injection complete.");
} catch (e) {
    console.error(e);
}
