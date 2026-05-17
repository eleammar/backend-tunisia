const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

/* =========================================================
   🔧 HELPERS
========================================================= */
const normalize = (name) => name.trim().toLowerCase();

/* =========================================================
   📥 GET ALL TAGS (search + pagination)
========================================================= */
router.get('/', async (req, res) => {
  try {
    const { search = '', page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT * FROM tags
       WHERE name ILIKE $1
       ORDER BY id DESC
       LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset]
    );

    res.json({
      data: result.rows,
      page: Number(page),
      limit: Number(limit)
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   📊 TAG USAGE (🔥 VERY IMPORTANT)
========================================================= */
router.get('/stats/usage', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id,
        t.name,
        COUNT(DISTINCT pt.tag_id) AS places_count,
        COUNT(DISTINCT et.tag_id) AS events_count,
        COUNT(DISTINCT ft.tag_id) AS foods_count,
        COUNT(DISTINCT ext.tag_id) AS experiences_count,
        COUNT(DISTINCT ct.tag_id) AS cities_count,
        COUNT(DISTINCT ot.tag_id) AS options_count
      FROM tags t
      LEFT JOIN place_tags pt ON pt.tag_id = t.id
      LEFT JOIN event_tags et ON et.tag_id = t.id
      LEFT JOIN food_tags ft ON ft.tag_id = t.id
      LEFT JOIN experience_tags ext ON ext.tag_id = t.id
      LEFT JOIN city_tags ct ON ct.tag_id = t.id
      LEFT JOIN option_tags ot ON ot.tag_id = t.id
      GROUP BY t.id
      ORDER BY t.name
    `);

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   🔍 GET ONE TAG
========================================================= */
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tags WHERE id=$1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   ➕ CREATE TAG
========================================================= */
router.post('/', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const normalized = normalize(name);

    // prevent duplicates
    const exists = await pool.query(
      'SELECT * FROM tags WHERE name=$1',
      [normalized]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Tag already exists' });
    }

    const result = await pool.query(
      `INSERT INTO tags (name)
       VALUES ($1)
       RETURNING *`,
      [normalized]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   ✏️ UPDATE TAG
========================================================= */
router.put('/:id', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const normalized = normalize(name);

    const result = await pool.query(
      `UPDATE tags
       SET name=$1
       WHERE id=$2
       RETURNING *`,
      [normalized, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   ❌ DELETE TAG
========================================================= */
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM tags WHERE id=$1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json({ success: true, deleted: result.rows[0] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;