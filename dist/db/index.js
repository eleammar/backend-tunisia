"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const pg_1 = require("pg");
require('dotenv').config();
exports.pool = new pg_1.Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123456',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ApplicationWebTunisia',
});
exports.pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});
module.exports = exports.pool;
