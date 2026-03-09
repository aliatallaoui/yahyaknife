const mongoose = require('mongoose');
const dotenv = require('dotenv');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

// Models
const Employee = require('./models/Employee');
const KnifeModel = require('./models/KnifeModel');
const KnifeCard = require('./models/KnifeCard');
const RawMaterial = require('./models/RawMaterial');
const BillOfMaterial = require('./models/BillOfMaterial');
const ProductionOrder = require('./models/ProductionOrder');
const WorkerProductivity = require('./models/WorkerProductivity');
const WorkerReward = require('./models/WorkerReward');
const Customer = require('./models/Customer');
const CustomOrder = require('./models/CustomOrder');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DEV_MONGO_URI || process.env.PROD_MONGO_URI);
        console.log('MongoDB Connected for Seeding...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const seedBladesmithData = async () => {
    try {
        console.log('Clearing old bladesmith data...');
        // WARNING: This clears the collections! Only use for testing.
        await Employee.deleteMany({ department: 'Manufacturing' });
        await KnifeModel.deleteMany();
        await KnifeCard.deleteMany();
        await RawMaterial.deleteMany({ sku: { $in: ['STL-D2-001', 'STL-1095-001', 'HND-WAL-001', 'HND-G10-001', 'CNS-BLT-001'] } });
        await BillOfMaterial.deleteMany();
        await ProductionOrder.deleteMany();
        await WorkerProductivity.deleteMany();
        await WorkerReward.deleteMany();
        await CustomOrder.deleteMany();

        console.log('Seeding Employees...');
        const employees = await Employee.insertMany([
            {
                name: 'Yahya',
                email: 'yahya@bladesmith.local',
                department: 'Manufacturing',
                role: 'Master Blacksmith',
                workshopRole: 'Master Bladesmith',
                skills: ['Forging', 'Heat Treatment', 'Damascus Patterning'],
                productivityMultiplier: 1.5,
                salary: 150000,
                contractSettings: { monthlySalary: 150000, dailyRequiredMinutes: 480 }
            },
            {
                name: 'Tariq',
                email: 'tariq@bladesmith.local',
                department: 'Manufacturing',
                role: 'Grinding Specialist',
                workshopRole: 'Grinder',
                skills: ['Bevel Grinding', 'Satin Finish', 'Sharpening'],
                productivityMultiplier: 1.2,
                salary: 90000,
                contractSettings: { monthlySalary: 90000, dailyRequiredMinutes: 480 }
            },
            {
                name: 'Amine',
                email: 'amine@bladesmith.local',
                department: 'Manufacturing',
                role: 'Handle Maker',
                workshopRole: 'Handle Maker',
                skills: ['Wood Shaping', 'Resin Casting', 'Pinning'],
                productivityMultiplier: 1.1,
                salary: 85000,
                contractSettings: { monthlySalary: 85000, dailyRequiredMinutes: 480 }
            },
            {
                name: 'Karim',
                email: 'karim@bladesmith.local',
                department: 'Manufacturing',
                role: 'Apprentice',
                workshopRole: 'Apprentice',
                skills: ['Prep Work', 'Polishing', 'Sanding'],
                productivityMultiplier: 0.9,
                salary: 45000,
                contractSettings: { monthlySalary: 45000, dailyRequiredMinutes: 480 }
            }
        ]);

        console.log('Seeding Raw Materials...');
        const materials = await RawMaterial.insertMany([
            { sku: 'STL-D2-001', name: 'D2 Tool Steel Billet', category: 'Steel', unitOfMeasure: 'meters', costPerUnit: 5, stockLevel: 2000, minimumStock: 500 },
            { sku: 'STL-1095-001', name: '1095 High Carbon', category: 'Steel', unitOfMeasure: 'meters', costPerUnit: 3, stockLevel: 3000, minimumStock: 1000 },
            { sku: 'HND-WAL-001', name: 'Walnut Burl Block', category: 'Handle', unitOfMeasure: 'units', costPerUnit: 2500, stockLevel: 50, minimumStock: 10 },
            { sku: 'HND-G10-001', name: 'Black G10 Scale', category: 'Handle', unitOfMeasure: 'units', costPerUnit: 1500, stockLevel: 100, minimumStock: 20 },
            { sku: 'CNS-BLT-001', name: 'Ceramic Sanding Belt 60 grit', category: 'Belt', unitOfMeasure: 'units', costPerUnit: 800, stockLevel: 120, minimumStock: 30 }
        ]);

        console.log('Dropping BOM old variantId index...');
        try {
            await BillOfMaterial.collection.dropIndex('variantId_1');
        } catch (e) {
            console.log('Index variantId_1 not found or already dropped.');
        }

        console.log('Seeding Knife Models & BOMs...');
        const hunterBom = await BillOfMaterial.create({
            version: '1.0',
            components: [
                { material: materials[0]._id, quantityRequired: 0.25, unit: 'meters', estimatedCost: 1.25 },
                { material: materials[2]._id, quantityRequired: 1, unit: 'units', estimatedCost: 2500 },
                { material: materials[4]._id, quantityRequired: 0.5, unit: 'units', estimatedCost: 400 }
            ],
            totalEstimatedCost: 2901.25
        });

        const chefBom = await BillOfMaterial.create({
            version: '1.0',
            components: [
                { material: materials[1]._id, quantityRequired: 0.35, unit: 'meters', estimatedCost: 1.05 },
                { material: materials[3]._id, quantityRequired: 2, unit: 'units', estimatedCost: 3000 },
                { material: materials[4]._id, quantityRequired: 0.8, unit: 'units', estimatedCost: 640 }
            ],
            totalEstimatedCost: 3641.05
        });

        const models = await KnifeModel.insertMany([
            {
                name: 'Atlas Hunter',
                type: 'Hunter',
                description: 'Rugged drop point hunter perfect for field dressing.',
                defaultSteelType: 'D2 Tool Steel',
                defaultHandleMaterial: 'Walnut Burl',
                bladeLengthMin: 10,
                bladeLengthMax: 12,
                defaultBOM: hunterBom._id,
                suggestedPriceMin: 12000,
                suggestedPriceMax: 18000
            },
            {
                name: 'Culinary Master 8"',
                type: 'Chef',
                description: 'Professional 8-inch chef knife with tall blade.',
                defaultSteelType: '1095 High Carbon',
                defaultHandleMaterial: 'G10',
                bladeLengthMin: 20,
                bladeLengthMax: 22,
                defaultBOM: chefBom._id,
                suggestedPriceMin: 15000,
                suggestedPriceMax: 22000
            }
        ]);


        console.log('Seeding Knife Cards & Production Orders...');

        // Let's create some knives in the production pipeline
        const productionKnives = await KnifeCard.insertMany([
            { knifeId: 'KN-2024-001', name: 'Atlas Hunter Forged', knifeModelRef: models[0]._id, status: 'Design', steelType: 'D2 Tool Steel', handleMaterial: 'Walnut' },
            { knifeId: 'KN-2024-002', name: 'Atlas Hunter Beta', knifeModelRef: models[0]._id, status: 'In Production', steelType: 'D2 Tool Steel', handleMaterial: 'Walnut' },
            { knifeId: 'KN-2024-003', name: 'Atlas Hunter Beta 2', knifeModelRef: models[0]._id, status: 'Heat Treatment', steelType: 'D2 Tool Steel', handleMaterial: 'Walnut' },
            { knifeId: 'KN-2024-004', name: 'Culinary Master 8" Custom', knifeModelRef: models[1]._id, status: 'Finishing', steelType: '1095 High Carbon', handleMaterial: 'G10' },
            { knifeId: 'KN-2024-005', name: 'Culinary Master 8" Pro', knifeModelRef: models[1]._id, status: 'Completed', steelType: '1095 High Carbon', handleMaterial: 'G10' },
            { knifeId: 'KN-2024-006', name: 'Culinary Master 8" Pro 2', knifeModelRef: models[1]._id, status: 'Completed', steelType: '1095 High Carbon', handleMaterial: 'G10' }
        ]);

        await ProductionOrder.insertMany([
            { orderNumber: 'PO-24-1001', knifeRef: productionKnives[0]._id, quantityPlanned: 1, status: 'In Progress', assignedBladesmith: employees[0]._id, startDate: new Date() },
            { orderNumber: 'PO-24-1002', knifeRef: productionKnives[1]._id, quantityPlanned: 1, status: 'In Progress', assignedBladesmith: employees[1]._id, startDate: new Date() },
            { orderNumber: 'PO-24-1003', knifeRef: productionKnives[2]._id, quantityPlanned: 1, status: 'In Progress', assignedBladesmith: employees[0]._id, startDate: new Date() },
            { orderNumber: 'PO-24-1004', knifeRef: productionKnives[3]._id, quantityPlanned: 1, status: 'In Progress', assignedBladesmith: employees[2]._id, startDate: new Date() },
        ]);

        console.log('Seeding Productivity and Rewards...');

        // Generate some historical productivity data for Tariq (Grinder) to test WorkerCard
        const pastDate1 = new Date(); pastDate1.setDate(pastDate1.getDate() - 2);
        const pastDate2 = new Date(); pastDate2.setDate(pastDate2.getDate() - 1);

        await WorkerProductivity.insertMany([
            {
                employeeId: employees[1]._id, // Tariq
                date: pastDate1,
                knivesWorkedOn: [productionKnives[1]._id],
                operations: [
                    { operationName: 'Rough Grinding', knifeRef: productionKnives[1]._id, quantity: 2, qualityScore: 4.5, remarks: 'Good plunge lines' },
                    { operationName: 'Surface conditioning', knifeRef: productionKnives[1]._id, quantity: 2, qualityScore: 4.0 }
                ],
                dailyScore: 85,
                minutesSpent: 420
            },
            {
                employeeId: employees[1]._id,
                date: pastDate2,
                knivesWorkedOn: [productionKnives[2]._id],
                operations: [
                    { operationName: 'Post-HT Grinding', knifeRef: productionKnives[2]._id, quantity: 1, qualityScore: 5.0, remarks: 'Perfect bevels' },
                    { operationName: 'Satin Finish', knifeRef: productionKnives[2]._id, quantity: 1, qualityScore: 4.8 }
                ],
                dailyScore: 95,
                minutesSpent: 450
            }
        ]);

        await WorkerReward.insertMany([
            {
                employeeId: employees[1]._id,
                type: 'Quality Bonus',
                amount: 2500,
                reason: 'Perfect bevel grinds on Hunter batch',
                dateAwarded: pastDate2,
                isPaid: false
            },
            {
                employeeId: employees[1]._id,
                type: 'Overtime Premium',
                amount: 1500,
                reason: 'Stayed late to finish HT prep',
                dateAwarded: pastDate1,
                isPaid: true
            }
        ]);

        // Creating custom order data
        let testCustomer = await Customer.findOne();
        if (!testCustomer) {
            testCustomer = await Customer.create({
                name: 'Ahmed Collector',
                email: 'ahmed@collector.dz',
                phone: '0555123456',
                customerSegment: 'VIP Explorer',
                status: 'Active'
            });
        }

        const Supplier = require('./models/Supplier');
        console.log('Seeding Suppliers...');
        await Supplier.deleteMany();
        await Supplier.insertMany([
            {
                name: 'Algeria Steel Co.',
                contactPerson: { name: 'Mohamed', phone: '0551122334', email: 'sales@algeriasteel.dz' },
                supplierCategory: 'Steel Foundry',
                materialsSupplied: ['D2 Tool Steel', '1095 High Carbon', 'Damascus Billets'],
                address: { city: 'Algiers', country: 'Algeria' },
                performanceMetrics: { averageLeadTimeDays: 5, onTimeDeliveryRate: 98, defectRate: 1, reliabilityScore: 95 }
            },
            {
                name: 'Atlas Woods & Exotics',
                contactPerson: { name: 'Youssef', phone: '0662233445', email: 'youssef@atlaswoods.dz' },
                supplierCategory: 'Handle Materials',
                materialsSupplied: ['Walnut Burl', 'Desert Ironwood', 'G10', 'Micarta'],
                address: { city: 'Blida', country: 'Algeria' },
                performanceMetrics: { averageLeadTimeDays: 7, onTimeDeliveryRate: 90, defectRate: 2, reliabilityScore: 88 }
            },
            {
                name: 'Global Abrasives Ltd',
                contactPerson: { name: 'Samira', phone: '0773344556', email: 'orders@globalabrasives.com' },
                supplierCategory: 'Abrasives & Belts',
                materialsSupplied: ['Ceramic Belts', 'Polishing Compounds', 'Sanding Paper'],
                address: { city: 'Oran', country: 'Algeria' },
                performanceMetrics: { averageLeadTimeDays: 3, onTimeDeliveryRate: 100, defectRate: 0, reliabilityScore: 99 }
            }
        ]);

        await CustomOrder.create({
            orderId: 'CS-2024-001',
            customer: testCustomer._id,
            requestedType: 'Hunter',
            requestedSteel: 'Damascus Ladder Pattern',
            requestedHandle: 'Stabilized Desert Ironwood',
            measurements: {
                bladeLength: 11
            },
            status: 'Pending',
            finalPrice: 25000,
            deadline: new Date(new Date().setMonth(new Date().getMonth() + 1)),
            notes: 'Special Engraving: A.C.'
        });


        console.log('✅ Bladsmith Workshop Seeded Successfully!');
        process.exit();

    } catch (err) {
        console.error('Failed to seed:', err);
        process.exit(1);
    }
};

connectDB().then(() => {
    seedBladesmithData();
});
