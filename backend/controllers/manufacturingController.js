/**
 * manufacturingController — thin shim
 *
 * All production/manufacturing logic is now canonical in productionController.
 * This file re-exports the shared functions so the /api/manufacturing routes
 * continue to work without any route changes.
 */
module.exports = require('./productionController');
