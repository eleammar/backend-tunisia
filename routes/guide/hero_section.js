const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hero_section ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:cityId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM hero_section WHERE city_id = $1',
      [req.params.cityId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hero_section WHERE id = $1', [req.params.id]);
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, subtitle, location, background_image, city_id } = req.body;

    const result = await pool.query(
      `INSERT INTO hero_section (title, subtitle, location, background_image, city_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [title, subtitle, location, background_image, city_id || null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, subtitle, location, background_image, city_id } = req.body;

    const result = await pool.query(
      `UPDATE hero_section SET
        title=$1, subtitle=$2, location=$3, background_image=$4, city_id=$5
       WHERE id=$6
       RETURNING *`,
      [title, subtitle, location, background_image, city_id || null, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM hero_section WHERE id = $1', [req.params.id]);
    res.json({ message: 'Hero section deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
