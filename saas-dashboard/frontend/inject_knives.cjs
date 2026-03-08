const fs = require('fs');

const code = fs.readFileSync('d:\\\\ورشة يحيى\\\\saas-dashboard\\\\frontend\\\\src\\\\i18n.js', 'utf8');

const enKnives = {
    workshop: "Knife Workshop",
    overviewDesc: "Track every knife from design to sale",
    cards: "Knife Cards",
    library: "Knife Library",
    totalKnives: "Total Knives",
    inProgress: "In Progress",
    completed: "Completed",
    sold: "Sold",
    searchBy: "Search by name or ID...",
    all: "All",
    stages: {
        design: "Design",
        inProduction: "In Production",
        heatTreatment: "Heat Treatment",
        grinding: "Grinding",
        handleInstallation: "Handle Install",
        finishing: "Finishing",
        sharpening: "Sharpening",
        completed: "Completed",
        sold: "Sold"
    },
    emptyTitle: "No knives yet. Create your first Knife Card!",
    newCard: "New Knife Card",
    editCard: "Edit Knife Card",
    basicInfo: "Basic Info",
    specs: "Specs & Materials",
    costPrice: "Cost & Price",
    fromTemplate: "From Library Template",
    startScratch: "— Start from scratch —",
    nameRequired: "Knife name is required",
    nameLabel: "Knife Name *",
    namePlaceholder: "e.g. Hunter's Companion",
    typeLabel: "Type",
    statusLabel: "Status",
    makerLabel: "Responsible Maker",
    unassigned: "— Unassigned —",
    startDateLabel: "Production Start",
    notesLabel: "Notes",
    notesPlaceholder: "Any special notes, customer requests...",
    steelLabel: "Steel Type",
    handleLabel: "Handle Material",
    selectPrompt: "— Select —",
    guardLabel: "Guard Material",
    guardPlaceholder: "Brass, Steel, None...",
    pinsLabel: "Pins / Rivets",
    pinsPlaceholder: "e.g. 2x Brass",
    bladeLengthLabel: "Blade Length (cm)",
    totalLengthLabel: "Total Length (cm)",
    weightLabel: "Weight (g)",
    hardnessLabel: "Hardness (HRC)",
    sheathLabel: "Leather Sheath Required",
    sheathMaterialPlaceholder: "Sheath material...",
    materialCost: "Material Cost (DZ)",
    laborCost: "Labor Cost (DZ)",
    otherCosts: "Other Costs (DZ)",
    otherCostsPlaceholder: "Packaging, finishing...",
    totalCost: "Total Production Cost",
    suggPrice: "Suggested Price (DZ)",
    margin: "Margin",
    profit: "{{amount}} DZ profit",
    cancel: "Cancel",
    save: "Save Knife",
    saving: "Saving...",
    advanceStage: "Advance Stage",
    edit: "Edit",
    blade: "blade",
    costDz: "cost DZ",
    priceDz: "price DZ",
    daySuffix: "d",
    libraryTitle: "Knife Library",
    libraryDesc: "Reusable knife model templates — create a new knife in seconds",
    addModel: "Add Model",
    editModel: "Edit Knife Model",
    emptyLibrary: "No knife models yet. Add your first template!",
    saveModel: "Save Model",
    createFromThis: "Create Knife from This",
    sheathIncluded: "Sheath included"
};

