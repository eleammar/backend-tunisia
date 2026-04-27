// routes/liveGuides.js
const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');
const axios = require('axios');
//
// 🔍 GET ALL GUIDES
//
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM live_guides ORDER BY rating DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// 🔴 GET LIVE ONLY
//
router.get('/live', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM live_guides WHERE is_live = true'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// 🔍 GET ONE GUIDE BY ID
//
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM live_guides WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Guide not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ➕ CREATE GUIDE
//
router.post('/', async (req, res) => {
  try {
    const {
      id, name, avatar, speciality,
      rating, reviews, languages,
      is_live, category_id
    } = req.body;

    const result = await pool.query(
      `INSERT INTO live_guides (
        id, name, avatar, speciality,
        rating, reviews, languages,
        is_live, category_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [id, name, avatar, speciality, rating, reviews, languages, is_live, category_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ✏️ UPDATE GUIDE
//
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name, avatar, speciality,
      rating, reviews, languages,
      is_live, category_id
    } = req.body;

    const result = await pool.query(
      `UPDATE live_guides SET
        name=$1,
        avatar=$2,
        speciality=$3,
        rating=$4,
        reviews=$5,
        languages=$6,
        is_live=$7,
        category_id=$8
      WHERE id=$9
      RETURNING *`,
      [name, avatar, speciality, rating, reviews, languages, is_live, category_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Guide not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ❌ DELETE GUIDE
//
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM live_guides WHERE id=$1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Guide not found' });
    }

    res.json({ message: 'Guide deleted', guide: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;