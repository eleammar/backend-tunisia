const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');
const axios = require('axios');

const OPENCAGE_KEY = '0a212fa57fab40598cd92aece8172f6d';

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

    // 🔥 coordonnées auto
    const coords = await getCoordinates(address);
    const lat = coords ? coords.lat : null;
    const lng = coords ? coords.lng : null;

    const result = await pool.query(
      `INSERT INTO places (
        name, description, duration, category_id, image,
        tags, rating, reviews, price, open_hours,
        address, city_id, lat, lng
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,$12,$13,$14
      ) RETURNING *`,
      [
        name,
        description,
        duration,
        category_id,
        image,
        tags,
        rating,
        reviews,
        price || null,
        open_hours || null,
        address,
        city_id,
        lat,
        lng
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
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

    // recalcul coordonnées
    const coords = await getCoordinates(address);
    const lat = coords ? coords.lat : null;
    const lng = coords ? coords.lng : null;

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
        duration,
        category_id,
        image,
        tags,
        rating,
        reviews,
        price || null,
        open_hours || null,
        address,
        city_id,
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