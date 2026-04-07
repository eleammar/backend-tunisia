const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');

// GET all events
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM food_events ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET event by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM food_events WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// CREATE event
router.post('/', async (req, res) => {
  try {
    const { name, date, image_url, description } = req.body;
    
    if (!name || !date) {
      return res.status(400).json({ error: 'Name and date are required' });
    }
    
    const result = await pool.query(
      'INSERT INTO food_events (name, date, image_url, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, date, image_url, description]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// UPDATE event
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, image_url, description } = req.body;
    
    const result = await pool.query(
      `UPDATE food_events 
       SET name = COALESCE($1, name), 
           date = COALESCE($2, date), 
           image_url = COALESCE($3, image_url), 
           description = COALESCE($4, description),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 RETURNING *`,
      [name, date, image_url, description, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE event
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM food_events WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;