/**
 * Platform Admin guard middleware.
 * Must be placed AFTER `protect` — requires `req.user` to be populated.
 *
 * Checks `req.user.platformRole === 'platform_admin'`.
 */
const requirePlatformAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    if (req.user.platformRole !== 'platform_admin') {
        return res.status(403).json({ message: 'Platform admin access required' });
    }

    next();
};

module.exports = { requirePlatformAdmin };
