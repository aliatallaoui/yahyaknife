const logger = require('../shared/logger');
const mongoose = require('mongoose');
const CourierCoverage = require('../models/CourierCoverage');
const CourierPricing = require('../models/CourierPricing');
const Courier = require('../models/Courier');

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// @desc    Get covered wilayas for a specific courier or all
// @route   GET /api/couriers/engine/coverage
// @access  Private
const getCourierCoverage = async (req, res) => {
    try {
        const { courierId, wilayaCode, deliveryType } = req.query; // deliveryType: 0 (home), 1 (office)

        let query = { tenant: req.user.tenant };
        if (courierId) {
            if (!validId(courierId)) return res.status(400).json({ message: 'Invalid courier ID' });
            query.courierId = courierId;
        }
        if (wilayaCode) query.wilayaCode = wilayaCode;
        if (deliveryType !== undefined) {
            if (Number(deliveryType) === 0) {
                query.homeSupported = true;
            } else if (Number(deliveryType) === 1) {
                query.officeSupported = true;
            }
        }

        const coverage = await CourierCoverage.find(query)
            .populate({ path: 'courierId', match: { deletedAt: null, tenant: req.user.tenant }, select: 'name status' })
            .lean();
        res.json(coverage.filter(c => c.courierId));
    } catch (error) {
        logger.error({ err: error }, 'Courier coverage fetch error');
        res.status(500).json({ message: 'Server Error' });
    }
};

const { calculateDeliveryFee } = require('../utils/deliveryFeeCalculator');

// @desc    Calculate courier price for a given payload (wilaya, commune, deliveryType, weight, products)
// @route   POST /api/couriers/engine/calculate-price
// @access  Private
const calculateCourierPrice = async (req, res) => {
    try {
        const { courierId, wilayaCode, commune, deliveryType, productIds, totalWeight } = req.body;

        if (!courierId || !wilayaCode) {
            return res.status(400).json({ message: 'courierId and wilayaCode are required' });
        }
        if (!validId(courierId)) return res.status(400).json({ message: 'Invalid courier ID' });

        const typeNum = deliveryType !== undefined ? Number(deliveryType) : 0;
        const weight = totalWeight !== undefined ? Number(totalWeight) : 0;
        if (!Number.isFinite(typeNum) || !Number.isFinite(weight) || weight < 0) {
            return res.status(400).json({ message: 'Invalid deliveryType or totalWeight' });
        }
        const pIds = Array.isArray(productIds) ? productIds : [];

        const result = await calculateDeliveryFee({
            courierId,
            wilayaCode,
            commune,
            deliveryType: typeNum,
            productIds: pIds,
            totalWeight: weight,
            tenant: req.user.tenant
        });

        if (!result.matched) {
            return res.status(404).json({
                price: 0,
                matched: false,
                message: 'No pricing rules matched this location/delivery combination. Please add a Flat or Wilaya rule for this courier.'
            });
        }

        res.json({ price: result.fee, matched: result.matched, rule: result.rule });
    } catch (error) {
        logger.error({ err: error }, 'Courier price calculation error');
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Recommend best courier for a given location and delivery type
// @route   GET /api/couriers/engine/recommend
// @access  Private
const recommendCourier = async (req, res) => {
    try {
        const { wilayaCode, commune, deliveryType } = req.query;

        if (!wilayaCode || !commune) {
            return res.status(400).json({ message: 'wilayaCode and commune are required' });
        }

        const typeNum = deliveryType !== undefined ? Number(deliveryType) : 0;

        // 1. Find all couriers that cover this area for this delivery type
        let coverageQuery = { wilayaCode, commune, tenant: req.user.tenant };
        if (typeNum === 0) coverageQuery.homeSupported = true;
        else coverageQuery.officeSupported = true;

        const coverages = await CourierCoverage.find(coverageQuery).limit(500).lean();

        if (coverages.length === 0) {
            return res.json({ recommended: null, available: [] });
        }

        const courierIds = coverages.map(c => c.courierId);

        // 2. Fetch those couriers with their stats
        const activeCouriers = await Courier.find({ _id: { $in: courierIds }, status: 'Active', tenant: req.user.tenant, deletedAt: null }).lean();

        if (activeCouriers.length === 0) {
            return res.json({ recommended: null, available: [] });
        }

        // 3. For each active courier, fetch pricing
        let candidates = await Promise.all(activeCouriers.map(async (courier) => {
            // Try exact match with commune first
            let pricing = await CourierPricing.findOne({
                courierId: courier._id, wilayaCode, commune, deliveryType: typeNum, tenant: req.user.tenant
            }).lean();

            // Fallback to wilaya level
            if (!pricing) {
                pricing = await CourierPricing.findOne({
                    courierId: courier._id, wilayaCode, $or: [{ commune: { $exists: false } }, { commune: '' }, { commune: null }], deliveryType: typeNum, tenant: req.user.tenant
                }).lean();
            }

            return {
                courier,
                price: pricing ? pricing.price : null,
                score: (courier.successRate || 0) - (pricing ? pricing.price * 0.01 : 100) // Simple synthetic metric (higher success rate, lower price is better)
            };
        }));

        // Filter out couriers without pricing available (if strict mapping is required)
        candidates = candidates.filter(c => c.price !== null);

        if (candidates.length === 0) {
            return res.json({ recommended: null, available: [] });
        }

        // Sort by our synthetic score descending
        candidates.sort((a, b) => b.score - a.score);

        res.json({
            recommended: {
                courierId: candidates[0].courier._id,
                name: candidates[0].courier.name,
                price: candidates[0].price,
                successRate: candidates[0].courier.successRate,
                reason: `Best balance of success rate and delivery cost`
            },
            available: candidates.map(c => ({
                courierId: c.courier._id,
                name: c.courier.name,
                price: c.price,
                successRate: c.courier.successRate
            }))
        });

    } catch (error) {
        logger.error({ err: error }, 'Courier recommendation error');
        res.status(500).json({ message: 'Server Error' });
    }
}

module.exports = {
    getCourierCoverage,
    calculateCourierPrice,
    recommendCourier
};
