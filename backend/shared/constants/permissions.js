/**
 * PERMISSION CATALOG — all permission strings used by requirePermission() middleware.
 *
 * Naming convention: "domain.action"
 * These strings must match what is stored in Role.permissions[] in the database.
 *
 * Usage:
 *   const { PERMS } = require('../shared/constants/permissions');
 *   router.post('/:id/settle', requirePermission(PERMS.FINANCE_SETTLE_COURIER), handler);
 */

const PERMS = {
    // ── Overview ────────────────────────────────────────────────────────────
    OVERVIEW_READ:          'overview.read',

    // ── Orders ──────────────────────────────────────────────────────────────
    ORDERS_VIEW:            'orders.view',
    ORDERS_CREATE:          'orders.create',
    ORDERS_EDIT:            'orders.edit',
    ORDERS_DELETE:          'orders.delete',
    ORDERS_RESTORE:         'orders.restore',
    ORDERS_PURGE:           'orders.purge',
    ORDERS_BULK:            'orders.bulk',
    ORDERS_EXPORT:          'orders.export',
    ORDERS_STATUS_CHANGE:   'orders.status.change',

    // ── Shipments ────────────────────────────────────────────────────────────
    SHIPMENTS_VIEW:         'shipments.view',
    SHIPMENTS_CREATE:       'shipments.create',
    SHIPMENTS_CANCEL:       'shipments.cancel',
    SHIPMENTS_EXPORT:       'shipments.export',

    // ── Customers ────────────────────────────────────────────────────────────
    CUSTOMERS_VIEW:         'customers.view',
    CUSTOMERS_EDIT:         'customers.edit',
    CUSTOMERS_RISK_VIEW:    'customers.risk.view',
    CUSTOMERS_BLACKLIST:    'customers.blacklist',

    // ── Finance ──────────────────────────────────────────────────────────────
    FINANCE_VIEW:               'finance.view',
    FINANCE_EXPORT:             'finance.export',
    FINANCE_SETTLE_COURIER:     'finance.settle.courier',
    FINANCE_PAYROLL_VIEW:       'finance.payroll.view',
    FINANCE_PAYROLL_APPROVE:    'finance.payroll.approve',

    // ── Couriers ─────────────────────────────────────────────────────────────
    COURIERS_VIEW:          'couriers.view',
    COURIERS_CREATE:        'couriers.create',
    COURIERS_EDIT:          'couriers.edit',
    COURIERS_API_CONNECT:   'couriers.api.connect',

    // ── Inventory ────────────────────────────────────────────────────────────
    INVENTORY_VIEW:         'inventory.view',
    INVENTORY_ADJUST:       'inventory.adjust',
    INVENTORY_REORDER:      'inventory.reorder',

    // ── HR ───────────────────────────────────────────────────────────────────
    HR_EMPLOYEES_VIEW:      'hr.employees.view',
    HR_EMPLOYEES_EDIT:      'hr.employees.edit',
    HR_PAYROLL_VIEW:        'hr.payroll.view',
    HR_PAYROLL_RUN:         'hr.payroll.run',
    HR_PAYROLL_APPROVE:     'hr.payroll.approve',

    // ── Analytics ────────────────────────────────────────────────────────────
    ANALYTICS_VIEW:             'analytics.view',
    ANALYTICS_FINANCIAL_VIEW:   'analytics.financial.view',

    // ── Intelligence ─────────────────────────────────────────────────────────
    INTELLIGENCE_VIEW:          'intelligence.view',

    // ── Call Center ──────────────────────────────────────────────────────────
    CALLCENTER_PROCESS:             'callcenter.process_orders',
    CALLCENTER_VIEW_REPORTS:        'callcenter.view_reports',
    CALLCENTER_MANAGE_ASSIGNMENTS:  'callcenter.manage_assignments',

    // ── Procurement ──────────────────────────────────────────────────────────
    PROCUREMENT_VIEW:           'procurement.read',
    PROCUREMENT_CREATE_PO:      'procurement.create_po',
    PROCUREMENT_UPDATE_PO:      'procurement.update_po',
    PROCUREMENT_RECEIVE:        'procurement.receive_goods',

    // ── Support ──────────────────────────────────────────────────────────────
    SUPPORT_VIEW:               'support.view',
    SUPPORT_EDIT:               'support.edit',

    // ── System ───────────────────────────────────────────────────────────────
    SYSTEM_ROLES:           'system.roles',
    SYSTEM_SETTINGS:        'system.settings',
    SYSTEM_USERS:           'system.users',
};

module.exports = { PERMS };
