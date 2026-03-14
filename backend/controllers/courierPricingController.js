const logger = require('../shared/logger');
const mongoose = require('mongoose');
const CourierPricing = require('../models/CourierPricing');
const Courier = require('../models/Courier');
const { yalidineRequest } = require('../utils/yalidineRequest');

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// @desc    Get all pricing rules for a courier
// @route   GET /api/couriers/:id/pricing
// @access  Private
exports.getPricingRules = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });
        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });
        const rules = await CourierPricing.find({ courierId: id, tenant: req.user.tenant })
            .populate('productIds', 'name sku')
            .sort({ priority: -1 })
            .lean();
        res.json(rules);
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ error: 'Server error' });
    }
};

// @desc    Add a new pricing rule
// @route   POST /api/couriers/:id/pricing
// @access  Private
exports.addPricingRule = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });

        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const { ruleType, wilayaCode, commune, deliveryType, productIds, minWeight, maxWeight, price, priority } = req.body;

        // Validate numeric fields
        const priceNum = Number(price);
        if (!Number.isFinite(priceNum) || priceNum < 0) {
            return res.status(400).json({ message: 'Price must be a non-negative number' });
        }
        if (minWeight !== undefined && minWeight !== null && (!Number.isFinite(Number(minWeight)) || Number(minWeight) < 0)) {
            return res.status(400).json({ message: 'minWeight must be a non-negative number' });
        }
        if (maxWeight !== undefined && maxWeight !== null && (!Number.isFinite(Number(maxWeight)) || Number(maxWeight) < 0)) {
            return res.status(400).json({ message: 'maxWeight must be a non-negative number' });
        }
        if (deliveryType !== undefined && deliveryType !== null && ![0, 1].includes(Number(deliveryType))) {
            return res.status(400).json({ message: 'deliveryType must be 0 (Home) or 1 (Office)' });
        }

        const newRule = await CourierPricing.create({ ruleType, wilayaCode, commune, deliveryType, productIds, minWeight, maxWeight, price: priceNum, priority: Number(priority) || 0, courierId: id, tenant: req.user.tenant });
        
        res.status(201).json(newRule);
    } catch (error) {
        logger.error({ err: error }, 'Courier pricing error'); res.status(400).json({ error: 'Invalid pricing data' });
    }
};

// @desc    Update a pricing rule
// @route   PUT /api/couriers/:id/pricing/:ruleId
// @access  Private
exports.updatePricingRule = async (req, res) => {
    try {
        const { id, ruleId } = req.params;
        if (!validId(id) || !validId(ruleId)) return res.status(400).json({ message: 'Invalid ID' });

        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const { ruleType, wilayaCode, commune, deliveryType, productIds, minWeight, maxWeight, price, priority } = req.body;

        // Validate numeric fields if provided
        if (price !== undefined) {
            const priceNum = Number(price);
            if (!Number.isFinite(priceNum) || priceNum < 0) {
                return res.status(400).json({ message: 'Price must be a non-negative number' });
            }
        }
        if (deliveryType !== undefined && deliveryType !== null && ![0, 1].includes(Number(deliveryType))) {
            return res.status(400).json({ message: 'deliveryType must be 0 (Home) or 1 (Office)' });
        }

        const updateFields = {};
        if (ruleType !== undefined) updateFields.ruleType = ruleType;
        if (wilayaCode !== undefined) updateFields.wilayaCode = wilayaCode;
        if (commune !== undefined) updateFields.commune = commune;
        if (deliveryType !== undefined) updateFields.deliveryType = deliveryType;
        if (productIds !== undefined) updateFields.productIds = productIds;
        if (minWeight !== undefined) updateFields.minWeight = minWeight;
        if (maxWeight !== undefined) updateFields.maxWeight = maxWeight;
        if (price !== undefined) updateFields.price = Number(price);
        if (priority !== undefined) updateFields.priority = Number(priority) || 0;

        const updatedRule = await CourierPricing.findOneAndUpdate(
            { _id: ruleId, courierId: id, tenant: req.user.tenant },
            { $set: updateFields },
            { returnDocument: 'after', runValidators: true }
        );

        if (!updatedRule) return res.status(404).json({ message: 'Pricing rule not found' });
        
        res.json(updatedRule);
    } catch (error) {
        logger.error({ err: error }, 'Courier pricing error'); res.status(400).json({ error: 'Invalid pricing data' });
    }
};

