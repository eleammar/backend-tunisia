const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');
const multer = require('multer');
const path = require('path');

// Dossier où stocker les images uploadées
const upload = multer({
  dest: path.join(__dirname, '../../public/uploads/'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
});

// GET all popular foods
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM popular_foods ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching popular foods:', error);
    res.status(500).json({ error: 'Failed to fetch popular foods' });
  }
});

// GET popular food by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM popular_foods WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Food not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching popular food:', error);
    res.status(500).json({ error: 'Failed to fetch popular food' });
  }
});

// CREATE popular food with image upload
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, category, description, city, recipe } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    const result = await pool.query(
      'INSERT INTO popular_foods (name, category, description, image_url, city, recipe) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, category, description, image_url, city, JSON.stringify(recipe)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating popular food:', error);
    res.status(500).json({ error: 'Failed to create popular food' });
  }
});

// UPDATE popular food with image upload
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description, city, recipe } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
      `UPDATE popular_foods 
       SET name = COALESCE($1, name), 
           category = COALESCE($2, category), 
           description = COALESCE($3, description), 
           image_url = COALESCE($4, image_url), 
           city = COALESCE($5, city), 
           recipe = COALESCE($6, recipe),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $7 RETURNING *`,
      [name, category, description, image_url, city, recipe ? JSON.stringify(recipe) : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Food not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating popular food:', error);
    res.status(500).json({ error: 'Failed to update popular food' });
  }
});

// DELETE popular food
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM popular_foods WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Food not found' });
    }
    
    res.json({ message: 'Food deleted successfully' });
  } catch (error) {
    console.error('Error deleting popular food:', error);
    res.status(500).json({ error: 'Failed to delete popular food' });
  }
});

module.exports = router;