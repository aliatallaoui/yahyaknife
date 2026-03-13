const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Role = require('../models/Role');
const { PERMISSIONS, ALL_PERMISSIONS_FLAT } = require('../config/permissions');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

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
        permissions: ALL_PERMISSIONS_FLAT
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
            ...PERMISSIONS.inventory,
            ...PERMISSIONS.procurement,
            ...PERMISSIONS.analytics,
            ...PERMISSIONS.intelligence,
            ...PERMISSIONS.support,
            ...PERMISSIONS.callcenter,
            'finance.view',
            'hr.employees.view'
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
            ...PERMISSIONS.callcenter,
            ...PERMISSIONS.support,
            'analytics.view',
            'shipments.view',
            'inventory.view'
        ]
    },
    {
        name: 'Inventory Manager',
        description: 'Controls stock levels, warehouse transfers, and views supplier catalogs.',
        isSystemRole: true,
        permissions: [
            ...PERMISSIONS.overview,
            ...PERMISSIONS.inventory,
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
            'inventory.view'
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
            ...PERMISSIONS.finance,
            ...PERMISSIONS.analytics,
            ...PERMISSIONS.intelligence,
            'hr.employees.view', 'hr.payroll.view', 'hr.payroll.approve',
            'shipments.view',
            'inventory.view',
            'procurement.read',
            'orders.view',
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
            'orders.view',
            'couriers.view'
        ]
    },
    {
        name: 'Customer Support Agent',
        description: 'Manages support tickets and assists clients with orders and shipments.',
        isSystemRole: true,
        permissions: [
            'overview.read',
            'orders.view',
            'customers.view',
            'shipments.view',
            ...PERMISSIONS.support
        ]
    },
    {
        name: 'Call Center Agent',
        description: 'Processes orders via phone — confirm, cancel, postpone, and log call outcomes.',
        isSystemRole: true,
        permissions: [
            'overview.read',
            'orders.view', 'orders.create', 'orders.edit', 'orders.delete',
            'orders.restore', 'orders.bulk', 'orders.export',
            'orders.status.change',
            // NOTE: orders.purge excluded — agents cannot permanently delete orders
            'customers.view',
            'callcenter.process_orders'
        ]
    },
    {
        name: 'Call Center Manager',
        description: 'Manages call center agents — assigns orders, views team analytics, and sets daily targets.',
        isSystemRole: true,
        permissions: [
            'overview.read',
            'orders.view', 'orders.create', 'orders.edit', 'orders.delete',
            'orders.restore', 'orders.bulk', 'orders.export',
            'orders.status.change',
            // NOTE: orders.purge excluded
            'customers.view',
            'callcenter.process_orders',
            'callcenter.view_reports',
            'callcenter.manage_assignments',
            'analytics.view'
        ]
    },
    {
        name: 'Viewer / Read Only',
        description: 'System-wide read-only access for auditing.',
        isSystemRole: true,
        permissions: [
            'overview.read',
            'orders.view',
            'shipments.view',
            'finance.view',
            'customers.view',
            'couriers.view',
            'inventory.view',
            'hr.employees.view',
            'hr.payroll.view',
            'procurement.read',
            'analytics.view',
            'support.view'
        ]
    }
];

const seedRoles = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB. Seeding roles...');

        for (const roleDef of defaultRoles) {
            // Deduplicate permissions
            const uniquePerms = [...new Set(roleDef.permissions)];

            const role = await Role.findOneAndUpdate(
                { name: roleDef.name },
                {
                    $set: {
                        description: roleDef.description,
                        isSystemRole: roleDef.isSystemRole,
                        permissions: uniquePerms
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
