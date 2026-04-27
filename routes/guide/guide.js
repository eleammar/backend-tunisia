const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');
const axios = require('axios');
// Import all guide sub-routes
const categoriesRouter = require('./categories');
const placesRouter = require('./place');
const circuitsRouter = require('./circuits');
const circuitStopsRouter = require('./circuit_stops');
const liveGuidesRouter = require('./live_guides');

// Mount routes
router.use('/categories', categoriesRouter);
router.use('/places', placesRouter);
router.use('/circuits', circuitsRouter);
router.use('/circuit-stops', circuitStopsRouter);
router.use('/live-guides', liveGuidesRouter);

module.exports = router;