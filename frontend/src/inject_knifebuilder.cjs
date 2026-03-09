const fs = require('fs');

let i18n = fs.readFileSync('i18n.js', 'utf8');

const enKnives = `
            knivesBuilder: {
                title: 'Custom Knife Builder',
                subtitle: 'Design bespoke blades and instantly generate production orders.',
                steps: {
                    profile: 'Blade Profile',
                    materials: 'Materials',
                    measurements: 'Measurements',
                    summary: 'Client Summary'
                },
                baseProfile: 'Base Profile',
                steelSelection: 'Steel Selection',
                handleMaterial: 'Handle Material',
                specifications: 'Specifications',
                bladeLength: 'Blade Length (cm)',
                totalLength: 'Total Length (cm)',
                sheath: 'Custom Leather Sheath',
                sheathEstimate: '+2500 DZD Estimated',
                specialNotes: 'Special Notes for the Forge',
                quoteSummary: 'Quote Summary',
                linkClient: 'Link Client',
                profile: 'Profile',
                steel: 'Steel',
                handle: 'Handle',
                yes: 'Yes',
                no: 'No',
                estimatedFinalPrice: 'Estimated Final Price',
                depositRequired: 'Deposit Required',
                selectClient: 'Select an existing client...',
                btnBack: 'Back',
                btnNext: 'Next Step',
                btnPlaceOrder: 'Place Custom Order',
                errSelectClient: 'Please select a client.',
                types: {
                    Hunter: 'Hunter', Chef: 'Chef', Tactical: 'Tactical', Damascus: 'Damascus', Cleaver: 'Cleaver', Utility: 'Utility', Custom: 'Custom'
                },
                steels: {
                    'D2': 'D2', '1095': '1095', 'O1': 'O1', 'AEB-L': 'AEB-L', 'Damascus': 'Damascus', 'S30V': 'S30V', 'VG-10': 'VG-10', 'Other': 'Other'
                },
                handles: {
                    Walnut: 'Walnut', Rosewood: 'Rosewood', 'Olive Wood': 'Olive Wood', G10: 'G10', Micarta: 'Micarta', 'Carbon Fiber': 'Carbon Fiber', Bone: 'Bone', 'Stabilized Wood': 'Stabilized Wood', Other: 'Other'
                }
            },`;

const arKnives = `
        knivesBuilder: {
            title: 'صانع السكاكين المخصصة',
            subtitle: 'تصميم شفرات مخصصة وإنشاء طلبات الإنتاج فوراً.',
            steps: {
                profile: 'شكل النصل',
                materials: 'المواد',
                measurements: 'القياسات',
                summary: 'ملخص العميل'
            },
            baseProfile: 'الشكل الأساسي',
            steelSelection: 'اختيار الفولاذ',
            handleMaterial: 'مادة المقبض',
            specifications: 'المواصفات',
            bladeLength: 'طول النصل (سم)',
            totalLength: 'الطول الإجمالي (سم)',
            sheath: 'غمد جلدي مخصص',
            sheathEstimate: '+2500 د.ج قيمة تقديرية',
            specialNotes: 'ملاحظات خاصة للورشة',
            quoteSummary: 'ملخص التسعير',
            linkClient: 'ربط العميل',
            profile: 'الشكل',
            steel: 'الفولاذ',
            handle: 'المقبض',
            yes: 'نعم',
            no: 'لا',
            estimatedFinalPrice: 'السعر النهائي التقديري',
            depositRequired: 'العربون المطلوب',
            selectClient: 'اختر عميلاً حالياً...',
            btnBack: 'رجوع',
            btnNext: 'الخطوة التالية',
            btnPlaceOrder: 'تأكيد الطلب المخصص',
            errSelectClient: 'يرجى اختيار عميل.',
            types: {
                Hunter: 'صيد', Chef: 'طاهي', Tactical: 'تكتيكي', Damascus: 'دمشقي', Cleaver: 'ساطور', Utility: 'متعدد الاستخدام', Custom: 'مخصص'
            },
            steels: {
                'D2': 'D2', '1095': '1095', 'O1': 'O1', 'AEB-L': 'AEB-L', 'Damascus': 'دمشقي', 'S30V': 'S30V', 'VG-10': 'VG-10', 'Other': 'أخرى'
            },
            handles: {
                Walnut: 'جوز', Rosewood: 'خشب الورد', 'Olive Wood': 'خشب الزيتون', G10: 'G10', Micarta: 'ميكارتا', 'Carbon Fiber': 'ألياف الكربون', Bone: 'عظم', 'Stabilized Wood': 'خشب معالج', Other: 'أخرى'
            }
        },`;

if (!i18n.includes('knivesBuilder: {')) {
    i18n = i18n.replace(/en:\s*\{\s*translation:\s*\{/, "en: {\n        translation: {" + enKnives);
    i18n = i18n.replace(/ar:\s*\{\s*translation:\s*\{/, "ar: {\n        translation: {\n" + arKnives);
    fs.writeFileSync('i18n.js', i18n, 'utf8');
    console.log("Injected knivesBuilder translations successfully.");
} else {
    console.log("Already has knivesBuilder translations. Overwriting...");
    const regexEn = /knivesBuilder:\s*\{[\s\S]*?\},/;
    i18n = i18n.replace(regexEn, enKnives + '\n');
    fs.writeFileSync('i18n.js', i18n, 'utf8');
    console.log("Re-injected.");
}
