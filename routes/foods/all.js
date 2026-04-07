const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');

// GET all foods with pagination
// Change the GET response:

router.get('/', async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    
    const result = await pool.query(
      'SELECT * FROM all_foods ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [parseInt(limit), parseInt(offset)]
    );
    
    // Return only the data array instead of paginated object
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all foods:', error);
    res.status(500).json({ error: 'Failed to fetch foods' });
  }
});

// SEARCH foods
router.get('/search', async (req, res) => {
  try {
    const { q = '', category = 'all', city = '' } = req.query;
    
    let query = 'SELECT * FROM all_foods WHERE 1=1';
    const params = [];
    
    if (q) {
      query += ' AND (name ILIKE $' + (params.length + 1) + ' OR description ILIKE $' + (params.length + 1) + ' OR city ILIKE $' + (params.length + 1) + ')';
      params.push(`%${q}%`);
    }
    
    if (category && category !== 'all') {
      query += ' AND category = $' + (params.length + 1);
      params.push(category);
    }
    
    if (city) {
      query += ' AND city = $' + (params.length + 1);
      params.push(city);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error searching foods:', error);
    res.status(500).json({ error: 'Failed to search foods' });
  }
});

// GET food by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM all_foods WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Food not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching food:', error);
    res.status(500).json({ error: 'Failed to fetch food' });
  }
});

// CREATE food
router.post('/', async (req, res) => {
  try {
    const { name, category, description, image_url, city, rating, recipe } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }
    
    const result = await pool.query(
      'INSERT INTO all_foods (name, category, description, image_url, city, rating, recipe) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, category, description, image_url, city, rating || 0, JSON.stringify(recipe)]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating food:', error);
    res.status(500).json({ error: 'Failed to create food' });
  }
});

// UPDATE food
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description, image_url, city, rating, recipe } = req.body;
    
    const result = await pool.query(
      `UPDATE all_foods 
       SET name = COALESCE($1, name), 
           category = COALESCE($2, category), 
           description = COALESCE($3, description), 
           image_url = COALESCE($4, image_url), 
           city = COALESCE($5, city), 
           rating = COALESCE($6, rating),
           recipe = COALESCE($7, recipe),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $8 RETURNING *`,
      [name, category, description, image_url, city, rating, recipe ? JSON.stringify(recipe) : null, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Food not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating food:', error);
    res.status(500).json({ error: 'Failed to update food' });
  }
});

// DELETE food
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM all_foods WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Food not found' });
    }
    
    res.json({ message: 'Food deleted successfully' });
  } catch (error) {
    console.error('Error deleting food:', error);
    res.status(500).json({ error: 'Failed to delete food' });
  }
});

module.exports = router;