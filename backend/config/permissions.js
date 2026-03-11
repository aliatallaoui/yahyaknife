// backend/config/permissions.js

const PERMISSIONS = {
    overview: ['overview.read'],
    // ── Orders (new RBAC strings used by route guards) ────────────────────────
    orders: [
        'orders.view', 'orders.create', 'orders.edit', 'orders.delete',
        'orders.restore', 'orders.purge', 'orders.bulk', 'orders.export',
        'orders.status.change'
    ],
    // ── Shipments ─────────────────────────────────────────────────────────────
    shipments: [
        'shipments.view', 'shipments.create', 'shipments.cancel', 'shipments.export'
    ],
    // ── Finance ───────────────────────────────────────────────────────────────
    finance: [
        'finance.view', 'finance.export', 'finance.settle.courier',
        'finance.payroll.view', 'finance.payroll.approve'
    ],
    // ── Couriers ──────────────────────────────────────────────────────────────
    couriers: [
        'couriers.view', 'couriers.create', 'couriers.edit', 'couriers.api.connect'
    ],
    // ── Customers ─────────────────────────────────────────────────────────────
    customers: [
        'customers.view', 'customers.edit', 'customers.risk.view', 'customers.blacklist'
    ],
    // ── Inventory ─────────────────────────────────────────────────────────────
    inventory: [
        'inventory.view', 'inventory.adjust', 'inventory.reorder',
        // legacy strings kept for existing roles
        'inventory.read', 'inventory.create_product', 'inventory.update_product',
        'inventory.adjust_stock', 'inventory.view_cost', 'inventory.view_supplier_data', 'inventory.export'
    ],
    // ── HR ────────────────────────────────────────────────────────────────────
    hr: [
        'hr.employees.view', 'hr.employees.edit',
        'hr.payroll.view', 'hr.payroll.run', 'hr.payroll.approve',
        // legacy strings kept for existing roles
        'hr.read', 'hr.create_employee', 'hr.update_employee', 'hr.manage_attendance',
        'hr.manage_payroll', 'hr.approve_payroll', 'hr.view_salary', 'hr.view_reports', 'hr.manage_rewards'
    ],
    // ── System / Users ────────────────────────────────────────────────────────
    users: [
        'system.roles', 'system.settings', 'system.users',
        // legacy strings kept for existing roles
        'users.read', 'users.create', 'users.update', 'users.deactivate',
        'users.assign_roles', 'users.manage_permissions', 'security.view_sessions', 'security.force_logout'
    ],
    // ── Call Center ───────────────────────────────────────────────────────────
    callcenter: [
        'overview.read',
        'callcenter.process_orders', 'callcenter.view_reports', 'callcenter.manage_assignments'
    ],
    // ── Legacy / other domains (unchanged) ───────────────────────────────────
    financial: [
        'financial.read', 'financial.view_costs', 'financial.export',
        'financial.manage_manual_transactions', 'financial.approve_reports'
    ],
    sales_legacy: [
        'sales.read', 'sales.create', 'sales.update', 'sales.cancel',
        'sales.delete', 'sales.export', 'sales.view_customer_details'
    ],
    warehouse: [
        'warehouse.read', 'warehouse.create', 'warehouse.update',
        'warehouse.transfer_stock', 'warehouse.view_ledger'
    ],
    dispatch: [
        'dispatch.read', 'dispatch.create_shipment', 'dispatch.update_shipment',
        'dispatch.validate_shipment', 'dispatch.generate_label', 'dispatch.request_return',
        'dispatch.view_courier_financials', 'dispatch.export'
    ],
    procurement: [
        'procurement.read', 'procurement.create_request', 'procurement.approve_request',
        'procurement.create_po', 'procurement.update_po', 'procurement.receive_goods',
        'procurement.view_supplier_metrics', 'procurement.export'
    ],
    manufacturing: [
        'manufacturing.read', 'manufacturing.manage_raw_materials', 'manufacturing.create_bom',
        'manufacturing.update_bom', 'manufacturing.create_production_order', 'manufacturing.start_production',
        'manufacturing.complete_stage', 'manufacturing.complete_production', 'manufacturing.view_costs'
    ],
    projects: [
        'projects.read', 'projects.create', 'projects.update', 'projects.manage_tasks',
        'projects.manage_milestones', 'projects.export'
    ],
    customer_legacy: [
        'customer.read', 'customer.update', 'customer.view_risk', 'customer.export'
    ],
    settings: [
        'settings.read', 'settings.manage_profile', 'settings.manage_company',
        'settings.manage_integrations', 'settings.manage_courier_api', 'settings.manage_billing'
    ]
};

const ALL_PERMISSIONS_FLAT = Object.values(PERMISSIONS).flat();

const validatePermissions = (permissionsArr) => {
    return permissionsArr.every(p => ALL_PERMISSIONS_FLAT.includes(p));
};

module.exports = {
    PERMISSIONS,
    ALL_PERMISSIONS_FLAT,
    validatePermissions
};
