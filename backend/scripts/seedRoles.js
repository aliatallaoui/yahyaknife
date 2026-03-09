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
            ...PERMISSIONS.sales,
            ...PERMISSIONS.inventory,
            ...PERMISSIONS.warehouse,
            ...PERMISSIONS.dispatch,
            ...PERMISSIONS.procurement,
            ...PERMISSIONS.manufacturing,
            ...PERMISSIONS.customer,
            ...PERMISSIONS.projects,
            'financial.read', // Read summaries only
            'hr.read' // Read basic HR but no payroll editing
        ]
    },
    {
        name: 'Sales Manager',
        description: 'Manages incoming orders, customer relationships, and views stock availability.',
        isSystemRole: true,
        permissions: [
            ...PERMISSIONS.overview,
            ...PERMISSIONS.sales,
            ...PERMISSIONS.customer,
            'inventory.read' // Can view stock but not edit or see cost
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
        name: 'Workshop Manager',
        description: 'Controls the manufacturing floor, BOMs, and production tracking.',
        isSystemRole: true,
        permissions: [
            ...PERMISSIONS.overview,
            ...PERMISSIONS.manufacturing,
            'inventory.read', 'warehouse.read',
            'hr.read' // To see worker productivity metrics
        ]
    },
    {
        name: 'Workshop Worker',
        description: 'Limited access to view assigned tasks and update production stages.',
        isSystemRole: true,
        permissions: [
            'overview.read',
            'manufacturing.read',
            'manufacturing.complete_stage'
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
            'hr.read', 'hr.view_salary', 'hr.approve_payroll',
            'dispatch.read', 'dispatch.view_courier_financials',
            'inventory.read', 'inventory.view_cost',
            'procurement.read',
            'sales.read'
        ]
    },
    {
        name: 'Dispatch / Logistics Operator',
        description: 'Generates shipping labels, requests returns, and manages physical dispatch.',
        isSystemRole: true,
        permissions: [
            ...PERMISSIONS.overview,
            'dispatch.read', 'dispatch.create_shipment', 'dispatch.update_shipment',
            'dispatch.validate_shipment', 'dispatch.generate_label', 'dispatch.request_return',
            'sales.read' // To see what needs shipping
        ]
    },
    {
        name: 'Customer Support Agent',
        description: 'Read-only access to sales and customers to assist clients.',
        isSystemRole: true,
        permissions: [
            'overview.read',
            'sales.read', 'sales.view_customer_details',
            'customer.read',
            'dispatch.read' // to update clients on tracking
        ]
    },
    {
        name: 'Viewer / Read Only',
        description: 'System-wide read-only access for auditing.',
        isSystemRole: true,
        permissions: [
            'overview.read', 'financial.read', 'sales.read', 'inventory.read',
            'warehouse.read', 'dispatch.read', 'procurement.read', 'manufacturing.read',
            'hr.read', 'projects.read', 'customer.read'
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
