// backend/config/permissions.js

const PERMISSIONS = {
    overview: ['overview.read'],
    financial: [
        'financial.read', 'financial.view_costs', 'financial.export',
        'financial.manage_manual_transactions', 'financial.approve_reports'
    ],
    sales: [
        'sales.read', 'sales.create', 'sales.update', 'sales.cancel',
        'sales.delete', 'sales.export', 'sales.view_customer_details'
    ],
    inventory: [
        'inventory.read', 'inventory.create_product', 'inventory.update_product',
        'inventory.adjust_stock', 'inventory.view_cost', 'inventory.view_supplier_data', 'inventory.export'
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
    hr: [
        'hr.read', 'hr.create_employee', 'hr.update_employee', 'hr.manage_attendance',
        'hr.manage_payroll', 'hr.approve_payroll', 'hr.view_salary', 'hr.view_reports', 'hr.manage_rewards'
    ],
    projects: [
        'projects.read', 'projects.create', 'projects.update', 'projects.manage_tasks',
        'projects.manage_milestones', 'projects.export'
    ],
    customer: [
        'customer.read', 'customer.update', 'customer.view_risk', 'customer.export'
    ],
    users: [
        'users.read', 'users.create', 'users.update', 'users.deactivate',
        'users.assign_roles', 'users.manage_permissions', 'security.view_sessions', 'security.force_logout'
    ],
    settings: [
        'settings.read', 'settings.manage_profile', 'settings.manage_company',
        'settings.manage_integrations', 'settings.manage_courier_api', 'settings.manage_billing'
    ],
    callcenter: [
        'callcenter.process_orders', 'callcenter.view_reports', 'callcenter.manage_assignments'
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
