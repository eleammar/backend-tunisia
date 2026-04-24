const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

// GET all delegations (with optional pagination)
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT id, city_id, name, population, area, description, img, founded, notable, type, lat, lng, created_at, updated_at
       FROM delegations
       ORDER BY id ASC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit, 10), parseInt(offset, 10)]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching delegations:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch delegations',
      details: err.message,
    });
  }
});

// GET single delegation by ID
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      `SELECT id, city_id, name, population, area, description, img, founded, notable, type, lat, lng, created_at, updated_at
       FROM delegations WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Delegation not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching delegation:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch delegation', details: err.message });
  }
});

// GET delegations by city id
router.get('/city/:cityId', async (req, res) => {
  const cityId = req.params.cityId;
  try {
    // Verify city exists (consistent with other routes)
    const cityCheck = await pool.query('SELECT id FROM cities WHERE id = $1', [cityId]);
    if (cityCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const result = await pool.query(
      `SELECT id, city_id, name, population, area, description, img, founded, notable, type, lat, lng, created_at, updated_at
       FROM delegations WHERE city_id = $1
       ORDER BY id ASC`,
      [cityId]
    );

    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Error fetching delegations by city:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch delegations', details: err.message });
  }
});

// CREATE delegation
router.post('/', async (req, res) => {
  try {
    const {
      city_id, name, population, area, description, img,
      founded, notable, type, lat, lng
    } = req.body;

    if (!city_id || !name) {
      return res.status(400).json({ success: false, error: 'city_id and name are required' });
    }

    // Verify city exists
    const cityCheck = await pool.query('SELECT id FROM cities WHERE id = $1', [city_id]);
    if (cityCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const result = await pool.query(
      `INSERT INTO delegations
       (city_id, name, population, area, description, img, founded, notable, type, lat, lng, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now(), now())
       RETURNING id, city_id, name, population, area, description, img, founded, notable, type, lat, lng, created_at, updated_at`,
      [
        city_id,
        name,
        population || null,
        area || null,
        description || null,
        img || null,
        founded || null,
        notable || null,
        type || null,
        lat !== undefined && lat !== null ? parseFloat(lat) : null,
        lng !== undefined && lng !== null ? parseFloat(lng) : null
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: '✓ Delegation created successfully!',
    });
  } catch (err) {
    console.error('Error creating delegation:', err);
    res.status(500).json({ success: false, error: 'Failed to create delegation', details: err.message });
  }
});

// UPDATE delegation
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const {
      city_id, name, population, area, description, img,
      founded, notable, type, lat, lng
    } = req.body;

    // Check if exists
    const itemCheck = await pool.query('SELECT id FROM delegations WHERE id = $1', [id]);
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Delegation not found' });
    }

    if (city_id) {
      const cityCheck = await pool.query('SELECT id FROM cities WHERE id = $1', [city_id]);
      if (cityCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'City not found' });
      }
    }

    const result = await pool.query(
      `UPDATE delegations SET
         city_id = COALESCE($1, city_id),
         name = COALESCE($2, name),
         population = COALESCE($3, population),
         area = COALESCE($4, area),
         description = COALESCE($5, description),
         img = COALESCE($6, img),
         founded = COALESCE($7, founded),
         notable = COALESCE($8, notable),
         type = COALESCE($9, type),
         lat = COALESCE($10, lat),
         lng = COALESCE($11, lng),
         updated_at = now()
       WHERE id = $12
       RETURNING id, city_id, name, population, area, description, img, founded, notable, type, lat, lng, created_at, updated_at`,
      [
        city_id || null,
        name || null,
        population || null,
        area || null,
        description || null,
        img || null,
        founded || null,
        notable || null,
        type || null,
        lat !== undefined && lat !== null ? parseFloat(lat) : null,
        lng !== undefined && lng !== null ? parseFloat(lng) : null,
        id,
      ]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: '✓ Delegation updated successfully!',
    });
  } catch (err) {
    console.error('Error updating delegation:', err);
    res.status(500).json({ success: false, error: 'Failed to update delegation', details: err.message });
  }
});

// DELETE delegation
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const itemCheck = await pool.query('SELECT id FROM delegations WHERE id = $1', [id]);
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Delegation not found' });
    }

    await pool.query('DELETE FROM delegations WHERE id = $1', [id]);

    res.json({ success: true, message: '✓ Delegation deleted successfully!' });
  } catch (err) {
    console.error('Error deleting delegation:', err);
    res.status(500).json({ success: false, error: 'Failed to delete delegation', details: err.message });
  }
});

module.exports = router;