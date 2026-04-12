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
exports.CultureRepository = void 0;
const db_1 = require("../db");
function mapRowToCultureItem(row) {
    var _a, _b, _c, _d;
    return {
        id: row.id,
        city_id: row.city_id,
        label: (_a = row.label) !== null && _a !== void 0 ? _a : undefined,
        title: row.title,
        description: (_b = row.description) !== null && _b !== void 0 ? _b : undefined,
        img: (_c = row.img) !== null && _c !== void 0 ? _c : undefined,
        rating: row.rating !== null && row.rating !== undefined ? parseFloat(row.rating) : undefined,
        display_order: (_d = row.display_order) !== null && _d !== void 0 ? _d : undefined,
        created_at: row.created_at ? row.created_at.toISOString() : undefined,
        updated_at: row.updated_at ? row.updated_at.toISOString() : undefined,
    };
}
exports.CultureRepository = {
    create(item) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const q = `
      INSERT INTO culture_items
        (city_id, label, title, description, img, rating, display_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `;
            const vals = [
                item.city_id,
                (_a = item.label) !== null && _a !== void 0 ? _a : null,
                item.title,
                (_b = item.description) !== null && _b !== void 0 ? _b : null,
                (_c = item.img) !== null && _c !== void 0 ? _c : null,
                (_d = item.rating) !== null && _d !== void 0 ? _d : null,
                (_e = item.display_order) !== null && _e !== void 0 ? _e : null,
            ];
            const { rows } = yield db_1.pool.query(q, vals);
            return mapRowToCultureItem(rows[0]);
        });
    },
    findAll(filter) {
        return __awaiter(this, void 0, void 0, function* () {
            if (filter === null || filter === void 0 ? void 0 : filter.city_id) {
                const { rows } = yield db_1.pool.query('SELECT * FROM culture_items WHERE city_id = $1 ORDER BY display_order NULLS LAST, id', [filter.city_id]);
                return rows.map(mapRowToCultureItem);
            }
            const { rows } = yield db_1.pool.query('SELECT * FROM culture_items ORDER BY display_order NULLS LAST, id');
            return rows.map(mapRowToCultureItem);
        });
    },
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const { rows } = yield db_1.pool.query('SELECT * FROM culture_items WHERE id = $1', [id]);
            if (rows.length === 0)
                return null;
            return mapRowToCultureItem(rows[0]);
        });
    },
    update(id, patch) {
        return __awaiter(this, void 0, void 0, function* () {
            // Build dynamic update
            const allowed = ['city_id', 'label', 'title', 'description', 'img', 'rating', 'display_order'];
            const keys = Object.keys(patch).filter(k => allowed.includes(k));
            if (keys.length === 0) {
                return this.findById(id);
            }
            const sets = keys.map((k, i) => `${k} = $${i + 1}`);
            const values = keys.map(k => { var _a; return (_a = patch[k]) !== null && _a !== void 0 ? _a : null; });
            const q = `UPDATE culture_items SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`;
            values.push(id);
            const { rows } = yield db_1.pool.query(q, values);
            if (rows.length === 0)
                return null;
            return mapRowToCultureItem(rows[0]);
        });
    },
    remove(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const { rowCount } = yield db_1.pool.query('DELETE FROM culture_items WHERE id = $1', [id]);
            return rowCount > 0;
        });
    }
};
