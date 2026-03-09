const fs = require('fs');

let i18n = fs.readFileSync('i18n.js', 'utf8');

const arSettingsTab = `
                tabCouriers: "تكامل التوصيل",
                tabUsers: "المستخدمين والأدوار",
                tabRoles: "الأدوار والصلاحيات",
                couriers: {
                    title: "إعدادات تكامل التوصيل",
                    ecotrack: "تكامل ECOTRACK",
                    ecotrackSub: "قم بتكوين بيانات اعتماد API الخاصة بـ ECOTRACK لتمكين الإرسال التلقائي.",
                    gatewayUrl: "رابط البوابة (API Gateway URL)",
                    gatewayHost: "https://anderson-ecommerce.ecotrack.dz/",
                    gatewaySub: "تأكد من أن هذا يشير إلى بيئة V1 النشطة.",
                    bearerToken: "رمز التحقق (Bearer Token)",
                    bearerSub: "الرمز السري الخاص بك. حافظ عليه آمناً؛ فهو يمنح صلاحية كاملة لإنشاء الشحنات.",
                    saveTest: "حفظ واختبار الاتصال",
                    liveStatus: "Live Status",
                    ipRestricted: "تم تقييد الـ IP أو الحساب",
                    rateLimits: "تتبع الاستخدام وحدود API",
                    dailyQuota: "الحصة اليومية",
                    reqHour: "طلب في الساعة",
                    reqMin: "طلب في الدقيقة",
                    resetInfo: "يتم إعادة تعيين عدادات الاستخدام تلقائياً بناءً على الوقت. تجاوز الحدود سيؤدي إلى تعليق مؤقت من مزود الخدمة."
                },
                iam: {
                    title: "إدارة الهوية والوصول (IAM)",
                    subtitle: "تحكم في أدوار المستخدمين والمصفوفات الأمنية للنظام.",
                    invite: "دعوة مستخدم / توفير",
                    colIdentity: "الهوية",
                    colRole: "الدور المعين",
                    colStatus: "الحالة",
                    colAvailable: "تم توفيره في",
                    colManage: "إدارة",
                    btnEdit: "تعديل",
                    active: "نشط",
                    inactive: "غير نشط"
                },`;

const enSettingsTab = `
                tabCouriers: "Courier Integration",
                tabUsers: "Users & Roles",
                tabRoles: "Roles & Permissions",
                couriers: {
                    title: "Courier Integration Settings",
                    ecotrack: "ECOTRACK Integration",
                    ecotrackSub: "Configure your ECOTRACK API credentials to enable automated dispatch.",
                    gatewayUrl: "API Gateway URL",
                    gatewayHost: "https://anderson-ecommerce.ecotrack.dz/",
                    gatewaySub: "Ensure this points to the active V1 environment.",
                    bearerToken: "Bearer Token",
                    bearerSub: "Your secret API token. Keep this safe; it grants full access to create shipments.",
                    saveTest: "Save & Test Connection",
                    liveStatus: "Live Status",
                    ipRestricted: "IP or Account Restricted",
                    rateLimits: "API Rate Limits & Usage Tracker",
                    dailyQuota: "Daily Quota",
                    reqHour: "Requests Per Hour",
                    reqMin: "Requests Per Minute",
                    resetInfo: "API usage counters automatically reset based on calendar time boundaries. Bypassing limits will result in temporary suspension by the provider."
                },
                iam: {
                    title: "Identity & Access Management (IAM)",
                    subtitle: "Control user roles and system security matrices.",
                    invite: "Invite User / Provision",
                    colIdentity: "Identity",
                    colRole: "Assigned Role",
                    colStatus: "Status",
                    colAvailable: "Provisioned At",
                    colManage: "Manage",
                    btnEdit: "Edit",
                    active: "Active",
                    inactive: "Inactive"
                },`;


if (!i18n.includes('tabCouriers: "تكامل التوصيل",')) {
    // Replace inside arabic settings namespace
    const regexArSettings = /ar:\s*\{\s*translation:\s*\{\s*rbac:\s*\{[\s\S]*?\},/;
    i18n = i18n.replace(regexArSettings, match => match + arSettingsTab);

    // Replace inside english settings namespace
    const regexEnSettings = /en:\s*\{\s*translation:\s*\{\s*rbac:\s*\{[\s\S]*?\},/;
    i18n = i18n.replace(regexEnSettings, match => match + enSettingsTab);

    fs.writeFileSync('i18n.js', i18n, 'utf8');
    console.log("Injected Courier & IAM Arabic/English translation segments into i18n.");
} else {
    console.log("Already has translation segments.");
}
