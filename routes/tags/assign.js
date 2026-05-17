const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

/* =========================================================
   ✅ ALLOWED TABLES (Security)
========================================================= */
const TABLES = {
  place: { table: 'place_tags', field: 'place_id' },
  event: { table: 'event_tags', field: 'event_id' },
  food: { table: 'food_tags', field: 'food_id' },
  experience: { table: 'experience_tags', field: 'experience_id' },
  city: { table: 'city_tags', field: 'city_id' },
  option: { table: 'option_tags', field: 'option_id' }
};

/* =========================================================
   🔧 GENERIC ASSIGN FUNCTION
========================================================= */
const assignTag = async (type, id, tag_id) => {
  const config = TABLES[type];
  if (!config) throw new Error('Invalid type');

  return pool.query(
    `INSERT INTO ${config.table} (${config.field}, tag_id)
     VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [id, tag_id]
  );
};

/* =========================================================
   🔧 ASSIGN MULTIPLE TAGS 🔥
========================================================= */
router.post('/:type', async (req, res) => {
  const { type } = req.params;
  const { id, tag_ids } = req.body;

  if (!id || !Array.isArray(tag_ids)) {
    return res.status(400).json({
      error: 'id and tag_ids[] are required'
    });
  }

  try {
    for (let tag_id of tag_ids) {
      await assignTag(type, id, tag_id);
    }

    res.json({ success: true, message: 'Tags assigned' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   ❌ REMOVE TAG
========================================================= */
router.delete('/:type', async (req, res) => {
  const { type } = req.params;
  const { id, tag_id } = req.body;

  const config = TABLES[type];
  if (!config) return res.status(400).json({ error: 'Invalid type' });

  try {
    await pool.query(
      `DELETE FROM ${config.table}
       WHERE ${config.field}=$1 AND tag_id=$2`,
      [id, tag_id]
    );

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   📥 GET TAGS OF ENTITY
========================================================= */
router.get('/:type/:id', async (req, res) => {
  const { type, id } = req.params;

  const config = TABLES[type];
  if (!config) return res.status(400).json({ error: 'Invalid type' });

  try {
    const result = await pool.query(`
      SELECT t.*
      FROM tags t
      JOIN ${config.table} rel ON rel.tag_id = t.id
      WHERE rel.${config.field} = $1
      ORDER BY t.name
    `, [id]);

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   🔄 REPLACE TAGS (RESET + INSERT)
========================================================= */
router.put('/:type', async (req, res) => {
  const { type } = req.params;
  const { id, tag_ids } = req.body;

  const config = TABLES[type];
  if (!config) return res.status(400).json({ error: 'Invalid type' });

  try {
    // DELETE OLD
    await pool.query(
      `DELETE FROM ${config.table}
       WHERE ${config.field} = $1`,
      [id]
    );

    // INSERT NEW
    for (let tag_id of tag_ids) {
      await assignTag(type, id, tag_id);
    }

    res.json({ success: true, message: 'Tags updated' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;