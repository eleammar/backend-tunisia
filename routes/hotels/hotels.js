const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

// GET all hotels (supports optional city filter, pagination)
router.get('/', async (req, res) => {
  try {
    const { city = '', limit = 10, offset = 0 } = req.query;

    let query = 'SELECT id, city_id, name, distance, img, rating, price, display_order, created_at, updated_at FROM hotels WHERE 1=1';
    const params = [];

    if (city) {
      query += ' AND city_id = $' + (params.length + 1);
      params.push(city);
    }

    query += ' ORDER BY COALESCE(display_order, 9999) ASC, rating DESC NULLS LAST';
    query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await pool.query(query, params);

    const countQuery = 'SELECT COUNT(*) FROM hotels' + (city ? ' WHERE city_id = $1' : '');
    const countResult = await pool.query(countQuery, city ? [city] : []);

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
  } catch (error) {
    console.error('Error fetching hotels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch hotels', details: error.message });
  }
});

// GET hotels by city id (explicit route)
router.get('/city/:cityId', async (req, res) => {
  const cityId = req.params.cityId;
  try {
    // Verify city exists
    const cityCheck = await pool.query('SELECT id FROM cities WHERE id = $1', [cityId]);
    if (cityCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const result = await pool.query(
      `SELECT id, city_id, name, distance, img, rating, price, display_order, created_at, updated_at
       FROM hotels
       WHERE city_id = $1
       ORDER BY COALESCE(display_order, 9999) ASC, rating DESC NULLS LAST`,
      [cityId]
    );

    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Error fetching hotels by city:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch hotels', details: err.message });
  }
});

// GET single hotel by ID
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      'SELECT id, city_id, name, distance, img, rating, price, display_order, created_at, updated_at FROM hotels WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Hotel not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching hotel:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch hotel', details: err.message });
  }
});

// CREATE hotel
router.post('/', async (req, res) => {
  try {
    const { city_id, name, distance, img, rating, price, display_order } = req.body;

    if (!city_id || !name) {
      return res.status(400).json({ success: false, error: 'city_id and name are required' });
    }

    // Verify city exists
    const cityCheck = await pool.query('SELECT id FROM cities WHERE id = $1', [city_id]);
    if (cityCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const result = await pool.query(
      `INSERT INTO hotels (city_id, name, distance, img, rating, price, display_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
       RETURNING id, city_id, name, distance, img, rating, price, display_order, created_at, updated_at`,
      [
        city_id,
        name,
        distance || null,
        img || null,
        rating !== undefined && rating !== null ? parseFloat(rating) : null,
        price || null,
        display_order !== undefined && display_order !== null ? parseInt(display_order, 10) : null
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: '✓ Hotel created successfully!' });
  } catch (err) {
    console.error('Error creating hotel:', err);
    res.status(500).json({ success: false, error: 'Failed to create hotel', details: err.message });
  }
});

// UPDATE hotel
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const { city_id, name, distance, img, rating, price, display_order } = req.body;

    const exists = await pool.query('SELECT id FROM hotels WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Hotel not found' });
    }

    if (city_id) {
      const cityCheck = await pool.query('SELECT id FROM cities WHERE id = $1', [city_id]);
      if (cityCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'City not found' });
      }
    }

    const result = await pool.query(
      `UPDATE hotels SET
         city_id = COALESCE($1, city_id),
         name = COALESCE($2, name),
         distance = COALESCE($3, distance),
         img = COALESCE($4, img),
         rating = COALESCE($5, rating),
         price = COALESCE($6, price),
         display_order = COALESCE($7, display_order),
         updated_at = now()
       WHERE id = $8
       RETURNING id, city_id, name, distance, img, rating, price, display_order, created_at, updated_at`,
      [
        city_id || null,
        name || null,
        distance || null,
        img || null,
        rating !== undefined && rating !== null ? parseFloat(rating) : null,
        price || null,
        display_order !== undefined && display_order !== null ? parseInt(display_order, 10) : null,
        id
      ]
    );

    res.json({ success: true, data: result.rows[0], message: '✓ Hotel updated successfully!' });
  } catch (err) {
    console.error('Error updating hotel:', err);
    res.status(500).json({ success: false, error: 'Failed to update hotel', details: err.message });
  }
});

// DELETE hotel
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const exists = await pool.query('SELECT id FROM hotels WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Hotel not found' });
    }

    await pool.query('DELETE FROM hotels WHERE id = $1', [id]);

    res.json({ success: true, message: '✓ Hotel deleted successfully!' });
  } catch (err) {
    console.error('Error deleting hotel:', err);
    res.status(500).json({ success: false, error: 'Failed to delete hotel', details: err.message });
  }
});

module.exports = router;