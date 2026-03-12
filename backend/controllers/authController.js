const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

// Generate JWT
const generateToken = (id) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set');
    }
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, tenantId, businessName } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please add all required fields' });
        }

        if (!tenantId && !businessName) {
            return res.status(400).json({ message: 'Provide either tenantId (join existing) or businessName (create new workspace).' });
        }

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Resolve tenant
        let tenant;
        if (tenantId) {
            tenant = await Tenant.findById(tenantId);
            if (!tenant || !tenant.isActive) {
                return res.status(404).json({ message: 'Tenant not found or inactive.' });
            }
        } else {
            // Create a new tenant (new business signup)
            tenant = await Tenant.create({ name: businessName });
        }

        // Create user — role must be assigned later by admin, never trusted from registration body
        const user = await User.create({
            name,
            email,
            password,
            role: null,
            tenant: tenant._id
        });

        if (user) {
            res.status(201).json({
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                permissions: user.permissions,
                isActive: user.isActive,
                preferences: user.preferences,
                tenant: tenant._id,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user email, importantly select password back so we can verify it
        const user = await User.findOne({ email }).select('+password').populate('role');

        if (user && (await user.matchPassword(password))) {
            if (!user.isActive) {
                return res.status(401).json({ message: 'Account disabled. Contact Administrator.' });
            }

            // Compute effective permissions for the frontend
            let effectivePermissions = new Set(user.role ? user.role.permissions : []);
            if (user.permissionOverrides && user.permissionOverrides.length > 0) {
                user.permissionOverrides.forEach(override => {
                    if (override.effect === 'allow') {
                        effectivePermissions.add(override.permission);
                    } else if (override.effect === 'deny') {
                        effectivePermissions.delete(override.permission);
                    }
                });
            }

            res.json({
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role ? user.role.name : 'user', // Backward compatible string
                roleObject: user.role, // Full role object
                permissions: Array.from(effectivePermissions), // Computed permissions list
                permissionOverrides: user.permissionOverrides,
                isActive: user.isActive,
                preferences: user.preferences,
                tenant: user.tenant,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('role');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let effectivePermissions = new Set(user.role ? user.role.permissions : []);
        if (user.permissionOverrides && user.permissionOverrides.length > 0) {
            user.permissionOverrides.forEach(override => {
                if (override.effect === 'allow') {
                    effectivePermissions.add(override.permission);
                } else if (override.effect === 'deny') {
                    effectivePermissions.delete(override.permission);
                }
            });
        }

        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role ? user.role.name : 'user',
            roleObject: user.role,
            permissions: Array.from(effectivePermissions),
            permissionOverrides: user.permissionOverrides,
            isActive: user.isActive,
            preferences: user.preferences || {},
            tenant: user.tenant
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};
