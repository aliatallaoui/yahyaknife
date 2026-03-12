const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Role = require('../models/Role');
const { PERMISSIONS, ALL_PERMISSIONS_FLAT } = require('../config/permissions');

dotenv.config({ path: '../.env' }); // Adjust if needed depending on running dir

const MONGO_URI = process.env.MONGO_URI || process.env.PROD_MONGO_URI || process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

const defaultRoles = [
    {
        name: 'Super Admin',
        description: 'Ultimate system control. Can access and modify all settings, security, and data.',
        isSystemRole: true,
        permissions: ALL_PERMISSIONS_FLAT
    },
    {
        name: 'Owner / Founder',
        description: 'Full business access across all modules.',
        isSystemRole: true,
        permissions: ALL_PERMISSIONS_FLAT.filter(p => !['security.force_logout'].includes(p))
    },
    {
        name: 'Operations Manager',
        description: 'Oversees day-to-day business operations across all departments except low-level HR payroll.',
        isSystemRole: true,
        permissions: [
            ...PERMISSIONS.overview,
            ...PERMISSIONS.orders,
            ...PERMISSIONS.shipments,
            ...PERMISSIONS.customers,
            ...PERMISSIONS.couriers,
            ...PERMISSIONS.sales_legacy,
            ...PERMISSIONS.inventory,
            ...PERMISSIONS.warehouse,
            ...PERMISSIONS.dispatch,
            ...PERMISSIONS.procurement,
            ...PERMISSIONS.customer_legacy,
            ...PERMISSIONS.analytics,
            ...PERMISSIONS.intelligence,
            ...PERMISSIONS.support,
            ...PERMISSIONS.callcenter,
            'financial.read', 'finance.view', // Read summaries only
            'hr.read', 'hr.employees.view' // Read basic HR but no payroll editing
        ]
    },
    {
        name: 'Sales Manager',
        description: 'Manages incoming orders, customer relationships, and views stock availability.',
        isSystemRole: true,
        permissions: [
            ...PERMISSIONS.overview,
            ...PERMISSIONS.orders,
            ...PERMISSIONS.customers,
            ...PERMISSIONS.sales_legacy,
            ...PERMISSIONS.customer_legacy,
            ...PERMISSIONS.callcenter,
            'analytics.view',
            'shipments.view',
            'inventory.read', 'inventory.view', // Can view stock but not edit or see cost
            'support.view', 'support.edit',     // Can manage escalated customer support
            'support.create_ticket', 'support.send_reply', 'support.update_status'
        ]
    },
    {
        name: 'Inventory Manager',
        description: 'Controls stock levels, warehouse transfers, and views supplier catalogs.',
        isSystemRole: true,
        permissions: [
            ...PERMISSIONS.overview,
            ...PERMISSIONS.inventory,
            ...PERMISSIONS.warehouse,
            'procurement.read'
        ]
    },
    {
        name: 'Procurement Manager',
        description: 'Manages supplier relationships, purchase orders, and goods receiving.',
        isSystemRole: true,
        permissions: [
            ...PERMISSIONS.overview,
            ...PERMISSIONS.procurement,
            'inventory.read', 'inventory.view_supplier_data'
        ]
    },
    {
        name: 'HR Manager',
        description: 'Manages everything related to employees, payroll, and attendance.',
        isSystemRole: true,
        permissions: [
            ...PERMISSIONS.overview,
            ...PERMISSIONS.hr
        ]
    },
    {
        name: 'Finance Manager',
        description: 'Handles accounting, payroll approvals, profitability, and cost visibility.',
        isSystemRole: true,
        permissions: [
            ...PERMISSIONS.overview,
            ...PERMISSIONS.financial,
            ...PERMISSIONS.finance,
            ...PERMISSIONS.analytics,
            ...PERMISSIONS.intelligence,
            'hr.read', 'hr.view_salary', 'hr.approve_payroll', 'hr.payroll.view', 'hr.payroll.approve',
            'dispatch.read', 'dispatch.view_courier_financials',
            'inventory.read', 'inventory.view_cost',
            'procurement.read',
            'sales.read', 'orders.view',
            'couriers.view'
        ]
    },
    {
        name: 'Dispatch / Logistics Operator',
        description: 'Generates shipping labels, requests returns, and manages physical dispatch.',
        isSystemRole: true,
        permissions: [
            ...PERMISSIONS.overview,
            ...PERMISSIONS.shipments,
            'dispatch.read', 'dispatch.create_shipment', 'dispatch.update_shipment',
            'dispatch.validate_shipment', 'dispatch.generate_label', 'dispatch.request_return',
            'sales.read', 'orders.view', 'couriers.view' // To see what needs shipping
        ]
    },
    {
        name: 'Customer Support Agent',
        description: 'Manages support tickets and assists clients with orders and shipments.',
        isSystemRole: true,
        permissions: [
            'overview.read',
            'orders.view', 'sales.read', 'sales.view_customer_details',
            'customers.view', 'customer.read',
            'shipments.view', 'dispatch.read', // to update clients on tracking
            'support.view', 'support.edit',    // access support desk
            'support.create_ticket', 'support.send_reply', 'support.update_status'
        ]
    },
    {
        name: 'Call Center Agent',
        description: 'Processes orders via phone — confirm, cancel, postpone, and log call outcomes.',
        isSystemRole: true,
        permissions: [
            'overview.read',
            'orders.view',
            'customers.view', 'customer.read',
            'callcenter.process_orders',
        ]
    },
    {
        name: 'Call Center Manager',
        description: 'Manages call center agents — assigns orders, views team analytics, and sets daily targets.',
        isSystemRole: true,
        permissions: [
            'overview.read',
            'orders.view', 'orders.edit',
            'customers.view', 'customer.read',
            'callcenter.process_orders',
            'callcenter.view_reports',
            'callcenter.manage_assignments',
            'analytics.view',
        ]
    },
    {
        name: 'Viewer / Read Only',
        description: 'System-wide read-only access for auditing.',
        isSystemRole: true,
        permissions: [
            'overview.read',
            'orders.view', 'shipments.view', 'finance.view', 'customers.view',
            'couriers.view', 'hr.employees.view', 'hr.payroll.view',
            'financial.read', 'sales.read', 'inventory.read',
            'warehouse.read', 'dispatch.read', 'procurement.read',
            'hr.read', 'customer.read',
            'analytics.view', 'support.view'
        ]
    }
];

const seedRoles = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB. Seeding roles...');

        for (const roleDef of defaultRoles) {
            // Upsert based on role name
            const role = await Role.findOneAndUpdate(
                { name: roleDef.name },
                {
                    $set: {
                        description: roleDef.description,
                        isSystemRole: roleDef.isSystemRole,
                        permissions: roleDef.permissions
                    }
                },
                { new: true, upsert: true }
            );
            console.log(`Seeded Role: ${role.name} (${role.permissions.length} permissions)`);
        }

        console.log('Role seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding roles:', error);
        process.exit(1);
    }
};

seedRoles();
