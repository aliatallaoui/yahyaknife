const mongoose = require('mongoose');
const KnifeCard = require('../models/KnifeCard');
const KnifeModel = require('../models/KnifeModel');
const RawMaterial = require('../models/RawMaterial');
const { logStockMovement } = require('./stockController');
const { ok, created, message, paginated } = require('../shared/utils/ApiResponse');

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─── KNIFE CARD CRUD ───────────────────────────────────────────────

exports.getAllKnifeCards = async (req, res) => {
    try {
        const { status, search } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { name: { $regex: escapedSearch, $options: 'i' } },
                { knifeId: { $regex: escapedSearch, $options: 'i' } },
                { steelType: { $regex: escapedSearch, $options: 'i' } }
            ];
        }

        const [knives, total] = await Promise.all([
            KnifeCard.find(filter)
                .populate('maker', 'name role workshopRole')
                .populate('customer', 'name phone')
                .sort({ createdAt: -1 })
                .skip(req.skip).limit(req.limit)
                .lean(),
            KnifeCard.countDocuments(filter)
        ]);
        res.json(paginated(knives, { total, hasNextPage: req.skip + knives.length < total }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getKnifeCardById = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
        const knife = await KnifeCard.findById(req.params.id)
            .populate('maker', 'name role workshopRole')
            .populate('customer', 'name phone')
            .populate('materialsUsed.material', 'name sku');
        if (!knife) return res.status(404).json({ error: 'Knife not found' });
        res.json(knife);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createKnifeCard = async (req, res) => {
    try {
        // If creating from a model template, pull defaults
        if (req.body.knifeModelRef) {
            const model = await KnifeModel.findById(req.body.knifeModelRef).lean();
            if (model) {
                req.body.type = req.body.type || model.type;
                req.body.steelType = req.body.steelType || model.defaultSteelType;
                req.body.handleMaterial = req.body.handleMaterial || model.defaultHandleMaterial;
                req.body.guardMaterial = req.body.guardMaterial || model.defaultGuardMaterial;
                req.body.pins = req.body.pins || model.defaultPins;
                req.body.sheathRequired = req.body.sheathRequired ?? model.sheathRequired;
                req.body.bomRef = req.body.bomRef || model.defaultBOM;
                req.body.suggestedPrice = req.body.suggestedPrice || model.suggestedPriceMin;
            }
        }
        const {
            name, type, knifeModelRef, steelType, handleMaterial, guardMaterial, pins,
            sheathRequired, sheathMaterial, bladeLength, totalLength, weight, hardnessHRC,
            maker, productionStartDate, productionEndDate, bomRef, bom,
            materialCost, laborCost, otherCosts, suggestedPrice, actualSalePrice,
            saleOrderRef, customOrderRef, soldDate, customer, photos, notes, status
        } = req.body;
        const knife = new KnifeCard({
            name, type, knifeModelRef, steelType, handleMaterial, guardMaterial, pins,
            sheathRequired, sheathMaterial, bladeLength, totalLength, weight, hardnessHRC,
            maker, productionStartDate, productionEndDate, bomRef, bom,
            materialCost, laborCost, otherCosts, suggestedPrice, actualSalePrice,
            saleOrderRef, customOrderRef, soldDate, customer, photos, notes, status
        });
        const saved = await knife.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateKnifeCard = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
        const knife = await KnifeCard.findById(req.params.id);
        if (!knife) return res.status(404).json({ error: 'Knife not found' });
        // Strip fields that must not be overwritten by the client
        const { knifeId: _ki, materialsConsumed: _mc, historyLog: _hl,
                productionStartDate: _ps, productionEndDate: _pe, ...safeBody } = req.body;
        Object.assign(knife, safeBody);
        const saved = await knife.save();
        res.json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteKnifeCard = async (req, res) => {
    try {
        if (!validId(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const knife = await KnifeCard.findByIdAndDelete(req.params.id);
        if (!knife) return res.status(404).json({ error: 'Knife not found' });
        res.json({ message: 'Knife card deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── STATUS ADVANCEMENT ────────────────────────────────────────────

const STATUS_ORDER = [
    'Design', 'In Production', 'Heat Treatment', 'Grinding',
    'Handle Installation', 'Finishing', 'Sharpening', 'Completed', 'Sold'
];

exports.advanceStatus = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
        const knife = await KnifeCard.findById(req.params.id);
        if (!knife) return res.status(404).json({ error: 'Knife not found' });

        const currentIndex = STATUS_ORDER.indexOf(knife.status);
        if (currentIndex === -1 || currentIndex >= STATUS_ORDER.length - 2) {
            return res.status(400).json({ error: 'Cannot advance further' });
        }

        const previousStatus = knife.status;
        knife.status = STATUS_ORDER[currentIndex + 1];

        // Add to history log
        knife.historyLog.push({
            stage: knife.status,
            notes: req.body.notes || `Advanced from ${previousStatus} to ${knife.status}`,
            worker: req.body.workerId || null,
            date: new Date()
        });

        if (knife.status === 'Completed') knife.productionEndDate = new Date();
        if (!knife.productionStartDate && knife.status === 'In Production') {
            knife.productionStartDate = new Date();
        }

        const saved = await knife.save();
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
        const { status, notes, workerId } = req.body;
        const knife = await KnifeCard.findById(req.params.id);
        if (!knife) return res.status(404).json({ error: 'Knife not found' });

        const previousStatus = knife.status;
        knife.status = status;
        knife.historyLog.push({
            stage: status,
            notes: notes || `Status changed from ${previousStatus} to ${status}`,
            worker: workerId || null,
            date: new Date()
        });

        if (status === 'Sold') {
            knife.soldDate = new Date();
            knife.actualSalePrice = req.body.salePrice || knife.actualSalePrice;
            knife.customer = req.body.customerId || knife.customer;
        }
        if (status === 'Completed') knife.productionEndDate = new Date();

        const saved = await knife.save();
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.consumeMaterials = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
        const knife = await KnifeCard.findById(req.params.id);
        if (!knife) return res.status(404).json({ error: 'Knife not found' });

        if (knife.materialsConsumed) {
            return res.status(400).json({ error: 'Materials already consumed for this knife' });
        }

        if (!knife.bom || knife.bom.length === 0) {
            return res.status(400).json({ error: 'No BOM defined for this knife' });
        }

        // Deduct materials
        for (const item of knife.bom) {
            if (item.material && item.quantityRequired) {
                await RawMaterial.findByIdAndUpdate(item.material, {
                    $inc: { stockLevel: -item.quantityRequired }
                });

                await logStockMovement(
                    item.material,
                    -item.quantityRequired,
                    'Production',
                    `Consumed for Knife ${knife.knifeId}`,
                    knife.knifeId
                );
            }
        }

        knife.materialsConsumed = true;
        await knife.save();

        res.json({ message: 'Materials consumed successfully', knife });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── HISTORY LOG ───────────────────────────────────────────────────

exports.addHistoryEntry = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
        const knife = await KnifeCard.findById(req.params.id);
        if (!knife) return res.status(404).json({ error: 'Knife not found' });
        const { stage, notes, worker } = req.body;
        if (!stage) return res.status(400).json({ error: 'stage is required' });
        knife.historyLog.push({ stage, notes: notes || '', worker: worker || null, date: new Date() });
        await knife.save();
        res.json(knife.historyLog);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── KNIFE STATS ───────────────────────────────────────────────────

exports.getKnifeStats = async (req, res) => {
    try {
        const total = await KnifeCard.countDocuments();
        const byStatus = await KnifeCard.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const completedThisMonth = await KnifeCard.countDocuments({
            status: { $in: ['Completed', 'Sold'] },
            productionEndDate: { $gte: new Date(new Date().setDate(1)) }
        });
        const avgProfit = await KnifeCard.aggregate([
            { $match: { status: 'Sold', profit: { $gt: 0 } } },
            { $group: { _id: null, avg: { $avg: '$profit' } } }
        ]);

        res.json({
            total,
            byStatus: Object.fromEntries(byStatus.map(b => [b._id, b.count])),
            completedThisMonth,
            avgProfit: avgProfit[0]?.avg || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── KNIFE MODEL (LIBRARY) CRUD ────────────────────────────────────

exports.getAllKnifeModels = async (req, res) => {
    try {
        const models = await KnifeModel.find({ isActive: true }).sort({ name: 1 });
        res.json(models);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createKnifeModel = async (req, res) => {
    try {
        const {
            name, type, description, defaultSteelType, defaultHandleMaterial, defaultGuardMaterial,
            defaultPins, sheathRequired, bladeLengthMin, bladeLengthMax, typicalWeight,
            defaultBOM, suggestedPriceMin, suggestedPriceMax, estimatedProductionCost,
            photo, notes, isActive
        } = req.body;
        const model = new KnifeModel({
            name, type, description, defaultSteelType, defaultHandleMaterial, defaultGuardMaterial,
            defaultPins, sheathRequired, bladeLengthMin, bladeLengthMax, typicalWeight,
            defaultBOM, suggestedPriceMin, suggestedPriceMax, estimatedProductionCost,
            photo, notes, isActive
        });
        const saved = await model.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateKnifeModel = async (req, res) => {
    try {
        const {
            name, type, description, defaultSteelType, defaultHandleMaterial, defaultGuardMaterial,
            defaultPins, sheathRequired, bladeLengthMin, bladeLengthMax, typicalWeight,
            defaultBOM, suggestedPriceMin, suggestedPriceMax, estimatedProductionCost,
            photo, notes, isActive
        } = req.body;
        const model = await KnifeModel.findByIdAndUpdate(
            req.params.id,
            {
                name, type, description, defaultSteelType, defaultHandleMaterial, defaultGuardMaterial,
                defaultPins, sheathRequired, bladeLengthMin, bladeLengthMax, typicalWeight,
                defaultBOM, suggestedPriceMin, suggestedPriceMax, estimatedProductionCost,
                photo, notes, isActive
            },
            { new: true }
        );
        if (!model) return res.status(404).json({ error: 'Model not found' });
        res.json(model);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteKnifeModel = async (req, res) => {
    try {
        if (!validId(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        await KnifeModel.findByIdAndDelete(req.params.id);
        res.json({ message: 'Model deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
