const express = require('express');
const router = express.Router()

const categoriesRouter = require('./categories');
const placesRouter = require('./place');
const circuitsRouter = require('./circuits');
const circuitStopsRouter = require('./circuit_stops');
const liveGuidesRouter = require('./live_guides');
const heroCategoriesRouter = require('./hero_categories');
const heroSectionRouter = require('./hero_section');
const cityGuideRouter = require('./city_guide');

router.use('/categories', categoriesRouter);
router.use('/places', placesRouter);
router.use('/circuits', circuitsRouter);
router.use('/circuit-stops', circuitStopsRouter);
router.use('/live-guides', liveGuidesRouter);
router.use('/hero-categories', heroCategoriesRouter);
router.use('/hero-sections', heroSectionRouter);
router.use('/city', cityGuideRouter);

module.exports = router;