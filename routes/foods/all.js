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
router.post('/', upload.single('image'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, category, description, city, rating, recipe, city_id } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    await client.query('BEGIN');

    // 1️⃣ Insert food
    const foodResult = await client.query(
      `INSERT INTO all_foods 
      (name, category, description, image_url, city, rating, recipe)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        name,
        category,
        description,
        image_url,
        city,
        rating || 0,
        JSON.stringify(recipe)
      ]
    );

    const food = foodResult.rows[0];

    // 2️⃣ Insert relation with city
    if (city_id) {
      await client.query(
        `INSERT INTO city_all_foods (city_id, all_food_id)
         VALUES ($1,$2)`,
        [city_id, food.id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json(food);

  } catch (error) {

    await client.query('ROLLBACK');

    console.error('Error creating food:', error);
    res.status(500).json({ error: 'Failed to create food' });

  } finally {
    client.release();
  }
});
// UPDATE food
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description, city, rating, recipe } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

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


router.get('/city/:cityId', async (req, res) => {
  try {
    const { cityId } = req.params;

    const result = await pool.query(
      `SELECT f.*
       FROM city_all_foods caf
       JOIN all_foods f ON f.id = caf.all_food_id
       WHERE caf.city_id = $1
       ORDER BY caf.display_order`,
      [cityId]
    );

    res.json(result.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch foods for city' });
  }
});
module.exports = router;