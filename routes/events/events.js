// backend/routes/events/events.js - COMPLETE WITH CRUD
const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');

// ════════════════════════════════════════════════════════════════
// GET ALL EVENTS (GLOBAL)
// ════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, city_id, date, name, img, category, created_at, updated_at 
       FROM events 
       ORDER BY date DESC`
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events',
      details: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET SINGLE EVENT BY ID
// ════════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  const eventId = req.params.id;

  try {
    const result = await pool.query(
      `SELECT id, city_id, date, name, img, category, created_at, updated_at 
       FROM events 
       WHERE id = $1`,
      [eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch event',
      details: err.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// GET EVENTS BY CITY ID
// ════════════════════════════════════════════════════════════════
router.get('/city/:cityId', async (req, res) => {
  const cityId = req.params.cityId;

  try {
    // Check if city exists
    const cityCheck = await pool.query(
      'SELECT id FROM cities WHERE id = $1',
      [cityId]
    );

    if (cityCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'City not found',
      });
    }

    const result = await pool.query(
      `SELECT id, city_id, date, name, img, category, created_at, updated_at 
       FROM events 
       WHERE city_id = $1 
       ORDER BY date ASC`,
      [cityId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching events by city:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events',
      details: err.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// GET EVENTS BY CATEGORY
// ════════════════════════════════════════════════════════════════
router.get('/category/:category', async (req, res) => {
  const category = req.params.category;

  try {
    const result = await pool.query(
      `SELECT id, city_id, date, name, img, category, created_at, updated_at 
       FROM events 
       WHERE category = $1
       ORDER BY date DESC`,
      [category]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching events by category:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events',
      details: err.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// GET ALL EVENT CATEGORIES
// ════════════════════════════════════════════════════════════════
router.get('/list/categories', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT category 
       FROM events 
       WHERE category IS NOT NULL
       ORDER BY category ASC`
    );

    const categories = [
      "Festivals culturels",
      "Festivals musicaux",
      "Événements traditionnels et religieux",
      "Événements gastronomiques",
      "Événements sportifs",
      "Événements touristiques et culturels"
    ];

    res.json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      details: err.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// CREATE NEW EVENT (POST)
// ════════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { city_id, date, name, img, category } = req.body;

    // Validate required fields
    if (!city_id || !date || !name) {
      return res.status(400).json({
        success: false,
        error: 'city_id, date, and name are required',
      });
    }

    // Check if city exists
    const cityCheck = await pool.query(
      'SELECT id FROM cities WHERE id = $1',
      [city_id]
    );

    if (cityCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'City not found',
      });
    }

    const result = await pool.query(
      `INSERT INTO events (city_id, date, name, img, category, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       RETURNING id, city_id, date, name, img, category, created_at, updated_at`,
      [city_id, date, name, img || null, category || 'Événements']
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: '✓ Event created successfully!',
    });
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create event',
      details: err.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// UPDATE EVENT (PUT)
// ════════════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  const eventId = req.params.id;

  try {
    const { city_id, date, name, img, category } = req.body;

    // Check if event exists
    const eventCheck = await pool.query(
      'SELECT id FROM events WHERE id = $1',
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      });
    }

    // If city_id is being updated, verify the city exists
    if (city_id) {
      const cityCheck = await pool.query(
        'SELECT id FROM cities WHERE id = $1',
        [city_id]
      );

      if (cityCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'City not found',
        });
      }
    }

    const result = await pool.query(
      `UPDATE events 
       SET city_id = COALESCE($1, city_id),
           date = COALESCE($2, date),
           name = COALESCE($3, name),
           img = COALESCE($4, img),
           category = COALESCE($5, category),
           updated_at = now()
       WHERE id = $6
       RETURNING id, city_id, date, name, img, category, created_at, updated_at`,
      [city_id || null, date || null, name || null, img || null, category || null, eventId]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: '✓ Event updated successfully!',
    });
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update event',
      details: err.message,
    });
  }
});

// ═══��════════════════════════════════════════════════════════════
// DELETE EVENT (DELETE)
// ════════════════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  const eventId = req.params.id;

  try {
    // Check if event exists
    const eventCheck = await pool.query(
      'SELECT id FROM events WHERE id = $1',
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      });
    }

    // Delete the event
    await pool.query(
      'DELETE FROM events WHERE id = $1',
      [eventId]
    );

    res.json({
      success: true,
      message: '✓ Event deleted successfully!',
    });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete event',
      details: err.message,
    });
  }
});

module.exports = router;