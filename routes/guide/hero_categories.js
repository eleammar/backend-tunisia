const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hero_categories ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hero_categories WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { key, label, image } = req.body;

    if (!key || !label) {
      return res.status(400).json({ error: 'key and label are required' });
    }

    const result = await pool.query(
      `INSERT INTO hero_categories (key, label, image) VALUES ($1,$2,$3) RETURNING *`,
      [key, label, image || null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { key, label, image } = req.body;

    if (!key || !label) {
      return res.status(400).json({ error: 'key and label are required' });
    }

    const result = await pool.query(
      `UPDATE hero_categories SET key=$1, label=$2, image=$3 WHERE id=$4 RETURNING *`,
      [key, label, image || null, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM hero_categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Hero category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
