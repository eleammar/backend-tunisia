const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

// GET all culture items (with optional pagination)
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT id, city_id, label, title, description, img, rating, display_order, created_at, updated_at
       FROM culture_items
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
    console.error('Error fetching culture items:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch culture items',
      details: err.message,
    });
  }
});

// GET single culture item by ID
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      `SELECT id, city_id, label, title, description, img, rating, display_order, created_at, updated_at
       FROM culture_items WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching culture item:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch item', details: err.message });
  }
});

// GET items by city id
router.get('/city/:cityId', async (req, res) => {
  const cityId = req.params.cityId;
  try {
    // Optionally verify city exists (consistent with events routes)
    const cityCheck = await pool.query('SELECT id FROM cities WHERE id = $1', [cityId]);
    if (cityCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const result = await pool.query(
      `SELECT id, city_id, label, title, description, img, rating, display_order, created_at, updated_at
       FROM culture_items WHERE city_id = $1
       ORDER BY COALESCE(display_order, 9999) ASC, created_at DESC`,
      [cityId]
    );

    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Error fetching items by city:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch items', details: err.message });
  }
});

// CREATE culture item
router.post('/', async (req, res) => {
  try {
    const { city_id, label, title, description, img, rating, display_order } = req.body;

    if (!city_id || !title) {
      return res.status(400).json({ success: false, error: 'city_id and title are required' });
    }

    // Verify city exists
    const cityCheck = await pool.query('SELECT id FROM cities WHERE id = $1', [city_id]);
    if (cityCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const result = await pool.query(
      `INSERT INTO culture_items (city_id, label, title, description, img, rating, display_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
       RETURNING id, city_id, label, title, description, img, rating, display_order, created_at, updated_at`,
      [
        city_id,
        label || null,
        title,
        description || null,
        img || null,
        rating !== undefined && rating !== null ? parseFloat(rating) : null,
        display_order !== undefined && display_order !== null ? parseInt(display_order, 10) : null,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: '✓ Culture item created successfully!',
    });
  } catch (err) {
    console.error('Error creating culture item:', err);
    res.status(500).json({ success: false, error: 'Failed to create item', details: err.message });
  }
});

// UPDATE culture item
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const { city_id, label, title, description, img, rating, display_order } = req.body;

    // Check if item exists
    const itemCheck = await pool.query('SELECT id FROM culture_items WHERE id = $1', [id]);
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    // If city_id provided, verify it exists
    if (city_id) {
      const cityCheck = await pool.query('SELECT id FROM cities WHERE id = $1', [city_id]);
      if (cityCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'City not found' });
      }
    }

    const result = await pool.query(
      `UPDATE culture_items
       SET city_id = COALESCE($1, city_id),
           label = COALESCE($2, label),
           title = COALESCE($3, title),
           description = COALESCE($4, description),
           img = COALESCE($5, img),
           rating = COALESCE($6, rating),
           display_order = COALESCE($7, display_order),
           updated_at = now()
       WHERE id = $8
       RETURNING id, city_id, label, title, description, img, rating, display_order, created_at, updated_at`,
      [
        city_id || null,
        label || null,
        title || null,
        description || null,
        img || null,
        rating !== undefined && rating !== null ? parseFloat(rating) : null,
        display_order !== undefined && display_order !== null ? parseInt(display_order, 10) : null,
        id,
      ]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: '✓ Culture item updated successfully!',
    });
  } catch (err) {
    console.error('Error updating culture item:', err);
    res.status(500).json({ success: false, error: 'Failed to update item', details: err.message });
  }
});

// DELETE culture item
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const itemCheck = await pool.query('SELECT id FROM culture_items WHERE id = $1', [id]);
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    await pool.query('DELETE FROM culture_items WHERE id = $1', [id]);

    res.json({ success: true, message: '✓ Culture item deleted successfully!' });
  } catch (err) {
    console.error('Error deleting culture item:', err);
    res.status(500).json({ success: false, error: 'Failed to delete item', details: err.message });
  }
});

module.exports = router;