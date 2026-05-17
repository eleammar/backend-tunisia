const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const OPENCAGE_KEY = '254b914b13c645fc8a17206dff09d991';

// 🔹 Fonction géocodage
async function getCoordinates(address) {
  try {
    const res = await axios.get(
      'https://api.opencagedata.com/geocode/v1/json',
      {
        params: {
          q: address,
          key: OPENCAGE_KEY,
          limit: 1,
          countrycode: 'tn'
        }
      }
    );

    if (res.data.results.length === 0) return null;

    return res.data.results[0].geometry;

  } catch (err) {
    console.error('Geocoding error:', err.message);
    return null;
  }
}

//
// ✅ GET ALL
//
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM places ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ GET BY ID
//
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM places WHERE id = $1',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ GET BY CITY
//
router.get('/city/:cityId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM places WHERE city_id = $1',
      [req.params.cityId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ GET BY CATEGORY
//
router.get('/category/:categoryId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM places WHERE category_id = $1',
      [req.params.categoryId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ CREATE PLACE (corrigé)
//
router.post('/', async (req, res) => {
  try {
    console.log("BODY:", req.body);

    const {
      name,
      description,
      duration,
      category_id,
      image,
      tags,
      rating,
      reviews,
      price,
      open_hours,
      address,
      city_id
    } = req.body;

    const coords = await getCoordinates(address);

    const lat = req.body.lat || (coords ? coords.lat : null);
    const lng = req.body.lng || (coords ? coords.lng : null);

    const result = await pool.query(
      `INSERT INTO places (
        id, name, description, duration, category_id, image,
        tags, rating, reviews, price, open_hours,
        address, city_id, lat, lng
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,
        $12,$13,$14,$15
      ) RETURNING *`,
      [
        uuidv4(),
        name,
        description,
        duration || null,
        category_id,
        image,
        tags || null,
        rating ? parseFloat(rating) : null, // ✅ FIX
        reviews || null,
        price || null,
        open_hours || null,
        address,
        city_id ? Number(city_id) : null, // ✅ FIX
        lat,
        lng
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("ERROR:", err.message); // 👈 IMPORTANT
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ UPDATE PLACE
//
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      description,
      duration,
      category_id,
      image,
      tags,
      rating,
      reviews,
      price,
      open_hours,
      address,
      city_id
    } = req.body;

    const coords = await getCoordinates(address);
    const lat = req.body.lat || (coords ? coords.lat : null);
    const lng = req.body.lng || (coords ? coords.lng : null);

    const result = await pool.query(
      `UPDATE places SET
        name=$1,
        description=$2,
        duration=$3,
        category_id=$4,
        image=$5,
        tags=$6,
        rating=$7,
        reviews=$8,
        price=$9,
        open_hours=$10,
        address=$11,
        city_id=$12,
        lat=$13,
        lng=$14,
        updated_at=NOW()
      WHERE id=$15
      RETURNING *`,
      [
        name,
        description,
        duration || null,
        category_id,
        image,
        tags || null,
        rating,
        reviews || null,
        price || null,
        open_hours || null,
        address,
        city_id || null,
        lat,
        lng,
        req.params.id
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ DELETE
//
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM places WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Place deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;