"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CultureController = void 0;
const cultureRepository_1 = require("../repositories/cultureRepository");
exports.CultureController = {
    create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const body = req.body;
                if (!body.city_id || !body.title) {
                    return res.status(400).json({ error: 'city_id and title are required' });
                }
                const created = yield cultureRepository_1.CultureRepository.create({
                    city_id: body.city_id,
                    title: body.title,
                    label: body.label,
                    description: body.description,
                    img: body.img,
                    rating: body.rating,
                    display_order: body.display_order,
                });
                res.status(201).json(created);
            }
            catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    },
    list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const city_id = req.query.city_id ? Number(req.query.city_id) : undefined;
                const items = yield cultureRepository_1.CultureRepository.findAll(city_id ? { city_id } : undefined);
                res.json(items);
            }
            catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    },
    get(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const id = Number(req.params.id);
                const item = yield cultureRepository_1.CultureRepository.findById(id);
                if (!item)
                    return res.status(404).json({ error: 'Not found' });
                res.json(item);
            }
            catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    },
    update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const id = Number(req.params.id);
                const patch = req.body;
                const updated = yield cultureRepository_1.CultureRepository.update(id, patch);
                if (!updated)
                    return res.status(404).json({ error: 'Not found' });
                res.json(updated);
            }
            catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    },
    remove(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const id = Number(req.params.id);
                const ok = yield cultureRepository_1.CultureRepository.remove(id);
                if (!ok)
                    return res.status(404).json({ error: 'Not found' });
                res.status(204).send();
            }
            catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    }
};