const arKnives = {
    workshop: "ورشة السكاكين",
    overviewDesc: "تتبع كل سكين من التصميم إلى البيع",
    cards: "بطاقات السكاكين",
    library: "مكتبة السكاكين",
    totalKnives: "إجمالي السكاكين",
    inProgress: "قيد التنفيذ",
    completed: "مكتمل",
    sold: "مباع",
    searchBy: "البحث بالاسم أو المعرف...",
    all: "الكل",
    stages: {
        design: "تصميم",
        inProduction: "قيد الإنتاج",
        heatTreatment: "معالجة حرارية",
        grinding: "طحن",
        handleInstallation: "تركيب المقبض",
        finishing: "تشطيب",
        sharpening: "شحذ",
        completed: "مكتمل",
        sold: "مباع"
    },
    emptyTitle: "لا توجد سكاكين بعد. قم بإنشاء أول بطاقة سكين لك!",
    newCard: "بطاقة سكين جديدة",
    editCard: "تعديل بطاقة السكين",
    basicInfo: "المعلومات الأساسية",
    specs: "المواصفات والمواد",
    costPrice: "التكلفة والسعر",
    fromTemplate: "من قالب المكتبة",
    startScratch: "— ابدأ من الصفر —",
    nameRequired: "اسم السكين مطلوب",
    nameLabel: "اسم السكين *",
    namePlaceholder: "مثل: رفيق الصياد",
    typeLabel: "النوع",
    statusLabel: "الحالة",
    makerLabel: "الصانع المسؤول",
    unassigned: "— غير معين —",
    startDateLabel: "بدء الإنتاج",
    notesLabel: "ملاحظات",
    notesPlaceholder: "أي ملاحظات خاصة، طلبات عملاء...",
    steelLabel: "نوع الفولاذ",
    handleLabel: "مادة المقبض",
    selectPrompt: "— تحديد —",
    guardLabel: "مادة الحرس",
    guardPlaceholder: "نحاس، صلب، لا شيء...",
    pinsLabel: "دبابيس / مسامير",
    pinsPlaceholder: "مثل: 2x نحاس",
    bladeLengthLabel: "طول الشفرة (سم)",
    totalLengthLabel: "الطول الكلي (سم)",
    weightLabel: "الوزن (غ)",
    hardnessLabel: "الصلابة (HRC)",
    sheathLabel: "مطلوب غمد جلدي",
    sheathMaterialPlaceholder: "مادة الغمد...",
    materialCost: "تكلفة المواد (دج)",
    laborCost: "تكلفة العمالة (دج)",
    otherCosts: "تكاليف أخرى (دج)",
    otherCostsPlaceholder: "تغليف، تشطيب...",
    totalCost: "إجمالي تكلفة الإنتاج",
    suggPrice: "السعر المقترح (دج)",
    margin: "الهامش",
    profit: "{{amount}} دج ربح",
    cancel: "إلغاء",
    save: "حفظ السكين",
    saving: "جاري الحفظ...",
    advanceStage: "تقديم المرحلة",
    edit: "تعديل",
    blade: "شفرة",
    costDz: "تكلفة دج",
    priceDz: "سعر دج",
    daySuffix: "ي",
    libraryTitle: "مكتبة السكاكين",
    libraryDesc: "قوالب نماذج سكاكين قابلة لإعادة الاستخدام — إنشاء سكين جديد في ثوان",
    addModel: "إضافة نموذج",
    editModel: "تعديل نموذج السكين",
    emptyLibrary: "لا توجد نماذج سكاكين بعد. أضف قالبك الأول!",
    saveModel: "حفظ النموذج",
    createFromThis: "إنشاء سكين من هذا",
    sheathIncluded: "شامل الغمد"
};

const startMarker = 'const resources = {';
const startIndex = code.indexOf(startMarker);

let braces = 0;
let endIndex = -1;
for (let i = startIndex + startMarker.length - 1; i < code.length; i++) {
    if (code[i] === '{') braces++;
    if (code[i] === '}') {
        braces--;
        if (braces === 0) {
            endIndex = i;
            break;
        }
    }
}

const objStr = code.substring(startIndex + 'const resources = '.length, endIndex + 1);
const before = code.substring(0, startIndex);
const after = code.substring(endIndex + 1);

const evaluated = eval(`(${objStr})`);

evaluated.en.translation.knives = enKnives;
evaluated.ar.translation.knives = arKnives;

const cleanObjStr = JSON.stringify(evaluated, null, 4).replace(/"([^"]+)":/g, '$1:');

const newCode = `${before}const resources = ${cleanObjStr};\n${after}`;

fs.writeFileSync('d:\\\\ورشة يحيى\\\\saas-dashboard\\\\frontend\\\\src\\\\i18n.js', newCode, 'utf8');
console.log("Successfully injected knives dictionary");
