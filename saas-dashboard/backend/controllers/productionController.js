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

        order.status = status;

        if (status === 'Completed') {
            order.quantityCompleted = order.quantityPlanned;
            order.completionDate = new Date();

            // 1. Deduct Raw Materials
            if (order.bom && order.bom.components) {
                for (const comp of order.bom.components) {
                    const requiredAmount = comp.quantityRequired * order.quantityPlanned;
                    await RawMaterial.findByIdAndUpdate(comp.material, {
                        $inc: { stockLevel: -requiredAmount }
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
        } else if (status === 'In Progress' && !order.startDate) {
            order.startDate = new Date();
        }

        await order.save();

        res.json(order);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