// @desc    Delete a pricing rule
// @route   DELETE /api/couriers/:id/pricing/:ruleId
// @access  Private
exports.deletePricingRule = async (req, res) => {
    try {
        const { id, ruleId } = req.params;
        if (!validId(id) || !validId(ruleId)) return res.status(400).json({ message: 'Invalid ID' });

        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const deletedRule = await CourierPricing.findOneAndDelete({ _id: ruleId, courierId: id, tenant: req.user.tenant });
        if (!deletedRule) return res.status(404).json({ message: 'Pricing rule not found' });

        res.json({ message: 'Pricing rule deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ error: 'Server error' });
    }
};

// @desc    Sync pricing rules from Yalidine fees API
// @route   POST /api/couriers/:id/pricing/sync
// @access  Private
exports.syncYalidinePricing = async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });

    const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
    if (!courier) return res.status(404).json({ message: 'Courier not found' });

    if (courier.integrationType !== 'API' || (courier.apiProvider || '').toLowerCase() !== 'yalidin') {
        return res.status(400).json({ message: 'Pricing sync is only available for Yalidine couriers.' });
    }
    if (!courier.apiId || !courier.apiToken) {
        return res.status(400).json({ message: 'Yalidine API ID and Token are not configured.' });
    }

    const fromWilayaId = Number(req.body.fromWilayaId) || 16; // Default: Alger
    const TOTAL_WILAYAS = 58;
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    const operations = [];
    let totalRules = 0;
    const errors = [];

    for (let toWilaya = 1; toWilaya <= TOTAL_WILAYAS; toWilaya++) {
        try {
            const feesData = await yalidineRequest(
                'GET',
                `/fees/?from_wilaya_id=${fromWilayaId}&to_wilaya_id=${toWilaya}`,
                courier
            );

            if (!feesData || typeof feesData !== 'object') continue;

            // feesData may be direct object, wrapped in data, or array
            let feeObj = feesData;
            if (Array.isArray(feesData)) feeObj = feesData[0];
            else if (Array.isArray(feesData.data)) feeObj = feesData.data[0];

            const perCommune = feeObj?.per_commune;
            if (!perCommune || typeof perCommune !== 'object') continue;

            const wilayaCode = String(toWilaya);

            for (const [, commune] of Object.entries(perCommune)) {
                const communeName = commune.commune_name || commune.name;
                if (!communeName) continue;

                const homePrice = commune.express_home;
                const deskPrice = commune.express_desk;

                // Home delivery rule (deliveryType=0)
                if (homePrice !== undefined && homePrice !== null) {
                    operations.push({
                        updateOne: {
                            filter: {
                                tenant: req.user.tenant,
                                courierId: id,
                                ruleType: 'Wilaya+Commune',
                                wilayaCode,
                                commune: communeName,
                                deliveryType: 0
                            },
                            update: {
                                $set: {
                                    price: Number(homePrice),
                                    priority: 1,
                                    tenant: req.user.tenant,
                                    courierId: id,
                                    ruleType: 'Wilaya+Commune',
                                    wilayaCode,
                                    commune: communeName,
                                    deliveryType: 0
                                }
                            },
                            upsert: true
                        }
                    });
                    totalRules++;
                }

                // Desk delivery rule (deliveryType=1)
                if (deskPrice !== undefined && deskPrice !== null) {
                    operations.push({
                        updateOne: {
                            filter: {
                                tenant: req.user.tenant,
                                courierId: id,
                                ruleType: 'Wilaya+Commune',
                                wilayaCode,
                                commune: communeName,
                                deliveryType: 1
                            },
                            update: {
                                $set: {
                                    price: Number(deskPrice),
                                    priority: 1,
                                    tenant: req.user.tenant,
                                    courierId: id,
                                    ruleType: 'Wilaya+Commune',
                                    wilayaCode,
                                    commune: communeName,
                                    deliveryType: 1
                                }
                            },
                            upsert: true
                        }
                    });
                    totalRules++;
                }
            }

            // Rate limit: 250ms between requests (max ~4/sec, under 5/sec limit)
            if (toWilaya < TOTAL_WILAYAS) await delay(250);

        } catch (err) {
            logger.warn({ err, fromWilayaId, toWilaya }, 'Failed to fetch Yalidine fees for wilaya');
            errors.push(`Wilaya ${toWilaya}: ${err.message}`);
        }
    }

    // Execute bulk write
    if (operations.length > 0) {
        await CourierPricing.bulkWrite(operations);
    }

    res.json({
        message: `Synced ${totalRules} pricing rules from Yalidine.`,
        count: totalRules,
        errors: errors.length > 0 ? errors : undefined
    });
};
