const RawMaterial = require('../models/RawMaterial');
const BillOfMaterial = require('../models/BillOfMaterial');
const ProductionOrder = require('../models/ProductionOrder');
const ProductVariant = require('../models/ProductVariant');
const { logStockMovement } = require('./stockController');
const mongoose = require('mongoose');

// --- Raw Materials ---
exports.getRawMaterials = async (req, res) => {
    try {
        const materials = await RawMaterial.find().populate('supplier', 'name').sort({ name: 1 });
        res.json(materials);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createRawMaterial = async (req, res) => {
    try {
        const material = new RawMaterial(req.body);
        const savedMaterial = await material.save();
        res.status(201).json(savedMaterial);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateRawMaterial = async (req, res) => {
    try {
        const updated = await RawMaterial.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ error: 'Raw Material not found' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteRawMaterial = async (req, res) => {
    try {
        const deleted = await RawMaterial.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Raw Material not found' });
        res.json({ message: 'Raw Material deleted dynamically' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- Bill Of Materials (BOM) ---
exports.getBOMs = async (req, res) => {
    try {
        const boms = await BillOfMaterial.find()
            .populate({
                path: 'variantId',
                populate: { path: 'productId', select: 'name brand' }
            })
            .populate('components.material', 'name sku costPerUnit unitOfMeasure')
            .sort({ createdAt: -1 });
        res.json(boms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createBOM = async (req, res) => {
    try {
        const { variantId, version, components, isActive } = req.body;

        // Calculate estimated cost
        let totalEstimatedCost = 0;
        if (components && components.length > 0) {
            for (let comp of components) {
                const material = await RawMaterial.findById(comp.material);
                if (material) {
                    totalEstimatedCost += (material.costPerUnit * comp.quantityRequired);
                }
            }
        }

        const bom = new BillOfMaterial({
            variantId,
            version,
            components,
            isActive,
            totalEstimatedCost
        });

        const savedBom = await bom.save();
        res.status(201).json(savedBom);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateBOM = async (req, res) => {
    try {
        const { components } = req.body;

        let totalEstimatedCost = 0;
        if (components && components.length > 0) {
            for (let comp of components) {
                const material = await RawMaterial.findById(comp.material);
                if (material) {
                    totalEstimatedCost += (material.costPerUnit * comp.quantityRequired);
                }
            }
            req.body.totalEstimatedCost = totalEstimatedCost;
        }

        const updated = await BillOfMaterial.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ error: 'BOM not found' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteBOM = async (req, res) => {
    try {
        const deleted = await BillOfMaterial.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'BOM not found' });
        res.json({ message: 'BOM deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- Production Orders ---
exports.getProductionOrders = async (req, res) => {
    try {
        const orders = await ProductionOrder.find()
            .populate({
                path: 'variantId',
                populate: { path: 'productId', select: 'name brand' }
            })
            .populate({
                path: 'bom',
                populate: { path: 'components.material', select: 'name sku' }
            })
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createProductionOrder = async (req, res) => {
    try {
        const order = new ProductionOrder(req.body);
        if (!order.orderNumber) {
            order.orderNumber = `PRD-${Math.floor(Math.random() * 1000000)}`;
        }
        const savedOrder = await order.save();
        res.status(201).json(savedOrder);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateProductionOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const order = await ProductionOrder.findById(id).populate('bom');
        if (!order) {
            return res.status(404).json({ error: 'Production Order not found' });
        }

        if (order.status === 'Completed') {
            return res.status(400).json({ error: 'Cannot update a completed production order' });
        }

        const previousStatus = order.status;
        order.status = status;

        if (status === 'Completed' && previousStatus !== 'Completed') {
            order.quantityCompleted = order.quantityPlanned;
            order.completionDate = new Date();

            // 1. Deduct Raw Materials (and remove from reserved)
            if (order.bom && order.bom.components) {
                for (const comp of order.bom.components) {
                    const requiredAmount = comp.quantityRequired * order.quantityPlanned;
                    // Only deduct reserve if it was previously In Progress or Quality Check
                    const decReserve = ['In Progress', 'Quality Check'].includes(previousStatus) ? -requiredAmount : 0;

                    await RawMaterial.findByIdAndUpdate(comp.material, {
                        $inc: {
                            stockLevel: -requiredAmount,
                            reservedQuantity: decReserve
                        }
                    });
                }
            }

            // 2. Increment ProductVariant stock
            const variant = await ProductVariant.findByIdAndUpdate(order.variantId, {
                $inc: { totalStock: order.quantityPlanned }
            }, { new: true });

            // 3. Log Stock Movement
            if (variant) {
                await logStockMovement(
                    order.variantId,
                    order.quantityPlanned,
                    'Production',
                    'Production Order Completed',
                    order.orderNumber
                );
            }
        }
        else if (status === 'In Progress' && previousStatus === 'Planned') {
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
        }
        else if (status === 'Cancelled' && ['In Progress', 'Quality Check'].includes(previousStatus)) {
            // Un-reserve materials if canceled mid-production
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
        res.json(order);
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
                totalCost += (o.bom.totalEstimatedCost * o.quantityCompleted);
            }
        });

        res.json({
            totalOrders: allOrders.length,
            completedOrders: completed.length,
            inProgressOrders: allOrders.filter(o => ['In Progress', 'Quality Check'].includes(o.status)).length,
            totalUnitsProduced,
            totalProductionCost: totalCost,
            costPerUnit: totalUnitsProduced > 0 ? (totalCost / totalUnitsProduced) : 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
