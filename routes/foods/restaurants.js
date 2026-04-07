const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');
// GET all restaurants
router.get('/', async (req, res) => {
  try {
    const { city = '', limit = 10, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM restaurants WHERE 1=1';
    const params = [];
    
    if (city) {
      query += ' AND city = $' + (params.length + 1);
      params.push(city);
    }
    
    query += ' ORDER BY rating DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    const countResult = await pool.query('SELECT COUNT(*) FROM restaurants' + (city ? ' WHERE city = $1' : ''), city ? [city] : []);
    
    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// GET restaurant by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

// GET unique cities
router.get('/cities/list', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT city FROM restaurants WHERE city IS NOT NULL ORDER BY city');
    res.json(result.rows.map(row => row.city));
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// CREATE restaurant
router.post('/', async (req, res) => {
  try {
    const { name, city, rating, type, image_url, link } = req.body;
    
    if (!name || !city) {
      return res.status(400).json({ error: 'Name and city are required' });
    }
    
    const result = await pool.query(
      'INSERT INTO restaurants (name, city, rating, type, image_url, link) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, city, rating || 0, type, image_url, link]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

// UPDATE restaurant
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, city, rating, type, image_url, link } = req.body;
    
    const result = await pool.query(
      `UPDATE restaurants 
       SET name = COALESCE($1, name), 
           city = COALESCE($2, city), 
           rating = COALESCE($3, rating), 
           type = COALESCE($4, type), 
           image_url = COALESCE($5, image_url),
           link = COALESCE($6, link),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $7 RETURNING *`,
      [name, city, rating, type, image_url, link, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating restaurant:', error);
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
});

// DELETE restaurant
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM restaurants WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    res.json({ message: 'Restaurant deleted successfully' });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    res.status(500).json({ error: 'Failed to delete restaurant' });
  }
});

module.exports = router;