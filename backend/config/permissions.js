// backend/config/permissions.js
//
// SINGLE SOURCE OF TRUTH: derived from shared/constants/permissions.js
// The PERMS catalog is the canonical list of all active permission strings.
// This file provides the grouped PERMISSIONS object (for the role management UI catalog)
// and the flat ALL_PERMISSIONS_FLAT array (for validation).

const { PERMS } = require('../shared/constants/permissions');

// Group permissions by domain for the role management UI catalog
const PERMISSIONS = {
    overview: [PERMS.OVERVIEW_READ],
    orders: [
        PERMS.ORDERS_VIEW, PERMS.ORDERS_CREATE, PERMS.ORDERS_EDIT, PERMS.ORDERS_DELETE,
        PERMS.ORDERS_RESTORE, PERMS.ORDERS_PURGE, PERMS.ORDERS_BULK, PERMS.ORDERS_EXPORT,
        PERMS.ORDERS_STATUS_CHANGE
    ],
    shipments: [
        PERMS.SHIPMENTS_VIEW, PERMS.SHIPMENTS_CREATE, PERMS.SHIPMENTS_EDIT,
        PERMS.SHIPMENTS_CANCEL, PERMS.SHIPMENTS_EXPORT
    ],
    finance: [
        PERMS.FINANCE_VIEW, PERMS.FINANCE_EDIT, PERMS.FINANCE_EXPORT,
        PERMS.FINANCE_SETTLE_COURIER, PERMS.FINANCE_PAYROLL_VIEW, PERMS.FINANCE_PAYROLL_APPROVE
    ],
    couriers: [
        PERMS.COURIERS_VIEW, PERMS.COURIERS_CREATE, PERMS.COURIERS_EDIT, PERMS.COURIERS_DELETE, PERMS.COURIERS_API_CONNECT
    ],
    customers: [
        PERMS.CUSTOMERS_VIEW, PERMS.CUSTOMERS_EDIT, PERMS.CUSTOMERS_RISK_VIEW, PERMS.CUSTOMERS_BLACKLIST
    ],
    inventory: [
        PERMS.INVENTORY_VIEW, PERMS.INVENTORY_ADJUST, PERMS.INVENTORY_REORDER
    ],
    hr: [
        PERMS.HR_EMPLOYEES_VIEW, PERMS.HR_EMPLOYEES_EDIT,
        PERMS.HR_PAYROLL_VIEW, PERMS.HR_PAYROLL_RUN, PERMS.HR_PAYROLL_APPROVE
    ],
    users: [
        PERMS.SYSTEM_ROLES, PERMS.SYSTEM_SETTINGS, PERMS.SYSTEM_USERS
    ],
    callcenter: [
        PERMS.OVERVIEW_READ,
        PERMS.CALLCENTER_PROCESS, PERMS.CALLCENTER_VIEW_REPORTS, PERMS.CALLCENTER_MANAGE_ASSIGNMENTS
    ],
    analytics: [
        PERMS.ANALYTICS_VIEW, PERMS.ANALYTICS_FINANCIAL_VIEW
    ],
    intelligence: [
        PERMS.INTELLIGENCE_VIEW
    ],
    procurement: [
        PERMS.PROCUREMENT_VIEW, PERMS.PROCUREMENT_CREATE_PO,
        PERMS.PROCUREMENT_UPDATE_PO, PERMS.PROCUREMENT_RECEIVE
    ],
    support: [
        PERMS.SUPPORT_VIEW, PERMS.SUPPORT_EDIT
    ],
    saleschannels: [
        PERMS.SALES_CHANNELS_VIEW, PERMS.SALES_CHANNELS_CREATE, PERMS.SALES_CHANNELS_EDIT,
        PERMS.SALES_CHANNELS_DELETE, PERMS.SALES_CHANNELS_PUBLISH, PERMS.SALES_CHANNELS_ANALYTICS
    ],
    tenant: [
        PERMS.TENANT_VIEW, PERMS.TENANT_SETTINGS, PERMS.TENANT_INVITE,
        PERMS.TENANT_BILLING, PERMS.TENANT_DELETE
    ]
};

const ALL_PERMISSIONS_FLAT = [...new Set(Object.values(PERMISSIONS).flat())];

// Legacy → new permission mapping for existing roles in the database.
// Existing Role documents may still store old strings. The authMiddleware
// normalises them at runtime so route guards using PERMS constants match.
const LEGACY_PERMISSION_MAP = {
    'inventory.read':           PERMS.INVENTORY_VIEW,
    'inventory.write':          PERMS.INVENTORY_ADJUST,
    'warehouse.read':           PERMS.INVENTORY_VIEW,
    'warehouse.write':          PERMS.INVENTORY_ADJUST,
    'users.read':               PERMS.SYSTEM_USERS,
    'users.write':              PERMS.SYSTEM_USERS,
    'users.manage_permissions': PERMS.SYSTEM_ROLES,
    'users.deactivate':         PERMS.SYSTEM_USERS,
    'sales.read':               PERMS.ORDERS_VIEW,
    'sales.write':              PERMS.ORDERS_CREATE,
    'dispatch.read':            PERMS.SHIPMENTS_VIEW,
    'dispatch.write':           PERMS.SHIPMENTS_CREATE,
    'customer.read':            PERMS.CUSTOMERS_VIEW,
    'customer.write':           PERMS.CUSTOMERS_EDIT,
    'financial.read':           PERMS.FINANCE_VIEW,
    'financial.write':          PERMS.FINANCE_EDIT,
    'financial.export':         PERMS.FINANCE_EXPORT,
    'settings.read':            PERMS.SYSTEM_SETTINGS,
    'settings.write':           PERMS.SYSTEM_SETTINGS,
    'security.read':            PERMS.SYSTEM_SETTINGS,
    'security.write':           PERMS.SYSTEM_SETTINGS,
};

const validatePermissions = (permissionsArr) => {
    return permissionsArr.every(p => ALL_PERMISSIONS_FLAT.includes(p) || LEGACY_PERMISSION_MAP[p]);
};

module.exports = {
    PERMISSIONS,
    ALL_PERMISSIONS_FLAT,
    LEGACY_PERMISSION_MAP,
    validatePermissions
};
