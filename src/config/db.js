// src/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10, // limit connections
});

// Test de connexion
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Échec de connexion à PostgreSQL', err);
    return;
  }
  console.log('✅ Connexion à PostgreSQL réussie');
  release();
});

module.exports = pool;