const express = require('express');
const router = express.Router();

// Import all food sub-routes
const categoriesRouter = require('./categories');
const popularRouter = require('./popular');
const allFoodsRouter = require('./all');
const regionsRouter = require('./regions');
const eventsRouter = require('./events');
const restaurantsRouter = require('./restaurants');

// Mount all routes
router.use('/categories', categoriesRouter);
router.use('/popular', popularRouter);
router.use('/all', allFoodsRouter);
router.use('/regions', regionsRouter);
router.use('/events', eventsRouter);
router.use('/restaurants', restaurantsRouter);

module.exports = router;