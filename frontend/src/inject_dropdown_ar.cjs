const fs = require('fs');

let i18n = fs.readFileSync('i18n.js', 'utf8');

const arDropdown = `
            dropdown: {
                accountSettings: "إعدادات الحساب",
                myProfile: "ملفي الشخصي",
                profileDesc: "التفاصيل الشخصية",
                generalPref: "التفضيلات العامة",
                generalDesc: "اللغة والمنطقة الزمنية",
                security: "الأمان والوصول",
                securityDesc: "رموز المرور والمصادقة الثنائية",
                new: "جديد",
                orgRoles: "الأدوار والمؤسسة",
                activeSession: "جلسة نشطة",
                manageUsers: "إدارة المستخدمين",
                usersDesc: "الأدوار والصلاحيات",
                preferences: "التفضيلات",
                notifications: "إشعارات التنبيه",
                help: "المساعدة والمستندات",
                signOut: "تسجيل الخروج الآمن"
            },`;

if (!i18n.match(/ar:\s*\{\s*translation:\s*\{[\s\S]*?dropdown:/)) {
    i18n = i18n.replace(/ar:\s*\{\s*translation:\s*\{/, "ar: {\n        translation: {\n" + arDropdown);
    fs.writeFileSync('i18n.js', i18n, 'utf8');
    console.log("Injected dropdown Arabic translations successfully.");
} else {
    console.log("Arabic dropdown translations already exist.");
}
