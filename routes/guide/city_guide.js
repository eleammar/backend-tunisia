const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

// GET /api/guide/city/:cityId
// Returns full tourist guide for one city
router.get('/:cityId', async (req, res) => {
  const { cityId } = req.params;

  try {
    const cityCheck = await pool.query('SELECT id, name FROM cities WHERE id = $1', [cityId]);
    if (cityCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const [
      heroResult,
      heroCatsResult,
      placesResult,
      circuitsResult,
      livesResult,
      categoriesResult,
    ] = await Promise.all([
      pool.query('SELECT * FROM hero_section WHERE city_id = $1', [cityId]),
      pool.query('SELECT * FROM hero_categories ORDER BY id ASC'),
      pool.query(
        `SELECT p.*, c.label AS category_label, c.icon AS category_icon, c.color AS category_color
         FROM places p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.city_id = $1
         ORDER BY p.created_at DESC`,
        [cityId]
      ),
      pool.query('SELECT * FROM circuits WHERE city_id = $1 ORDER BY created_at DESC', [cityId]),
      pool.query('SELECT * FROM live_guides WHERE city_id = $1 ORDER BY rating DESC', [cityId]),
      pool.query('SELECT * FROM categories ORDER BY label ASC'),
    ]);

    // Attach stops to each circuit
    const circuits = await Promise.all(
      circuitsResult.rows.map(async (circuit) => {
        const stops = await pool.query(
          `SELECT cs.*, p.name, p.lat, p.lng, p.image
           FROM circuit_stops cs
           JOIN places p ON cs.place_id = p.id
           WHERE cs.circuit_id = $1
           ORDER BY cs.stop_order`,
          [circuit.id]
        );
        return { ...circuit, stops: stops.rows };
      })
    );

    res.json({
      success: true,
      data: {
        city: cityCheck.rows[0],
        hero: heroResult.rows[0] || null,
        heroCategories: heroCatsResult.rows,
        categories: categoriesResult.rows,
        places: placesResult.rows,
        circuits,
        liveGuides: livesResult.rows,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
