const RawMaterial = require('../models/RawMaterial');
const BillOfMaterial = require('../models/BillOfMaterial');
const ProductionOrder = require('../models/ProductionOrder');
const ProductVariant = require('../models/ProductVariant');
const mongoose = require('mongoose');

// ============================================
// Raw Materials Controller
// ============================================

exports.getAllRawMaterials = async (req, res) => {
    try {
        const materials = await RawMaterial.find().sort({ name: 1 });
        res.status(200).json(materials);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch raw materials' });
    }
};

exports.createRawMaterial = async (req, res) => {
    try {
        const material = new RawMaterial(req.body);
        await material.save();
        res.status(201).json(material);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.updateRawMaterial = async (req, res) => {
    try {
        const material = await RawMaterial.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!material) return res.status(404).json({ error: 'Raw material not found' });
        res.status(200).json(material);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteRawMaterial = async (req, res) => {
    try {
        const material = await RawMaterial.findByIdAndDelete(req.params.id);
        if (!material) return res.status(404).json({ error: 'Raw material not found' });
        res.status(200).json({ message: 'Raw material deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// BOM (Bill of Materials) Controller
// ============================================

exports.getAllBOMs = async (req, res) => {
    try {
        const boms = await BillOfMaterial.find()
            .populate('variantId')
            .populate('components.material');
        res.status(200).json(boms);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch BOMs' });
    }
};

exports.createBOM = async (req, res) => {
    try {
        const { variantId, components } = req.body;

        let totalEstimatedCost = 0;

        // Calculate total cost and validate components
        if (components && components.length > 0) {
            for (let comp of components) {
                const material = await RawMaterial.findById(comp.material);
                if (!material) {
                    return res.status(400).json({ error: `Material with ID ${comp.material} not found.` });
                }
                totalEstimatedCost += (material.costPerUnit || 0) * comp.quantityRequired;
            }
        }

        const newBom = new BillOfMaterial({
            variantId,
            components,
            totalEstimatedCost
        });

        await newBom.save();
        res.status(201).json(newBom);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteBOM = async (req, res) => {
    try {
        const bom = await BillOfMaterial.findByIdAndDelete(req.params.id);
        if (!bom) return res.status(404).json({ error: 'BOM not found' });
        res.status(200).json({ message: 'BOM deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// Production Order Controller
// ============================================

exports.getAllProductionOrders = async (req, res) => {
    try {
        const orders = await ProductionOrder.find()
            .populate('variantId')
            .populate('bom')
            .populate('assignedManager')
            .sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Production Orders' });
    }
};

exports.createProductionOrder = async (req, res) => {
    try {
        const orderData = req.body;
        // Generate a random order number if not provided
        if (!orderData.orderNumber) {
            orderData.orderNumber = `PRD-${Date.now().toString().slice(-6)}`;
        }

        const order = new ProductionOrder(orderData);
        await order.save();
        res.status(201).json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.updateProductionOrderStatus = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const { status } = req.body;

        const order = await ProductionOrder.findById(id).populate('bom');
        if (!order) {
            throw new Error('Production order not found');
        }

        // If transitioning to Completed, physical inventory deductions/additions must happen
        if (order.status !== 'Completed' && status === 'Completed') {
            const bom = await BillOfMaterial.findById(order.bom._id).session(session);

            if (!bom) {
                throw new Error('Associated BOM not found required for material deduction');
            }

            // 1. Deduct Raw Materials (yielding the requested output)
            for (let comp of bom.components) {
                const totalReq = comp.quantityRequired * order.quantityPlanned;
                const rawMat = await RawMaterial.findById(comp.material).session(session);

                if (!rawMat) throw new Error(`Raw material ${comp.material} not found`);
                if (rawMat.stockLevel < totalReq) {
                    throw new Error(`Insufficient stock for ${rawMat.name}. Need ${totalReq}, have ${rawMat.stockLevel}.`);
                }

                rawMat.stockLevel -= totalReq;
                await rawMat.save({ session });
            }

            // 2. Increment Finished Good Inventory
            const variant = await ProductVariant.findById(order.variantId).session(session);
            if (!variant) throw new Error('Finished product variant not found');

            variant.stock += order.quantityPlanned;
            await variant.save({ session });

            order.quantityCompleted = order.quantityPlanned;
            order.completionDate = new Date();
        }

        order.status = status;
        await order.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json(order);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error: error.message });
    }
};
