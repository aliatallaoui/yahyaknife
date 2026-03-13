require('dotenv').config();
const mongoose = require('mongoose');

const Order = require('./models/Order');
const OrderItem = require('./models/OrderItem');
const OrderNote = require('./models/OrderNote');
const OrderStatusHistory = require('./models/OrderStatusHistory');
const Customer = require('./models/Customer');
const Shipment = require('./models/Shipment');
const Revenue = require('./models/Revenue');
const Expense = require('./models/Expense');
const Payroll = require('./models/Payroll');
const StockMovementLedger = require('./models/StockMovementLedger');
const InventoryLedger = require('./models/InventoryLedger');
const PurchaseOrder = require('./models/PurchaseOrder');
const DailyRollup = require('./models/DailyRollup');
const KPISnapshot = require('./models/KPISnapshot');
const WeeklyReport = require('./models/WeeklyReport');
const AuditLog = require('./models/AuditLog');
const CallNote = require('./models/CallNote');
const CourierSettlement = require('./models/CourierSettlement');
const ProductVariant = require('./models/ProductVariant');
const Courier = require('./models/Courier');

async function purgeAll() {
    try {
        console.log('Connecting to DB at ' + process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected globally!');

        console.log('Purging all operational collections...');
        const collections = [
            Order, OrderItem, OrderNote, OrderStatusHistory,
            Customer, Shipment, Revenue, Expense, Payroll,
            StockMovementLedger, InventoryLedger, PurchaseOrder,
            DailyRollup, KPISnapshot, WeeklyReport, AuditLog,
            CallNote, CourierSettlement
        ];

        for (const Model of collections) {
            if (Model) {
                const result = await Model.deleteMany({});
                console.log(`Cleared ${result.deletedCount} documents from ${Model.collection.name}`);
            }
        }

        console.log('Resetting structural metrics (Products & Couriers)...');
        await ProductVariant.updateMany({}, { totalStock: 0, reservedStock: 0, totalSold: 0 });
        await Courier.updateMany({}, { cashCollected: 0, cashSettled: 0, pendingRemittance: 0, totalDeliveries: 0, successRate: 0 });

        console.log('====================================================');
        console.log('✅ PRODUCTION PURGE COMPLETE!');
        console.log('✅ User acccounts, Roles, Tenants, Products, and Configs were KEPT.');
        console.log('✅ System is ready for Launch.');
        console.log('====================================================');
        
        process.exit(0);
    } catch (error) {
        console.error('Error during purge:', error);
        process.exit(1);
    }
}

purgeAll();
