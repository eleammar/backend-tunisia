"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cultureController_1 = require("../controllers/cultureController");
const router = (0, express_1.Router)();
// Base path: /api/culture-items
router.post('/', cultureController_1.CultureController.create);
router.get('/', cultureController_1.CultureController.list);
router.get('/:id', cultureController_1.CultureController.get);
router.patch('/:id', cultureController_1.CultureController.update);
router.put('/:id', cultureController_1.CultureController.update);
router.delete('/:id', cultureController_1.CultureController.remove);
exports.default = router;
