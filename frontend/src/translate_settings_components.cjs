const fs = require('fs');

let users = fs.readFileSync('pages/settings/SettingsUsers.jsx', 'utf8');

users = users.replace(/<PageHeader\s*title="Identity & Access Management \(IAM\)"\s*subtitle="Control user roles and system security matrices\."/g, `<PageHeader
                title={t('iam.title', 'Identity & Access Management (IAM)')}
                subtitle={t('iam.subtitle', 'Control user roles and system security matrices.')}`);

users = users.replace(/Invite User \/ Provision/g, "{t('iam.invite', 'Invite User / Provision')}");
users = users.replace(/>Identity</g, ">{t('iam.colIdentity', 'Identity')}<");
users = users.replace(/>Assigned Role</g, ">{t('iam.colRole', 'Assigned Role')}<");
users = users.replace(/>Status</g, ">{t('iam.colStatus', 'Status')}<");
users = users.replace(/>Provisioned At</g, ">{t('iam.colAvailable', 'Provisioned At')}<");
users = users.replace(/>Manage</g, ">{t('iam.colManage', 'Manage')}<");
users = users.replace(/>\s*Edit\s*</g, "> {t('iam.btnEdit', 'Edit')} <");
users = users.replace(/'Active'/g, "t('iam.active', 'Active')");
users = users.replace(/'Inactive'/g, "t('iam.inactive', 'Inactive')");

// Also add useTranslation if missing
if (!users.includes('useTranslation')) {
    users = users.replace(/import React, { useState, useEffect } from 'react';/, "import React, { useState, useEffect } from 'react';\nimport { useTranslation } from 'react-i18next';");
    users = users.replace(/export default function SettingsUsers\(\) {/, "export default function SettingsUsers() {\n    const { t } = useTranslation();");
}

fs.writeFileSync('pages/settings/SettingsUsers.jsx', users, 'utf8');

// ---

let couriers = fs.readFileSync('pages/CourierSettings.jsx', 'utf8');

if (!couriers.includes('useTranslation')) {
    couriers = couriers.replace(/import React, { useState } from 'react';/, "import React, { useState } from 'react';\nimport { useTranslation } from 'react-i18next';");
    couriers = couriers.replace(/export default function CourierSettings\(\) {/, "export default function CourierSettings() {\n    const { t } = useTranslation();");
}

couriers = couriers.replace(/<h1 className="text-2xl font-bold text-gray-900">Courier Integration Settings<\/h1>/g, '<h1 className="text-2xl font-bold text-gray-900">{t(\'couriers.title\', \'Courier Integration Settings\')}</h1>');
couriers = couriers.replace(/ECOTRACK Integration/g, "{t('couriers.ecotrack', 'ECOTRACK Integration')}");
couriers = couriers.replace(/Configure your ECOTRACK API credentials to enable automated dispatch\./g, "{t('couriers.ecotrackSub', 'Configure your ECOTRACK API credentials to enable automated dispatch.')}");
couriers = couriers.replace(/API Gateway URL/g, "{t('couriers.gatewayUrl', 'API Gateway URL')}");
couriers = couriers.replace(/Ensure this points to the active V1 environment\./g, "{t('couriers.gatewaySub', 'Ensure this points to the active V1 environment.')}");
couriers = couriers.replace(/>Bearer Token</g, ">{t('couriers.bearerToken', 'Bearer Token')}<");
couriers = couriers.replace(/Your secret API token\. Keep this safe; it grants full access to create shipments\./g, "{t('couriers.bearerSub', 'Your secret API token. Keep this safe; it grants full access to create shipments.')}");
couriers = couriers.replace(/>\s*Save & Test Connection\s*</g, ">{t('couriers.saveTest', 'Save & Test Connection')}<");
couriers = couriers.replace(/>Live Status</g, ">{t('couriers.liveStatus', 'Live Status')}<");
couriers = couriers.replace(/IP or Account Restricted/g, "{t('couriers.ipRestricted', 'IP or Account Restricted')}");
couriers = couriers.replace(/API Rate Limits & Usage Tracker/g, "{t('couriers.rateLimits', 'API Rate Limits & Usage Tracker')}");
couriers = couriers.replace(/Daily Quota/g, "{t('couriers.dailyQuota', 'Daily Quota')}");
couriers = couriers.replace(/Requests Per Hour/g, "{t('couriers.reqHour', 'Requests Per Hour')}");
couriers = couriers.replace(/Requests Per Minute/g, "{t('couriers.reqMin', 'Requests Per Minute')}");
couriers = couriers.replace(/API usage counters automatically reset based on calendar time boundaries\. Bypassing limits will result in temporary suspension by the provider\./g, "{t('couriers.resetInfo', 'API usage counters automatically reset based on calendar time boundaries. Bypassing limits will result in temporary suspension by the provider.')}");

fs.writeFileSync('pages/CourierSettings.jsx', couriers, 'utf8');
console.log("Translated Courier Settings and SettingsUsers components.");
