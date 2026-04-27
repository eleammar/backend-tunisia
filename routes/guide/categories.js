const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');
const axios = require('axios');
//
// ✅ GET ALL CATEGORIES
//
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY label ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ GET CATEGORY BY ID
//
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories WHERE id = $1',
      [req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ CREATE CATEGORY
//
router.post('/', async (req, res) => {
  try {
    const { id, label, icon, color, bg_class } = req.body;

    const result = await pool.query(
      `INSERT INTO categories (id, label, icon, color, bg_class)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [id, label, icon, color, bg_class]
    );

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ UPDATE CATEGORY
//
router.put('/:id', async (req, res) => {
  try {
    const { label, icon, color, bg_class } = req.body;

    const result = await pool.query(
      `UPDATE categories SET
        label = $1,
        icon = $2,
        color = $3,
        bg_class = $4
       WHERE id = $5
       RETURNING *`,
      [label, icon, color, bg_class, req.params.id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ DELETE CATEGORY
//
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM categories WHERE id = $1',
      [req.params.id]
    );

    res.json({ message: 'Category deleted' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;