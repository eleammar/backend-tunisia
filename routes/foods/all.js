const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');
const multer = require('multer');
const path = require('path');

// Upload config
const upload = multer({
  dest: path.join(__dirname, '../../public/uploads/'),
  limits: { fileSize: 5 * 1024 * 1024 },
});


// ✅ GET ALL FOODS
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, c.name as city_name
       FROM all_foods f
       LEFT JOIN cities c ON c.id = f.city_id
       ORDER BY f.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch foods' });
  }
});


// ✅ SEARCH
router.get('/search', async (req, res) => {
  try {
    const { q = '', category = 'all', city_id } = req.query;

    let query = `
      SELECT f.*, c.name as city_name
      FROM all_foods f
      LEFT JOIN cities c ON c.id = f.city_id
      WHERE 1=1
    `;

    const params = [];

    if (q) {
      query += ` AND (f.name ILIKE $${params.length + 1} OR f.description ILIKE $${params.length + 1})`;
      params.push(`%${q}%`);
    }

    if (category !== 'all') {
      query += ` AND f.category = $${params.length + 1}`;
      params.push(category);
    }

    if (city_id) {
      query += ` AND f.city_id = $${params.length + 1}`;
      params.push(city_id);
    }

    query += ' ORDER BY f.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Search failed' });
  }
});


// ✅ GET BY ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, c.name as city_name
       FROM all_foods f
       LEFT JOIN cities c ON c.id = f.city_id
       WHERE f.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Food not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({ error: 'Error fetching food' });
  }
});


// ✅ CREATE FOOD
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, category, description, rating, recipe, city_id } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !category || !city_id) {
      return res.status(400).json({ error: 'Name, category, city_id required' });
    }

    // Fetch city name from cities table to populate the `city` column
    const cityResult = await pool.query(
      'SELECT name FROM cities WHERE id = $1',
      [city_id]
    );

    if (!cityResult.rows.length) {
      return res.status(400).json({ error: 'City not found' });
    }

    const cityName = cityResult.rows[0].name;

    const result = await pool.query(
      `INSERT INTO all_foods
      (name, category, description, image_url, rating, recipe, city_id, city)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        name,
        category,
        description,
        image_url,
        rating || 0,
        JSON.stringify(recipe),
        city_id,
        cityName
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Create failed' });
  }
});


// ✅ UPDATE
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, category, description, rating, recipe, city_id } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    // If city_id is provided, fetch the city name to keep `city` column in sync
    let cityName = null;
    if (city_id) {
      const cityResult = await pool.query(
        'SELECT name FROM cities WHERE id = $1',
        [city_id]
      );
      if (cityResult.rows.length) {
        cityName = cityResult.rows[0].name;
      }
    }

    const result = await pool.query(
      `UPDATE all_foods SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        description = COALESCE($3, description),
        image_url = COALESCE($4, image_url),
        rating = COALESCE($5, rating),
        recipe = COALESCE($6, recipe),
        city_id = COALESCE($7, city_id),
        city = COALESCE($8, city),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 RETURNING *`,
      [
        name,
        category,
        description,
        image_url,
        rating,
        recipe ? JSON.stringify(recipe) : null,
        city_id,
        cityName,
        req.params.id
      ]
    );

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({ error: 'Update failed' });
  }
});


// ✅ DELETE
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM all_foods WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Delete failed' });
  }
});


// ✅ GET FOODS BY CITY (IMPORTANT 🔥)
router.get('/city/:cityId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM all_foods
       WHERE city_id = $1
       ORDER BY created_at DESC`,
      [req.params.cityId]
    );

    res.json(result.rows);

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch city foods' });
  }
});

module.exports = router;