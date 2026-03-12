const mongoose = require('mongoose');
const RawMaterial = require('../models/RawMaterial');
const BillOfMaterial = require('../models/BillOfMaterial');
const ProductionOrder = require('../models/ProductionOrder');
const ProductVariant = require('../models/ProductVariant');
const { logStockMovement } = require('./stockController');
const { ok, created, message, paginated } = require('../shared/utils/ApiResponse');

// ─── Raw Materials ────────────────────────────────────────────────────────────

exports.getRawMaterials = exports.getAllRawMaterials = async (req, res) => {
    try {
        const [materials, total] = await Promise.all([
            RawMaterial.find().populate('supplier', 'name').sort({ name: 1 }).skip(req.skip).limit(req.limit),
            RawMaterial.countDocuments()
        ]);
        res.json(paginated(materials, { total, hasNextPage: req.skip + materials.length < total }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createRawMaterial = async (req, res) => {
    try {
        const {
            name, sku, description, category, costPerUnit, unitOfMeasure, stockLevel,
            minimumStock, supplier, warehouseStock, steelGrade, dimensions,
            heatTreatmentNotes, storageLocation, isCritical
        } = req.body;
        const material = new RawMaterial({
            name, sku, description, category, costPerUnit, unitOfMeasure, stockLevel,
            minimumStock, supplier, warehouseStock, steelGrade, dimensions,
            heatTreatmentNotes, storageLocation, isCritical
        });
        const saved = await material.save();
        res.status(201).json(created(saved));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateRawMaterial = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const {
            name, sku, description, category, costPerUnit, unitOfMeasure, stockLevel,
            minimumStock, supplier, warehouseStock, steelGrade, dimensions,
            heatTreatmentNotes, storageLocation, isCritical
        } = req.body;
        const updated = await RawMaterial.findByIdAndUpdate(
            req.params.id,
            { name, sku, description, category, costPerUnit, unitOfMeasure, stockLevel,
              minimumStock, supplier, warehouseStock, steelGrade, dimensions,
              heatTreatmentNotes, storageLocation, isCritical },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ error: 'Raw Material not found' });
        res.json(ok(updated));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteRawMaterial = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const deleted = await RawMaterial.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Raw Material not found' });
        res.json(message('Raw Material deleted successfully'));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── Bill of Materials ────────────────────────────────────────────────────────

exports.getBOMs = exports.getAllBOMs = async (req, res) => {
    try {
        const [boms, total] = await Promise.all([
            BillOfMaterial.find()
                .populate({ path: 'variantId', populate: { path: 'productId', select: 'name brand' } })
                .populate('components.material', 'name sku costPerUnit unitOfMeasure')
                .sort({ createdAt: -1 })
                .skip(req.skip).limit(req.limit),
            BillOfMaterial.countDocuments()
        ]);
        res.json(paginated(boms, { total, hasNextPage: req.skip + boms.length < total }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createBOM = async (req, res) => {
    try {
        const { variantId, version, components, isActive } = req.body;

        let totalEstimatedCost = 0;
        if (components && components.length > 0) {
            for (const comp of components) {
                const material = await RawMaterial.findById(comp.material);
                if (!material) {
                    return res.status(400).json({ error: `Material ${comp.material} not found` });
                }
                totalEstimatedCost += (material.costPerUnit || 0) * comp.quantityRequired;
            }
        }

        const bom = new BillOfMaterial({ variantId, version, components, isActive, totalEstimatedCost });
        const saved = await bom.save();
        res.status(201).json(created(saved));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateBOM = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const { variantId, version, components, isActive } = req.body;

        let totalEstimatedCost = 0;
        if (components && components.length > 0) {
            for (const comp of components) {
                const material = await RawMaterial.findById(comp.material);
                if (material) totalEstimatedCost += (material.costPerUnit || 0) * comp.quantityRequired;
            }
        }

        const updated = await BillOfMaterial.findByIdAndUpdate(
            req.params.id,
            { variantId, version, components, isActive, totalEstimatedCost },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ error: 'BOM not found' });
        res.json(ok(updated));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteBOM = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const deleted = await BillOfMaterial.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'BOM not found' });
        res.json(message('BOM deleted successfully'));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── Production Orders ────────────────────────────────────────────────────────

exports.getProductionOrders = exports.getAllProductionOrders = async (req, res) => {
    try {
        const [orders, total] = await Promise.all([
            ProductionOrder.find()
                .populate({ path: 'variantId', populate: { path: 'productId', select: 'name brand' } })
                .populate({ path: 'bom', populate: { path: 'components.material', select: 'name sku' } })
                .populate('knifeRef', 'name knifeId type status')
                .populate('assignedBladesmith', 'name')
                .populate('assignedManager')
                .sort({ createdAt: -1 })
                .skip(req.skip).limit(req.limit),
            ProductionOrder.countDocuments()
        ]);
        res.json(paginated(orders, { total, hasNextPage: req.skip + orders.length < total }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createProductionOrder = async (req, res) => {
    try {
        const {
            variantId, bom, quantityPlanned, startDate, completionDate,
            assignedManager, productionTeam, productionWarehouse, notes,
            knifeRef, assignedBladesmith, priority
        } = req.body;
        const orderNumber = `PRD-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
        const order = new ProductionOrder({
            orderNumber, variantId, bom, quantityPlanned, startDate, completionDate,
            assignedManager, productionTeam, productionWarehouse, notes,
            knifeRef, assignedBladesmith, priority,
            status: 'Planned'
        });
        const saved = await order.save();
        res.status(201).json(created(saved));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateProductionOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const order = await ProductionOrder.findById(id).populate('bom');
        if (!order) return res.status(404).json({ error: 'Production Order not found' });
        if (order.status === 'Completed') {
            return res.status(400).json({ error: 'Cannot update a completed production order' });
        }

        const previousStatus = order.status;
        order.status = status;

        // Stage history tracking
        if (status !== previousStatus) {
            if (order.stageHistory && order.stageHistory.length > 0) {
                const lastStage = order.stageHistory[order.stageHistory.length - 1];
                if (!lastStage.completedAt) lastStage.completedAt = new Date();
            }
            order.stageHistory.push({ stage: status, startedAt: new Date() });
        }

        if (status === 'Completed' && previousStatus !== 'Completed') {
            order.quantityCompleted = order.quantityPlanned;
            order.completionDate = new Date();

            // Deduct raw materials + un-reserve
            if (order.bom && order.bom.components) {
                for (const comp of order.bom.components) {
                    const requiredAmount = comp.quantityRequired * order.quantityPlanned;
                    const decReserve = ['In Progress', 'Quality Check'].includes(previousStatus) ? -requiredAmount : 0;
                    await RawMaterial.findByIdAndUpdate(comp.material, {
                        $inc: { stockLevel: -requiredAmount, reservedQuantity: decReserve }
                    });
                }
            }

            // Increment finished goods
            const variant = await ProductVariant.findByIdAndUpdate(
                order.variantId, { $inc: { totalStock: order.quantityPlanned } }, { new: true }
            );
            if (variant) {
                await logStockMovement(
                    order.variantId, order.quantityPlanned,
                    'Production', 'Production Order Completed', order.orderNumber
                );
            }
        } else if (status === 'In Progress' && previousStatus === 'Planned') {
            if (!order.startDate) order.startDate = new Date();
            // Reserve materials
            if (order.bom && order.bom.components) {
                for (const comp of order.bom.components) {
                    const requiredAmount = comp.quantityRequired * order.quantityPlanned;
                    await RawMaterial.findByIdAndUpdate(comp.material, {
                        $inc: { reservedQuantity: requiredAmount }
                    });
                }
            }
        } else if (status === 'Cancelled' && ['In Progress', 'Quality Check'].includes(previousStatus)) {
            // Un-reserve materials
            if (order.bom && order.bom.components) {
                for (const comp of order.bom.components) {
                    const requiredAmount = comp.quantityRequired * order.quantityPlanned;
                    await RawMaterial.findByIdAndUpdate(comp.material, {
                        $inc: { reservedQuantity: -requiredAmount }
                    });
                }
            }
        }

        await order.save();
        res.json(ok(order));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getProductionAnalytics = async (req, res) => {
    try {
        const allOrders = await ProductionOrder.find().populate('bom');
        const completed = allOrders.filter(o => o.status === 'Completed');

        const totalUnitsProduced = completed.reduce((sum, o) => sum + (o.quantityCompleted || 0), 0);
        let totalCost = 0;
        completed.forEach(o => {
            if (o.bom && o.bom.totalEstimatedCost) {
                totalCost += (o.bom.totalEstimatedCost * (o.quantityCompleted || 0));
            }
        });

        res.json(ok({
            totalOrders: allOrders.length,
            completedOrders: completed.length,
            inProgressOrders: allOrders.filter(o => ['In Progress', 'Quality Check'].includes(o.status)).length,
            totalUnitsProduced,
            totalProductionCost: totalCost,
            costPerUnit: totalUnitsProduced > 0 ? (totalCost / totalUnitsProduced) : 0
        }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
