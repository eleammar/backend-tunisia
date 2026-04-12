const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

const ALLOWED_TYPES = [
  'Culture & History',
  'Nature',
  'Food & Beverages',
  'Adventure',
  'Leisure'
];

// GET all experiences (pagination optional)
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT id, city_id, name, type, rating, img, display_order, created_at, updated_at
       FROM experiences
       ORDER BY COALESCE(display_order, 9999) ASC, created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit, 10), parseInt(offset, 10)]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching experiences:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch experiences',
      details: err.message,
    });
  }
});

// GET single experience by ID
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      `SELECT id, city_id, name, type, rating, img, display_order, created_at, updated_at
       FROM experiences WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching experience:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch experience', details: err.message });
  }
});

// GET experiences by city id
router.get('/city/:cityId', async (req, res) => {
  const cityId = req.params.cityId;
  try {
    // Verify city exists (consistent with other routes)
    const cityCheck = await pool.query('SELECT id FROM cities WHERE id = $1', [cityId]);
    if (cityCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const result = await pool.query(
      `SELECT id, city_id, name, type, rating, img, display_order, created_at, updated_at
       FROM experiences WHERE city_id = $1
       ORDER BY COALESCE(display_order, 9999) ASC, created_at DESC`,
      [cityId]
    );

    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Error fetching experiences by city:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch experiences', details: err.message });
  }
});

// CREATE experience
router.post('/', async (req, res) => {
  try {
    const { city_id, name, type, rating, img, display_order } = req.body;

    if (!city_id || !name || !type) {
      return res.status(400).json({ success: false, error: 'city_id, name and type are required' });
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type. Allowed types: ' + ALLOWED_TYPES.join(', ') });
    }

    // Verify city exists
    const cityCheck = await pool.query('SELECT id FROM cities WHERE id = $1', [city_id]);
    if (cityCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const result = await pool.query(
      `INSERT INTO experiences (city_id, name, type, rating, img, display_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       RETURNING id, city_id, name, type, rating, img, display_order, created_at, updated_at`,
      [
        city_id,
        name,
        type,
        rating !== undefined && rating !== null ? parseFloat(rating) : null,
        img || null,
        display_order !== undefined && display_order !== null ? parseInt(display_order, 10) : null,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: '✓ Experience created successfully!',
    });
  } catch (err) {
    console.error('Error creating experience:', err);
    res.status(500).json({ success: false, error: 'Failed to create experience', details: err.message });
  }
});

// UPDATE experience
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const { city_id, name, type, rating, img, display_order } = req.body;

    // Check if exists
    const itemCheck = await pool.query('SELECT id FROM experiences WHERE id = $1', [id]);
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    if (type && !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type. Allowed types: ' + ALLOWED_TYPES.join(', ') });
    }

    if (city_id) {
      const cityCheck = await pool.query('SELECT id FROM cities WHERE id = $1', [city_id]);
      if (cityCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'City not found' });
      }
    }

    const result = await pool.query(
      `UPDATE experiences
       SET city_id = COALESCE($1, city_id),
           name = COALESCE($2, name),
           type = COALESCE($3, type),
           rating = COALESCE($4, rating),
           img = COALESCE($5, img),
           display_order = COALESCE($6, display_order),
           updated_at = now()
       WHERE id = $7
       RETURNING id, city_id, name, type, rating, img, display_order, created_at, updated_at`,
      [
        city_id || null,
        name || null,
        type || null,
        rating !== undefined && rating !== null ? parseFloat(rating) : null,
        img || null,
        display_order !== undefined && display_order !== null ? parseInt(display_order, 10) : null,
        id,
      ]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: '✓ Experience updated successfully!',
    });
  } catch (err) {
    console.error('Error updating experience:', err);
    res.status(500).json({ success: false, error: 'Failed to update experience', details: err.message });
  }
});

// DELETE experience
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const itemCheck = await pool.query('SELECT id FROM experiences WHERE id = $1', [id]);
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    await pool.query('DELETE FROM experiences WHERE id = $1', [id]);

    res.json({ success: true, message: '✓ Experience deleted successfully!' });
  } catch (err) {
    console.error('Error deleting experience:', err);
    res.status(500).json({ success: false, error: 'Failed to delete experience', details: err.message });
  }
});

module.exports = router;