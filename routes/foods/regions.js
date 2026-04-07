const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');
// GET all regions - ORDERED by ID
router.get('/', async (req, res) => {
  try {
    // ✅ ORDER BY id to maintain correct order
    const result = await pool.query(
      'SELECT * FROM food_regions ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
});

// GET region by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM food_regions WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Region not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching region:', error);
    res.status(500).json({ error: 'Failed to fetch region' });
  }
});

// GET region by gov_id
router.get('/gov/:gov_id', async (req, res) => {
  try {
    const { gov_id } = req.params;
    const result = await pool.query('SELECT * FROM food_regions WHERE gov_id = $1', [gov_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Region not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching region:', error);
    res.status(500).json({ error: 'Failed to fetch region' });
  }
});

// CREATE region
router.post('/', async (req, res) => {
  try {
    const { gov_id, name, specialty, description, images } = req.body;
    
    if (!gov_id || !name) {
      return res.status(400).json({ error: 'gov_id and name are required' });
    }
    
    const result = await pool.query(
      'INSERT INTO food_regions (gov_id, name, specialty, description, images) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [gov_id, name, specialty, description, images || []]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating region:', error);
    res.status(500).json({ error: 'Failed to create region' });
  }
});

// UPDATE region
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { gov_id, name, specialty, description, images } = req.body;
    
    const result = await pool.query(
      `UPDATE food_regions 
       SET gov_id = COALESCE($1, gov_id), 
           name = COALESCE($2, name), 
           specialty = COALESCE($3, specialty), 
           description = COALESCE($4, description), 
           images = COALESCE($5, images),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $6 RETURNING *`,
      [gov_id, name, specialty, description, images, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Region not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating region:', error);
    res.status(500).json({ error: 'Failed to update region' });
  }
});

// DELETE region
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM food_regions WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Region not found' });
    }
    
    res.json({ message: 'Region deleted successfully' });
  } catch (error) {
    console.error('Error deleting region:', error);
    res.status(500).json({ error: 'Failed to delete region' });
  }
});

module.exports = router;