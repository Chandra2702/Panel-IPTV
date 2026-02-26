const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../../middleware/auth');

// Import admin sub-routes
const dashboardRoutes = require('./dashboard');
const usersRoutes = require('./users');
const channelsRoutes = require('./channels');
const bouquetsRoutes = require('./bouquets');
const categoriesRoutes = require('./categories');
const resellersRoutes = require('./resellers');
const shortlinksRoutes = require('./shortlinks');
const monitorRoutes = require('./monitor');
const settingsRoutes = require('./settings');


// Apply auth middleware to all admin routes
router.use(requireAuth);

// Mount routes
router.use('/dashboard', dashboardRoutes);
router.use('/users', usersRoutes);
router.use('/channels', channelsRoutes);
router.use('/bouquets', bouquetsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/resellers', requireAdmin, resellersRoutes);
router.use('/shortlinks', shortlinksRoutes);
router.use('/monitor', requireAdmin, monitorRoutes);
router.use('/settings', requireAdmin, settingsRoutes);


module.exports = router;
